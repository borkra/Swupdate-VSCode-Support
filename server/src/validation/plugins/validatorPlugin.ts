'use strict';

import {
	Diagnostic
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
	LibConfigDocument
} from '../../dataClasses';

export interface ValidationPluginContext {
	textDocument: TextDocument;
	libConfigDocument: LibConfigDocument;
}

export interface ValidationPlugin {
	name: string;
	supports(context: ValidationPluginContext): boolean;
	validate(context: ValidationPluginContext): Diagnostic[];
}
