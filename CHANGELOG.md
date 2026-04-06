# Change Log

## Unreleased
- Updated documentation per VSCode marketplace requirements.
- Fixed `SwupdateServer.trace.server` configuration key casing to match the LSP client ID so VS Code trace logging works correctly.
- Release script (`scripts/update-version.js`) now removes the `## Unreleased` section entirely on publish instead of leaving a placeholder.

## 1.0.0
- Initial release.
- Smart completion for common SWUpdate keys and sections.
- Context-aware value suggestions while editing `sw-description*` files.
- Semantic validation with helpful diagnostic messages for common SWUpdate issues.
- Depends on `borkra.libconfig-lang` for base libconfig parsing and grammar support.
