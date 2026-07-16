# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — scalar minimizer: `minimizeScalar` (Phase 1 Task 4)

No 1-D minimizer existed (only the vector Nelder–Mead `minimize` and root-finders). Added
`minimizeScalar(f, { bracket, tol, maxIter })` — Brent's method (golden-section search combined
with parabolic interpolation), returning `{ x, fval }`. Distinct from root-finding: minimizes
`f(x)` rather than solving `f(x) = 0`. If `bracket` is omitted, defaults to `[-10, 10]`. Defaults
`tol = 1e-8`, `maxIter = 100`. Pinned against closed-form minima: `(x-2)^2` → `x=2, f=0`;
`x^4 - 3x^3 + 2` on `[0,3]` → `x=2.25`; `sin(x)` on `[0,2pi]` → `x=3pi/2, f=-1`.

### Added — nonlinear system solver: `fsolve` / `root` (Phase 1 Task 3)

No solver existed for `F(x) = 0` where `F: ℝⁿ → ℝⁿ` (only scalar root-finders). Added
`fsolve(F, x0[, opts])` — damped Newton with a backtracking line search, reusing
`numericJacobian` (Task 1) for `J = numericJacobian(F, x)` and `linsolve` (`typed/numeric.ts`) to
solve the Newton step `J·Δ = −F(x)`. At each iterate, tries `λ ∈ {1, 1/2, 1/4, …}` (up to ~20
halvings) for the largest `λ` improving `‖F(x + λΔ)‖₂`, falling back to a full Newton step
(`λ = 1`) if none improves. Converges when `max_i |F_i(x)| < tol` (default `tol = 1e-10`,
`maxIter = 100`); throws a clear `Error` on a singular Jacobian or non-convergence. `root` is an
alias. Pinned against scipy.optimize.fsolve (`[x²−y, x+y−2]` from `[0.5,0.5]` → `[1,1]`;
`[x²+y²−25, x−y−1]` from `[5,1]` → `[4,3]`).

### Added — open scalar root-finders: `newton`, `secant`, `halley` (Phase 1 Task 2)

Only bracketing root-finding (`findRoot`, bisection/Brent) existed; added three classic open
(non-bracketing) scalar root-finders that iterate from a starting point instead of requiring a
sign-changing bracket: `newton(f, x0[, opts])` (Newton–Raphson, `x_{k+1} = x_k − f(x_k)/f'(x_k)`,
with an optional analytic `fprime` else a central-difference estimate), `secant(f, x0, x1[, opts])`
(no derivative required), and `halley(f, x0[, opts])` (`x_{k+1} = x_k − 2 f f' / (2 f'^2 − f f'')`,
cubic convergence, optional analytic `fprime`/`fprime2` else central differences). All default to
`tol = 1e-12`, `maxIter = 100`, and throw a clear `Error` on non-convergence or a (near-)zero
denominator/derivative. Pinned against √2, cbrt(2), and the cos(x)=x fixed point.

### Added — numeric Jacobian: `numericJacobian(f, x0)` + polymorphic `jacobian` (Phase 1 Task 1)

`jacobian` was symbolic-only (`jacobian(exprs, vars, scope)`) and threw `exprs.map is not a
function` when passed a numeric function. Added `numericJacobian(f, x0[, opts])` —
central-difference Jacobian of `f: ℝⁿ → ℝᵐ` (non-square OK; per-coordinate relative step
`h = max(1, |x0[j]|) * cbrt(2.22e-16)`) — and made `jacobian` polymorphic: when the first
argument is a function it dispatches to `numericJacobian`, leaving the symbolic
`jacobian(exprs, vars, scope)` path unchanged. Pinned against analytic Jacobians (square and
non-square). Foundation for numeric root-finding (`fsolve`, Phase 1 Task 3).

### Changed — corrected `betainc` documented argument order; annotated pass-through CAS/algebra transforms (docs honesty)

`betainc`'s implementation was always correct (`betainc(a, b, x)` = regularized incomplete beta
`I_x(a,b)`, scipy order; verified vs mpmath: `betainc(2,3,0.5)=0.6875`, `betainc(2,3,0.7)=0.9163`,
`betainc(1,1,0.3)=0.3`) but `docs/reference/functions.md` documented the signature as
`betainc(x, a, b)` — the wrong order. Corrected the doc and pinned the real order with a regression
test (`functions/tests/betainc-order.test.ts`).

Separately, probing the CAS/algebra transform functions on the built `dist/` found that
`factor`/`expand`/`apart`/`together` (and their CAS-layer counterparts `casFactor`/`casExpand`) are
currently **pass-through** — they return their input expression unchanged — despite being
documented with false worked examples (e.g. `factor('x^2 - 1') // '(x - 1)(x + 1)'`, which does not
happen). Annotated all six as `⚠️ pass-through (not yet implemented; planned)` in the Algebra/CAS
tables, replaced the false worked examples with their actual output, and softened overclaiming prose
(`factor` "works over the rationals", `apart`/`together` "are inverses"). Added a characterization
test (`functions/tests/cas-passthrough-documented.test.ts`) pinning current pass-through behavior so
a future Phase 8 implementation trips these tests and the docs get updated alongside the fix. No
implementation code changed — `betainc` needed no fix, and the transform functions are intentionally
out of scope here (full symbolic transforms are planned for Phase 8).

### Fixed — `linprog` could return an INFEASIBLE optimum on degenerate cases

The simplex iteration solved correctly, but the solution-extraction loop marked a structural
column "basic" whenever its tableau column had unit-vector shape, without enforcing a one-to-one
mapping between constraint rows and basic variables. On a degenerate optimum
(`linprog([-1,-1], [[1,1]], [1])` — minimize `-x-y` s.t. `x+y<=1`) both `x1`'s and `x2`'s columns
reduced to the unit vector on row 0, so both were marked basic and both read row 0's RHS (`1`),
returning `[1,1]` — which violates `x+y<=1` (scipy returns `[1,0]`, objective `-1`). Extraction now
tracks claimed constraint rows (excluding the objective row) and assigns each row to exactly one
basic variable, so the returned optimum is feasible; pinned vs scipy on the degenerate case above
plus a non-degenerate case (unchanged) and a second degenerate/redundant-constraint case. Equality
constraints, bounds, and status flags remain out of scope — planned for a later two-phase-simplex
rewrite.

### Fixed — `taylor`/`series`/`seriesCoefficient` produced garbage coefficients past ~order 3

All three computed the k-th derivative via a recursive finite-difference `numericalDerivative`,
whose error explodes with order — `taylor('sin(x)','x',0,7)`'s `x^7` coefficient came out as
`17209` instead of `-1/5040` (off by ~10⁷×), corrupting every term past cubic. Replaced with exact
Cauchy-integral coefficient extraction on a complex contour (`taylorCoefficients`, new private
helper in `functions/src/typed/cas.ts`), reusing the expression evaluator's existing complex
support (sin/cos/exp/log/sqrt/pow already have complex overloads) — machine-precise vs known
Maclaurin series (sin/cos/exp verified to 1e-9 at multiple points). `casDerivative` (the in-package
symbolic differentiator) was ruled out as the fix vehicle — it breaks on iteration past order 2 —
and no dependency on `@danielsimonjr/mathts-autograd` was added. `series` is unaffected code-wise
(it already delegated to `taylor`) and inherits the fix; `multivariateTaylor` is out of scope and
unchanged.

### Fixed — `summation`/`symbolicProduct` silently returned `0`/`1` on symbolic bounds

Both are finite counting loops (`for (let k=a; k<=b; k++)`); a non-numeric bound (e.g. `'n'`)
makes the loop condition (`k <= 'n'`) false immediately, so they silently returned the initial
accumulator — `summation('k', 'k', 1, 'n')` returned `0`, and the analogous call to
`symbolicProduct` returned `1` — instead of a wrong-answer error. Both now throw a clear error
when either bound is not a finite number. The `summation` doc comment no longer claims a
symbolic/closed-form (Faulhaber) fallback that never existed; closed-form summation is planned
for a later phase.

### Fixed — `stiffODESolver` diverged on stiff systems (fixed-point implicit Euler)

`stiffODESolver` was fixed-step implicit Euler solved by fixed-point iteration, which cannot
converge when `h·|∂f/∂y|` is large — exactly the stiff regime it targets: 71% error on
`y'=-15y` (`5.23e-7` vs the exact `e⁻¹⁵=3.06e-7`), and `null` on the stiff (`-1000`) mode of
`diag(-1,-1000)`. It now delegates to the proven L-stable Rosenbrock (ode23s) engine, which was
extracted from `createSolveODE`'s factory closure to a shared module-level `rosenbrockSolve`
(`functions/src/numeric/solveODE.ts`) so both `solveODE(..., {method:'Rosenbrock'})` and
`stiffODESolver` run the same one engine. Pinned: `y'=-15y → e⁻¹⁵`; `diag(-1,-1000)` fast mode
decays to `e⁻¹` with the stiff mode finite and ≈0.

### Fixed — `windowFunction` silently returned a rectangular window for unknown types

`windowFunction(n, type)`'s `switch` `default` case was shared with `'rectangular'`/`'rect'` and
filled the window with ones, so every unimplemented window type (`kaiser`/`tukey`/`gaussian`/
`blackmanharris`/…) silently returned a rectangular window instead of an error. `rectangular`/
`rect` now have their own explicit case; `default` throws `windowFunction: unknown window type
'<type>'`. Implementing the missing window types is a later phase.

### Fixed — `lambertW`'s documented `branch` argument was unimplemented

The docs promised `lambertW(x[, branch])` (`branch = 0` for the principal branch, `branch = -1`
for the lower real branch), but the implementation only accepted a single `number` — calling
`lambertW(-0.3, -1)` threw `Too many arguments in function lambertW (expected: 1, actual: 2)`.
Added `lambertWm1Scalar`, the lower branch W₋₁ (Halley's iteration seeded from the asymptotic
`ln(-x) - ln(-ln(-x))`, `x ∈ [-1/e, 0)`, `NaN` outside), and a `(number, number)` dispatch
signature. Principal branch unchanged. Pinned to mpmath: `W₋₁(-0.3) = -1.781337023421628`.

### Fixed — `invmod` threw on every call (`_BigNumber` invoked without `new`)

`invmod` threw `_BigNumber cannot be invoked without 'new'` on every call (class constructor
invoked without `new`); now uses numeric literals, restoring modular inverse for number and
BigNumber inputs (pinned by `invmod(3,11)=4`, `invmod(15151,15122)=10429`).

### Added — stiff ODE solver `solveODE(..., { method: 'Rosenbrock' })` (functionality)

`solveODE` had only explicit methods (RK23/RK45), which stall or blow up on stiff systems (chemical
kinetics, circuits, control — core engineering modeling). Added the linearly-implicit **ode23s**
Rosenbrock method (Shampine & Reichelt): 2nd-order, L-stable, adaptive (FD Jacobian + one LU solve of
`I−h·γ·J` per step). Verified vs a linear stiff system's exact solution and vs `scipy` BDF on stiff
Van der Pol (μ=1000). Plain-number state; RK45 stays the default for non-stiff problems.

### Fixed — `solveODE` was fully broken on its JS path; add initial-step selection (functionality)

`solveODE`'s JavaScript reference path threw `multiply(Array, Array) requires two 2-D matrices` on
every call — the RK stage combination used mathjs `multiply(h, a[i], k)` (vector·matrix semantics
MathTS's typed `multiply` rejects). It only stayed green because CI loads a WASM kernel; scalar ODEs
and WASM-less consumers always hit the broken path. Stages are now combined term-by-term via
scalar-broadcasting `multiply`/`add` (`stageCombo`), so scalar and vector systems both work (verified
vs closed forms: `y'=-y→e⁻¹`, logistic, harmonic oscillator, backward integration; RK23 + RK45). Also
added a Hairer initial-step heuristic (`h₀≈0.01·‖y0‖/‖f‖`) replacing the whole-interval first step,
which had let RK23 silently accept `1/3` instead of `e⁻¹` on `y'=-y`.

### Fixed — `zeta` negative arguments (~1.5e-7 → 1.9e-14) and `besselK` transition band

A fresh mpmath/SciPy sweep of the whole special-function + distribution surface found it
overwhelmingly machine-precision already (gamma/erf/digamma/elliptic/besselJ·I and every distribution
CDF/quantile, even deep in the tails — `normalCDF(-10)=7.6e-24` correct to 14 digits). Two fixes:
`zeta` at negative real `s` now reflects via the functional equation (the direct Borwein series
cancels for `Re(s)<0`), fixing `zeta(-3)` from 1.5e-7 off to ~1.9e-14; and `besselK`'s series→asymptotic
crossover moved to x=8, capping the transition-band peak from ~5.3e-9 to ~1.6e-9.

### Fixed — `variance` / `std` were ~10⁶× less accurate than NumPy on large-mean data

Continuing the audit: `variance`/`std` lost ~7 digits when the mean is large. Variance of
1e9-pedestal samples came out **relErr ~1e-7** where `np.var` is ~1e-13 and the exact value is
representable — the small deviations sit on a huge pedestal, so mean error rides into every squared
term. The public typed path used **Welford** (`m2OfArray`), the parallel path a **naive mean +
uncorrected two-pass**, and the factory/`std` paths naive **WASM** kernels.

New `sumSquaredDeviations` core primitive — the **corrected two-pass** `Σd² − (Σd)²/n` (pairwise
mean; the correction cancels the residual mean-bias exactly) — now backs every path (typed,
`ComputePool.variance`, factory, `std = √variance`); the naive WASM `statsVariance`/`statsStd` fast
paths are retired (also not faster — memory-bound). Now **machine-precision (relErr ~0), beating
NumPy**; verified against exact rationals and live NumPy. `std`/`zscore`/`corr` and every
variance-derived statistic inherit the fix.

### Fixed — `corr` returned |correlation| > 1, and a class of BigNumber correctness bugs

Continuing the NumPy/SciPy accuracy audit, `corr` was found returning **52** (mathematically
impossible) for a true correlation of **−1** on large-mean data. It used the one-pass computational
formula `n·ΣXY − ΣX·ΣY`, which catastrophically cancels — two ~1e28 quantities subtracted. Rewritten
to the stable **two-pass** form; now matches `np.corrcoef`. Pinned by the implementation-independent
invariant `|corr| ≤ 1`.

Chasing a reported `cumsum(BigNumber[])` crash uncovered a systematic incompatibility: the
mathjs-lineage factory layer assumed a **decimal.js BigNumber API** (`plus`/`minus`/`lte`/`gte`/
`eq`/`cmp`) that MathTS core's BigNumber does not implement (it uses `add`/`sub`/`lessThanOrEqual`/
`equals`/`compareTo`). Two root causes fixed:

- **Core** — BigNumber comparison methods (`equals`/`lessThan`/`lessThanOrEqual`/`greaterThan`/
  `greaterThanOrEqual`/`compareTo`) now **coerce a number/string argument** like `add`/`gt` do.
  Before, `bignumber(8).lessThanOrEqual(3)` returned `true`.
- **functions** — method-name fixes across `addScalar`, `subtractScalar`, `nearlyEqual`, `compare`,
  `smaller`/`smallerEq`/`largerEq`/`equalScalar`, `cumsum`, `quantileSeq`, `factorial`, `gamma`, and
  `isPrime` (whose Miller-Rabin path, and `gamma`'s factorial, also dropped an unnecessary decimal.js
  precision-clone — core is bigint-backed and exact). Plus a non-idempotent `bignumber()` conversion:
  `bignumber(aBigNumber)` returned `Infinity`. This restores `sort`/`median`/`min`/`max`/`cumsum`/
  `corr`/`quantileSeq`/`factorial`/`gamma`/`isPrime` on BigNumber inputs — all previously crashed or
  silently mis-ordered.

These BigNumber paths were previously **untested**, which is why they stayed broken under a green
suite; regression coverage added (`core/tests/bignumber-comparison-coercion.test.ts`,
`functions/tests/bignumber-operations.test.ts`). Verified against live NumPy 2.3.4; full functions
suite and core suite green.

### Added / Fixed — stable `dot`, `distance`, `cumsum` (NumPy/SciPy audit follow-up)

Continuation of the reduction-accuracy work below. Three new stable primitives in
`@danielsimonjr/mathts-core` (`core/src/numeric/stable.ts`), wired into every public path:

- **`dot`** summed naively (`s += aᵢ·bᵢ`) — measured ~18× worse than `np.dot` on an
  ill-conditioned dot (n = 10⁶, relErr 6.6e-15 vs 3.7e-16). New `pairwiseDot` closes it to NumPy
  parity for the same flop count; fixed on both the `number[]` and `Float64Array` paths.
- **`distance`** was `sqrt(Σ(aᵢ−bᵢ)²)` — the same square-before-sum bug as `norm`: `Infinity` for
  large inputs and a **silent `0`** for tiny ones. New `scaledDistance` (BLAS `dnrm2` over the
  difference) gives `2e200` / `2e-200` exactly where naive squaring — and NumPy's `linalg.norm` —
  give `inf` / `0`.
- **`cumsum`** accumulated naively like `np.cumsum` (relErr ~1.3e-11 over 10⁶ terms). A prefix scan
  is sequential so pairwise doesn't apply; new `neumaierCumsum` carries a running compensation for
  exact prefixes — a strict improvement over NumPy for a few extra flops per element.

Fixed on **every reachable layer**, not just the typed one. The public `distance`/`cumsum` a caller
imports resolve to the mathjs *factory* implementations (`geometry/distance.ts`,
`statistics/cumsum.ts`) — separate naive paths from the typed `parallelStat*` ones (the same
"wrong-layer" trap that first bit `sum`). A behavior probe against the built package confirmed the
gap (`distance([1e200]×4) → Infinity`, `cumsum` relErr `1.3e-11`) and the fix
(`2e200`, relErr `0`); both factory paths now route flat plain-number inputs through the stable
primitives, retiring two naive WASM scans that shared the overflow bug. `BigNumber`/`Complex`/
multi-dim paths are unchanged.

All three verified against live NumPy 2.3.4 / SciPy 1.17.1; pinned in `core/tests/stable.test.ts`
and `functions/tests/numeric-accuracy.test.ts` (typed and public-factory paths).

### Fixed — `sum` / `mean` were ~46,000× less accurate than NumPy

`sum` accumulated naively (`s += x`), so the running total grew large while the addends stayed
small and each addition rounded off a little more of it: error grows as **O(n)·ε**. NumPy uses
pairwise summation — error **O(log n)·ε**. Measured on 1e6 copies of `0.1` (exact answer 100000):

| accumulation | relative error |
| ------------ | -------------- |
| naive (what shipped) | **1.3e-11** |
| **pairwise (now)** | **2.9e-16** — identical to `np.sum` |
| `fsum` (new) | **0** — exact |

`mean`, `std` and `variance` all inherit `sum`'s error, so this was the largest accuracy defect in
the library. **Pairwise costs the same number of additions** — measured **1.03× faster** than the
naive loop (eight independent accumulators break the serial dependency chain). There was no
speed/accuracy trade to make; the naive version was simply worse.

Fixed on every path a caller can reach: `sum`/`mean` (`Array` and `Float64Array`),
`ComputePool.sum`, and the factory `sum`.

### Fixed — `norm(x, 2)` overflowed and underflowed (NumPy still does)

`sqrt(Σxᵢ²)` squares before it adds, so it dies well inside the representable range. Now uses
LAPACK's `dnrm2` scaling:

```ts
norm([1e200, 1e200, 1e200, 1e200], 2);     // 2e200    (np.linalg.norm: inf + overflow warning)
norm([1e-200, 1e-200, 1e-200, 1e-200], 2); // 2e-200   (naive squaring: 0)
```

The **underflow** case was the dangerous one: it returned a plausible `0` rather than an obvious
`inf`.

### Added — `fsum(x)`, exactly-rounded summation (`math.fsum` equivalent)

Pairwise summation is accurate to ~machine epsilon and free, but it cannot recover a value that
catastrophic cancellation has already destroyed:

```ts
sum([1e16, 1, -1e16]);  // 0   (np.sum gives 0.0 too)
fsum([1e16, 1, -1e16]); // 1   (exact; math.fsum gives 1.0)
```

Neumaier compensation, ~2–4× slower, so opt-in. For conservation checks, residuals, and
long-running accumulators.

### Added — stable numeric primitives in `@danielsimonjr/mathts-core`

`pairwiseSum`, `neumaierSum`, `norm2` are exported directly. `@danielsimonjr/mathts-parallel` now
depends on `core` for them (0 new cycles) and uses them in `ComputePool`'s sequential reductions.

### Added — GPU FFT (Stockham autosort, f32); `parallelFFT` routes to it

Radix-2 **Stockham autosort**: *self-sorting*, so each pass scatters into a second buffer and the
output arrives in natural order with **no bit-reversal pass** (a pure memory shuffle is the one
thing a GPU is worst at). All log₂(n) passes ride in one encoder and one submit.

Measured against `fftCoreFloat64` — the flat f64 core `parallelFFT` runs on this thread — warm JIT,
Chrome / NVIDIA Pascal. Regenerate with `functions/tests/gpu-fft-bench.browser.test.ts`:

| n         | CPU f64  | GPU f32  | speedup   |
| --------- | -------- | -------- | --------- |
| 65,536    | 16.8 ms  | 14.4 ms  | 1.17×     |
| 262,144   | 53.4 ms  | 24.0 ms  | **2.23×** |
| 524,288   | 87.8 ms  | 30.5 ms  | **2.88×** |
| 1,048,576 | 253.1 ms | 79.7 ms  | **3.18×** |
| 2,097,152 | 399.9 ms | 116.3 ms | **3.44×** |

**~2.2–3.4× above the threshold.** The ratio is genuinely noisy run to run, so there is no single
hero number to quote. f32 error is ~4e-7 peak-relative even across 20 stages — error growth per
stage was the risk that could have killed this kernel, and Stockham turned out to be well-behaved.

**The FFT's threshold is 262,144, deliberately higher than `GPU_MIN_ELEMENTS` (65,536).** At 65,536
the GPU wins by only 1.17×: inside the noise, and nowhere near enough to trade f64 for f32. An FFT
makes log₂(n) passes over the data, so it amortises the upload more slowly than the memory-bound
element-wise chain does. Sharing one threshold would have been convenient and wrong.

`parallelFFT` / `parallelIFFT` use it when `enableGpu()` is on; with the flag off (the default) they
are bit-identical f64 — pinned by a test asserting the GPU-on result is f32-accurate **but not
f64-exact** (which is what proves the tier actually ran) while the GPU-off result is exact.

### Fixed — `parallelFFT` ignored its own benchmark-tuned threshold

`computePool.shouldParallelize(paddedLength)` was called **without the op name**, so
`DEFAULT_THRESHOLD_BY_OP`'s tuned `parallelFFT: 'never'` was never consulted and the global 50,000
threshold applied instead. Every transform above 50k silently took the four-step worker path — which
does not pay: **n=2¹⁸, 156 ms via workers vs 77 ms on this thread** (2× slower) in Chrome, and a wash
in Node. The tuned decision was right and simply never read.

This also means the first version of the GPU table in this entry was measured against a CPU path
`parallelFFT` never takes. Both are fixed.

### Changed — `serializeGpu` moved into `@danielsimonjr/mathts-gpu` (one shared queue)

The WebGPU error scope is a **per-device LIFO stack**: two dispatches in flight pop each other's
scope, and a real validation error then goes unobserved — returning a zero-filled buffer as a
plausible result (for an FFT, a silently empty spectrum). The queue belongs in the shared foundation,
not in one domain module: a per-module queue would not stop an element-wise dispatch racing an FFT
dispatch, and `Promise.all([fuseUnaryChainAsync(a), parallelFFT(b)])` is ordinary code. The cheap
gates run *outside* the queue, so a CPU-only `parallelFFT` never waits behind GPU work.

## [autograd 0.1.0] - 2026-05-15

> First release of the `@danielsimonjr/mathts-autograd` package — forward
> and reverse-mode automatic differentiation on rank-N Tensors. Built as
> the AD adapter for the UPT v0.4.0 connection-layer + AD backend. Repo
> tag: `mathts-autograd-v0.1.0`. Not yet published to npm (publish
> requires 2FA — deferred to a manual `npm publish`).

### Added

- `@danielsimonjr/mathts-autograd` package scaffold: forward + reverse-mode AD (Tasks 6/7 populate the implementation).
- `forwardGrad` + `DualTensor` in `@danielsimonjr/mathts-autograd`: dual-number forward-mode AD on rank-N Tensors, full Jacobian assembly (shape `[...y.shape, ...x.shape]`, row-major).
- `reverseGrad` + `Tape` + `TapedTensor` in `@danielsimonjr/mathts-autograd`: tape-based reverse-mode AD; `reverseGrad(fn, x, cotangent?)` returns `{ value, gradient }` with `gradient.shape = x.shape`.

## [tensor 0.1.0] - 2026-05-14

> First release of the `@danielsimonjr/mathts-tensor` package — a rank-N,
> `Float64Array`-backed dense tensor type with einsum/contraction. Built as
> the second `TensorEngine` implementation for the UPT v0.3.5
> numerical-contraction backend. Repo tag: `mathts-tensor-v0.1.0`.
> Not yet published to npm (publish requires 2FA — deferred to a manual
> `npm publish` / `changeset publish`).

### Added

- `@danielsimonjr/mathts-tensor` package: rank-N `Tensor` (storage, construction, elementwise, identity, normInf).
- `Tensor` einsum / matMul / transpose / reshape.

## [Security Release 2026-05-01] — expression@0.2.0, parallel@0.1.3, functions@0.1.3, wasm@0.1.3

> Repo-level tag: `security-2026-05-01` (HEAD `3ef899c`).
> Per-package tags follow the existing `@danielsimonjr/mathts-<pkg>@<version>` convention.
> Driving commits: `6e76d62` (expression sandbox — BREAKING),
> `862ae30` (parallel timeout — additive), `3ef899c` (WASM SHA-384 — additive).

### Security

- **functions, assembly**: WASM modules now verify a SHA-384 manifest
  before instantiation. The build step writes `wasm-manifest.json`
  beside the `.wasm` artefact (see `tools/generate-wasm-manifest.mjs`),
  and at load time the runtime hashes the freshly read buffer
  (`crypto.createHash('sha384')` in Node, `crypto.subtle.digest` in
  browsers) and compares against the manifest. A mismatch throws
  before any module is compiled or instantiated, blocking silent
  code-injection via tampered .wasm payloads. Affected files:
  - `functions/src/wasm/integrity.ts` (new helper module)
  - `functions/src/wasm/WasmLoader.ts:744,748,773,795,799` — both Node
    and browser load paths now verify; streaming compilation is bypassed
    when a manifest is present
  - `assembly/src/bindings/wasm-loader.ts:75,87,89` — `loadWasm()`
    verifies before compile in both fetch and `fs.readFileSync` paths
  - `tools/generate-wasm-manifest.mjs` (new build-time hashing script)
  - `functions/tests/security/wasm-integrity.test.ts` (5 tests)
    covering manifest load, untampered accept, tampered reject,
    soft-warn on missing manifest, and `{required: true}` fail-closed
- **parallel**: `WorkerPool.execute()` now accepts an optional
  `timeoutMs` argument (`parallel/src/WorkerPool.ts`). When the worker
  does not reply within `timeoutMs` the pool calls `worker.terminate()`,
  evicts the dead worker from its rosters, spawns a replacement so the
  pool's capacity is preserved, and rejects the returned promise with a
  `"Worker task timed out after Nms"` error. Pass `0` or omit the
  argument to keep the legacy untimed behaviour. Closes a DoS vector
  where a hung worker (e.g. infinite loop in user-supplied math code)
  would block the queue indefinitely. Adds
  `parallel/tests/WorkerPool.timeout.test.ts` (2 tests) covering
  timeout rejection and pool replacement.
- **expression**: Restored sandbox in the tree-walking compiler
  (`expression/src/compiler/compile.ts`). All five bypass sites now route
  through the existing `getSafeProperty` / `setSafeProperty` /
  `getSafeMethod` helpers in `expression/src/utils/customs.ts`:
  - `compileAccessorNode` — both property-name and computed-index forms
  - `compileAssignmentNode` — `obj.prop = …` lvalue writes
  - `compileObjectNode` — object-literal key assignment
  - `compileSymbolNode` / `compileFunctionNode` — math-namespace lookups
    use `Object.prototype.hasOwnProperty.call(math, name)` to skip
    prototype-chain names; method calls of shape `obj.method(…)` route
    through `getSafeMethod`.
- **expression**: Added pre-compile AST validator in
  `expression/src/evaluator/evaluate.ts`. By default `evaluate()` and
  `compileExpression()` reject `AssignmentNode`, `FunctionAssignmentNode`,
  and `FunctionNode` calls to forbidden builtins (`import`, `createUnit`,
  `evaluate`, `parse`, `compile`, `simplify`, `derivative`, `help`,
  `chain`). Hosts that need the legacy permissive behaviour can opt out
  with `{ unsafe: true }`. Blocklist mirrors `math-mcp/src/validation.ts`.
- **expression**: Added regression suite at
  `expression/tests/security/sandbox.test.ts` (13 tests) covering
  RCE chains (`arr.constructor.constructor("…")()`), prototype pollution
  (`__proto__` writes via assignment and ObjectNode literal), forbidden
  function calls, FunctionAssignmentNode rejection, and confirms safe
  paths still work (`2 + 3`, `arr.length`, etc.).

## [0.1.2] - 2026-04-05

First public release of all 10 @danielsimonjr/mathts-* packages to npm.

### Added

#### Matrix Operations (9 — completing all deferred matrix ops)
- characteristicPolynomial (Faddeev-LeVerrier), rowReduce (Gauss-Jordan RREF), matrixRank (via RREF)
- cholesky (L*L^T decomposition), hessenbergForm (Householder reduction)
- matrixPower (binary exponentiation + eigendecomposition for fractional)
- matrixLog (inverse scaling-and-squaring + Taylor series)
- polarDecomposition (via SVD: A = U*P), jordanForm (eigenvalue clustering + null space analysis)

#### Rust WASM Optimization — 72 high+medium-value functions accelerated
- Special functions (10 Rust): besselI/J/K/Y general order, betainc, ellipticE/K, lambertW, fresnelC/S + TS WASM dispatch
- Signal processing (9 Rust): dct/idct, dst/idst, dwt (Haar), hilbertTransform, spectrogram (STFT), periodogram (Welch), FIR filter + TS dispatch
- Numerical methods (12 Rust): minimize_quadratic, least_squares, levenberg_marquardt, condition_number, matrix_rank, bezier/bspline/loess/griddata/rbf interpolation, implicit_euler/rk4 ODE steps + TS dispatch
- Geometry (4 Rust): delaunayTriangulation (Bowyer-Watson), voronoiDiagram, kdTree build+nearest + TS dispatch with threshold=32
- SIMD array arithmetic (29 Rust): simd_add/sub/mul/div/abs/sqrt/exp/log/sin/cos arrays, sum/mean/min/max/variance/std/dot/norm/distance stats, polygon_area/manhattan/chebyshev/minkowski distances, trig arrays
- Interpolation + distributions (11 Rust): linear/cubic_spline/pchip/lagrange/poly_fit interpolation, normal_pdf/cdf, binomial/poisson/gamma PMFs

#### 190 New Functions — mathjs v15.4–15.6 Parity (Item 1 complete)
- Algebra (36): polyval, polyadd, polymul, polyder, polynomialGCD/LCM/Quotient/Remainder, degree, discriminant, differences, expand, factor, collect, substitute, variables, cancel, together, apart, trigExpand/Reduce, trigToExp, expToTrig, tangentLine, resultant, + 12 more
- Symbolic CAS (28): integrate, limit, taylor, solve, laplace/inverseLaplace, fourierSeries, zTransform, gradientSymbolic, jacobian, laplacian, divergence, curl, groebnerBasis, piecewise, odeGeneral, + 13 more
- Graph Theory (8): adjacencyMatrix, shortestPath, minimumSpanningTree, connectedComponents, stronglyConnectedComponents, topologicalSort, isConnected, graphDistance
- Number Theory (15): prime, nextPrime, primePi, primeFactors, divisors, eulerPhi, divisorSigma, carmichaelLambda, moebiusMu, jacobiSymbol, chineseRemainder, lucasL, partitions, harmonicNumber, integerDigits
- Distribution Objects (12): normalDist, betaDist, binomialDist, chiSquaredDist, exponentialDist, fDist, gammaDist, logNormalDist, poissonDist, tDist, uniformDist, weibullDist — each with .pdf/.cdf/.quantile/.mean/.variance/.sample
- Statistical Tests (7): studentTTest, chiSquareTest, anova, kolmogorovSmirnovTest, mannWhitneyTest, shapiroWilkTest, principalComponentAnalysis
- Numerical Methods (34): findRoot, minimize/maximize, linsolve, leastSquares, nintegrate, curvefit, expfit/logfit/powerfit, bezierCurve, bspline, loess, solveODESystem, stiffODESolver, solveBVP, cond, rank, + 18 more
- Signal Processing (19): dct/idct, dst/idst, dwt, fft2d, fourier/invFourier, hilbertTransform, spectrogram, periodogram, lowpass/highpass/bandpassFilter, resample, medfilt, windowFunction, convolve, correlate
- Extended Geometry (11): area, centroid, coordinateTransform, polygonPerimeter, manhattanDistance, chebyshevDistance, minkowskiDistance, delaunayTriangulation, voronoiDiagram, kdTree, nearestNeighbor
- Extended Special (20): besselI/J/K/Y (general order), betainc, gammaincp, ellipticE/K, chebyshevT, hermiteH, laguerreL, legendreP, lambertW, erfi, cosIntegral, sinIntegral, logIntegral, expIntegralEi, fresnelC/S
- 557 new tests, 36+ embedded doc files

#### Rust WASM Migration
- 192 AS-compatible wrapper functions added to Rust WASM crate (`wasm-rust/crates/mathts-wasm/src/compat/`):
  - `scalar.rs`: 42 scalar ops (add_f64, sin_f64, sqrt_f64, etc.)
  - `array.rs`: 36 array ops (array_add, array_dot, array_norm, etc.)
  - `complex.rs`: 75 complex ops (complex_add, complex_sin, complex_array_fft, etc.)
  - `matrix.rs`: 39 matrix ops (matrix_multiply, matrix_transpose, matrix_trace, etc.)
- Rust WASM binary now exports 1,017 functions (was 741) — full AS parity
- BackendManager already prefers Rust WASM for heavy ops (FFT, eig, SVD)
- Build script: `wasm-rust/scripts/build-for-mathts.sh`
- WASM backend comparison benchmark (`tests/benchmark/wasm-comparison.test.ts`)

#### New Math Functions (60 — beyond mathjs)
- Special functions (8): erfc, beta, gammainc (incomplete gamma), digamma, besselJ0, besselJ1, besselY0, besselY1
- Probability distributions (10): normalPDF, normalCDF, exponentialPDF, exponentialCDF, poissonPMF, binomialPMF, geometricPMF, bernoulliPMF, entropy, jsDivergence
- Numerical integration (4): trapz, simpson, gaussQuad (Gauss-Legendre), romberg (adaptive)
- Interpolation (6): linearInterp, lagrangeInterp, cubicSpline, hermiteInterp, pchipInterp, polyFit
- Extended combinatorics (6): fibonacci (fast doubling), lucas, doubleFactorial, risingFactorial, fallingFactorial, subfactorial
- Geometry (18): angle2D/3D, cross3D, dot3D, triangleArea, polygonArea, convexHull (Andrew's monotone chain), pointInPolygon (ray casting), rotateVector2D/3D (Rodrigues), reflectVector, projectVector, distance2D/3D/ND, distancePointToLine2D, intersectLines2D, intersectSegments2D
- Signal processing (4): crossCorrelation, autoCorrelation, groupDelay, unwrapPhase
- Statistics selection (4): quickSelect (Hoare's O(n)), medianSelect, minSelect, maxSelect
- 56 embedded doc files for all new functions
- 260 new tests covering all functions against known reference values

#### Core Types & Type System
- 22 math methods on BigNumber: trig (sin, cos, tan, asin, acos, atan), hyperbolic (sinh, cosh, tanh, asinh, acosh, atanh), transcendental (exp, ln, log10, log2, cbrt, expm1), other (mod, log1p, atan2, hypot) — all pure BigNumber arithmetic with Taylor series
- Instance `compare()` method on BigNumber and Fraction (delegates to `compareTo()`)
- Type compatibility bridge (`registerNativeTypes()`) — adds `isComplex`, `isFraction`, `isBigNumber` duck-typing markers to native type prototypes
- Typed-function bridge (`initTypeBridge()`) enabling synced mathjs factories to recognize native MathTS types
- 6 inverse trig methods on AssemblyScript Complex class (asin, acos, atan, asinh, acosh, atanh)

#### Factory Activation System
- Factory activation infrastructure: shared scope (`functions/src/factories/scope.ts`), barrel export (`functions/src/factories/index.ts`)
- 242/273 mathjs factories activated across 18 tiers (89%):
  - Tier 1 (69): leaf factories — abs, sin, cos, sqrt, erf, combinations, etc.
  - Tier 2 (13): inter-factory deps — divideScalar, dot, mode, isZero, bin/hex/oct, etc.
  - Tier 3 (14): matrix factories — transpose, identity, zeros, ones, diag, det, trace, kron, etc.
  - Tiers 4-9 (73): equal, compare, larger, smaller, gcd, lcm, mod, pow, ceil, floor, inv, pinv, qr, concat, subset, range, sort, factorial, gamma, permutations, bellNumbers, stirlingS2
  - Tiers 10-18 (67): subtract, divide, simplify, derivative, rationalize, eigs, fft/ifft, mean/median/variance/std, all set operations, solveODE, Chain/Unit, sqrtm, norm, cross, diff
- Remaining 31 factories are infrastructure types already provided by @danielsimonjr/mathts-core
- Expression node constructors (all 16 types) injected into factory scope for full AST support
- Index and Range stub types registered in typed-function for subset/range factory activation

#### Matrix & WASM
- Matrix compatibility bridge (`MathJSDenseMatrix`) — adapts native DenseMatrix to mathjs `._data`/`._size`/`.storage()` interface
- Real SparseMatrix bridge with CSC (Compressed Sparse Column) storage — `_values`, `_index`, `_ptr` with get/set, map, forEach, resize, diagonal, row swap
- WASM-accelerated FFT (`matrix/src/backends/wasm/fft-wasm.ts`) — Cooley-Tukey radix-2 with Rust WASM acceleration path, JS fallback, spectral analysis utilities
- WASM-accelerated eigendecomposition (`matrix/src/operations/eig-wasm.ts`) — Rust WASM Jacobi for symmetric matrices, JS QR fallback
- WASM-accelerated SVD (`matrix/src/operations/svd-wasm.ts`) — derives from eigendecomposition for symmetric matrices, Golub-Reinsch JS fallback
- Rust WASM backend integration: `RustWasmLoader` singleton with bump allocator, `RustWASMBackend` implementing MatrixBackend, BackendManager routing heavy ops (FFT, eig, SVD) to Rust WASM
- Parallel FFT (`parallel/src/operations/fft.ts`) — threshold-based parallel dispatch, auto-padding, parallel convolution
- Parallel eigendecomposition (`parallel/src/operations/eig.ts`) — inlined QR algorithm (avoids circular deps), ParallelResult wrapper

#### Expression & Evaluation
- Expression compiler (`expression/src/compiler/compile.ts`) — tree-walking AST interpreter handling all 16 node types
- Expression evaluator (`expression/src/evaluator/evaluate.ts`) — `createEvaluate()` factory for `evaluate(expr, scope)` API
- `evaluate()` function wired to activated factory scope — `evaluate('sin(pi/2)')` works end-to-end
- `parse()` bootstrapped from expression node factories through dependency-ordered scope injection
- `compileExpr()` for reusable compiled expressions
- Workbook `executeCode()` implementation using Function constructor with scope injection

#### typed-function & workerpool Improvements
- typed-function: Symbol-based type identification (`TYPED_FUNCTION_TYPE`) — survives esbuild/minification
- typed-function: Safe conversions (`createSafeConversion`) — prevents "cannot invoke without new" errors
- typed-function: Robust multi-strategy type tests (`createRobustTypeTest`) — symbol → property → prototype fallback
- workerpool: SharedArrayBuffer helpers and Transferable support for zero-copy transfer
- workerpool: Eager worker initialization (`warmup()`) with `pool.ready` promise
- workerpool: Enhanced metrics (`enhancedStats()` with p95, throughput, workerUtilization)

#### Build & Publishing
- npm publishing setup — all 10 packages have `publishConfig`, `files`, `repository`
- Production build optimization (`build:prod`) — minified + tree-shaken bundles, 57% size reduction (1524 KB → 662 KB)
- Package scope rename: `@mathts/*` → `@danielsimonjr/mathts-*` for npm publishing under personal scope
- Root `release` script via changesets

#### Testing & Documentation
- Performance regression test suite (`tests/benchmark/performance.test.ts`) — 23 benchmarks covering Complex, BigNumber, Fraction, DenseMatrix, typed dispatch, factory functions
- Parallel operation benchmarks (`parallel/tests/benchmark.test.ts`) — 18 tests covering elementwise, reduce, matmul
- `vitest.config.ts` added for functions, parallel, workbook, packages/typed-function, packages/workerpool
- `@types/node` added to all 7 workspace package devDependencies
- 5 synced mathjs files: constants.ts, factoriesAny.ts, factoriesNumber.ts, defaultInstance.ts, shared/types.ts
- Codebase inventory tooling (tools/codebase-inventory.json, tools/build-mathts-inventory.py, tools/scan_missing.py, tools/inventory.py)
- Full codebase inventory reports (docs/inventory/00-05)
- Integration plan and priority status tracker
- Architecture docs updated (ARCHITECTURE.md, API.md, DATAFLOW.md, OVERVIEW.md)
- Per-package dependency graphs regenerated for all 9 packages (+ new: expression, assembly)
- User-facing documentation modeled after mathjs:
  - `docs/datatypes/` (7 files): numbers, complex, fractions, bignumbers, matrices, bigints
  - `docs/expressions/` (6 files): syntax, parsing, algebra, security, expression trees
  - `docs/core/` (4 files): configuration, extension, serialization
  - `docs/reference/` (4 files): classes, constants, functions
- README.md updated with v0.1.2 capabilities: evaluate(), 242 factories, dual WASM, bundle sizes

### Changed
- Synced mathjs factory code uses correct import paths (./function/ prefix stripped, depth-agnostic ../ reduction)
- functions/src/typed: renamed .neg() → .negate(), .reciprocal() → .inverse(), .div() → .divide() to match core type APIs
- factoriesAny.ts/factoriesNumber.ts: stripped 287 broken ./function/ import prefixes
- expression/ package: build enabled (was echo-skip), tsconfig added, shared utils copied, 60+ import paths fixed
- assembly/ WASM: prefixed 114 bare math calls with Math., fixed abort path, fixed complex_pow(→powReal)
- matrix/WASMBackend: fixed SIMD method names (addSIMD→simdAddF64, etc.)
- parallel/tsconfig: workerpool type stub replaces raw .ts source resolution
- matrix/tsconfig, compat/tsconfig: added workerpool path override

### Fixed
- besselI_wasm: sign correction `(-1)^n` for negative x with odd order n
- erfc Rust WASM: replaced `1-erf(x)` with direct Abramowitz & Stegun computation (catastrophic cancellation for large x)
- standardNormalCDF: divide x by √2 before erf (was computing Φ(x√2) instead of Φ(x))
- Delaunay in_circumcircle: orientation-independent determinant test (was assuming CCW winding, Edge::new destroys winding order)
- special.ts WASM dispatch: disabled getRustWasm() — was using `.exports` (doesn't exist on RustWasmLoader) and `require()` in ESM package
- next_power_of_2(0): guard against usize underflow in signal processing WASM
- exponential() Rust WASM: guard against lambda≤0 division by zero
- partialDerivative export collision: renamed algebra.ts version to symbolicPartialDerivative
- curvefit LM convergence: compute cost change before updating prevCost
- PCA explained variance: uses trace(cov) instead of sum of extracted eigenvalues when k < p
- factor/collect: normalize subtraction before splitting on +
- binomialDist PDF: handle degenerate p=0 and p=1 (was NaN from 0*log(0))
- adjacencyMatrix docstring: fixed example matrix
- BigNumber.exp() overflow: `2**k` → `BigNumber.fromNumber(2).pow(k)` for large inputs
- WASMBackend SIMD argument order: swapped resultPtr/length in 7 operations (add, subtract, mul, scale, abs, negate)
- WASMBackend divideElementwise: was calling multiply — now delegates to JS backend
- WASMBackend QR decomposition: was reading R from unwritten buffer — now reads from in-place aAlloc
- eig-wasm memory leak: added try/finally to free WASM allocations in eigWasm and spectralRadiusWasm
- parallelIFFT: removed wasteful forward FFT call, reports honest metadata
- SparseMatrix _swapRows: splice-insert at sorted position instead of overwriting index (maintains CSC invariant)
- factoryScope.add/multiply: upgraded from scalar stubs to full typed implementations after tier 12
- workerpool canUseSharedMemory(): added crossOriginIsolated check for browser environments
- workerpool _recordExecution(): single performance.now() snapshot prevents timestamp inconsistency
- typed-function dep in functions/package.json: npm registry → github fork
- turbo.json test tasks: `"dependsOn": ["build"]` → `["^build"]` for correct upstream ordering
- Package.json consistency: workbook directory path, assembly author/URL, compat author/URL/dev deps
- Tests using BigNumber private constructor → public fromNumber/parse
- Removed duplicate factoryScope injections (map, conj)
- All 10 packages now build (was 9/10 — assembly WASM was broken)
- All 14 typecheck tasks now pass (was 9/14 — parallel, matrix, compat, expression, functions failed)
- assembly/ WASM build: 64 errors → 0 (Math. prefix, abort path, missing Complex methods)
- parallel/ typecheck: workerpool raw .ts source resolution → type stub
- expression/ typecheck: removed unnecessary embeddedDocs exclusion
- functions/ typecheck: re-enabled (was echo-skip), fixed 35 type errors
- workbook executor: executeCode() implemented (was throwing "not yet implemented")
- ParallelMatrix test: added missing beforeAll/afterAll vitest imports

## [0.1.0] - 2026-02-06

### Added
- Initial project structure with monorepo setup (npm workspaces + Turborepo)
- @danielsimonjr/mathts-core: Complex, Fraction, BigNumber types, TypeRegistry, factory system
- @danielsimonjr/mathts-matrix: DenseMatrix, SparseMatrix, JS/WASM/GPU backends, BackendManager
- @danielsimonjr/mathts-functions: typed arithmetic, trigonometry, statistics, signal processing
- @danielsimonjr/mathts-parallel: ComputePool, WebWorker parallelization, threshold strategies
- @danielsimonjr/mathts-compat: mathjs-compatible `create(all)` API with 54 shim functions
- @danielsimonjr/mathts-workbook: .mtsw notebook runtime with dependency graph and reactive execution
- @danielsimonjr/mathts-wasm: AssemblyScript WASM operations (scalar, array, complex, matrix)
- @danielsimonjr/mathts-typed-function: forked type dispatch system
- @danielsimonjr/mathts-workerpool: forked worker pool management
- TypeScript configuration with project references and strict mode
- GitHub Actions CI/CD workflows
- Comprehensive test suite with 1,342 passing tests across 51 files
- Integration tests for cross-package operations
- API documentation for all packages (docs/api/)
- Migration guide from mathjs (docs/migration/)
- Example projects (examples/)
- Getting Started and Advanced Usage guides

[0.1.2]: https://github.com/danielsimonjr/mathts/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/danielsimonjr/mathts/releases/tag/v0.1.0
