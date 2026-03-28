/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

type CompletionExpectation = Pick<vscode.CompletionItem, 'label' | 'kind'>;

type CompletionTestCase = {
	docUri: vscode.Uri;
	position: vscode.Position;
	expectedItems: CompletionExpectation[];
};

export async function runCompletionTest(): Promise<void> {
	const docUri = getDocUri('sw-description.sample');
	const labeltypeDocUri = getDocUri('sw-description-labeltype.sample');
	const filesystemDocUri = getDocUri('sw-description-filesystem.sample');

	const testCases: CompletionTestCase[] = [
		// Spec field templates: filename, device, path, volume, filesystem, mtdname, name, value
		{
			docUri,
			position: new vscode.Position(1, 1),
			expectedItems: [
				{ label: 'version', kind: vscode.CompletionItemKind.Field },
				{ label: 'install-if-higher', kind: vscode.CompletionItemKind.Field },
				{ label: 'update-type', kind: vscode.CompletionItemKind.Field },
				{ label: 'embedded-script', kind: vscode.CompletionItemKind.Field },
				{ label: 'images', kind: vscode.CompletionItemKind.Snippet },
				{ label: 'bootenv', kind: vscode.CompletionItemKind.Snippet },
				{ label: 'hardware-compatibility', kind: vscode.CompletionItemKind.Field },
				{ label: 'filename', kind: vscode.CompletionItemKind.Field },
				{ label: 'device', kind: vscode.CompletionItemKind.Field },
				{ label: 'path', kind: vscode.CompletionItemKind.Field },
				{ label: 'volume', kind: vscode.CompletionItemKind.Field },
				{ label: 'filesystem', kind: vscode.CompletionItemKind.Field },
				{ label: 'mtdname', kind: vscode.CompletionItemKind.Field },
				{ label: 'name', kind: vscode.CompletionItemKind.Field },
				{ label: 'value', kind: vscode.CompletionItemKind.Field }
			]
		},
		{
			docUri,
			position: new vscode.Position(1, 15),
			expectedItems: [
				{ label: '"application"', kind: vscode.CompletionItemKind.Value },
				{ label: '"OS"', kind: vscode.CompletionItemKind.Value }
			]
		},
		{
			docUri,
			position: new vscode.Position(2, 25),
			expectedItems: [
				{ label: '"#RE:^...$"', kind: vscode.CompletionItemKind.Snippet }
			]
		},
		{
			docUri,
			position: new vscode.Position(5, 10),
			expectedItems: [
				{ label: '"ubivol"', kind: vscode.CompletionItemKind.Value },
				{ label: '"flash"', kind: vscode.CompletionItemKind.Value },
				{ label: '"bootloader"', kind: vscode.CompletionItemKind.Value }
			]
		},
		{
			docUri,
			position: new vscode.Position(6, 16),
			expectedItems: [
				{ label: '"xz"', kind: vscode.CompletionItemKind.Value },
				{ label: '"zstd"', kind: vscode.CompletionItemKind.Value },
				{ label: '"zlib"', kind: vscode.CompletionItemKind.Value }
			]
		},
		{
			docUri,
			position: new vscode.Position(7, 15),
			expectedItems: [
				{ label: '"aes-cbc"', kind: vscode.CompletionItemKind.Value },
				{ label: 'true', kind: vscode.CompletionItemKind.Keyword }
			]
		},
		{
			docUri,
			position: new vscode.Position(12, 10),
			expectedItems: [
				{ label: '"archive"', kind: vscode.CompletionItemKind.Value },
				{ label: '"rawfile"', kind: vscode.CompletionItemKind.Value }
			]
		},
		{
			docUri,
			position: new vscode.Position(17, 10),
			expectedItems: [
				{ label: '"lua"', kind: vscode.CompletionItemKind.Value },
				{ label: '"shellscript"', kind: vscode.CompletionItemKind.Value },
				{ label: '"emmc_boot"', kind: vscode.CompletionItemKind.Value },
				{ label: '"emmc_boot_toggle"', kind: vscode.CompletionItemKind.Value },
				{ label: '"copy"', kind: vscode.CompletionItemKind.Value },
				{ label: '"ssblswitch"', kind: vscode.CompletionItemKind.Value },
				{ label: '"ubiswap"', kind: vscode.CompletionItemKind.Value },
				{ label: '"docker_containerstart"', kind: vscode.CompletionItemKind.Value }
			]
		},
		{
			docUri,
			position: new vscode.Position(22, 10),
			expectedItems: [
				{ label: '"diskpart"', kind: vscode.CompletionItemKind.Value },
				{ label: '"diskformat"', kind: vscode.CompletionItemKind.Value },
				{ label: '"ubipartition"', kind: vscode.CompletionItemKind.Value },
				{ label: '"toggleboot"', kind: vscode.CompletionItemKind.Value },
				{ label: '"uniqueuuid"', kind: vscode.CompletionItemKind.Value },
				{ label: '"btrfs"', kind: vscode.CompletionItemKind.Value }
			]
		},
		// Spec: filesystem value is open-ended (any Linux mount type) — general completions apply,
		// not a restricted list. Verify the statement template appears as a field completion.
		{
			docUri: filesystemDocUri,
			position: new vscode.Position(3, 16),
			expectedItems: [
				{ label: 'filename', kind: vscode.CompletionItemKind.Field },
				{ label: 'device', kind: vscode.CompletionItemKind.Field }
			]
		},
		{
			docUri: labeltypeDocUri,
			position: new vscode.Position(5, 16),
			expectedItems: [
				{ label: '"gpt"', kind: vscode.CompletionItemKind.Value },
				{ label: '"dos"', kind: vscode.CompletionItemKind.Value }
			]
		}
	];

	for (const testCase of testCases) {
		await testCompletion(testCase);
	}
}


async function testCompletion(testCase: CompletionTestCase) {
	const { docUri, position, expectedItems } = testCase;
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
