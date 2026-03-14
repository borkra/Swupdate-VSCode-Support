'use strict';

import {
	CompletionItem
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

export interface CompletionPluginBase {
	includeCompletion: CompletionItem;
	valueCompletions: CompletionItem[];
	statementCompletions: CompletionItem[];
	completionItems: CompletionItem[];
}

export interface CompletionPluginContext {
	textDocument: TextDocument;
	text: string;
	linePrefix: string;
	lineStart: number;
	trimmedPrefix: string;
	base: CompletionPluginBase;
}

export interface CompletionPlugin {
	name: string;
	supports(context: CompletionPluginContext): boolean;
	complete(context: CompletionPluginContext): CompletionItem[];
}
