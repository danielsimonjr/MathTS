# @danielsimonjr/mathts-matrix

## 0.1.10

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-parallel@0.3.0

## 0.1.9

### Changed

- **Rust→AssemblyScript cutover (Phase 7b).** The matrix package now runs its
  heavy WASM ops on the AssemblyScript binary and the Rust backend is retired:
  - `WasmLoader` defaults to `mathts-as.wasm` (opt back into the legacy Rust
    `mathts.wasm` with `MATHTS_WASM_BACKEND=rust`). SHA-384 integrity
    verification is unchanged.
  - `svdWasm` → AS `matrix_svd`; `eigWasm` / `spectralRadiusWasm` → AS
    `matrix_eig_symmetric` / `matrix_spectral_radius`; FFT → AS `fft` / `rfft`
    / `powerSpectrum`. Each keeps its JS fallback. Singular values and FFT
    output are bit-identical to the JS references; eig parity is validated by
    the `A·v ≈ λ·v` residual.
  - Removed the `rust-wasm` backend (`RustWASMBackend`, `RustWasmLoader`), its
    registration, the `'rust-wasm'` `BackendType`, and the dead
    `rustWasmPreferredOps` / `rustWasmThreshold` routing in `BackendManager`.

  No public API changes to the matrix surface. The `lib/wasm/mathts.wasm` Rust
  binary is no longer referenced by this package.

## 0.1.8

### Changed

- Refreshed the bundled AssemblyScript wasm (`dist/wasm/mathts-as.wasm`) to the
  fixed `mathts-wasm@0.1.5` build (sha256 `338258aa…`). The previous bundle was
  built before the special-function accuracy fixes. No behavior change for the
  matrix package — it exposes only linear-algebra operations (always correct),
  not the Bessel/Airy kernels that were fixed — this just keeps the embedded
  binary in sync. Tests: 777 passed.

## 0.1.7

### Patch Changes

- Publish the 2026-06-22 dense-matrix work that was committed after `0.1.6` was published (npm `0.1.6`, dated 2026-06-15, predates these and was stale): direct `Float64Array` access in the dense arithmetic hot loops (≈5× faster 800×800 multiply), and packaging/resolution of the bundled AssemblyScript WASM (`dist/wasm/`) for published/bundled layouts. No API changes.

## 0.1.6

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.5

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## Unreleased

### Tests

- Raised vitest line coverage of the active matrix modules from ~70% to **94%
  subtotal** (every active file ≥ its reachable ceiling). New / expanded suites:
  - `operations/qr.test.ts` — full coverage of the Gram-Schmidt QR (0% → 100%):
    reduced/full modes, tall/wide/1×1, rank-deficient and all-zero fallbacks,
    `A = Q·R` reconstruction + `Qᵀ·Q = I` + upper-triangularity.
  - `backends/Backend.test.ts` (registry select/init/hints) and
    `backends/BackendManager.test.ts` (operation routing, error-fallback,
    adaptive-threshold tuning, config sync) — both ~15–56% → ≥96%.
  - `backends/WASMBackend-as.test.ts` — loads the real AssemblyScript artifact by
    explicit path so the managed-runtime allocation cache + every matrix/array
    kernel + the LU/QR/inverse/determinant/Cholesky decomposition kernels run
    against live WASM (52% → 96%), cross-checked vs JSBackend + math identities.
  - `backends/WasmLoader-as.test.ts`, `WasmLoader-browser.test.ts` — AS managed
    allocation, a hand-assembled no-runtime module to drive the Rust bump
    allocator, and the browser load/precompile arms via stubbed `fetch` /
    `instantiateStreaming` (38% → 89%).
  - `operations/svd-wasm-mock.test.ts`, `operations/eig-wasm-mock.test.ts`,
    `wasm/fft-wasm-mock.test.ts` — inject fake WASM loaders/modules to exercise
    the WASM-dispatch branches (which otherwise need the unbuilt Rust artifact),
    asserting correct marshalling and JS-fallback-on-failure behavior.
  - `security/wasm-integrity.test.ts` — added the manifest-missing-entry and the
    browser SHA-384 / `fetch`-manifest code paths (77% → 100%).
  - Extended `operations/{sqrtm,schur,logm}.test.ts` with edge cases
    (non-square/empty inputs, negative/complex-eigenvalue error paths, larger
    double-shift Schur sweeps, the exported Newton square-root helper).
  - No production code changed; the WASM SHA-384 integrity invariant is preserved.
  - Documented dead/unreachable code surfaced by this pass (no behavior change):
    `schur.ts#qrStepSingle` (the QR-step dispatch can only ever reach the
    double-shift branch), `logm.ts#logmEig` + inverse-scaling loop (the Schur-Padé
    path handles every real-eigenvalue case, and complex cases throw earlier in
    validation), and the never-populated AS memory pool in `WasmLoader.ts`.

## 0.1.4

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.

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

- Add SHA-384 integrity verification to all three matrix WASM load paths.

  `CLAUDE.md` documents the invariant: "functions/src/wasm/WasmLoader.ts
  and assembly/src/bindings/wasm-loader.ts both hash the .wasm buffer and
  compare to wasm-manifest.json before compile/instantiate." matrix's three
  loaders (WasmLoader.loadNodeWasm / loadBrowserWasm / precompile,
  RustWasmLoader.doLoad, WASMBackend.loadAsModule) all skipped this check
  — closed by adding `await verifyWasmIntegrity(buffer, path)` before every
  `WebAssembly.compile`. Browser streaming paths now refuse to stream when
  a manifest is present (streaming would race past `compile` un-verified).

  The matrix helper at `matrix/src/backends/wasm/integrity.ts` is a copy
  of the functions equivalent — matrix can't import functions's copy
  because functions depends on matrix (would create a dep cycle).

  Also closes the manifest-staleness bug surfaced when this change was
  landed: `wasm-rust/scripts/build.sh` now invokes
  `tools/generate-wasm-manifest.mjs` after copying the binary, so every
  Rust rebuild keeps the manifest in sync with the artifact it produced.
  Without this step, the new integrity check would reject every load after
  a rebuild.

  Regression test at `matrix/tests/security/wasm-integrity.test.ts`
  mirrors `functions/tests/security/wasm-integrity.test.ts`.

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
