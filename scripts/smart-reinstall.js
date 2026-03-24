#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const EXTENSION_ID = 'borkra.swupdate-lang';
const VSIX_FILE = path.resolve(__dirname, '..', 'swupdate-lang.vsix');

function exec(command, options = {}) {
	try {
		return execSync(command, {
			encoding: 'utf8',
			stdio: options.silent ? 'pipe' : 'inherit',
			...options
		});
	} catch (error) {
		if (!options.ignoreErrors) {
			throw error;
		}
		return null;
	}
}

function reinstall(codeCommand, extensionId, vsixPath) {
	console.log(`\n🔍 Checking ${codeCommand}...`);

	console.log(`  🗑️  Uninstalling ${extensionId}...`);
	exec(`${codeCommand} --uninstall-extension ${extensionId}`, { ignoreErrors: true });

	console.log(`  📦 Installing ${path.basename(vsixPath)}...`);
	exec(`${codeCommand} --install-extension ${vsixPath} --force`);

	console.log(`  ✅ Done!`);
}

function main() {
	console.log('═══════════════════════════════════════════════════════════');
	console.log('  Smart Extension Reinstaller for SWUpdate VS Code Support');
	console.log('═══════════════════════════════════════════════════════════');

	const fs = require('fs');
	if (!fs.existsSync(VSIX_FILE)) {
		console.error(`\n❌ Error: VSIX file not found at ${VSIX_FILE}`);
		console.error('   Run "npm run package:local" first to build the VSIX.');
		process.exit(1);
	}

	try {
		reinstall('code', EXTENSION_ID, VSIX_FILE);
	} catch (error) {
		console.error(`\n❌ Error with VS Code stable: ${error.message}`);
	}

	try {
		reinstall('code-insiders', EXTENSION_ID, VSIX_FILE);
	} catch (error) {
		console.error(`\n❌ Error with VS Code Insiders: ${error.message}`);
	}

	console.log('\n═══════════════════════════════════════════════════════════');
	console.log('  Reinstall Complete!');
	console.log('═══════════════════════════════════════════════════════════\n');
}

if (require.main === module) {
	main();
}
