/**
* MIT License
*
* Copyright (c) 2020 Bureau Moeilijke Dingen
* 
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as YAML from 'yaml';
import {
  EXTENSION_CONFIG_NAME, EXTENSION_NAME, makefileName, MAKE_DEFAULT_CONCURRENT_JOBS, TOOL_SETTINGS,
} from '../Definitions';
import { which } from '../Helpers';
import { DualBankIo, createVsCodeIo } from './workspaceIo';
import { parseBootloaderConfig, resolveBootloader, validateCommonDefs } from './config';
import { planDualBankArtifacts } from './generate';
import { mergeDualBankTasks } from './tasksMerge';
import { checkVtor, VtorSourceFile } from './vtorCheck';
import { runDualBuild, DualBuildReport, ExecResult } from './dualBuild';

// Version of the dual-bank generator itself, stamped into the sentinel header of every
// generated file. Deliberately NOT the host extension's manifest version: hand-edit
// detection is hash-only, so this line is purely human-readable provenance, and the
// upstream extension's version would be misleading about what produced the file.
// Bump this when the generated output format changes.
const DUALBANK_GENERATOR_VERSION = '1.0.0';

function bankLdRelPath(bankId: string): string {
  // Root-level filename, matching HVC-Firmware's existing hand-written
  // STM32L432XX_APP_BANK_*.ld convention (see generate.ts).
  return `STM32L432XX_APP_BANK_${bankId.toUpperCase()}.ld`;
}

export async function runRegenerate(
  io: DualBankIo, version: string,
): Promise<{ wrote: string[]; warnings: string[] }> {
  const wrote: string[] = [];
  const warnings: string[] = [];

  const yamlText = await io.readText(EXTENSION_CONFIG_NAME);
  const cfg = yamlText ? parseBootloaderConfig(yamlText) : undefined;
  if (!yamlText || !cfg) {
    io.warn('stm32-trev: no bootloader config found; nothing to regenerate.');
    return { wrote, warnings };
  }

  const commonDefsErrors = validateCommonDefs(cfg.commonDefs);
  if (commonDefsErrors.length > 0) {
    warnings.push(...commonDefsErrors);
    io.warn('stm32-trev: commonDefs is missing required defines; nothing generated.');
    return { wrote, warnings };
  }
  const resolved = resolveBootloader(cfg);

  const ldName = (YAML.parse(yamlText)?.ldscript as string) || 'STM32L432XX_FLASH.ld';
  const baseLd = await io.readText(ldName);
  if (baseLd === undefined) {
    warnings.push(`stm32-trev: base linker script "${ldName}" not found; cannot generate bank scripts.`);
    return { wrote, warnings };
  }

  const existingFiles: { relPath: string; content: string }[] = [];
  for (const bank of resolved.banks) {
    const rel = bankLdRelPath(bank.id);
    const existing = await io.readText(rel);
    if (existing !== undefined) { existingFiles.push({ relPath: rel, content: existing }); }
  }

  const plan = planDualBankArtifacts({
    version,
    baseLinkerScript: baseLd,
    baseLinkerScriptRelPath: ldName,
    resolved,
    existingFiles,
  });
  for (const file of plan.files) {
    if (file.handEdited) {
      warnings.push(`stm32-trev: kept your edited ${file.relPath}; delete it and regenerate to refresh.`);
      continue;
    }
    await io.writeText(file.relPath, file.content);
    wrote.push(file.relPath);
  }

  const tasks = mergeDualBankTasks(await io.readText('.vscode/tasks.json'));
  await io.writeText('.vscode/tasks.json', tasks);
  wrote.push('.vscode/tasks.json');

  const sources = await io.listSourceFiles();
  const vtorInputs: VtorSourceFile[] = [];
  for (const source of sources) {
    const content = await io.readText(source);
    if (content !== undefined) { vtorInputs.push({ path: source, content }); }
  }
  const vtor = checkVtor(vtorInputs, resolved.banks);
  if (!vtor.ok) { warnings.push(`${vtor.message}\n${vtor.snippet}`); }

  const warnPart = warnings.length ? `, ${warnings.length} warning(s)` : '';
  io.info(`stm32-trev: regenerated ${wrote.length} file(s)${warnPart}.`);
  return { wrote, warnings };
}

function execSpawn(cmd: string, args: string[], cwd: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => { resolve({ code: code ?? 1, stdout, stderr }); });
    child.on('error', (e) => { resolve({ code: 1, stdout, stderr: `${stderr}\n${e.message}` }); });
  });
}

export async function runBuild(
  io: DualBankIo, version: string, onlyBankId?: string,
): Promise<DualBuildReport> {
  // The whole body is guarded, not just runDualBuild: runRegenerate itself has real throw
  // paths (parseBootloaderConfig on a bootloader block missing preset/targetBaseName,
  // resolvePreset on an unknown preset, YAML.parse on malformed yaml, and mergeDualBankTasks'
  // bare JSON.parse on a .vscode/tasks.json containing // comments), and runDualBuild can
  // throw via a rejecting exec or parseSizeOutput on unparseable `size` output.
  try {
    const { warnings } = await runRegenerate(io, version);
    warnings.forEach((w) => io.warn(w));

    const yamlText = await io.readText(EXTENSION_CONFIG_NAME);
    const cfg = yamlText ? parseBootloaderConfig(yamlText) : undefined;
    if (!cfg) {
      const summary = 'stm32-trev: no bootloader config found; nothing to build.';
      io.warn(summary);
      return { ok: false, banks: [], summary };
    }
    const resolved = resolveBootloader(cfg);
    const banks = onlyBankId ? resolved.banks.filter((b) => b.id === onlyBankId) : resolved.banks;
    if (banks.length === 0) {
      const summary = `stm32-trev: unknown bank "${onlyBankId}"`;
      io.warn(summary);
      return { ok: false, banks: [], summary };
    }
    const bankLdRelPaths: Record<string, string> = {};
    resolved.banks.forEach((b) => { bankLdRelPaths[b.id] = bankLdRelPath(b.id); });

    // make/arm-none-eabi-size themselves still come off PATH (no reuse of BuildTask.ts's
    // tool resolution yet), but the compiler must not: STM32Make.make's PATH-only fallback
    // is `CC ?= $(ARM_PREFIX)gcc`, which never actually takes effect (GNU Make's built-in
    // default for CC beats `?=`), so without this every dual-bank build silently invokes
    // the system `cc` instead of the ARM cross-compiler. Prefer the extension's configured
    // armToolchainPath (matches the normal single-bank build); fall back to resolving
    // arm-none-eabi-gcc on PATH and passing its directory the same way.
    const configuredToolchainPath = vscode.workspace
      .getConfiguration(EXTENSION_NAME).get<string>(TOOL_SETTINGS.armToolchainPath);
    let armGccPath: string | undefined;
    if (configuredToolchainPath) {
      armGccPath = configuredToolchainPath;
      io.warn(`stm32-trev: using make from PATH; arm-none-eabi-gcc from configured armToolchainPath (${armGccPath})`);
    } else {
      const resolvedGcc = which('arm-none-eabi-gcc');
      if (resolvedGcc) {
        armGccPath = path.dirname(resolvedGcc);
        io.warn(`stm32-trev: using make from PATH; arm-none-eabi-gcc resolved from PATH (${armGccPath})`);
      } else {
        io.warn('stm32-trev: arm-none-eabi-gcc not found on PATH and armToolchainPath is not configured; build will likely fail.');
      }
    }

    const report = await runDualBuild({
      projectRoot: io.projectRoot(),
      makeProgram: 'make',
      makefileName,
      banks,
      targetBaseName: resolved.targetBaseName,
      commonDefs: resolved.commonDefs,
      bankLdRelPaths,
      outputDir: resolved.outputDir,
      maxImageBytes: resolved.maxImageBytes,
      maxImageWarnPct: resolved.maxImageWarnPct,
      concurrency: MAKE_DEFAULT_CONCURRENT_JOBS,
      sizeProgram: 'arm-none-eabi-size',
      armGccPath,
      exec: execSpawn,
      stageFile: async (from: string, to: string): Promise<void> => {
        const root = io.projectRoot();
        await fs.mkdir(path.dirname(path.join(root, to)), { recursive: true });
        await fs.copyFile(path.join(root, from), path.join(root, to));
      },
    });

    io.info(report.summary);
    if (!report.ok) { io.warn('stm32-trev: dual-bank build failed — see the summary above.'); }
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.warn(`stm32-trev: dual-bank build failed: ${message}`);
    return { ok: false, banks: [], summary: message };
  }
}

// Command callbacks are the outermost boundary: anything that escapes them becomes an
// unhandled promise rejection with no user-visible message. createVsCodeIo() throws
// synchronously when no workspace folder is open, and runRegenerate can throw (see runBuild).
async function runGuarded(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`stm32-trev: ${message}`);
  }
}

export function registerDualBankCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('stm32-trev.regenerateBuildFiles', async () => {
      await runGuarded(async () => {
        const { warnings } = await runRegenerate(createVsCodeIo(), DUALBANK_GENERATOR_VERSION);
        warnings.forEach((w) => vscode.window.showWarningMessage(w));
      });
    }),
    vscode.commands.registerCommand('stm32-trev.buildDualBank', async () => {
      await runGuarded(async () => {
        await runBuild(createVsCodeIo(), DUALBANK_GENERATOR_VERSION);
      });
    }),
    vscode.commands.registerCommand('stm32-trev.buildBank', async () => {
      await runGuarded(async () => {
        const pick = await vscode.window.showQuickPick(['a', 'b'], { placeHolder: 'Which bank?' });
        if (pick) { await runBuild(createVsCodeIo(), DUALBANK_GENERATOR_VERSION, pick); }
      });
    }),
  );
}
