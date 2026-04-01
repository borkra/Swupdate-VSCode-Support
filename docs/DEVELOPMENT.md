# Development

## Local Extension Install

- `npm run package:local`: compile, bundle, and package the extension as `swupdate-lang.vsix`.
- `npm run install:local`: build, package, and force-install the current VSIX into `code` and `code-insiders`.

> **Note:** The swupdate extension depends on `borkra.libconfig-lang`. Build and install that
> extension first (see `../Libconfig-VsCode-Support`), then install this one.

## Testing

The test runner installs the libconfig dependency from the path set in `LIBCONFIG_VSIX_PATH`,
or falls back to the published marketplace extension `borkra.libconfig-lang`.

```bash
# 1. Build the libconfig vsix (one-time or after libconfig changes):
cd ../Libconfig-VsCode-Support && npm run package:local

# 2. Run tests:
LIBCONFIG_VSIX_PATH=../Libconfig-VsCode-Support/libconfig-lang.vsix npm test
```

Use the VS Code **`test`** task to run tests without setting the variable manually
(`LIBCONFIG_VSIX_PATH` is pre-configured in `.vscode/tasks.json`).

## Publishing a Release

### 1. Create a GitHub Release (and tag)

Trigger the **Publish Extension Release** workflow (`.github/workflows/publish-extension-release.yml`) via one of:

- **Workflow dispatch** — go to *Actions → Publish Extension Release → Run workflow* and enter the version (e.g. `1.1.0`).
- **PR label** — add a label in the format `release:v1.1.0` (or just `v1.1.0`) to any open PR targeting `main`.

The workflow will:
1. Bump the version in all `package.json` files via `npm run update:version`.
2. Commit and push a `chore(release): vX.Y.Z` commit to `main`.
3. Create and push the `vX.Y.Z` tag.
4. Build and package `swupdate-lang.vsix`.
5. Create a GitHub Release with the VSIX attached.

### 2. Publish to Marketplace

Once the GitHub Release exists, the **Publish VS Code Marketplace Extension** workflow
(`.github/workflows/publish-extension-marketplace.yml`) runs automatically on the `v*` tag push.

To publish manually from an existing release tag:
- Go to *Actions → Publish VS Code Marketplace Extension → Run workflow* and enter the existing tag (e.g. `v1.1.0`).

Required repository secrets:
- `VSCE_PAT` — personal access token for the VS Code Marketplace.
- `OVSX_PAT` — personal access token for the Open VSX Registry.
