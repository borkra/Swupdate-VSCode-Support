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
		supports: context => swDescriptionPlugin.supportsUri(context.textDocument.uri),
		validate: context => swDescriptionPlugin.validate(context)
	}
];
