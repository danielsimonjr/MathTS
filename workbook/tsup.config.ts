import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read this package's own version at build time (Node-side) so package.json is
// never bundled into dist, and the exported VERSION can never drift from it.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
) as { version: string };

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts', 'src/run-worker.ts'],
  format: 'esm',
  // Declarations come from tsc (tsconfig.dts.json), not tsup: rollup-plugin-dts

  // needs TypeScript's programmatic Compiler API, absent in TS 7.0.

  dts: false,
  clean: true,
  define: { __PKG_VERSION__: JSON.stringify(version) },
});
