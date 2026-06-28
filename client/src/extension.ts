/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import * as l10n from '@vscode/l10n';

import {
	type LibconfigCompletionEntry,
	type LibconfigExtensionApi,
	type SerializedDiagnostic
} from './libconfigApi';
import { getSwDescriptionCompletionItems } from './swDescription/completions';
import { getSwDescriptionSemanticDiagnostics, type PlainDiagnostic } from './swDescription/validation';

const SWUPDATE_DOCUMENT_SELECTOR = [
	{ scheme: 'file', language: 'swupdate' },
	{ scheme: 'untitled', language: 'swupdate' }
] as const;
const INCLUDE_COMPLETION = createIncludeCompletion();

let outputChannel: vscode.OutputChannel | undefined;

// Lookup table for severity conversion - Language Server Protocol to VS Code API
const severityMap = new Map<number, vscode.DiagnosticSeverity>([
	[1, vscode.DiagnosticSeverity.Error],
	[2, vscode.DiagnosticSeverity.Warning],
	[3, vscode.DiagnosticSeverity.Information],
	[4, vscode.DiagnosticSeverity.Hint]
]);

export function activate(context: ExtensionContext): void {
	if (vscode.l10n.uri) {
		l10n.config({ uri: vscode.l10n.uri.toString() });
	}
	outputChannel = vscode.window.createOutputChannel('SWUpdate');
	context.subscriptions.push(outputChannel);
	const libconfigApiPromise = resolveLibconfigApi(context);
	registerCompletionProvider(context, libconfigApiPromise);
	registerLibconfigBridge(context, libconfigApiPromise);
}

function registerCompletionProvider(
	context: ExtensionContext,
	libconfigApiPromise: Promise<LibconfigExtensionApi | undefined>
): void {
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
		SWUPDATE_DOCUMENT_SELECTOR as vscode.DocumentSelector,
		{
			async provideCompletionItems(document, position) {
				if (!isSupportedDocument(document)) {
					return [];
				}

				const offset = document.offsetAt(position);
				const text = document.getText();
				const searchStart = offset > 0 ? offset - 1 : 0;
				const lineStart = text.lastIndexOf('\n', searchStart) + 1;
				const linePrefix = text.slice(lineStart, offset);
				const trimmedPrefix = linePrefix.trim();

				const swupdateItems = getSwDescriptionCompletionItems(text, linePrefix, lineStart, trimmedPrefix, {
					includeCompletion: INCLUDE_COMPLETION
				});
				const libconfigItems = await getLibconfigCompletionItems(libconfigApiPromise, document, text, offset);

				return dedupeCompletionItems([
					...swupdateItems,
					...libconfigItems
				]);
			}
		},
		'@'
	));
}

function registerLibconfigBridge(
	context: ExtensionContext,
	libconfigApiPromise: Promise<LibconfigExtensionApi | undefined>
): void {
	const syntaxDiagnostics = vscode.languages.createDiagnosticCollection('swupdate-libconfig');
	const semanticDiagnostics = vscode.languages.createDiagnosticCollection('swupdate');
	const syncedVersions = new Map<string, number>();
	const requestedVersions = new Map<string, number>();
	const pendingSyncs = new Map<string, NodeJS.Timeout>();
	const SYNC_DEBOUNCE_MS = 150;
	context.subscriptions.push(syntaxDiagnostics, semanticDiagnostics);

	// Server lifecycle: acquire a handle while any sw-description file is open.
	let swDocCount = vscode.workspace.textDocuments.filter(d => isSupportedDocument(d)).length;
	let libconfigHandle: { dispose(): void } | undefined;

	const tryAcquireHandle = (): void => {
		if (libconfigHandle) { return; }
		void libconfigApiPromise.then(api => {
			if (api && swDocCount > 0 && !libconfigHandle && typeof api.acquireHandle === 'function') {
				libconfigHandle = api.acquireHandle();
			}
		});
	};

	const releaseHandle = (): void => {
		libconfigHandle?.dispose();
		libconfigHandle = undefined;
	};

	if (swDocCount > 0) { tryAcquireHandle(); }

	const clearDocumentState = (documentUri: string, document?: vscode.Uri): void => {
		if (document) {
			syntaxDiagnostics.delete(document);
			semanticDiagnostics.delete(document);
		}
		syncedVersions.delete(documentUri);
		requestedVersions.delete(documentUri);
		const pending = pendingSyncs.get(documentUri);
		if (pending) {
			clearTimeout(pending);
			pendingSyncs.delete(documentUri);
		}
	};

	const syncDocumentImmediate = async (document: vscode.TextDocument): Promise<void> => {
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
		// Already in-flight for this exact version - skip to avoid duplicate work
		if (requestedVersions.get(documentUri) === requestedVersion) {
			return;
		}
		requestedVersions.set(documentUri, requestedVersion);

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
			syntaxDiagnostics.set(document.uri, syntaxDiagnosticsToVsCode(parsedDocument.syntaxErrors));
			semanticDiagnostics.set(document.uri, semanticDiagnosticsToVsCode(getSwDescriptionSemanticDiagnostics(document.positionAt.bind(document), parsedDocument.rootSettings)));
			syncedVersions.set(documentUri, requestedVersion);
		} catch (error) {
			logError(`Failed to parse/sync ${documentUri}`, error);
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
		if (isSupportedDocument(document)) {
			swDocCount++;
			if (swDocCount === 1) { tryAcquireHandle(); }
		}
		syncDocument(document, true);
	}));

	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
		syncDocument(event.document, false); // Debounced
	}));

	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
		syncDocument(document, true); // Immediate on save
	}));

	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => {
		if (isSupportedDocument(document)) {
			swDocCount--;
			if (swDocCount === 0) { releaseHandle(); }
		}
		clearDocumentState(document.uri.toString(), document.uri);
	}));

	// Trigger sync when visible text editor changes to catch language mode switches
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			syncDocument(editor.document, true);
		}
	}));

	for (const document of vscode.workspace.textDocuments) {
		syncDocument(document, true);
	}

	// Cleanup function for pending syncs
	context.subscriptions.push({
		dispose: () => {
			releaseHandle();
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

async function resolveLibconfigApi(context: ExtensionContext): Promise<LibconfigExtensionApi | undefined> {
	const libconfigId = getLibconfigExtensionId(context);
	if (!libconfigId) {
		void vscode.window.showErrorMessage('SWUpdate requires a LibConfig extension dependency.');
		return undefined;
	}

	const extension = vscode.extensions.getExtension<LibconfigExtensionApi>(libconfigId);
	if (!extension) {
		void vscode.window.showErrorMessage(`SWUpdate requires LibConfig extension ${libconfigId}.`);
		return undefined;
	}

	const api = await extension.activate();
	if (
		!api ||
		(api.apiVersion !== 1 && api.apiVersion !== 2) ||
		typeof api.getParsedDocument !== 'function' ||
		typeof api.getCompletionItems !== 'function'
	) {
		void vscode.window.showErrorMessage('LibConfig extension API is unavailable or incompatible: getParsedDocument and getCompletionItems are required.');
		return undefined;
	}

	return api;
}

function getLibconfigExtensionId(context: ExtensionContext): string | undefined {
	const dependencies: unknown = context.extension.packageJSON?.extensionDependencies;
	return Array.isArray(dependencies) && typeof dependencies[0] === 'string'
		? dependencies[0]
		: undefined;
}

function isSupportedDocument(document: vscode.TextDocument): boolean {
	return vscode.languages.match(SWUPDATE_DOCUMENT_SELECTOR as vscode.DocumentSelector, document) > 0;
}

function createIncludeCompletion(): vscode.CompletionItem {
	const item = new vscode.CompletionItem('@include', vscode.CompletionItemKind.Snippet);
	item.insertText = new vscode.SnippetString('@include "${1:path}"');
	item.detail = 'Insert include directive';
	return item;
}

async function getLibconfigCompletionItems(
	libconfigApiPromise: Promise<LibconfigExtensionApi | undefined>,
	document: vscode.TextDocument,
	text: string,
	offset: number
): Promise<vscode.CompletionItem[]> {
	const api = await libconfigApiPromise;
	if (!api) {
		return [];
	}

	try {
		const entries = await api.getCompletionItems(document.uri.toString(), text, offset);
		return entries.map(toVsCodeCompletionItem);
	} catch (error) {
		logError(`Failed to get LibConfig completions for ${document.uri.toString()}`, error);
		return [];
	}
}

function logError(message: string, error: unknown): void {
	const detail = error instanceof Error ? error.stack ?? error.message : String(error);
	outputChannel?.appendLine(`${message}: ${detail}`);
}

function toVsCodeCompletionItem(entry: LibconfigCompletionEntry): vscode.CompletionItem {
	const item = new vscode.CompletionItem(entry.label, toVsCodeCompletionItemKind(entry.kind));
	if (typeof entry.insertText === 'string') {
		item.insertText = entry.insertTextFormat === 2
			? new vscode.SnippetString(entry.insertText)
			: entry.insertText;
	}
	item.detail = entry.detail;
	item.documentation = entry.documentation;
	return item;
}

function toVsCodeCompletionItemKind(kind: number | undefined): vscode.CompletionItemKind {
	if (typeof kind !== 'number') {
		return vscode.CompletionItemKind.Text;
	}
	return Math.max(0, kind - 1) as vscode.CompletionItemKind;
}

function dedupeCompletionItems(items: vscode.CompletionItem[]): vscode.CompletionItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const label = typeof item.label === 'string' ? item.label : item.label.label;
		const key = `${label}\u0000${item.kind ?? ''}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

function semanticDiagnosticsToVsCode(diagnostics: PlainDiagnostic[]): vscode.Diagnostic[] {
	return diagnostics.map(d => new vscode.Diagnostic(
		new vscode.Range(d.range.start.line, d.range.start.character, d.range.end.line, d.range.end.character),
		d.message,
		d.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
	));
}

function syntaxDiagnosticsToVsCode(syntaxErrors: SerializedDiagnostic[]): vscode.Diagnostic[] {
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

export function deactivate(): undefined {
	outputChannel = undefined;
	return undefined;
}
