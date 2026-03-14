'use strict';

import {
	TextDocument,
	Diagnostic
} from 'vscode-languageserver/node';

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
