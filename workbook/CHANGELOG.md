# @danielsimonjr/mathts-workbook

## 0.3.17

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.56.0
  - @danielsimonjr/mathts-plot@0.3.43

## 0.3.16

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.55.0
  - @danielsimonjr/mathts-plot@0.3.42

## 0.3.15

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.54.0
  - @danielsimonjr/mathts-plot@0.3.41

## 0.3.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.53.0
  - @danielsimonjr/mathts-plot@0.3.40

## 0.3.13

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.52.0
  - @danielsimonjr/mathts-plot@0.3.39

## 0.3.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.51.0
  - @danielsimonjr/mathts-plot@0.3.38

## 0.3.11

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.50.0
  - @danielsimonjr/mathts-plot@0.3.37

## 0.3.10

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.49.0
  - @danielsimonjr/mathts-plot@0.3.36

## 0.3.9

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.48.0
  - @danielsimonjr/mathts-plot@0.3.35

## 0.3.8

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.47.0
  - @danielsimonjr/mathts-plot@0.3.34

## 0.3.7

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.46.0
  - @danielsimonjr/mathts-plot@0.3.33

## 0.3.6

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.45.0
  - @danielsimonjr/mathts-plot@0.3.32

## 0.3.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.44.0
  - @danielsimonjr/mathts-plot@0.3.31

## 0.3.4

### Patch Changes

- Fix the exported `VERSION` constant, which had silently drifted from each package's published version.

  `VERSION` was a hardcoded string literal that Changesets never bumped, so it drifted: core reported `0.1.0`
  (was really 0.13.0), plot `0.2.0` (was 0.3.29), workbook `0.1.0` (was 0.3.3). Workbook's is user-facing —
  `mtsw version` (and `capabilities`/`introspect`) printed the wrong number.

  Root-cause fix (not a re-hardcode): `VERSION` is now injected at build time from each package's own
  `package.json` via a per-package `tsup.config.ts` (esbuild `define`, read Node-side so `package.json` is
  never bundled into `dist`). Tests import source, so the same define is mirrored into each `vitest.config.ts`;
  `core/tests/version.test.ts` now pins `VERSION` to `package.json` rather than a literal. `VERSION` can no
  longer drift from the published version.

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.1
  - @danielsimonjr/mathts-plot@0.3.30

## 0.3.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0
  - @danielsimonjr/mathts-functions@0.43.2
  - @danielsimonjr/mathts-expression@0.6.7
  - @danielsimonjr/mathts-plot@0.3.29

## 0.3.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0
  - @danielsimonjr/mathts-functions@0.43.1
  - @danielsimonjr/mathts-expression@0.6.6
  - @danielsimonjr/mathts-plot@0.3.28

## 0.3.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.43.0
  - @danielsimonjr/mathts-core@0.11.0
  - @danielsimonjr/mathts-expression@0.6.5
  - @danielsimonjr/mathts-plot@0.3.27

## 0.3.0

### Minor Changes

- ipynb export + kill-able worker-thread run timeout

  `mtsw export --format ipynb` renders a workbook to a Jupyter notebook (nbformat v4): markdown
  cells map to notebook markdown cells, code/equation/test/data/visualization cells to code cells with
  `execute_result`/`error`/`display_data` outputs. Sibling of the existing html/tex/pdf exporters.

  `runWorkbookWithTimeout(source, { timeoutMs })` (and `mtsw run --timeout <ms>`) runs the executor in a
  `worker_threads` worker and terminates it if it exceeds the budget, so a runaway/very-long cell no
  longer hangs the process — it rejects with `WorkbookTimeoutError`. The default in-process path is
  unchanged.

## 0.2.0

### Minor Changes

- First npm release — workbook release hold lifted

  `@danielsimonjr/mathts-workbook` (headless `.mtsw` notebook runtime + `mtsw` CLI:
  `run`/`validate`/`graph`/`export`) was held from npm since 2026-06-29 pending
  release-readiness. The hold is now lifted: build and the full test suite are green, and
  the package ships from the monorepo like the others. Publishing its debut.

## 0.1.8

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

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
