/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';
import {
	SW_DESCRIPTION_BOOLEAN_KEYWORD_VALUES,
	SW_DESCRIPTION_COMPRESSED_VALUES,
	SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES,
	SW_DESCRIPTION_ENCRYPTED_VALUES,
	SW_DESCRIPTION_TYPE_VALUES_BY_SECTION,
	SW_DESCRIPTION_UPDATE_TYPE_VALUES
} from '../swDescription/definitions';

type CompletionExpectation = Pick<vscode.CompletionItem, 'label' | 'kind'>;

type CompletionTestCase = {
	docUri: vscode.Uri;
	position: vscode.Position;
	expectedItems: CompletionExpectation[];
};

function asQuotedValueExpectations(values: readonly string[]): CompletionExpectation[] {
	return values.map((value) => ({
		label: `"${value}"`,
		kind: vscode.CompletionItemKind.Value
	}));
}

function asKeywordExpectations(values: readonly string[]): CompletionExpectation[] {
	return values.map((value) => ({
		label: value,
		kind: vscode.CompletionItemKind.Keyword
	}));
}

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
				{ label: 'value', kind: vscode.CompletionItemKind.Field },
				{ label: 'setting', kind: vscode.CompletionItemKind.Snippet },
				{ label: '@include', kind: vscode.CompletionItemKind.Snippet }
			]
		},
		{
			docUri,
			position: new vscode.Position(1, 15),
			expectedItems: asQuotedValueExpectations(SW_DESCRIPTION_UPDATE_TYPE_VALUES)
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
			expectedItems: asQuotedValueExpectations(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.images)
		},
		{
			docUri,
			position: new vscode.Position(6, 16),
			expectedItems: asQuotedValueExpectations(SW_DESCRIPTION_COMPRESSED_VALUES)
		},
		{
			docUri,
			position: new vscode.Position(7, 15),
			expectedItems: [
				...asQuotedValueExpectations(SW_DESCRIPTION_ENCRYPTED_VALUES),
				...asKeywordExpectations(SW_DESCRIPTION_BOOLEAN_KEYWORD_VALUES)
			]
		},
		{
			docUri,
			position: new vscode.Position(12, 10),
			expectedItems: asQuotedValueExpectations(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.files)
		},
		{
			docUri,
			position: new vscode.Position(17, 10),
			expectedItems: asQuotedValueExpectations(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.scripts)
		},
		{
			docUri,
			position: new vscode.Position(22, 10),
			expectedItems: asQuotedValueExpectations(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.partitions)
		},
		// Spec: filesystem value is open-ended (any Linux mount type) - general completions apply,
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
			expectedItems: asQuotedValueExpectations(SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES)
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
