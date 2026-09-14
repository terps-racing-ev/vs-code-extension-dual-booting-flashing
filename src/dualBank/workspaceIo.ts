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

import * as vscode from 'vscode';
import * as path from 'path';

export interface DualBankIo {
  readText(relPath: string): Promise<string | undefined>;
  writeText(relPath: string, content: string): Promise<void>;
  listSourceFiles(): Promise<string[]>;
  projectRoot(): string;
  info(msg: string): void;
  warn(msg: string): void;
}

export function createVsCodeIo(): DualBankIo {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) { throw new Error('stm32-trev: no workspace folder is open'); }
  const root = folder.uri.fsPath;
  const abs = (rel: string): vscode.Uri => vscode.Uri.file(path.join(root, rel));
  return {
    projectRoot: (): string => root,
    async readText(rel: string): Promise<string | undefined> {
      try {
        return Buffer.from(await vscode.workspace.fs.readFile(abs(rel))).toString('utf8');
      } catch (error) {
        // Only a genuinely absent file means "missing". A permission or I/O error must
        // propagate: swallowing it here would make an existing hand-edited .ld look absent,
        // and regenerate would then overwrite the user's edits without warning.
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
          return undefined;
        }
        throw error;
      }
    },
    async writeText(rel: string, content: string): Promise<void> {
      await vscode.workspace.fs.createDirectory(abs(path.dirname(rel)));
      await vscode.workspace.fs.writeFile(abs(rel), Buffer.from(content, 'utf8'));
    },
    async listSourceFiles(): Promise<string[]> {
      const found = await vscode.workspace.findFiles('Core/Src/**/*.{c,cpp,cc}');
      return found.map((u) => path.relative(root, u.fsPath));
    },
    info: (m: string): void => { void vscode.window.showInformationMessage(m); },
    warn: (m: string): void => { void vscode.window.showWarningMessage(m); },
  };
}
