// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

import * as vscode from 'vscode';

import {
	SW_DESCRIPTION_BOOLEAN_KEYWORD_VALUES,
	SW_DESCRIPTION_BOOLEAN_KEYS,
	SW_DESCRIPTION_COLON_VALUE_KEYS,
	SW_DESCRIPTION_COMPRESSED_VALUES,
	SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES,
	SW_DESCRIPTION_ENCRYPTED_VALUES,
	SW_DESCRIPTION_GENERAL_LITERAL_VALUES,
	SW_DESCRIPTION_STATEMENT_TEMPLATES,
	SW_DESCRIPTION_STRTOBOOL_KEYS,
	SW_DESCRIPTION_STRTOBOOL_VALUES,
	SW_DESCRIPTION_TYPE_VALUES_BY_SECTION,
	SW_DESCRIPTION_UPDATE_TYPE_VALUES,
	isSwDescriptionTypeSection
} from './definitions';
import type { SwDescriptionTypeSection } from './definitions';

// Pre-computed completion item arrays (computed once at module load).
const SW_DESCRIPTION_STATEMENT_ITEMS: vscode.CompletionItem[] = SW_DESCRIPTION_STATEMENT_TEMPLATES.map(template =>
	createSnippetCompletion(
		template.label,
		template.kind === 'field' ? vscode.CompletionItemKind.Field : vscode.CompletionItemKind.Snippet,
		template.insertText,
		template.detail
	)
);

const SW_DESCRIPTION_GENERAL_VALUE_ITEMS: vscode.CompletionItem[] = [
	...createLiteralValueCompletions(SW_DESCRIPTION_GENERAL_LITERAL_VALUES),
	createSnippetCompletion(
		'"#RE:^...$"',
		vscode.CompletionItemKind.Snippet,
		'"#RE:${1:^1\\.[023]$}"',
		'POSIX regular expression hardware compatibility pattern'
	)
];

// Native libconfig boolean keys (e.g. reboot, install-if-different) take true/false keywords.
const SW_DESCRIPTION_BOOLEAN_ITEMS: vscode.CompletionItem[] = createKeywordValueCompletions(SW_DESCRIPTION_BOOLEAN_KEYWORD_VALUES);

const SW_DESCRIPTION_COMPRESSED_ITEMS = createLiteralValueCompletions(SW_DESCRIPTION_COMPRESSED_VALUES);

const SW_DESCRIPTION_ENCRYPTED_ITEMS: vscode.CompletionItem[] = [
	...createLiteralValueCompletions(SW_DESCRIPTION_ENCRYPTED_VALUES),
	...SW_DESCRIPTION_BOOLEAN_ITEMS
];

const SW_DESCRIPTION_DISKPART_LABELTYPE_ITEMS = createLiteralValueCompletions(SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES);

const SW_DESCRIPTION_UPDATE_TYPE_ITEMS = createLiteralValueCompletions(SW_DESCRIPTION_UPDATE_TYPE_VALUES);

const SW_DESCRIPTION_STRTOBOOL_ITEMS = createLiteralValueCompletions(SW_DESCRIPTION_STRTOBOOL_VALUES);

const SW_DESCRIPTION_TYPE_ITEMS_BY_SECTION: Readonly<Record<SwDescriptionTypeSection, vscode.CompletionItem[]>> = {
	images: createLiteralValueCompletions(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.images),
	files: createLiteralValueCompletions(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.files),
	partitions: createLiteralValueCompletions(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.partitions),
	scripts: createLiteralValueCompletions(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.scripts)
};

export type SwDescriptionCompletionBase = {
	includeCompletion: vscode.CompletionItem;
};

type ValueCompletionProvider = (textBeforeLine: string) => vscode.CompletionItem[];

const ASSIGNMENT_KEY_REGEX = /([A-Za-z0-9_-]+)\s*[:=][^:=]*$/;
const TRAILING_STATEMENT_SEPARATOR_REGEX = /[;{}]\s*$/;
const SECTION_HEADER_REGEX = /^\s*([A-Za-z0-9_-]+)\s*:\s*\(\s*$/;

const SW_DESCRIPTION_COLON_VALUE_KEY_SET = new Set<string>(SW_DESCRIPTION_COLON_VALUE_KEYS);

const SW_DESCRIPTION_ALL_ITEMS: vscode.CompletionItem[] = [
	...SW_DESCRIPTION_GENERAL_VALUE_ITEMS,
	...SW_DESCRIPTION_STATEMENT_ITEMS
];

// Routes assignment keys to context-specific value completion providers.
const valueCompletionsByAssignmentKey: Readonly<Record<string, ValueCompletionProvider>> = {
	compressed: () => SW_DESCRIPTION_COMPRESSED_ITEMS,
	encrypted: () => SW_DESCRIPTION_ENCRYPTED_ITEMS,
	// Note: 'filesystem' is intentionally absent - it accepts any Linux mount type.
	labeltype: provideLabeltypeValueCompletions,
	'update-type': () => SW_DESCRIPTION_UPDATE_TYPE_ITEMS,
	type: provideTypeValueCompletions,
	// Native libconfig boolean keys take true/false keywords.
	...createValueCompletionProviders(SW_DESCRIPTION_BOOLEAN_KEYS, () => SW_DESCRIPTION_BOOLEAN_ITEMS),
	// Handler properties-block keys parsed via strtobool() - must use "true"/"TRUE"/"false"/"FALSE"
	...createValueCompletionProviders(SW_DESCRIPTION_STRTOBOOL_KEYS, () => SW_DESCRIPTION_STRTOBOOL_ITEMS)
};

export function getSwDescriptionCompletionItems(
	text: string,
	linePrefix: string,
	lineStart: number,
	trimmedPrefix: string,
	base: SwDescriptionCompletionBase
): vscode.CompletionItem[] {
	if (trimmedPrefix.startsWith('@')) {
		return [base.includeCompletion];
	}

	if (linePrefix.includes('=')) {
		const textBeforeLine = text.slice(0, lineStart);
		return getSwDescriptionValueCompletionsForContext(textBeforeLine, linePrefix);
	}

	const assignmentKey = getCurrentAssignmentKey(linePrefix);
	if (linePrefix.includes(':') && isSwDescriptionColonValueKey(assignmentKey)) {
		return SW_DESCRIPTION_GENERAL_VALUE_ITEMS;
	}

	if (trimmedPrefix.length === 0 || TRAILING_STATEMENT_SEPARATOR_REGEX.test(linePrefix)) {
		return SW_DESCRIPTION_STATEMENT_ITEMS;
	}

	return SW_DESCRIPTION_ALL_ITEMS;
}

function getSwDescriptionValueCompletionsForContext(
	textBeforeLine: string,
	linePrefix: string
): vscode.CompletionItem[] {
	const assignmentKey = getCurrentAssignmentKey(linePrefix);
	if (!assignmentKey) {
		return SW_DESCRIPTION_GENERAL_VALUE_ITEMS;
	}

	const provider = valueCompletionsByAssignmentKey[assignmentKey];
	if (provider) {
		return provider(textBeforeLine);
	}

	return SW_DESCRIPTION_GENERAL_VALUE_ITEMS;
}

function provideLabeltypeValueCompletions(textBeforeLine: string): vscode.CompletionItem[] {
	const parentSection = getCurrentSwDescriptionSection(textBeforeLine);
	if (parentSection !== 'partitions') {
		return SW_DESCRIPTION_GENERAL_VALUE_ITEMS;
	}
	return SW_DESCRIPTION_DISKPART_LABELTYPE_ITEMS;
}

function provideTypeValueCompletions(textBeforeLine: string): vscode.CompletionItem[] {
	const parentSection = getCurrentSwDescriptionSection(textBeforeLine);
	if (!isSwDescriptionTypeSection(parentSection)) {
		return SW_DESCRIPTION_GENERAL_VALUE_ITEMS;
	}
	return SW_DESCRIPTION_TYPE_ITEMS_BY_SECTION[parentSection];
}

function getCurrentAssignmentKey(linePrefix: string): string | null {
	const match = ASSIGNMENT_KEY_REGEX.exec(linePrefix);
	return match ? match[1].toLowerCase() : null;
}

function isSwDescriptionColonValueKey(key: string | null): boolean {
	return key !== null && SW_DESCRIPTION_COLON_VALUE_KEY_SET.has(key);
}

function getCurrentSwDescriptionSection(textBeforeLine: string): string | null {
	let pos = textBeforeLine.length - 1;

	while (pos >= 0) {
		const lineStart = textBeforeLine.lastIndexOf('\n', pos - 1) + 1;
		const line = textBeforeLine.slice(lineStart, pos + 1);
		const match = SECTION_HEADER_REGEX.exec(line);
		if (match) {
			return match[1].toLowerCase();
		}
		pos = lineStart - 2;
	}

	return null;
}

function createLiteralValueCompletions(values: readonly string[]): vscode.CompletionItem[] {
	return values.map(value => createTextCompletion(`"${value}"`, vscode.CompletionItemKind.Value, `"${value}"`));
}

function createKeywordValueCompletions(values: readonly string[]): vscode.CompletionItem[] {
	return values.map(value => createTextCompletion(value, vscode.CompletionItemKind.Keyword, value));
}

function createValueCompletionProviders(keys: readonly string[], provider: ValueCompletionProvider): Record<string, ValueCompletionProvider> {
	const providers: Record<string, ValueCompletionProvider> = {};
	for (const key of keys) {
		providers[key] = provider;
	}
	return providers;
}

function createTextCompletion(label: string, kind: vscode.CompletionItemKind, insertText: string, detail?: string): vscode.CompletionItem {
	const item = new vscode.CompletionItem(label, kind);
	item.insertText = insertText;
	item.detail = detail;
	return item;
}

function createSnippetCompletion(label: string, kind: vscode.CompletionItemKind, insertText: string, detail?: string): vscode.CompletionItem {
	const item = new vscode.CompletionItem(label, kind);
	item.insertText = new vscode.SnippetString(insertText);
	item.detail = detail;
	return item;
}
