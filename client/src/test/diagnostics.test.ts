/* --------------------------------------------------------------------------------------------
 * Copyright (c) SWUpdate VS Code Support contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import * as assert from 'assert'
import { activateFixtureDocument } from './helper'

type DiagnosticExpectation = {
  message: string;
  severity?: vscode.DiagnosticSeverity;
  present?: boolean;
}

type DiagnosticTestCase = {
  fileName: string;
  expectations: DiagnosticExpectation[];
}

export async function runDiagnosticsTest(): Promise<void> {
  const testCases: DiagnosticTestCase[] = [
    {
      fileName: 'sw-description-invalid.txt',
      expectations: [
        { message: "Invalid partition 'size' value", severity: vscode.DiagnosticSeverity.Error },
        { message: "'size' should be a number or a decimal string with optional K, M, or G suffix", severity: vscode.DiagnosticSeverity.Error },
        { message: "Expected string value for 'update-type'", severity: vscode.DiagnosticSeverity.Warning },
        { message: "Unsupported type for 'partitions'", severity: vscode.DiagnosticSeverity.Warning },
        { message: "Unsupported type for 'images'", severity: vscode.DiagnosticSeverity.Warning },
        { message: 'Unsupported compression', severity: vscode.DiagnosticSeverity.Warning },
        { message: "Expected string or boolean value for 'encrypted'", severity: vscode.DiagnosticSeverity.Warning },
        { message: "'offset' should be a decimal string with optional K, M, or G suffix", severity: vscode.DiagnosticSeverity.Warning },
        { message: 'Unsupported fstype', severity: vscode.DiagnosticSeverity.Warning },
        { message: "'sha256' should be a 64-character hexadecimal string or a $swupdate_get_sha256(...) value", severity: vscode.DiagnosticSeverity.Warning }
      ]
    },
    {
      fileName: 'sw-description-generated-sha.txt',
      expectations: [
        { message: "Expected string value for 'update-type'" },
        { message: "'sha256' should be a 64-character hexadecimal string or a $swupdate_get_sha256(...) value", present: false }
      ]
    },
    {
      fileName: 'sw-description-partition-size-invalid.txt',
      expectations: [
        {
          message: "Invalid partition 'size' value. Expected a decimal string with optional K, M, or G suffix",
          severity: vscode.DiagnosticSeverity.Error
        }
      ]
    },
    {
      fileName: 'sw-description-labeltype-invalid.txt',
      expectations: [
        {
          message: 'Unsupported labeltype. Expected one of: gpt, dos.',
          severity: vscode.DiagnosticSeverity.Error
        }
      ]
    }
  ]

  for (const testCase of testCases) {
    await testDiagnostics(testCase)
  }
}

async function testDiagnostics(testCase: DiagnosticTestCase) {
  const { fileName, expectations } = testCase
  const docUri = await activateFixtureDocument(fileName)
  const actualDiagnostics = await waitForDiagnostics(docUri)

  for (const expectation of expectations) {
    assertDiagnosticExpectation(actualDiagnostics, expectation, fileName)
  }
}

function assertDiagnosticExpectation(
  diagnostics: readonly vscode.Diagnostic[],
  expectation: DiagnosticExpectation,
  fileName: string
) {
  const { message, severity, present = true } = expectation
  const matched = diagnostics.some((diagnostic) => {
    if (!diagnostic.message.includes(message)) {
      return false
    }

    if (severity !== undefined && diagnostic.severity !== severity) {
      return false
    }

    return true
  })

  assert.strictEqual(
    matched,
    present,
    `Expected diagnostic ${present ? 'presence' : 'absence'} in ${fileName}: ${message}`
  )
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
