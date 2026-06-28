// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

import * as l10n from '@vscode/l10n';

import type {
	ArrayLibConfigNode,
	BaseLibConfigNode,
	LibConfigPropertyNode,
	ListLibConfigNode,
	ObjectLibConfigNode,
	ParsedLibconfigNode
} from '../libconfigApi';
import {
	SW_DESCRIPTION_AES_KEY_REGEX,
	SW_DESCRIPTION_BOOLEAN_KEYS,
	SW_DESCRIPTION_COMPRESSED_VALUES,
	SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES,
	SW_DESCRIPTION_DISKPART_PARTITION_ENTRY_KEYS,
	SW_DESCRIPTION_DISKPART_TYPE_GUID_REGEX,
	SW_DESCRIPTION_DISKPART_TYPE_DOS_REGEX,
	SW_DESCRIPTION_ENTRY_KNOWN_KEYS,
	SW_DESCRIPTION_EXTERNAL_VARIABLE_REGEX,
	SW_DESCRIPTION_FUNCTION_REGEX,
	SW_DESCRIPTION_FILESYSTEM_VALUES,
	SW_DESCRIPTION_HEX_64_REGEX,
	SW_DESCRIPTION_IVT_REGEX,
	SW_DESCRIPTION_SIZE_REGEX,
	SW_DESCRIPTION_SIZE_SCALAR_REGEX,
	SW_DESCRIPTION_STRING_KEYS,
	SW_DESCRIPTION_NUMERIC_PROPERTY_KEYS,
	SW_DESCRIPTION_PROPERTY_TYPE_VALUES,
	SW_DESCRIPTION_SIZE_PROPERTY_KEYS,
	SW_DESCRIPTION_STRING_PROPERTY_KEYS,
	SW_DESCRIPTION_STRTOBOOL_KEYS,
	SW_DESCRIPTION_STRTOBOOL_VALUES,
	SW_DESCRIPTION_TYPE_VALUES_BY_SECTION,
	SW_DESCRIPTION_TYPE_VALUE_SETS_BY_SECTION,
	SW_DESCRIPTION_ZCKLOGLEVEL_VALUES,
	isSwDescriptionTypeSection
} from './definitions';
import type { SwDescriptionTypeSection } from './definitions';

const compressedValues = new Set<string>(SW_DESCRIPTION_COMPRESSED_VALUES);
const diskpartLabeltypeValues = new Set<string>(SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES);
const filesystemValues = new Set<string>(SW_DESCRIPTION_FILESYSTEM_VALUES);
const propertyTypeValues = new Set<string>(SW_DESCRIPTION_PROPERTY_TYPE_VALUES);
const PROPERTY_TYPE_VALUES_MSG = formatAllowedValues(SW_DESCRIPTION_PROPERTY_TYPE_VALUES, true);
const zckLogLevelValues = new Set<string>(SW_DESCRIPTION_ZCKLOGLEVEL_VALUES);
const ZCKLOGLEVEL_VALUES_MSG = formatAllowedValues(SW_DESCRIPTION_ZCKLOGLEVEL_VALUES, true);
const strtoboolValues = new Set<string>(SW_DESCRIPTION_STRTOBOOL_VALUES);
const STRTOBOOL_VALUES_MSG = formatAllowedValues(SW_DESCRIPTION_STRTOBOOL_VALUES, true);
// Pre-computed error message strings
const DISKPART_LABELTYPE_VALUES_MSG = formatAllowedValues(SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES);
const FILESYSTEM_VALUES_MSG = formatAllowedValues(SW_DESCRIPTION_FILESYSTEM_VALUES);
const COMPRESSED_VALUES_MSG = formatAllowedValues(SW_DESCRIPTION_COMPRESSED_VALUES);
const TYPE_VALUES_MSG = Object.fromEntries(
	Object.entries(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION).map(([k, v]) => [k, formatAllowedValues(v)])
) as unknown as Readonly<Record<SwDescriptionTypeSection, string>>;
const DISKPART_PARTITION_KEY_REGEX = /^partition-\d+$/;

function formatAllowedValues(values: readonly string[], quoteValues = false): string {
	if (quoteValues) {
		return values.map(value => `"${value}"`).join(', ');
	}
	return values.join(', ');
}

// Validation configuration - maps property keys to their validation logic
type ValidationContext = {
	property: LibConfigPropertyNode;
	value: BaseLibConfigNode;
	addWarning: (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => void;
	addError: (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => void;
	section?: SwDescriptionTypeSection;
};

type Validator = (ctx: ValidationContext) => void;

// Validators for entry-level properties (outside `properties = {}` blocks).
const sizeOffsetEntryValidator: Validator = (ctx) => {
	if (ctx.value.type === 'number') {
		return;
	}
	const stringValue = readStringValue(ctx.value);
	if (stringValue !== null && !SW_DESCRIPTION_SIZE_REGEX.test(stringValue)) {
		ctx.addError(ctx.property, l10n.t("'{0}' must be a number or a decimal string with optional K, M, or G suffix.", ctx.property.name));
	} else if (ctx.value.type !== 'string') {
		ctx.addError(ctx.property, l10n.t("'{0}' must be a number or string.", ctx.property.name));
	}
};

// 'fstype' (diskformat handler properties and diskpart partition entries) is passed to
// SWUpdate's diskformat_mkfs(), which only supports SW_DESCRIPTION_FILESYSTEM_VALUES.
// Note: the 'filesystem' key (files-section device mount) accepts any Linux mount type
// and is intentionally not validated against this list.
const fstypeValidator: Validator = (ctx) => {
	const sv = readStringValue(ctx.value);
	if (sv === null) {
		ctx.addWarning(ctx.property, l10n.t("Expected string value for '{0}'.", ctx.property.name));
		return;
	}
	if (!filesystemValues.has(sv)) {
		ctx.addWarning(ctx.property, l10n.t("Unsupported fstype. Expected one of: {0}.", FILESYSTEM_VALUES_MSG));
	}
};

const entryValidators = new Map<string, Validator>([
	['compressed', (ctx) => {
		if (ctx.value.type === 'string') {
			const sv = readStringValue(ctx.value)!;
			if (!compressedValues.has(sv)) {
				ctx.addWarning(ctx.property, l10n.t("Unsupported compression. Expected one of: {0}.", COMPRESSED_VALUES_MSG));
			}
		} else if (ctx.value.type !== 'boolean') {
			ctx.addWarning(ctx.property, l10n.t("Expected string or boolean value for 'compressed'."));
		}
	}],
	['encrypted', (ctx) => {
		if (ctx.value.type !== 'boolean' && ctx.value.type !== 'string') {
			ctx.addWarning(ctx.property, l10n.t("Expected string or boolean value for 'encrypted'."));
		}
	}],
	['update-type', (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && stringValue.trim().length === 0) {
			ctx.addWarning(ctx.property, l10n.t("'update-type' should not be empty."));
		}
	}],
	['sha256', (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && !SW_DESCRIPTION_HEX_64_REGEX.test(stringValue)) {
			ctx.addWarning(ctx.property, l10n.t("'sha256' should be a 64-character hexadecimal string or a function call like $swupdate_get_sha256(...)."));
		}
	}],
	['ivt', (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && !SW_DESCRIPTION_IVT_REGEX.test(stringValue)) {
			ctx.addWarning(ctx.property, l10n.t("'ivt' should be a 32-character hexadecimal string or a function call like $function_name(...)."));
		}
	}],
	['aes-key', (ctx) => {
		const stringValue = readStringValue(ctx.value);
		if (stringValue !== null && !SW_DESCRIPTION_AES_KEY_REGEX.test(stringValue)) {
			ctx.addWarning(ctx.property, l10n.t("'aes-key' should be a 32/48/64-character hexadecimal string or a function call like $function_name(...)."));
		}
	}],
	['hardware-compatibility', (ctx) => {
		if (ctx.value.type !== 'array') {
			ctx.addWarning(ctx.property, l10n.t("Expected array value for 'hardware-compatibility'."));
		} else {
			const arrayItems = readArrayChildren(ctx.value as ArrayLibConfigNode);
			for (const item of arrayItems) {
				if (item.type !== 'string') {
					ctx.addWarning(ctx.property, l10n.t("'hardware-compatibility' array should contain only strings."));
					break;
				}
			}
		}
	}],
	['ref', (ctx) => {
		if (ctx.value.type !== 'string') {
			ctx.addWarning(ctx.property, l10n.t("Expected string value for 'ref'."));
		}
	}],
	['fstype', fstypeValidator],
	['offset', sizeOffsetEntryValidator],
	['size', sizeOffsetEntryValidator],
	['type', (ctx) => {
		if (!ctx.section) { return; }
		const sv = readStringValue(ctx.value)!;
		if (!SW_DESCRIPTION_TYPE_VALUE_SETS_BY_SECTION[ctx.section].has(sv)) {
			ctx.addWarning(ctx.property, l10n.t("Unsupported type for '{0}'. Expected one of: {1}.", ctx.section, TYPE_VALUES_MSG[ctx.section]));
		}
	}],
]);

const strtoboolPropertyValidator: Validator = ({ property, value, addWarning }) => {
	const sv = readStringValue(value);
	if (sv === null || !strtoboolValues.has(sv)) {
		addWarning(property, l10n.t("'{0}' must be one of: {1}.", property.name, STRTOBOOL_VALUES_MSG));
	}
};

const numericPropertyValidator: Validator = ({ property, value, addWarning }) => {
	const sv = readStringValue(value);
	if (sv === null || !SW_DESCRIPTION_SIZE_SCALAR_REGEX.test(sv)) {
		addWarning(property, l10n.t("'{0}' must be a decimal number, external variable (@@var@@), or function call.", property.name));
	}
};

// Size-valued properties parsed via ustrtoull() — accept an optional K/M/G suffix.
const sizePropertyValidator: Validator = ({ property, value, addWarning }) => {
	const sv = readStringValue(value);
	if (sv === null || !SW_DESCRIPTION_SIZE_REGEX.test(sv)) {
		addWarning(property, l10n.t("'{0}' must be a decimal number with optional K, M, or G suffix, external variable (@@var@@), or function call.", property.name));
	}
};
// Free-form string properties (device names, commands, filenames, labels, Lua
// function names, UUIDs, URLs, …); only flag an empty scalar value.
const nonEmptyStringPropertyValidator: Validator = ({ property, value, addWarning }) => {
	const sv = readStringValue(value);
	if (sv !== null && sv.trim().length === 0) {
		addWarning(property, l10n.t("'{0}' should not be empty.", property.name));
	}
};
const propertiesBlockValidatorMap = new Map<string, Validator>([
	...SW_DESCRIPTION_STRTOBOOL_KEYS.map(k => [k, strtoboolPropertyValidator] as [string, Validator]),
	...SW_DESCRIPTION_NUMERIC_PROPERTY_KEYS.map(k => [k, numericPropertyValidator] as [string, Validator]),
	['fstype', fstypeValidator],
	// copy_handler 'type' property: selects pre- vs post-install. Only these two are accepted.
	['type', ({ property, value, addWarning }) => {
		const sv = readStringValue(value);
		if (sv === null || !propertyTypeValues.has(sv)) {
			addWarning(property, l10n.t("Property 'type' must be one of: {0}.", PROPERTY_TYPE_VALUES_MSG));
		}
	}],
	...SW_DESCRIPTION_SIZE_PROPERTY_KEYS.map(k => [k, sizePropertyValidator] as [string, Validator]),
	// readback_handler 'sha256' property: 64-char hex digest (or a $function()).
	['sha256', ({ property, value, addWarning }) => {
		const sv = readStringValue(value);
		if (sv === null || !SW_DESCRIPTION_HEX_64_REGEX.test(sv)) {
			addWarning(property, l10n.t("'sha256' should be a 64-character hexadecimal string or a function call like $swupdate_get_sha256(...)."));
		}
	}],
	// delta_handler 'zckloglevel' property: fixed enum of log levels.
	['zckloglevel', ({ property, value, addWarning }) => {
		const sv = readStringValue(value);
		if (sv === null || !zckLogLevelValues.has(sv)) {
			addWarning(property, l10n.t("Property 'zckloglevel' must be one of: {0}.", ZCKLOGLEVEL_VALUES_MSG));
		}
	}],
	...SW_DESCRIPTION_STRING_PROPERTY_KEYS.map(k => [k, nonEmptyStringPropertyValidator] as [string, Validator]),
	['labeltype', ({ property, value, addError, section }) => {
		if (section === 'partitions') {
			const sv = readStringValue(value);
			if (sv === null || !diskpartLabeltypeValues.has(sv.toLowerCase())) {
				addError(property, l10n.t("Unsupported labeltype. Expected one of: {0}.", DISKPART_LABELTYPE_VALUES_MSG));
			}
		}
	}]
]);

const booleanEntryValidator: Validator = ({ property, value, addWarning }) => {
	if (value.type !== 'boolean') {
		addWarning(property, l10n.t("Expected boolean value for '{0}'.", property.name));
	}
};

const stringEntryValidator: Validator = ({ property, value, addWarning }) => {
	if (value.type !== 'string') {
		addWarning(property, l10n.t("Expected string value for '{0}'.", property.name));
	}
};

const entryValidatorMap = new Map<string, Validator>();

for (const k of SW_DESCRIPTION_BOOLEAN_KEYS) {
	entryValidatorMap.set(k, booleanEntryValidator);
}

for (const k of SW_DESCRIPTION_STRING_KEYS) {
	if (entryValidators.has(k)) {
		const specific = entryValidators.get(k)!;
		entryValidatorMap.set(k, (ctx) => {
			if (ctx.value.type !== 'string') {
				ctx.addWarning(ctx.property, l10n.t("Expected string value for '{0}'.", ctx.property.name));
				return;
			}
			specific(ctx);
		});
	} else {
		entryValidatorMap.set(k, stringEntryValidator);
	}
}

for (const [k, v] of entryValidators) {
	if (!entryValidatorMap.has(k)) {
		entryValidatorMap.set(k, v);
	}
}

// No-op marker for known-valid entry keys that need no content validation.
// Presence in the map is enough to suppress the unknown-key warning.
const knownEntryKey: Validator = () => { /* valid key, no content checks */ };
for (const k of SW_DESCRIPTION_ENTRY_KNOWN_KEYS) {
	if (!entryValidatorMap.has(k)) {
		entryValidatorMap.set(k, knownEntryKey);
	}
}

export interface PlainPosition { line: number; character: number; }
export interface PlainRange { start: PlainPosition; end: PlainPosition; }
export interface PlainDiagnostic { range: PlainRange; message: string; severity: 'error' | 'warning'; }

export function getSwDescriptionSemanticDiagnostics(
	positionAt: (offset: number) => PlainPosition,
	rootSettings: ParsedLibconfigNode[]
): PlainDiagnostic[] {
	const diagnostics: PlainDiagnostic[] = [];

	const addDiagnostic = (node: LibConfigPropertyNode | BaseLibConfigNode, message: string, severity: 'error' | 'warning') => {
		const startOffset = node.offset;
		const endOffset = node.offset + Math.max(node.length, 1);
		diagnostics.push({ range: { start: positionAt(startOffset), end: positionAt(endOffset) }, message, severity });
	};

	const addWarning = (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => {
		addDiagnostic(node, message, 'warning');
	};

	const addError = (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => {
		addDiagnostic(node, message, 'error');
	};

	const validateProperty = (property: LibConfigPropertyNode, section?: SwDescriptionTypeSection, isInsidePropertiesBlock?: boolean, siblingProperties?: LibConfigPropertyNode[]) => {
		const key = property.name.toLowerCase();
		// For property nodes, the value is in children[0] after LibConfig serialization fix.
		const value = getPropertyValue(property);
		if (!value) {
			return;
		}

		// External variables and function calls are valid for any string property — skip content validation.
		if (value.type === 'string') {
			const sv = readStringValue(value);
			if (sv !== null && isExternalOrFunctionRef(sv)) {
				return;
			}
		}

		if (isInsidePropertiesBlock) {
			// Properties block values must be strings or arrays (e.g. partition-N).
			if (value.type !== 'string' && value.type !== 'array' && value.type !== 'list') {
				addWarning(property, l10n.t("Expected string value for '{0}'.", property.name));
				return;
			}
			const pbValidator = propertiesBlockValidatorMap.get(key);
			if (pbValidator) {
				pbValidator({ property, value, addWarning, addError, section });
			} else if (section === 'partitions' && DISKPART_PARTITION_KEY_REGEX.test(key)) {
				validateDiskpartPartitionProperty(property, value, addWarning, addError, section, siblingProperties);
			} else if (section) {
				addWarning(property, l10n.t("Unknown property '{0}'. Check for typos.", property.name));
			}
		} else {
			entryValidatorMap.get(key)?.({ property, value, addWarning, addError, section });
			if (section && !entryValidatorMap.has(key)) {
				addWarning(property, l10n.t("Unknown property '{0}'. Check for typos.", property.name));
			}
		}
	};

	walkProperties(rootSettings as LibConfigPropertyNode[], validateProperty, undefined);
	return diagnostics;
}

function walkProperties(properties: LibConfigPropertyNode[], visitor: (property: LibConfigPropertyNode, section?: SwDescriptionTypeSection, isInsidePropertiesBlock?: boolean, siblingProperties?: LibConfigPropertyNode[]) => void, currentSection?: SwDescriptionTypeSection, isInsidePropertiesBlock?: boolean): void {
	for (const property of properties) {
		const propertyName = property.name.toLowerCase();
		// Check if this property defines a new section
		const newSection = isSwDescriptionTypeSection(propertyName) ? propertyName : currentSection;

		visitor(property, currentSection, isInsidePropertiesBlock, properties);
		// For property nodes, the value might be in children[0] after LibConfig serialization fix.
		const valueNode = getPropertyValue(property);
		// Children of a 'properties' sub-object are handler-specific, so suppress unknown-key check there.
		const childIsInsidePropertiesBlock = isInsidePropertiesBlock || propertyName === 'properties';
		walkNode(valueNode, visitor, newSection, childIsInsidePropertiesBlock);
	}
}

function getPropertyValue(property: LibConfigPropertyNode): BaseLibConfigNode | null {
	return property.value ?? property.children?.[0] ?? null;
}

function walkNode(node: BaseLibConfigNode | null, visitor: (property: LibConfigPropertyNode, section?: SwDescriptionTypeSection, isInsidePropertiesBlock?: boolean, siblingProperties?: LibConfigPropertyNode[]) => void, currentSection?: SwDescriptionTypeSection, isInsidePropertiesBlock?: boolean): void {
	if (!node) {
		return;
	}

	switch (node.type) {
		case 'object':
			walkProperties((node as ObjectLibConfigNode).children, visitor, currentSection, isInsidePropertiesBlock);
			break;
		case 'list':
			for (const child of (node as ListLibConfigNode).children) {
				// Each list item is a fresh entry, so reset the properties-block suppression.
				walkNode(child, visitor, currentSection, false);
			}
			break;
		case 'array':
			for (const child of (node as ArrayLibConfigNode).children) {
				walkNode(child, visitor, currentSection, isInsidePropertiesBlock);
			}
			break;
		default:
			break;
	}
}

function isValidStringRef(sv: string, valueRegex: RegExp): boolean {
	return valueRegex.test(sv) ||
		isExternalOrFunctionRef(sv);
}

function readStringValue(node: BaseLibConfigNode): string | null {
	if (node.type !== 'string') {
		return null;
	}
	return typeof node.value === 'string' ? node.value : null;
}

function readArrayChildren(node: ArrayLibConfigNode): BaseLibConfigNode[] {
	return node.children ?? [];
}

function isExternalOrFunctionRef(value: string): boolean {
	return SW_DESCRIPTION_EXTERNAL_VARIABLE_REGEX.test(value) || SW_DESCRIPTION_FUNCTION_REGEX.test(value);
}

function parseDiskpartPartitionEntry(entry: string): { key: string; value: string } | null {
	const separatorIndex = entry.indexOf('=');
	if (separatorIndex <= 0) {
		return null;
	}

	return {
		key: entry.slice(0, separatorIndex),
		value: entry.slice(separatorIndex + 1)
	};
}

function validateDiskpartPartitionProperty(
	property: LibConfigPropertyNode,
	value: BaseLibConfigNode,
	addWarning: (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => void,
	addError: (node: LibConfigPropertyNode | BaseLibConfigNode, message: string) => void,
	section?: SwDescriptionTypeSection,
	siblingProperties?: LibConfigPropertyNode[]
): void {
	if (value.type !== 'array') {
		addWarning(property, l10n.t("Expected array value for '{0}'.", property.name));
		return;
	}

	// Resolve labeltype from sibling properties in the same diskpart properties block.
	let labelType: string | undefined;
	if (siblingProperties) {
		const ltProp = siblingProperties.find(p => p.name.toLowerCase() === 'labeltype');
		if (ltProp) {
			const ltValue = getPropertyValue(ltProp);
			labelType = ltValue ? (readStringValue(ltValue)?.toLowerCase() ?? undefined) : undefined;
		}
	}

	for (const item of readArrayChildren(value as ArrayLibConfigNode)) {
		const entry = readStringValue(item);
		if (entry === null) {
			addWarning(item, l10n.t("Expected string entry in '{0}'.", property.name));
			continue;
		}

		const parsedEntry = parseDiskpartPartitionEntry(entry);
		if (!parsedEntry) {
			continue;
		}

		if (isExternalOrFunctionRef(parsedEntry.value)) {
			if (!SW_DESCRIPTION_DISKPART_PARTITION_ENTRY_KEYS.has(parsedEntry.key)) {
				addWarning(item, l10n.t("Unknown partition entry field '{0}'. Check for typos.", parsedEntry.key));
			}
			continue;
		}

		switch (parsedEntry.key) {
			case 'size':
				if (!isValidStringRef(parsedEntry.value, SW_DESCRIPTION_SIZE_REGEX)) {
					addError(item, l10n.t("Invalid partition 'size' value. Expected a decimal string with optional K, M, or G suffix, or an external variable using @@variable@@ syntax."));
				}
				break;
			case 'flag':
				if (parsedEntry.value !== 'boot') {
					addError(item, l10n.t("Invalid 'flag' value '{0}'. Only 'boot' is supported.", parsedEntry.value));
				}
				break;
			case 'fstype': {
				if (!filesystemValues.has(parsedEntry.value)) {
					addWarning(item, l10n.t("Unsupported fstype. Expected one of: {0}.", FILESYSTEM_VALUES_MSG));
				}
				break;
			}
			case 'type': {
				switch (labelType) {
					case 'gpt':
						if (!SW_DESCRIPTION_DISKPART_TYPE_GUID_REGEX.test(parsedEntry.value)) {
							addWarning(item, l10n.t("GPT partition 'type' must be a GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Got '{0}'.", parsedEntry.value));
						}
						break;
					case 'dos':
						if (!SW_DESCRIPTION_DISKPART_TYPE_DOS_REGEX.test(parsedEntry.value)) {
							addWarning(item, l10n.t("DOS partition 'type' must be a hex byte code (e.g. '83'). Got '{0}'.", parsedEntry.value));
						}
						break;
					default:
						addError(item, l10n.t("Partition entry 'type' requires 'labeltype' to be set to 'gpt' or 'dos'."));
						break;
				}
				break;
			}
			default:
				if (!SW_DESCRIPTION_DISKPART_PARTITION_ENTRY_KEYS.has(parsedEntry.key)) {
					addWarning(item, l10n.t("Unknown partition entry field '{0}'. Check for typos.", parsedEntry.key));
				}
				break;
		}
	}
}
