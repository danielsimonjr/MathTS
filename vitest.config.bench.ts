import { defineConfig } from 'vitest/config';

/**
 * Performance-regression suite — run in ISOLATION.
 *
 * `tests/benchmark/**` makes wall-clock assertions ("100 ops under 200ms"). Those
 * are only meaningful on a quiet machine: run inside the root aggregate alongside
 * ~8,900 other tests, `DenseMatrix transpose 100x100` passes at ~100ms alone and
 * fails at ~212ms under that contention. It was measuring the load, not the code.
 *
 * So these are excluded from the root aggregate and run here instead, on a single
 * thread with no concurrency, which is the only configuration in which a wall-clock
 * threshold means anything.
 *
 *   npm run test:bench
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/benchmark/**/*.test.ts'],
    exclude: ['**/*.browser.test.ts', 'node_modules/**'],

    // The whole point: no parallelism, so timings reflect the code under test.
    fileParallelism: false,
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: true },
    },

    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
