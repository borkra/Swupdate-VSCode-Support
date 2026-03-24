// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

import {
	ValidationPlugin
} from './validatorPlugin';

import {
	swDescriptionPlugin
} from '../../swDescription/plugin';

export const validationPlugins: readonly ValidationPlugin[] = [
	{
		name: swDescriptionPlugin.name,
		supports: context => swDescriptionPlugin.supportsDocument(context.textDocument),
		validate: context => swDescriptionPlugin.validate(context)
	}
];
