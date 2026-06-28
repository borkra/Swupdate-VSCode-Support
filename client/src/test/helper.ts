/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve as pathResolve } from 'node:path';
import * as vscode from 'vscode';

let doc: vscode.TextDocument | undefined;
let editor: vscode.TextEditor | undefined;

const tempFixtureDirs = new Set<string>();

/**
 * Activates the SWUpdate extension under test.
 */
export async function activate(docUri: vscode.Uri): Promise<void> {
	await activateExtensions();
	doc = await vscode.workspace.openTextDocument(docUri);
	doc = await vscode.languages.setTextDocumentLanguage(doc, 'swupdate');
	editor = await vscode.window.showTextDocument(doc);
	await sleep(2000); // Wait for extension providers to settle.
}

export async function activateFixtureDocument(fileName: string): Promise<vscode.Uri> {
	await activateExtensions();
	const content = await readFile(getDocPath(fileName), 'utf8');
	const tempDir = await mkdtemp(join(tmpdir(), 'swupdate-test-'));
	tempFixtureDirs.add(tempDir);
	const tempFilePath = join(tempDir, fileName);
	await writeFile(tempFilePath, content, 'utf8');
	doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFilePath));
	doc = await vscode.languages.setTextDocumentLanguage(doc, 'swupdate');
	editor = await vscode.window.showTextDocument(doc);
	await sleep(2000); // Wait for extension providers to settle.
	return doc.uri;
}

async function activateExtensions(): Promise<void> {
	const swupdateExtensionIds = [
		'borkra.swupdate-lang',
		'swupdate-lang'
	];

	const swupdateExt = swupdateExtensionIds
		.map((id) => vscode.extensions.getExtension<unknown>(id))
		.find((candidate): candidate is vscode.Extension<unknown> => candidate !== undefined);

	if (!swupdateExt) {
		throw new Error('SWUpdate extension under test is not installed for tests.');
	}
	await swupdateExt.activate();

	// Explicitly activate the libconfig dependency so its API is ready before any
	// document sync or completion request fires. swupdate's activate() starts this
	// asynchronously; here we ensure it is fully settled before tests proceed.
	const { extensionDependencies } = require('../../../package.json') as { extensionDependencies: string[] };
	const libconfigId = extensionDependencies[0];
	const libconfigExt = vscode.extensions.getExtension(libconfigId);
	if (!libconfigExt) {
		throw new Error(`LibConfig extension ${libconfigId} is not installed for tests.`);
	}
	await libconfigExt.activate();
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export const getDocPath = (p: string): string => {
	return pathResolve(__dirname, '../../testFixture', p);
};

export const getDocUri = (p: string): vscode.Uri => {
	return vscode.Uri.file(getDocPath(p));
};

export async function cleanupTestArtifacts(): Promise<void> {
	await vscode.commands.executeCommand('workbench.action.closeAllEditors');

	await Promise.all([...tempFixtureDirs].map((tempDir) =>
		rm(tempDir, { recursive: true, force: true })
	));

	tempFixtureDirs.clear();
}

export async function setTestContent(content: string): Promise<boolean> {
	if (!doc || !editor) {
		throw new Error('No active SWUpdate test document.');
	}

	const all = new vscode.Range(
		doc.positionAt(0),
		doc.positionAt(doc.getText().length)
	);
	return editor.edit((editBuilder) => editBuilder.replace(all, content));
}
