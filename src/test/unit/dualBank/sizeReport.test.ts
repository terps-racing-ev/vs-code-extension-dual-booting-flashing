import { suite, test } from 'mocha';
import { expect } from 'chai';
import { parseSizeOutput, evaluateBudget } from '../../../dualBank/sizeReport';

const SIZE_OUT = [
  '   text\t   data\t    bss\t    dec\t    hex\tfilename',
  '  81234\t    216\t  17800\t  99250\t  183f2\tbuild/bank_a/debug/HVC_a.elf',
  '',
].join('\n');

suite('size report', () => {
  test('parses the Berkeley size table', () => {
    expect(parseSizeOutput(SIZE_OUT)).to.deep.equal({ text: 81234, data: 216, bss: 17800 });
  });

  test('throws when there is no data row', () => {
    expect(() => parseSizeOutput('text data bss dec hex filename\n')).to.throw();
  });

  test('flags an over-budget image', () => {
    const v = evaluateBudget({ text: 106000, data: 1000, bss: 0 }, 106496, 90);
    expect(v.level).to.equal('over');
    expect(v.message).to.contain('exceeds');
  });

  test('warns near the ceiling and passes with headroom', () => {
    expect(evaluateBudget({ text: 100000, data: 0, bss: 0 }, 106496, 90).level).to.equal('warning');
    expect(evaluateBudget({ text: 40000, data: 0, bss: 0 }, 106496, 90).level).to.equal('ok');
  });
});
