const esbuild = require('esbuild');

async function bundle() {
  await Promise.all([
    esbuild.build({
      entryPoints: ['client/src/extension.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: ['node16'],
      external: ['vscode'],
      outfile: 'client/out/extension.js',
      minify: true,
      sourcemap: false,
      logLevel: 'info'
    }),
    esbuild.build({
      entryPoints: ['server/src/server.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: ['node16'],
      outfile: 'server/out/server.js',
      minify: true,
      sourcemap: false,
      logLevel: 'info'
    })
  ]);
}

bundle().catch((error) => {
  console.error(error);
  process.exit(1);
});
