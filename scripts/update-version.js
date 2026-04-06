#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageDirs = ['', 'client', 'server'];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
}

function isSemver(version) {
    return /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version);
}

function resolveTargetVersion() {
    const positional = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
    if (positional) {
        return positional;
    }

    const rootPkgPath = path.join(rootDir, 'package.json');
    const rootPkg = readJson(rootPkgPath);
    return rootPkg.version;
}

function syncPackageVersion(packagePath, version, dryRun) {
    const pkg = readJson(packagePath);
    pkg.version = version;
    if (!dryRun) {
        writeJson(packagePath, pkg);
    }
    return pkg;
}

function syncLockfileVersion(lockfilePath, packageName, version, dryRun) {
    // Intentionally not updating version fields in package-lock.json.
    // Those fields are cosmetic and do not affect npm install behaviour.
    // Keeping them unchanged preserves the lockfile hash so the CI npm cache key is stable across releases.
}

function finalizeReleaseNotes(version, dryRun) {
    const changelogPath = path.join(rootDir, 'CHANGELOG.md');
    let changelog = fs.readFileSync(changelogPath, 'utf8');
    const versionHeading = `## ${version}`;

    if (changelog.includes(`${versionHeading}\n`)) {
        console.log(`CHANGELOG already contains ${versionHeading}; skipping.`);
        return;
    }

    const unreleasedBlock = /## Unreleased\n([\s\S]*?)(?=\n## |$)/.exec(changelog);
    if (!unreleasedBlock) {
        throw new Error('Could not find "## Unreleased" section in CHANGELOG.md.');
    }

    const body = unreleasedBlock[1].trimEnd();
    if (body.trim().length === 0) {
        console.log('Unreleased section is empty; nothing to finalize.');
        return;
    }

    if (dryRun) {
        console.log(`Would finalize CHANGELOG release notes for ${version}.`);
        return;
    }

    const replacement = `${versionHeading}\n${body}\n`;
    changelog = changelog.replace(/## Unreleased\n([\s\S]*?)(?=\n## |$)/, replacement);
    fs.writeFileSync(changelogPath, changelog, 'utf8');
    console.log(`Finalized CHANGELOG release notes for ${version}.`);
}

function main() {
    const dryRun = process.argv.includes('--dry-run');
    const version = resolveTargetVersion();
    if (!version || !isSemver(version)) {
        throw new Error(`Invalid version '${version}'. Expected semver like 1.0.0 or 1.0.0-rc.1`);
    }

    for (const dir of packageDirs) {
        const packagePath = path.join(rootDir, dir, 'package.json');
        const lockfilePath = path.join(rootDir, dir, 'package-lock.json');
        const pkg = syncPackageVersion(packagePath, version, dryRun);
        syncLockfileVersion(lockfilePath, pkg.name, version, dryRun);
    }

    if (dryRun) {
        console.log(`Would update versions to ${version} in package manifests and lockfiles.`);
    } else {
        console.log(`Updated versions to ${version} in package manifests and lockfiles.`);
    }
    finalizeReleaseNotes(version, dryRun);
}

main();