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

type ValueCompletionContext = {
	textBeforeLine: string;
};

type ValueCompletionProvider = (context: ValueCompletionContext) => CompletionItem[];

// Routes assignment keys to context-specific value completion providers.
const valueCompletionsByAssignmentKey: Readonly<Record<string, ValueCompletionProvider>> = {
	compressed: provideCompressedValueCompletions,
	encrypted: provideEncryptedValueCompletions,
	labeltype: provideLabeltypeValueCompletions,
	'update-type': provideUpdateTypeValueCompletions,
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
		return getSwDescriptionValueCompletions();
	}

	if (trimmedPrefix.length === 0 || /[;{}]\s*$/.test(linePrefix)) {
		return getSwDescriptionStatementCompletions();
	}

	return getSwDescriptionAllCompletions();
}

function getSwDescriptionAllCompletions(): CompletionItem[] {
	return [
		...getSwDescriptionValueCompletions(),
		...getSwDescriptionStatementCompletions()
	];
}

function getSwDescriptionStatementCompletions(): CompletionItem[] {
	return SW_DESCRIPTION_STATEMENT_ITEMS;
}

function getSwDescriptionValueCompletions(): CompletionItem[] {
	return SW_DESCRIPTION_GENERAL_VALUE_ITEMS;
}

function getSwDescriptionValueCompletionsForContext(
	textBeforeLine: string,
	linePrefix: string
): CompletionItem[] {
	const assignmentKey = getCurrentAssignmentKey(linePrefix);
	if (!assignmentKey) {
		return getSwDescriptionValueCompletions();
	}

	const provider = valueCompletionsByAssignmentKey[assignmentKey];
	if (provider) {
		return provider({ textBeforeLine });
	}

	return getSwDescriptionValueCompletions();
}

function provideCompressedValueCompletions(_context: ValueCompletionContext): CompletionItem[] {
	return SW_DESCRIPTION_COMPRESSED_ITEMS;
}

function provideEncryptedValueCompletions(_context: ValueCompletionContext): CompletionItem[] {
	return SW_DESCRIPTION_ENCRYPTED_ITEMS;
}

function provideLabeltypeValueCompletions(context: ValueCompletionContext): CompletionItem[] {
	const parentSection = getCurrentSwDescriptionSection(context.textBeforeLine);
	if (parentSection !== 'partitions') {
		return getSwDescriptionValueCompletions();
	}
	return SW_DESCRIPTION_DISKPART_LABELTYPE_ITEMS;
}

function provideUpdateTypeValueCompletions(_context: ValueCompletionContext): CompletionItem[] {
	return SW_DESCRIPTION_UPDATE_TYPE_ITEMS;
}

function provideTypeValueCompletions(context: ValueCompletionContext): CompletionItem[] {
	const parentSection = getCurrentSwDescriptionSection(context.textBeforeLine);
	if (!isSwDescriptionTypeSection(parentSection)) {
		return getSwDescriptionValueCompletions();
	}
	return SW_DESCRIPTION_TYPE_ITEMS_BY_SECTION[parentSection];
}

// Cache for assignment key extraction
// Maps already use internal hash tables optimized for string keys
const assignmentKeyCache = new Map<string, string | null>();
const ASSIGNMENT_KEY_CACHE_MAX = 200;

function getCurrentAssignmentKey(linePrefix: string): string | null {
	// Use truncated prefix as key - Maps handle string keys efficiently
	const cacheKey = linePrefix.length > 200 ? linePrefix.slice(-200) : linePrefix;
	let cached = assignmentKeyCache.get(cacheKey);
	
	if (cached === undefined) {
		const match = linePrefix.match(/([A-Za-z0-9_-]+)\s*[:=][^:=]*$/);
		cached = match ? match[1].toLowerCase() : null;
		assignmentKeyCache.set(cacheKey, cached);
		
		// Simple FIFO eviction
		if (assignmentKeyCache.size > ASSIGNMENT_KEY_CACHE_MAX) {
			const firstKey = assignmentKeyCache.keys().next().value;
			if (firstKey !== undefined) {
				assignmentKeyCache.delete(firstKey);
			}
		}
	}
	return cached;
}

function isSwDescriptionColonValueKey(key: string | null): boolean {
	return key !== null && (SW_DESCRIPTION_COLON_VALUE_KEYS as readonly string[]).includes(key);
}

// Cache for section detection
// Use Map with string keys - V8's Map is highly optimized for this
const sectionCache = new Map<string, string | null>();
const SECTION_CACHE_MAX = 100;

function getCurrentSwDescriptionSection(textBeforeLine: string): string | null {
	// Use suffix of text as cache key to limit memory
	const cacheKey = textBeforeLine.length > 500 
		? textBeforeLine.slice(-500) 
		: textBeforeLine;
	
	let cached = sectionCache.get(cacheKey);
	if (cached === undefined) {
		let pos = textBeforeLine.length - 1;
		cached = null;
		
		while (pos >= 0) {
			const lineStart = textBeforeLine.lastIndexOf('\n', pos - 1) + 1;
			const line = textBeforeLine.slice(lineStart, pos + 1);
			const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*\(\s*$/);
			if (match) {
				cached = match[1].toLowerCase();
				break;
			}
			pos = lineStart - 2;
		}
		
		sectionCache.set(cacheKey, cached);
		
		// Simple FIFO eviction
		if (sectionCache.size > SECTION_CACHE_MAX) {
			const firstKey = sectionCache.keys().next().value;
			if (firstKey !== undefined) {
				sectionCache.delete(firstKey);
			}
		}
	}
	return cached;
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
