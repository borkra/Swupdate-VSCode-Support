/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;

const tempFixtureDirs = new Set<string>();

/**
 * Activates the vscode.lsp-sample extension
 */
export async function activate(docUri: vscode.Uri) {
	await activateExtensions();
	try {
		doc = await vscode.workspace.openTextDocument(docUri);
		doc = await vscode.languages.setTextDocumentLanguage(doc, 'swupdate');
		editor = await vscode.window.showTextDocument(doc);
		await sleep(2000); // Wait for server activation
	} catch (e) {
		console.error(e);
	}
}

export async function activateFixtureDocument(fileName: string): Promise<vscode.Uri> {
	await activateExtensions();
	try {
		const content = await fs.readFile(getDocPath(fileName), 'utf8');
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swupdate-test-'));
		tempFixtureDirs.add(tempDir);
		const tempFilePath = path.join(tempDir, fileName);
		await fs.writeFile(tempFilePath, content, 'utf8');
		doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFilePath));
		doc = await vscode.languages.setTextDocumentLanguage(doc, 'swupdate');
		editor = await vscode.window.showTextDocument(doc);
		await sleep(2000); // Wait for server activation
		return doc.uri;
	} catch (e) {
		console.error(e);
		throw e;
	}
}

async function activateExtensions() {
	const swupdateExtensionIds = [
		'borkra.swupdate-lang',
		'swupdate-lang'
	];

	const swupdateExt = swupdateExtensionIds
		.map((id) => vscode.extensions.getExtension(id))
		.find((candidate) => !!candidate);

	if (!swupdateExt) {
		throw new Error('SWUpdate extension under test is not installed for tests.');
	}
	await swupdateExt.activate();

	const { extensionDependencies } = require('../../package.json');
	const libconfigId: string = extensionDependencies[0];
	const ext = vscode.extensions.getExtension(libconfigId);

	if (!ext) {
		throw new Error(`LibConfig extension ${libconfigId} is not installed for tests.`);
	}
	await ext.activate();
}

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export const getDocPath = (p: string) => {
	return path.resolve(__dirname, '../../testFixture', p);
};
export const getDocUri = (p: string) => {
	return vscode.Uri.file(getDocPath(p));
};

export async function cleanupTestArtifacts(): Promise<void> {
	await vscode.commands.executeCommand('workbench.action.closeAllEditors');

	await Promise.all([...tempFixtureDirs].map((tempDir) =>
		fs.rm(tempDir, { recursive: true, force: true })
	));

	tempFixtureDirs.clear();
}

export async function setTestContent(content: string): Promise<boolean> {
	const all = new vscode.Range(
		doc.positionAt(0),
		doc.positionAt(doc.getText().length)
	);
	return editor.edit(eb => eb.replace(all, content));
}
