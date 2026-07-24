import { defineConfig } from 'tsup';
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
  dts: true,
  clean: true,
  define: { __PKG_VERSION__: JSON.stringify(version) },
});
