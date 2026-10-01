import { suite, test } from 'mocha';
import { expect } from 'chai';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { sync as which } from 'which';
import { runDualBuild } from '../../dualBank/dualBuild';
import { transformLinkerScript } from '../../dualBank/linkerScript';
import { resolvePreset } from '../../dualBank/presets';

const haveArm = spawnSync('arm-none-eabi-gcc', ['--version']).status === 0;
// See dualBuild.ts's armGccPath doc comment: STM32Make.make's PATH-only `CC ?=` fallback
// never actually takes effect, so this test must pass ARM_GCC_PATH explicitly too, exactly
// as runBuild() does in production, or it would fail the same way real usage did before
// that fix (silently invoking the system `cc` instead of the ARM cross-compiler).
const armGccPath = haveArm ? path.dirname(which('arm-none-eabi-gcc', { nothrow: true }) as string) : undefined;

// The compiled test runs from out/test/integration/, but `tsc` does not copy
// non-.ts fixtures into out/. Resolve fixtures from the src/ tree instead:
// out/test/integration -> ../../../ == repo root -> src/test/fixtures/dualBank/miniproject
const fixturesDir = path.resolve(
  __dirname,
  '../../../src/test/fixtures/dualBank/miniproject',
);

suite('dual-bank build (integration, needs arm-none-eabi-gcc)', function (): void {
  this.timeout(60000);

  test('builds both banks and stages bins at the two load addresses', async function (): Promise<void> {
    if (!haveArm) {
      this.skip();
      return;
    }
    const preset = resolvePreset('stm32l432-can-bootloader');
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'trev-dbb-'));
    for (const f of ['main.c', 'startup_min.s', 'Inner.make']) {
      await fs.copyFile(path.join(fixturesDir, f), path.join(tmp, f));
    }
    const baseLd = 'ENTRY(Reset_Handler)\nMEMORY\n{\nRAM (xrw) : ORIGIN = 0x20000000, LENGTH = 48K\n'
      + 'FLASH (rx) : ORIGIN = 0x8000000, LENGTH = 256K\n}\n'
      + '_estack = ORIGIN(RAM) + LENGTH(RAM);\n'
      + 'SECTIONS { .isr_vector : { KEEP(*(.isr_vector)) } >FLASH  .text : { *(.text*) } >FLASH'
      + '  .data : { *(.data*) } >RAM AT> FLASH  .bss : { *(.bss*) } >RAM }\n';
    await fs.writeFile(
      path.join(tmp, 'STM32L432XX_APP_BANK_A.ld'),
      transformLinkerScript(baseLd, preset.banks[0], preset.storage, 'A'),
    );
    await fs.writeFile(
      path.join(tmp, 'STM32L432XX_APP_BANK_B.ld'),
      transformLinkerScript(baseLd, preset.banks[1], preset.storage, 'B'),
    );

    const report = await runDualBuild({
      projectRoot: tmp,
      makeProgram: 'make',
      makefileName: 'Inner.make',
      banks: preset.banks,
      targetBaseName: 'mini',
      commonDefs: ['STM32L432xx'],
      bankLdRelPaths: {
        a: 'STM32L432XX_APP_BANK_A.ld',
        b: 'STM32L432XX_APP_BANK_B.ld',
      },
      outputDir: 'dist',
      maxImageBytes: preset.maxImageBytes,
      maxImageWarnPct: 90,
      concurrency: 2,
      sizeProgram: 'arm-none-eabi-size',
      armGccPath,
      exec: async (cmd, args, cwd) => {
        const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
        return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
      },
      stageFile: async (from, to) => {
        await fs.mkdir(path.dirname(path.join(tmp, to)), { recursive: true });
        await fs.copyFile(path.join(tmp, from), path.join(tmp, to));
      },
    });

    expect(report.ok).to.equal(true);
    const aBin = await fs.readFile(path.join(tmp, 'dist/mini_a.bin'));
    const bBin = await fs.readFile(path.join(tmp, 'dist/mini_b.bin'));
    // Word 1 of the vector table is the reset vector; it points into the bank's flash.
    const resetA = aBin.readUInt32LE(4);
    const resetB = bBin.readUInt32LE(4);
    expect(resetA).to.be.within(0x08008000, 0x08021fff);
    expect(resetB).to.be.within(0x08022000, 0x0803bfff);
  });
});
