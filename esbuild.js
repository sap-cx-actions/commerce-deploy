// build.js
const { build } = require('esbuild');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: 'dist/index.js',
  platform: 'node',
  target: 'node20'
}).catch(() => process.exit(1));
