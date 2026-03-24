'use strict';

import {
	Diagnostic
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
    ParsedLibconfigDocument
} from '../parseData';

export interface ValidationPluginContext {
	textDocument: TextDocument;
	parsedDocument: ParsedLibconfigDocument;
}

export interface ValidationPlugin {
	name: string;
	supports(context: ValidationPluginContext): boolean;
	validate(context: ValidationPluginContext): Diagnostic[];
}
