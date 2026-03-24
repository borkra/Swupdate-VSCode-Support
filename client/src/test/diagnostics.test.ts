/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import * as assert from 'assert'
import { activateFixtureDocument } from './helper'

export async function runDiagnosticsTest(): Promise<void> {
  await testSwDescriptionSemanticDiagnostics('sw-description-invalid.txt')
  await testSwDescriptionGeneratedShaDiagnostics('sw-description-generated-sha.txt')
}

async function testSwDescriptionSemanticDiagnostics(fileName: string) {
  const docUri = await activateFixtureDocument(fileName)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  const warningDiagnostics = actualDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning)
  const errorDiagnostics = actualDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error)

  assert.strictEqual(errorDiagnostics.length, 0, 'Semantic sw-description checks should produce warnings, not errors')

  assert.ok(warningDiagnostics.some(d => d.message.includes("Expected string value for 'update-type'")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("Unsupported type for 'partitions'")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("Unsupported type for 'images'")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("Unsupported compression")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("Expected string or boolean value for 'encrypted'")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("'offset' should be a decimal string with optional K, M, or G suffix")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("'size' should be a number or a decimal string with optional K, M, or G suffix")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("Invalid partition 'size' value")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("Unsupported fstype")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("'sha256' should be a 64-character hexadecimal string or a $swupdate_get_sha256(...) value")))
}

async function testSwDescriptionGeneratedShaDiagnostics(fileName: string) {
  const docUri = await activateFixtureDocument(fileName)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  assert.ok(actualDiagnostics.some(d => d.message.includes("Expected string value for 'update-type'")))
  assert.ok(!actualDiagnostics.some(d => d.message.includes("'sha256' should be a 64-character hexadecimal string or a $swupdate_get_sha256(...) value")))
}

async function waitForDiagnostics(docUri: vscode.Uri): Promise<vscode.Diagnostic[]> {
  const timeoutAt = Date.now() + 5000

  while (Date.now() < timeoutAt) {
    const diagnostics = vscode.languages.getDiagnostics(docUri)
    if (diagnostics.length > 0) {
      return diagnostics
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return vscode.languages.getDiagnostics(docUri)
}
