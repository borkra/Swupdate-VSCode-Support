/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	CompletionItem,
	CompletionItemKind,
	CompletionParams,
	Diagnostic,
	InsertTextFormat,
	ProposedFeatures,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { 
	formatError
} from './utils/runner';

import { LibConfigValidation } from './validation/libConfigValidation';

import {
	getPluginCompletionItems
} from './completion/plugins';


// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

connection.console.log('SERVER STARTED');

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize(() => {
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				triggerCharacters: ['@']
			}
		}
	};
});

connection.onCompletion((params: CompletionParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return [];
	}

	const offset = document.offsetAt(params.position);
	const text = document.getText();
	const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
	const linePrefix = text.slice(lineStart, offset);
	const trimmedPrefix = linePrefix.trim();

	const pluginCompletions = getPluginCompletionItems({
		textDocument: document,
		text,
		linePrefix,
		lineStart,
		trimmedPrefix,
		base: {
			includeCompletion,
			valueCompletions,
			statementCompletions,
			completionItems
		}
	});

	return pluginCompletions || [];
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	triggerValidation(change.document);
});

// a document has closed: clear all diagnostics
documents.onDidClose(event => {
	cleanPendingValidation(event.document);
	connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

const pendingValidationRequests: { [uri: string]: NodeJS.Timeout; } = {};
const validationDelayMs = 500;
const includeCompletion: CompletionItem = {
	label: '@include',
	kind: CompletionItemKind.Snippet,
	insertText: '@include "${1:path}"',
	insertTextFormat: InsertTextFormat.Snippet,
	detail: 'Insert include directive'
};

const valueCompletions: CompletionItem[] = [];
const statementCompletions: CompletionItem[] = [];
const completionItems: CompletionItem[] = [];

function cleanPendingValidation(textDocument: TextDocument): void {
	const request = pendingValidationRequests[textDocument.uri];
	if (request) {
		clearTimeout(request);
		delete pendingValidationRequests[textDocument.uri];
	}
}

function triggerValidation(textDocument: TextDocument): void {
	cleanPendingValidation(textDocument);
	pendingValidationRequests[textDocument.uri] = setTimeout(() => {
		delete pendingValidationRequests[textDocument.uri];
		validateTextDocument(textDocument);
	}, validationDelayMs);
}

function validateTextDocument(textDocument: TextDocument): void {
	const respond = (diagnostics: Diagnostic[]) => {
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
	};
	if (textDocument.getText().length === 0) {
		respond([]); // ignore empty documents
		return;
	}
	const version = textDocument.version;

	const validator = new LibConfigValidation();

	validator.doValidation(textDocument).then(diagnostics => {
		setTimeout(() => {
			const currDocument = documents.get(textDocument.uri);
			if (currDocument && currDocument.version === version) {
				respond(diagnostics); // Send the computed diagnostics to VSCode.
			}
		}, 100);
	}, error => {
		connection.console.error(formatError(`Error while validating ${textDocument.uri}`, error));
	});
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
