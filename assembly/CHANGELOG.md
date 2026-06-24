# @danielsimonjr/mathts-wasm

## 0.1.4

### Patch Changes (Packaging fix)

- Fix package entry points: `main`, `types`, and the `.` export pointed at
  `build/release.js` / `build/release.d.ts`, which the AssemblyScript build
  never emits (asconfig's release target outputs `build/mathts.wasm` with ESM
  bindings `build/mathts.js` / `build/mathts.d.ts`). A direct
  `import '@danielsimonjr/mathts-wasm'` therefore resolved to a nonexistent
  file in 0.1.1–0.1.3. Entry points now reference the real `build/mathts.js`
  / `build/mathts.d.ts`. No source or WASM-binary changes — the `mathts.wasm`
  binary is byte-identical to 0.1.3.

## 0.1.3

### Patch Changes (Security — additive)

- 3ef899c: `loadWasm()` in `assembly/src/bindings/wasm-loader.ts` now
  verifies a SHA-384 manifest before compile in both `fetch` and
  `fs.readFileSync` paths. Mismatch throws before instantiation. Manifest
  defaults to soft-fail when absent for legacy compat.

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
