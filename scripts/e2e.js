const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, '../client/out/test/index.js');
    const testWorkspace = path.resolve(__dirname, '../client/testFixture');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testWorkspace, '--disable-extensions']
    });
  } catch (err) {
    console.error('Failed to run extension tests');
    console.error(err);
    process.exit(1);
  }
}

main();
