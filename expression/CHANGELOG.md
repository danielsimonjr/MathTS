# @danielsimonjr/mathts-expression

## 0.2.2

### Patch Changes

- Export `createParser` (the `math.parser()` instance factory) from the package entry. It was already implemented in `src/function/parser.js` but absent from the public index; this makes the stateful, scope-aware Parser instance factory available to consumers (and to the new `@danielsimonjr/mathts-parser` package).

## 0.2.1

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.


## 0.2.0

### Minor Changes (Security — BREAKING)

- 6e76d62: Restore RCE sandbox in tree-walking compiler. `evaluate()` and
  `compileExpression()` now default-reject `AssignmentNode`,
  `FunctionAssignmentNode`, and `FunctionNode` calls to denylisted builtins
  (`import`, `createUnit`, `evaluate`, `parse`, `compile`, `simplify`,
  `derivative`, `help`, `chain`). All five compile sites
  (`compileAccessorNode`, `compileAssignmentNode`, `compileObjectNode`,
  `compileSymbolNode`, `compileFunctionNode`) route through
  `getSafeProperty` / `setSafeProperty` / `getSafeMethod`. Hosts that need
  the legacy permissive behaviour can opt out with `{ unsafe: true }`.
  Adds `expression/tests/security/sandbox.test.ts` (13 tests).

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
