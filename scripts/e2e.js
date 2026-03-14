const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const {
  runTests,
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath
} = require('@vscode/test-electron');

const LIBCONFIG_EXTENSION_IDS = [
  'borkra.libconfig-lang',
  'boris-krasnovskiy.libconfig-lang'
];

function installDependency(vscodeExecutablePath, extensionsDir, userDataDir) {
  const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
  let lastError = null;

  for (const extensionId of LIBCONFIG_EXTENSION_IDS) {
    try {
      execFileSync(
        cliPath,
        [
          '--install-extension',
          extensionId,
          '--force',
          '--extensions-dir',
          extensionsDir,
          '--user-data-dir',
          userDataDir
        ],
        { stdio: 'inherit' }
      );
      return extensionId;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Failed to install LibConfig dependency. Last error: ${String(lastError)}`);
}

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, '../client/out/test/index.js');
    const testWorkspace = path.resolve(__dirname, '../client/testFixture');
    const userDataDir = path.resolve(__dirname, '../.vscode-test/user-data');
    const extensionsDir = path.resolve(__dirname, '../.vscode-test/extensions');
    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(extensionsDir, { recursive: true });

    const installedDependency = installDependency(vscodeExecutablePath, extensionsDir, userDataDir);
    console.log(`Installed test dependency: ${installedDependency}`);

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        '--extensions-dir',
        extensionsDir,
        '--user-data-dir',
        userDataDir
      ]
    });
  } catch (err) {
    console.error('Failed to run extension tests');
    console.error(err);
    process.exit(1);
  }
}

main();
