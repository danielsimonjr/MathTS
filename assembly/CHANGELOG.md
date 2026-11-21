# @danielsimonjr/mathts-wasm

## 0.4.2

### Patch Changes

- f4df499: Matrix input and degenerate input of the signal functions now give a correct value or a named error. Results before the change:
  
  - `dct`, `idct`, `dst`, `idst`, `hilbertTransform` and `spectrogram` of a Matrix returned `[null]`, `[]` or a `RangeError` about `NaN`. Each now throws `TypeError: <name>: signal must be an array or a typed array`. Arrays and typed arrays give the same values as before.
  - `fftshift` and `ifftshift` of a Matrix threw `arr.slice is not a function`. They now unwrap a Matrix or a typed array and return a plain array. A nested array or a 2-D Matrix is now shifted along every axis, as NumPy does: `fftshift([[1, 2], [3, 4]])` returned `[[3, 4], [1, 2]]` (the first axis only) and now returns `[[4, 3], [2, 1]]`.
  - `fftshift` and `ifftshift` of an array of odd length were swapped with respect to NumPy: `fftshift([0, 1, 2, 3, 4])` returned `[2, 3, 4, 0, 1]`. It now returns `[3, 4, 0, 1, 2]`, and `ifftshift` returns `[2, 3, 4, 0, 1]`, as `numpy.fft.fftshift` and `numpy.fft.ifftshift` do. Results for an even length are unchanged.
  - `welchPSD([5, 6])` and `welchPSD([5, 6, 7, 8], { frameLength: 2 })` returned `NaN`, because a Hann window of length 2 is `[0, 0]`. They now throw `RangeError: welchPSD: a 'hann' window of length 2 is all zeros`. Other windows of length 2 give finite values. `periodogram([5, 6])`, `csd([5, 6], [5, 6])` and `coherence([5, 6], [5, 6])` returned `NaN` for the same window and now throw `RangeError` too. `spectrogram([5, 6])` and `spectrogram([5, 6, 7, 8], { windowSize: 2 })` returned a magnitude of all zeros for the same window and now throw `RangeError` too.
  - `multiTaperPSD([1, 2, 3, 4, 5])` returned five bins on the wrong frequency grid, with the last two bins 0. Each taper is now zero-padded to `nfft`, and the result equals the NumPy periodogram of the tapered signal. For `n = 5000` and the default `nfft` of 8192, every bin above 2500 was 0. An `nfft` or a `K` that is not a positive integer returned `NaN` bins or a PSD of zeros (`multiTaperPSD([1, 2, 3, 4, 5], { nfft: 2.5 })`) and now throws `RangeError`.
  - `medfilt` and `findPeaks` of a Matrix returned `[null]` and `[]`. Each now throws a `TypeError` that names the function.
  - `medfilt` now pads the signal with zeros at both ends, as `scipy.signal.medfilt` does. This changes the values at the edges: `medfilt([0, 1, 5, 1, 0])` returned `[1, 1, 1, 1, 1]` and now returns `[0, 1, 1, 1, 0]`. A window longer than the signal is padded with zeros too: `medfilt([1, 2, 3], 1e9)` returned `[2, 2, 2]` and now returns `[0, 0, 0]`. A window size that is not a positive integer now throws `RangeError`.
  - `fftshift` and `ifftshift` of a ragged nested array returned a ragged result (`fftshift([[1, 2], [3]])` returned `[[3], [2, 1]]`). They now throw a `DimensionError` (a `RangeError`), as `rfft` does.
  - `spectrogram([])` returned 129 frequencies. It now returns no frames, no times and no frequencies, as `welchPSD([])` does.
  - `welchPSD` and `bartlettPSD` with an odd `frameLength` returned the last bin at half of its value. For an odd frame the last bin is below the Nyquist frequency, so it is doubled like the bins before it. `welchPSD([1, 5, 2, 8, 3, 9, 4, 7, 6, 10], { frameLength: 5, window: 'rect' })` returned a last bin of 11.9 and now returns 23.8. Results for an even frame are unchanged. The `welch_psd_f64` and `bartlett_psd_f64` kernels of the WASM package now return an empty array for a frame length that is not a power of two, because they zero-pad each frame to the next power of two and put the bins of any other frame on the wrong grid. The bridge sends only a power-of-two frame to a kernel, so the public functions are not affected.
  
  `resample([], 2, 1)` returns `[]` and needs no change.
  
  (Refs #1145)
- a50902c: `besselY(n, x)` returns `-Infinity` when `Y_n(x)` is outside the double range, and it returned `NaN`. `besselY(154, 1)`, `besselY(400, 1)`, `besselY(1000, 100)` and `besselY(400.5, 1)` are `-Infinity`; `besselY(-401, 1)` is `Infinity` (the sign of a negative odd order). Values below the overflow keep their digits: `besselY(151, 1)` is -5.1999e307. The AssemblyScript kernel `bessel_yn_f64` returns the same infinities as the JS scalar. A real order with `nu / x` above about 150 was `NaN` for every `x` (the downward recurrence overflowed): `besselY(400.3, 3)` and `besselY(1000.3, 50)` are `-Infinity`, and `besselJ(300.5, 1)` is `0`. A negative non-integer order reduces `nu` modulo 2 and puts the factor `cos(nu pi)` (for `besselY`) or `-sin(nu pi)` (for `besselJ`) into the upward recurrence of `Y`, so a result that is a double stays finite where `Y_nu` alone overflows: `besselY(-100.5, 1)` is 5.94e-190 (it was -1.8e172), `besselY(-151.5001, 1)` is -2.84e305, `besselY(-152.5, 1)` is 7.63e-315, `besselJ(-152.0001, 1)` is 4.94e306, `besselY(-400.3, 1)` is `-Infinity`, `besselJ(-400.3, 1)` is `Infinity` and `besselY(-400.5, 1)` is `0`. A non-finite `x` stays `NaN`. (Refs #1289)
- 3b2ffe6: `hypot`, the modulus of a Complex (`abs`), `norm` (the vector 2-norm, the Frobenius norm and the matrix 2-norm) and `distance` follow one rule on every path and type: the IEEE 754 rule of `hypot`. An infinite argument gives `Infinity`, also when another argument is `NaN`. Else a `NaN` argument gives `NaN`. Before, the paths did not agree: `hypot(Infinity, Infinity)` was `NaN` on the factory path, `hypot(bignumber(Infinity), bignumber(NaN))` was `NaN`, `norm([Infinity, Infinity])` and `distance([0, 0], [Infinity, Infinity])` were `NaN` for numbers and `Infinity` for BigNumbers. This rule is different from mathjs, which gives `NaN` for `hypot(Infinity, NaN)` and for `hypot(Infinity, Infinity)`. `hypot` of a list longer than 32768 numbers no longer overflows the call stack, and `distance2D`, `distance3D` and `distanceND` no longer overflow to `Infinity` for a large finite difference. The AssemblyScript `complex_abs`, `complex_to_polar` and `complex_array_abs` squared each part before the sum (Infinity above about 1e154, 0 below about 1e-162, NaN for an infinite part with a NaN part) and now take `Math.hypot`. Typed `hypot` of a BigNumber with two or more other arguments converted the BigNumber to a number; it now returns a BigNumber, as with one other argument. `gradientDescent` and the complex eigenvector of `eig` spread their vector into `Math.hypot`, which threw `RangeError` for a long vector; they now use the same long-list `hypot`. (Refs #1259)

## 0.4.1

### Patch Changes

- a0945d9: The WASM Bessel kernels use the same limits and early exits as the JS path (Fixes #1113). `bessel_jn_f64` has the zero bound, the power-of-2 rescale and the downward-sweep limit of `besselJ`. `bessel_jn_f64` and `bessel_yn_f64` stop at the first NaN. `besselJ` and `besselY` on a `Float64Array` send only an integer order in the kernel range to the kernel. Every other order stays on the JS path, which returns the JS value or throws the JS `RangeError`. Before, an order above 2147483647 wrapped to another order. Where |x| ≤ |n| the kernel result is bit-identical to the JS result, except the sign of a zero result at the edge of the zero bound. Where |x| > |n| it agrees to 1e-11 relative away from a zero of J_n, because the J0 and J1 kernels differ from JS by up to 2 ulp. The raw WASM exports `chebyshevT`, `hermiteH`, `laguerreL` and `legendreP` return NaN for a non-finite order, stop at the first NaN, and abort with an `Error` above 2147483646 (`laguerreL`: 1000000000). Before, they looped without end at 2147483647.

## 0.4.0

### Minor Changes

- b95de8a: **Breaking:** Node 20 is dropped (`engines.node` >=22.12); packed-consumer contract (#886, #888, #890, #893, #905, #912, #914, #916, #930).
  
  Every package sets `engines.node` to `>=22.12`, and CI tests 22.x and 24.x.
  
  Every `exports` entry gains a `default` condition equal to `import`, so `require()` of the ES build works at run time on Node >= 22.12 (`mathts-wasm` has top-level await and stays import-only). Node 22.12 prints an `ExperimentalWarning` for it; 22.13 and later do not. On Node 22.11 and earlier, `require()` reports `ERR_REQUIRE_ESM`; use `import()`. TypeScript accepts the `require()` of these packages from CommonJS under `moduleResolution: nodenext`; `node16` reports TS1471. Issue #736 closed docs-only because its acceptance allowed documenting ESM-only; the `default` condition is the `require(esm)` fix.
  
  Published `.d.ts` files name no Node, workerpool, DOM or WebGPU global, so strict `tsc` with no `@types/node` passes. The `mathts-gpu` handle types are the WebGPU global types when the consumer has them, and interfaces of the package when it has not. `mathts-workerpool` ships a `browser` build (the worker is one classic script), so a bundler pulls no Node builtin into `mathts-compat`. README code fences carry a runtime tag. `functions/evaluate` is not a size saving; use `mathts-expression` for a small bundle.

## 0.3.3

### Patch Changes

- a07bf29: Packaging P2 (dogfood G29): ship LICENSE in tarballs, homepage/bugs links, `exports['./package.json']`, honest `sideEffects`, JS source maps from tsdown, and workerpool types that typecheck without `@types/node` (via updated `@danielsimonjr/workerpool` patch).

## 0.3.2

### Patch Changes

- 685a2b4: Non-finite inputs (NaN, +Infinity, -Infinity) no longer hang or give a wrong number.
  
  Behaviour changes (the reason for the minor bump):
  
  - The typed `compare(NaN, x)` and `compare(x, NaN)` return `-1`, the same as mathjs and the factory `compare`. Before, they returned `0`. No function in the package calls the typed `compare`; `sort` and `partitionSelect` use the factory `compare`, which already returned `-1`.
  - New throws:
    - `nextPrime(n)` throws a `RangeError` when `n` is not finite or `n >= Number.MAX_SAFE_INTEGER`. Before, `nextPrime(Infinity)` looped forever, `nextPrime(NaN)` returned `NaN`, and a finite `n` at or above the safe-integer limit gave an inexact result.
    - `range` throws a `RangeError` when an infinite start or end gives an unbounded range. Before, it looped until memory ran out.
    - `shortestPath` throws a `TypeError` when `adj` is not an array, and a `RangeError` when `start` or `end` is not an integer. This changes one finite input: `shortestPath(adj, 0.5, 1)` returned `[]` and now throws. Before, a non-integer `end` looped forever.
    - `quad` (and `nintegrate` and `arcLength`, which call it) throws a `RangeError` for a NaN or infinite bound. Before, an infinite bound bisected to depth 50 and did not end in practice.
    - `owensT` throws a `TypeError` when an argument is missing.
    - `zipfPMF(k, s, Infinity)` throws a `RangeError`. Before, its normalising sum looped forever.
  
  Fixes:
  
  - `gcd`, `lcm` and `xgcd` return `NaN` (`xgcd`: `[NaN, NaN, NaN]`) for a NaN or infinite argument in either position. Before, they looped forever.
  - `isPrime(Infinity)` returns `false`; before, it looped forever. `isPrime(NaN)` returns `false` (was `true`).
  - `owensT(h, Infinity)` returns `(1 - Phi(|h|)) / 2`, and `owensT(h, -Infinity)` the negative value. Before, both did not end. `owensT` with a NaN argument returns `NaN`.
  - `ferrersP` with an infinite degree or order, `siegelZ` / `riemannSiegelZ` at +-Infinity, and `trigamma` / `polygamma` at -Infinity return `NaN`. Before, they looped forever.
  - `acoth`, `asech`, `acsc` and `asec` give the complex result off their real domain (for example `acoth(0.5)`). Before, they threw `TypeError: ... is not a function`, because the core Complex type has no such methods.
  - A NaN in any argument gives `NaN` for `fQuantile`, `gammaQuantile`, `studentTQuantile`, `studentizedRangeCDF`, `studentizedRangeQuantile`, `jacobiSN`, `jacobiCN`, `jacobiDN`, `skellamPMF`, `zipfPMF`, `clamp` (a NaN bound) and `ferrersP` (a NaN `x`). Before, they returned a finite number (for example `studentTQuantile(NaN, 2)` gave about -1000), or threw for a NaN parameter (`studentizedRangeQuantile`, `skellamPMF`). Every distribution object's `quantile(NaN)` also gives `NaN`.
  - `erfc(NaN)` (JS and the AssemblyScript kernel), `normalCDF` with a NaN in any position, `primePi(NaN)`, the three-argument median and `zeta(NaN)` return `NaN`. Before, they returned 2, 1, 0, a sorted element and 1.
  
  Other finite inputs give the same results as before.

## 0.3.1

### Patch Changes

- 4f1d0fc: Sprint 2R assembly clone-merge G0–G5: shared `@inline` `f64-buffer.ts` helpers (`f64Min`/`f64Max`/`f64Add`/`f64Sub`/`f64Mul`/`f64Div`) for array/matrix/complex-array export wrappers. Wasm export names and semantics unchanged; manifest SHA-384 regenerated by build.
- 3ce0ef0: Share AssemblyScript Airy Ai/Bi series loop (`_airySeries`) with post-loop combine (clones plan PR-I).
- b1bdef8: Replace `export type *` barrels with named type re-exports (tree-sitter-typescript 0.23.2) and drop `@inline` on private AssemblyScript sort helpers so `repo-tools clones` reports `parseErrors=0`.
- 45d691e: Stop shipping unused TypeScript `MathTSWasm` bindings; consumers load the binary via `functions` and `matrix` loaders with SHA-384 verification.

## 0.3.0

### Minor Changes

- 8b0f960: Repeated calls no longer grow linear memory for good. The binary uses the stub runtime, which never frees.
  
  - **New export `heap_reset()`.** It rolls the stub runtime's bump allocator back to the heap start. A host that makes repeated managed-ABI calls can call it when no allocation is live, which bounds memory by the largest single call. It is safe because no module state lives on the heap: every module-level binding is a scalar constant. The `functions` bridges call it after each managed call.
  - **The decomposition kernels allocate nothing when given scratch.**
    - `matrix_lu_decompose` eliminates in `u_out` instead of an internal n×n copy, which leaked 32 KiB per 64×64 call.
    - `matrix_determinant` drops a permutation array it never read.
    - `matrix_inverse` solves in place in `result`, and keeps the row permutation in `work` when `work` has n·n + n entries.
    - `matrix_qr_decompose` takes an optional sixth argument `v_work` (length m) for its Householder vector.
  
    Callers that pass the old arguments get the same results, and the kernels then allocate as before. The arithmetic is unchanged: 30/30 decomposition diff checks pass against the reference.

## 0.2.3

### Patch Changes

- 57c8ffd: Rebuilt binary from unchanged AssemblyScript source: same exports, differently optimized code section.

## 0.2.2

### Patch Changes

- 7b2b651: Remove 8 dead (unreachable, unexported, untested) source files surfaced by the upgraded dependency-graph tool: `expression` `ArgumentsError.ts`; `functions` `utils/{function,log,lruQueue,bignumber/constants}.ts` (a closed import subgraph reachable from nothing); `matrix` `types.ts`; `parallel` `workers/compute.worker.ts` (a superseded worker never built — `matrix.worker.ts` is the live one); `wasm` `env/abort.ts` (a custom AssemblyScript abort handler never wired via asconfig, tree-shaken by `asc`). None were reachable from any package entry point or build root, so the published bundles are byte-identical; this is a source-tree cleanup. Verified: build 22/22, wasm build, typecheck 28/28, test 44/44, eslint clean.

## 0.2.1

### Patch Changes

- 22427a8: Dead-code sweep: remove all 31 verified-unreferenced exports flagged by the fixed dependency-graph unused-analysis (plus 4 cascade orphans), ~630 LOC. None were public API — every symbol was verified unimported by source, tests, docs, and factory name-string dispatch before deletion. Highlights: the mathjs number-only-bundle factory remnants (`createNthRootNumber`, `createCompareTextNumber`, `createEqualScalarNumber`, `createBigNumberClass`, `createComplexClass`, `createArgumentsError`, `createIndexError`), the dead `functions/src/expression/operators.ts` precedence/associativity chain (the live copy is the `expression` package's own), orphan utils (`initial`, `toObject`, `noIndex`/`noSubset`, `endsWith`/`escape`, `operatorPrecedence`), unused JSON/type contracts, `SI_PREFIX_KEYS`, and AssemblyScript complex-constant helpers. The unused-analysis deletion-candidate count is now **0**.

## 0.2.0

### Minor Changes

- Remove the scalar eig/svd AssemblyScript kernels (`matrix_eig_symmetric`, `matrix_eig_general`, `matrix_spectral_radius`, `matrix_svd`, `matrix_singular_values`) — they were 0.2–0.7× the JS path and worsened with size, and are no longer used (matrix's eig/svd run on JS). The SIMD matmul kernel and the LU/QR/Cholesky/inverse/determinant decompositions — the measured WASM wins — are kept. Binary drops from 30 to 28 source files (318→314 exports).

## 0.1.5

### Patch Changes (Special-function accuracy fixes)

Surfaced by the new differential harness (`npm run test:diff`, mpmath goldens).
All 140 special-function cases and 30 decomposition checks now pass to <1e-9.

- **Bessel J0/J1/Y0/Y1 rewritten** from the low-order Numerical Recipes
  rational approximations (~1e-7 for J, ~1e-4 for Y) to ascending series
  (|x| <= 13) + Hankel asymptotic (|x| > 13), both with in-loop-generated
  coefficients. Now accurate to ~f64 precision.
- **`bessel_jn` recurrence direction fixed**: forward (upward) recurrence is
  unstable when n > x, so those cases now use Miller's backward recurrence
  (previously forward was used whenever n <= 20, giving up to ~1e-3 error,
  e.g. J5(1)).
- **Miller backward recurrence off-by-one fixed**: it returned J\_{n+1} instead
  of J_n (latent — previously only reachable for n > 20).
- **Airy Ai/Bi negative-argument asymptotic fixed**: the P/Q series were
  non-alternating and the sin/cos pairing was wrong (DLMF 9.7.9/9.7.10),
  giving ~60% error at e.g. Ai(-5). Now correct.
- **Airy asymptotic coefficients generated by recurrence** (DLMF 9.7.2): the
  hardcoded u_5/u_6 were wrong, capping accuracy at ~1e-7; generation also
  permits optimal-truncation term counts. Airy now <1e-9 across the domain.
- **`matrix_qr_decompose` doc clarified**: `q_out` is stored as Q^T
  (`A = Q^T * R`), matching the matrix-package convention — behavior
  unchanged, header comment corrected (was misleadingly "orthogonal Q").

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
