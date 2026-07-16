# @danielsimonjr/mathts-compat

## 0.3.15

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.29.0

## 0.3.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.28.0

## 0.3.13

### Patch Changes

- Updated dependencies [1174c41]
  - @danielsimonjr/mathts-functions@0.27.0

## 0.3.12

### Patch Changes

- Updated dependencies [199da08]
  - @danielsimonjr/mathts-functions@0.26.0

## 0.3.11

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-functions@0.25.0
  - @danielsimonjr/mathts-parallel@0.6.0
  - @danielsimonjr/mathts-matrix@0.4.5

## 0.3.10

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-functions@0.24.0
  - @danielsimonjr/mathts-matrix@0.4.4
  - @danielsimonjr/mathts-parallel@0.5.1

## 0.3.9

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-functions@0.23.0
  - @danielsimonjr/mathts-parallel@0.5.0
  - @danielsimonjr/mathts-matrix@0.4.3

## 0.3.8

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-functions@0.22.0
  - @danielsimonjr/mathts-parallel@0.4.0
  - @danielsimonjr/mathts-matrix@0.4.2

## 0.3.7

### Patch Changes

- Updated dependencies [ea044c4]
  - @danielsimonjr/mathts-functions@0.21.0
  - @danielsimonjr/mathts-matrix@0.4.1

## 0.3.6

### Patch Changes

- Updated dependencies [b7784ef]
  - @danielsimonjr/mathts-functions@0.20.0

## 0.3.5

### Patch Changes

- Updated dependencies [abbe883]
  - @danielsimonjr/mathts-functions@0.19.0
  - @danielsimonjr/mathts-matrix@0.4.0

## 0.3.4

### Patch Changes

- Updated dependencies [7c53d7f]
  - @danielsimonjr/mathts-functions@0.18.0

## 0.3.3

### Patch Changes

- Updated dependencies [b78b8bc]
- Updated dependencies [2353e0a]
- Updated dependencies [908f19b]
- Updated dependencies [4b4ccd6]
  - @danielsimonjr/mathts-matrix@0.3.0
  - @danielsimonjr/mathts-functions@0.17.0

## 0.3.2

### Patch Changes

- Updated dependencies [557e27f]
  - @danielsimonjr/mathts-functions@0.16.0

## 0.3.1

### Patch Changes

- Updated dependencies [86f786e]
  - @danielsimonjr/mathts-functions@0.15.0

## 0.3.0

### Minor Changes

- 1df691c: **GC12 — `config()` now drives behavior + compat uses the real functions types.**

  - functions gains a `config()` accessor (`config-api.ts`): read the global runtime config, or pass a partial to merge it. Functions read this shared object live at call time (e.g. `identity`/`range`'s `config.matrix === 'Array'` return-type switch, `zeta`'s `config.relTol`), so `config({ matrix: 'Array' })` genuinely changes results. It is process-global (the functions surface is a singleton), not per-instance like mathjs `create()`.
  - compat's `config()` was **inert** (mutated a private object nothing read); it now forwards to `functions.config`, so `math.config({ matrix: 'Array' })` drives the functions surface, and `create(all, { … })` seeds it.
  - Deleted `compat/src/functions.d.ts` — an outdated ambient `declare module` stub (21 functions) whose own header said "until the functions package has proper .d.ts files." It was **shadowing** the real, complete functions types, so `import * as F` saw an empty namespace (even `F.zeta`/`F.cbrt` were invisible). compat now type-checks against the real 829-export surface. This closes GC12's "widen functions.d.ts" at root cause.

  Config is now process-global: a `delegation` test that asserted per-instance isolation was updated to reflect this (isolation was only ever "true" because config did nothing).

### Patch Changes

- Updated dependencies [1df691c]
- Updated dependencies [f2211c8]
  - @danielsimonjr/mathts-functions@0.14.0

## 0.2.11

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0
  - @danielsimonjr/mathts-functions@0.13.2
  - @danielsimonjr/mathts-matrix@0.2.2

## 0.2.10

### Patch Changes

- Updated dependencies [598e72d]
- Updated dependencies [ce8f929]
  - @danielsimonjr/mathts-functions@0.13.0

## 0.2.9

### Patch Changes

- Updated dependencies [779fcde]
- Updated dependencies [583817d]
- Updated dependencies [538c672]
- Updated dependencies [5f3b401]
  - @danielsimonjr/mathts-functions@0.12.0
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-matrix@0.2.0
  - @danielsimonjr/mathts-parallel@0.3.2

## 0.2.8

### Patch Changes

- Updated dependencies [dc14440]
- Updated dependencies [18871e1]
  - @danielsimonjr/mathts-functions@0.11.0

## 0.2.7

### Patch Changes

- Updated dependencies [dfb1b25]
- Updated dependencies [23642f2]
  - @danielsimonjr/mathts-functions@0.10.0

## 0.2.6

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [c041b4e]
- Updated dependencies [c041b4e]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-functions@0.9.0
  - @danielsimonjr/mathts-matrix@0.1.14

## 0.2.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.8.0

## 0.2.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.1
  - @danielsimonjr/mathts-functions@0.7.0

## 0.2.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.6.0

## 0.2.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-functions@0.5.0
  - @danielsimonjr/mathts-matrix@0.1.12

## 0.2.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-functions@0.4.0
  - @danielsimonjr/mathts-matrix@0.1.11

## 0.2.0

### Minor Changes

- - **feat (GC12):** fluent `chain` API — `math.chain(3).add(4).multiply(2).done()`.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @danielsimonjr/mathts-functions@0.3.0
  - @danielsimonjr/mathts-parallel@0.3.0
  - @danielsimonjr/mathts-matrix@0.1.10

## 0.1.9

### Patch Changes

- `add`/`subtract`/`multiply` are now variadic (mathjs parity): they fold over all arguments instead of dropping the 3rd+ operand. Previously `add(1, 2, 3)` returned `3` and `multiply(2, 3, 4)` returned `6`. Matrix operands and 2-arg calls are unchanged.
- Repin to `@danielsimonjr/mathts-core@^0.1.5` and `@danielsimonjr/mathts-functions@^0.2.8`.

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

- Raise vitest line coverage of `compat/src/**` to 100% (`shims.ts` 159/159 lines, up from 95%). Added 19 tests across two new files:
  - `tests/coverage-gaps.test.ts` — factory pass-through (same `Fraction`/`BigNumber`/`DenseMatrix`/`SparseMatrix` instance returned unchanged), empty `sparse()` constructor, `det()` edge cases (0x0 empty matrix returns 1, `TypeError` on `SparseMatrix` input, 4x4 singular matrix returns 0 via the LU pivot-underflow path), and `size()` on matrix objects.
  - `tests/delegation.test.ts` — `create(all)` builds a mathjs-compatible instance whose arithmetic/statistics/rounding/type-creation surface delegates to the core types and functions ops, with per-instance config isolation.
- Add a `test:coverage` npm script to `compat/package.json` for parity with sibling packages.

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
  - @danielsimonjr/mathts-matrix@0.1.1
  - @danielsimonjr/mathts-functions@0.1.1
  - @danielsimonjr/mathts-parallel@0.1.1
