#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const readmePath = path.join(rootDir, 'README.md');

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
}

function readFile(filePath) {
	return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
	fs.writeFileSync(filePath, content, 'utf8');
}

function syncPackageVersion(packagePath, version) {
	const pkg = readJson(packagePath);
	pkg.version = version;
	writeJson(packagePath, pkg);
	return pkg;
}

function syncLockfile(lockfilePath, packageName, version) {
	if (!fs.existsSync(lockfilePath)) {
		return;
	}
	const lock = readJson(lockfilePath);
	lock.name = packageName;
	lock.version = version;
	if (lock.packages && lock.packages['']) {
		lock.packages[''].name = packageName;
		lock.packages[''].version = version;
	}
	writeJson(lockfilePath, lock);
}

function finalizeReleaseNotes(version, dryRun) {
	let readme = readFile(readmePath);
	const versionHeading = `### ${version}`;
	if (readme.includes(`${versionHeading}\n`)) {
		console.log(`Release notes already contain ${versionHeading}; skipping.`);
		return;
	}

	const unreleasedBlock = /^### Unreleased\s*\n([\s\S]*?)(?=^###\s|$)/m.exec(readme);
	if (!unreleasedBlock) {
		throw new Error('Could not find "### Unreleased" section in README.md.');
	}

	const body = unreleasedBlock[1].trimEnd();
	if (body.trim().length === 0) {
		console.log('Unreleased section is empty; nothing to finalize.');
		return;
	}

	const replacement = `### Unreleased\n- No changes yet.\n\n${versionHeading}\n${body}\n\n`;
	readme = readme.replace(/^### Unreleased\s*\n([\s\S]*?)(?=^###\s|$)/m, replacement);

	if (dryRun) {
		console.log(`Would finalize README release notes for ${version}.`);
		return;
	}

	writeFile(readmePath, readme);
	console.log(`Finalized README release notes for ${version}.`);
}

function main() {
	const dryRun = process.argv.includes('--dry-run');
	const rootPackagePath = path.join(rootDir, 'package.json');
	const rootPackage = readJson(rootPackagePath);
	const rootVersion = rootPackage.version;

	if (!rootVersion) {
		throw new Error('Root package.json has no version field.');
	}

	const packageDirs = ['client', 'server'];
	for (const dir of packageDirs) {
		const packagePath = path.join(rootDir, dir, 'package.json');
		const lockfilePath = path.join(rootDir, dir, 'package-lock.json');
		if (dryRun) {
			console.log(`Would sync ${dir}/package.json version to ${rootVersion}`);
			if (fs.existsSync(lockfilePath)) {
				console.log(`Would sync ${dir}/package-lock.json version to ${rootVersion}`);
			}
			continue;
		}
		const pkg = syncPackageVersion(packagePath, rootVersion);
		syncLockfile(lockfilePath, pkg.name, rootVersion);
	}

	console.log(`Synchronized client/server versions to ${rootVersion}`);
	finalizeReleaseNotes(rootVersion, dryRun);
}

main();
