/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

export async function runCompletionTest(): Promise<void> {
	const docUri = getDocUri('sw-description.sample');
	await testCompletion(docUri, new vscode.Position(1, 1), [
		{ label: 'version', kind: vscode.CompletionItemKind.Field },
		{ label: 'install-if-higher', kind: vscode.CompletionItemKind.Field },
		{ label: 'update-type', kind: vscode.CompletionItemKind.Field },
		{ label: 'embedded-script', kind: vscode.CompletionItemKind.Field },
		{ label: 'images', kind: vscode.CompletionItemKind.Snippet },
		{ label: 'bootenv', kind: vscode.CompletionItemKind.Snippet },
		{ label: 'hardware-compatibility', kind: vscode.CompletionItemKind.Field }
	]);

	await testCompletion(docUri, new vscode.Position(1, 15), [
		{ label: '"application"', kind: vscode.CompletionItemKind.Value },
		{ label: '"OS"', kind: vscode.CompletionItemKind.Value }
	]);

	await testCompletion(docUri, new vscode.Position(2, 25), [
		{ label: '"#RE:^...$"', kind: vscode.CompletionItemKind.Snippet }
	]);

	await testCompletion(docUri, new vscode.Position(5, 10), [
		{ label: '"ubivol"', kind: vscode.CompletionItemKind.Value },
		{ label: '"flash"', kind: vscode.CompletionItemKind.Value },
		{ label: '"bootloader"', kind: vscode.CompletionItemKind.Value }
	]);

	await testCompletion(docUri, new vscode.Position(6, 16), [
		{ label: '"xz"', kind: vscode.CompletionItemKind.Value },
		{ label: '"zstd"', kind: vscode.CompletionItemKind.Value },
		{ label: '"zlib"', kind: vscode.CompletionItemKind.Value }
	]);

	await testCompletion(docUri, new vscode.Position(7, 15), [
		{ label: '"aes-cbc"', kind: vscode.CompletionItemKind.Value },
		{ label: 'true', kind: vscode.CompletionItemKind.Keyword }
	]);

	await testCompletion(docUri, new vscode.Position(12, 10), [
		{ label: '"archive"', kind: vscode.CompletionItemKind.Value },
		{ label: '"rawfile"', kind: vscode.CompletionItemKind.Value }
	]);

	await testCompletion(docUri, new vscode.Position(17, 10), [
		{ label: '"lua"', kind: vscode.CompletionItemKind.Value },
		{ label: '"shellscript"', kind: vscode.CompletionItemKind.Value },
		{ label: '"emmc_boot"', kind: vscode.CompletionItemKind.Value }
	]);
}

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedItems: Array<Pick<vscode.CompletionItem, 'label' | 'kind'>>
) {
	await activate(docUri);

	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
	const actualCompletionList = (await vscode.commands.executeCommand(
		'vscode.executeCompletionItemProvider',
		docUri,
		position
	)) as vscode.CompletionList;

	expectedItems.forEach((expectedItem) => {
		const actualItem = actualCompletionList.items.find(item => item.label === expectedItem.label);
		assert.ok(actualItem, `Expected completion item not found: ${expectedItem.label}`);
		assert.equal(actualItem!.kind, expectedItem.kind);
	});
}
