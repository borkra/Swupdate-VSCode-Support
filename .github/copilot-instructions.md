# SWUpdate VS Code Extension — Copilot Instructions

## Agent Rules

- **Never commit or push anything without explicit user approval.** Always show the diff or summarise changes and wait for the user to say "commit" or "push" before running any `git commit` or `git push` command.

## Project Overview

A VS Code language extension for `sw-description` files (SWUpdate firmware update descriptors).
It provides syntax highlighting, semantic validation, and completions via a Language Server Protocol (LSP) server.

The extension depends on `borkra.libconfig-lang` (sibling project at `../Libconfig-VsCode-Support`)
for libconfig grammar and base parsing. That dependency must be installed before the swupdate extension works.

---

## Repository Layout

```
Swupdate-VSCode-Support/
  client/src/extension.ts          — VS Code client: activates LSP, forwards parse events
  client/src/test/                  — E2E tests (completion.test.ts, diagnostics.test.ts)
  client/testFixture/               — sw-description sample/fixture files used by tests
  server/src/server.ts              — LSP server entry point
  server/src/swDescription/
    definitions.ts                  — All spec-defined constants, key sets, regex, templates
    completions.ts                  — Completion item logic (context-aware, value routing)
    validation.ts                   — Semantic diagnostic rules (warnings + errors)
  server/src/validation/
    libConfigValidation.ts          — Delegates libconfig parsing to the libconfig server
    parseData.ts                    — Parsed document data structures
  syntaxes/swupdate.tmLanguage.json — TextMate grammar (extends source.libconfig)
  scripts/
    e2e.js / e2e.sh                 — E2E test runner (downloads VS Code, installs deps, runs tests)
    bundle.js                       — esbuild bundler for client + server
    smart-reinstall.js              — Uninstalls + installs vsix into code and code-insiders
    update-version.js               — Bumps version across package.json files
```

---

## NPM Scripts (all run from the workspace root)

| Script | Command | VS Code Task | Purpose |
|---|---|---|---|
| `compile` | `npm run compile` | `compile` | TypeScript build (`tsc -b`) |
| `watch` | `npm run watch` | `watch` | Incremental watch mode |
| `test` | `npm test` | `test` | E2E test suite — requires `LIBCONFIG_VSIX_PATH` (see below) |
| `bundle` | `npm run bundle` | `bundle` | esbuild bundle for client + server |
| `package:local` | `npm run package:local` | `package:local` | Compile + bundle + produce `swupdate-lang.vsix` |
| `install:local` | `npm run install:local` | `install:local` | `package:local` then `smart-reinstall.js` (installs into code + code-insiders) |
| `clean` | `npm run clean` | `clean` | Remove all build artifacts and `.vsix` |
| `clean:full` | `npm run clean:full` | `clean:full` | `clean` + remove all `node_modules` |
| `update:version` | `npm run update:version` | `update:version` | Bump version in all package.json files |

### Running tests

The test runner (`scripts/e2e.js`) installs the libconfig dependency from:
1. `LIBCONFIG_VSIX_PATH` environment variable (preferred for local dev)
2. Marketplace ID `borkra.libconfig-lang` (CI / if already published)

**Local dev workflow:**

Use the VS Code **`test`** task (has `LIBCONFIG_VSIX_PATH` pre-configured), or run manually:

```bash
# 1. Build the libconfig sibling vsix (one-time or after libconfig changes)
# From the Libconfig-VsCode-Support workspace:
npm run package:local

# 2. Run tests (from this workspace):
LIBCONFIG_VSIX_PATH=../Libconfig-VsCode-Support/libconfig-lang.vsix npm test
```

### Building and installing locally

Use the VS Code **`install:local`** task, or run:

```bash
npm run install:local
# Produces swupdate-lang.vsix and installs into VS Code stable + Insiders
# Reload the VS Code window after installation to activate the new version
```

---

## Key Source Files to Know

### `server/src/swDescription/definitions.ts`
Single source of truth for all spec-defined data:
- `SW_DESCRIPTION_BOOLEAN_KEYS` / `SW_DESCRIPTION_STRING_KEYS` — keys with enforced value types
- `SW_DESCRIPTION_*_VALUES` — allowed string values for validated keys (`compressed`, `fstype`, `labeltype`, etc.)
- `SW_DESCRIPTION_ENTRY_KNOWN_KEYS` — full set of spec-valid property names; used to detect typos/unknown keys
- `SW_DESCRIPTION_STATEMENT_TEMPLATES` — completion snippet templates shown at statement level
- Regex constants: `SW_DESCRIPTION_SHA256_REGEX`, `SW_DESCRIPTION_SIZE_REGEX`, `SW_DESCRIPTION_IVT_REGEX`, etc.
- `isSwDescriptionDocumentUri()` — returns true for any file whose name starts with `sw-description`

**Important distinction:**
- `fstype` — SWUpdate handler-specific; validated against `SW_DESCRIPTION_FILESYSTEM_VALUES` (`vfat`, `ext2`, `ext3`, `ext4`, `btrfs`)
- `filesystem` — passed to Linux `mount -t`; accepts any valid Linux filesystem type; **not validated**

### `server/src/swDescription/validation.ts`
Semantic diagnostic rules applied per property key inside `getSwDescriptionSemanticDiagnostics()`.
- `propertyValidators` map: key → validator function
- Boolean keys validated by `booleanKeys` set (early exit if wrong type)
- String keys validated by `stringKeys` set (early exit if wrong type)
- Unknown key detection: any key inside a section (`images`/`files`/`scripts`/`partitions`) not in `SW_DESCRIPTION_ENTRY_KNOWN_KEYS` gets a `Warning: Unknown property 'X'. Check for typos.`
- `properties = { ... }` sub-blocks are exempt from unknown key checks (handler-specific content)
- `validateDiskpartPartitionProperty()` handles `partition-N` array entry validation

### `server/src/swDescription/completions.ts`
- `getSwDescriptionCompletionItems()` — main entry, routes by context (value vs statement)
- `valueCompletionsByAssignmentKey` — maps key name → value completion provider
  - `compressed`, `encrypted`, `labeltype`, `update-type`, `type` have context-specific values
  - `filesystem` is **intentionally absent** (open-ended Linux mount type)
- `provideTypeValueCompletions()` — returns section-specific type values (images/files/scripts/partitions)
- `provideLabeltypeValueCompletions()` — only returns labeltype values when inside `partitions` section

---

## Test Fixtures (`client/testFixture/`)

| File | Purpose |
|---|---|
| `sw-description.sample` | Primary completion test fixture (all main sections) |
| `sw-description-labeltype.sample` | Labeltype value completion test |
| `sw-description-filesystem.sample` | Files section statement completion test |
| `sw-description-invalid.txt` | Main invalid fixture (all basic type/value errors) |
| `sw-description-generated-sha.txt` | Verifies `$swupdate_get_sha256(...)` is accepted as valid sha256 |
| `sw-description-partition-size-invalid.txt` | Invalid `partition-N` size string |
| `sw-description-labeltype-invalid.txt` | Invalid `labeltype` value |
| `sw-description-hwcompat-invalid.txt` | `hardware-compatibility` as scalar (not array) |
| `sw-description-type-checks-invalid.txt` | All type-mismatch validator branches |
| `sw-description-misspelled-keys.txt` | Typo/unknown key detection in all 4 section types |
| `sw-description-spec-full.sample` | Comprehensive valid file — no false-positive regression |
| `spec-variants.sample` | Compatibility/spec variants |
| `compatibility.sample` | `@include` compatibility |
| `signed-base-invalid.sample` | Signed base invalid |

---

## Spec Reference

Official sw-description format: https://sbabic.github.io/swupdate/sw-description.html

Key spec rules encoded in the plugin:
- `hardware-compatibility` must be an array of strings (supports `#RE:` POSIX regex prefix)
- `sha256` must be a 64-char hex string or `$swupdate_get_sha256(filename)`
- `ivt` must be a 32-char hex string
- `aes-key` must be a 32/48/64-char hex string (AES-128/192/256)
- `compressed` accepts `"zlib"`, `"zstd"`, `"xz"` or boolean `true` (deprecated)
- `encrypted` accepts `"aes-cbc"` or boolean `true`
- `labeltype` (inside `partitions` section only) accepts `"gpt"` or `"dos"`
- `size` / `offset` accept integer, or string with optional `K`/`M`/`G` suffix, or `@@variable@@`
- `update-type` accepts `"application"` or `"OS"` (must not be empty)
- Section types: `images` → ubivol/flash/bootloader/fpga/raw; `files` → archive/rawfile; `scripts` → lua/shellscript/preinstall/postinstall/copy/emmc_boot/emmc_boot_toggle/ssblswitch/ubiswap/docker_*; `partitions` → diskpart/diskformat/toggleboot/uniqueuuid/ubipartition/btrfs
- Unknown properties inside section entries warn as typos
- `properties = { ... }` blocks contain handler-specific keys and are not checked

---

## CI / Release Workflows

Located in `.github/workflows/`:
- `build-extension-package.yml` — builds and packages vsix on push/PR
- `publish-extension-release.yml` — publishes GitHub release; creates a git tag with a `v` prefix (e.g. `v1.2.3`) and a release commit `chore(release): v1.2.3`
- `publish-extension-marketplace.yml` — publishes to VS Code Marketplace (triggered by tag `v*` or manual dispatch with an existing release tag)

**Release tag format:** always `v<semver>` (e.g. `v1.1.2`). The tag is created by `gh release create` and points to the release commit.
