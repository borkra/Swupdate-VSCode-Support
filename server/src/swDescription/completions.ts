'use strict';

import {
	CompletionItem,
	CompletionItemKind,
	InsertTextFormat
} from 'vscode-languageserver/node';

import {
	SW_DESCRIPTION_COLON_VALUE_KEYS,
	SW_DESCRIPTION_COMPRESSED_VALUES,
	SW_DESCRIPTION_ENCRYPTED_VALUES,
	SW_DESCRIPTION_FILE_TYPE_VALUES,
	SW_DESCRIPTION_GENERAL_LITERAL_VALUES,
	SW_DESCRIPTION_IMAGE_TYPE_VALUES,
	SW_DESCRIPTION_SCRIPT_TYPE_VALUES,
	SW_DESCRIPTION_STATEMENT_TEMPLATES,
	SW_DESCRIPTION_UPDATE_TYPE_VALUES
} from './definitions';

export type SwDescriptionCompletionBase = {
	includeCompletion: CompletionItem;
	valueCompletions: CompletionItem[];
	statementCompletions: CompletionItem[];
	completionItems: CompletionItem[];
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
		return getSwDescriptionValueCompletionsForContext(textBeforeLine, linePrefix, base);
	}

	const assignmentKey = getCurrentAssignmentKey(linePrefix);
	if (linePrefix.includes(':') && isSwDescriptionColonValueKey(assignmentKey)) {
		return getSwDescriptionValueCompletions(base);
	}

	if (trimmedPrefix.length === 0 || /[;{}]\s*$/.test(linePrefix)) {
		return getSwDescriptionStatementCompletions(base);
	}

	return getSwDescriptionAllCompletions(base);
}

function getSwDescriptionAllCompletions(base: SwDescriptionCompletionBase): CompletionItem[] {
	return [
		...getSwDescriptionValueCompletions(base),
		...getSwDescriptionStatementCompletions(base)
	];
}

function getSwDescriptionStatementCompletions(base: SwDescriptionCompletionBase): CompletionItem[] {
	return [
		...base.statementCompletions,
		...SW_DESCRIPTION_STATEMENT_TEMPLATES.map(template => ({
			label: template.label,
			kind: template.kind === 'field' ? CompletionItemKind.Field : CompletionItemKind.Snippet,
			insertText: template.insertText,
			insertTextFormat: InsertTextFormat.Snippet,
			detail: template.detail
		}))
	];
}

function getSwDescriptionValueCompletions(base: SwDescriptionCompletionBase): CompletionItem[] {
	return [
		...base.valueCompletions,
		...createLiteralValueCompletions(SW_DESCRIPTION_GENERAL_LITERAL_VALUES),
		{
			label: '"#RE:^...$"',
			kind: CompletionItemKind.Snippet,
			insertText: '"#RE:${1:^1\\.[023]$}"',
			insertTextFormat: InsertTextFormat.Snippet,
			detail: 'POSIX regular expression hardware compatibility pattern'
		}
	];
}

function getSwDescriptionValueCompletionsForContext(
	textBeforeLine: string,
	linePrefix: string,
	base: SwDescriptionCompletionBase
): CompletionItem[] {
	const assignmentKey = getCurrentAssignmentKey(linePrefix);
	if (assignmentKey === 'compressed') {
		return [
			...base.valueCompletions,
			...createLiteralValueCompletions(SW_DESCRIPTION_COMPRESSED_VALUES)
		];
	}

	if (assignmentKey === 'encrypted') {
		return [
			...base.valueCompletions,
			...createLiteralValueCompletions(SW_DESCRIPTION_ENCRYPTED_VALUES),
			{
				label: 'true',
				kind: CompletionItemKind.Keyword,
				insertText: 'true'
			}
		];
	}

	if (assignmentKey === 'update-type') {
		return [
			...base.valueCompletions,
			...createLiteralValueCompletions(SW_DESCRIPTION_UPDATE_TYPE_VALUES)
		];
	}

	if (assignmentKey === 'type') {
		const parentSection = getCurrentSwDescriptionSection(textBeforeLine);
		if (parentSection === 'images') {
			return [
				...base.valueCompletions,
				...createLiteralValueCompletions(SW_DESCRIPTION_IMAGE_TYPE_VALUES)
			];
		}
		if (parentSection === 'files') {
			return [
				...base.valueCompletions,
				...createLiteralValueCompletions(SW_DESCRIPTION_FILE_TYPE_VALUES)
			];
		}
		if (parentSection === 'scripts') {
			return [
				...base.valueCompletions,
				...createLiteralValueCompletions(SW_DESCRIPTION_SCRIPT_TYPE_VALUES)
			];
		}
	}

	return getSwDescriptionValueCompletions(base);
}

function getCurrentAssignmentKey(linePrefix: string): string | null {
	const match = linePrefix.match(/([A-Za-z0-9_-]+)\s*[:=][^:=]*$/);
	return match ? match[1].toLowerCase() : null;
}

function isSwDescriptionColonValueKey(key: string | null): boolean {
	return key !== null && (SW_DESCRIPTION_COLON_VALUE_KEYS as readonly string[]).includes(key);
}

function getCurrentSwDescriptionSection(textBeforeLine: string): string | null {
	const lines = textBeforeLine.split(/\r?\n/);
	for (let i = lines.length - 1; i >= 0; i--) {
		const match = lines[i].match(/^\s*([A-Za-z0-9_-]+)\s*:\s*\(\s*$/);
		if (match) {
			return match[1].toLowerCase();
		}
	}
	return null;
}

function createLiteralValueCompletions(values: readonly string[]): CompletionItem[] {
	return values.map(value => ({
		label: `"${value}"`,
		kind: CompletionItemKind.Value,
		insertText: `"${value}"`
	}));
}
