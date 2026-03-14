/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { runCompletionTest, runSwDescriptionCompletionTest } from './completion.test';
import { runDiagnosticsTest } from './diagnostics.test';

async function runNamedTest(name: string, fn: () => Promise<void>): Promise<void> {
	try {
		await fn();
		console.log(`PASS ${name}`);
	} catch (error) {
		console.error(`FAIL ${name}`);
		throw error;
	}
}

export async function run(): Promise<void> {
	await runNamedTest('completion', runCompletionTest);
	await runNamedTest('sw-description completion', runSwDescriptionCompletionTest);
	await runNamedTest('diagnostics', runDiagnosticsTest);
}
