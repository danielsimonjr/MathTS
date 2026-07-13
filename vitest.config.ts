import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/*.browser.test.ts', 'node_modules/**'],
    // GLOB, not an enumerated list. The old hand-listed form silently omitted
    // 11 packages — arithmetic, ast, evaluator, gpu, linalg, numbers, parser,
    // signal, statistics, trigonometry, units — so a root `npx vitest run` (and
    // `test:coverage`) skipped them entirely. It drifts every time a package is
    // added, and it did: `gpu` was missing the moment it was created.
    //
    // Every `*/tests` directory in this repo belongs to a workspace package
    // (verified), so a glob is both correct and self-maintaining.
    //
    // NOTE: `turbo run test` was never affected — it runs each package's own
    // vitest config. This was a root-aggregate/coverage gap only.
    include: [
      '*/tests/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'packages/*/tests/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/wasm/**/*.test.ts',
      // NOTE: `tests/benchmark/**` is deliberately NOT here — see `vitest.config.bench.ts`.
      // Those are WALL-CLOCK assertions ("100 ops under 200ms"). Run inside this
      // aggregate, alongside ~8,900 other tests, they measure machine contention
      // rather than the code: `DenseMatrix transpose 100x100` passes at ~100ms in
      // isolation and fails at ~212ms here. Widening the threshold would just hide
      // that. They now run in isolation via `npm run test:bench`, where the numbers
      // mean something.
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        // Core - active modules only
        'core/src/config.ts',
        'core/src/shared.ts',
        'core/src/utils.ts',
        'core/src/factory/**',
        'core/src/typed/**',
        'core/src/types/complex.ts',
        'core/src/types/fraction.ts',
        'core/src/types/bignumber.ts',
        // Matrix - active modules
        'matrix/src/DenseMatrix.ts',
        'matrix/src/SparseMatrix.ts',
        'matrix/src/types.ts',
        'matrix/src/config.ts',
        'matrix/src/backends/JSBackend.ts',
        'matrix/src/backends/Backend.ts',
        'matrix/src/backends/BackendManager.ts',
        'matrix/src/backends/WASMBackend.ts',
        'matrix/src/backends/WasmLoader.ts',
        'matrix/src/backends/wasm/**',
        'matrix/src/decomposition/**',
        'matrix/src/operations/**',
        // Functions - active typed functions + the GPU dispatch bridge
        'functions/src/typed/**',
        'functions/src/gpu/**',
        // GPU foundation leaf (was omitted when the package was created)
        'gpu/src/**',
        // Parallel - testable modules
        'parallel/src/ComputePool.ts',
        'parallel/src/ParallelMatrix.ts',
        'parallel/src/operations/elementwise.ts',
        'parallel/src/operations/matmul.ts',
        'parallel/src/operations/reduce.ts',
        'parallel/src/strategies/**',
        // Workbook - testable modules
        'workbook/src/parser.ts',
        'workbook/src/graph.ts',
        'workbook/src/executor.ts',
        'workbook/src/types.ts',
        // Compat - all active
        'compat/src/**',
        // Expression - active modules
        'expression/src/parse.ts',
        'expression/src/Parser.ts',
        'expression/src/operators.ts',
        'expression/src/keywords.ts',
        'expression/src/Help.ts',
        'expression/src/compiler/**',
        'expression/src/evaluator/**',
        'expression/src/node/**',
        'expression/src/function/**',
        'expression/src/utils/**',
      ],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.config.*', '**/index.ts'],
    },
  },
});
