# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed — dead `complexConj` export in `signal/fft.ts`

`complexConj` (`functions/src/signal/fft.ts`) was the sole "unreferenced anywhere" deletion candidate
in the dependency-graph unused-analysis: not re-exported from the package index (the public FFT
helpers come from `signal/fft-helpers.ts`), absent from the built `dist` and the curated
`functions.md`, and imported by no source file or test. Removed at root. Its siblings `complex`/
`complexAbs` are retained (still used). Verified: functions typecheck + signal suites green, eslint
clean; the graph's unreferenced-export deletion-candidate count drops to 0.

### Added — kill-able worker-thread run timeout (`runWorkbookWithTimeout`, `mtsw run --timeout`)

`WorkbookExecutor#runReport` had no time budget — a runaway cell (e.g. an unbounded numeric
computation) hung the process forever. `workbook/src/timeout-runner.ts` adds
`runWorkbookWithTimeout(source, { timeoutMs })`: it runs the whole executor (parse + `runReport`)
inside a `worker_threads` Worker (`workbook/src/run-worker.ts`, now a third tsup build entry
alongside `index.ts`/`cli.ts`) and forcibly `terminate()`s it if it exceeds the budget, rejecting
with a `WorkbookTimeoutError`. Termination kills the worker's V8 isolate outright, so it interrupts
even a synchronous, CPU-bound runaway cell — something a same-thread `Promise.race`/`setTimeout`
budget cannot do (a blocking loop never yields back to the event loop for the timer to fire). Cell
outputs cross the worker boundary pre-formatted to strings (via the existing `formatResult`) since
class instances (Complex, matrices, …) don't survive `postMessage`'s structured clone. Wired as
`mtsw run --timeout <ms>` (routes through the worker; incompatible with `-c`/`-v`); the default
in-process path is unchanged when no timeout is given. Verified in
`workbook/tests/gap-worker-timeout.test.ts` (imports the **built** `dist/` — the worker's
`new URL('./run-worker.js', import.meta.url)` only resolves off a real on-disk file, so this suite
can't run against `src/` like its siblings) with a genuinely long CPU-bound cell (`isPrime` trial
division to the largest prime below 2^53, chained ×10 — MathTS's expression sandbox has no loop or
recursion constructs, so this is the sanctioned "very long computation" fallback for an
un-expressible `while(true)`): confirms the run is killed within the budget (not merely outraced by
a fast finish), the error message names the budget, and a normal fast run through the worker path
matches the in-process `runReport` result.

### Added — `mtsw export --format ipynb` (Jupyter notebook export)

`workbook/src/ipynb.ts` adds `toIpynb(doc)`, a sibling of the existing `toHTML`/`toTeX`/`toPDF`
exporters: renders the same `RenderDoc`/`RenderCell` model (built by the CLI's `buildRenderDoc`)
to a structurally conformant **nbformat v4** JSON document. `markdown` cells map to notebook
markdown cells; `code`/`equation`/`test`/`data`/`visualization` cells map to notebook code cells —
a computed result becomes an `execute_result` output, an error an `error` output, and a chart a
`display_data` output (inline SVG). Wired as `mtsw export --format ipynb` (alongside `html`/`tex`/
`json`/`pdf`), sharing the same run-then-render pipeline (`--no-run`, `--json`, `-o`). Covered by
`workbook/tests/gap-ipynb-export.test.ts` (structural conformance: JSON parses, nbformat v4
top-level shape, valid `cell_type`s, code cells carry `outputs`/`execution_count`, round-trips
through `JSON.parse(JSON.stringify(...))`) plus CLI export tests.

### Changed — reframe the mathjs-derived factory layer as owned first-party code

Comment/doc-only cleanup, no behavior change. The former `.ts→.ts` mathjs sync is dead (see
"Syncing from mathjs" in `CLAUDE.md`); `functions/src/factories/` and `functions/src/typed/` are
first-class active code, wired into the live graph via `factories/index.ts`. The remaining inline
comments still called this code a "synced factory"/"synced layer," misleadingly implying a
read-only mirror. Reframed ~30 comments across `functions/src/factories/index.ts`,
`matrix-bridge.ts`, `scope.ts`, `functions/src/typed/relational.ts`, `string.ts`, `bitwise.ts`,
`probability.ts`, `typed-bridge.ts`, and the top-level `functions/src/index.ts` as
"activated"/"owned" — preserving useful provenance ("mathjs-derived" as historical origin) while
dropping the live-mirroring implication. Resolves the "own the synced-mathjs layer" strategic
decision item in `TODO.md`.

### Added — B-spline fit/eval, Monte-Carlo/QMC integration

Two additive numeric routines (`functions/src/numeric/bspline.ts`, `functions/src/numeric/monte-carlo.ts`):

- **`bsplineFit(x, y, opts?)`** / **`bsplineEval(spline, xnew)`** — fit a B-spline of degree `k`
  (default cubic) to tabulated data, returned in scipy's `tck` tuple shape (`{t, c, k}`), and
  evaluate it via de Boor's algorithm (Piegl & Tiller `FindSpan`/`BasisFuns`). `s=0` (default) is
  the standard de Boor collocation construction — one basis function per data point, passing
  through every point exactly; `s>0` (or an explicit `nknots`) is a least-squares smoothing spline
  with fewer interior knots, solved via the existing `leastSquares` primitive. Distinct from the
  existing `bspline(controlPoints, degree, t)` control-point curve evaluator, which fits no data.
  Oracle-pinned: interpolation exactness (tol 1e-9), `sin` approximation at intermediate points
  (tol 1e-3), and a cross-check against scipy `splrep`/`splev` (`splev(1.0)` ≈ 0.84144992, tol 1e-4
  — knot conventions differ slightly between constructions, hence the looser tolerance).
- **`monteCarloIntegrate(f, bounds, opts?)`** — Monte-Carlo / quasi-Monte-Carlo integration over an
  axis-aligned box. `method: 'uniform'` (default) uses the package's existing seeded RNG
  (`createRng`) and returns a genuine sample-variance `stderr`; `'halton'` is a dimension-general
  low-discrepancy sequence; `'sobol'` is a genuine Antonov-Saleev (Gray-code) Sobol sequence
  restricted to 1-2 dimensions — the only two whose direction numbers are fully forced by the
  Sobol recurrence with no external Joe-Kuo lookup table (verified point-for-point against
  `scipy.stats.qmc.Sobol(d=2, scramble=False)`). QMC methods report `stderr: 0` (documented: their
  points aren't independent, so a variance-based CI isn't meaningful). Oracle-pinned: `∫_0^1 x² dx`
  and the unit-disk-indicator integral both land within a 4-sigma band of their known values, and
  Halton/Sobol both converge faster than uniform MC at matched `n`
  (`functions/tests/gap-numerics-bspline-mc-oracle.test.ts`, 18 tests).

Scope note: general PDE/method-of-lines (`solvePDE` remains 1-D-heat-only), BDF/Radau stiff solvers
(RODAS already covers tight-tolerance stiffness), `solveODESystem` error control, and DAE/DDE
support remain out of scope — a substantially larger sub-project each, deliberately deferred.

### Added — niche special functions: polylog, Struve H/L, Kelvin ber/bei, Barnes-G

Six additive `@danielsimonjr/mathts-functions` special functions (`functions/src/special/niche.ts`),
following the plain-exported-function pattern already used by `hypergeometric.ts` /
`polygamma-orthopoly.ts` (no typed-function array/WASM dispatch overloads):

- **`polylog(s, z)`** — polylogarithm `Li_s(z)` via its defining series (converges for `|z| < 1`);
  analytic continuation to `|z| >= 1` is out of scope and throws.
- **`struveH(v, z)`** / **`struveL(v, z)`** — Struve H and modified Struve L functions via their
  power series (DLMF 11.2.1), evaluated by a term-recurrence ratio seeded from two `lgamma` calls
  (avoids recomputing Gamma per order / overflow from large individual Gamma values).
- **`kelvinBer(x)`** / **`kelvinBei(x)`** — Kelvin functions ber(x), bei(x) (order 0) via their
  power series (DLMF 10.65.1).
- **`barnesG(z)`** — Barnes G-function for real `z > 0`, via the functional equation
  `G(z+1) = Γ(z)·G(z)` to shift `z` up until the DLMF 5.17.5 asymptotic expansion of `ln G`
  converges to machine precision, then unwinding the shift.

All six oracle-pinned against `mpmath` (dps=25): relative error < 1e-11 across every reference
value, most well under 1e-12 (`functions/tests/gap-special-niche-oracle.test.ts`, 23 tests). Lerch
Φ, Coulomb wave functions, Mathieu functions, parabolic-cylinder functions, spheroidal wave
functions, and the Riemann-Siegel Z function remain — highly specialized, deliberately deferred to
a future chunk.

### Added — stats breadth: GLM (Poisson/Gamma), multivariate-normal PDF/sampling, t-test power

Three additive `@danielsimonjr/mathts-functions` statistics primitives:

- **`glm(X, y, opts)`** (`functions/src/ml/glm.ts`) — generalized linear models via IRLS/Fisher
  scoring, generalizing the existing `logisticRegression` IRLS (whose Newton step is only equivalent
  to Fisher scoring because the logit link is canonical for Bernoulli) to `family: 'poisson'` (log
  link) and `family: 'gamma'` (log or inverse/canonical link). Same `opts.intercept` convention as
  `ols`. Mustart initialization matches R's `glm.fit`/statsmodels (`y + 0.1` for Poisson, `y` for
  Gamma). Oracle-pinned against `statsmodels.GLM.fit`: Poisson coefficients match to 1e-4, Gamma
  (both links) to 1e-4.
- **`mvnPdf(x, mean, cov)`** / **`mvnSample(mean, cov, n, opts?)`** (`functions/src/stats/mvn.ts`) —
  multivariate-normal density and Cholesky-based sampling (`x = mean + L·z`), handling both the 1-D
  scalar case and the general k-D case. `mvnPdf` is a thin wrapper over the existing
  `multivariateNormal` distribution object; `mvnSample` reuses that module's Cholesky factorization
  (now exported as `cholesky` from `typed/dist-objects.ts`) and the package's existing seeded-RNG
  infrastructure (`probability/util/seededRNG.ts`) for reproducible draws. `mvnPdf` pinned to `scipy
  multivariate_normal.pdf` (1e-6); `mvnSample`'s empirical mean/covariance over 20000 seeded draws
  matches the input parameters to ~0.1.
- **`tTestPower(effectSize, nobs, alpha, opts?)`** (`functions/src/stats/power-analysis.ts`) —
  two-sample t-test power via the existing `noncentralTCDF` (Phase 4) and `studentTQuantile`
  building blocks; no distribution math duplicated. `opts.solveFor: 'nobs'` solves (by bisection) for
  the per-group sample size needed to reach a target power. Matches
  `statsmodels.stats.power.tt_ind_solve_power` to 1e-3 (power) / 1e-1 (nobs).

Covered by `functions/tests/gap-stats-breadth-oracle.test.ts`. Follow-ups (Gaussian-process
regression; Dirichlet/Wishart and other multivariate-distribution sampling) are larger, separate
chunks — not part of this one.

### Added — stiff `solveODE`: 4th-order RODAS method + analytic Jacobian option

`@danielsimonjr/mathts-functions` `solveODE` gains `method: 'RODAS'` — Hairer & Wanner's 4th-order,
6-stage, L-stable, stiffly-accurate Rosenbrock method (`functions/src/numeric/solveODE.ts`,
`rodasSolve`). It reuses the existing linearly-implicit structure (form `E = I/(γh) − J`, one LU
factorisation per step solved against each stage), extended to six stages with 4th-order weights
and an embedded 3rd-order error estimate (the last stage increment `k6`). Being 4th order it reaches
tight tolerances in far fewer steps than the 2nd-order `Rosenbrock` (ode23s) — e.g. the linear stiff
`y'=-1000y` to `y(0.01)` at `tol=1e-8` takes **256 steps vs 1487** (≈5.8× fewer). The published
coefficient tableau is verified numerically (halving `h` drops the fixed-step error ≈16×, confirming
4th order) and against scipy Radau on the Robertson problem. RODAS retains the `h·d_i·∂f/∂t` term so
it stays 4th order on non-autonomous systems.

New `jac?: (t, y) => number[][]` option on `ODEOptions`: when supplied, the stiff methods
(`Rosenbrock` and `RODAS`) use this analytic Jacobian instead of the finite-difference one (faster,
more accurate); its shape is validated (n×n) with a clear throw on mismatch. When omitted the
finite-difference path is unchanged — fully backward compatible. RK23/RK45/Rosenbrock behaviour and
the default `RK45` method are unchanged. Covered by `functions/tests/gap-stiff-rodas-oracle.test.ts`
(linear-stiff exact, Robertson vs scipy with analytic jac, step-count improvement over ode23s,
jac-vs-FD consistency, shape-mismatch throw). Follow-ups (event detection, reusing the matrix
package's LU) remain separate.

### Added — linear-algebra extension: pivoted QR, RQ/QL/LQ, condest

Five new `@danielsimonjr/mathts-matrix` `DenseMatrix` primitives in
`matrix/src/operations/`: `qrPivoted` (`qr-pivoted.ts`, column-pivoted rank-revealing QR via
Householder reflections — Businger-Golub pivoting, guarantees `|diag(R)|` non-increasing and
returns a numerical `rank`), `rq`/`ql`/`lq` (`qr-family.ts`, the three QR-family variants, each
reduced to the existing Gram-Schmidt `qr()` via the standard row/column-flip-and-transpose
identities from Golub & Van Loan §5.2 — `lq` needs no flips, `rq`/`ql` reverse rows/columns then
un-flip the factors), and `condest` (`condest.ts`, Hager/Higham 1-norm condition-number
**estimator** — power iteration over `A⁻¹`/`A⁻ᵀ` applied via the existing `lu()` triangular
solves, O(n²) per iteration, never forming `A⁻¹`).

Along the way, found and worked around a latent bug in the shared `matrix/src/operations/common.ts`
`householder()` helper: its degenerate branch (`sigma === 0 && x[0] < 0`, i.e. a column already
antiparallel to `e₁`) defaults `beta = -2`, which is **not** an orthogonal reflection for a
length-1 sub-column (`(1-beta)² ≠ 1` unless `beta ∈ {0, 2}`) — `qrPivoted` hits this on its last
pivot step and now passes `degenerateBeta = 2` explicitly (matching `schur.ts`'s existing
override) rather than patching the shared default, since `eig.ts`/`svd.ts` never exercise a
length-1 sub-column and a shared-file change wasn't re-verified against their suites in this pass;
flagged as a follow-up.

Verified in `matrix/tests/gap-linalg-extension-oracle.test.ts` (22 tests) via
implementation-independent oracles (orthogonality `QᵀQ=I`/`QQᵀ=I`, exact triangularity,
reconstruction to 1e-9, rank on a full-rank vs. rank-deficient 3×3, and `condest` bracketed
against `numpy.linalg.cond(A, 1) = 133.0`, `condest(I) ≈ 1`, and a near-singular 2×2 `> 1e6`) —
never pinned to raw Q/R/L entries or exact pivot order, since those vary by tie-breaking
convention. `docs/api/matrix.md`'s generated export index updated via `npm run docs:functions`.

### Added — geometry breadth: quaternion exp/log/pow + 3-D ray/segment intersections

Closes part of the "Geometry breadth" follow-up logged from the Phase 8 oracle-gap roadmap.
Added `quaternionLog`/`quaternionExp`/`quaternionPow` to `functions/src/geometry/geometry-extra.ts`
(scalar-first `[w,x,y,z]` convention, matching the existing `quaternionInverse`/`quaternionSlerp`):
`log(q) = (0, θ·û)` with `θ = atan2(|v|, w)`; `exp(q) = eʷ·(cos|v|, sin|v|·v̂)`; `pow(q,t) =
exp(t·log(q))`. Also added a new `functions/src/geometry/intersect3d.ts` with
`rayTriangleIntersect` (Möller–Trumbore), `rayPlaneIntersect`, and `segmentSegmentClosest`
(Ericson's `ClosestPtSegmentSegment`), all operating on plain 3-element `number[]` points/vectors
matching `../typed/geometry.ts`'s convention.

Oracle-pinned in `functions/tests/gap-geometry-breadth-oracle.test.ts` (15 tests): `quaternionPow`
verified against `scipy.spatial.transform.Rotation`'s rotvec scaling (90°-about-z quaternion
halved/doubled/held/zeroed to 45°/180°/90°/identity, tol 1e-8/1e-9); `quaternionExp`/`quaternionLog`
round-trip to 1e-10 across five sampled unit quaternions plus the identity edge case;
`rayTriangleIntersect`/`rayPlaneIntersect`/`segmentSegmentClosest` pinned against hand-derived
closed-form hit points, misses, and a parallel-plane/parallel-ray null case. Documented in
`docs/reference/functions.md` (3 new quaternion rows + a new "3-D ray/segment intersections"
section); `SphericalVoronoi`, alpha-shapes, and halfspace-intersection remain — each needs a
Delaunay-triangulation/convex-hull engine MathTS doesn't have yet, a separate follow-up.

### Added — graph breadth: coloring, maxClique, Louvain, Katz centrality, isomorphism

Five new graph functions in `functions/src/graph/community-coloring.ts`, closing the "Graph
breadth" follow-up logged from the Phase 8 oracle-gap roadmap: `graphColoring` (greedy
Welsh-Powell proper vertex coloring, deterministic degree-descending/index-ascending tie-break),
`maxClique` (exact maximum clique via Bron-Kerbosch with pivoting), `louvainCommunities`
(Louvain modularity community detection — deterministic local-moving tie-break, no RNG),
`katzCentrality(adj, alpha[, beta=1])` (solves `x=(I-alpha·Aᵀ)⁻¹(beta·1)` then L2-normalizes,
matching `networkx.katz_centrality_numpy` exactly), and `isIsomorphic` (backtracking +
degree-sequence-pruned graph isomorphism test). Also added a `normalized` option (American
spelling) to the existing `betweennessCentrality` as an alias for `normalise`. Confirmed
`adjacencyMatrix`'s `directed` option (already present, default `false`) already produces an
asymmetric matrix for directed edge lists — no code change needed there, just test coverage;
the TODO note claiming it "still symmetrizes" was stale.

**Root-cause fix surfaced while oracle-pinning:** `betweennessCentrality`'s undirected
normalization divided by `(n-1)(n-2)/2` instead of `(n-1)(n-2)`, making normalised undirected
betweenness exactly 2x too large vs `networkx.betweenness_centrality(G, normalized=True)` — the
raw Brandes accumulation already double-counts each undirected unordered pair (BFS from both
`s` and `t`), so no extra `/2` belongs in the normalized divisor (matches networkx's `_rescale`
for both directed and undirected). Fixed in `functions/src/typed/graph.ts`.

Oracle-pinned vs networkx 3.6.1 in `functions/tests/gap-graph-breadth-oracle.test.ts` (18 tests):
exact match for `katzCentrality` and the fixed `betweennessCentrality` (tol 1e-5/1e-6),
exact boolean match for `isIsomorphic` (K3≅C3, P4≇star4, relabeled-G≅G, mismatched vertex
counts), and property-based checks for the heuristic algorithms — `graphColoring` verified as a
proper coloring using ≤3 colors on the test graph and exactly 3 on K3; `maxClique` verified as an
actual clique of size 3 with a brute-force check that no size-4 clique exists; `louvainCommunities`
verified as a valid partition reaching modularity ≥0.35 on Zachary's karate club graph (networkx
Louvain reaches ~0.42; this implementation reaches ~0.445). Documented in
`docs/reference/functions.md` (5 new curated rows + prose in the Graph Theory section).

### Added — `dwt`/`wavedec` support db1-4, sym2-4, coif1-2 wavelet families

`functions/src/typed/signal.ts`'s `dwt` and `functions/src/signal/wavelets.ts`'s `idwt` previously
implemented only the Haar/db1 2-tap wavelet (hardcoded closed-form; any other name threw). Both now
route through a new general orthogonal filter bank with **periodization** boundary handling
(`functions/src/signal/wavelet-filters.ts`), supporting 9 families: `haar`, `db1`-`db4`, `sym2`-`sym4`,
`coif1`-`coif2`. Each family's decomposition low-pass filter (`dec_lo`) is pinned bit-for-bit against
PyWavelets 1.8.0; the other three orthogonal filters (`dec_hi`/`rec_lo`/`rec_hi`) are derived by the
standard QMF relations and verified against pywt to 1e-14. The periodization phase alignment was
derived empirically against `pywt.dwt(..., mode='periodization')` / `pywt.idwt(...)` and verified
bit-for-bit across multiple signal lengths and every filter. `haar`/`db1` keep their dedicated
WASM-accelerated fast path (verified to reproduce the general filter bank's result exactly, so no
behavior change for existing callers); the other 7 families run the new pure-TypeScript path.
`wavedec`/`waverec` pass the wavelet name through unchanged and now support all 9 families with
perfect reconstruction. `cwt` (ricker/morlet) is unchanged. Oracle-pinned in new
`functions/tests/gap-wavelet-families-oracle.test.ts` (55 tests): all 4 filters for all 9 families vs
pywt (1e-9), single-level `dwt` vs pywt periodization for db2/db3/db4/sym2/sym3/sym4/coif1/coif2
(1e-8), perfect reconstruction `waverec(wavedec(x, w, L), w) ≈ x` for every family at levels 1 and 2
(1e-10), vanishing-moment annihilation of sampled polynomials (dbN/symN kill degree < N, coifN kills
degree < 2N) away from the periodization wrap boundary, and a Haar/db1 regression confirming the new
code reproduces the old hardcoded closed-form results. Documented in `docs/reference/functions.md`
(curated `dwt`/`idwt`/`wavedec`/`waverec` rows + prose).

### Added — `funm` supports defective / repeated-eigenvalue matrices

`functions/src/numeric/matrix-functions.ts`'s `funm(A, f)` previously threw on defective /
non-diagonalizable matrices (repeated or numerically clustered eigenvalues that are not diagonal),
because a matrix function of such a matrix depends on `f` AND its derivatives at each repeated
eigenvalue (for a Jordan block `J = λI + N`, `f(J) = Σ_k f^(k)(λ)/k! · N^k`). It now evaluates these
via **confluent Hermite interpolation** — Newton divided differences over the confluent node list
(each distinct eigenvalue repeated to its multiplicity), where a run of equal nodes contributes the
Taylor coefficient `f^(L)(z)/L!`. This subsumes the existing distinct-spectrum Lagrange-Sylvester
path (kept bit-for-bit as a fast branch, so distinct-eigenvalue results are unchanged). Derivatives
of `f` come from a new optional third argument `fDerivs` (`fDerivs[k] = f^(k+1)`, machine precision —
additive/non-breaking) or, when omitted, from finite-difference stencils (~1e-6). `cosm`/`sinm` now
pass exact analytic derivatives (`cos^(m)(z) = cos(z + mπ/2)`, likewise `sin`), so they are
machine-precise (~1e-16) on defective matrices instead of throwing. `funm` still throws — with a
clear message — only when `f` or a derivative is genuinely singular at a repeated eigenvalue (e.g.
`sqrt`/`log` at 0) or when a needed numerical derivative order exceeds the built-in stencils
(multiplicity > 5, no analytic derivatives). Oracle-pinned in new
`functions/tests/gap-funm-defective-oracle.test.ts` vs the Jordan-block closed forms and
scipy `expm`/`sqrtm`: `funm([[2,1],[0,2]], exp) = e²·[[1,1],[0,1]]`, `…, sqrt) = √2·[[1,0.25],[0,1]]`,
the 3×3 Jordan `exp`, `cosm`/`sinm` on a defective block, and `funm(A, exp) ≈ expm(A)` for a mixed
defective matrix (analytic path 1e-10, numerical path measured ~3–5e-11 but asserted at the honest
1e-6 bound). Note: scipy's own `funm` is wrong on exact Jordan blocks and was NOT used as an oracle.
Documented in `docs/reference/functions.md` (curated `funm` row) and the module docstring.

### Added — `quantileSeq` interpolation modes (lower/higher/nearest/midpoint)

`functions/src/statistics/quantileSeq.ts` gains an optional trailing `mode` string that selects how
the quantile interpolates between adjacent order statistics, matching numpy's `method=`: `'linear'`
(the default — unchanged), `'lower'`, `'higher'`, `'nearest'` (ties round-half-to-even, matching
numpy), and `'midpoint'`. The mode threads through the scalar-probability, probability-array, and
evenly-spaced-`N` paths and works with the existing `sorted` flag. New typed signatures
(`…, string` / `…, boolean, string`) are strictly additive; every existing call behaves identically.
Oracle-pinned vs numpy on `[1..10]` at `q ∈ {0.25, 0.5, 0.75}` in new
`functions/tests/gap-quantile-modes-oracle.test.ts` (`lower→[3,5,7]`, `higher→[4,6,8]`,
`nearest→[3,5,8]`, `midpoint→[3.5,5.5,7.5]`, `linear→[3.25,5.5,7.75]`), including unsorted input, a
`q`-array with a mode, and the round-half-to-even tie behavior. An unknown mode throws. Documented in
`docs/reference/functions.md` (curated `quantileSeq` row).

### Fixed — `besselK` uniform machine precision (continued fraction)

`functions/src/typed/special.ts`'s `besselKScalar` previously split K0/K1 into an ascending series
(`x ≤ 8`) and an asymptotic expansion (`x > 8`). Both cancel/diverge near the crossover, flooring the
relative error at ~1.3e-10 in the band `x ∈ [8, 11]` (measured at `K0(8)`). K0/K1 now use the
uniformly-accurate Numerical Recipes `bessik` method specialized to integer order (fractional part
`mu = 0`): Temme's power series for `x < 2` and Steed's continued fraction CF2 for `x ≥ 2`, with K1
from the same recurrence. Relative error is now `< 8e-16` across the whole range `x ∈ [0.1, 50]` vs
mpmath (dps=30) — band worst-case `5.3e-16` (down from ~1.3e-10). The `K_{n+1} = (2n/x)K_n + K_{n-1}`
upward order recurrence for `n ≥ 2` is unchanged. New oracle test
`functions/tests/gap-besselk-precision-oracle.test.ts` pins K0/K1 to mpmath at 15 points (tight in
the `[8,11]` band) plus K2/K3 via recurrence. The retired `besselKAsym`/`besselK0Series`/
`besselK1Series` helpers are removed.

### Added — `eig` exposes complex eigenvectors via `vectorsIm`

`matrix/src/operations/eig.ts`'s JAMA-derived `orthes`/`hqr2` solver already computes complex
eigenvectors internally (EISPACK convention: real/imaginary parts share two adjacent columns of the
real transform `V`), but the assembly loop dropped them, emitting an all-zero column for every
complex-conjugate eigenvalue pair. `EigResult` gained a new additive field `vectorsIm: number[][]`
(imaginary parts, same shape as `vectors`); for a complex-conjugate pair at indices `j`/`j+1`,
`vectors[j]` holds the real part and `vectorsIm[j]`/`vectorsIm[j+1]` the `+`/`-` imaginary parts,
unit-normalized by the complex 2-norm. `vectors[j]` (real eigenvalues unaffected) now carries the
real part instead of an all-zero column for complex eigenvalues — strictly additive/more-informative,
not a behavior change for any existing real-spectrum consumer. New
`matrix/tests/eig-complex-eigenvectors-oracle.test.ts` pins the implementation-independent complex
residual `‖A v − λ v‖ ≈ 0` (not component values, since eigenvectors are only defined up to a complex
scalar) for `{i,−i}` and `{i,−i,3+i,3−i}` spectra, plus unit-norm/non-triviality and symmetric
back-compat checks. Full `matrix`/`tensor`/`autograd`/`functions` suites re-verified green (no
downstream consumer needed changes — `sqrtm`/`logm`/`matrixPower`/`jordanForm` all throw on complex
eigenvalues before touching `.vectors`). Unblocks a clean `funm`/`care` off the eigenvector basis
(not wired up in this change).

### Changed — unified duplicate `multipleComparison`/`multipleTest` implementation

`multipleComparison` (`functions/src/typed/hypothesis.ts`) and `multipleTest`
(`functions/src/stats/inference-extra.ts`) were two independent implementations of the identical
Bonferroni/Holm/Benjamini-Hochberg p-value correction. Verified no import cycle (`inference-extra.ts`'s
transitive closure — `distribution-functions.ts` → `typed/dist-objects.ts` — never reaches
`typed/hypothesis.ts`), so `multipleComparison` now delegates to `multipleTest`; both public names
and signatures are unchanged, and both always return identical results (locked by
`functions/tests/gap-multiple-testing-consolidation.test.ts`, including a pinned BH result on
`[0.01, 0.02, 0.03, 0.04, 0.05]` — all ties at 0.05). Added cross-reference docs (both directions)
noting the alias pair, and clarified `chiSquareTest`'s 2D form vs `chi2Contingency` are
complementary (goodness-of-fit + plain independence test vs the `scipy`-parity contingency test with
Yates correction/expected counts/Cramér's V), not redundant. `docs/reference/functions.md` gained a
`multipleComparison` row (previously undocumented in the curated table) and both descriptions were
updated; `npm run docs:functions` regenerated `functions.html` accordingly.

### Added — implementation-independent invariants for `csd`/`coherence`

`csd`/`coherence` (`functions/src/signal/spectral-peaks.ts`) had no hard-pinned tests. New
`functions/tests/gap-csd-coherence-oracle.test.ts` pins mathematical invariants instead of exact
numbers (a seeded numpy RNG won't reproduce JS's PRNG stream): coherence values lie in `[0, 1]`;
coherence of a noiseless scaled copy (`y = 3x`) is ~1 at the signal's frequency bins; `csd(x,x)`
matches the package's independent `welchPSD` estimator up to the well-known one-sided PSD doubling
convention (interior bins ×2, DC/Nyquist bins ×1); and `csd(x,y)`/`csd(y,x)` have equal magnitude
with `|Re(Pxy)| <= |Pxy|` verified via the polarization identity
`Re(Pxy) = (P(x+y,x+y) - Pxx - Pyy) / 2` across four independently-computed `csd` calls. All four
invariants passed on the first run — no bug found; this closes the "not hard-pinned" follow-up.

### Added — scipy-pinned oracle for `linprog`'s free-variable (lower=null) bounds path

`linprog`'s options form (`functions/src/typed/numeric.ts`) splits a variable whose bounds lower is
`null` (unbounded below) into `x = x⁺ - x⁻` in `linprogTwoPhase` — this free-variable path had no
direct test. New `functions/tests/gap-linprog-freevar-oracle.test.ts` pins it against scipy 1.17.1:
minimizing `c=[1,0]` subject to `A_ub=[[0,1]] <= [3]`, `A_eq=[[1,1]] = [1]` with `x0` free reaches
`fun=-2, x=[-2,3]` (x0 negative at the optimum — only reachable via the split path), while the same
constraints under the default `x>=0` bounds give `fun=0`. Both matched scipy on the first run — the
free-variable path was already correct; this closes the untested-gap follow-up as a regression guard.

### Removed — dead WASM `statsVariance`/`statsStd` type declarations

The `AsModule` interfaces in `functions/src/wasm/WasmLoader.ts` and `matrix/src/backends/WasmLoader.ts`
still declared `statsVariance`/`statsStd` kernel signatures whose JS call paths were retired 2026-07-15
(the corrected two-pass `variance`/`std` in core beat the WASM kernels on accuracy and were not slower,
being memory-bound). No live caller referenced them — only retirement comments in
`functions/src/statistics/{variance,std}.ts`. Removed the four dead type declarations. TS-only change:
the `.wasm` binary and its SHA-384 manifest are unaffected (the AS source never exported these names;
the general-library `array_variance`/`array_stddev` kernels are retained). Broader dead-`stats*`-decl
audit against actual binary exports remains a separate follow-up.

### Added — real univariate symbolic rational cancellation for `cancel`

`cancel(expr)` (`functions/src/typed/algebra.ts`) previously only handled numeric integer fractions
(`a/b`, compound `(a/b)/(c/d)`) plus an identical-string short-circuit, returning symbolic input
unchanged. It now performs real univariate integer-coefficient rational cancellation via polynomial
GCD, matching `sympy.cancel`: `cancel('(x^2-1)/(x-1)')` → `1*x + 1` (numerator/denominator divided by
`polynomialGCD(N, D)`); `cancel('(2*x^2-2)/(2*x-2)')` also cancels the shared numeric content down to
`1*x + 1`; `cancel('(x^3-1)/(x^2-1)')` → `(1*x^2 + 1*x + 1)/(1*x + 1)` (degree reduces but a
nontrivial denominator remains, so the result stays a fraction). Falls back unchanged to the
pre-existing numeric-only paths for multivariate expressions, non-integer coefficients, and inputs
whose numerator/denominator share no non-trivial polynomial factor — the existing numeric fraction
and identical-string tests are unaffected. New test:
`functions/tests/gap-cancel-symbolic-oracle.test.ts` (implementation-independent value-preservation
oracle, sampled away from poles, plus the numeric regression cases).

### Fixed — real `expand`/`factor`/`together`/`apart` for univariate polynomials/rationals (Phase 8 Task 6, final task)

`expand`/`factor`/`apart`/`together` (`functions/src/typed/algebra.ts`) were documented no-ops
(Phase 0's `docs/reference/functions.md` ⚠️ pass-through annotations + the
`cas-passthrough-documented.test.ts` characterization test) for the exact inputs these tests
exercise. All four now perform real transforms for the **univariate** case, verified against
sympy 1.14.0: `expand('(x+1)^3')` → `1*x^3 + 3*x^2 + 3*x + 1` (sympy: `x**3 + 3*x**2 + 3*x + 1`);
`factor('x^2-1')` → `(x - 1)*(x + 1)` (sympy: `(x-1)*(x+1)`); `together('1/x+1/(x+1)')` →
`(1 + 2*x)/((x)*((x+1)))` (sympy: `(2*x+1)/(x*(x+1))`); `apart('1/(x^2-1)')` →
`1/(2*(x - 1)) - 1/(2*(x + 1))` (sympy: `-1/(2*(x+1)) + 1/(2*(x-1))`) — same value, term order
differs. `expand`/`factor` route through the existing exact-polynomial parser
(`polyFromExpression`/`polyToString` in `functions/src/typed/polynomial-ideal.ts`); `factor` adds a
rational-root-theorem search (candidates ±divisors(constant)/divisors(leading), each confirmed root
divided out exactly via `polynomialQuotient`/`polynomialRemainder`); `together` combines a sum of
rational terms over the product of their denominators; `apart` decomposes a proper rational function
whose denominator factors into **distinct** rational linear factors via the cover-up/residue method
(`Aᵢ = N(rᵢ)/D'(rᵢ)`, computed in exact rational arithmetic). Inputs outside this scope (multiple
variables, non-integer coefficients, function calls, a denominator with a repeated or irreducible
higher-degree factor) fall back unchanged to each function's original implementation (`factor`'s
integer-GCD extraction, `together`/`apart`'s numeric-only fraction arithmetic), so none of the
pre-existing multivariate/numeric pinned tests changed. Flipped the Phase-0 pass-through
characterization test (`functions/tests/cas-passthrough-documented.test.ts`) to assert the new
numeric behavior for these four (implementation-independent — evaluated at sample points, not pinned
to a specific string form) and removed their stale ⚠️ doc annotations; `casExpand`/`casFactor`
(the separate worker-batchable kernels in `functions/src/typed/cas.ts`) are unchanged and remain
documented pass-throughs (out of this task's scope). New test: `functions/tests/cas-engine.test.ts`.
Multivariate symbolic expansion/factorization and symbolic integration remain future work. This
closes out Phase 8.

### Added — Interval arithmetic (Phase 8 Task 5)

Added `functions/src/numeric/interval.ts`, exported from `@danielsimonjr/mathts-functions`:
`interval(lo, hi)` / the `Interval` class — rigorous interval arithmetic with outward-rounded
`add`/`sub`/`mul`/`div`/`neg`, `width`/`mid`/`contains`, and monotonic-aware `sqrt`/`exp`/`log`/`pow`.
Since JavaScript has no directed-rounding-mode control, every result's `lo` is nudged down and `hi`
nudged up by a relative epsilon (`Number.EPSILON`) plus one ULP (`Number.MIN_VALUE`) so the true
real-valued result is always contained — the first verified-bounds numeric type in the library (the
`mpmath.iv` / INTLAB analogue). Pinned: `interval(1,2).add(interval(3,4))` = `[4,6]`,
`interval(-1,2).mul(interval(2,3))` = `[-3,6]`, `interval(1,4).sqrt()` = `[1,2]`; `div` throws when
the divisor interval contains zero.

### Added — N-D regular-grid interpolation `interpn` (Phase 8 Task 4)

Added `functions/src/numeric/interpn.ts`, exported from `@danielsimonjr/mathts-functions`:
`interpn(grids, values, query)` — regular-grid multilinear interpolation matching
`scipy.interpolate.interpn` (default `method='linear'`, `bounds_error=True`). Generalizes past the
1-D/2-D spec to arbitrary dimension `n`: locates the bracketing cell per axis via binary search and
takes the weighted average of the `2^n` corner values. Exact on any function affine in each
coordinate; throws on a non-increasing grid axis, a `values` shape mismatch, or an out-of-bounds
query (no extrapolation). Pinned against `scipy.interpolate.interpn` for 1-D/2-D/3-D cases and
out-of-bounds behavior (exact match).

### Fixed — `solveBVP` generalized beyond the hardcoded 2-state case (Phase 8 Task 4)

`solveBVP(f, bc, mesh)` (`functions/src/typed/numeric.ts`) hardcoded its shooting-method unknowns to
a 2-element state vector (`const n = 2`), so it could only solve BVPs cast as the 2-state
`[y, y']` system (the common single-2nd-order-ODE shape) — a coupled 3+-state first-order system
threw or silently produced garbage. Added an optional 4th parameter, `y0Guess: number[] = [0, 0]`,
whose length now sets the state dimension `n`; the core shooting/Newton loop was already
dimension-agnostic, so this is a pure additive fix with no behavior change for existing 3-argument
call sites (identical default `[0, 0]`). Verified with a new pinned 3-state decoupled-system test
(`y_i' = -i·y_i`, exact solution `y_i(t) = exp(-i·t)`) alongside the required `y'' = -y` (→ `sin`)
regression test; all pre-existing `solveBVP` tests remain green unchanged.

### Added — Geometry & sets: quaternion slerp/inverse/Euler, boundingBox, procrustes, kdTree kNN/radius, multiset ops (Phase 8 Task 3)

Added `functions/src/geometry/geometry-extra.ts`, exported from `@danielsimonjr/mathts-functions`:
quaternion `slerp`/inverse/Euler conversion, an axis-aligned `boundingBox`, orthogonal `procrustes`
alignment (via `@danielsimonjr/mathts-matrix`'s `svd`), brute-force kd-tree `kNN`/radius queries, and
multiset `setIsSuperset`/`setEqual`/`setDisjoint` (complementing the existing `setIsSubset`).

- `quaternionInverse(q)` — multiplicative inverse `conj(q) / |q|²` (order `[w,x,y,z]`, matching the
  repo-wide convention in the existing `geometry-extra.ts`).
- `quaternionSlerp(q1, q2, t)` — spherical linear interpolation between unit quaternions; takes the
  shortest arc (negates `q2` when the dot product is negative) and falls back to normalized lerp
  when the inputs are nearly parallel.
- `quaternionToEuler(q)` — ZYX intrinsic Euler angles `[roll, pitch, yaw]`; pinned against
  `scipy.spatial.transform.Rotation.as_euler('xyz')` across 5 random rotations (exact match to
  1e-8).
- `boundingBox(points)` — per-dimension axis-aligned `{ min, max }`.
- `procrustes(A, B)` — orthogonal Procrustes alignment mapping `B` onto `A`: center + unit-normalize
  both, `M = A0ᵀB0 = UΣVᵀ`, `R = VUᵀ`, `scale = ΣΣᵢ`, `disparity = ‖A0 − scale·B0·R‖²`. Pinned
  against `scipy.spatial.procrustes` disparity (exact-rotation and unrelated-point-set cases both
  match to float precision).
- `kdTreeKNN(points, query, k)` / `kdTreeRadius(points, query, r)` — brute-force Euclidean k-nearest
  and radius queries (the existing `kdTree`/`kdTreeNearest` in `typed/geometry.ts` has no radius
  method).
- `setIsSuperset(a, b)` / `setEqual(a, b)` / `setDisjoint(a, b)` — multiset comparisons built on the
  existing `setIsSubset`/`setMultiplicity`.

### Added — Graph optimization: maxFlow/minCut, astar, hungarian (Phase 8 Task 2)

Added `functions/src/graph/optimization.ts`, exported from `@danielsimonjr/mathts-functions`:
`maxFlow`/`minCut` (Edmonds-Karp), `astar` (heuristic pathfinding), and `hungarian` (Kuhn-Munkres
optimal assignment) — combinatorial-optimization algorithms complementing the existing graph
traversal/shortest-path/centrality functions.

- `maxFlow(capacity, source, sink)` — Edmonds-Karp max-flow (Ford-Fulkerson with BFS
  shortest-augmenting-path selection on the residual graph); returns `{ maxFlow, flow }`. Pinned
  against `networkx.maximum_flow_value` — the initially-drafted oracle value of 4 for the sample
  4-node network was wrong; the verified value is 5.
- `minCut(capacity, source, sink)` — the induced minimum s-t cut via the max-flow-min-cut theorem:
  reuses `maxFlow`'s residual graph, BFS from `source` gives the `S`/`T` partition, and `value`
  equals the max-flow value.
- `astar(adj, start, goal, heuristic)` — heuristic-guided shortest path on a weighted adjacency
  matrix; reduces to Dijkstra with `heuristic = () => 0`. Returns `{ path: [], cost: Infinity }`
  when unreachable.
- `hungarian(cost)` — Kuhn-Munkres optimal assignment minimizing total cost on a square cost
  matrix via the classical O(n³) potential/shortest-augmenting-path formulation; returns
  `{ assignment, cost }`. Pinned against `scipy.optimize.linear_sum_assignment` (3x3 and 4x4).

### Added — Graph traversal, all-pairs shortest paths, and distance centrality (Phase 8 Task 1)

Added `functions/src/graph/traversal-centrality.ts`, exported from `@danielsimonjr/mathts-functions`:
`bfs`/`dfs` (visitation-order traversal), all-pairs `floydWarshall`, single-source `bellmanFord`
(negative-weight/cycle-aware), and `closenessCentrality`/`harmonicCentrality` — complementing the
existing Dijkstra `shortestPath`/`graphDistance` in `typed/graph.ts`.

- `bfs(adj, start)` / `dfs(adj, start)` — visitation order over a directed adjacency-matrix reading
  (any finite, nonzero off-diagonal `adj[i][j]` is an edge i → j; neighbors visited in ascending
  index order; the matrix is never symmetrized).
- `floydWarshall(adj)` — all-pairs shortest-path distances via the standard O(V³) triple loop;
  tolerates negative edge weights (both `Infinity` and `0` off-diagonal mean "no edge").
- `bellmanFord(adj, source)` — single-source shortest paths, negative-weight-aware: relaxes all
  edges `|V|-1` times then one more pass to detect a negative-weight cycle reachable from the
  source, returning `{ dist, hasNegativeCycle }`.
- `closenessCentrality(adj)` / `harmonicCentrality(adj)` — distance-based centrality built on
  `floydWarshall`, pinned against `networkx.closeness_centrality`/`harmonic_centrality`. Matches
  networkx's directed-graph default of summing *incoming* distances to a node; `closenessCentrality`
  applies the Wasserman–Faust disconnected-graph scaling `(r-1)/(n-1) · (r-1)/Σd`.

### Added — Control-theory matrix equations: dlyap/care/dare (Phase 7 Task 5)

Added `functions/src/numeric/control-equations.ts`, exported from `@danielsimonjr/mathts-functions`:
`dlyap` (discrete Lyapunov), `care`/`dare` (continuous/discrete algebraic Riccati) — the matrix
equations underlying LQR (linear-quadratic regulator) and Kalman-filter design, complementing the
existing continuous `sylvester`/`lyap`.

- `dlyap(A, Q)` — solves `A X Aᵀ − X + Q = 0` by building the Kronecker-product linear system
  `(I − A⊗A) vec(X) = vec(Q)` explicitly (practical for the `n ≲ 20` this targets) and solving it
  with the existing `linsolve`.
- `care(A, B, Q, R)` — solves the continuous Riccati equation `AᵀX + XA − X B R⁻¹ Bᵀ X + Q = 0` via
  Newton iteration for the matrix sign function of the Hamiltonian `H = [[A, −BR⁻¹Bᵀ], [−Q, −Aᵀ]]`,
  then extracts `X = U₂U₁⁻¹` from the stable-eigenspace projector `½(I − sign(H))`. Chosen over a
  Kleinman/Newton iteration (which needs a stabilizing initial gain — `X₀ = 0` isn't stabilizing
  for e.g. the classic double-integrator `A = [[0,1],[0,0]]`) and over a Hamiltonian-eigenvector
  construction (this codebase's `eig` only returns real eigenvector columns for complex
  eigenvalues, per `matrix-functions.ts`).
- `dare(A, B, Q, R)` — solves the discrete Riccati equation
  `AᵀXA − X − AᵀXB(R + BᵀXB)⁻¹BᵀXA + Q = 0` via the structure-preserving doubling algorithm (SDA),
  the discrete-time analogue of `care`'s sign-function method — likewise needs no stabilizing
  initial gain.

Pinned vs scipy: `care([[0,1],[0,0]], [[0],[1]], [[1,0],[0,1]], [[1]])` → `[[√3, 1], [1, √3]]`
(matches `scipy.linalg.solve_continuous_are`); `dare([[1,1],[0,1]], [[0],[1]], [[1,0],[0,1]], [[1]])`
→ `[[2.94712297, 2.36920541], [2.36920541, 4.61313426]]` (matches `scipy.linalg.solve_discrete_are`,
independently residual-checked in-test to <1e-6); `dlyap([[0.5,0],[0,0.5]], [[1,0],[0,1]])` →
`(4/3)·I`.

Documented in `docs/reference/functions.md` under Linear Algebra (main table + new "Control-Theory
Matrix Equations" section). `npm run docs:functions` / `npm run docs:deps` regenerated;
docs-completeness gate green. `functions/tests/control-equations.test.ts` (3 tests). Full
`functions` regression: 3694 passed, 94 skipped, 0 failed. `tsc --noEmit` and targeted `eslint`
both 0 problems.

### Added — Complex matrix functions: funm/cosm/sinm (Phase 7 Task 4)

Added `functions/src/numeric/matrix-functions.ts`, exported from `@danielsimonjr/mathts-functions`:
`funm(A, f)` — a general matrix function returning a complex-valued matrix `{ re, im }` — plus
`cosm`/`sinm` built on it, so indefinite and complex-spectrum inputs work where the existing
`sqrtm`/`matrixLogm` only handle real positive spectra.

- `funm(A, f)` — diagonal matrices are handled exactly (elementwise, any multiplicity);
  otherwise the eigenvalues are computed via `@danielsimonjr/mathts-matrix`'s `eig` and, when
  pairwise distinct, the Lagrange–Sylvester interpolation formula for a diagonalizable matrix
  with simple spectrum is applied in complex arithmetic:
  `f(A) = Σ_i f(λ_i) · Π_{j≠i} (A − λ_j I) / (λ_i − λ_j)` — needing only eigenvalues, not
  eigenvectors. Throws for non-diagonal matrices with repeated/numerically-indistinguishable
  eigenvalues (defective/non-diagonalizable case) — a documented limitation; a full
  Schur–Parlett block recurrence would lift it but isn't required by current call sites.
- `cosm(A)` / `sinm(A)` — `funm(A, complexCos)` / `funm(A, complexSin)`, with
  `cos(z) = cos(re)cosh(im) − i·sin(re)sinh(im)` and `sin(z) = sin(re)cosh(im) + i·cos(re)sinh(im)`.

Pinned vs scipy: `cosm([[0,1],[-1,0]])` = `diag(cosh 1)` = `diag(1.5430806348)` (eigenvalues
±i); `funm(diag(-4,-9), sqrt)` = `diag(2i, 3i)`.

Documented in `docs/reference/functions.md` under Linear Algebra → "Decompositions & matrix
functions". `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness gate
green. `functions/tests/matrix-functions.test.ts` (4 tests: rotation-matrix cosm vs `cosh(1)`,
`funm` sqrt of a negative diagonal, diagonal cosm, zero-matrix sinm). Full `functions`
regression: 3691 passed, 94 skipped, 0 failed. `tsc --noEmit` and targeted `eslint` both 0
problems.

### Added — Structured & indefinite solvers: thomasSolve/solveBanded/toeplitzSolve/ldl (Phase 7 Task 3)

Added `functions/src/numeric/structured-solvers.ts`, exported from `@danielsimonjr/mathts-functions`:
four direct solvers that exploit matrix structure to beat a general dense factorization
(`lusolve`), or — for `ldl` — to factor matrices `cholesky` can't (symmetric but not
positive-definite, e.g. KKT / saddle-point systems).

- `thomasSolve(sub, diag, sup, d)` — the Thomas algorithm, O(n) tridiagonal solve.
- `solveBanded(l, u, A, b)` — banded-aware Gaussian elimination touching only the O(n(l+u))
  entries inside the band (`A` passed as a full dense matrix with `l` lower / `u` upper nonzero
  diagonals). Like `thomasSolve`, no pivoting is performed.
- `toeplitzSolve(c, r, b)` — O(n²) solve of a Toeplitz system via Levinson–Durbin, given only
  the first column `c` and first row `r` (`c[0] === r[0]`). Order-recursively tracks the
  solution together with two mutually-coupled predictor vectors (one for `T`, one for `Tᵀ`,
  related via the persymmetry `J T J = Tᵀ` every Toeplitz matrix has) — the trick that makes a
  general (non-symmetric) Toeplitz system solvable in O(n²) rather than O(n³).
- `ldl(A)` — Bunch–Kaufman-pivoted `LDLᵀ` factorization of a symmetric (possibly indefinite)
  matrix, with 1x1/2x2 diagonal blocks. Returns `{ L, D, perm }`; reconstruction identity
  `L·D·Lᵀ = P·A·Pᵀ` where `(P·A·Pᵀ)[i][j] = A[perm[i]][perm[j]]`.

Pinned vs scipy: `thomasSolve([-1,-1],[2,2,2],[-1,-1],[1,0,1])` → `[1,1,1]`;
`toeplitzSolve([2,1],[2,1],[1,2])` → `[0,1]` (matches `scipy.linalg.solve_toeplitz`);
`ldl([[1,2,3],[2,1,4],[3,4,1]])` reconstructs `A` per the identity above (matches
`scipy.linalg.ldl`, including its exact pivot sequence for this matrix — verified by symbolic
derivation and numeric cross-check against scipy/numpy).

Documented in `docs/reference/functions.md` under Linear Algebra, new "Structured & Indefinite
Solvers" subsection. `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness
gate green. `functions/tests/structured-solvers.test.ts` (4 tests: thomasSolve tridiagonal,
toeplitzSolve vs scipy, solveBanded vs dense solve, ldl reconstruction identity). Full `functions`
regression: 3687 passed, 94 skipped, 0 failed. `tsc --noEmit` and `eslint .` both 0 problems.

### Added — Iterative symmetric eigensolver: eigsh (Phase 7 Task 2)

Added `functions/src/numeric/eigsh.ts`, exported from `@danielsimonjr/mathts-functions`:
`eigsh(A, k = 1, opts?)` — a Lanczos iteration returning the `k` largest (`which: 'LM'`, default)
or smallest (`which: 'SM'`) eigenpairs of a **symmetric** matrix, for large problems the dense
`eigs` (full eigendecomposition) can't handle. Accepts `A` as a dense matrix or a matvec callback
(`(x: number[]) => number[]`, matching `krylov.ts`'s LinearOperator convention; `opts.n` is
required for the matvec form). Builds the orthonormal Krylov basis with full reorthogonalization
against every prior Lanczos vector (numerical stability at small/medium sizes), forms the small
tridiagonal projection `T`, solves `T`'s eigenproblem via cyclic Jacobi rotations, and lifts the
result back through the basis (Rayleigh-Ritz). Eigenvectors are returned as columns of an
`n x k` matrix. Pinned: for tridiag `[[2,1,0],[1,2,1],[0,1,2]]`, largest = `2 + √2 ≈ 3.41421356`,
smallest = `2 − √2 ≈ 0.58578644`.

Documented in `docs/reference/functions.md` under Linear Algebra, new "Iterative Eigensolver"
subsection. `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness gate
green. `functions/tests/eigsh.test.ts` (5 tests: pinned largest/smallest eigenvalues, k=2 largest,
`Av = λv` residual check, matvec-operator input with explicit `n`). Full `functions` regression:
3682 passed, 94 skipped, 0 failed.

### Added — Iterative Krylov solvers: cg/gmres/bicgstab/minres (Phase 7 Task 1)

Added `functions/src/numeric/krylov.ts`, exported from `@danielsimonjr/mathts-functions`:
iterative Krylov solvers `cg` (SPD), `minres` (symmetric indefinite), `gmres` (restarted),
`bicgstab` (nonsymmetric) — each accepting a dense matrix OR a matvec callback
(`(x: number[]) => number[]`, LinearOperator style) plus an optional Jacobi preconditioner
(`M⁻¹ = diag(1/A_ii)`, dense-matrix only, or a custom `(r) => M⁻¹r` function), for the large
sparse systems dense factorization (`lusolve`/`qr`/…) can't handle. Convergence is measured on
the relative residual `‖b − A x‖₂ / ‖b‖₂ < tol` (default `tol=1e-10`,
`maxIter=min(10n, 1000)`). Pinned: `cg([[4,1],[1,3]],[1,2])` = `[1/11, 7/11]`.

Documented in `docs/reference/functions.md` under Linear Algebra, new "Iterative Solvers"
subsection. `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness gate
green. `functions/tests/krylov.test.ts` (10 tests: the pinned SPD oracle, larger SPD/nonsymmetric/
indefinite systems verified by direct residual, matvec-operator input, Jacobi + custom
preconditioners, and the matvec-only-Jacobi error path). Full `functions` regression: 3678
passed, 94 skipped, 0 failed.

### Added — Spectral estimation + peak analysis: csd/coherence/findPeaks/peakWidths/stft/istft/decimate (Phase 6 Task 5)

Added `functions/src/signal/spectral-peaks.ts`, exported from `@danielsimonjr/mathts-functions`
(the fifth and final Phase 6 signal-processing task):

- `findPeaks(x[, opts])` — strict local-maxima peak indices (`x[i-1] < x[i] > x[i+1]`), optionally
  filtered by `opts.height` (min value), `opts.distance` (min index separation, greedily keeping
  the taller of any too-close pair — `scipy`'s tallest-first sweep), and/or `opts.prominence`
  (min topographic prominence, walking outward from each peak to the nearest taller sample or
  boundary in each direction). Pinned to `scipy.signal.find_peaks([0,2,0,3,0,1,0])` = `[1,3,5]`.
- `peakWidths(x, peaks[, relHeight=0.5])` — width (in samples) of each peak at `relHeight` down
  from the peak toward its topographic base, with linearly-interpolated crossing points. Pinned
  bit-for-bit against `scipy.signal.peak_widths` (`peakWidths([0,1,3,1,0], [2])` = `[1.5]`).
- `csd(x, y[, opts])` / `coherence(x, y[, opts])` — cross-spectral density / magnitude-squared
  coherence via Welch's overlapped-segment-averaging method (segment, window, FFT, average
  `X·conj(Y)`), reusing the package's own object-array `fft` (`signal/fft.ts`, the same internal
  FFT `signal/conv.ts` already builds on) and `windowFunction`. `opts = { nperseg, noverlap,
  window, fs }`.
- `stft(x[, opts])` / `istft(S[, opts])` — short-time Fourier transform (windowed overlapping
  frames, each independently FFT'd) and its inverse via overlap-add, normalized by the running sum
  of squared window values (constant-overlap-add). This normalization makes reconstruction exact
  in the interior for *any* window (not just COLA-satisfying ones) wherever the overlap-sum is
  nonzero — verified via `istft(stft(x))` on a 64-sample signal (Hann window, 16/8 frame/overlap),
  matching to 3 decimal places over the fully-overlapped interior region.
- `decimate(x, q)` — anti-aliased downsampling by integer factor `q`: a Butterworth lowpass
  (order 4, cutoff `min(0.8/q, 0.99)` of Nyquist) applied zero-phase via the existing
  `butter`/`filtfilt`, then every `q`-th sample kept.

Documented in `docs/reference/functions.md` under Signal Processing (new "Peak detection"
subsection + additions to "Spectral estimation" and the main table). `npm run docs:functions` /
`npm run docs:deps` regenerated; docs-completeness gate green. This completes the Phase 6
signal-processing breadth plan (`docs/superpowers/plans/2026-07-16-phase6-signal-breadth.md`).

### Added — Wavelet transforms: idwt/wavedec/waverec + cwt (Phase 6 Task 4)

Added `functions/src/signal/wavelets.ts`, exported from `@danielsimonjr/mathts-functions`. The
existing `dwt` (`typed/signal.ts`) was forward, single-level only — this closes the loop with an
inverse, multilevel decomposition/reconstruction, and a continuous transform:

- `idwt(approx, detail[, wavelet])` — inverse single-level DWT. Matches `dwt`'s Haar convention
  exactly (`s = 1/sqrt(2)`, `approx[i] = s*(x[2i]+x[2i+1])`, `detail[i] = s*(x[2i]-x[2i+1])`);
  Haar's synthesis filters are the time-reverse of its analysis filters, a no-op for a symmetric
  2-tap filter, giving the closed-form inverse `x[2i] = s*(approx[i]+detail[i])`,
  `x[2i+1] = s*(approx[i]-detail[i])`. Pinned by `idwt(dwt(x).approx, dwt(x).detail) === x`.
- `wavedec(x[, wavelet, level])` — multilevel decomposition: repeatedly `dwt`s the approximation
  coefficients, returning `[cA_level, cD_level, cD_{level-1}, …, cD_1]` (pywt order).
- `waverec(coeffs[, wavelet])` — inverse of `wavedec`: repeatedly `idwt`s from the coarsest level
  up. Pinned by `waverec(wavedec(x, w, L), w) === x` (perfect reconstruction).
- `cwt(x, scales[, wavelet])` — continuous wavelet transform: convolves `x` (via `convDirect`'s
  `'same'` mode) with a discretized, normalized Ricker (Mexican-hat, `(1-t²)e^(-t²/2)`, default) or
  Morlet (`cos(5t)e^(-t²/2)`) wavelet at each scale → `scales.length x x.length` matrix.

Only `'haar'`/`'db1'` are supported (matching `dwt`, which throws for any other wavelet name).

Documented in `docs/reference/functions.md` under Signal Processing. `npm run docs:functions` /
`npm run docs:deps` regenerated; docs-completeness gate green.

### Added — FIR bandpass + LS/equiripple design + smoothing/deconvolution (Phase 6 Task 3)

Added `functions/src/signal/fir-smoothing.ts`, exported from `@danielsimonjr/mathts-functions`:

- `firwinBandpass(numtaps, [f1, f2])` — FIR bandpass tap design by the windowed-sinc method
  (Hamming window): `h[n] = (f2·sinc(f2·(n−M/2)) − f1·sinc(f1·(n−M/2)))·hamming[n]`. This is the
  array-cutoff case the scalar-only `firwin` (`signal-filter-extra.ts`) didn't support — resolves
  the Phase-0 note. `sinc` is now exported from `signal-filter-extra.ts` for reuse.
- `firls(numtaps, bands, desired)` — least-squares linear-phase FIR design: a genuine
  (non-approximate) LS fit via dense trapezoid-quadrature sampling of the specified bands plus a
  cosine-basis normal-equations solve (Type I/II symmetric filter representation).
- `remez(numtaps, bands, desired)` — Parks-McClellan-style equiripple FIR design. **Documented as
  approximate**: implements Lawson's algorithm (iteratively reweighted least squares over the
  `firls` normal equations), not the exact Remez-exchange algorithm — converges toward but does not
  guarantee a true minimax/equiripple solution.
- `savgol(x, windowLength, polyorder)` — Savitzky-Golay smoothing: per-window degree-`polyorder`
  polynomial fit via the normal equations over a Vandermonde of window offsets; edges reuse the
  nearest boundary window's fit evaluated at the edge point's offset (scipy's `mode='interp'`).
  Exact on polynomials of degree <= `polyorder`; pinned bit-for-bit against
  `scipy.signal.savgol_filter` (interior and both boundary regions, multiple window/order pairs).
- `wiener(x[, mysize])` — Wiener adaptive filter: local mean/variance over a sliding window
  (`convDirect`'s zero-padded `'same'` convention), output
  `m + max(0, v−noise)/max(v, noise)·(x−m)`.
- `deconvolve(signal, divisor)` — FIR/polynomial deconvolution via synthetic long division
  (`signal = conv(divisor, quotient) + remainder`); pinned bit-for-bit against
  `scipy.signal.deconvolve`, including the non-exact-division remainder case.

Documented in `docs/reference/functions.md` under Signal Processing → "Digital filter design &
application". `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness gate
green.

### Added — Chebyshev/elliptic IIR design (Phase 6 Task 2)

Added `functions/src/signal/iir-design.ts`, exported from `@danielsimonjr/mathts-functions`:

- `cheby1(N, rp, Wn, btype?)` / `cheby2(N, rs, Wn, btype?)` — Chebyshev Type I (equiripple
  passband) / Type II (equiripple stopband, monotone passband) IIR design, built on the
  existing `butter` analog-prototype → frequency-transform → bilinear pipeline (now shared via
  `signal-filter-extra.ts`'s `analogToDigital`).
- `ellip(N, rp, rs, Wn, btype?)` — elliptic (Cauer) IIR design: a full port of scipy's
  closed-form nome-based algorithm (Orfanidis, "Lecture Notes on Elliptic Filter Design") —
  the degree equation and the elliptic root-finding are both solved analytically (theta-function
  series / descending Landen transformation), no numerical optimizer — reusing the repo's
  existing AGM-based `ellipticKScalar` and `jacobiSN`/`jacobiCN`/`jacobiDN` (Phase 5). This is
  the exact algorithm, not an approximation.
- `bilinear(b, a, fs)` — analog → digital bilinear (Tustin) transform of a transfer function.
- `buttord(wp, ws, gpass, gstop)` — minimum Butterworth order + natural frequency (scalar
  lowpass/highpass case) → `{ N, Wn }`.
- `zpk2sos(z, p, k)` / `sosfilt(sos, x)` — group zeros/poles/gain into cascaded second-order
  sections and apply them (direct-form-II transposed per biquad).

### Changed — `butter` now honors `btype`

`butter(N, Wn, btype?)` now accepts `'low' | 'high' | 'bandpass' | 'bandstop'` (`Wn` becomes
`[low, high]` for the last two); the original 2-arg lowpass call is unchanged (`btype` defaults
to `'low'`). Resolves the Phase-0 note that `butter` was lowpass-only. The zpk-domain
lp2lp/lp2hp/lp2bp/lp2bs + bilinear + zpk2tf pipeline is now shared (`analogToDigital` in
`signal-filter-extra.ts`) across `butter`/`cheby1`/`cheby2`/`ellip`.

Every coefficient set (cheby1, cheby2, butter high/bandpass/bandstop, ellip, bilinear, buttord)
verified against `scipy.signal` 1.17.1. Documented in `docs/reference/functions.md` under
Signal Processing → "Digital filter design & application".

### Added — FFT helpers (Phase 6 Task 1)

Added `functions/src/signal/fft-helpers.ts`, exported from `@danielsimonjr/mathts-functions`:

- `rfft(x)` / `irfft(spec, n)` — real FFT built on the package's own exported `fft`/`ifft`:
  `rfft` keeps the non-redundant first `floor(n/2)+1` bins of the full transform; `irfft`
  rebuilds the conjugate-symmetric length-`n` spectrum and inverse-FFTs it.
- `fftshift(x)` / `ifftshift(x)` — roll the zero-frequency component to center / undo it.
- `fftfreq(n[, d])` / `rfftfreq(n[, d])` — DFT sample frequencies for `fft`/`rfft` output.
- `fftn(x)` — 2-D FFT (FFT each row, then each column), delegating to the existing
  N-dimensional `fft`.

Pinned vs numpy (`numpy.fft.rfft([1,2,3,4])` → `re=[10,-2,-2]`, `im=[0,2,0]`;
`numpy.fft.fftfreq(4)` = `[0,0.25,-0.5,-0.25]`; `numpy.fft.rfftfreq(4)` = `[0,0.25,0.5]`;
`numpy.fft.fftshift([0,1,2,3])` = `[2,3,0,1]`). Documented in `docs/reference/functions.md`
under Signal Processing.

### Added — number-theory fills (Phase 5 Task 4)

Added `functions/src/numbertheory/extra.ts`, exported from `@danielsimonjr/mathts-functions`:

- `continuedFraction(x, maxTerms?)` — simple continued fraction expansion `[a0, a1, ...]`.
- `eulerNumbers(n)` — Euler numbers `E_0..E_n` via the standard secant-number recurrence.
- `stirlingS1(n, k)` — signed Stirling number of the first kind (DP recurrence), complementing
  the existing unsigned `stirlingS2`.
- `discreteLog(g, h, p)` — discrete logarithm via baby-step giant-step (`BigInt` modular
  exponentiation/inversion to avoid overflow).
- `primitiveRoot(p)` — smallest primitive root modulo a prime, via prime-factorization of `p-1`.
- `multiplicativeOrder(a, n)` — multiplicative order of `a` mod `n` (`-1` if `gcd(a,n) !== 1`).
- `kroneckerSymbol(a, n)` — Kronecker symbol, generalizing the existing `jacobiSymbol` to all
  integer `n` (even, negative, zero).
- `permutationsGen(arr, k?)` / `combinationsGen(arr, k)` — lexicographic tuple *enumerators*
  complementing the existing `permutations`/`combinations`, which only return counts.

Pinned vs sympy (`stirling(5,2,kind=1,signed=True)=-50`; `euler(6)=-61`;
`discrete_log(5,3,2)=3` i.e. `2^3≡3 mod 5`; `primitive_root(7)=3`; `n_order(2,7)=3`;
`jacobi_symbol(2,3)=-1`). Documented in `docs/reference/functions.md` under
Combinatorics & Number Theory.

### Added — Jacobi elliptic sn/cn/dn + Gauss–Legendre nodes/weights (Phase 5 Task 3)

Added `functions/src/special/jacobi-elliptic.ts` and `functions/src/numeric/gauss-nodes.ts`,
exported from `@danielsimonjr/mathts-functions`:

- `jacobiSN(u, m)` / `jacobiCN(u, m)` / `jacobiDN(u, m)` — the Jacobi elliptic functions
  (parameter convention `m = k²`, matching scipy/mpmath), the elliptic *functions* complementing
  the existing elliptic *integrals* (`ellipticK`/`ellipticF`/etc.). Computed via the descending
  Landen transformation / arithmetic-geometric mean (AGM) method (Abramowitz & Stegun 16.4), with
  closed-form fast paths at `m = 0` (circular functions) and `m = 1` (hyperbolic functions).
- `rootsLegendre(n)` — `n`-point Gauss–Legendre quadrature nodes and weights on `[-1, 1]`, found
  by Newton's method on the Legendre three-term recurrence from the standard asymptotic initial
  guess, for custom quadrature (complements the existing fixed-order `gaussQuad`).

Pinned vs mpmath/scipy (`jacobiSN/CN/DN(0.5, 0.3) = 0.4742156227 / 0.8804087364 / 0.9656789647`;
`rootsLegendre(3)` nodes `[-0.7745966692, 0, 0.7745966692]`, weights `[0.5555555556, 0.8888888889,
0.5555555556]`). Documented in `docs/reference/functions.md` under Special Functions
(`jacobiSN`/`CN`/`DN`) and Numerical Integration (`rootsLegendre`).

### Added — polygamma/trigamma + Jacobi/Gegenbauer orthogonal polynomials (Phase 5 Task 2)

Added `functions/src/special/polygamma-orthopoly.ts`, exported from `@danielsimonjr/mathts-functions`:

- `polygamma(n, x)` — the polygamma function `ψ^(n)(x)` (n-th derivative of digamma). `n === 0`
  delegates to the existing `digamma`; `n >= 1` shifts `x` upward via the standard digamma
  recurrence until it is large enough for the Bernoulli asymptotic expansion (DLMF 5.15.8, four
  terms) to converge to machine precision.
- `trigamma(x)` — the trigamma function `ψ'(x)`, equivalent to `polygamma(1, x)`.
- `jacobiP(n, alpha, beta, x)` — the Jacobi polynomial `P_n^(alpha,beta)(x)` via the standard
  stable three-term recurrence (DLMF 18.9.2).
- `gegenbauerC(n, alpha, x)` — the Gegenbauer (ultraspherical) polynomial `C_n^(alpha)(x)` via the
  standard stable three-term recurrence (DLMF 18.9.1), generalizing the existing
  `chebyshevT`/`hermiteH`/`laguerreL`/`legendreP` family.

Pinned vs mpmath/scipy (`polygamma(1,2) = trigamma(2) = 0.6449340668`, `polygamma(2,1) =
-2.4041138063`, `jacobiP(2,1,1,0.5) = 0.1875`, `gegenbauerC(2,1,1) = 3`); agrees with mpmath to
12+ significant digits and scipy's `eval_jacobi`/`eval_gegenbauer` exactly. Documented in
`docs/reference/functions.md` under Special Functions.

### Added — hypergeometric functions: `hyp0f1`/`hyp1f1`/`hyp2f1` + generic `pFq` (Phase 5 Task 1)

Added `functions/src/special/hypergeometric.ts`, exported from `@danielsimonjr/mathts-functions`:

- `hyp0f1(b, z)` — confluent hypergeometric limit function `0F1(; b; z)`, entire in `z`.
- `hyp1f1(a, b, z)` — Kummer's confluent hypergeometric function `1F1(a; b; z)` (Kummer's M),
  entire in `z` (ascending series targets moderate `|z|`; large `|z|` is not yet optimized).
- `hyp2f1(a, b, c, z)` — Gauss's hypergeometric function `2F1(a, b; c; z)`; the ascending series
  converges only for `|z| < 1` and throws otherwise (analytic continuation not yet implemented).
- `pFq(a[], b[], z)` — the generic generalized hypergeometric series engine (ascending
  Pochhammer-ratio method) that the three above delegate to.

These are the hypergeometric **master functions** from which Bessel, Legendre, the error
function, and the incomplete gamma/beta functions all derive as special cases. Pinned vs mpmath
(`hyp2f1(1,2,3,0.5) = 1.5451774445`, `hyp1f1(1,2,0.5) = 1.2974425414`, `hyp0f1(2,0.5) =
1.2717234563`). Documented in `docs/reference/functions.md` under Special Functions.

### Added — noncentral CDFs, circular statistics, McNemar/Cochran-Q (Phase 4 Task 4)

Added `functions/src/stats/inference-extra2.ts`, exported from `@danielsimonjr/mathts-functions`:

- `noncentralChi2CDF(x, df, nc)` / `noncentralFCDF(x, dfn, dfd, nc)` — Poisson-mixture series
  over the existing `chiSquaredCDF`/`fCDF`, truncated once the cumulative Poisson mass covers
  `1 − 1e-12`; matches `scipy.stats.ncx2.cdf`/`ncf.cdf` (pinned: `noncentralChi2CDF(10,3,2) =
  0.8985649635`, `noncentralFCDF(2,3,10,4) = 0.4663642160`).
- `noncentralTCDF(t, df, nc)` — Simpson-quadrature evaluation of the mixture representation
  `F(t) = E_V[Φ(t·sqrt(V/ν) − δ)]`, `V ~ χ²_ν`; matches `scipy.stats.nct.cdf` to ~3 digits
  (pinned: `noncentralTCDF(1.5,10,2) = 0.3047854474`).
- `circmean`/`circstd`/`circvar` — circular mean/std/variance via `atan2(Σsinθ, Σcosθ)` and the
  mean resultant length `R`; matches `scipy.stats.circmean`/`circstd`/`circvar` (pinned:
  `circmean([0.1,0.2,6.2]) = 0.0723638036`).
- `vonMisesPDF(theta, mu, kappa)` — von Mises (circular normal) PDF using the shared
  `besselIScalar` special-function primitive; matches `scipy.stats.vonmises.pdf` (pinned:
  `vonMisesPDF(0,0,2) = 0.5158854120`).
- `mcnemar(table[, opts])` — McNemar's test on a 2×2 paired table (continuity correction default
  on); matches `statsmodels` `mcnemar`.
- `cochranQ(data)` — Cochran's Q test (McNemar generalized to `k > 2` matched binary
  treatments); matches `statsmodels` `cochrans_q`.

Documented in `docs/reference/functions.md`: noncentral CDFs under Probability Distributions →
Standalone CDF/PDF/quantile surface, a new "Circular Statistics" subsection, and `mcnemar`/
`cochranQ` under Hypothesis Tests.

### Added — time-series inference: `pacf`, `ljungBox`, `durbinWatson`, `adfuller` (Phase 4 Task 3)

Added `functions/src/stats/timeseries.ts`, exported from `@danielsimonjr/mathts-functions`:

- `pacf(x, nlags)` — partial autocorrelation via the Levinson-Durbin recursion on the existing
  biased `acf`; matches `statsmodels.tsa.stattools.pacf(..., method='ldb')` (pinned:
  `[1,2,3,2,1,2,3,2,1,2,3,2]`, nlags=3 → `[1, 0, -0.8333..., 0]`).
- `ljungBox(x, lags)` — portmanteau test for residual autocorrelation, `Q =
  n(n+2)Σρ_k²/(n−k)`, `pValue = 1 − chiSquaredCDF(Q, lags)`; matches
  `statsmodels.stats.diagnostic.acorr_ljungbox` (pinned: `[1,2,1,2,...]` (n=10), lags=3 →
  `Q=28.8`).
- `durbinWatson(residuals)` — `Σ(eₜ−eₜ₋₁)²/Σeₜ²`; matches
  `statsmodels.stats.stattools.durbin_watson` exactly (verified: alternating `[1,-1,...]`,
  n=6 → `10/3`, **not** the textbook asymptotic "~4" bound, which only holds as n→∞).
- `adfuller(x[, maxlag])` — Augmented Dickey-Fuller unit-root test (constant-only model) via
  OLS of `Δxₜ` on `[1, xₜ₋₁, Δxₜ₋₁, …]` (reusing `ols`); default `maxlag =
  floor(12(n/100)^0.25)`, auto-clamped downward when the design is ill-posed (insufficient
  observations or a near-singular/NaN-producing fit). `pValue` uses a small built-in
  MacKinnon (1994)-style critical-value table with linear interpolation — an **approximate**
  p-value, documented as such (not the exact MacKinnon response-surface method).

Documented in `docs/reference/functions.md` under Statistics → new "Time-series inference"
subsection.

### Added — `kendallTauTest` (Phase 4 Task 2)

Added `kendallTauTest(x, y)` — Kendall's τ_b rank-correlation test returning `{ tau, pValue }`
(the p-value via the normal approximation `z = τ/√(2(2n+5)/(9n(n−1)))`). It delegates to the
pre-existing `kendalltau` (already implementing this exact formula, algebraically identical to
`z = 3τ√(n(n−1))/√(2(2n+5))`) and only renames `coefficient` → `tau` to match the `*Test`
result-object naming convention used by `mannWhitneyTest`/`kolmogorovSmirnovTest`/etc.

### Fixed — exact small-n Mann-Whitney p-value, now the default (Phase 4 Task 2b)

`mannWhitneyTest` now returns the **exact** small-sample Mann-Whitney U-distribution
two-sided p-value (the standard rank-sum null-distribution recurrence) whenever
`n1·n2 ≤ 400` and no ties are present — matching `scipy.stats.mannwhitneyu(...,
method='exact')` (pinned: `[1,2,3,4]` vs `[5,6,7,8]` → `p=0.02857142857142857`;
`[1,2,3]` vs `[4,5,6]` → `p=0.1`). This was materially wrong before: the prior default
(the normal approximation) put the second case's p in `(0.04, 0.055)`, ~2× off from the
true exact value. Falls back to the normal approximation for `n1·n2 > 400` or when ties
are present (matching scipy's own fallback). The one pinned oracle assertion this
supersedes (`functions/tests/gap-hypothesis-oracle.test.ts`) is updated to the exact value.

### Added — `kolmogorovSmirnov2Test` opt-in exact p-value (Phase 4 Task 2b)

`kolmogorovSmirnov2Test` gains an optional third argument `{ method?: 'auto' | 'exact' |
'asymp' }`. The default (`opts` omitted, or `'asymp'`) is byte-for-byte the prior
asymptotic `kstwobign` behavior — the pre-existing, deliberately-pinned oracle test
(`functions/tests/gap-stats-completeness.test.ts`) is untouched and stays green.
`'exact'` computes the exact lattice-path p-value (Kim & Jennrich 1970), matching
`scipy.stats.ks_2samp(..., method='exact')` (verified: n=5,5 → `p=0.873015873015873`;
n=8,8 → `p=0.6601398601398599`). `'auto'` picks exact for `n1·n2 ≤ 10000`.

### Added — `fitDistribution` MLE parameter fitting (Phase 4 Task 1)

Added `fitDistribution(name, data)` — maximum-likelihood parameter fitting for `'normal'` |
`'exponential'` | `'lognormal'` | `'poisson'` | `'gamma'`, returning `{ params, logLikelihood }`.
Normal/exponential/poisson use closed-form MLEs (population std, `1/mean`, `mean`); lognormal fits a
normal to `ln(data)` (throws if any value ≤ 0); gamma has no closed form for the shape parameter, so
it solves the 1-D shape equation `ln(k) − ψ(k) = ln(x̄) − mean(ln x)` (ψ = `digamma`) via the secant
method, starting from the Choi & Wette (1969) initial guess, then recovers `scale = x̄/k`. Verified
vs `scipy.stats.gamma.fit(d, floc=0)` on a 10-point sample: shape/scale matched to ~1e-13
(`6.42273918932...`, `0.29582393804...`).

### Added — `chi2Contingency` + `multipleTest` (Phase 3 Task 6)

Added `chi2Contingency(table, opts?)` — chi-square test of independence on a contingency table:
expected counts `E_ij = rowSum_i · colSum_j / total`, the Yates continuity correction
`(|O_ij − E_ij| − 0.5)²/E_ij` applied on 2×2 tables by default (`opts.correction !== false`,
matching scipy's default), `dof = (rows−1)(cols−1)`, `pValue = 1 − chiSquaredCDF(chi2, dof)`, and
Cramér's V `sqrt(chi2 / (total · min(rows−1, cols−1)))` as an effect-size companion. Pinned vs
`scipy.stats.chi2_contingency([[10,20],[30,40]], correction=False)`: chi2 = 0.7937, p = 0.373,
expected[0][0] = 12. Added `multipleTest(pValues, method)` — multiple-testing p-value adjustment
(`'bonferroni'` / `'holm'` step-down / `'bh'` Benjamini–Hochberg step-up FDR), returned in the
original input order; matches `statsmodels.stats.multitest.multipletests`.

### Added — `gaussianKDE` kernel density estimation (Phase 3 Task 5)

Added `gaussianKDE(samples, { bandwidth? })` — 1-D Gaussian kernel density estimation with
Silverman's rule-of-thumb default bandwidth (`h = 0.9 · min(σ, IQR/1.34) · n^(−1/5)`, falling back
to `0.9·σ·n^(−1/5)` when the IQR is 0, and throwing when σ is also 0); the first nonparametric
density estimator in the library. Returns `{ evaluate, bandwidth }`, where `evaluate(xs)` sums a
standard-normal bump per sample, scaled by the bandwidth. Pinned: a symmetric sample's estimated
density integrates to ~1 over a wide grid and peaks near the sample center, well above the tail.

### Added — `dbscan` clustering + `knnClassify`/`knnRegress` (Phase 3 Task 4)

Added `dbscan(points, eps, minPts)` — density-based clustering (DBSCAN): a point is a core point
if its ε-neighborhood (including itself) has at least `minPts` members; clusters grow by expanding
outward from core points, and points never reached are labeled noise (`-1`). ε-neighborhoods are
computed by brute-force Euclidean distance (O(n²) but correct) since the exported `kdTree` has no
radius-query method — a kd-tree range-search speedup is future work. Added `knnClassify(train,
labels, query, k)` — k-nearest-neighbour classifier by majority vote among the `k` closest training
points (Euclidean), ties broken by the single nearest point's label. Added `knnRegress(train,
targets, query, k)` — k-nearest-neighbour regressor (mean of the `k` closest training targets).
Pinned: two well-separated blobs plus a far outlier resolve to 2 clusters and the outlier labeled
noise; kNN assigns queries to the geometrically correct cluster.

### Added — `logisticRegression(X, y)` binary classifier via IRLS (Phase 3 Task 3)

Added `logisticRegression(X, y, opts?)` — binary logistic regression (`y ∈ {0,1}`) fit by
iteratively reweighted least squares (Newton-Raphson on the Bernoulli log-likelihood): each step
solves `(XᵀWX) Δ = Xᵀ(y - p)` for the Newton update, `W = diag(p(1-p))` (floored at `1e-9`), via
`linsolve`. Returns `{ coefficients, intercept, predict, predictProba }` — the first
classifier/GLM in the library. A small ridge term (`1e-8`) on `XᵀWX`'s diagonal keeps the solve
stable when predictors are exactly or near-collinear (a rank-deficient design would otherwise abort
IRLS on its first step), and the Newton step is capped at a max-norm of 25 to keep perfectly
separable data (where the unconstrained MLE diverges) from overshooting into NaN. Pinned: separable
1-D data gives a positive slope and `predictProba([[0]]) ≈ 0.5` at the symmetric boundary; a 2-D
collinear-but-separable case still classifies both sides correctly.

### Added — `ridge`/`lasso`/`elasticNet` regularized regression (Phase 3 Task 2)

Added `ridge(X, y, alpha, opts?)` — closed-form L2-penalized regression (`β = (XᵀX + αI)⁻¹Xᵀy` on
centered data). Added `lasso(X, y, alpha, opts?)` — L1-penalized regression via cyclic coordinate
descent with soft-thresholding on standardized columns, giving exact sparsity for large `alpha`.
Added `elasticNet(X, y, alpha, l1Ratio, opts?)` — combined L1/L2 via the same coordinate descent
(`l1Ratio` mixes lasso and ridge penalties). All three center X/y so the intercept is never
penalized, and recover `intercept = ȳ − x̄·β` on the original scale. Verified directionally vs
scikit-learn 1.8.0 (`Ridge`/`Lasso`): `alpha=0` recovers the OLS slope (`y=2x` -> `2.0`); large
`alpha` shrinks ridge toward 0 and drives lasso exactly to 0.

### Added — `ols(X, y)` multiple regression with inference (Phase 3 Task 1)

Added `ols(X, y, opts?)` — multiple/multivariate linear regression over a general design matrix
(rows = observations, cols = predictors), the general case `linearRegression` (single predictor)
didn't cover. Solves the normal equations `β = (XᵀX)⁻¹Xᵀy` (`opts.intercept` default `true` prepends
a column of ones) and returns full inference: `coefficients`, `stderr`, `tValues`/`pValues` (via
`studentTCDF`), `r2`/`adjR2`, the overall model `fStat`, and `residuals`. Pinned: exact fit
`y = 1 + 2·x1 + 3·x2` -> coefficients `[1, 2, 3]`, `r2 = 1`.

### Added — `linprog` two-phase simplex: equality constraints, bounds, status (Phase 2 Task 3)

`linprog` now accepts an options overload `linprog(c, { A_ub, b_ub, A_eq, b_eq, bounds })` returning
`{ x, fun, success, status }` — a two-phase simplex (Phase 1 artificial variables find a basic
feasible solution, handling equality constraints and negative-RHS rows; Phase 2 optimizes the real
objective) supporting equality constraints, per-variable `bounds` (default `[0, null]`), and
infeasible/unbounded detection (`status: 'optimal' | 'infeasible' | 'unbounded'`). The legacy
positional signature `linprog(c, A_ub, b_ub)` is unchanged. Pinned vs `scipy.optimize.linprog`:
`linprog([-1,-1], A_ub=[[1,1]], b_ub=[4], A_eq=[[1,-1]], b_eq=[1]) -> x=[2.5,1.5], fun=-4`; an
infeasible case (`x<=1` and `x>=3`); and a bounds-only case (`x∈[0,5]`, minimize `-x` -> `x=5`).

### Added — `nnls` + `lsqBounded` constrained least squares (Phase 2 Task 2)

Added `nnls(A, b, { tol?, maxIter? })` — Lawson–Hanson active-set non-negative least squares
(`min ||Ax - b||_2 s.t. x >= 0`), solving each restricted passive-set subproblem via the existing
`leastSquares`. Added `lsqBounded(A, b, lower, upper, { tol?, maxIter? })` — box-constrained least
squares via projected-gradient descent with backtracking. Both return `{ x, residual }`
(`residual = ||Ax - b||_2`). Pinned: `nnls(I, [3,-2]) -> [3,0]`, `nnls(I, [3,5]) -> [3,5]` (both
exact-recoverable cases), a 3x2 case checked against `scipy.optimize.nnls` (`[0.5, 0]`, matched
exactly), and `lsqBounded(I, [5,-3], [0,0], [2,2]) -> [2,0]`.

### Added — BFGS quasi-Newton minimizer (Phase 2 Task 1)

Added `bfgs(f, x0, { grad?, bounds? })` — BFGS quasi-Newton minimization with the classic
inverse-Hessian update (`H ← (I − ρ s yᵀ) H (I − ρ y sᵀ) + ρ s sᵀ`, skipped when `yᵀs ≤ 1e-12`) and
Armijo backtracking line search (`c1 = 1e-4`, starting step `α = 1`). Uses `opts.grad` if supplied,
else a local central-difference gradient; `opts.bounds` clips each accepted step into `[lo, hi]` per
coordinate (a lightweight projected BFGS, not the full active-set L-BFGS-B). The smooth-optimization
workhorse complementing derivative-free Nelder–Mead (`minimize`/`nelderMead`). Pinned: Rosenbrock
`[-1.2,1] -> [1,1]` (f~0), quadratics to exact minima, and a bounded case clipping to the box edge.

### Added — full `svd` + `orth` on the functions surface (Phase 1 Task 6)

The `matrix` package's full `svd(A) -> { U, S, V, rank }` was only reachable from `functions` through
its `singularValues`/`pinv` wrappers; re-exported it directly (`@danielsimonjr/mathts-matrix`'s `svd`
is synchronous, not async — verified against source before writing tests). Added `orth(A[, opts])` —
an orthonormal basis for the column space: computes `svd(A)`, takes the numerical rank `r` as the
count of singular values above `tol` (default `max(m, n) · S[0] · 2.22e-16`), and returns the leading
`r` columns of `U`. Handles the all-zero matrix (`r = 0` → an `m × 0` basis). Pinned:
`svd(diag(1,2,3)).S = [3,2,1]`; `orth` of a rank-2 3×3 matrix returns an orthonormal 3×2 `U` block.

### Added — adaptive Gauss-Kronrod quadrature: `quad` (Phase 1 Task 5)

Added `quad(f, a, b[, opts])` — QUADPACK-style adaptive Gauss-Kronrod (G7-K15) quadrature. On each
subinterval, a 15-point Kronrod estimate is compared against its embedded 7-point Gauss estimate
(both reuse the same 15 evaluation points); `|K − G|` is the panel's error estimate, and a panel
exceeding `tol · |K|` (default `tol = 1e-10`) is bisected and refined recursively (default
`maxDepth = 50`). Returns `{ value, error }`. G7-K15 node/weight constants sourced from QUADPACK's
`dqk15.f` (Piessens et al. 1983). Pinned against closed forms: `∫₀¹ 4/(1+x²) = π`,
`∫₀^π sin = 2`, `∫₋₁¹ 1/(1+25x²) = 0.4·atan(5)`.

### Fixed — `nintegrate` endpoint-singular accuracy

`nintegrate` now routes through the new adaptive `quad` (G7-K15) instead of its former fixed
5-point Gauss-Legendre panel with Richardson-extrapolation adaptivity. That scheme converged
slowly on endpoint singularities — `∫₀¹ x^-1/2 dx = 2` was off by ~1.7e-6 — because the error
estimate (Richardson difference between whole- and half-panel Gauss-Legendre) underestimated the
true error near a singular endpoint. G7-K15's embedded Kronrod/Gauss comparison resolves it
directly, to ~1e-10. `nintegrate`'s public signature and return type are unchanged.

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
