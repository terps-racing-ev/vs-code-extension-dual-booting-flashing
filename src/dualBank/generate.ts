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

import { transformLinkerScript } from './linkerScript';
import { buildSentinelHeader, hashInputs, isHandEdited } from './sentinel';
import { ResolvedBootloader } from './config';

export interface ExistingFile { relPath: string; content: string; }

export interface GenerationInputs {
  version: string;
  baseLinkerScript: string;
  baseLinkerScriptRelPath: string;
  resolved: ResolvedBootloader;
  existingFiles: ExistingFile[];
}

export interface PlannedFile { relPath: string; content: string; handEdited: boolean; }

export interface GenerationResult {
  files: PlannedFile[];
  bankLdRelPaths: Record<string, string>;
}

export function planDualBankArtifacts(inputs: GenerationInputs): GenerationResult {
  const { version, baseLinkerScript, resolved, existingFiles } = inputs;
  const files: PlannedFile[] = [];
  const bankLdRelPaths: Record<string, string> = {};

  for (const bank of resolved.banks) {
    const label = bank.id.toUpperCase();
    const relPath = `linker/STM32L432XX_APP_BANK_${label}.ld`;
    const body = transformLinkerScript(baseLinkerScript, bank, resolved.storage, label);
    const bodyHash = hashInputs([body]);
    const header = buildSentinelHeader('/*', version, bodyHash);
    const existing = existingFiles.find((f) => f.relPath === relPath);
    files.push({
      relPath,
      content: header + body,
      handEdited: existing ? isHandEdited(existing.content) : false,
    });
    bankLdRelPaths[bank.id] = relPath;
  }
  return { files, bankLdRelPaths };
}
