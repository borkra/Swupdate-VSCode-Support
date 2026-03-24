import { Diagnostic } from 'vscode-languageserver/node';

export interface ParsedLibconfigNode {
	type: 'object' | 'array' | 'list' | 'property' | 'string' | 'number' | 'boolean';
	offset: number;
	length: number;
	value: string | boolean | number | null;
	children?: ParsedLibconfigNode[];
	name?: string;
}

export interface ParsedLibconfigDocument {
	syntaxErrors: Diagnostic[];
	rootSettings: ParsedLibconfigNode[];
}

export interface ParsedLibconfigPayload {
	uri: string;
	version: number;
	text: string;
	parsedDocument: ParsedLibconfigDocument;
}

const parsedByUri = new Map<string, ParsedLibconfigPayload>();
const MAX_CACHE_SIZE = 100; // Limit memory for large workspaces

export function setParsedDocument(payload: ParsedLibconfigPayload): void {
	parsedByUri.set(payload.uri, payload);
	
	// Simple LRU-style eviction to prevent unbounded memory growth
	if (parsedByUri.size > MAX_CACHE_SIZE) {
		const firstKey = parsedByUri.keys().next().value;
		if (firstKey) {
			parsedByUri.delete(firstKey);
		}
	}
}

export function getParsedDocument(uri: string): ParsedLibconfigPayload | undefined {
	return parsedByUri.get(uri);
}

export function clearParsedDocument(uri: string): void {
	parsedByUri.delete(uri);
}
