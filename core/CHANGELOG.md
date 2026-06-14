# @danielsimonjr/mathts-core

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
