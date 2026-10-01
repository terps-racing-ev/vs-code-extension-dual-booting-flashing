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
 * Checks that startup code moves the Cortex-M vector table to the bank being built. It warns when a known hard-coded bank address could override the per-build vector-table offset.
 * It supplies the implementation used by this part of the extension.
 */
import { Bank } from './types';

export interface VtorSourceFile { path: string; content: string; }
export interface VtorCheckResult {
  ok: boolean;
  level: 'ok' | 'warning';
  message: string;
  snippet: string;
}

const SNIPPET = [
  '/* USER CODE BEGIN SysInit */',
  'SCB->VTOR = FLASH_BASE | VECT_TAB_OFFSET;  /* VECT_TAB_OFFSET is set per bank by the build */',
  '/* USER CODE END SysInit */',
].join('\n');

/** Matches an `SCB->VTOR = 0x...` assignment to one bank's flash origin. */
function originPattern(origin: number): RegExp {
  return new RegExp(`SCB->VTOR\\s*=\\s*0x0*${origin.toString(16)}`);
}

export function checkVtor(sources: VtorSourceFile[], banks: Bank[]): VtorCheckResult {
  const all = sources.map((s) => s.content).join('\n');
  const usesPerBankOffset =
    /SCB->VTOR\s*=\s*(?:FLASH_BASE|VECT_TAB_BASE_ADDRESS)\s*\|\s*VECT_TAB_OFFSET/.test(all);
  const matchedBanks = banks.filter((b) => originPattern(b.origin).test(all));
  if (banks.length > 0 && matchedBanks.length === banks.length) {
    return { ok: true, level: 'ok', message: '', snippet: '' };
  }
  if (matchedBanks.length > 0) {
    return {
      ok: false,
      level: 'warning',
      message:
        'SCB->VTOR is hard-coded to one bank; the other bank\'s image will set the vector table to the wrong address. '
        + 'Use the per-bank define instead.',
      snippet: SNIPPET,
    };
  }
  if (usesPerBankOffset) { return { ok: true, level: 'ok', message: '', snippet: '' }; }
  return {
    ok: false,
    level: 'warning',
    message: 'No SCB->VTOR assignment found; the application will run with the bootloader\'s vector table.',
    snippet: SNIPPET,
  };
}
