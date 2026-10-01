import { suite, test } from 'mocha';
import { expect } from 'chai';
import { checkVtor } from '../../../dualBank/vtorCheck';

const banks = [
  { id: 'a', origin: 0x08008000, lengthBytes: 0x1a000, vectorTableOffset: 0x8000 },
  { id: 'b', origin: 0x08022000, lengthBytes: 0x1a000, vectorTableOffset: 0x22000 },
];

suite('vtor check', () => {
  test('accepts the define-based assignment', () => {
    const r = checkVtor([{ path: 's.c', content: 'SCB->VTOR = FLASH_BASE | VECT_TAB_OFFSET;' }], banks);
    expect(r.ok).to.equal(true);
    expect(r.level).to.equal('ok');
  });

  test('accepts the VECT_TAB_BASE_ADDRESS define-based assignment', () => {
    const r = checkVtor(
      [{ path: 'system_stm32l4xx.c', content: 'SCB->VTOR = VECT_TAB_BASE_ADDRESS | VECT_TAB_OFFSET;' }],
      banks,
    );
    expect(r.ok).to.equal(true);
    expect(r.level).to.equal('ok');
  });

  test('accepts explicit handling of both bank origins', () => {
    const content = 'if (x) SCB->VTOR = 0x08008000U; else SCB->VTOR = 0x08022000U;';
    const r = checkVtor([{ path: 's.c', content }], banks);
    expect(r.ok).to.equal(true);
  });

  test('warns when hard-coded to a single bank', () => {
    const r = checkVtor([{ path: 'main.c', content: 'SCB->VTOR = 0x08008000U;' }], banks);
    expect(r.ok).to.equal(false);
    expect(r.level).to.equal('warning');
    expect(r.snippet).to.contain('FLASH_BASE | VECT_TAB_OFFSET');
  });

  test('warns when a hard-coded bank assignment coexists with the offset-based assignment', () => {
    const content = [
      'SCB->VTOR = VECT_TAB_BASE_ADDRESS | VECT_TAB_OFFSET;',
      'SCB->VTOR = 0x08008000U;',
    ].join('\n');
    const r = checkVtor([{ path: 'system.c', content }], banks);
    expect(r.ok).to.equal(false);
    expect(r.message).to.contain('hard-coded to one bank');
  });

  test('warns when there is no SCB->VTOR at all', () => {
    const r = checkVtor([{ path: 'main.c', content: 'int main(){}' }], banks);
    expect(r.ok).to.equal(false);
    expect(r.message).to.contain('No SCB->VTOR');
  });

  test('derives the origins from the banks it is given (three-bank override)', () => {
    const threeBanks = [
      ...banks,
      { id: 'c', origin: 0x0803c000, lengthBytes: 0x1a000, vectorTableOffset: 0x3c000 },
    ];
    const twoOfThree = 'SCB->VTOR = 0x08008000U; SCB->VTOR = 0x08022000U;';
    expect(checkVtor([{ path: 's.c', content: twoOfThree }], threeBanks).ok).to.equal(false);
    const allThree = `${twoOfThree} SCB->VTOR = 0x0803c000U;`;
    expect(checkVtor([{ path: 's.c', content: allThree }], threeBanks).ok).to.equal(true);
  });
});
