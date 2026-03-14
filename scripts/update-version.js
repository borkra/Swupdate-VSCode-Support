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

function syncPackageVersion(packagePath, version) {
    const pkg = readJson(packagePath);
    pkg.version = version;
    writeJson(packagePath, pkg);
    return pkg;
}

function syncLockfileVersion(lockfilePath, packageName, version) {
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

function main() {
    const version = resolveTargetVersion();
    if (!version || !isSemver(version)) {
        throw new Error(`Invalid version '${version}'. Expected semver like 1.0.0 or 1.0.0-rc.1`);
    }

    for (const dir of packageDirs) {
        const packagePath = path.join(rootDir, dir, 'package.json');
        const lockfilePath = path.join(rootDir, dir, 'package-lock.json');
        const pkg = syncPackageVersion(packagePath, version);
        syncLockfileVersion(lockfilePath, pkg.name, version);
    }

    console.log(`Updated versions to ${version} in package manifests and lockfiles.`);
}

main();