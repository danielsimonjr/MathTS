# @danielsimonjr/mathts-matrix

## 0.1.3

### Patch Changes

- 3d218f5: Fix matrix WASM JS-fallback determinant sign and Windows WASM-loader path.
  - **`determinantJS` sign bug.** The JS fallback computed the permutation parity
    by counting positions where `perm[i] !== i`. That matches actual transposition
    count only when every cycle is a 2-cycle; for any 3-cycle (or larger) it gives
    the wrong parity. Replaced with cycle-decomposition: `sign(P) = (-1)^(n - cycles)`.
    Caught by `tests/wasm/decompositions-as.test.ts > matrix_determinant ...` for
    a 3×3 with a single 2-cycle that surfaced the off-by-`±2` regression.
  - **Windows doubled-drive path.** `URL.pathname` of a `file:///C:/...` URL is
    `/C:/...`, which `fs.readFile` then resolves as drive-relative
    (`C:\C:\...`). All three callers (`WasmLoader.getDefaultWasmPath`,
    `RustWasmLoader.findWasmPath`, `WASMBackend.resolveAsWasmPath`) now use
    `fileURLToPath` for the Node branch, which is cross-platform correct and
    decodes URL %-escapes. Browser branches continue to return `.href` for
    `fetch()`.

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
  - @danielsimonjr/mathts-parallel@0.1.1
