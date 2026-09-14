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

import * as YAML from 'yaml';
import { Bank, MemoryRegion, Preset } from './types';
import { resolvePreset } from './presets';

export interface BootloaderConfig {
  preset: string;
  targetBaseName: string;
  commonDefs: string[];
  outputDir: string;
  maxImageWarnPct: number;
  overrides?: Partial<Pick<Preset, 'flashBase' | 'banks' | 'storage' | 'maxImageBytes'>>;
}

export interface ResolvedBootloader {
  targetBaseName: string;
  commonDefs: string[];
  outputDir: string;
  maxImageWarnPct: number;
  flashBase: number;
  banks: Bank[];
  storage: MemoryRegion;
  maxImageBytes: number;
}

const REQUIRED_DEFS = ['USE_HAL_DRIVER'];
const DEVICE_DEFINE_PATTERN = /^STM32.*xx$/;

export function parseBootloaderConfig(yamlText: string): BootloaderConfig | undefined {
  const doc = YAML.parse(yamlText) ?? {};
  const raw = doc.bootloader;
  if (!raw) { return undefined; }
  if (!raw.preset) { throw new Error('bootloader config: "preset" is required'); }
  if (!raw.targetBaseName) { throw new Error('bootloader config: "targetBaseName" is required'); }
  return {
    preset: String(raw.preset),
    targetBaseName: String(raw.targetBaseName),
    commonDefs: Array.isArray(raw.commonDefs) ? raw.commonDefs.map(String) : [],
    outputDir: raw.outputDir ? String(raw.outputDir) : 'build/dist',
    maxImageWarnPct: typeof raw.maxImageWarnPct === 'number' ? raw.maxImageWarnPct : 90,
    overrides: raw.overrides,
  };
}

export function resolveBootloader(cfg: BootloaderConfig): ResolvedBootloader {
  const preset = resolvePreset(cfg.preset);
  const o = cfg.overrides ?? {};
  return {
    targetBaseName: cfg.targetBaseName,
    commonDefs: cfg.commonDefs,
    outputDir: cfg.outputDir,
    maxImageWarnPct: cfg.maxImageWarnPct,
    flashBase: o.flashBase ?? preset.flashBase,
    banks: (o.banks as Bank[] | undefined) ?? preset.banks,
    storage: (o.storage as MemoryRegion | undefined) ?? preset.storage,
    maxImageBytes: (o.maxImageBytes as number | undefined) ?? preset.maxImageBytes,
  };
}

export function validateCommonDefs(commonDefs: string[]): string[] {
  const names = commonDefs.map((d) => d.split('=')[0]);
  const errors: string[] = REQUIRED_DEFS
    .filter((req) => !names.includes(req))
    .map((req) => `commonDefs is missing required define "${req}"`);
  if (!names.some((name) => DEVICE_DEFINE_PATTERN.test(name))) {
    errors.push('commonDefs is missing a device define (e.g. STM32L432xx)');
  }
  return errors;
}
