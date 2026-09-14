import { suite, test } from 'mocha';
import { expect } from 'chai';
import { resolvePreset, PRESETS } from '../../../dualBank/presets';

suite('presets', () => {
  test('stm32l432-can-bootloader has two banks at the bootloader addresses', () => {
    const p = resolvePreset('stm32l432-can-bootloader');
    expect(p.flashBase).to.equal(0x08000000);
    expect(p.banks.map((b) => b.id)).to.deep.equal(['a', 'b']);
    expect(p.banks[0]).to.deep.equal({ id: 'a', origin: 0x08008000, lengthBytes: 0x1a000, vectorTableOffset: 0x8000 });
    expect(p.banks[1]).to.deep.equal({ id: 'b', origin: 0x08022000, lengthBytes: 0x1a000, vectorTableOffset: 0x22000 });
    expect(p.storage).to.deep.equal({ name: 'storage', origin: 0x0803c000, lengthBytes: 0x4000 });
    expect(p.maxImageBytes).to.equal(106496);
  });

  test('resolvePreset throws on unknown name and lists valid names', () => {
    expect(() => resolvePreset('nope')).to.throw(/stm32l432-can-bootloader/);
  });

  test('PRESETS is frozen so callers cannot mutate shared state', () => {
    expect(Object.isFrozen(PRESETS)).to.equal(true);
  });
});
