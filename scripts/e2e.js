const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const {
  runTests,
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath
} = require('@vscode/test-electron');

const { extensionDependencies } = require('../package.json');

function installDependency(vscodeExecutablePath, extensionsDir, userDataDir) {
  const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

  const candidates = [
    process.env.LIBCONFIG_VSIX_PATH,
    ...extensionDependencies
  ].filter(c => c && (!c.endsWith('.vsix') || fs.existsSync(c)));

  for (const candidate of candidates) {
    try {
      execFileSync(cliPath, ['--install-extension', candidate, '--force', '--extensions-dir', extensionsDir, '--user-data-dir', userDataDir], { stdio: 'inherit' });
      return candidate;
    } catch (_) {}
  }

  throw new Error(`Failed to install extension dependencies: ${extensionDependencies.join(', ')}`);
}

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, '../client/out/test/index.js');
    const testWorkspace = path.resolve(__dirname, '../client/testFixture');
    const userDataDir = path.resolve(__dirname, '../.vscode-test/user-data');
    const extensionsDir = path.resolve(__dirname, '../.vscode-test/extensions');
    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

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
