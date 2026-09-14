import { suite, test } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { transformLinkerScript, LinkerScriptFormatError } from '../../../dualBank/linkerScript';

// The compiled test runs from out/test/unit/dualBank/, but `tsc` does not copy
// non-.ts fixtures into out/. Resolve fixtures from the src/ tree instead:
// out/test/unit/dualBank -> ../../../../ == repo root -> src/test/fixtures/dualBank
const fixt = (name: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../../../../src/test/fixtures/dualBank', name), 'utf8');

const bankA = { id: 'a', origin: 0x08008000, lengthBytes: 0x1a000, vectorTableOffset: 0x8000 };
const bankB = { id: 'b', origin: 0x08022000, lengthBytes: 0x1a000, vectorTableOffset: 0x22000 };
const storage = { name: 'storage', origin: 0x0803c000, lengthBytes: 0x4000 };

suite('linker script transform', () => {
  test('produces the expected Bank A script', () => {
    expect(transformLinkerScript(fixt('base.STM32L432XX_FLASH.ld'), bankA, storage, 'A'))
      .to.equal(fixt('expected.APP_BANK_A.ld'));
  });

  test('produces the expected Bank B script', () => {
    expect(transformLinkerScript(fixt('base.STM32L432XX_FLASH.ld'), bankB, storage, 'B'))
      .to.equal(fixt('expected.APP_BANK_B.ld'));
  });

  test('replaces an existing STORAGE line instead of adding a second one (realistic HVC base)', () => {
    // The real HVC-Firmware base script is not a clean CubeMX default: the FLASH
    // region already points at bank A's origin/length and a STORAGE line already
    // exists. The transform must rewrite both in place, not append a duplicate.
    const realisticBase = fixt('base.STM32L432XX_FLASH.ld').replace(
      'FLASH (rx)      : ORIGIN = 0x8000000, LENGTH = 256K\n',
      'FLASH (rx)      : ORIGIN = 0x8008000, LENGTH = 208K\n'
      + 'STORAGE (r) : ORIGIN = 0x803C000, LENGTH = 16K\n',
    );

    const out = transformLinkerScript(realisticBase, bankA, storage, 'A');

    expect(out.match(/STORAGE/g)).to.have.lengthOf(1);
    expect(out).to.contain('ORIGIN = 0x0803C000, LENGTH = 16K');
    expect(out).to.contain(
      '  FLASH (rx)      : ORIGIN = 0x08008000, LENGTH = 104K   /* App Bank A — managed by stm32-trev */',
    );
    expect(out).to.not.contain('208K');
    expect(out).to.equal(fixt('expected.APP_BANK_A.ld'));
  });

  test('throws LinkerScriptFormatError when there is no FLASH region', () => {
    expect(() => transformLinkerScript('MEMORY {\nRAM : ORIGIN = 0x20000000, LENGTH = 48K\n}', bankA, storage, 'A'))
      .to.throw(LinkerScriptFormatError);
  });
});
