// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

import {
	CompletionItem,
	CompletionItemKind,
	InsertTextFormat
} from 'vscode-languageserver/node';

import {
	SW_DESCRIPTION_COLON_VALUE_KEYS,
	SW_DESCRIPTION_COMPRESSED_VALUES,
	SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES,
	SW_DESCRIPTION_ENCRYPTED_VALUES,
	SW_DESCRIPTION_FILESYSTEM_VALUES,
	SW_DESCRIPTION_GENERAL_LITERAL_VALUES,
	SW_DESCRIPTION_STATEMENT_TEMPLATES,
	SW_DESCRIPTION_TYPE_VALUES_BY_SECTION,
	SW_DESCRIPTION_UPDATE_TYPE_VALUES
} from './definitions';
import type { SwDescriptionTypeSection } from './definitions';

// Pre-computed completion item arrays (computed once at module load).
const SW_DESCRIPTION_STATEMENT_ITEMS: CompletionItem[] = SW_DESCRIPTION_STATEMENT_TEMPLATES.map(template => ({
	label: template.label,
	kind: template.kind === 'field' ? CompletionItemKind.Field : CompletionItemKind.Snippet,
	insertText: template.insertText,
	insertTextFormat: InsertTextFormat.Snippet,
	detail: template.detail
}));

const SW_DESCRIPTION_GENERAL_VALUE_ITEMS: CompletionItem[] = [
	...createLiteralValueCompletions(SW_DESCRIPTION_GENERAL_LITERAL_VALUES),
	{
		label: '"#RE:^...$"',
		kind: CompletionItemKind.Snippet,
		insertText: '"#RE:${1:^1\\.[023]$}"',
		insertTextFormat: InsertTextFormat.Snippet,
		detail: 'POSIX regular expression hardware compatibility pattern'
	}
];

const SW_DESCRIPTION_COMPRESSED_ITEMS = createLiteralValueCompletions(SW_DESCRIPTION_COMPRESSED_VALUES);

const SW_DESCRIPTION_ENCRYPTED_ITEMS: CompletionItem[] = [
	...createLiteralValueCompletions(SW_DESCRIPTION_ENCRYPTED_VALUES),
	{ label: 'true', kind: CompletionItemKind.Keyword, insertText: 'true' }
];

const SW_DESCRIPTION_DISKPART_LABELTYPE_ITEMS = createLiteralValueCompletions(SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES);

const SW_DESCRIPTION_FILESYSTEM_ITEMS = createLiteralValueCompletions(SW_DESCRIPTION_FILESYSTEM_VALUES);

const SW_DESCRIPTION_UPDATE_TYPE_ITEMS = createLiteralValueCompletions(SW_DESCRIPTION_UPDATE_TYPE_VALUES);

const SW_DESCRIPTION_TYPE_ITEMS_BY_SECTION: Readonly<Record<SwDescriptionTypeSection, CompletionItem[]>> = {
	images: createLiteralValueCompletions(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.images),
	files: createLiteralValueCompletions(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.files),
	partitions: createLiteralValueCompletions(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.partitions),
	scripts: createLiteralValueCompletions(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.scripts)
};

export type SwDescriptionCompletionBase = {
	includeCompletion: CompletionItem;
};

type ValueCompletionProvider = (textBeforeLine: string) => CompletionItem[];

const ASSIGNMENT_KEY_REGEX = /([A-Za-z0-9_-]+)\s*[:=][^:=]*$/;
const TRAILING_STATEMENT_SEPARATOR_REGEX = /[;{}]\s*$/;
const SECTION_HEADER_REGEX = /^\s*([A-Za-z0-9_-]+)\s*:\s*\(\s*$/;

const SW_DESCRIPTION_COLON_VALUE_KEY_SET = new Set<string>(SW_DESCRIPTION_COLON_VALUE_KEYS as readonly string[]);

const SW_DESCRIPTION_ALL_ITEMS: CompletionItem[] = [
	...SW_DESCRIPTION_GENERAL_VALUE_ITEMS,
	...SW_DESCRIPTION_STATEMENT_ITEMS
];

// Routes assignment keys to context-specific value completion providers.
const valueCompletionsByAssignmentKey: Readonly<Record<string, ValueCompletionProvider>> = {
	compressed: () => SW_DESCRIPTION_COMPRESSED_ITEMS,
	encrypted: () => SW_DESCRIPTION_ENCRYPTED_ITEMS,
	// Note: 'filesystem' is intentionally absent — it accepts any Linux mount type.
	labeltype: provideLabeltypeValueCompletions,
	'update-type': () => SW_DESCRIPTION_UPDATE_TYPE_ITEMS,
	type: provideTypeValueCompletions
};

export function getSwDescriptionCompletionItems(
	text: string,
	linePrefix: string,
	lineStart: number,
	trimmedPrefix: string,
	base: SwDescriptionCompletionBase
): CompletionItem[] {
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
): CompletionItem[] {
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

function provideLabeltypeValueCompletions(textBeforeLine: string): CompletionItem[] {
	const parentSection = getCurrentSwDescriptionSection(textBeforeLine);
	if (parentSection !== 'partitions') {
		return SW_DESCRIPTION_GENERAL_VALUE_ITEMS;
	}
	return SW_DESCRIPTION_DISKPART_LABELTYPE_ITEMS;
}

function provideTypeValueCompletions(textBeforeLine: string): CompletionItem[] {
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

function isSwDescriptionTypeSection(section: string | null): section is SwDescriptionTypeSection {
	return section !== null && Object.prototype.hasOwnProperty.call(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION, section);
}

function createLiteralValueCompletions(values: readonly string[]): CompletionItem[] {
	return values.map(value => ({
		label: `"${value}"`,
		kind: CompletionItemKind.Value,
		insertText: `"${value}"`
	}));
}
