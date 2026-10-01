/**
* MIT License
*
* Copyright (c) 2020 Bureau Moeilijke Dingen
* 
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/

/**
 * Adds the extension’s build tasks while preserving unrelated tasks already in tasks.json. The merge replaces existing TREV task labels so repeated regeneration does not duplicate entries.
 * It supplies the implementation used by this part of the extension.
 */
import * as stripComments from 'strip-comments';

interface VsTask { label?: string; [k: string]: unknown; }
interface TasksFile { version: string; tasks: VsTask[]; [k: string]: unknown; }

const OUR_TASKS: VsTask[] = [
  {
    label: 'STM32 TREV: Build Dual-Bank (A+B)',
    type: 'process',
    command: '${command:stm32-trev.buildDualBank}',
    problemMatcher: ['$gcc'],
    group: { kind: 'build', isDefault: false },
  },
  {
    label: 'STM32 TREV: Regenerate Build Files',
    type: 'process',
    command: '${command:stm32-trev.regenerateBuildFiles}',
    problemMatcher: [],
  },
];

export const DUAL_BANK_TASK_LABELS: readonly string[] = OUR_TASKS.map((t) => t.label as string);

export function mergeDualBankTasks(existingJson: string | undefined): string {
  let file: TasksFile = { version: '2.0.0', tasks: [] };
  if (existingJson && existingJson.trim()) {
    const parsed = JSON.parse(stripComments(existingJson));
    file = { version: parsed.version ?? '2.0.0', ...parsed, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
  }
  const kept = file.tasks.filter((t) => !DUAL_BANK_TASK_LABELS.includes(t.label ?? ''));
  file.tasks = [...kept, ...OUR_TASKS.map((t) => ({ ...t }))];
  return `${JSON.stringify(file, null, 2)}\n`;
}
