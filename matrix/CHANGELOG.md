# @danielsimonjr/mathts-matrix

## 0.6.3

### Patch Changes

- Resolve the deduplication campaign's final decisions: a compat compatibility correction and an internal WasmLoader consolidation.

  **compat (behavior change):** `zeros(n)` and `ones(n)` with a single argument now return a length-`n` **vector** (`[0,0,0]` / `[1,1,1]`), matching mathjs, instead of an `n×n` square matrix. Two-argument `zeros(r, c)` / `ones(r, c)` continue to return an `r×c` matrix. compat's purpose is mathjs compatibility, and the previous square result diverged from mathjs (`math.zeros(3)` is a size-`[3]` vector) — this was a bug. Anyone relying on `zeros(n)` returning a square must now pass `zeros(n, n)`.

  **core / functions / matrix (internal, no runtime behavior change):** the shared WASM-loader logic — the SHA-384 integrity verification (`sha384OfBuffer` / `verifyWasmIntegrity` / `loadWasmManifest`) and packaged-binary resolution (`resolvePackagedWasm` / `defaultWasmLocation`) — was byte-identical in `functions` and `matrix` and is now single-sourced in `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`), with each package injecting its own binary/manifest path. The SHA-384 verify-before-instantiate security invariant is preserved byte-for-byte (Node `crypto.createHash('sha384')` / browser `crypto.subtle.digest('SHA-384')`, mismatch throws), node built-ins stay behind lazy dynamic `import()`, and core's browser-safe `.` entry is unaffected. The per-package `WasmLoader` class stays local (distinct AS allocation models).

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0
  - @danielsimonjr/mathts-parallel@0.6.3

## 0.6.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0
  - @danielsimonjr/mathts-parallel@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.11.0
  - @danielsimonjr/mathts-parallel@0.6.1

## 0.6.0

### Minor Changes

- Rank-revealing pivoted QR, RQ/QL/LQ decompositions, and `condest`

  Adds `qrPivoted` (Businger-Golub column-pivoted rank-revealing QR — returns `{Q, R, P,
rank}` with `A[:,P]=Q·R` and `|diag(R)|` non-increasing), `rq`/`ql`/`lq` (the QR-family
  variants via the standard flip/transpose reductions), and `condest` (Hager/Higham 1-norm
  condition-number estimator using the existing LU factors, never forming `A⁻¹`). Verified by
  orthogonality/triangularity/reconstruction/rank/cond oracles vs numpy/scipy. Also fixes a
  degenerate-branch reflection in the shared `householder` helper (`beta=-2`→`2`) for the
  length-1 sub-column case that `qrPivoted` exercises.

## 0.5.0

### Minor Changes

- `eig` now exposes complex eigenvectors via a new `vectorsIm` field

  `EigResult` gains `vectorsIm: number[][]` (imaginary parts of the eigenvector
  columns; all-zero for real eigenvalues). JAMA's `hqr2` already computed the
  complex eigenvectors internally (EISPACK convention, stored across two adjacent
  columns of the real transform `V`) but the previous `number[][]` contract dropped
  them as zero columns. Complex-conjugate pairs are now emitted as
  `vectors[k] ± i*vectorsIm[k]`, unit-normalized by the complex 2-norm, with the
  residual `‖A·v − λ·v‖ ≈ 0` verified vs numpy for `{i,−i,3+i,3−i}`. Additive and
  non-breaking: `.values` and `.vectors` are unchanged for real spectra (and
  `.vectors` now carries the real part, previously zero, for complex eigenvalues).
  This unblocks a clean `funm`/`care` off the eigenvector basis.

## 0.4.6

### Patch Changes

- Remove dead `statsVariance`/`statsStd` WASM `AsModule` type declarations

  The internal `AsModule` interface in `matrix/src/backends/WasmLoader.ts` declared
  `statsVariance`/`statsStd` kernel signatures whose JS call paths were retired 2026-07-15
  (the corrected two-pass `variance`/`std` in core). No live caller referenced them. TS-only
  cleanup: the `.wasm` binary and its SHA-384 manifest are unaffected, and the
  general-library `array_variance`/`array_stddev` kernels are retained.

## 0.4.5

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-parallel@0.6.0

## 0.4.4

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-parallel@0.5.1

## 0.4.3

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-parallel@0.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-parallel@0.4.0

## 0.4.1

### Patch Changes

- Updated dependencies [ea044c4]
  - @danielsimonjr/mathts-gpu@0.2.0

## 0.4.0

### Minor Changes

- abbe883: Fix a 12× JS conversion tax on the GPU path, and correct the acceleration tier order.

  **The bug.** `elementwiseChainGpuDispatch` converted its input with
  `Float32Array.from(f64array)`. That is not the typed-array fast path — it is the generic
  `Array.from` algorithm, which walks the source through the ArrayLike/iterator protocol and
  runs `ToNumber` on every element. Naming the denominators, since they differ:

  - the **conversion alone** was **73× slower** — 433.32 ms versus 5.92 ms for
    `new Float32Array(x)` at n=2²⁰, for an identical result;
  - which made the **end-to-end dispatch 12.2× slower** — **439.80 ms → 36.06 ms** once fixed.

  Three sites were paying it, all on typed-array inputs: the f64→f32 input conversion, the
  f32→f64 conversion on the way back out, and `jsChain`'s copy — that last one slowing the
  **JS fallback tier for every user**, GPU or not.

  **The consequence.** That inflated figure is what made WASM appear to beat the GPU, and
  `functions@0.18.0` shipped a `fuseUnaryChainAsync` tier order of WASM → GPU → JS on the
  strength of it. With the tax removed the GPU is **3.2–8.3× faster than WASM**, so the order
  is now **GPU → WASM → JS**.

  **What changes for you.** Only if you call `enableGpu()`. That flag is the f32-precision
  consent, and the GPU tier will now actually run — so results carry ~7 significant digits
  instead of full f64, and are several times faster. With the flag off (the default) the path
  is exactly WASM → JS and results are bit-identical f64, as before. No result was ever
  incorrect; this is a performance and tier-selection change.

  ⚠️ **The blast radius of the process-global flag grew.** Previously a stray `enableGpu()`
  from a transitive dependency was largely harmless, because WASM ran first and shielded you.
  Now it silently downgrades every chain of ≥65,536 elements to f32. If that matters, pass
  `{ gpu: false }` per call — it overrides the global — or call `disableGpu()`.

  **matrix** (minor, not patch): the exported `DEFAULT_BACKEND_HINTS.gpuThreshold` changes
  100,000 → 65,536 and `DEFAULT_EXTENDED_HINTS.operationThresholds.transpose.gpu` 200,000 →
  65,536, so all GPU thresholds single-source `GPU_MIN_ELEMENTS`. The route is dormant in-tree
  (no `'gpu'` backend is ever registered), but `backendRegistry.register()` is public, so a
  consumer registering `GPUMatrixBackend` would see different routing.

## 0.3.2

### Patch Changes

- **Fix: published types did not compile on current TypeScript.**

  Found by compiling the _actually-packed artifacts_ against TypeScript 7 with
  `skipLibCheck: false`, in a clean project — not by checking the repo, which passes for
  reasons a consumer does not share.

  - **Duplicate WebGPU identifiers.** `gpu`/`matrix` shipped a hard
    `/// <reference types="@webgpu/types" />`. TypeScript ≥ 7's `lib.dom` now declares WebGPU
    itself, so the reference collided (`TS2300: Duplicate identifier 'GPUCommandBufferDescriptor'`).
    The reference is gone; `@webgpu/types` is now an **optional peerDependency** — modern TS
    supplies the types from `lib.dom`, and consumers on older TS can add the package.
  - **`ObjectWrappingMap` / `PartitionedMap` did not implement `Map`.** They assigned
    `[Symbol.iterator]` in the constructor through a cast, so it never appeared in the emitted
    type: `implements Map<K, V>` was a lie that only broke downstream (`TS2420`). Both now
    declare a real `[Symbol.iterator]()` whose return type is **derived from `Map` itself**
    (`ReturnType<Map<K, V>[typeof Symbol.iterator]>`), so it stays correct across TS versions —
    older libs say `IterableIterator`, TS ≥ 5.6 says `MapIterator` (which also needs
    `[Symbol.dispose]`).
  - **`functions` shipped a dangling import.** Its emitted `.d.ts` referenced `../types/index.js`,
    but the package's `files` only included `dist/`, so the module did not exist for consumers
    (`TS2307`). `types/` is now shipped.

- Updated dependencies
  - @danielsimonjr/mathts-gpu@0.1.1

## 0.3.1

### Patch Changes

- 8e9aadb: **Fix: published type declarations did not compile for consumers.**

  A consumer building with `skipLibCheck: false` could not compile against these packages:

  - `TS7016` — the `workerpool` fork declares `types: types/index.d.ts`, but that is a build
    output never committed and never generated for a `github:` dependency, so the module
    resolved fully **untyped**. `@danielsimonjr/mathts-workerpool` now ships a canonical ambient
    declaration (`workerpool.d.ts`) from `dist/` and references it from its own `index.d.ts`, so
    types resolve the same way for us and for consumers. The internal `paths` shims that had
    papered over this (compile-time only, never shipped) were removed, ending the two-tier
    reality where our builds passed and consumers' broke.
  - `TS2665` — `matrix`'s emitted `.d.ts` contained an illegal `declare module 'workerpool'`
    augmentation, inlined by the dts bundler from **516 stale generated `.d.ts` files that had
    accumulated inside `src/`** (untracked `tsc` emissions shadowing their sibling `.ts`). These
    were being picked up as build input and corrupting the published surface. Removed.

- Updated dependencies [8e9aadb]
  - @danielsimonjr/mathts-parallel@0.3.4

## 0.3.0

### Minor Changes

- 4b4ccd6: Extract the WebGPU foundation (device/context, buffer pool, and a generic
  shader manager) into a new shared `@danielsimonjr/mathts-gpu` leaf package.
  matrix's `GPUBackend` now imports the foundation from that package and registers
  its builtin matrix kernels onto the shared `ShaderManager`; the shared GPU device
  is coalesced behind a single, never-throw in-flight `getGpuDevice()`. Every GPU
  foundation symbol remains re-exported from `@danielsimonjr/mathts-matrix`, so no
  downstream consumer breaks. Pure refactor — no behavior change.

### Patch Changes

- b78b8bc: Fix the `sumReduce` WGSL kernel, which never compiled. It named its workgroup
  array `shared` — a **reserved keyword in WGSL** — so the shader failed to parse
  (`error: 'shared' is a reserved keyword`) and the reduction was permanently
  unusable on the GPU. The failure was silent: the compile error surfaced only as an
  uncaptured `GPUValidationError`, and nothing asserted on shader compilation. Renamed
  to `sdata`, and added a browser regression guard that compiles every builtin WGSL
  kernel and fails on any error-severity diagnostic.

## 0.2.2

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0

## 0.2.1

### Patch Changes

- 7b2b651: Remove 8 dead (unreachable, unexported, untested) source files surfaced by the upgraded dependency-graph tool: `expression` `ArgumentsError.ts`; `functions` `utils/{function,log,lruQueue,bignumber/constants}.ts` (a closed import subgraph reachable from nothing); `matrix` `types.ts`; `parallel` `workers/compute.worker.ts` (a superseded worker never built — `matrix.worker.ts` is the live one); `wasm` `env/abort.ts` (a custom AssemblyScript abort handler never wired via asconfig, tree-shaken by `asc`). None were reachable from any package entry point or build root, so the published bundles are byte-identical; this is a source-tree cleanup. Verified: build 22/22, wasm build, typecheck 28/28, test 44/44, eslint clean.
- Updated dependencies [7b2b651]
  - @danielsimonjr/mathts-parallel@0.3.3

## 0.2.0

### Minor Changes

- 583817d: B-4: `svd`'s `fullMatrices` option now works. It was accepted in `SVDOptions` (destructured with a claimed default of `true`) but **ignored** — factors were always thin. With `fullMatrices: true`, the thin factor is completed to a square orthonormal basis (U → m×m for tall inputs, V → n×n for wide ones) via modified Gram-Schmidt with re-orthogonalization, numpy `full_matrices=True` style, so the rectangular-Σ reconstruction `A = U·Σ·Vᵀ` holds exactly. The default is now honestly `false` (thin — the library's actual long-standing behavior, so no output shapes change for existing callers). The two `it.skip` tests blocked on this (tall 3×2, wide 4×6) are unskipped with orthonormality pins — the SVD suite has no skips left.

### Patch Changes

- 5f3b401: B-3: replace the dead `../../../lib/wasm/<file>` legacy fallback in all three wasm loaders (matrix `WasmLoader`, matrix `WASMBackend`, functions `WasmLoader`) with `defaultWasmLocation()` — a package-root-aware resolver that names the canonical `dist/wasm/<file>` location. The old fallback was only correct for the pre-bundling source layout: from a bundled `dist/` it resolved OUTSIDE the repo (the misleading `…/Github/lib/wasm/…` ENOENT warnings), and `<repo-root>/lib/wasm` no longer exists in any layout. The browser branch previously _only_ had the broken legacy URL and never tried the packaged location — it now returns the bundle-relative `./wasm/<file>` URL, which is correct for a served `dist/`. Behavior on the happy path is unchanged (the packaged artifact is found first, and both published tarballs ship it); what changes is that a missing binary now produces an actionable warning pointing at the real expected path, and browser consumers can actually load WASM.
- Updated dependencies [779fcde]
- Updated dependencies [538c672]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-parallel@0.3.2

## 0.1.14

### Patch Changes

- c041b4e: Fix SVD for exactly-rank-deficient matrices. `svd([[1,2],[2,4]])` returned σ₁ = √5 instead of 5 with a wrong `V` (no reconstruction) — corrupting `pinv` / `lowRankApprox` / `norm2` / `cond` on singular inputs. The bidiagonal Golub-Reinsch `handleZero` never folded the superdiagonal into the diagonal for a trailing/isolated exact-zero singular value. Now, when a zero singular value is detected, the decomposition is recomputed with a robust one-sided Jacobi SVD (with null-space basis completion so `U`/`V` stay orthonormal); the fast Golub-Reinsch path is unchanged for the full-rank common case. Exact reconstruction + orthonormal factors across 2×2 / 3×3 / wide / tall / zero, symmetric and non-symmetric.
- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0

## 0.1.13

### Patch Changes

- Scope the WASM backend to where SIMD actually wins. Matmul (SIMD `f64x2` kernel) and the dense LU/QR/Cholesky/inverse/determinant decompositions stay on WASM; element-wise ops, transpose, reductions, `eig`, and `svd` now run on JS — they were measured 0.2–6× slower on WASM (memory-bound or scalar). Removed the dead WASM branches from `WASMBackend`, repointed `eigWasm`/`svdWasm`/`spectralRadiusWasm` to the JS implementations, and dropped the matmul WASM threshold 500→256 (the SIMD kernel wins from 16²). Results are unchanged; small matmuls are faster and the backend carries less dead code.

## 0.1.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0

## 0.1.11

### Patch Changes

- Matrix-factory acceleration + a matrix eigensolver correctness fix + forward-mode AD.

  **fix(matrix): eig — wrong eigenvalues for symmetric matrices with structural zeros.**
  The symmetric-only Givens/Wilkinson eigenvalue path returned grossly wrong
  eigenvalues for symmetric matrices with off-diagonal zeros (e.g. the tridiagonal
  `[[2,-1,0],[-1,2,-1],[0,-1,2]]` gave `[19.05, 2, 0.94]` — sum 22 ≠ trace 6 —
  instead of `[0.586, 2, 3.414]`). Fixed by routing all matrices through the robust
  JAMA orthes/hqr2 solver (verified vs numpy). This also repairs latent wrong
  results in `tensorEig`/`tensorEigWasm`. Note: eigenvectors for symmetric input now
  follow the general solver's convention (they are sign-ambiguous; A·v = λ·v holds).

  **perf(functions): det / inv accelerated.** Large (≥8×8) numeric square matrices
  now route `det` (~20× on 80×80) and `inv` (~9×) through the native Float64Array
  LU instead of boxed `number[][]`. numpy-verified; small / non-numeric / singular
  inputs fall back to the factory unchanged.

  **feat(functions + core): forward-mode automatic differentiation.** A new scalar
  `Dual` type (core, registered for typed dispatch) plus `Dual` signatures on the
  elementary functions (add/sub/mul/div/pow/sin/cos/tan/exp/log/sqrt/square/cube/
  cbrt/abs) make the ordinary functions API differentiable. New entry points
  `derivativeAt` / `valueAndDerivativeAt` / `gradientAt`:

      derivativeAt((x) => multiply(sin(x), x), 2)   // sin(2) + 2·cos(2), exact

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0

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
