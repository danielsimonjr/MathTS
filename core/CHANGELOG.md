# @danielsimonjr/mathts-core

## 0.1.4

### Minor Changes

- Add `BigNumber.toBinary()`, `toOctal()`, and `toHexadecimal()` (Decimal.js-compatible: `0b`/`0o`/`0x` prefixes, leading `-` for negatives, exact for integers and terminating fractions). These complete the radix-formatting surface the expression formatter's hex/bin/oct BigNumber path depends on.

## [Unreleased]

### Tests

- Raise vitest line coverage of the active core modules from ~80% to ~99% (every active file now ≥98%). Added 4 supplementary test files — `tests/types/complex-coverage.test.ts`, `tests/types/fraction-coverage.test.ts`, `tests/types/bignumber-coverage.test.ts`, `tests/typed/mathts-typed-coverage.test.ts` — plus `math.register`/`math.get` cases in `tests/factory/factory.test.ts`. These exercise previously-untested branches: `Complex` scalar-argument arithmetic, `format()` precision/notation paths, reciprocal/inverse trig & hyperbolic functions; `Fraction` scalar arithmetic, parse dispatch, continued-fraction round-trips, and integer floor/ceil short-circuits; `BigNumber` special-value (NaN/±Infinity/zero) branches across conversions, arithmetic, comparison, rounding modes, trig/hyperbolic/transcendental helpers, the `.e` getter, and the Decimal.js-compat aliases; and `mathts-typed` WASM init helpers, every `MATHTS_CONVERSIONS` convert callback, the duck-typed `isUnit`/`isMatrix`/`isDenseMatrix`/`isSparseMatrix` guards, and the full `TypeRegistry` lifecycle. No source changes — behavior-asserting tests only.

## 0.1.3

### Patch Changes

- Re-export `Unit` from the published build. `core@0.1.2` shipped to npm without `Unit` in its entry export block (the committed `dist` predated the Unit-export commit and was not rebuilt before publish), so downstream `@danielsimonjr/mathts-functions` hit `Unit is undefined`. Rebuilt so `dist/index.js` and `dist/index.d.ts` export `Unit` (`new Unit()`, `.to()`, `.toBest()`, `.value`, `.type`). Added a regression test that asserts the export against the built artifact so this cannot silently regress before a publish.


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
