import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Calibrated for the CONCURRENT gate. `npm run test` runs EVERY package's
    // suite at once (turbo), each with its own worker pool, so vitest's 5000ms
    // default is far too tight: measured, functions/tests/special.test.ts takes
    // ~486ms alone but ~3.3s under that contention. This produced a real,
    // intermittent flake across several packages.
    //
    // Not a blind threshold widen: the variance source is named (CPU + worker
    // contention during the concurrent gate), and worker-pool correctness under
    // saturation is pinned separately by functions/tests/workerpool-stress.test.ts.
    // A genuine hang still fails, at 30s instead of 5s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts', 'test/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
