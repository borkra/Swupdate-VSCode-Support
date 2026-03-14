'use strict';

import {
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	Range
} from 'vscode-languageserver/node';

import {
	ArrayLibConfigNode,
	BaseLibConfigNode,
	LibConfigPropertyNode,
	ListLibConfigNode,
	ObjectLibConfigNode
} from '../dataClasses';

import {
	SW_DESCRIPTION_AES_KEY_REGEX,
	SW_DESCRIPTION_BOOLEAN_KEYS,
	SW_DESCRIPTION_COMPRESSED_VALUES,
	SW_DESCRIPTION_IVT_REGEX,
	SW_DESCRIPTION_NUMERIC_KEYS,
	SW_DESCRIPTION_SHA256_FUNCTION_REGEX,
	SW_DESCRIPTION_SHA256_REGEX,
	SW_DESCRIPTION_STRING_KEYS
} from './definitions';

const booleanKeys = new Set<string>(SW_DESCRIPTION_BOOLEAN_KEYS as readonly string[]);
const stringKeys = new Set<string>(SW_DESCRIPTION_STRING_KEYS as readonly string[]);
const numericKeys = new Set<string>(SW_DESCRIPTION_NUMERIC_KEYS as readonly string[]);
const compressedValues = new Set<string>(SW_DESCRIPTION_COMPRESSED_VALUES as readonly string[]);

export function getSwDescriptionSemanticDiagnostics(
	textDocument: TextDocument,
	rootSettings: LibConfigPropertyNode[]
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	const addWarning = (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => {
		const startOffset = node.offset;
		const endOffset = node.offset + Math.max(node.length, 1);
		const range = Range.create(textDocument.positionAt(startOffset), textDocument.positionAt(endOffset));
		diagnostics.push(Diagnostic.create(range, message, DiagnosticSeverity.Warning, 0x400, textDocument.languageId));
	};

	const validateProperty = (property: LibConfigPropertyNode) => {
		const key = property.name.toLowerCase();
		const value = property.value;
		if (!value) {
			return;
		}

		if (booleanKeys.has(key) && value.type !== 'boolean') {
			addWarning(property, `Expected boolean value for '${property.name}'.`);
		}

		if (stringKeys.has(key) && value.type !== 'string') {
			addWarning(property, `Expected string value for '${property.name}'.`);
		}

		if (numericKeys.has(key) && value.type !== 'number') {
			addWarning(property, `Expected numeric value for '${property.name}'.`);
		}

		if (key === 'compressed') {
			if (value.type === 'string') {
				const stringValue = readStringValue(value);
				if (!stringValue) {
					return;
				}
				const normalized = stringValue.toLowerCase();
				if (!compressedValues.has(normalized)) {
					addWarning(property, "Unsupported compression. Expected one of: 'zlib', 'zstd', 'xz'.");
				}
			} else if (value.type !== 'boolean') {
				addWarning(property, "Expected string or boolean value for 'compressed'.");
			}
		}

		if (key === 'encrypted' && value.type !== 'boolean' && value.type !== 'string') {
			addWarning(property, "Expected string or boolean value for 'encrypted'.");
		}

		if (key === 'update-type' && value.type === 'string') {
			const stringValue = readStringValue(value);
			if (stringValue !== null && stringValue.trim().length === 0) {
				addWarning(property, "'update-type' should not be empty.");
			}
		}

		if (key === 'sha256' && value.type === 'string') {
			const stringValue = readStringValue(value);
			if (
				stringValue !== null &&
				!SW_DESCRIPTION_SHA256_REGEX.test(stringValue) &&
				!SW_DESCRIPTION_SHA256_FUNCTION_REGEX.test(stringValue)
			) {
				addWarning(property, "'sha256' should be a 64-character hexadecimal string.");
			}
		}

		if (key === 'ivt' && value.type === 'string') {
			const stringValue = readStringValue(value);
			if (stringValue !== null && !SW_DESCRIPTION_IVT_REGEX.test(stringValue)) {
				addWarning(property, "'ivt' should be a 32-character hexadecimal string.");
			}
		}

		if (key === 'aes-key' && value.type === 'string') {
			const stringValue = readStringValue(value);
			if (stringValue !== null && !SW_DESCRIPTION_AES_KEY_REGEX.test(stringValue)) {
				addWarning(property, "'aes-key' should be a 32/48/64-character hexadecimal string.");
			}
		}

		if (key === 'hardware-compatibility' && value.type !== 'array') {
			addWarning(property, "Expected array value for 'hardware-compatibility'.");
		}

		if (key === 'ref' && value.type !== 'string') {
			addWarning(property, "Expected string value for 'ref'.");
		}

		if (key === 'hardware-compatibility' && value.type === 'array') {
			const arrayItems = readArrayChildren(value);
			for (const item of arrayItems) {
				if (item.type !== 'string') {
					addWarning(property, "'hardware-compatibility' array should contain only strings.");
					break;
				}
			}
		}
	};

	walkProperties(rootSettings, validateProperty);
	return diagnostics;
}

function walkProperties(properties: LibConfigPropertyNode[], visitor: (property: LibConfigPropertyNode) => void): void {
	for (const property of properties) {
		visitor(property);
		walkNode(property.value, visitor);
	}
}

function walkNode(node: BaseLibConfigNode | null, visitor: (property: LibConfigPropertyNode) => void): void {
	if (!node) {
		return;
	}

	if (node.type === 'object') {
		walkProperties((node as ObjectLibConfigNode).children, visitor);
		return;
	}

	if (node.type === 'list') {
		for (const child of (node as ListLibConfigNode).children) {
			walkNode(child, visitor);
		}
		return;
	}

	if (node.type === 'array') {
		for (const child of (node as ArrayLibConfigNode).children) {
			walkNode(child, visitor);
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
