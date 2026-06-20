# Change Log

## Unreleased
- Added localization support via `@vscode/l10n`. All diagnostic messages and client-side error strings are now translatable.
- Added `package.nls.json` for localizable `contributes` strings (display name, configuration title and description).
- Added `l10n/bundle.l10n.json` as the English source bundle for all runtime strings.
- Added `extract-l10n` npm script to regenerate `bundle.l10n.json` from source; runs automatically as part of `package:local` and `vscode:prepublish`.
- Added `sbom`, `sbom:cyclonedx`, and `sbom:spdx` npm scripts to generate CycloneDX and SPDX SBOM outputs.
- Improved dynamic value validation support: function calls are now accepted for `sha256`, `ivt`, `aes-key`, `size`, and `offset` where appropriate.
- Added context-aware `size`/`offset` validation for `properties` blocks: only scalar numbers, `@@variable@@`, or function calls are accepted there (no `K`/`M`/`G` suffixes).
- Added missing boolean completions for native boolean keys and for `encrypted` value contexts.
- Improved overall editor reliability and completion quality by removing duplicate suggestions and strengthening integration with the Libconfig parser.

## 1.0.1
- Updated documentation per VSCode marketplace requirements.
- Fixed `SwupdateServer.trace.server` configuration key casing to match the LSP client ID so VS Code trace logging works correctly.
- Release script (`scripts/update-version.js`) now removes the `## Unreleased` section entirely on publish instead of leaving a placeholder.
- Bumped `@types/node` from `^16.0.0` to `^18.0.0` in server and client to match the minimum VS Code Node runtime.

## 1.0.0
- Initial release.
- Smart completion for common SWUpdate keys and sections.
- Context-aware value suggestions while editing `sw-description*` files.
- Semantic validation with helpful diagnostic messages for common SWUpdate issues.
- Depends on `borkra.libconfig-lang` for base libconfig parsing and grammar support.
