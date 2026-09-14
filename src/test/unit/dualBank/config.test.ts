import { suite, test } from 'mocha';
import { expect } from 'chai';
import { parseBootloaderConfig, resolveBootloader, validateCommonDefs } from '../../../dualBank/config';

const YAML_WITH = `
target: HVC
language: C
bootloader:
  preset: stm32l432-can-bootloader
  targetBaseName: HVC
  commonDefs:
    - STM32L432xx
    - USE_HAL_DRIVER
    - STM32_THREAD_SAFE_STRATEGY=4
`;

const YAML_WITHOUT = `
target: HVC
language: C
`;

suite('bootloader config', () => {
  test('returns undefined when there is no bootloader block', () => {
    expect(parseBootloaderConfig(YAML_WITHOUT)).to.equal(undefined);
  });

  test('parses the bootloader block and applies defaults', () => {
    const cfg = parseBootloaderConfig(YAML_WITH)!;
    expect(cfg.preset).to.equal('stm32l432-can-bootloader');
    expect(cfg.targetBaseName).to.equal('HVC');
    expect(cfg.commonDefs).to.include('USE_HAL_DRIVER');
    expect(cfg.outputDir).to.equal('build/dist');
    expect(cfg.maxImageWarnPct).to.equal(90);
  });

  test('resolveBootloader expands the preset into a concrete bank table', () => {
    const resolved = resolveBootloader(parseBootloaderConfig(YAML_WITH)!);
    expect(resolved.banks.map((b) => b.origin)).to.deep.equal([0x08008000, 0x08022000]);
    expect(resolved.maxImageBytes).to.equal(106496);
  });

  test('inline overrides win over the preset', () => {
    const cfg = parseBootloaderConfig(YAML_WITH + '  overrides:\n    maxImageBytes: 90000\n')!;
    expect(resolveBootloader(cfg).maxImageBytes).to.equal(90000);
  });

  test('validateCommonDefs flags a missing USE_HAL_DRIVER', () => {
    expect(validateCommonDefs(['STM32L432xx'])).to.have.lengthOf(1);
    expect(validateCommonDefs(['STM32L432xx', 'USE_HAL_DRIVER'])).to.deep.equal([]);
  });

  test('validateCommonDefs flags a missing device define', () => {
    expect(validateCommonDefs(['USE_HAL_DRIVER'])).to.have.lengthOf(1);
  });
});
