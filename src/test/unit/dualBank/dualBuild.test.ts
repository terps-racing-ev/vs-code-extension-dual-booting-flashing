import { suite, test } from 'mocha';
import { expect } from 'chai';
import { buildMakeArgs, runDualBuild, DualBuildOptions } from '../../../dualBank/dualBuild';

const banks = [
  { id: 'a', origin: 0x08008000, lengthBytes: 0x1a000, vectorTableOffset: 0x8000 },
  { id: 'b', origin: 0x08022000, lengthBytes: 0x1a000, vectorTableOffset: 0x22000 },
];

function baseOpts(over: Partial<DualBuildOptions> = {}): DualBuildOptions {
  const staged: string[] = [];
  return {
    projectRoot: '/proj', makeProgram: 'make', makefileName: 'STM32Make.make',
    banks, targetBaseName: 'HVC', commonDefs: ['STM32L432xx', 'USE_HAL_DRIVER'],
    bankLdRelPaths: { a: 'STM32L432XX_APP_BANK_A.ld', b: 'STM32L432XX_APP_BANK_B.ld' },
    outputDir: 'build/dist', maxImageBytes: 106496, maxImageWarnPct: 90, concurrency: 8,
    sizeProgram: 'arm-none-eabi-size',
    exec: async (cmd: string) => {
      if (cmd === 'arm-none-eabi-size') {
        return { code: 0, stdout: '  40000\t   200\t  1000\t  41200\t  a0f0\tx.elf\n', stderr: '' };
      }
      return { code: 0, stdout: 'built', stderr: '' };
    },
    stageFile: async (_from: string, to: string) => { staged.push(to); },
    ...over,
  };
}

suite('dual build runner', () => {
  test('buildMakeArgs sets per-bank target, ldscript, and VECT_TAB_OFFSET', () => {
    const args = buildMakeArgs(baseOpts(), banks[1]);
    expect(args).to.include('-f'); expect(args).to.include('STM32Make.make');
    expect(args).to.include('TARGET=HVC_b');
    expect(args).to.include('BUILD_DIRECTORY=build/bank_b');
    expect(args).to.include('LDSCRIPT=STM32L432XX_APP_BANK_B.ld');
    expect(args.find((a) => a.startsWith('C_DEFS='))).to.contain('-DVECT_TAB_OFFSET=0x22000');
    expect(args.find((a) => a.startsWith('C_DEFS='))).to.contain('-DUSE_HAL_DRIVER');
  });

  test('runDualBuild reports ok for both banks and a two-line summary', async () => {
    const report = await runDualBuild(baseOpts());
    expect(report.ok).to.equal(true);
    expect(report.banks.map((b) => b.bankId)).to.deep.equal(['a', 'b']);
    expect(report.summary.split('\n')).to.have.lengthOf(2);
  });

  test('a make failure on one bank makes the report not-ok but still tries the other', async () => {
    let calls = 0;
    const report = await runDualBuild(baseOpts({
      exec: async (cmd: string) => {
        if (cmd === 'make') { calls += 1; return { code: calls === 1 ? 2 : 0, stdout: '', stderr: 'boom' }; }
        return { code: 0, stdout: '  40000\t 0\t 0\t 40000\t 9c40\tx.elf\n', stderr: '' };
      },
    }));
    expect(report.ok).to.equal(false);
    expect(report.banks[0].ok).to.equal(false);
    expect(report.banks[1].ok).to.equal(true);
  });

  test('an over-budget bank fails the report', async () => {
    const report = await runDualBuild(baseOpts({
      exec: async (cmd: string) => {
        if (cmd === 'arm-none-eabi-size') {
          return { code: 0, stdout: '  200000\t 0\t 0\t 200000\t 30d40\tx.elf\n', stderr: '' };
        }
        return { code: 0, stdout: 'built', stderr: '' };
      },
    }));
    expect(report.ok).to.equal(false);
    expect(report.banks[0].budget.level).to.equal('over');
  });

  test('a size-step failure on one bank does not abort the other bank', async () => {
    let sizeCalls = 0;
    const report = await runDualBuild(baseOpts({
      exec: async (cmd: string) => {
        if (cmd === 'arm-none-eabi-size') {
          sizeCalls += 1;
          if (sizeCalls === 1) { throw new Error('size tool crashed'); }
          return { code: 0, stdout: '  40000\t 0\t 0\t 40000\t 9c40\tx.elf\n', stderr: '' };
        }
        return { code: 0, stdout: 'built', stderr: '' };
      },
    }));
    expect(report.ok).to.equal(false);
    expect(report.banks[0].ok).to.equal(false);
    expect(report.banks[1].ok).to.equal(true);
  });
});
