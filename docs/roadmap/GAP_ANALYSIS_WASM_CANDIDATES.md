# Gap Analysis — WASM-Convertible Functions (Rust + AssemblyScript)

**Status**: Analysis — no code changes
**Date**: 2026-05-20
**Scope**: Identify self-contained, import-free, numeric functions across the
MathTS TypeScript packages that are candidates for WebAssembly packaging
(Rust as the primary toolchain, AssemblyScript as the fallback), and measure
them against what is _already_ in WASM.
**Method**: Two parallel codebase surveys — (1) full inventory of the existing
WASM surface, (2) scan of every package for pure import-free numeric kernels —
followed by direct verification of the gap claims against the Rust crate.

---

## 1. Executive summary

The headline finding is **counter-intuitive**: "convert these functions to
Rust" is _mostly already done_. The Rust crate
(`wasm-rust/crates/mathts-wasm/`) is `#![no_std]` and exports **~1,016
functions** across 20 domains. The AssemblyScript package (`assembly/src/`)
exports **~202**.

So the gap is not one gap — it is **three distinct gaps**:

| Gap                               | What it is                                                                                                                    | Size              | Effort to close                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------- |
| **A — Activation gap**            | Pure-JS kernels in `functions/src/typed/` that _already have a Rust twin_ but never call it — the JS fallback always runs.    | ~60–100 functions | Low–medium (wiring, not porting) |
| **B — True porting gap**          | Pure, import-free functions with **no Rust counterpart at all**.                                                              | ~45 functions     | Medium–high (new Rust code)      |
| **C — AssemblyScript parity gap** | AS lags Rust by ~800 exports; entire domains (special, signal, combinatorics, algebra, numeric, …) have **zero** AS coverage. | ~13 domains       | High (volume)                    |

The single most important concrete fact: **`functions/src/typed/special.ts`'s
`getRustWasm()` returns `null` unconditionally** (line 25-32, comment: _"Currently
disabled — JS fallbacks handle all operations"_). Every special function runs
its pure-JS kernel even though Rust equivalents for ~half of them already
exist. That one disabled function is the largest slice of Gap A.

**Recommended priority**: close Gap A first (cheap, unlocks existing Rust
work), then Gap B's high-value items (**SVD** above all), then chip at Gap C.

---

## 2. What counts as a WASM candidate

A function qualifies as "import-free and WASM-convertible" when:

1. **No computational module imports.** The `mathTyped('name', {...})` wrapper
   and `import type` lines do not disqualify it — typed-function dispatch is
   boilerplate, not a computation. Calling `computePool.*`, other factory
   functions, or `Complex`/`Fraction`/`BigNumber` instance methods _does_
   disqualify it.
2. **Numeric data only.** Operates on `number`, `bigint`, `Float64Array` /
   `Int32Array` / other typed arrays, or plain `number[]`. WASM cannot cheaply
   cross the boundary for: JS objects/records, `Map`/`Set`, closures over
   non-numeric state, strings-as-data, dynamic dispatch, `async`, or JS
   function-pointer callbacks.
3. **Compute-bound enough to be worth it.** A loop-heavy kernel or an
   iterative numerical algorithm. A single `Math.sin` call or one arithmetic
   op is _not_ worth the FFI overhead.

---

## 3. The candidate pool (pure, import-free kernels)

Surveyed across `functions/src/typed/`, `matrix/src/`, `tensor/src/`,
`autograd/src/`. Domains where every relevant kernel is pure:

| Domain                        | File                                                                          | Pure kernels found                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Special functions             | `functions/src/typed/special.ts`                                              | **~30** — erf/erfc, lgamma, beta, gammainc/betainc, digamma, full Bessel family, elliptic K/E, Lambert W, Fresnel, integral functions, orthogonal polynomials. The whole file's only import is `mathTyped`. |
| Signal/DSP                    | `functions/src/typed/signal.ts`                                               | **~22** — `fftCoreFloat64`, convolution, correlation, DCT/DST, DWT, Hilbert, spectrogram, periodogram, FIR filters, window functions.                                                                       |
| Statistics                    | `functions/src/typed/statistics.ts`                                           | **~12** — Welford variance, quickselect family, quantile, cumsum, p-norm, prod.                                                                                                                             |
| Combinatorics / number theory | `functions/src/typed/combinatorics.ts`                                        | **~25** — Fibonacci/Lucas, factorials, prime sieve, factorization, totient, Möbius, Jacobi, CRT, partitions.                                                                                                |
| Linear algebra                | `matrix/src/operations/svd.ts`, `eig.ts`; `functions/src/typed/matrix-ops.ts` | **~20** — SVD (Golub-Reinsch), eigensolver, `rowReduce`, `cholesky`, `hessenbergForm`, `characteristicPolynomial`. `svd.ts`/`eig.ts` have **zero project imports**.                                         |
| Numeric / optimization        | `functions/src/typed/numeric.ts`                                              | **~12** non-callback — `linsolve`, `leastSquares`, `rank`, `cond`, `nullspace`, `polyRoots`, `quadprog`, `linprog`, `residue`, curve fits.                                                                  |
| Interpolation                 | `functions/src/typed/interpolation.ts`                                        | **~6** — entire file is import-free (Lagrange, Hermite, PCHIP, `polyFit`, splines).                                                                                                                         |
| Algebra (polynomial)          | `functions/src/typed/algebra.ts`                                              | **~9** — `polyval`, `polyadd`, `polymul`, `polyder`, polynomial GCD/LCM, `discriminant`, `resultant`.                                                                                                       |
| Tensor                        | `tensor/src/Tensor.ts`                                                        | **~6** — `matMul`, rank-N `transpose`, `einsum`, elementwise ops (pure `Float64Array`).                                                                                                                     |
| Autograd                      | `autograd/src/dual-tensor.ts`                                                 | **~4** — dual-number elementwise `add`/`sub`/`mul`/`scale`.                                                                                                                                                 |

That is **~150 pure import-free numeric kernels** in the candidate pool.

---

## 4. The existing WASM surface (baseline)

`wasm-rust/crates/mathts-wasm/` — ~1,016 `#[no_mangle] extern "C"` exports
(camelCase names; **no** `#[wasm_bindgen]`), 20 domains:

| Domain                                                                     | Rust exports | AS exports | AS coverage                  |
| -------------------------------------------------------------------------- | -----------: | ---------: | ---------------------------- |
| Arithmetic                                                                 |         ~100 |        ~78 | deep                         |
| Trigonometry                                                               |           25 |         13 | partial (no reciprocal trig) |
| Complex numbers                                                            |         ~103 |        ~81 | near-parity                  |
| Matrix / linear algebra                                                    |         ~197 |         41 | dense ops only               |
| Algebra / decompositions                                                   |           85 |          0 | **none**                     |
| Numerical analysis                                                         |          128 |          0 | **none**                     |
| Signal processing                                                          |           33 |          0 | **none**                     |
| Statistics                                                                 |           32 |         ~7 | reductions only              |
| Special functions                                                          |          ~30 |          0 | **none**                     |
| Combinatorics                                                              |           18 |          0 | **none**                     |
| Probability / distributions                                                |           29 |          0 | **none**                     |
| Geometry                                                                   |          ~33 |          0 | **none**                     |
| Relational, Logical, Bitwise, Set, String, Unit, Number-theory utils, SIMD |         ~170 |         ~2 | near-zero                    |

The Rust `compat/` module exists specifically to mirror the AS API — i.e.
everything AS has, Rust also has.

---

## 5. The gap, domain by domain

For each domain: candidate kernels → already in Rust (Gap A, wire it) vs. not
in Rust (Gap B, port it). **Every row is also a Gap C item** unless AS already
covers it (only arithmetic/complex/dense-matrix do).

### Special functions — _mostly Gap A, partly Gap B_

- **Gap A (Rust twin exists, JS fallback runs)**: `erf`, `erfc`, `lgamma`,
  `beta`, `gammainc`, `betainc`, `digamma`, `besselJ0/J1/Y0/Y1`,
  `besselJ/Y/I/K`, `ellipticK`, `ellipticE`, `lambertW`, `fresnelC`,
  `fresnelS`. **~17 functions** — blocked solely by the disabled
  `getRustWasm()`.
- **Gap B (no Rust counterpart — verified absent)**: `chebyshevT`,
  `hermiteH`, `laguerreL`, `legendreP` (orthogonal-polynomial evaluators),
  `erfi`, `cosIntegral` (Ci), `sinIntegral` (Si), `logIntegral` (li),
  `expIntegralEi` (Ei). **9 functions.**

### Signal / DSP — _mostly Gap A, partly Gap B_

- **Gap A**: `fftCoreFloat64`, `fft2d`, `convolve`/`_convolve`,
  `crossCorrelation`, `autoCorrelation`, `dct`/`idct`, `dst`/`idst`, `dwt`,
  `hilbertTransform`, `spectrogram`, `periodogram`, FIR filters,
  `groupDelay`, `unwrapPhase`. **~18 functions** — Rust `signal/` covers them.
- **Gap B (verified absent)**: `resample` (linear-interp resampling),
  `medfilt` (median filter), `windowFunction` (Hamming/Hann/Blackman/Bartlett
  generators). **3 functions.**

### Statistics — _entirely Gap A_

`welfordVariance`, `quickSelect`/`medianSelect`/`minSelect`/`maxSelect`,
`parallelStatQuantile`, `parallelStatCumsum`, `parallelStatProd`,
`parallelStatNorm` — all have Rust twins in `statistics/basic.rs` +
`statistics/select.rs`. Pure wiring.

### Combinatorics / number theory — _split_

- **Gap A**: `fibonacci`, `lucas`/`lucasL`, `doubleFactorial`,
  `risingFactorial`/`fallingFactorial`, `subfactorial`, `prime`/`nextPrime`,
  `primePi`. (Rust `combinatorics/` + `utils/checks.rs`.)
- **Gap B (verified absent — no number-theory module in Rust)**:
  `primeFactors`, `divisors`, `eulerPhi` (totient), `divisorSigma`,
  `carmichaelLambda`, `moebiusMu`, `jacobiSymbol`, `chineseRemainder`,
  `partitions` (integer-partition DP), `harmonicNumber`, `integerDigits`.
  **11 functions** — a whole missing sub-domain.

### Linear algebra — _the biggest Gap B_

- **Gap A**: `cholesky`, `hessenbergForm`, `matrixRank`, the `eig`
  QR-algorithm path (Rust `matrix/eigs.rs` + `complex_eigs.rs`).
- **Gap B (verified absent)**: **`svd`** — `matrix/src/operations/svd.ts` is a
  pure, import-free Golub-Reinsch SVD; Rust only has an _internal_ one-sided
  Jacobi routine for `cond`/`rank` in `numeric/analysis.rs`, with **no
  standalone `svd` export** returning U/Σ/V. Also `pinv`, `lowRankApprox`,
  `singularValues` (all SVD-dependent), `rowReduce` (RREF),
  `characteristicPolynomial` (Faddeev-LeVerrier). **~6 functions** — highest
  value in the whole analysis.

### Numeric / optimization — _split_

- **Gap A**: `linsolve` (→ Rust `solve`), `leastSquares`, `rank`, `cond`,
  `polyRoots`.
- **Gap B (verified absent — Rust `optimization.rs` has only 3 functions)**:
  `linprog` (simplex LP), `quadprog` (projected-gradient QP), `nullspace`,
  `residue` (partial-fraction expansion), `padeApproximant`,
  `expfit`/`logfit`/`powerfit`. **~8 functions.**

### Algebra (polynomial) — _split_

- **Gap A**: `polyval`, `polymul`, `polyder` (Rust `algebra/polynomial.rs`).
- **Gap B (verified absent)**: `polyadd`, `polynomialGCD`, `polynomialLCM`,
  `polynomialQuotient`, `polynomialRemainder`, `discriminant`, `resultant`.
  **7 functions.**

### Tensor & autograd — _entirely Gap B (no Rust tensor module)_

- **Gap B**: `Tensor.matMul` (rank-2 ~ covered by matrix multiply, but the
  rank-N path is not), **rank-N `transpose`**, **`einsum`** (general tensor
  contraction), `DualTensor` dual-number elementwise kernels. **~6 functions.**
- Interpolation: all 6 kernels are **Gap A** (Rust `numeric/interpolation.rs`
  is comprehensive).

---

## 6. Gap B — the true porting backlog (prioritized)

Functions that genuinely need new Rust (and AS) implementations, ranked by
value × purity:

| Priority | Function(s)                                                                                                                               | Domain             | Why                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| **P0**   | `svd`, `pinv`, `lowRankApprox`, `singularValues`                                                                                          | Linear algebra     | SVD is foundational (PCA, least squares, conditioning); pure O(n³) iterative QR — the textbook WASM win. |
| **P1**   | `linprog`, `quadprog`, `nullspace`                                                                                                        | Optimization       | Heavy iterative kernels; Rust `optimization.rs` is nearly empty.                                         |
| **P1**   | `chebyshevT`, `hermiteH`, `laguerreL`, `legendreP`                                                                                        | Special            | Pure recurrences; needed for spectral methods / quadrature.                                              |
| **P2**   | `primeFactors`, `eulerPhi`, `moebiusMu`, `jacobiSymbol`, `divisors`, `divisorSigma`, `carmichaelLambda`, `chineseRemainder`, `partitions` | Number theory      | A coherent missing sub-domain; trial-division + sieve + DP, all integer math.                            |
| **P2**   | `erfi`, `cosIntegral`, `sinIntegral`, `logIntegral`, `expIntegralEi`                                                                      | Special            | Series/asymptotic kernels; complete the special-function set.                                            |
| **P3**   | `einsum`, rank-N `transpose`                                                                                                              | Tensor             | Compute-heavy contraction; no Rust tensor module exists.                                                 |
| **P3**   | `resultant`, `discriminant`, `polynomialGCD/LCM`, `polyadd`                                                                               | Algebra            | Coefficient-array polynomial algebra.                                                                    |
| **P3**   | `resample`, `medfilt`, `windowFunction`                                                                                                   | Signal             | Small DSP kernels missing from `signal/`.                                                                |
| **P4**   | `rowReduce`, `characteristicPolynomial`                                                                                                   | Linear algebra     | Gaussian elimination / Faddeev-LeVerrier.                                                                |
| **P4**   | `DualTensor` elementwise, `padeApproximant`, `residue`, curve fits                                                                        | Autograd / numeric | Lower compute intensity; do alongside tensor work.                                                       |

**~45 functions** total in Gap B.

---

## 7. Gap A — the activation backlog

These pure-JS kernels already have a Rust twin; the work is _wiring_, not
porting. Ordered by payoff:

1. **Re-enable `special.ts` `getRustWasm()`** — currently a hard `return null`.
   Fixing the ESM lazy-load (`getExports()` API mismatch noted in its own
   comment) unlocks ~17 special functions at once.
2. **Route `signal.ts` JS fallbacks through Rust** — FFT/DCT/DST/DWT/Hilbert/
   convolution all have Rust twins; the JS bodies are fallbacks.
3. **Route `statistics.ts` selection/variance kernels** — 1:1 Rust twins.
4. **Route `interpolation.ts`** — Rust `numeric/interpolation.rs` is complete.
5. **Combinatorics Gap-A subset** — fibonacci/lucas/factorials/primes.

Gap A is **~60–100 functions** and is the cheapest, highest-leverage work
because the Rust already passes the SHA-384-verified manifest build.

---

## 8. Gap C — AssemblyScript fallback parity

The user explicitly wants **AssemblyScript as the fallback**. Today AS is not a
fallback for most of the library — it is a narrow subset:

- **AS covers**: scalar arithmetic/trig, array reductions, dense-matrix ops,
  complex scalar/array ops (~202 exports).
- **AS has ZERO coverage** of: special functions, signal/DSP, algebra &
  decompositions, numerical analysis, combinatorics, probability, geometry,
  logical, bitwise, set, string, unit, number-theory utilities. That is
  **~13 entire domains, ~800 functions** behind Rust.

For AS to be a genuine fallback, every Gap B port and ideally every Gap A
target should land in **both** toolchains. Practical approach: the Rust
`compat/` module is already the AS-shaped API surface — new AS code should
mirror new `compat/` functions one-to-one (the existing pattern). Realistic
scope: prioritize AS parity for the **P0–P2 Gap B** items and the
**special/signal/statistics** activation set; treating full ~800-function AS
parity as a long-tail effort.

---

## 9. Not candidates — and why

Excluded from all three gaps; documented so they are not re-surveyed:

- **`Float64Array` signatures in arithmetic/trig/statistics/signal** — already
  delegate to `computePool.*` (the worker-pool import); the async dispatch _is_
  the body.
- **`Complex` / `Fraction` / `BigNumber` signatures** — call instance methods
  on imported class objects (dynamic dispatch over heap objects).
- **Scalar one-liners** (`add`, single `Math.sin`, etc.) — FFI overhead dwarfs
  the work.
- **Callback-taking solvers** — `findRoot`, `minimize`, `maximize`,
  `globalMinimize`, `nintegrate`, `simpson`, `gaussQuad`, `romberg`,
  `curvefit`, `solveODESystem`, `solveBVP`, `chebyshevApprox` — numerically
  pure but accept a JS `(x)=>number` callback WASM cannot invoke. (Portable
  _only_ if the model function is itself compiled — a separate effort.)
- **Object/Map-structured** — `parallelStatMode` (`Map`), `kdTree`,
  `voronoiDiagram` (pointer-linked trees), `area`/`coordinateTransform`
  (discriminated-union args).
- **String/AST functions** — all of `algebra.ts`'s `expand`/`factor`/
  `simplify`/`substitute`, and all of `expression/src/` (parser/compiler;
  also security-sensitive per CLAUDE.md).
- **`matrixLog`, `polarDecomposition`, `jordanForm`** — call the `eig`/`svd`
  imports (will become portable once SVD/eig are wired).

---

## 10. Constraints & risks for any follow-up work

- **SHA-384 manifest invariant** — `functions/src/wasm/WasmLoader.ts` and
  `assembly/src/bindings/wasm-loader.ts` hash the `.wasm` buffer against
  `wasm-manifest.json` before instantiate. Any new build **must** regenerate
  the manifest (`tools/generate-wasm-manifest.mjs`); the check must not be
  bypassed. (Security invariant — see CLAUDE.md.)
- **ABI convention** — the Rust crate uses `#![no_std]` and raw
  `#[no_mangle] extern "C"` exports with **camelCase** names (no
  `#[wasm_bindgen]`). New functions must follow this; watch for name
  collisions (the crate already disambiguates with prefixes like `scalar_`,
  `wasm_`, `relational_`, `matrix_`).
- **AS↔Rust naming drift** — AS uses `snake_case` (`array_sum`), Rust mixes
  camelCase and prefixed names. A shared naming map would reduce friction.
- **Dead code already present** — `algebra/sparse_chol.rs` is commented out in
  `lib.rs` ("re-enable once compiles"); `lib.rs` has 3 temporary spike probes
  (`rust_mat_mul_2x2`, `rust_fft_4`, `rust_gamma`). Clean these up alongside
  new work.
- **Boundary marshalling** — functions returning `{re, im}` (complex) or
  `{values, vectors}` (eig) must flatten to typed arrays at the WASM boundary;
  keep the object-packing on the JS side (as `parallelFFT` already does).

---

## 11. Recommended sequencing

1. **Gap A first** (cheap, unlocks ~1,000 lines of already-built, already-
   verified Rust): fix `special.ts` `getRustWasm()`, then wire signal,
   statistics, interpolation, combinatorics fallbacks to their Rust twins.
2. **Gap B P0** — port **SVD** (and `pinv`/`lowRankApprox`) to Rust; it is the
   highest compute-value missing kernel and unblocks `matrixLog`/
   `polarDecomposition`/`jordanForm`.
3. **Gap B P1–P2** — optimization (LP/QP/nullspace), orthogonal polynomials,
   the number-theory sub-domain, remaining special functions.
4. **Gap C** — mirror every new Rust function into AssemblyScript via the
   `compat/`-shaped API, prioritizing the P0–P2 set so AS becomes a real
   fallback for the high-value paths.
5. **Gap B P3–P4** — tensor `einsum`, polynomial algebra, small DSP kernels,
   autograd elementwise.

**Bottom line**: ~150 pure import-free kernels exist; ~1,016 are already in
Rust WASM. The practical gap is **~45 functions to genuinely port** (SVD is
the marquee item), **~60–100 to simply wire up**, and a **~13-domain
AssemblyScript deficit** to close for true fallback parity.
