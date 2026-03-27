// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

import {
	Diagnostic
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
    ParsedLibconfigDocument
} from './parseData';

import {
	swDescriptionPlugin,
	ValidationPluginContext
} from '../swDescription/plugin';

export function doValidation(textDocument: TextDocument, parsedDocument: ParsedLibconfigDocument | undefined): Diagnostic[] {
	if (!parsedDocument) {
		return [];
	}

	const pluginContext: ValidationPluginContext = {
		textDocument,
		parsedDocument
	};
	const diagnostics: Diagnostic[] = [];
	const addedKeys = new Set<string>();
	
	// Deduplication using Set with simple string keys
	// JavaScript Set is optimized for this common pattern
	const addProblem = (problem: Diagnostic) => {
		const key = `${problem.range.start.line}:${problem.range.start.character}:${problem.message}`;
		if (!addedKeys.has(key)) {
			addedKeys.add(key);
			diagnostics.push(problem);
		}
	};

	if (swDescriptionPlugin.supportsDocument(textDocument)) {
		for (const p of swDescriptionPlugin.validate(pluginContext)) {
			addProblem(p);
		}
	}

	return diagnostics;
}
