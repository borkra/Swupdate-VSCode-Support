'use strict';

import {
	CompletionItem
} from 'vscode-languageserver/node';

import {
	CompletionPlugin,
	CompletionPluginContext
} from './completionPlugin';

import {
	swDescriptionPlugin
} from '../../swDescription/plugin';

const completionPlugins: readonly CompletionPlugin[] = [
	{
		name: swDescriptionPlugin.name,
		supports: (context: CompletionPluginContext): boolean => swDescriptionPlugin.supportsDocument(context.textDocument),
		complete: (context: CompletionPluginContext): CompletionItem[] => swDescriptionPlugin.complete(context)
	}
];

export function getPluginCompletionItems(context: CompletionPluginContext): CompletionItem[] | null {
	for (const plugin of completionPlugins) {
		if (plugin.supports(context)) {
			return plugin.complete(context);
		}
	}
	return null;
}
