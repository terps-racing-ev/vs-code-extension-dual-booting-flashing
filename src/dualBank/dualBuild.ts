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

/**
 * Builds each selected bank with its own linker script, checks image size, and stages output artifacts.
 * It supplies the implementation used by this part of the extension.
 */
import { Bank } from './types';
import { parseSizeOutput, evaluateBudget, BudgetVerdict } from './sizeReport';

export interface ExecResult { code: number; stdout: string; stderr: string; }
export type Exec = (cmd: string, args: string[], cwd: string) => Promise<ExecResult>;

export interface DualBuildOptions {
  projectRoot: string;
  makeProgram: string;
  makefileName: string;
  banks: Bank[];
  targetBaseName: string;
  commonDefs: string[];
  bankLdRelPaths: Record<string, string>;
  outputDir: string;
  maxImageBytes: number;
  maxImageWarnPct: number;
  concurrency: number;
  exec: Exec;
  sizeProgram: string;
  stageFile: (from: string, to: string) => Promise<void>;
  // Directory containing the arm-none-eabi-* binaries. STM32Make.make's PATH-only fallback
  // is `CC ?= $(ARM_PREFIX)gcc`, which GNU Make's built-in default for CC (`cc`) silently
  // wins over — `?=` never assigns because Make already considers CC "set" (origin: default).
  // Passing ARM_GCC_PATH takes the makefile's `ifdef ARM_GCC_PATH` branch instead, which uses
  // a real `=` assignment and is unaffected by that gotcha. Omit only if the makefile in use
  // doesn't have that branch.
  armGccPath?: string;
}
export interface BankBuildResult {
  bankId: string; ok: boolean; budget: BudgetVerdict; artifacts: string[]; log: string;
}
export interface DualBuildReport { ok: boolean; banks: BankBuildResult[]; summary: string; }

function defs(opts: DualBuildOptions, bank: Bank): string {
  const common = opts.commonDefs.map((d) => `-D${d}`).join(' ');
  return `${common} -DVECT_TAB_OFFSET=0x${bank.vectorTableOffset.toString(16)}`;
}

export function buildMakeArgs(opts: DualBuildOptions, bank: Bank): string[] {
  const d = defs(opts, bank);
  return [
    '-f', opts.makefileName,
    `-j${opts.concurrency}`,
    `TARGET=${opts.targetBaseName}_${bank.id}`,
    `BUILD_DIRECTORY=build/bank_${bank.id}`,
    `LDSCRIPT=${opts.bankLdRelPaths[bank.id]}`,
    `C_DEFS=${d}`,
    `CXX_DEFS=${d}`,
    ...(opts.armGccPath ? [`ARM_GCC_PATH=${opts.armGccPath}`] : []),
  ];
}

export async function runDualBuild(opts: DualBuildOptions): Promise<DualBuildReport> {
  const results: BankBuildResult[] = [];
  for (const bank of opts.banks) {
    const label = bank.id.toUpperCase();
    const make = await opts.exec(opts.makeProgram, buildMakeArgs(opts, bank), opts.projectRoot);
    const outBase = `${opts.targetBaseName}_${bank.id}`;
    const bankBuildDir = `build/bank_${bank.id}/debug`;
    let budget: BudgetVerdict = {
      flashBytes: 0, bankBytes: opts.maxImageBytes, usedPct: 0, level: 'ok', message: 'not built',
    };
    const artifacts: string[] = [];
    let ok = make.code === 0;
    if (ok) {
      // A failure here (the `size` tool missing/crashing, unparseable output, a staging
      // I/O error) degrades this one bank instead of rejecting the whole run and
      // discarding the banks already built — same shape as a `make` failure.
      try {
        const size = await opts.exec(opts.sizeProgram, [`${bankBuildDir}/${outBase}.elf`], opts.projectRoot);
        budget = evaluateBudget(parseSizeOutput(size.stdout), opts.maxImageBytes, opts.maxImageWarnPct);
        if (budget.level === 'over') { ok = false; }
        for (const ext of ['bin', 'elf', 'hex']) {
          const to = `${opts.outputDir}/${outBase}.${ext}`;
          await opts.stageFile(`${bankBuildDir}/${outBase}.${ext}`, to);
          artifacts.push(to);
        }
      } catch (e) {
        ok = false;
        budget = {
          flashBytes: 0, bankBytes: opts.maxImageBytes, usedPct: 0, level: 'over',
          message: `size/stage step failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
    results.push({
      bankId: bank.id, ok, budget, artifacts,
      log: `${make.stdout}\n${make.stderr}`.trim(),
    });
    void label;
  }
  const summary = results
    .map((r) => `Bank ${r.bankId.toUpperCase()}: ${r.budget.message}${r.artifacts[0] ? ` -> ${r.artifacts[0]}` : ''}`)
    .join('\n');
  return { ok: results.every((r) => r.ok), banks: results, summary };
}
