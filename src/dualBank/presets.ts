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

import { Preset } from './types';

const stm32l432CanBootloader: Preset = {
  name: 'stm32l432-can-bootloader',
  flashBase: 0x08000000,
  banks: [
    { id: 'a', origin: 0x08008000, lengthBytes: 0x1a000, vectorTableOffset: 0x8000 },
    { id: 'b', origin: 0x08022000, lengthBytes: 0x1a000, vectorTableOffset: 0x22000 },
  ],
  reserved: [
    { name: 'bootloader', origin: 0x08000000, lengthBytes: 0x7800 },
    { name: 'metadata', origin: 0x08007800, lengthBytes: 0x800 },
  ],
  storage: { name: 'storage', origin: 0x0803c000, lengthBytes: 0x4000 },
  maxImageBytes: 106496,
};

export const PRESETS: Record<string, Preset> = Object.freeze({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'stm32l432-can-bootloader': stm32l432CanBootloader,
});

export function resolvePreset(name: string): Preset {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown bootloader preset "${name}". Valid presets: ${Object.keys(PRESETS).join(', ')}`);
  }
  return preset;
}
