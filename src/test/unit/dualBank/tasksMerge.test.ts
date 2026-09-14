import { suite, test } from 'mocha';
import { expect } from 'chai';
import { mergeDualBankTasks, DUAL_BANK_TASK_LABELS } from '../../../dualBank/tasksMerge';

suite('tasks.json merge', () => {
  test('creates a valid file from nothing', () => {
    const out = JSON.parse(mergeDualBankTasks(undefined));
    expect(out.version).to.equal('2.0.0');
    expect(out.tasks.map((t: any) => t.label)).to.have.members([...DUAL_BANK_TASK_LABELS]);
  });

  test('preserves unrelated user tasks and does not duplicate ours', () => {
    const existing = JSON.stringify({
      version: '2.0.0',
      tasks: [
        { label: 'Build + Push A/B Binaries to TREVPI', type: 'shell', command: 'scp ...' },
        { label: 'STM32 TREV: Build Dual-Bank (A+B)', type: 'process', command: 'STALE' },
      ],
    });
    const out = JSON.parse(mergeDualBankTasks(existing));
    const labels = out.tasks.map((t: any) => t.label);
    expect(labels).to.include('Build + Push A/B Binaries to TREVPI');
    expect(labels.filter((l: string) => l === 'STM32 TREV: Build Dual-Bank (A+B)')).to.have.lengthOf(1);
    const ours = out.tasks.find((t: any) => t.label === 'STM32 TREV: Build Dual-Bank (A+B)');
    expect(ours.command).to.equal('${command:stm32-trev.buildDualBank}');
  });

  test('is idempotent', () => {
    const once = mergeDualBankTasks(undefined);
    expect(mergeDualBankTasks(once)).to.equal(once);
  });

  test('tolerates // comments in the existing tasks.json (the VS Code default scaffold has them)', () => {
    const withComments = [
      '{',
      '  // See https://go.microsoft.com/fwlink/?LinkId=733558',
      '  "version": "2.0.0",',
      '  "tasks": []',
      '}',
    ].join('\n');
    expect(() => mergeDualBankTasks(withComments)).to.not.throw();
    const out = JSON.parse(mergeDualBankTasks(withComments));
    expect(out.tasks.map((t: any) => t.label)).to.include.members([...DUAL_BANK_TASK_LABELS]);
  });
});
