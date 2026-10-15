import { defineConfig } from 'tsdown';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read this package's own version at build time (Node-side) so package.json is
// never bundled into dist, and the exported VERSION can never drift from it.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
) as { version: string };

export default defineConfig({
  entry: ['src/index.ts', 'src/render-file.ts'],
  format: 'esm',
  // Declarations come from tsc (tsconfig.dts.json), not tsdown: rolldown-plugin-dts

  // needs TypeScript's programmatic Compiler API, absent in TS 7.0.

  dts: false,
  // Keep `.js` (the package is `type: module`); tsdown's node default is `.mjs`.
  fixedExtension: false,
  // tsup (esbuild) dropped JSDoc from the JS output; tsc already carries it into the .d.ts.
  outputOptions: { comments: { legal: true, annotation: true, jsdoc: false } },
  clean: true,
  define: { __PKG_VERSION__: JSON.stringify(version) },
});
