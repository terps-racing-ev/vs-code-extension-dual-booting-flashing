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
 * Parses GNU size output and compares a bank image against its flash capacity. The budget check counts flash-resident sections and reports when an image is close to or over its limit.
 * It supplies the implementation used by this part of the extension.
 */
export interface SectionSizes { text: number; data: number; bss: number; }

export interface BudgetVerdict {
  flashBytes: number;
  bankBytes: number;
  usedPct: number;
  level: 'ok' | 'warning' | 'over';
  message: string;
}

export function parseSizeOutput(sizeStdout: string): SectionSizes {
  const row = sizeStdout
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^\d+\s+\d+\s+\d+\s+\d+\s+[0-9a-fA-F]+\b/.test(l));
  if (!row) { throw new Error(`Could not find a size data row in:\n${sizeStdout}`); }
  const [text, data, bss] = row.split(/\s+/).map(Number);
  return { text, data, bss };
}

export function evaluateBudget(
  sizes: SectionSizes,
  bankBytes: number,
  warnPct: number,
): BudgetVerdict {
  const flashBytes = sizes.text + sizes.data;
  const usedPct = Math.round((flashBytes / bankBytes) * 1000) / 10;
  let level: BudgetVerdict['level'] = 'ok';
  let message = `${flashBytes} B of ${bankBytes} B (${usedPct}%)`;
  if (flashBytes > bankBytes) {
    level = 'over';
    message = `image exceeds the bank: ${flashBytes} B > ${bankBytes} B`;
  } else if (usedPct >= warnPct) {
    level = 'warning';
    message = `image is close to the bank ceiling: ${usedPct}% of ${bankBytes} B`;
  }
  return { flashBytes, bankBytes, usedPct, level, message };
}
