/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
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

import {
	doValidation
} from './validation/libConfigValidation';
import {
	clearParsedDocument,
	getParsedDocument,
	setParsedDocument,
	type ParsedLibconfigPayload
} from './validation/parseData';

import {
	getPluginCompletionItems
} from './completion/plugins';


// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
const SWUPDATE_PARSED_NOTIFICATION = 'swupdate/libconfigParsed';

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

connection.onNotification(SWUPDATE_PARSED_NOTIFICATION, (payload: ParsedLibconfigPayload) => {
	setParsedDocument(payload);
	validateParsedPayload(payload);
});

connection.onCompletion((params: CompletionParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return [];
	}

	const offset = document.offsetAt(params.position);
	const text = document.getText();
	
	// Optimize line boundary search by avoiding Math.max when not needed
	const searchStart = offset > 0 ? offset - 1 : 0;
	const lineStart = text.lastIndexOf('\n', searchStart) + 1;
	const linePrefix = text.slice(lineStart, offset);
	
	// Early return for empty prefix to avoid unnecessary work
	const trimmedPrefix = linePrefix.trim();
	if (trimmedPrefix.length === 0 && !linePrefix.includes('=') && !linePrefix.includes(':')) {
		// For completely empty lines, only basic completions make sense
		return getPluginCompletionItems({
			textDocument: document,
			text,
			linePrefix,
			lineStart,
			trimmedPrefix,
			base: {
				includeCompletion
			}
		}) || [];
	}

	const pluginCompletions = getPluginCompletionItems({
		textDocument: document,
		text,
		linePrefix,
		lineStart,
		trimmedPrefix,
		base: {
			includeCompletion
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
	clearParsedDocument(event.document.uri);
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
	try {
		const parsedPayload = getParsedDocument(textDocument.uri);
		if (!parsedPayload || parsedPayload.version !== version) {
			respond([]);
			return;
		}

		const diagnostics = doValidation(textDocument, parsedPayload.parsedDocument);
		const currDocument = documents.get(textDocument.uri);
		if (currDocument && currDocument.version === version) {
			respond(diagnostics);
		}
	} catch (error) {
		connection.console.error(formatError(`Error while validating ${textDocument.uri}`, error));
	}
}

function validateParsedPayload(payload: ParsedLibconfigPayload): void {
	const document = documents.get(payload.uri)
		?? TextDocument.create(payload.uri, 'swupdate', payload.version, payload.text);

	const diagnostics = doValidation(document, payload.parsedDocument);
	connection.sendDiagnostics({ uri: payload.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
