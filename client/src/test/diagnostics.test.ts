/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import * as assert from 'assert'
import { getDocUri, activate } from './helper'

export async function runDiagnosticsTest(): Promise<void> {
  await testSyntaxDiagnostics(getDocUri('diagnostics.sample'))
  await testCompatibilityDiagnostics(getDocUri('compatibility.sample'))
  await testSpecVariantsDiagnostics(getDocUri('spec-variants.sample'))
  await testSignedBaseInvalidDiagnostics(getDocUri('signed-base-invalid.sample'))
  await testSwDescriptionSemanticDiagnostics(getDocUri('sw-description-invalid.sample'))
  await testSwDescriptionGeneratedShaDiagnostics(getDocUri('sw-description-generated-sha.sample'))
}

async function testSyntaxDiagnostics(docUri: vscode.Uri) {
  await activate(docUri)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  assert.ok(actualDiagnostics.length > 0)
  assert.ok(actualDiagnostics[0].message.includes('Expected'))
}

async function testCompatibilityDiagnostics(docUri: vscode.Uri) {
  await activate(docUri)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  const compatibilityDiagnostics = actualDiagnostics.filter(d =>
    typeof d.code === 'number' &&
    d.code >= 0x300 &&
    d.code < 0x400 &&
    d.severity === vscode.DiagnosticSeverity.Warning
  )

  assert.ok(compatibilityDiagnostics.length >= 4)
  assert.ok(compatibilityDiagnostics.some(d => d.message.includes("Use ';' instead of ','")))
  assert.ok(compatibilityDiagnostics.some(d => d.message.includes("Missing ';' terminator")))
  assert.ok(compatibilityDiagnostics.some(d => d.message.includes('Trailing comma in list')))
  assert.ok(compatibilityDiagnostics.some(d => d.message.includes('Trailing comma in array')))
}

async function testSpecVariantsDiagnostics(docUri: vscode.Uri) {
  await activate(docUri)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  const errorDiagnostics = actualDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error)
  assert.strictEqual(errorDiagnostics.length, 0)
}

async function testSignedBaseInvalidDiagnostics(docUri: vscode.Uri) {
  await activate(docUri)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  const valueDiagnostics = actualDiagnostics.filter(d =>
    d.severity === vscode.DiagnosticSeverity.Error &&
    d.message.includes('Expected setting type kind value')
  )

  assert.ok(valueDiagnostics.length >= 3)
}

async function testSwDescriptionSemanticDiagnostics(docUri: vscode.Uri) {
  await activate(docUri)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  const warningDiagnostics = actualDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning)
  const errorDiagnostics = actualDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error)

  assert.strictEqual(errorDiagnostics.length, 0, 'Semantic sw-description checks should produce warnings, not errors')

  assert.ok(warningDiagnostics.some(d => d.message.includes("Expected string value for 'update-type'")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("Unsupported compression")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("Expected string or boolean value for 'encrypted'")))
  assert.ok(warningDiagnostics.some(d => d.message.includes("'sha256' should be a 64-character hexadecimal string")))
}

async function testSwDescriptionGeneratedShaDiagnostics(docUri: vscode.Uri) {
  await activate(docUri)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  assert.ok(actualDiagnostics.some(d => d.message.includes("Expected string value for 'update-type'")))
  assert.ok(!actualDiagnostics.some(d => d.message.includes("'sha256' should be a 64-character hexadecimal string")))
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
