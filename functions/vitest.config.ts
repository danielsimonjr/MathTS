import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Worker-pool suites need real headroom. vitest's DEFAULT testTimeout is
    // 5000ms, which was never calibrated for tests that dispatch to a worker
    // pool: `functions/tests/special.test.ts` runs in ~486ms unloaded but
    // ~3.3s under CPU contention (measured), and the full `npm run test` gate
    // runs EVERY package's suite concurrently — each with its own worker pool.
    // That left <10x headroom and produced a real, intermittent flake.
    //
    // This is not a blind threshold widen: the variance source is named (CPU +
    // worker contention during the concurrent full-gate run), and worker-pool
    // correctness under saturation is pinned separately by
    // `functions/tests/workerpool-stress.test.ts`. A genuine hang still fails,
    // just at 30s instead of 5s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
