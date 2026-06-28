// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

// Outputs "<major>.<minor>.<patch+1>-dev" for use by the package:dev npm script.
// Incrementing the patch ensures the dev build sorts above the current release
// (SemVer pre-release tags sort LOWER than the base version they annotate).
// vsce package $(node scripts/dev-version.js) ...
const pkg = require('../package.json');
const [major, minor, patch] = pkg.version.split('.').map(Number);
process.stdout.write(`${major}.${minor}.${patch + 1}-dev`);
