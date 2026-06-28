# @danielsimonjr/mathts-functions

## Unreleased

### Changed — eslint `no-explicit-any`/`no-unsafe-function-type` cleanup (subset-2)

- Drove the `functions/src` dirs `utils`, `type`, `core`, `arithmetic`, and
  `complex` toward zero eslint warnings, replacing `any`/`Function` with real
  project types (`MathCollection`, `Matrix`, `Complex`, `BigNumber`, `Fraction`,
  `Unit`, `AlgorithmFunction`, `MatrixCallback`, `TypedFunction`, structural
  `unknown`+documented-narrow casts). Behavior-preserving (no logic changes);
  the functions suite stays green (2902 pass / 41 skip) and `tsc --noEmit` is 0.
- `utils`, `core`, `arithmetic`, `complex`: 0 warnings. `type/`: 0 except the
  single legacy `type/unit/Unit.ts` (still `@ts-nocheck`), which needs a
  dedicated comprehensive typing pass (see code TODO).
- Two documented `eslint-disable` lines remain in `utils/factory.ts` for the
  irreducible generic-dependency `any` default that every untyped factory across
  the repo relies on (tightening it would require annotating every factory's
  deps object).

## 0.2.14

### Added — WASM acceleration tripled (3-tier gap-fill, effective-wasm 6 → 18)

- **Tier 1 — 11 more transcendentals WASM-accelerated:** `atan, sinh, tanh,
  atanh, expm1, log1p, log2, log10, sec, csc, cot` over `Float64Array` ≥ 1024 now
  dispatch to new Rust `simd_*_array` kernels — benchmark-confirmed 1.4–5× over
  JS incl. the JS↔wasm copy (`npm run bench:transcendental`). Measured losers
  left on JS (hardware-fast / fast-JS): `sqrt, cbrt, asin, acos, cosh, asinh,
  acosh`.
- **Tier 2 — `erfc` WASM-accelerated:** ~5–7× (its JS is a continued-fraction
  scalar, far costlier than `Math.*`). Verified <1e-12 vs the JS scalar.
- **Tier 3 — op-fusion:** new `fuseUnaryChain(ops, xs)` keeps an array resident
  in wasm across a chain of unary ops, paying the JS↔wasm copy **once** instead
  of per op — 2.4–3.1× over JS for a 4-op chain (`npm run bench:fusion`). Falls
  back to a sequential JS pass when wasm is unavailable.
- Requires the Rust wasm rebuilt (`npm run build:wasm:rust`); 19 new
  `simd_*_array` kernels in `wasm-rust/.../compat/simd_array.rs`. All paths
  verified correct (`tests/diff-elementwise`, `tests/diff-fusion`); full suite
  2882 pass.

## 0.2.13

### Added — elementwise transcendentals now WASM-accelerated

`abs`, `sin`, `cos`, `tan`, `exp`, `log` over `Float64Array` (length ≥ 1024)
now dispatch to the Rust `simd_*_array` kernels instead of plain JS. Benchmarked
net-faster than JS **including** the JS↔wasm copy (`npm run bench:elementwise`):
abs 2.7–5.1×, sin 1.6–2.4×, cos 1.6–2.2×, exp 1.4–2.1×, log 1.5–2.2×, tan 1.35–1.9×.
(`sqrt` excluded — hardware `Math.sqrt` beats wasm+copy; reductions excluded —
JS JITs `sum`/`mean` faster than wasm+copy.) Correctness verified <1e-12 vs JS
(`tests/diff-elementwise.test.mjs`).

These ops previously ran in plain JS: their `ComputePool` thresholds are
`'never'`, so the "parallel" overloads never actually parallelized.

Implementation note: the Rust wasm exports only `memory` (no allocator), and
the loader's `allocateFloat64Array` is AssemblyScript-only (`__new`), so the new
`elementwise/wasm-bridge.ts` manages its own JS-side scratch region over
`module.memory`. (The special-function bridge gracefully falls back to JS for
the Rust backend for the same allocator reason — a future enhancement, not a
defect.)

## 0.2.12

### Added — WASM acceleration now bundled and live

The package now **bundles the Rust wasm** (`dist/wasm/mathts.wasm`) and resolves
it package-relative, so the special-function array bridges (J/Y/Airy/elliptic/
Carlson/lgamma, ≥1024 elements) actually run on wasm instead of silently falling
back to JS. Previously no binary was bundled and the loader's hard-coded
monorepo-relative path resolved outside the installed package.

- `src/wasm/resolve.ts`: robust `resolvePackagedWasm` (walks up probing
  `dist/wasm/`), mirroring the matrix package. `WasmLoader` uses it.
- `scripts/copy-wasm.mjs`: build step copying `lib/wasm/mathts.wasm` +
  `wasm-manifest.json` into `dist/wasm/`.
- 10 previously-skipped wasm integration tests now run and pass.

### Fixed — Rust wasm special functions

The bundled Rust kernels carried the **same** special-function bugs as the JS
path (NR-rational Bessel, unstable `besselJn` recurrence + Miller off-by-one,
Airy asymptotic coefficient recurrence missing the `(2k-1)` factor with wrong
hardcoded `c5/c6`, low-accuracy `erfc`). Ported the same fixes to
`wasm-rust/crates/mathts-wasm/src/{bessel.rs,special/functions.rs}` and rebuilt.
Verified 90/90 vs mpmath (`tests/diff-wasm-rust.test.mjs`). Enabling wasm
therefore does **not** regress the special-function accuracy fixed in 0.2.11.

## 0.2.11

### Fixed (special-function accuracy)

A new differential audit (`npm run test:diff`, mpmath goldens, 187 cases)
found the special-function library carried the same defects as the wasm
kernels. All now pass to <1e-9. Fixes applied consistently across the three
implementations: the typed scalars (`src/typed/special.ts`), the worker-
kernel path, and the wasm-bridge JS fallback (`src/wasm/special/wasm-bridge.ts`).

- **Bessel J0/J1/Y0/Y1**: replaced low-order NR rational approximations
  (~1e-7 for J, ~1e-4 for Y) with ascending series (|x| <= 13) + Hankel
  asymptotic.
- **`besselJ` recurrence**: upward recurrence is unstable for n > x — those
  cases now use Miller's backward recurrence (was: forward whenever n <= 20,
  giving up to ~1e-3 error, e.g. J5(1)); fixed a Miller off-by-one that
  returned J_{n+1}.
- **`besselK`**: replaced A&S polynomial approximations (~1e-8) with the
  DLMF 10.31.2 ascending series + asymptotic.
- **Airy Ai/Bi**: the asymptotic-coefficient recurrence omitted the (2k-1)
  factor (DLMF 9.7.2), making u_2 onward wrong and corrupting both branches
  (~1e-4 at Ai(-5)); the positive branch additionally used hardcoded c_5/c_6
  that were wrong. Coefficients now generated correctly; series threshold
  raised to |x| = 5 so the crossover stays accurate.
- **`erfc`**: was `1 - erf`, losing precision in the tail (~6e-8); now uses
  the Abramowitz & Stegun 7.1.14 continued fraction directly for the tail.

No public API changes.

## 0.2.10

### Fixed

- **`add` / `multiply` are now variadic over any type (mathjs parity).** They previously declared only a `'number, number, ...number'` variadic, so 3+ arguments of `Complex` (or mixed number/Complex) threw `Too many arguments (expected 2, actual 3)`. This silently broke `polynomialRoot`'s cubic branch, whose rawRoots step calls `add(b, C, divide(Delta0, C))` with a complex cube root `C`. The variadic is now `'any, any, ...any'`, folding pairwise through the binary op. (A prior note had misattributed this to a typed-function "nested-dispatch" bug — typed-function was correct; the gap was purely the number-only variadic signature.)
- **`polynomialRoot`'s cubic branch is functional again** (real, complex, and repeated roots), unblocked by the variadic fix above.

### Changed

- **`solve` (CAS) now delegates degree-≤3 root-finding to `polynomialRoot`** instead of duplicating quadratic/cubic formulas. It retains coefficient extraction, root cleaning (sorted reals then complex), and the numeric fallback for degree ≥ 4 / transcendental equations. Behavior and the public return shape are unchanged.

## 0.2.9

### Minor Changes

- `solve(equation, variable)` (CAS) upgraded from numeric-real-only to a full equation solver: accepts both expression form and `lhs = rhs` form; returns **exact closed-form roots** for polynomials of degree ≤ 3, **including complex conjugates** (`solve('x^2 + 1 = 0', 'x')` → `[Complex(0,1), Complex(0,-1)]`; `solve('x^3 - 8', 'x')` → `[2, Complex(-1, √3), Complex(-1, -√3)]`). Degree ≥ 4 and transcendental equations keep the numeric real-root scan. Real roots are returned first (cleaned of float noise, sorted ascending, deduped) followed by complex roots. The return type widens from `number[]` to `Array<number | Complex>`; existing real-root behavior is unchanged.

## 0.2.8

### Patch Changes

- `Complex` (functions-local) gains long-name aliases `subtract`/`multiply`/`divide`/`negate` (symmetric with the short names already present), so a `Complex` of either origin satisfies either calling convention.
- `MathJSDenseMatrix` now handles 1-D matrices in `toArray`/`map`/`forEach`/`clone` (single-axis indices, flat data). Previously these assumed 2-D and threw `row2 is not iterable` on 1-D results such as `cbrt(x, true)`.
- Repin to `@danielsimonjr/mathts-core@^0.1.5`.

## 0.2.7

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.2.6

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.2.5

### Patch Changes

- Fix `besselY1`, `cosIntegral` (Ci), and `airyAi`/`airyBi` returning wrong values (corrupted coefficients / divergent asymptotic series) in `src/typed/special.ts`, with regression tests. Raised `typed/` line coverage to 92%.

## Unreleased

### Tests

- Raise vitest line coverage of the active typed-dispatch layer (`src/typed/**`)
  from **77.95% to 92.01%** (subtotal over the coverage-scoped `typed/` files).
  Added 12 `cov-*.test.ts` suites under `tests/` (~480 new tests) covering the
  previously-uncovered Complex / Fraction / BigNumber / bigint scalar
  signatures, mixed-type coercion overloads, sequential (below-threshold)
  Float64Array fallbacks, error/edge paths, and the worker-dispatch fan-out
  branches (which the prior suites missed because they never initialized
  `computePool`). All assertions check real, correct mathematics through the
  typed dispatch — no coverage-gaming.
- Every coverage-scoped `typed/` file is now ≥90% line coverage **except**
  `geometry.ts` (81.9%), `numeric.ts` (86.8%), and `signal.ts` (84.4%), whose
  remaining uncovered lines are Rust-WASM kernel-dispatch blocks
  (`if (wasm) { … }`). These are dead in a pure-JS environment because the
  gitignored `lib/wasm/mathts.wasm` artifact is not built (no Rust toolchain in
  CI). The new tests cover every JS-reachable branch of those files; the WASM
  tiers self-skip when the artifact is absent.

### Fixed

- **`special.ts` `besselY1` (small-x, x < 8):** restored the correct
  Numerical-Recipes `bessy1` rational-approximation coefficients and the
  missing leading `x *` factor. Previously `Y1(5)` returned ≈ −0.377 instead of
  the correct +0.1479, which also poisoned `Y_n(5)` via the upward recurrence.
- **`special.ts` `cosIntegral` (Ci):** the convergent power series is now used
  across its reliable range (x ≤ 35) instead of handing moderate x to a
  divergent asymptotic series. Previously `Ci(10)` overflowed to ≈ 6.8e20
  instead of −0.0455; the large-x asymptotic auxiliary-function coefficients and
  `1/x²` normalization were also corrected, with smallest-term truncation.
- **`special.ts` `airyAi` / `airyBi` (negative-x oscillatory asymptotic,
  x < −4.5):** rewrote the branches to use the correct DLMF §9.7 `u_k`
  coefficients and phase structure. Previously they reused the wrong
  exponential-branch `c_k` series, e.g. `Ai(-5)` ≈ 0.138 instead of 0.3508 and
  `Bi(-5)` with the wrong sign/magnitude.

## 0.2.4

### Patch Changes

- Ship TypeScript declarations. The package now emits a `.d.ts` tree via `tsc` (the JS bundle stays on tsup); previously `--dts` was disabled and the published `types` field pointed at a non-existent file, so consumers got `any`. Fixed a TS4023 (`evaluate` inferred an un-nameable `EvaluateOptions` from `expression`) by annotating `evaluate` with `ReturnType<typeof createEvaluate>`. No runtime change (2502 tests still pass).

## 0.2.3

### Patch Changes

- Re-pin `@danielsimonjr/mathts-expression` to `0.2.2` (which now exports `createParser`) so the matched MathTS package set resolves a single `expression` version.

## 0.2.2

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.


## 0.2.1

### Patch Changes

- Fix functions WASM loader artifact filenames + path resolution.

  `functions/src/wasm/WasmLoader.ts` carried two legacy-mathjs artifacts
  of the mathjs-to-MathTS rebrand:
  - It referenced `mathjs-as.wasm` / `mathjs.wasm` instead of the actual
    artifacts `mathts-as.wasm` / `mathts.wasm`. The loader never found
    its binaries, `getModule()` returned null, and consumers
    (`functions/src/typed/{numeric,geometry,signal}.ts`) silently fell
    back to JS with no warning. Every release of mathts-functions since
    the rebrand has shipped with these three modules' WASM paths
    unreachable.
  - The Node branch used `'./lib/wasm/...'` (CWD-relative). Only worked
    when Node launched from the repo root — same pattern matrix fixed in
    the prior release.

  Now resolves through `fileURLToPath(new URL('../../../lib/wasm/...',
import.meta.url))`, mirroring matrix's loaders. The env-var check
  accepts both `MATHTS_WASM_BACKEND` (canonical) and the legacy
  `MATHJS_WASM_BACKEND` for one release. `getDefaultWasmPath` is now
  async; the two callers (`precompile`, `loadModule`) await it.

  Note: this fix alone doesn't ship WASM artifacts inside the npm
  tarball — the cross-package dist-hop issue (audit B-3) is a separate
  build-pipeline change. Once that lands, end-users of mathts-functions
  will get the WASM-accelerated paths that were wired but unreachable
  since the rebrand.

- Updated dependencies [3d218f5]
- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.1.3

## 0.2.0

### Minor Changes

- 65c12de: Fix and extend parallel execution.
  - **workerpool** — `MathWorkerPool` created its pool with `createPool(null)`, so
    workerpool loaded its generic worker instead of the MathTS kernels and every
    named-kernel dispatch threw `Unknown method`. The built `dist/worker.js` is
    now resolved and loaded, so the parallel layer runs in workers for the first
    time. Float64Array chunking is fixed (`subarray` shared the whole buffer →
    `slice`). Adds the generic `applyKernel` (unary) and `applyKernel2` (binary)
    worker kernels and a batched-FFT kernel (`fftBatchChunk` / `fftBatch`).
  - **parallel** — `ComputePool` exposes `applyKernel` / `applyKernel2` / `fftBatch`.
  - **functions** — parallel `Float64Array` overloads for all 10 distribution
    functions and all 28 special functions; `parallelFFTMagnitude` /
    `parallelFFTPower` now dispatch to worker threads; `spectrogram`, `fft2d`, and
    `parallelConv` (with `parallelXCorr` / `parallelAutoCorr`) dispatch their
    independent FFTs to the worker pool; `parallelFFT` / `parallelIFFT` run a
    genuinely parallel single transform via a four-step decomposition. Completes
    the element-wise `Float64Array` overloads across arithmetic and trigonometry,
    and adds a parallel `parallelStatProd` reduction. Adds the parallel all-pairs
    `distanceMatrix` geometry function and the WebGPU-accelerated matrix
    operations `gpuMatmul`, `gpuAdd`, `gpuTranspose`, and `gpuScale` (new async
    exports, transparent CPU fallback, f32 GPU path).

    **Breaking:** `characteristicPolynomial`, `matrixPower`, `matrixLog`,
    `polarDecomposition`, `jordanForm`, `spectrogram`, `fft2d`, `parallelIFFT`,
    and `parallelStatProd`'s `Float64Array` overload are now async — their
    O(n^3) products / FFT batches / reductions are offloaded to the worker pool.

### Patch Changes

- Updated dependencies [65c12de]
  - @danielsimonjr/mathts-parallel@0.2.0

## 0.1.3

### Patch Changes (Security — additive)

- 3ef899c: WASM modules now verify a SHA-384 manifest before instantiation.
  At load time the runtime hashes the freshly read buffer
  (`crypto.createHash('sha384')` in Node, `crypto.subtle.digest` in
  browsers) and compares against `wasm-manifest.json` written by
  `tools/generate-wasm-manifest.mjs`. A mismatch throws before any module
  is compiled, blocking silent code-injection via tampered .wasm payloads.
  Manifest defaults to soft-fail when absent for legacy compat;
  `{ required: true }` makes it fail-closed. Affected files:
  `functions/src/wasm/integrity.ts` (new), `functions/src/wasm/WasmLoader.ts`
  (Node + browser load paths). Adds
  `functions/tests/security/wasm-integrity.test.ts` (5 tests).

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
  - @danielsimonjr/mathts-parallel@0.1.1
  - @danielsimonjr/mathts-expression@0.1.1
