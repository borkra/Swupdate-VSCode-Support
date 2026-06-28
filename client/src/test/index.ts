/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { runCompletionTest } from './completion.test';
import { runDiagnosticsTest } from './diagnostics.test';
import { cleanupTestArtifacts } from './helper';

async function runNamedTest(name: string, fn: () => Promise<void>): Promise<void> {
	try {
		await fn();
		process.stdout.write(`PASS ${name}\n`);
	} catch (error) {
		process.stderr.write(`FAIL ${name}\n`);
		throw error;
	} finally {
		await cleanupTestArtifacts();
	}
}

export async function run(): Promise<void> {
	await runNamedTest('completion', runCompletionTest);
	await runNamedTest('diagnostics', runDiagnosticsTest);
}
