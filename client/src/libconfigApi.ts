// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

export interface ParsedLibconfigNode {
	type: 'object' | 'array' | 'list' | 'property' | 'string' | 'number' | 'boolean';
	offset: number;
	length: number;
	value: string | boolean | number | null;
	children?: ParsedLibconfigNode[];
	name?: string;
}

export interface BaseLibConfigNode {
	type: ParsedLibconfigNode['type'];
	offset: number;
	length: number;
	value: string | boolean | number | BaseLibConfigNode | null;
	children?: BaseLibConfigNode[];
	name?: string;
}

export interface LibConfigPropertyNode extends BaseLibConfigNode {
	type: 'property';
	name: string;
	value: BaseLibConfigNode | null;
}

export interface ObjectLibConfigNode extends BaseLibConfigNode {
	type: 'object';
	children: LibConfigPropertyNode[];
}

export interface ListLibConfigNode extends BaseLibConfigNode {
	type: 'list';
	children: BaseLibConfigNode[];
}

export interface ArrayLibConfigNode extends BaseLibConfigNode {
	type: 'array';
	children: BaseLibConfigNode[];
}

export interface SerializedPosition {
	line?: number;
	character?: number;
}

export interface SerializedRange {
	start?: SerializedPosition;
	end?: SerializedPosition;
}

export interface SerializedDiagnostic {
	range?: SerializedRange;
	message?: string;
	severity?: number;
	source?: string;
}

export interface ParsedLibconfigDocument {
	syntaxErrors: SerializedDiagnostic[];
	rootSettings: ParsedLibconfigNode[];
}

export interface LibconfigCompletionEntry {
	label: string;
	kind?: number;
	insertText?: string;
	insertTextFormat?: number;
	detail?: string;
	documentation?: string;
}

export interface LibconfigExtensionApi {
	apiVersion: 1 | 2;
	getParsedDocument(uri: string, text: string): Promise<ParsedLibconfigDocument>;
	getCompletionItems(uri: string, text: string, offset: number): Promise<LibconfigCompletionEntry[]>;
	acquireHandle?(): { dispose(): void };
}
