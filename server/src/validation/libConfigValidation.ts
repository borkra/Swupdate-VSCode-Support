'use strict';

import {
	Diagnostic
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
	ParseLibConfigDocument
} from '../parser/libConfigParser';

import {
	validationPlugins
} from './plugins';

import {
	ValidationPluginContext
} from './plugins/validatorPlugin';

export class LibConfigValidation {
	public doValidation(textDocument: TextDocument): Promise<Diagnostic[]> {
		const libConfigDocument = ParseLibConfigDocument(textDocument);
		const pluginContext: ValidationPluginContext = {
			textDocument,
			libConfigDocument
		};
		const diagnostics: Diagnostic[] = [];
		const added: { [signature: string]: boolean } = {};
		const addProblem = (problem: Diagnostic) => {
			// remove duplicated messages
			const signature = problem.range.start.line + ' ' + problem.range.start.character + ' ' + problem.message;
			if (!added[signature]) {
				added[signature] = true;
				diagnostics.push(problem);
			}
		};
		const getDiagnostics = () => {
			for (const plugin of validationPlugins) {
				if (!plugin.supports(pluginContext)) {
					continue;
				}
				for (const p of plugin.validate(pluginContext)) {
					addProblem(p);
				}
			}

			return diagnostics;
		};

		return Promise.resolve(getDiagnostics());
	}
}