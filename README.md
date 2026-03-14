# SWUpdate README

A companion VS Code extension for SWUpdate `sw-description*` files.

## Features

- Works together with the base LibConfig extension (`borkra.libconfig-lang`)
- Adds SWUpdate-specific completion tailored for sections and keys
- Adds SWUpdate semantic validation (warnings)
- Avoids duplicating base language registration, grammar, formatting, folding, and generic libconfig diagnostics

## Extension Settings

- `swupdateServer.trace.server`: traces communication between VS Code and the language server (`off`, `messages`, `verbose`)

## Notes

Install both extensions:

1. LibConfig base extension (`borkra.libconfig-lang`)
2. This SWUpdate companion extension

The base extension provides language registration, syntax highlighting, and core libconfig rules.
This companion adds SWUpdate-specific intelligence on top for `sw-description*` files.
