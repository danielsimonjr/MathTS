# @danielsimonjr/mathts-functions

## 0.20.1

### Patch Changes

- cc1b3e4: Make the public `fft()` ~6× faster. No API change, no precision change.

  `fft()` computed its butterflies in **Complex objects** — a `{ re, im }` allocation per
  twiddle step and per butterfly — while a flat `Float64Array` radix-2 core already existed in
  the same package (the one `parallelFFT` uses) and was ~8× faster for the identical transform.
  The default FFT every consumer reaches was therefore the slowest one in the library.

  Both surfaces now share one core (`signal/fft-core-f64.ts`); `ComplexNumber[]` is materialised
  once at the boundary. Measured, same machine:

  | n         | before  | after      | vs `parallelFFT` (raw Float64Array) |
  | --------- | ------- | ---------- | ----------------------------------- |
  | 262,144   | 607 ms  | **96 ms**  | 33 ms                               |
  | 1,048,576 | 2987 ms | **521 ms** | 170 ms                              |

  The remaining gap to `parallelFFT` is the `ComplexNumber[]` boxing itself, which is inherent
  to that return type — use `parallelFFT` if you want the raw `Float64Array` spectrum.

  Same f64 arithmetic, same 1/n inverse scaling, same results. Pinned by
  `tests/benchmark/fft-public-surface.test.ts`.

## 0.20.0

### Minor Changes

- b7784ef: Add `fuseUnaryChainReduceAsync(ops, xs, reduce)` — apply an element-wise chain and reduce
  it **on the GPU**, returning a `number` instead of an array. `reduce` is
  `'sum' | 'max' | 'min'`.

  Reducing on the device sends `n/256` floats back across the bus instead of `n`. Measured
  end-to-end for `sum(exp(sin(x)))` on an NVIDIA Pascal adapter: **1.35–1.7×** faster than
  the existing GPU path followed by a JS loop, and **2.6–3.8×** faster than the CPU tier
  (WASM chain + JS sum). At n=2²²: 260 ms → 100 ms → **72 ms**. The reproducible figure is the
  **1.39× at n=2²²** (1.31–1.39× across four runs); the 1.7× upper bound comes from n=262,144,
  where the ratio swings 1.19–2.83× run to run.

  Opt-in via `enableGpu()` like every GPU path, so results carry f32 precision; with the
  flag off it is an exact-f64 CPU computation. Reach for it only when you want _just the
  scalar_ — if you also need the transformed array you pay the n-float readback anyway.

  **A standalone GPU reduction is deliberately not offered:** an empty `ops` returns `null`.
  Uploading n floats to produce one number is pure transfer tax and measured 3–9× slower
  than a plain JS sum.

  Also exported: `elementwiseChainReduceGpuDispatch`, `GPU_REDUCE_OPS`, `GpuReduceOp`.

## 0.19.0

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

### Patch Changes

- Updated dependencies [abbe883]
  - @danielsimonjr/mathts-matrix@0.4.0

## 0.18.0

### Minor Changes

- 7c53d7f: **GPU element-wise tier: correctness, ergonomics, and architecture follow-ups.**

  - **Domain edges now match JS exactly.** WGSL leaves `log(x<=0)`, `atanh(|x|>=1)` and
    division-by-zero **indeterminate** — an implementation may return anything, and zeros
    in real data are common. The kernels now pin IEEE semantics, so `log(0)` is `-Infinity`
    and `atanh(2)` is `NaN` on every device, not just the one we happened to test. (The old
    oracle test _skipped non-finite expectations_, so this was structurally invisible.)
    Subtlety: the NaN/±Inf bit patterns ride in a **uniform** — WGSL const-folds
    `bitcast<f32>(0x7fc00000u)` even inside a function body and then rejects the result
    ("value nan cannot be represented as 'f32'").
  - **`fuseUnaryChainAsync` now always returns `Float64Array`** (was
    `Float64Array | Float32Array`). That union was a footgun: `.map`/`.filter`/`.set` on it
    are TS2349 errors, so _every_ caller had to `instanceof`-narrow, and
    `new Float64Array(r.buffer)` silently produced garbage on the f32 branch. When the GPU
    runs, the values carry f32 precision inside the f64 container. Callers who want the raw
    f32 buffer can call `elementwiseChainGpuDispatch` directly.
  - **Per-call `{ gpu }` override.** `enableGpu()` is process-global mutable state — any
    dependency flipping it changed _your_ call. `fuseUnaryChainAsync(ops, xs, { gpu })` and
    `elementwiseChainGpuDispatch(..., { gpu })` are now self-describing.
  - **Uses the `mathts-gpu` foundation it was meant to.** The dispatcher had built a private
    pipeline cache and raw `createBuffer` calls, using neither the `ShaderManager` nor the
    `BufferPool` extracted for exactly this. It now uses both: pipelines are compiled **once**
    (no per-call shader compile) and buffers are **recycled**. Pooling is only safe because the
    kernel now bounds-checks against an `n` **uniform** rather than `arrayLength(&inp)` — the
    pool rounds sizes up, so an `arrayLength` guard would have run threads past the real data.
    Net effect is also a large speedup: the GPU chain went from 30.2 ms → **10.5 ms** at
    n=65,536 and 470 ms → **306 ms** at n=1M. (WASM still wins; the tier order is unchanged.)
  - Added `resetGpuElementwise()` to drop cached GPU resources.

## 0.17.2

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
  - @danielsimonjr/mathts-matrix@0.3.2
  - @danielsimonjr/mathts-gpu@0.1.1

## 0.17.1

### Patch Changes

- 8e9aadb: **Fix: WASM was dead in the browser — and it invalidated the GPU tier's ordering.**

  `elementwiseChainDispatch` returned `null` for every call in a browser, so browser users
  silently got the pure-JS scalar path and the WASM tier never ran. Root cause:
  `WasmLoader.getDefaultWasmPath()`'s browser branch made a single relative-URL guess
  (`new URL('./wasm/<file>', import.meta.url)`) with no fallback, while the Node branch walks
  parent directories until it finds the binary. The guess resolved to a path that never
  existed, and the bridge's never-throw contract swallowed the failure as a `null` — so it
  failed silently. Added `resolveBrowserWasm()`, the browser counterpart to the Node resolver,
  probing the same candidate shapes with `fetch(HEAD)`. The SHA-384 integrity check is
  untouched: this only changes _where_ the loader looks, never whether the tamper check runs.

  **Consequence — `fuseUnaryChainAsync` tier order corrected to WASM → GPU → JS.** The GPU tier
  had been benchmarked at "2.3–2.9× faster", but only because its CPU baseline was JS _because
  WASM was dead_. With WASM actually loading (Chrome, NVIDIA Pascal, chain `sin→exp→tanh→cos`):
  WASM is **~1.9× FASTER than the GPU** (16ms vs 30ms at n=65,536; 254ms vs 470ms at n=1M) —
  and f64-exact where the GPU is f32. For element-wise chains the GPU is therefore both slower
  and less precise, so it must never pre-empt WASM. It still earns its place where WASM cannot
  load (~2–2.5× over JS there), and still wins decisively on compute-bound work like a large
  `gpuMatmul`. Pinned by `gpu-vs-wasm.browser.test.ts`, which fails loudly on regression.

- Updated dependencies [8e9aadb]
  - @danielsimonjr/mathts-matrix@0.3.1
  - @danielsimonjr/mathts-parallel@0.3.4

## 0.17.0

### Minor Changes

- 908f19b: Add the opt-in **WebGPU f32 acceleration tier** for fused element-wise chains.

  - `enableGpu()` / `disableGpu()` / `isGpuEnabled()` — the GPU tier is **OFF by
    default**. Opting in is required because the GPU computes in f32 (WGSL has no
    f64), and silently changing an f64 API's precision is not something a caller
    should get by accident.
  - `fuseUnaryChainAsync(ops, xs)` — async sibling of `fuseUnaryChain` that tries
    **GPU (f32) → WASM (f64) → JS (f64)**. It returns a `Float32Array` only when the
    GPU path ran, so the return type _is_ the precision contract. Added as a new
    async function rather than changing `fuseUnaryChain`'s synchronous signature.
  - `elementwiseChainGpuDispatch(ops, xs)` — the never-throw bridge (returns `null`
    to fall back), mirroring the WASM `elementwiseChainDispatch` pattern.

  Only a _fused chain_ is accelerated: a lone element-wise op on the GPU is pure
  transfer tax, while a chain uploads once, runs every op on-device via ping-ponged
  buffers, and reads back once. Measured on an NVIDIA Pascal adapter for
  `sin→exp→tanh→cos` vs the browser CPU path: **2.33x at 65,536 elements, 2.88x at
  262,144, 2.54x at 1M**. The 65,536-element threshold is set from these numbers.

  All 15 supported kernels are validated against JS oracles on a real GPU.
  `erfc`, `expm1` and `log1p` are deliberately excluded: WGSL has no builtin for any of
  them, and for expm1/log1p even the Kahan-compensated forms measured 38%/62% max
  relative error near zero on real hardware (the GPU's fast-math `log()` is inaccurate
  near 1.0). An f32 fast path may be less precise; it may not be wrong. Chains containing
  them fall back to the exact CPU tiers.

  Hardened after adversarial review: device-limit guards + a validation error scope
  (a WebGPU validation error does NOT throw — it invalidates the command buffer, and the
  zero-initialized staging buffer would have been returned as a silently WRONG all-zeros
  result); buffer cleanup on every error path; and device-lost now clears the cached
  device so the tier can recover.

### Patch Changes

- 2353e0a: Fix the WebGPU wrappers (`gpuMatmul`/`gpuAdd`/`gpuTranspose`/`gpuScale`) rejecting
  on a device-initialization failure. An environment can advertise WebGPU and still
  fail to hand out a device (lost adapter, driver refusal, revoked permission), in
  which case `GPUMatrixBackend.initialize()` rejects — and that rejection escaped the
  wrapper, because the init call sat outside the backend's CPU-fallback guard. The GPU
  is a best-effort fast path, never a hard dependency: an init failure now degrades to
  the CPU implementation, matching the documented fallback contract.
- Updated dependencies [b78b8bc]
- Updated dependencies [4b4ccd6]
  - @danielsimonjr/mathts-matrix@0.3.0

## 0.16.1

### Patch Changes

- Updated dependencies [fd3e417]
  - @danielsimonjr/mathts-expression@0.6.0

## 0.16.0

### Minor Changes

- 557e27f: **Statistics/probability gap-closure** (vs NumPy/SciPy, MATLAB, Mathematica — see `docs/roadmap/STATISTICS_GAP_AUDIT_2026-07-06.md`). Closes the audit's ranked P1/P2 gaps, each externally scipy-pinned:

  - **Surfaced 16 already-implemented functions** in the statistics library: `linearRegression`, `polyFit`, `cummax`/`cummin`/`cumprod`, `cumtrapz`, `trapzF64`, `movingAverage`, `ewma`, `detrend`, `acf`, `logsumexp`, `softmax`, `kmeans`, `spectralClustering`, `beta`, `digamma`.
  - **Regression + inference**: `linregress` (slope/intercept/r/pValue/stdErr + CI).
  - **Correlation tests with p-values**: `pearsonr`, `spearmanr`, `kendalltau` → `(coefficient, pValue)`.
  - **Descriptive conveniences**: `ptp`, `variation`, `describe`, `histogram`, `trimmedMean`.
  - **Normality & repeated-measures tests**: `andersonDarlingTest`, `dagostinoTest`, `friedmanTest`, `anova2`, `multipleComparison`.
  - **Common distributions**: `paretoDist`, `rayleighDist`, `triangularDist`, `discreteUniformDist`, `gumbelDist`, `invGaussDist`, `multivariateNormal`.
  - **Resampling & CI**: `bootstrapCI`, `meanCI`, `proportionCI`, `permutationTest`.
  - **Multivariate**: `mahalanobis`, `hotellingT2`.

## 0.15.0

### Minor Changes

- 86f786e: **Statistics/probability completeness — close the breadth gap to matrix-level parity.** Adds the standard distributions, hypothesis tests, and correlation measures a complete package ships, each pinned to an EXTERNAL oracle (scipy 1.17.1), matching the domain's existing scipy-oracle discipline:

  - **Two-sample Kolmogorov–Smirnov** (`kolmogorovSmirnov2Test`) — the commonly-used form; the prior KS was one-sample only.
  - **Levene + Bartlett** variance-homogeneity tests (`leveneTest`, `bartlettTest`).
  - **Hypergeometric + negative-binomial** distributions (`hypergeometricDist`, `negativeBinomialDist`).
  - **Paired t-test** (`studentTTestPaired`), **proportion z-tests** (`proportionZTest`), **binomial test** (`binomialTest`).
  - **Kendall's τ** (`kendallTau`) — completing Pearson/Spearman/Kendall.

  Also adds external scipy pins for three distribution methods previously verified only by inversion round-trips (`poissonDist.cdf`, `logNormalDist.quantile`, `weibullDist.quantile`).

## 0.14.0

### Minor Changes

- 1df691c: **GC12 — `config()` now drives behavior + compat uses the real functions types.**

  - functions gains a `config()` accessor (`config-api.ts`): read the global runtime config, or pass a partial to merge it. Functions read this shared object live at call time (e.g. `identity`/`range`'s `config.matrix === 'Array'` return-type switch, `zeta`'s `config.relTol`), so `config({ matrix: 'Array' })` genuinely changes results. It is process-global (the functions surface is a singleton), not per-instance like mathjs `create()`.
  - compat's `config()` was **inert** (mutated a private object nothing read); it now forwards to `functions.config`, so `math.config({ matrix: 'Array' })` drives the functions surface, and `create(all, { … })` seeds it.
  - Deleted `compat/src/functions.d.ts` — an outdated ambient `declare module` stub (21 functions) whose own header said "until the functions package has proper .d.ts files." It was **shadowing** the real, complete functions types, so `import * as F` saw an empty namespace (even `F.zeta`/`F.cbrt` were invisible). compat now type-checks against the real 829-export surface. This closes GC12's "widen functions.d.ts" at root cause.

  Config is now process-global: a `delegation` test that asserted per-instance isolation was updated to reflect this (isolation was only ever "true" because config did nothing).

### Patch Changes

- f2211c8: **Fix `zeta` on the line Re=1 + add a complex-ζ oracle (GC6).** `zetaComplex` returned `NaN` for the _entire_ vertical line Re=1, but the simple pole is only the point s=1 — `ζ(1+it)` for `t≠0` is finite (e.g. `ζ(1+i) = 0.5822 − 0.9268i`). Fixed the guard (`s.re === 1` → `s.re === 1 && s.im === 0`). Added `gap-zeta-complex-oracle.test.ts` pinning `ζ(complex)` to **mpmath 1.3.0** (dps=40) across all three regions — convergent Re>1, the critical strip, and Re<1 via the functional equation — plus the pole and the first two nontrivial zeros on Re=1/2. Measured accuracy ~1e-14 (convergent/strip), ~1e-11 (reflection); the complex path was already implemented (Gourdon–Sebah / Borwein) but had no external oracle.

## 0.13.3

### Patch Changes

- b550758: Fix `cbrt(number, allRoots)` — the real-number two-argument form now works instead of throwing "Too many arguments in function cbrt (expected: 1, actual: 2)". Both the programmatic `cbrt` and the expression-language `cbrt` gained explicit `number, boolean` / `Complex, boolean` signatures that route through the complex cube-root path: `cbrt(8, true)` returns all three cube roots `[2, -1±i√3]` and `cbrt(8, false)` the principal root (matching mathjs 15). The source previously assumed typed-function would synthesize `number, boolean` via a number→Complex conversion, which the MathTS typed instance does not.
- a267d80: **Fix `expand` distribution bug + add a CAS-vs-sympy oracle (GC11).** `expand('(x + 1)*(x - 2)')` returned `x*x - 2 + 1*x - 2` (value x²+x−4) instead of the correct x²−x−2 — it split each factor on `+` only, so `x - 2` stayed a single term and the `−2` dangled through distribution. Fixed by normalizing binary subtraction to a signed additive term (`x - 2` → `["x", "-2"]`) before distributing. Surfaced by a new external-oracle test (`gap-cas-sympy-oracle.test.ts`) that pins `derivative`/`simplify`/`expand`/`factor`/`rationalize` to **sympy 1.14.0** by numeric agreement at sample points — the implementation-independent discipline (never assert a CAS result against its own re-serialization).

## 0.13.2

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0
  - @danielsimonjr/mathts-expression@0.5.3
  - @danielsimonjr/mathts-matrix@0.2.2

## 0.13.1

### Patch Changes

- 7b2b651: Remove 8 dead (unreachable, unexported, untested) source files surfaced by the upgraded dependency-graph tool: `expression` `ArgumentsError.ts`; `functions` `utils/{function,log,lruQueue,bignumber/constants}.ts` (a closed import subgraph reachable from nothing); `matrix` `types.ts`; `parallel` `workers/compute.worker.ts` (a superseded worker never built — `matrix.worker.ts` is the live one); `wasm` `env/abort.ts` (a custom AssemblyScript abort handler never wired via asconfig, tree-shaken by `asc`). None were reachable from any package entry point or build root, so the published bundles are byte-identical; this is a source-tree cleanup. Verified: build 22/22, wasm build, typecheck 28/28, test 44/44, eslint clean.
- Updated dependencies [7b2b651]
  - @danielsimonjr/mathts-expression@0.5.1
  - @danielsimonjr/mathts-matrix@0.2.1
  - @danielsimonjr/mathts-parallel@0.3.3

## 0.13.0

### Minor Changes

- ce8f929: **Expression-language transforms wired** (the formerly-dormant `expression/src/transform` pocket — 25 transforms, mathjs-verified). Inside the expression language, semantics now match mathjs exactly (verified against mathjs 15 output): indices and dimensions are **one-based** (`A[1]` is the first element — previously zero-based, contradicting the parser's documented one-based design; `A[end]` works; `row(M, 1)`/`column(M, 1)` return the first row/column; `max`/`min`/`sum`/`mean`/`std`/`variance`/`cumsum` accept 1-based `dim` arguments — previously rejected), ranges include their end (`1:3` = `[1,2,3]`), map/filter/forEach callbacks receive one-based index arrays, and `and`/`or`/`??` short-circuit lazily (`rawArgs` — `true or undefinedVar` no longer throws). Each transform factory takes its base function as an **injected dependency** (no parallel implementation layer); the standalone compiler gained `rawArgs` and `end` support; the `MathJSDenseMatrix` bridge now invokes callbacks arity-appropriately (a typed 2-arg expression lambda previously threw "Too many arguments"). The programmatic API is unchanged — only the expression namespace gets transform semantics, exactly like mathjs. **This is a breaking change for expression strings that relied on the old zero-based indexing.**

### Patch Changes

- 598e72d: Wire the 92 formerly-dormant `embeddedDocs` entries (MathTS-native extensions: CAS/algebra, geometry, numeric, probability, signal, special) into the docs index — `help('polyFit')`, `help('gaussQuad')`, `help('besselJ0')`, etc. now work; previously these doc files existed but were invisible to `help()`. The one doc for a nonexistent function (`distribution`, a removed mathjs factory) was deleted rather than wired. A completeness test now pins that every documented function exists in the surface (docs never lie). Combined with the transform wiring, the expression package's dormant-file count drops 127 → ~4.
- Updated dependencies [598e72d]
- Updated dependencies [ce8f929]
  - @danielsimonjr/mathts-expression@0.5.0

## 0.12.1

### Patch Changes

- 8bae740: Remove the runtime import cycle introduced with `typed/polynomial-ideal.ts`: `polyFromExpression` now uses a self-contained recursive-descent polynomial parser instead of importing the factory-scope `parse` (which closed the loop `factories/evaluate → typed/index → typed/algebra → polynomial-ideal → factories/evaluate`). Behavior is unchanged — all Gröbner/eliminate oracle pins pass identically; module cycles are back to 0.

## 0.12.0

### Minor Changes

- 779fcde: B-5 upstream-fix audit (all 61 drift commits since the last mathjs sync; full verdicts in `docs/roadmap/UPSTREAM_FIX_AUDIT_2026-07-05.md`):

  - **`groebnerBasis` rewritten — it was not computing a Gröbner basis at all.** The old code returned the parsed inputs "normalized", through an evaluation-based coefficient extractor that could not distinguish `x` from `x²` — `⟨x²+y²−1, x−y⟩` came back containing `x+y−1`, which does not vanish on the system's solutions. Now: exact AST-parsed polynomial arithmetic + real Buchberger (lex order) with honest iteration/size caps (new `typed/polynomial-ideal.ts`), reduced monic basis, oracle-pinned by ideal-membership vanishing tests.
  - **`eliminate` rewritten — it returned decorative strings, not equations** (`"(A) - (B) [x eliminated]"`) and echoed garbage input. Now computes the real elimination ideal (lex basis with the eliminated variable first, keep elements free of it) and throws on non-equation input.
  - **`laplacian` validates its variables** (empty array / empty strings / missing scope values throw clear errors instead of silent 0).
  - **core `Unit` gains the upstream astronomical/nautical/typography units** (`astronomicalUnit`/`AU`, `lightyear`/`ly`, `parsec`/`pc`, `nauticalMile`/`nmi`, `fathom`, `furlong`, `point`, `pica`) with the upstream prefix-direction fix: `ly`/`pc` accept upward prefixes only (`kpc`, `Mpc`, `Mly` work; `mly`/`mpc` throw instead of silently misparsing), and lowercase `au` stays undefined (Bohr-radius collision). IAU/NIST-pinned.

  Audited clean (no port needed): `discriminant`, `piecewise`, `toRadicals`, `fullSimplify`, `complexExpand`, `reduce`, `rowReduce`.

### Patch Changes

- 5f3b401: B-3: replace the dead `../../../lib/wasm/<file>` legacy fallback in all three wasm loaders (matrix `WasmLoader`, matrix `WASMBackend`, functions `WasmLoader`) with `defaultWasmLocation()` — a package-root-aware resolver that names the canonical `dist/wasm/<file>` location. The old fallback was only correct for the pre-bundling source layout: from a bundled `dist/` it resolved OUTSIDE the repo (the misleading `…/Github/lib/wasm/…` ENOENT warnings), and `<repo-root>/lib/wasm` no longer exists in any layout. The browser branch previously _only_ had the broken legacy URL and never tried the packaged location — it now returns the bundle-relative `./wasm/<file>` URL, which is correct for a served `dist/`. Behavior on the happy path is unchanged (the packaged artifact is found first, and both published tarballs ship it); what changes is that a missing binary now produces an actionable warning pointing at the real expected path, and browser consumers can actually load WASM.
- Updated dependencies [779fcde]
- Updated dependencies [583817d]
- Updated dependencies [538c672]
- Updated dependencies [5f3b401]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-matrix@0.2.0
  - @danielsimonjr/mathts-parallel@0.3.2
  - @danielsimonjr/mathts-expression@0.4.5

## 0.11.3

### Patch Changes

- b6917e1: **`shapiroWilkTest` now computes the correct Royston (1995, AS R94) W statistic and p-value.** The previous implementation used plain Blom order-statistic scores without Royston's polynomial tail-weight corrections (a*n, a*{n-1}) and φ renormalization — W was biased low by up to ~2% at small n (0.9014 vs scipy's 0.9166 on an 8-point sample), and the p-value transform used Shapiro-**Francia** constants (−1.2725 + 1.0521·ln n), the wrong test's normalization. After the fix, W agrees with `scipy.stats.shapiro` to ~2e-10 and p to ~6e-8 across pinned samples (`gap-scipy-and-tail-oracles.test.ts`), with the exact n=3 arcsine distribution and Royston's n≤11 / n≥12 branches. Returned W and p values change — they are now the standard ones users can compare against published tables.

## 0.11.2

### Patch Changes

- 22427a8: Dead-code sweep: remove all 31 verified-unreferenced exports flagged by the fixed dependency-graph unused-analysis (plus 4 cascade orphans), ~630 LOC. None were public API — every symbol was verified unimported by source, tests, docs, and factory name-string dispatch before deletion. Highlights: the mathjs number-only-bundle factory remnants (`createNthRootNumber`, `createCompareTextNumber`, `createEqualScalarNumber`, `createBigNumberClass`, `createComplexClass`, `createArgumentsError`, `createIndexError`), the dead `functions/src/expression/operators.ts` precedence/associativity chain (the live copy is the `expression` package's own), orphan utils (`initial`, `toObject`, `noIndex`/`noSubset`, `endsWith`/`escape`, `operatorPrecedence`), unused JSON/type contracts, `SI_PREFIX_KEYS`, and AssemblyScript complex-constant helpers. The unused-analysis deletion-candidate count is now **0**.
- Updated dependencies [22427a8]
- Updated dependencies [6cd4dfd]
  - @danielsimonjr/mathts-core@0.4.1
  - @danielsimonjr/mathts-expression@0.4.4
  - @danielsimonjr/mathts-parallel@0.3.1

## 0.11.1

### Patch Changes

- 47eb41c: `qz` / `realSchur`: deflate converged complex-conjugate 2×2 blocks. The shifted-QR iteration could only deflate one real eigenvalue at a time, so for a pencil with complex eigenvalue pairs the block counter never decreased and the loop always ran its full 8000-iteration cap after converging (~1s for a 4×4, ~350ms of pure no-op steps for a 2×2 rotation). It now deflates a trailing 2×2 block whose eigenvalues are complex (and stops when the remaining top block is itself a complex pair — the real Schur form cannot reduce it further), cutting the pathological cases to milliseconds. Deflation tolerances also gained an absolute fallback scale so zero-diagonal blocks (pure imaginary spectra) can deflate at all. This was the root cause of the intermittent `gap-qz` vitest-timeout failure under parallel full-suite load.

## 0.11.0

### Minor Changes

- 18871e1: `pow(A, n)` now supports **square-matrix power** for non-negative integer exponents (mathjs parity) — previously `pow` had only scalar signatures and threw `Unexpected type of argument` on a matrix. It uses binary exponentiation on the native `DenseMatrix` backend (accelerated matmul, B2). Element-wise power remains `dotPow`; negative or fractional matrix powers throw a clear error directing to the async `matrixPower(A, p)` (which does the eigendecomposition).

### Patch Changes

- dc14440: Fix the canonical `expm` (matrix exponential), which was **completely broken** — it threw on every input. The public `expm` was the factory-Padé implementation, which was instantiated inside the window where `factoryScope.multiply` is temporarily bound to `multiplyScalar` (for `det`'s scalar-element LU), so it captured a scalar-only multiply and threw `Unexpected type of argument in function multiplyScalar` on any matrix; it also lacked an `Array` signature, throwing `A.size is not a function` on a raw `number[][]`. The canonical `expm` now routes to the native, backend-accelerated `matrixExpm` (DenseMatrix/Array dispatch) — the same implementation that was already tested under the non-canonical name. The dead factory `expm.ts` (272 LOC) was removed. This is part of B2 (route factory matrix ops through the native `DenseMatrix` path).

## 0.10.1

### Patch Changes

- 7860d6a: Two input-validation fixes surfaced while adding WS-1 P2 oracles:

  - `spectralClustering` now throws a clear error when given a non-square adjacency matrix. Previously a non-square input (e.g. a point cloud mistaken for an adjacency matrix) reached the eigensolver and **looped forever**.
  - `voronoiDiagram` now throws a clear `TypeError` when its `bounds` argument is missing or not a 4-tuple, instead of crashing with `Cannot read properties of undefined`.

## 0.10.0

### Minor Changes

- 23642f2: Add `spearman(x, y)` — the Spearman rank correlation coefficient (Pearson correlation of the rank-transformed inputs, ties handled via average ranks). Unlike Pearson, it captures any monotonic relationship, so a monotonic non-linear pair returns ρ = 1. This closes the one remaining gap in the descriptive-statistics domain (`skewness`/`kurtosis`/`cov`/`gmean`/`iqr`/`zscore`/`kruskalWallis`/`wilcoxon`/`fTest` already shipped).

### Patch Changes

- dfb1b25: `kolmogorovSmirnovTest` now throws a clear `TypeError` when its `cdfFn` argument is not a function (e.g. a second sample array passed under the mistaken assumption it is a two-sample test) instead of crashing with an opaque `cdf is not a function`. It remains a one-sample test against a CDF function (default: standard normal).

## 0.9.0

### Minor Changes

- 82bb0b1: **BREAKING (Unit merge complete): one `Unit`.** The former standalone core `Unit` class (the canonical-value subset in `core/src/types/unit.ts`) is retired; `@danielsimonjr/mathts-core`'s `Unit` is now the single, feature-complete merged implementation, and `functions` `unit()`/`to()`/`toBest()`/arithmetic+comparison operators all return that one class (the `to`/`toBest` operator dual-flavor branching is gone).

  Caller migration:

  - Unit arithmetic is at the operator level — use `add`/`subtract`/`multiply`/`divide` from `@danielsimonjr/mathts-functions`, not `unit.add(…)`/`.sub`/`.mul`/`.div`. `u1 / u2` of the same dimension returns a plain dimensionless number (mathjs parity).
  - `unit.equalBase(other)` replaces `unit.dimensionsEqual(other)`; dimensions are a 9-element exponent array, not a struct; `unit.formatUnits()`/`unit.toString()` replace `.notation`.
  - Temperature offsets apply on conversion (`new Unit(20,'degC').value === 20`; `.to('K')` → `293.15 K`); `°C`/`°F`/`°` are accepted.
  - `DimensionMismatchError`/`UnitParseError` are still thrown and exported; `Unit`/`isUnitValue`/`DIMENSIONLESS`/`dim`/`Dimensions`/`UnitDef` keep their import paths. New `UnitInstance` type export for type position.

  Also corrects `eV` to the exact 2019-SI value `1.602176634e-19` J.

### Patch Changes

- c041b4e: Fix Unit arithmetic/comparison and `pinv` Array input.

  - **Unit operators**: dimensional analysis now works through the public API — `add`/`subtract`/`multiply`/`divide`/`abs` and `smaller`/`larger`/`smallerEq`/`largerEq`/`equal`/`unequal`/`compare` on `unit(...)` values (`5 cm + 3 mm = 5.3 cm`, `3 m × 4 m = 12 m²`, `10 m / 2 s = 5 m/s`, `equal(5 cm, 50 mm) = true`); mismatched dimensions throw. The typed operators had been wired to a different `Unit`'s interface, so every `unit()` arithmetic/comparison threw. Both Unit flavors (`unit()` and `to()`/`toBest()`) are supported.
  - **`pinv([[…]])`** (Array input) threw "expected DenseMatrix"; added Array-in/Array-out signatures.

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [c041b4e]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-matrix@0.1.14
  - @danielsimonjr/mathts-expression@0.4.3

## 0.8.0

### Minor Changes

- Degenerate-input hardening for the 2026-06-30 domain gap-closure functions (retroactive code-review + silent-failure pass).

  A 7-reviewer pass over the ~89 new functions found one recurring root cause: they silently returned `NaN`/`Infinity`/garbage on structurally invalid or statistically degenerate input. Policy fix: throw a clear `Error` matching the scipy/numpy semantics the docstrings claim. Covered by `functions/tests/gap-degenerate-inputs.test.ts`.

  - **descriptive-stats**: `gmean`/`hmean` throw on non-positive entries; `zscore`/`skewness`/`kurtosis` throw on constant (zero-variance) input; `skewness`/`kurtosis` return `NaN` (SciPy parity) for a bias-correction requested below its `n` domain; `cov` throws when observations ≤ `ddof`. Empty input stays graceful (`NaN`/`[]`).
  - **numeric-extra**: `logsumexp`/`softmax` use a spread-free O(n) max (was `RangeError` on ~1e5+ vectors); `cumtrapz` throws on an abscissa shorter than `y`.
  - **hypothesis-extra**: `fTest`/`jarqueBera`/`kruskalWallis`/`wilcoxon`/`tukeyHSD` guard degenerate samples; `studentizedRangeQuantile` validates `p∈(0,1)` and brackets adaptively; `studentizedRangeCDF` validates `k≥2`/`df>0` and self-extends its `umax` tail bound.
  - **linalg-extra**: `companion` throws on a zero leading coefficient; `realSchur` throws if QR ever fails to reach (quasi-)triangular form.
  - **geometry-extra**: `slerp` throws on zero-length / antipodal inputs; `quaternionNormalize` throws on zero magnitude.
  - **timeseries-extra**: `acf` guards zero-variance / out-of-range `nlags`; `ewma` guards empty input; `detrend('linear')` returns zeros for `<2` points.
  - **regression-extra**: `linearRegression` throws on `<3` points or a zero-variance predictor.
  - **optimization-extra**: `levenbergMarquardt` re-throws non-singular solver errors instead of swallowing them.
  - **clustering-extra**: `KMeansResult` gains `converged`/`iterations`; `kmeans` validates empty `data` and non-integer/`<1` `k`.
  - **signal-filter-extra**: `butter` validates `N≥1`/`0<Wn<1`; `firwin` validates `numtaps≥2` and rejects zero-sum designs; `lfilterZi` reports a clear pole-at-`z=1` error.
  - **cas-integration**: `symbolicIntegral` returns its `integral(...)` marker (not a thrown "Undefined symbol") for symbolic constant coefficients.

## 0.7.0

### Minor Changes

- Gap-analysis closure (no deferral): the remaining high-complexity functions + two root-cause bug fixes.

  All verified against NumPy/SciPy or by self-consistency (d/dx ∫f = f).

  **functions — new:**
  - Optimizers: `nelderMead`, `gradientDescent`, `levenbergMarquardt`.
  - Clustering: `kmeans`, `spectralClustering`.
  - Digital filter design (vs scipy.signal): `firwin`, `butter`, `lfilter`, `lfilterZi`,
    `filtfilt` — `butter` via the full zpk→bilinear→tf pipeline, `filtfilt` via scipy's
    `lfilter_zi` steady-state edge handling (both to machine precision).
  - `studentizedRangeCDF` / `studentizedRangeQuantile` + `tukeyHSD` (vs scipy.stats).
  - `qz` (generalized Schur decomposition of a pencil).
  - `symbolicIntegral` (symbolic indefinite integration over a useful subset).

  **core — fix:** `new Fraction(0.25)` threw `BigInt(0.25)`, which silently broke the CAS
  `simplify` and symbolic `derivative` for ANY fractional coefficient (e.g.
  `derivative('x^4/4','x')`). The constructor now decomposes a non-integer number into an
  exact integer ratio (`0.25` → `1/4`).

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.1

## 0.6.0

### Minor Changes

- Domain gap-analysis Waves A–D: ~69 new math/scientific functions + an eigs correctness fix.

  All verified against a NumPy/SciPy oracle; each is a thin composition over existing
  primitives (no reduction re-implemented).

  - **Descriptive stats**: `gmean`, `hmean`, `moment`, `skewness`, `kurtosis`, `iqr`,
    `sem`, `zscore`, `cov`, `corrcoef`, `rankdata`.
  - **Elementwise / cumulative / log-domain**: `clamp`, `sigmoid`, `logsumexp`,
    `softmax`, `cumprod`, `cummax`, `cummin`, `cumtrapz`.
  - **Distribution surface**: standalone `normalQuantile`, `studentTCDF/Quantile`,
    `chiSquaredCDF/Quantile`, `fCDF/Quantile`, `gammaCDF/Quantile`, `betaCDF/Quantile`,
    plus the `cauchy`/`laplace`/`logistic` PDF/CDF/quantile families.
  - **Hypothesis tests**: `fTest`, `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`.
  - **Linear algebra**: `tril`, `triu`, `vander`, `toeplitz`, `circulant`, `companion`,
    `logdet`, `laplacianMatrix`, `generalizedEig`.
  - **Calculus**: `hessian`, numeric `gradient`.
  - **Geometry / geodesy**: `haversine`, `slerp`, quaternion algebra
    (`quaternionMultiply`/`Conjugate`/`Normalize`/`FromAxisAngle`/`Rotate`/`ToRotationMatrix`).
  - **Time series & regression**: `movingAverage`, `ewma`, `detrend`, `acf`,
    `linearRegression`.

  **fix: `eigs` returned wrong eigenvalues for every non-symmetric matrix** (even
  upper-triangular ones). The public `eigs` now routes numeric square matrices through
  the correct native orthes/hqr2 solver (symmetric/non-symmetric/complex spectra).

## 0.5.0

### Minor Changes

- Named mathematical constants are now real exports + evaluator symbols.

  `docs/reference/constants.md` documented `import { PI, E, PHI, TAU } from
'@danielsimonjr/mathts-core'`, but those were never exported. They exist now:

  - **core**: new named exports `PI`, `E`, `TAU`, `PHI`, `SQRT2`, `SQRT1_2`, `LN2`,
    `LN10`, `LOG2E`, `LOG10E` (plain numbers). The imaginary unit `I` and the
    type-specific constants (`COMPLEX_*`, `BIGNUMBER_*`, `FRACTION_*`) are unchanged.
  - **functions**: the expression-evaluator scope gains `phi`, the imaginary unit
    `i`, and `SQRT2` / `SQRT1_2` / `LN2` / `LN10` / `LOG2E` / `LOG10E` (it already had
    `pi`/`e`/`tau`). So `evaluate('phi')` → 1.618…, `evaluate('2 + 3*i')` → Complex(2, 3).

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-expression@0.4.2
  - @danielsimonjr/mathts-matrix@0.1.12

## 0.4.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-matrix@0.1.11
  - @danielsimonjr/mathts-expression@0.4.1

## 0.3.0

### Minor Changes

- Gap-closure batch (GC1–GC16):

  - **fix (GC3):** accurate normal/log-normal CDF + quantile. The previous
    Abramowitz-&-Stegun erf approximation collapsed in the tails (`normalCDF(-5)`
    was 3-digit); now ~15-digit via the package's accurate `erfc` + an Acklam/Halley
    inverse-normal. Affects `normalDist`, `logNormalDist`, and `normalCDF`.
  - **fix (GC1):** `variance`/`std` now default to **unbiased** (mathjs parity) and
    accept a `normalization` argument, matching `parallelStatVariance`/`Std`.
  - **feat (GC4):** canonical-name aliases `cumsum`/`ctranspose`/`createUnit`/`apply`/
    `index`, and a real `help(search)`.
  - **feat (GC5):** `Unit` support in `add`/`subtract`/`multiply`/`divide` and the
    comparison operators (`5 cm + 3 mm`, `5 cm > 40 mm`).
  - **feat (GC6):** complex-argument `lgamma`.
  - **feat (GC7):** accelerated `multiply(2D, 2D)` via native DenseMatrix + BackendManager.
  - **feat (GC10):** `BigNumber` path for `acsc`/`asec`/`acot`.
  - **feat (GC16):** `Complex` for `round`/`floor`/`ceil`/`fix`/`sign`; `BigNumber` for
    `gcd`/`lcm`/`atan2`.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @danielsimonjr/mathts-expression@0.4.0
  - @danielsimonjr/mathts-parallel@0.3.0
  - @danielsimonjr/mathts-matrix@0.1.10

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

### Changed — eslint `no-explicit-any`/other cleanup (subset-3, completes `functions/src`)

- Drove the remaining `functions/src` dirs to zero eslint warnings:
  `factories` (354), `expression` (43), `bitwise` (40), `logical` (32),
  `trigonometry` (15), `statistics` (11), `error` (8), `set`, `signal`,
  `wasm`, `typed`, `combinatorics`, `string`, `unit`, `probability`,
  `relational`, and root `types.ts`. Behavior-preserving (no logic changes);
  the functions suite stays green (2902 pass / 41 skip) and `tsc --noEmit` is 0.
- Honest replacements throughout: `factoryScope as any` → `as Parameters<typeof
createX>[0]`; matrix-algorithm casts → `as unknown as AlgorithmFunction` /
  `Parameters<typeof matAlgoX>[n]`; empty-object-type placeholders → real
  `BigNumber`/`Matrix`/`IndexInterface` types; sparse matrix element values →
  `unknown`; `expression/operators` precedence table → structural
  `OperatorProperty`/`OperatorNodeLike` types; `BigNumber` trig methods typed via
  the inherited `decimal.js` surface; `Error.captureStackTrace` via a narrow
  local interface.
- Removed redundant suppressions: stale `@ts-ignore` on `seedrandom` /
  `javascript-natural-sort` imports (already typed by `types/modules.d.ts`) and
  unused `eslint-disable` directives in `typed/cas.ts` / `typed/algebra.ts`.
- `type/unit/Unit.ts` deliberately left untouched (still `@ts-nocheck`) for its
  dedicated typing pass.

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
  returned J\_{n+1}.
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
