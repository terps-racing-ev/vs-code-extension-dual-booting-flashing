import { suite, test } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { runRegenerate, runBuild } from '../../../dualBank/index';
import { DualBankIo } from '../../../dualBank/workspaceIo';

// The compiled test runs from out/test/unit/dualBank/, but `tsc` does not copy
// non-.ts fixtures into out/. Resolve fixtures from the src/ tree instead:
// out/test/unit/dualBank -> ../../../../ == repo root -> src/test/fixtures/dualBank
const fixt = (name: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../../../../src/test/fixtures/dualBank', name), 'utf8');

const base = fixt('base.STM32L432XX_FLASH.ld');

type MemIo = DualBankIo & { files: Record<string, string>; warnings: string[] };

function memIo(files: Record<string, string>): MemIo {
  const warnings: string[] = [];
  const io = {
    files,
    warnings,
    async readText(rel: string): Promise<string | undefined> { return files[rel]; },
    async writeText(rel: string, content: string): Promise<void> { files[rel] = content; },
    async listSourceFiles(): Promise<string[]> { return Object.keys(files).filter((f) => f.endsWith('.c')); },
    projectRoot(): string { return '/proj'; },
    info(): void { /* noop */ },
    warn(m: string): void { warnings.push(m); },
  };
  return io as MemIo;
}

const CONFIG =
  'ldscript: STM32L432XX_FLASH.ld\n'
  + 'bootloader:\n  preset: stm32l432-can-bootloader\n  targetBaseName: HVC\n'
  + '  commonDefs: [STM32L432xx, USE_HAL_DRIVER]\n';

// Computed keys (rather than literal ones) keep `@typescript-eslint/naming-convention`
// from flagging these path-shaped property names as non-camelCase.
const CONFIG_PATH = 'STM32-for-VSCode.config.yaml';
const BASE_LD_PATH = 'STM32L432XX_FLASH.ld';
const MAIN_C_PATH = 'Core/Src/main.c';
const BANK_B_LD_PATH = 'STM32L432XX_APP_BANK_B.ld';

suite('dual-bank commands', () => {
  test('regenerate writes both bank scripts and a tasks.json', async () => {
    const io = memIo({
      [CONFIG_PATH]: CONFIG,
      [BASE_LD_PATH]: base,
      [MAIN_C_PATH]: 'SCB->VTOR = FLASH_BASE | VECT_TAB_OFFSET;',
    });
    const res = await runRegenerate(io, '0.1.0');
    expect(res.wrote).to.include('STM32L432XX_APP_BANK_A.ld');
    expect(res.wrote).to.include('STM32L432XX_APP_BANK_B.ld');
    expect(res.wrote).to.include('.vscode/tasks.json');
    expect(io.files[BANK_B_LD_PATH]).to.contain('ORIGIN = 0x08022000');
    expect(res.warnings).to.deep.equal([]);
  });

  test('regenerate with no bootloader block does nothing but warn', async () => {
    const io = memIo({ [CONFIG_PATH]: 'target: HVC\n' });
    const res = await runRegenerate(io, '0.1.0');
    expect(res.wrote).to.deep.equal([]);
    expect(io.warnings.join('\n')).to.contain('nothing to regenerate');
  });

  test('regenerate warns when the app does not set SCB->VTOR per bank', async () => {
    const io = memIo({
      [CONFIG_PATH]: CONFIG,
      [BASE_LD_PATH]: base,
      [MAIN_C_PATH]: 'SCB->VTOR = 0x08008000U;',
    });
    const res = await runRegenerate(io, '0.1.0');
    expect(res.warnings.join('\n')).to.contain('hard-coded to one bank');
  });

  test('regenerate refuses to generate when commonDefs is missing a required define', async () => {
    const io = memIo({
      [CONFIG_PATH]:
        'ldscript: STM32L432XX_FLASH.ld\n'
        + 'bootloader:\n  preset: stm32l432-can-bootloader\n  targetBaseName: HVC\n'
        + '  commonDefs: [STM32L432xx]\n',
      [BASE_LD_PATH]: base,
    });
    const res = await runRegenerate(io, '0.1.0');
    expect(res.wrote).to.deep.equal([]);
    expect(res.warnings.join('\n')).to.contain('USE_HAL_DRIVER');
    expect(io.warnings.join('\n')).to.contain('nothing generated');
  });

  test('runBuild resolves to a failed report instead of throwing when there is no config', async () => {
    const io = memIo({ [CONFIG_PATH]: 'target: HVC\n' });
    const report = await runBuild(io, '1.0.0');
    expect(report.ok).to.equal(false);
    expect(report.banks).to.deep.equal([]);
    expect(report.summary).to.be.a('string').and.not.equal('');
  });
});
