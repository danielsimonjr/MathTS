# @danielsimonjr/mathts-parallel

## 0.1.3

### Patch Changes (Security — additive)

- 862ae30: `WorkerPool.execute()` now accepts an optional `timeoutMs`
  argument. When the worker does not reply within `timeoutMs` the pool
  calls `worker.terminate()`, evicts the dead worker from its rosters,
  spawns a replacement so capacity is preserved, and rejects with
  `"Worker task timed out after Nms"`. Pass `0` or omit to keep legacy
  untimed behaviour. Closes a DoS vector where a hung worker could block
  the queue indefinitely. Adds `parallel/tests/WorkerPool.timeout.test.ts`
  (2 tests).

## 0.1.1

### Patch Changes

- e771b4e: Fix all pre-existing build, typecheck, and configuration issues across the monorepo.

  ### assembly/ (WASM)
  - Fix AssemblyScript build: prefix 114 bare math calls with `Math.`, fix abort path in asconfig.json
  - Add 6 missing inverse trig methods to Complex class (asin, acos, atan, asinh, acosh, atanh)
  - Fix complex_pow calling wrong method (pow → powReal for f64 args)

  ### expression/
  - Enable build: fix broken types.ts import, create tsconfig.json, restore build script
  - Copy shared mathjs utils into package, fix 60+ import paths
  - Export missing types (CompiledExpression, StringOptions), clean up unused @ts-expect-error directives

  ### parallel/ + matrix/ + compat/
  - Fix typecheck failures caused by workerpool shipping raw .ts sources
  - Create workerpool type stub (parallel/types/workerpool.d.ts) with full declarations
  - Redirect workerpool resolution via tsconfig paths in all affected packages

  ### All packages
  - Add @types/node to all 7 workspace package devDependencies
  - Add vitest.config.ts to 5 packages missing local test configs
  - Fix missing beforeAll/afterAll imports in ParallelMatrix tests

- Updated dependencies [e771b4e]
  - @danielsimonjr/mathts-workerpool@0.1.1
