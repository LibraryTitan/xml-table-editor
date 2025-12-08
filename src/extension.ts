import * as vscode from 'vscode';
import { XmlTableEditorProvider } from './XmlTableEditorProvider';

export function activate(context: vscode.ExtensionContext) {
	// This line registers the Custom Editor we created in the other file
	context.subscriptions.push(XmlTableEditorProvider.register(context));
}

export function deactivate() {}