// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

import {
	Diagnostic,
	DiagnosticSeverity,
	Range
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
    ParsedLibconfigNode
} from '../validation/parseData';

import {
	SW_DESCRIPTION_AES_KEY_REGEX,
	SW_DESCRIPTION_BOOLEAN_KEYS,
	SW_DESCRIPTION_COMPRESSED_VALUES,
	SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES,
	SW_DESCRIPTION_ENTRY_KNOWN_KEYS,
	SW_DESCRIPTION_EXTERNAL_VARIABLE_REGEX,
	SW_DESCRIPTION_FILESYSTEM_VALUES,
	SW_DESCRIPTION_IVT_REGEX,
	SW_DESCRIPTION_OFFSET_REGEX,
	SW_DESCRIPTION_SHA256_FUNCTION_REGEX,
	SW_DESCRIPTION_SHA256_REGEX,
	SW_DESCRIPTION_SIZE_REGEX,
	SW_DESCRIPTION_STRING_KEYS,
	SW_DESCRIPTION_STRTOBOOL_VALUES,
	SW_DESCRIPTION_TYPE_VALUES_BY_SECTION,
	SW_DESCRIPTION_TYPE_VALUE_SETS_BY_SECTION
} from './definitions';
import type { SwDescriptionTypeSection } from './definitions';

const booleanKeys = new Set<string>(SW_DESCRIPTION_BOOLEAN_KEYS as readonly string[]);
const stringKeys = new Set<string>(SW_DESCRIPTION_STRING_KEYS as readonly string[]);
const compressedValues = new Set<string>(SW_DESCRIPTION_COMPRESSED_VALUES as readonly string[]);
const diskpartLabeltypeValues = new Set<string>(SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES as readonly string[]);
const filesystemValues = new Set<string>(SW_DESCRIPTION_FILESYSTEM_VALUES as readonly string[]);
const strtoboolValues = new Set<string>(SW_DESCRIPTION_STRTOBOOL_VALUES as readonly string[]);
const STRTOBOOL_VALUES_MSG = SW_DESCRIPTION_STRTOBOOL_VALUES.map(v => `"${v}"`).join(', ');
// Matches any case-variant of "true"/"false" — used to detect boolean-ish strings inside properties blocks.
const BOOLEAN_LIKE_REGEX = /^(true|false)$/i;

// Pre-computed error message strings
const DISKPART_LABELTYPE_VALUES_MSG = SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES.join(', ');
const FILESYSTEM_VALUES_MSG = SW_DESCRIPTION_FILESYSTEM_VALUES.join(', ');
const TYPE_VALUES_MSG: Readonly<Record<string, string>> = Object.fromEntries(
	Object.entries(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION).map(([k, v]) => [k, (v as readonly string[]).join(', ')])
);
const DISKPART_PARTITION_KEY_REGEX = /^partition-\d+$/i;
const SW_DESCRIPTION_SECTION_NAMES = new Set<SwDescriptionTypeSection>(
	Object.keys(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION) as SwDescriptionTypeSection[]
);

// Validation configuration - maps property keys to their validation logic
type ValidationContext = {
	property: LibConfigPropertyNode;
	value: BaseLibConfigNode;
	addWarning: (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => void;
	addError: (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => void;
	section?: SwDescriptionTypeSection;
};

type Validator = (ctx: ValidationContext) => void;

const propertyValidators: Record<string, Validator> = {
	'compressed': (ctx) => {
		if (ctx.value.type === 'string') {
			const stringValue = readStringValue(ctx.value);
			if (stringValue) {
				const normalized = stringValue.toLowerCase();
				if (!compressedValues.has(normalized)) {
					ctx.addWarning(ctx.property, "Unsupported compression. Expected one of: 'zlib', 'zstd', 'xz'.");
				}
			}
		} else if (ctx.value.type !== 'boolean') {
			ctx.addWarning(ctx.property, "Expected string or boolean value for 'compressed'.");
		}
	},
	'encrypted': (ctx) => {
		if (ctx.value.type !== 'boolean' && ctx.value.type !== 'string') {
			ctx.addWarning(ctx.property, "Expected string or boolean value for 'encrypted'.");
		}
	},
	'update-type': (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && stringValue.trim().length === 0) {
			ctx.addWarning(ctx.property, "'update-type' should not be empty.");
		}
	},
	'sha256': (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (
			stringValue !== null &&
			!SW_DESCRIPTION_SHA256_REGEX.test(stringValue) &&
			!SW_DESCRIPTION_SHA256_FUNCTION_REGEX.test(stringValue)
		) {
			ctx.addWarning(ctx.property, "'sha256' should be a 64-character hexadecimal string or a $swupdate_get_sha256(...) value.");
		}
	},
	'ivt': (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && !SW_DESCRIPTION_IVT_REGEX.test(stringValue)) {
			ctx.addWarning(ctx.property, "'ivt' should be a 32-character hexadecimal string.");
		}
	},
	'aes-key': (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && !SW_DESCRIPTION_AES_KEY_REGEX.test(stringValue)) {
			ctx.addWarning(ctx.property, "'aes-key' should be a 32/48/64-character hexadecimal string.");
		}
	},
	'hardware-compatibility': (ctx) => {
		if (ctx.value.type !== 'array') {
			ctx.addWarning(ctx.property, "Expected array value for 'hardware-compatibility'.");
		} else {
			const arrayItems = readArrayChildren(ctx.value);
			for (const item of arrayItems) {
				if (item.type !== 'string') {
					ctx.addWarning(ctx.property, "'hardware-compatibility' array should contain only strings.");
					break;
				}
			}
		}
	},
	'ref': (ctx) => {
		if (ctx.value.type !== 'string') {
			ctx.addWarning(ctx.property, "Expected string value for 'ref'.");
		}
	},
	'fstype': (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null) {
			const normalized = stringValue.toLowerCase();
			if (!filesystemValues.has(normalized)) {
				ctx.addWarning(ctx.property, `Unsupported fstype. Expected one of: ${FILESYSTEM_VALUES_MSG}.`);
			}
		}
	},
	'labeltype': (ctx) => {
		if (ctx.section !== 'partitions') {
			return;
		}
		if (ctx.value.type !== 'string') {
			ctx.addError(ctx.property, "Expected string value for 'labeltype'.");
			return;
		}
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && !diskpartLabeltypeValues.has(stringValue.toLowerCase())) {
			ctx.addError(ctx.property, `Unsupported labeltype. Expected one of: ${DISKPART_LABELTYPE_VALUES_MSG}.`);
		}
	},
	'offset': (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && 
			!SW_DESCRIPTION_OFFSET_REGEX.test(stringValue) && 
			!SW_DESCRIPTION_EXTERNAL_VARIABLE_REGEX.test(stringValue)) {
			ctx.addWarning(ctx.property, "'offset' should be a decimal string with optional K, M, or G suffix, or an external variable using @@variable@@ syntax.");
		}
	},
	'size': (ctx) => {
		if (ctx.value.type === 'number') {
			// Number is valid
			return;
		}
		if (ctx.value.type === 'string') {
			const stringValue = readStringValue(ctx.value);
			if (stringValue !== null && 
				!SW_DESCRIPTION_SIZE_REGEX.test(stringValue) && 
				!SW_DESCRIPTION_EXTERNAL_VARIABLE_REGEX.test(stringValue)) {
				ctx.addError(ctx.property, "'size' should be a number or a decimal string with optional K, M, or G suffix, or an external variable using @@variable@@ syntax.");
			}
		} else {
			ctx.addError(ctx.property, "Invalid partition 'size' value. Expected number or string.");
		}
	},
	'type': (ctx) => {
		// Type validation requires section context
		if (!ctx.section) {
			return;
		}
		if (ctx.value.type !== 'string') {
			ctx.addWarning(ctx.property, "Expected string value for 'type'.");
			return;
		}
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null) {
			const typeSet = SW_DESCRIPTION_TYPE_VALUE_SETS_BY_SECTION[ctx.section];
			if (typeSet && !typeSet.has(stringValue)) {
				const allowedTypes = TYPE_VALUES_MSG[ctx.section];
				ctx.addWarning(ctx.property, `Unsupported type for '${ctx.section}'. Expected one of: ${allowedTypes}.`);
			}
		}
	}
};

interface BaseLibConfigNode {
	type: ParsedLibconfigNode['type'];
	offset: number;
	length: number;
	value: string | boolean | number | BaseLibConfigNode | null;
	children?: BaseLibConfigNode[];
	name?: string;
}

interface LibConfigPropertyNode extends BaseLibConfigNode {
	type: 'property';
	name: string;
	value: BaseLibConfigNode | null;
}

interface ObjectLibConfigNode extends BaseLibConfigNode {
	type: 'object';
	children: LibConfigPropertyNode[];
}

interface ListLibConfigNode extends BaseLibConfigNode {
	type: 'list';
	children: BaseLibConfigNode[];
}

interface ArrayLibConfigNode extends BaseLibConfigNode {
	type: 'array';
	children: BaseLibConfigNode[];
}

export function getSwDescriptionSemanticDiagnostics(
	textDocument: TextDocument,
	rootSettings: ParsedLibconfigNode[]
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	const addDiagnostic = (node: LibConfigPropertyNode | BaseLibConfigNode, message: string, severity: DiagnosticSeverity) => {
		const startOffset = node.offset;
		const endOffset = node.offset + Math.max(node.length, 1);
		const range = Range.create(textDocument.positionAt(startOffset), textDocument.positionAt(endOffset));
		diagnostics.push(Diagnostic.create(range, message, severity));
	};

	const addWarning = (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => {
		addDiagnostic(node, message, DiagnosticSeverity.Warning);
	};

	const addError = (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => {
		addDiagnostic(node, message, DiagnosticSeverity.Error);
	};

	const validateProperty = (property: LibConfigPropertyNode, section?: SwDescriptionTypeSection, skipUnknownKeyCheck?: boolean) => {
		const key = property.name.toLowerCase();
		// For property nodes, the value is in children[0] after LibConfig serialization fix
		const value = property.value || ((property as any).children?.[0] as BaseLibConfigNode | undefined) || null;
		if (!value) {
			return;
		}

		// Quick type checks for known keys - return early if wrong type
		if (booleanKeys.has(key) && value.type !== 'boolean') {
			addWarning(property, `Expected boolean value for '${property.name}'.`);
			return;
		}

		// Inside handler 'properties' blocks: values intended as booleans must use strtobool strings.
		// Native libconfig booleans are not parsed by the handler API — it uses strtobool().
		if (skipUnknownKeyCheck) {
			if (value.type === 'boolean') {
				addWarning(property, `Use a strtobool string for '${property.name}': expected one of ${STRTOBOOL_VALUES_MSG}.`);
			} else if (value.type === 'string') {
				const sv = readStringValue(value);
				if (sv !== null && BOOLEAN_LIKE_REGEX.test(sv) && !strtoboolValues.has(sv)) {
					addWarning(property, `'${property.name}' is not a valid strtobool string. Expected one of: ${STRTOBOOL_VALUES_MSG}.`);
				}
			}
			// Continue — still run named validators (e.g. labeltype, partition-N) inside properties blocks.
		}

		if (stringKeys.has(key) && value.type !== 'string') {
			addWarning(property, `Expected string value for '${property.name}'.`);
			return;
		}

		// Run specific validator if one exists for this key
		const validator = propertyValidators[key];
		if (validator) {
			validator({ property, value, addWarning, addError, section });
		}

		validateDiskpartPartitionProperty(property, value, addWarning, addError, section);

		// Unknown key detection: inside a known section, any key not in the spec set is likely a typo.
		// Skip when inside a handler 'properties' sub-block (those keys are handler-specific).
		if (
			section &&
			!skipUnknownKeyCheck &&
			!SW_DESCRIPTION_ENTRY_KNOWN_KEYS.has(key) &&
			!DISKPART_PARTITION_KEY_REGEX.test(property.name)
		) {
			addWarning(property, `Unknown property '${property.name}'. Check for typos.`);
		}
	};

	walkProperties(rootSettings as LibConfigPropertyNode[], validateProperty, undefined);
	return diagnostics;
}

function walkProperties(properties: LibConfigPropertyNode[], visitor: (property: LibConfigPropertyNode, section?: SwDescriptionTypeSection, skipUnknownKeyCheck?: boolean) => void, currentSection?: SwDescriptionTypeSection, skipUnknownKeyCheck?: boolean): void {
	for (const property of properties) {
		const propertyName = property.name.toLowerCase() as SwDescriptionTypeSection;
		// Check if this property defines a new section
		const newSection = SW_DESCRIPTION_SECTION_NAMES.has(propertyName) ? propertyName : currentSection;
		
		visitor(property, currentSection, skipUnknownKeyCheck);
		// For property nodes, the value might be in children[0] after LibConfig serialization fix
		const valueNode = property.value || ((property as any).children?.[0] as BaseLibConfigNode | undefined) || null;
		// Children of a 'properties' sub-object are handler-specific — suppress unknown-key check there
		const rawPropertyName: string = property.name.toLowerCase();
		const childSkipUnknown = skipUnknownKeyCheck || rawPropertyName === 'properties';
		walkNode(valueNode, visitor, newSection, childSkipUnknown);
	}
}

function walkNode(node: BaseLibConfigNode | null, visitor: (property: LibConfigPropertyNode, section?: SwDescriptionTypeSection, skipUnknownKeyCheck?: boolean) => void, currentSection?: SwDescriptionTypeSection, skipUnknownKeyCheck?: boolean): void {
	if (!node) {
		return;
	}

	if (node.type === 'object') {
		walkProperties((node as ObjectLibConfigNode).children, visitor, currentSection, skipUnknownKeyCheck);
		return;
	}

	if (node.type === 'list') {
		for (const child of (node as ListLibConfigNode).children) {
			// Each list item is a fresh entry — reset the properties-block suppression
			walkNode(child, visitor, currentSection, false);
		}
		return;
	}

	if (node.type === 'array') {
		for (const child of (node as ArrayLibConfigNode).children) {
			walkNode(child, visitor, currentSection, skipUnknownKeyCheck);
		}
	}
}

function readStringValue(node: BaseLibConfigNode): string | null {
	if (node.type !== 'string') {
		return null;
	}
	return typeof node.value === 'string' ? node.value : null;
}

function readArrayChildren(node: BaseLibConfigNode): BaseLibConfigNode[] {
	if (node.type !== 'array') {
		return [];
	}
	return ((node as ArrayLibConfigNode).children || []) as BaseLibConfigNode[];
}

function validateDiskpartPartitionProperty(
	property: LibConfigPropertyNode,
	value: BaseLibConfigNode,
	addWarning: (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => void,
	addError: (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => void,
	section?: SwDescriptionTypeSection
): void {
	if (section !== 'partitions' || !DISKPART_PARTITION_KEY_REGEX.test(property.name)) {
		return;
	}

	if (value.type !== 'array') {
		addWarning(property, `Expected array value for '${property.name}'.`);
		return;
	}

	for (const item of readArrayChildren(value)) {
		const entry = readStringValue(item);
		if (entry === null) {
			addWarning(item, `Expected string entry in '${property.name}'.`);
			continue;
		}

		const separatorIndex = entry.indexOf('=');
		if (separatorIndex === -1) {
			continue;
		}

		const entryKey = entry.slice(0, separatorIndex).trim().toLowerCase();
		const entryValue = entry.slice(separatorIndex + 1).trim();

		if (
			entryKey === 'size' &&
			!SW_DESCRIPTION_SIZE_REGEX.test(entryValue) &&
			!SW_DESCRIPTION_EXTERNAL_VARIABLE_REGEX.test(entryValue)
		) {
			addError(item, "Invalid partition 'size' value. Expected a decimal string with optional K, M, or G suffix, or an external variable using @@variable@@ syntax.");
		}
	}
}
