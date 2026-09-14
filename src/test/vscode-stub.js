// Test-only stub for the `vscode` module.
//
// The dualBank unit suite runs under plain mocha (`npm run test:dualbank`) with no
// VS Code extension host, so any `require('vscode')` in the module graph would throw
// MODULE_NOT_FOUND. Several source modules (`Helpers.ts`, and `dualBank/index.ts`)
// import `vscode` at module scope but only touch the API inside function bodies that
// the unit tests never call — they exercise the pure logic and inject their own IO
// doubles. This stub lets the module graph resolve; it is not a functional VS Code.
//
// Wired in via mocha `--require ./src/test/vscode-stub.js` in the `test:dualbank` script.

const Module = require('module');

const noop = () => undefined;
const disposable = { dispose: noop };

const vscodeStub = {
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({ get: noop, has: () => false, update: noop }),
    findFiles: async () => [],
    fs: {
      readFile: async () => { throw new Error('vscode-stub: workspace.fs.readFile not available in unit tests'); },
      writeFile: async () => undefined,
      createDirectory: async () => undefined,
    },
  },
  window: {
    showInformationMessage: noop,
    showWarningMessage: noop,
    showErrorMessage: noop,
    showQuickPick: async () => undefined,
    createStatusBarItem: () => ({ text: '', show: noop, hide: noop, dispose: noop }),
  },
  commands: {
    registerCommand: () => disposable,
    executeCommand: async () => undefined,
  },
  extensions: {
    getExtension: () => undefined,
  },
  Uri: {
    file: (fsPath) => ({ fsPath, scheme: 'file', path: fsPath, toString: () => fsPath }),
    parse: (value) => ({ fsPath: value, scheme: 'file', path: value, toString: () => value }),
  },
  env: {},
  EventEmitter: class EventEmitter {
    constructor() { this.event = () => disposable; }
    fire() { /* noop */ }
    dispose() { /* noop */ }
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
};

// `workspace.fs.readFile` real implementations reject with a `vscode.FileSystemError`
// carrying a `.code` (e.g. 'FileNotFound'). Production code narrows its catch on that
// type, so the stub needs a real class for `instanceof` to work if a future test ever
// exercises `createVsCodeIo()` directly (today's unit tests inject their own IO double
// and never reach this path, but this keeps the stub honest).
class FileSystemError extends Error {
  constructor(messageOrUri, code) {
    super(typeof messageOrUri === 'string' ? messageOrUri : String(messageOrUri));
    this.name = 'FileSystemError';
    this.code = code || 'Unknown';
  }
}
vscodeStub.FileSystemError = FileSystemError;

const originalLoad = Module._load;
Module._load = function stubbedLoad(request, parent, isMain) {
  if (request === 'vscode') {
    return vscodeStub;
  }
  return originalLoad.call(this, request, parent, isMain);
};
