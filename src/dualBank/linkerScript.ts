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

import { Bank, MemoryRegion } from './types';

export class LinkerScriptFormatError extends Error {}

const FLASH_LINE = /^(\s*)FLASH\s*\([^)]*\)\s*:\s*ORIGIN\s*=\s*0x[0-9A-Fa-f]+\s*,\s*LENGTH\s*=\s*[0-9]+\s*K?.*$/m;
const STORAGE_LINE = /^(\s*)STORAGE\s*\([^)]*\)\s*:.*$/m;

function hex8(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
}

function kib(bytes: number): string {
  return `${Math.round(bytes / 1024)}K`;
}

export function transformLinkerScript(
  baseScript: string,
  bank: Bank,
  storage: MemoryRegion,
  bankLabel: string,
): string {
  if (!FLASH_LINE.test(baseScript)) {
    throw new LinkerScriptFormatError('Could not find a FLASH region in the linker script MEMORY block');
  }
  const flashLine =
    `  FLASH (rx)      : ORIGIN = ${hex8(bank.origin)}, LENGTH = ${kib(bank.lengthBytes)}   ` +
    `/* App Bank ${bankLabel} — managed by stm32-trev */`;
  const storageLine =
    `  STORAGE (r)      : ORIGIN = ${hex8(storage.origin)}, LENGTH = ${kib(storage.lengthBytes)}   ` +
    `/* Permanent storage — managed by stm32-trev */`;

  let out = baseScript.replace(FLASH_LINE, flashLine);
  if (STORAGE_LINE.test(out)) {
    out = out.replace(STORAGE_LINE, storageLine);
  } else {
    out = out.replace(flashLine, `${flashLine}\n${storageLine}`);
  }
  return out;
}
