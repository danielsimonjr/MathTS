import { defineConfig } from 'tsup';

/**
 * Re-export barrels only. Dependencies stay external so the published tarball
 * does not inline `@danielsimonjr/mathts-functions` (or its WASM binary).
 * Declarations come from `tsc -p tsconfig.dts.json`, not tsup: rollup-plugin-dts
 * needs TypeScript's programmatic Compiler API, which TypeScript 7 does not have.
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/functions.ts', 'src/tensor.ts', 'src/autograd.ts'],
  format: 'esm',
  dts: false,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    '@danielsimonjr/mathts-functions',
    '@danielsimonjr/mathts-tensor',
    '@danielsimonjr/mathts-autograd',
  ],
});
