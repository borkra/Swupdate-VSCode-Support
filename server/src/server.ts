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
	InsertTextFormat,
	ProposedFeatures,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as l10n from '@vscode/l10n';

import {
	doValidation
} from './validation/libConfigValidation';
import {
	clearParsedDocument,
	getParsedDocument,
	setParsedDocument,
	type ParsedLibconfigDocument,
	type ParsedLibconfigPayload
} from './validation/parseData';

import { isSwDescriptionDocumentUri } from './swDescription/definitions';
import { getSwDescriptionCompletionItems } from './swDescription/completions';


// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
const SWUPDATE_PARSED_NOTIFICATION = 'swupdate/libconfigParsed';

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params) => {
	const l10nUri = (params.initializationOptions as { l10nUri?: string } | undefined)?.l10nUri;
	if (l10nUri) {
		try { l10n.config({ uri: l10nUri }); } catch { /* ignore */ }
	}
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
	const document = documents.get(payload.uri)
		?? TextDocument.create(payload.uri, 'swupdate', payload.version, payload.text);
	sendValidationDiagnostics(document, payload.parsedDocument);
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
	
	if (!(document.languageId === 'swupdate' || isSwDescriptionDocumentUri(document.uri))) {
		return [];
	}

	const trimmedPrefix = linePrefix.trim();
	return getSwDescriptionCompletionItems(text, linePrefix, lineStart, trimmedPrefix, { includeCompletion });
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

const pendingValidationRequests = new Map<string, NodeJS.Timeout>();
const validationDelayMs = 500;
const includeCompletion: CompletionItem = {
	label: '@include',
	kind: CompletionItemKind.Snippet,
	insertText: '@include "${1:path}"',
	insertTextFormat: InsertTextFormat.Snippet,
	detail: 'Insert include directive'
};

function cleanPendingValidation(textDocument: TextDocument): void {
	const request = pendingValidationRequests.get(textDocument.uri);
	if (request) {
		clearTimeout(request);
		pendingValidationRequests.delete(textDocument.uri);
	}
}

function triggerValidation(textDocument: TextDocument): void {
	cleanPendingValidation(textDocument);
	pendingValidationRequests.set(textDocument.uri, setTimeout(() => {
		pendingValidationRequests.delete(textDocument.uri);
		validateTextDocument(textDocument);
	}, validationDelayMs));
}

function formatError(message: string, err: unknown): string {
	const detail = err instanceof Error ? err.stack ?? err.message : String(err);
	return err != null ? `${message}: ${detail}` : message;
}

function sendValidationDiagnostics(document: TextDocument, parsedDocument: ParsedLibconfigDocument): void {
	connection.sendDiagnostics({ uri: document.uri, diagnostics: doValidation(document, parsedDocument) });
}

function validateTextDocument(textDocument: TextDocument): void {
	if (textDocument.getText().length === 0) {
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
		return;
	}
	const version = textDocument.version;
	try {
		const parsedPayload = getParsedDocument(textDocument.uri);
		if (!parsedPayload || parsedPayload.version !== version) {
			connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
			return;
		}
		const currDocument = documents.get(textDocument.uri);
		if (currDocument && currDocument.version === version) {
			sendValidationDiagnostics(textDocument, parsedPayload.parsedDocument);
		}
	} catch (error) {
		connection.console.error(formatError(`Error while validating ${textDocument.uri}`, error));
	}
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
