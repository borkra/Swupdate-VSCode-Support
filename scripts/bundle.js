const esbuild = require('esbuild');

async function bundle() {
  await esbuild.build({
    entryPoints: ['client/src/extension.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: ['node16'],
    external: ['vscode'],
    outfile: 'client/out/extension.js',
    sourcemap: false,
    logLevel: 'info'
  });
}

bundle().catch((error) => {
  console.error(error);
  process.exit(1);
});
