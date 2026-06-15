# @danielsimonjr/mathts-workbook

## 0.1.7

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.6

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.5` (special-function fixes) for the matched set.

## Unreleased

### Tests

- Raise vitest line coverage of the active workbook modules to ≥90% (subtotal 99.14%; `executor.ts` 100%, `graph.ts` 100%, `parser.ts` 94.44%, `types.ts` is type-only with no executable statements). Added 27 tests across three new suites: `parser-robustness.test.ts` (parser error/`catch` path via null/undefined/throwing input, cell-type precedence, `stripOutputs` immutability), `executor-modes.test.ts` (sequential/manual stale-suppression, `runAll` topological ordering, multi-dependency scope injection, undefined-dependency skip, YAML data-cell parsing, event ordering, multi-subscriber/double-unsubscribe), and `graph-cycles.test.ts` (3-node cycles, diamond-DAG no-cycle, dangling dependency ids, deduplicated transitive dependents). No production code changed.

## 0.1.5

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.4` (which now ships type declarations) to keep the matched MathTS set on one version.

## 0.1.4

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.3` to keep the matched MathTS package set on a single `expression`/`functions` version.

## 0.1.3

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.


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
  - @danielsimonjr/mathts-core@0.1.1
