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
        { message: "'aes-key' should be a 32/48/64-character hexadecimal string.", severity: vscode.DiagnosticSeverity.Warning },
        { message: "'ivt' should be a 32-character hexadecimal string.", severity: vscode.DiagnosticSeverity.Warning },
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
    },
    // Spec: hardware-compatibility must be an array of strings, not a scalar
    {
      fileName: 'sw-description-hwcompat-invalid.txt',
      expectations: [
        {
          message: "Expected array value for 'hardware-compatibility'.",
          severity: vscode.DiagnosticSeverity.Warning
        }
      ]
    },
    // Spec: comprehensive valid sw-description must not generate false-positive warnings
    {
      fileName: 'sw-description-spec-full.sample',
      expectations: [
        { message: "'sha256' should be", present: false },
        { message: "'aes-key' should be", present: false },
        { message: "'ivt' should be", present: false },
        { message: 'Unsupported compression', present: false },
        { message: "Unsupported type for 'images'", present: false },
        { message: "Unsupported type for 'scripts'", present: false },
        { message: "Unsupported type for 'files'", present: false },
        { message: 'Unsupported labeltype', present: false },
        { message: "Expected array value for 'hardware-compatibility'", present: false },
        { message: "Invalid partition 'size' value", present: false },
        // No false-positive unknown-key warnings for valid spec keys
        { message: "Unknown property 'sha256'", present: false },
        { message: "Unknown property 'compressed'", present: false },
        { message: "Unknown property 'encrypted'", present: false },
        { message: "Unknown property 'filename'", present: false },
        { message: "Unknown property 'device'", present: false },
        { message: "Unknown property 'aes-key'", present: false },
        { message: "Unknown property 'ivt'", present: false },
        { message: "Unknown property 'type'", present: false },
        { message: "Unknown property 'properties'", present: false }
      ]
    },
    // Spec: misspelled property keys must be reported in all section types
    {
      fileName: 'sw-description-misspelled-keys.txt',
      expectations: [
        // images section typos
        { message: "Unknown property 'filname'", severity: vscode.DiagnosticSeverity.Warning },
        { message: "Unknown property 'sha56'", severity: vscode.DiagnosticSeverity.Warning },
        { message: "Unknown property 'compresed'", severity: vscode.DiagnosticSeverity.Warning },
        { message: "Unknown property 'encripted'", severity: vscode.DiagnosticSeverity.Warning },
        { message: "Unknown property 'install-if-diferent'", severity: vscode.DiagnosticSeverity.Warning },
        // files section typos
        { message: "Unknown property 'filesytem'", severity: vscode.DiagnosticSeverity.Warning },
        { message: "Unknown property 'preserv-attributes'", severity: vscode.DiagnosticSeverity.Warning },
        // scripts section typos
        { message: "Unknown property 'typ'", severity: vscode.DiagnosticSeverity.Warning },
        // partitions section typos
        { message: "Unknown property 'devic'", severity: vscode.DiagnosticSeverity.Warning }
      ]
    },
    // Type-check coverage: all remaining untested validator branches
    {
      fileName: 'sw-description-type-checks-invalid.txt',
      expectations: [
        // update-type empty string
        { message: "'update-type' should not be empty", severity: vscode.DiagnosticSeverity.Warning },
        // boolean key assigned a string
        { message: "Expected boolean value for 'reboot'", severity: vscode.DiagnosticSeverity.Warning },
        // hardware-compatibility array containing non-strings
        { message: "'hardware-compatibility' array should contain only strings", severity: vscode.DiagnosticSeverity.Warning },
        // type key assigned a number (not a string)
        { message: "Expected string value for 'type'", severity: vscode.DiagnosticSeverity.Warning },
        // compressed assigned a number (not string/boolean)
        { message: "Expected string or boolean value for 'compressed'", severity: vscode.DiagnosticSeverity.Warning },
        // ref assigned a boolean (not a string)
        { message: "Expected string value for 'ref'", severity: vscode.DiagnosticSeverity.Warning },
        // size assigned a boolean (not string/number)
        { message: "Invalid partition 'size' value. Expected number or string.", severity: vscode.DiagnosticSeverity.Error },
        // labeltype assigned a number (not a string)
        { message: "Expected string value for 'labeltype'", severity: vscode.DiagnosticSeverity.Error },
        // diskpart partition-N assigned a string instead of an array
        { message: "Expected array value for 'partition-1'", severity: vscode.DiagnosticSeverity.Warning }
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
