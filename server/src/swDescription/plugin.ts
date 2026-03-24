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
	CompletionPluginContext
} from '../completion/plugins/completionPlugin';

import {
	ValidationPluginContext
} from '../validation/plugins/validatorPlugin';

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
