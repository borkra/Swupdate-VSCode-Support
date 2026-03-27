// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

import {
	CompletionItem,
	Diagnostic
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
	isSwDescriptionDocumentUri
} from './definitions';

import {
	getSwDescriptionCompletionItems
} from './completions';

import {
	getSwDescriptionSemanticDiagnostics
} from './validation';

import {
	ParsedLibconfigDocument
} from '../validation/parseData';

export interface CompletionPluginBase {
	includeCompletion: CompletionItem;
}

export interface CompletionPluginContext {
	textDocument: TextDocument;
	text: string;
	linePrefix: string;
	lineStart: number;
	trimmedPrefix: string;
	base: CompletionPluginBase;
}

export interface ValidationPluginContext {
	textDocument: TextDocument;
	parsedDocument: ParsedLibconfigDocument;
}

export interface SwDescriptionPlugin {
	name: string;
	supportsDocument(textDocument: TextDocument): boolean;
	complete(context: CompletionPluginContext): CompletionItem[];
	validate(context: ValidationPluginContext): Diagnostic[];
}

export const swDescriptionPlugin: SwDescriptionPlugin = {
	name: 'sw-description',
	supportsDocument: (textDocument: TextDocument): boolean => {
		return textDocument.languageId === 'swupdate' || isSwDescriptionDocumentUri(textDocument.uri);
	},
	complete: (context: CompletionPluginContext): CompletionItem[] => {
		return getSwDescriptionCompletionItems(
			context.text,
			context.linePrefix,
			context.lineStart,
			context.trimmedPrefix,
			context.base
		);
	},
	validate: (context: ValidationPluginContext): Diagnostic[] => {
		return getSwDescriptionSemanticDiagnostics(context.textDocument, context.parsedDocument.rootSettings);
	}
};
