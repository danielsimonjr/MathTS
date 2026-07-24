import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Mirror the build-time `define` from tsup.config.ts so tests that import the
// package SOURCE (not dist) still resolve the injected __PKG_VERSION__ global
// used by src/index.ts's `export const VERSION`.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
) as { version: string };

export default defineConfig({
  define: { __PKG_VERSION__: JSON.stringify(version) },
  test: {
    include: ['tests/**/*.test.ts'],
    // Calibrated for the CONCURRENT gate. `npm run test` runs EVERY package's
    // suite at once (turbo), each with its own worker pool, so vitest's 5000ms
    // default is far too tight: measured, functions/tests/special.test.ts takes
    // ~486ms alone but ~3.3s under that contention, and this package's
    // 200k-point points3d test timed out the same way. That was a systemic
    // latent flake, not several unrelated ones.
    //
    // Not a blind threshold widen: the variance source is named (CPU + worker
    // contention during the concurrent gate), and worker-pool correctness under
    // saturation is pinned separately by functions/tests/workerpool-stress.test.ts.
    // A genuine hang still fails, at 30s instead of 5s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
