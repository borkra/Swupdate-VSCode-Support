// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

import { Diagnostic } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ParsedLibconfigDocument } from './parseData';
import { isSwDescriptionDocumentUri } from '../swDescription/definitions';
import { getSwDescriptionSemanticDiagnostics } from '../swDescription/validation';

export function doValidation(textDocument: TextDocument, parsedDocument: ParsedLibconfigDocument | undefined): Diagnostic[] {
	if (!parsedDocument || !(textDocument.languageId === 'swupdate' || isSwDescriptionDocumentUri(textDocument.uri))) {
		return [];
	}
	return getSwDescriptionSemanticDiagnostics(textDocument, parsedDocument.rootSettings);
}
