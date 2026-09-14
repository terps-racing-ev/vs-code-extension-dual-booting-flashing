import { suite, test } from 'mocha';
import { expect } from 'chai';
import createMakefile from '../../../CreateMakefile';
import { newMakeInfo } from '../../fixtures/makeInfoFixture';

suite('makefile overridable vars', () => {
  const out = createMakefile(newMakeInfo({
    ldscript: 'STM32L432XX_FLASH.ld',
    cDefs: ['STM32L432xx'],
    cxxDefs: ['STM32L432xx'],
  }));

  test('C_DEFS is assigned with ?=', () => {
    expect(out).to.match(/^C_DEFS \?=/m);
    expect(out).to.not.match(/^C_DEFS =/m);
  });

  test('CXX_DEFS is assigned with ?=', () => {
    expect(out).to.match(/^CXX_DEFS \?=/m);
  });

  test('LDSCRIPT is assigned with ?=', () => {
    expect(out).to.match(/^LDSCRIPT \?=/m);
    expect(out).to.not.match(/^LDSCRIPT =/m);
  });
});
