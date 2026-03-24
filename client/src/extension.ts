/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

interface ParsedLibconfigNode {
	type: 'object' | 'array' | 'list' | 'property' | 'string' | 'number' | 'boolean';
	offset: number;
	length: number;
	value: string | boolean | number | null;
	children?: ParsedLibconfigNode[];
	name?: string;
}

interface ParsedLibconfigDocument {
	syntaxErrors: SerializedDiagnostic[];
	rootSettings: ParsedLibconfigNode[];
}

interface ParsedLibconfigPayload {
	uri: string;
	version: number;
	text: string;
	parsedDocument: ParsedLibconfigDocument;
}

interface LibconfigExtensionApi {
	apiVersion: 1;
	getParsedDocument(uri: string, text: string): Promise<ParsedLibconfigDocument>;
	getCompletionItems(uri: string, text: string, offset: number): Promise<LibconfigCompletionEntry[]>;
}

interface LibconfigCompletionEntry {
	label: string;
	kind?: number;
	insertText?: string;
	detail?: string;
	documentation?: string;
}

interface SerializedPosition {
	line?: number;
	character?: number;
}

interface SerializedRange {
	start?: SerializedPosition;
	end?: SerializedPosition;
}

interface SerializedDiagnostic {
	range?: SerializedRange;
	message?: string;
	severity?: number;
	source?: string;
}

const SWUPDATE_PARSED_NOTIFICATION = 'swupdate/libconfigParsed';
const SWUPDATE_DOCUMENT_SELECTOR = [
	{ scheme: 'file', language: 'swupdate' },
	{ scheme: 'untitled', language: 'swupdate' }
] as const;

// Lookup table for severity conversion - Language Server Protocol to VS Code API
const severityMap = new Map<number, vscode.DiagnosticSeverity>([
	[1, vscode.DiagnosticSeverity.Error],
	[2, vscode.DiagnosticSeverity.Warning],
	[3, vscode.DiagnosticSeverity.Information],
	[4, vscode.DiagnosticSeverity.Hint]
]);

export async function activate(context: ExtensionContext) {
	if (client) {
		return;
	}

	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the SWUpdate language server for documents in swupdate mode.
		documentSelector: SWUPDATE_DOCUMENT_SELECTOR as unknown as LanguageClientOptions['documentSelector']
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'SwupdateServer',
		'Language Server for SWUpdate sw-description Documents',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server.
	try {
		await client.start();
		const libconfigApiPromise = resolveLibconfigApi();
		registerLibconfigBridge(context, libconfigApiPromise);
		registerLibconfigCompletionBridge(context, libconfigApiPromise);
	} catch (err) {
		vscode.window.showErrorMessage(`SWUpdate language server failed to start: ${err}`);
	}
}

function registerLibconfigBridge(
	context: ExtensionContext,
	libconfigApiPromise: Promise<LibconfigExtensionApi | undefined>
): void {
	const syntaxDiagnostics = vscode.languages.createDiagnosticCollection('swupdate-libconfig');
	const syncedVersions = new Map<string, number>();
	const requestedVersions = new Map<string, number>();
	const pendingSyncs = new Map<string, NodeJS.Timeout>();
	const MAX_CACHE_SIZE = 50; // Limit memory usage
	const SYNC_DEBOUNCE_MS = 150;
	context.subscriptions.push(syntaxDiagnostics);

	const clearDocumentState = (documentUri: string, document?: vscode.Uri): void => {
		if (document) {
			syntaxDiagnostics.delete(document);
		}
		syncedVersions.delete(documentUri);
		requestedVersions.delete(documentUri);
		const pending = pendingSyncs.get(documentUri);
		if (pending) {
			clearTimeout(pending);
			pendingSyncs.delete(documentUri);
		}
	};

	// Implement LRU-style cache management to prevent unbounded memory growth
	const enforceMapSizeLimit = (map: Map<string, number>): void => {
		if (map.size > MAX_CACHE_SIZE) {
			const keysToDelete = Array.from(map.keys()).slice(0, map.size - MAX_CACHE_SIZE);
			keysToDelete.forEach(key => map.delete(key));
		}
	};

	const syncDocumentImmediate = async (document: vscode.TextDocument): Promise<void> => {
		if (!client) {
			return;
		}

		const documentUri = document.uri.toString();

		if (!isSupportedDocument(document)) {
			clearDocumentState(documentUri, document.uri);
			return;
		}
		
		const requestedVersion = document.version;
		const lastSyncedVersion = syncedVersions.get(documentUri);
		if (lastSyncedVersion === requestedVersion) {
			return;
		}
		// Already in-flight for this exact version — skip to avoid duplicate work
		if (requestedVersions.get(documentUri) === requestedVersion) {
			return;
		}
		requestedVersions.set(documentUri, requestedVersion);
		enforceMapSizeLimit(requestedVersions);

		const api = await libconfigApiPromise;
		if (!api) {
			return;
		}

		try {
			const parsedDocument = await api.getParsedDocument(documentUri, document.getText());
			// Check if a newer version was requested while we were parsing
			if (requestedVersions.get(documentUri) !== requestedVersion) {
				return;
			}
			syntaxDiagnostics.set(document.uri, toVsCodeDiagnostics(parsedDocument.syntaxErrors));
			syncedVersions.set(documentUri, requestedVersion);
			enforceMapSizeLimit(syncedVersions);
			
			const payload: ParsedLibconfigPayload = {
				uri: documentUri,
				version: requestedVersion,
				text: document.getText(),
				parsedDocument
			};

			client?.sendNotification(SWUPDATE_PARSED_NOTIFICATION, payload);
		} catch (error) {
		}
	};

	// Debounced version for change events to reduce API calls during rapid typing
	const syncDocument = (document: vscode.TextDocument, immediate: boolean = false): void => {
		const documentUri = document.uri.toString();
		
		// Clear any pending sync
		const pending = pendingSyncs.get(documentUri);
		if (pending) {
			clearTimeout(pending);
		}

		if (immediate) {
			pendingSyncs.delete(documentUri);
			void syncDocumentImmediate(document);
		} else {
			// Debounce for change events
			const timeout = setTimeout(() => {
				pendingSyncs.delete(documentUri);
				void syncDocumentImmediate(document);
			}, SYNC_DEBOUNCE_MS);
			pendingSyncs.set(documentUri, timeout);
		}
	};

	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
		syncDocument(document, true);
	}));

	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
		syncDocument(event.document, false); // Debounced
	}));

	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
		syncDocument(document, true); // Immediate on save
	}));

	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => {
		clearDocumentState(document.uri.toString(), document.uri);
	}));

	// Trigger sync when visible text editor changes to catch language mode switches
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			syncDocument(editor.document, true);
		}
	}));

	const activeDocument = vscode.window.activeTextEditor?.document;
	if (activeDocument) {
		syncDocument(activeDocument, true);
	}

	// Cleanup function for pending syncs
	context.subscriptions.push({
		dispose: () => {
			// Clear all pending timeouts on deactivation
			for (const timeout of pendingSyncs.values()) {
				clearTimeout(timeout);
			}
			pendingSyncs.clear();
			syncedVersions.clear();
			requestedVersions.clear();
		}
	});
}

function registerLibconfigCompletionBridge(
	context: ExtensionContext,
	libconfigApiPromise: Promise<LibconfigExtensionApi | undefined>
): void {
	const completionProvider = vscode.languages.registerCompletionItemProvider(
		SWUPDATE_DOCUMENT_SELECTOR as vscode.DocumentSelector,
		{
			provideCompletionItems: async (document, position) => {
				const api = await libconfigApiPromise;
				if (!api) {
					return [];
				}

				const offset = document.offsetAt(position);
				const entries = await api.getCompletionItems(document.uri.toString(), document.getText(), offset);
				return entries.map((entry) => {
					const item = new vscode.CompletionItem(entry.label, entry.kind as vscode.CompletionItemKind | undefined);
					if (entry.insertText) {
						item.insertText = entry.insertText;
					}
					if (entry.detail) {
						item.detail = entry.detail;
					}
					if (entry.documentation) {
						item.documentation = entry.documentation;
					}
					return item;
				});
			}
		}
	);

	context.subscriptions.push(completionProvider);
}

async function resolveLibconfigApi(): Promise<LibconfigExtensionApi | undefined> {
	const extension = vscode.extensions.getExtension<LibconfigExtensionApi>('borkra.libconfig-lang');
	if (!extension) {
		vscode.window.showErrorMessage('SWUpdate requires LibConfig extension borkra.libconfig-lang.');
		return undefined;
	}

	const api = await extension.activate();
	if (!api || api.apiVersion !== 1 || typeof api.getCompletionItems !== 'function') {
		vscode.window.showErrorMessage('LibConfig extension API is unavailable or incompatible: getCompletionItems is required.');
		return undefined;
	}

	return api;
}

function isSupportedDocument(document: vscode.TextDocument): boolean {
	return vscode.languages.match(SWUPDATE_DOCUMENT_SELECTOR as vscode.DocumentSelector, document) > 0;
}

function toVsCodeDiagnostics(syntaxErrors: SerializedDiagnostic[]): vscode.Diagnostic[] {
	return syntaxErrors.flatMap((diagnostic) => {
		const start = diagnostic.range?.start;
		const end = diagnostic.range?.end;
		if (!start || !end || typeof diagnostic.message !== 'string') {
			return [];
		}

		const range = new vscode.Range(
			new vscode.Position(start.line ?? 0, start.character ?? 0),
			new vscode.Position(end.line ?? 0, end.character ?? 0)
		);
		const severity = diagnostic.severity !== undefined 
			? severityMap.get(diagnostic.severity) ?? vscode.DiagnosticSeverity.Error
			: vscode.DiagnosticSeverity.Error;
		const converted = new vscode.Diagnostic(range, diagnostic.message, severity);
		converted.source = diagnostic.source ?? 'libconfig';
		return [converted];
	});
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	const activeClient = client;
	client = undefined;
	return activeClient.stop();
}
