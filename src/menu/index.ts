/**
 * Creates and registers the extension’s command tree in the VS Code sidebar.
 * It supplies the implementation used by this part of the extension.
 */
import * as vscode from 'vscode';
import CommandMenuProvider from './CommandMenu';

export default function addCommandMenu(context: vscode.ExtensionContext): CommandMenuProvider {
  const commandMenuProvider = new CommandMenuProvider(context);

  vscode.window.registerTreeDataProvider(
    'stm32ForVSCodeCommands',
    commandMenuProvider
  );
  return commandMenuProvider;
}