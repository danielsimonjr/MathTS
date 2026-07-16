# Oracle Gap Inventory & Wishlist — MathTS vs numpy / scipy / mpmath / MATLAB / Mathematica

**Date:** 2026-07-15
**Goal:** the best mathematical, scientific, and engineering computing & modeling library in TypeScript.
**Method:** the current MathTS surface (881 exports across 26 domains, mapped from
`docs/reference/functions.md` + the dependency graph) was diffed, domain by domain, against the
reference oracles — **numpy / scipy** (numerical), **mpmath** (arbitrary-precision special functions),
**MATLAB** (engineering toolboxes), **Mathematica/sympy** (symbolic/exact). Each domain was surveyed
by a dedicated pass: map what exists, enumerate the oracle-standard capability, then diff into
**functionality gaps** (missing capabilities) and **accuracy gaps** (exists but measurably less
accurate than the oracle). Accuracy claims are backed by live probes (relative error vs
mpmath dps=50 / scipy) — not recalled.

> This supersedes the earlier gap analyses in this folder for the numerical-accuracy and
> capability-breadth axes. Prior docs (`FUNCTION_GAPS*.md`, `DOMAIN_FUNCTION_GAP_ANALYSIS*`,
> `GAP_CLOSURE_PROPOSAL*`) covered mathjs-parity and package-bridge axes and are largely closed.

## Where MathTS already stands (verified this session)

The **reduction/statistics core** is at or beyond NumPy (measured against exact rationals):
`sum`/`mean`/`norm`/`fsum`/`dot`/`distance`/`cumsum`/`variance`/`std`/`corr` — all machine-precision,
several beating NumPy on overflow/underflow. The **special-function + distribution surface** is
overwhelmingly machine-precise vs mpmath/scipy (gamma/erf/digamma/elliptic/besselJ·I and every
distribution CDF/quantile even deep in the tails; `zeta` negative-args and `besselK` transition band
just fixed). The **ODE surface** is now solid: adaptive explicit RK23/RK45 + a new L-stable
Rosenbrock stiff method. This inventory is about what's still **missing** or **not yet best-in-class**.

---

## Priority legend

- **P0** — core numerical/modeling capability a top-tier library is expected to have; high user impact.
- **P1** — important breadth; common in scientific/engineering work.
- **P2** — valuable specialization or polish.
- Effort: **S** ≤ ~1 day · **M** ≈ 2–5 days · **L** ≈ 1–2 weeks (subagent-driven).

---

<!-- DOMAIN SECTIONS SYNTHESIZED FROM PARALLEL SURVEY AGENTS BELOW -->
<!-- Each probed the built dist against live oracles; measured errors are load-bearing. -->

## 1. Linear Algebra & Matrix

**Accuracy: none found.** Every dense routine probed against scipy on deliberately hard inputs
(Hilbert-6 cond≈1.5e7, Moler `expm`, complex spectra, rectangular `pinv`/`lstsq`, ill-conditioned
pencils) returned results at or near machine precision _scaled by conditioning_ — worst case
`lusolve` on Hilbert-6 was 1.7e-10 (correct-to-conditioning, not a defect). Complex eigenvalues,
`expm`, `sqrtm`/`logm` (pos-eig), `generalizedEig` all matched scipy to 1e-14–1e-15. The dense core
(`det inv pinv cond matrixRank nullspace`; decomps `lup qr cholesky schur hessenberg jordan
polar qz generalizedEig` + full `svd`/`eig`; solvers `lusolve linsolve leastSquares`; matrix funcs
`expm logm sqrtm matrixPower`; `sylvester lyap`; sparse CSC direct `slu csLu csChol csSpsolve`) is
broad and solid.

**One robustness caveat (not a measured error):** `generalizedEig(A,B)` is implemented as `eig(B⁻¹A)`
— for ill-conditioned non-diagonal `B` this is less accurate and does **not** route through the `qz`
primitive the library already ships. Harden by routing through `qz` + a symmetric-definite `eigh(A,B)`
path. **[P2/M]**

**Functionality gaps (ranked):**

| #   | Gap                                                                                                                           | Oracle                                | Effort             | Builds on                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------ | ------------------------------------------ |
| L1  | **Iterative Krylov solvers** `cg`/`gmres`/`bicgstab`/`minres` + preconditioners (Jacobi/ILU/IC)                               | `scipy.sparse.linalg`                 | L                  | SparseMatrix matvec + `norm2` (CG ≈40 LOC) |
| L2  | **Sparse/large-scale eigensolver** `eigs`/`eigsh` (k pairs, Lanczos/Arnoldi)                                                  | `scipy.sparse.linalg.eigs`            | L                  | `powerIteration` + sparse matvec           |
| L3  | **Complex matrix functions** `sqrtm`/`logm` on indefinite/complex spectra; `cosm`/`sinm`/`funm` (Schur–Parlett)               | `scipy.linalg.*m`                     | M                  | existing `schur` + core `Complex`          |
| L4  | **Full `svd(U,S,V)` on the public `functions` surface** (exists in matrix pkg, not re-exported) + truncated/randomized `svds` | numpy `svd`, `svds`                   | S / M              | re-export; randomized on `lowRankApprox`   |
| L5  | **NNLS + least-squares diagnostics** (rank/residual/rcond) + ridge                                                            | `scipy.optimize.nnls`, `lstsq`        | M                  | `leastSquares`, active-set                 |
| L6  | **LDLᵀ** (symmetric indefinite / KKT)                                                                                         | `scipy.linalg.ldl`                    | M                  | Cholesky/pivot infra                       |
| L7  | **Discrete Lyapunov + Riccati** `dlyap`/`care`/`dare` (LQR/Kalman)                                                            | `scipy.linalg.solve_*_are`            | M/L                | `schur`/`qz`                               |
| L8  | **Structured/banded solvers** `solve_banded`, tridiagonal Thomas, Toeplitz Levinson                                           | `scipy.linalg.solve_banded/_toeplitz` | M                  | existing `toeplitz`/`circulant`            |
| L9  | **Rank-revealing/thin QR** (pivoting, economic mode) + `rq`/`ql`/`lq`                                                         | `scipy.linalg.qr(...)`                | M                  | existing `qr`                              |
| L10 | `orth` (range basis), `khatriRao`, `blockdiag`/`hadamard`/Kronecker-sum, `condest` (Hager)                                    | `scipy.linalg.*`                      | S each (condest M) | `svd`, `kron`, `cond`                      |

## 2. Differential Equations, Integration & Interpolation

**Accuracy bugs:**

- **`stiffODESolver` — 71% error** on `y'=−15y` (fixed-step implicit Euler; effectively unusable).
  **Route to the new Rosenbrock `ode23s`** (already shipped) or deprecate. **[P0/S]**
- `nintegrate` singular integrand `∫x^(−1/2)` rel-err **1.7e-6** (vs adaptive `quad` 3e-15); oscillatory
  3.4e-9. Needs a singular/adaptive path. **[P1/M]**
- `solveODESystem` (fixed-step RK4) has no error control — silently inaccurate on stiff/rough RHS. **[P1]**

**Functionality gaps (ranked):**

| #   | Gap                                                                                                                                                                                           | Oracle                             | Effort | Builds on                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ | -------------------------- |
| D1  | **Numeric Jacobian of F:ℝⁿ→ℝᵐ** (`jacobian` currently symbolic-only, _throws_ on a numeric fn) — foundational for D2/D5/opt                                                                   | `scipy.optimize`/FD                | S      | FD + existing eval         |
| D2  | **Nonlinear system solver** `fsolve`/`root` (Newton/Broyden)                                                                                                                                  | `scipy.optimize.fsolve`            | M      | D1 + `linsolve`            |
| D3  | **Open scalar root-finders** `newton`/`halley`/`secant` (only bracketed Brent exists)                                                                                                         | `scipy.optimize.newton`            | S      | self-contained             |
| D4  | **Adaptive Gauss–Kronrod quadrature** (QUADPACK `quad`)                                                                                                                                       | `scipy.integrate.quad`             | M      | existing `gaussQuad` nodes |
| D5  | **ODE events + dense output** (`eventDetection` is an unwired stub)                                                                                                                           | `solve_ivp(events=,dense_output=)` | M      | shipped RK/Rosenbrock      |
| D6  | **Multi-dim quadrature** `dblquad`/`tplquad`                                                                                                                                                  | `scipy.integrate`                  | M      | D4                         |
| D7  | **BVP collocation** (`solveBVP` hardcoded n=2)                                                                                                                                                | `scipy.integrate.solve_bvp`        | M/L    | `linsolve`                 |
| D8  | **N-D gridded interpolation** `interpn`/`RegularGridInterpolator`                                                                                                                             | `scipy.interpolate`                | M      | existing 1-D interp        |
| D9  | **General PDE/MOL** (`solvePDE` is 1-D-heat-only)                                                                                                                                             | —                                  | L      | solveODE + Jacobian        |
| D10 | Improper/singular quadrature; BDF/Radau higher-order stiff; barycentric Lagrange + Akima (not exported); B-spline fitting; complex-step/Richardson diff; Monte-Carlo/QMC integration; DAE/DDE | scipy/mpmath                       | S–L    | mixed                      |

## 3. Statistics, Distributions & Hypothesis Tests

**Accuracy is not the problem** — distribution math is machine-precise (relerr ≤ ~5e-13) across ~25
families for CDF/PDF/quantile _including the less-audited ones_ (weibull, pareto, gumbel, rayleigh,
lognormal, inverse-Gaussian, cauchy, laplace, logistic; discrete binomial/poisson/negbinom/
hypergeometric), and quantile tails for t/χ²/F/gamma/beta. Parametric + rank tests (two-sample t,
ANOVA, Kruskal–Wallis, Wilcoxon, Friedman, Fisher exact, Bartlett, Levene, Anderson–Darling,
normaltest, Jarque–Bera, Spearman, Kendall τ) match scipy exactly.

> **Cross-cut with §6-A2:** the distribution CDFs are accurate because they use an _internal_ correct
> incomplete-beta path; the **public `betainc` export is separately broken** (NaN for integer/large
> a,b). Fixing `betainc` should route it to — or share — the distributions' working path.

**Accuracy bugs (all one root cause: asymptotic-only p-values, no exact small-n path — statistics are
correct, only p-values drift):**

- **A1 Mann–Whitney U p-value** (n₁=n₂=10): 2.85e-4 vs scipy exact **4.33e-5** (~6.6× too large; small-
  sample p materially wrong). Add exact permutation/recurrence. **[P1/M]**
- **A2 KS two-sample p-value** (D=0.8): 3.32e-3, matches _neither_ scipy exact (2.06e-3) nor its
  asymptotic (6.4e-4) — effective-n in the formula looks off. **[P1/M]**
- A3 KS one-sample: no Lilliefors correction when testing vs an _estimated_ normal (over-conservative);
  `kendallTau` returns coefficient but **no p-value**. **[P2/S]**

**Functionality gaps (the real story — breadth of inference; most M-effort on existing primitives):**

| #   | Gap                                                                                                                                                                                                                                                                                                                     | Oracle                     | Effort | Builds on                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------ | ----------------------------- |
| S1  | **Multiple/multivariate OLS with inference** (design matrix, coeff±stderr, t/p, R², CI) — `linearRegression` is 1-predictor only (= O4)                                                                                                                                                                                 | statsmodels OLS            | M      | matrix `qr`/`lusolve`/`pinv`  |
| S2  | **Distribution MLE fitting** `dist.fit(data)` — every `*Dist` has pdf/cdf/quantile/sample but no `.fit`                                                                                                                                                                                                                 | `scipy.stats.*.fit`        | M–L    | logpdf + `curvefit` minimizer |
| S3  | **Gaussian KDE** / density estimation                                                                                                                                                                                                                                                                                   | `scipy.stats.gaussian_kde` | M      | normalPDF + Silverman         |
| S4  | **χ² contingency test** (auto expected, Yates, Cramér's V) — `chiSquareTest` needs pre-computed expected                                                                                                                                                                                                                | `scipy.chi2_contingency`   | S–M    | existing χ² CDF               |
| S5  | **Multiple-testing correction** Bonferroni/Holm/Benjamini–Hochberg FDR                                                                                                                                                                                                                                                  | statsmodels multipletests  | S      | sort/scan                     |
| S6  | **Logistic regression / GLM** (= O7)                                                                                                                                                                                                                                                                                    | statsmodels GLM            | L      | IRLS on matrix solve          |
| S7  | **Time-series inference**: PACF (Levinson–Durbin on existing `acf`), Ljung–Box, Durbin–Watson, ADF                                                                                                                                                                                                                      | statsmodels                | M–L    | `acf`/regression              |
| S8  | Circular stats (circmean/std/var) + von Mises; multivariate-t/Dirichlet/Wishart + MVN sampling/logpdf/cdf; McNemar/Cochran-Q; power analysis; scale tests (Mood/Ansari/Fligner); jackknife/BCa bootstrap; weighted `choice`/`shuffle`; noncentral χ²/F/t CDF+quantile; Skellam/Zipf/Yule–Simon; winsorize/ECDF/describe | scipy/statsmodels          | S–L    | existing CDFs/Cholesky        |

## 4. Signal Processing & Transforms

**Accuracy / silent-correctness bugs (all shipped + reachable):**

- **A1 `windowFunction` silently returns rectangular** (all 1.0) for kaiser/tukey/gaussian/etc — the
  `default` case at `signal.ts:~1450` falls through to ones. Windows are silently wrong. **[P0/S]**
- **A2 `butter` ignores `btype`** — `'high'` returns a lowpass. **[P0/S]**
- **A3 `firwin` bandpass returns `[null,…]`.** **[P0/S]**
- A4 `welchPSD` normalization off; A5 `dct`/`dst` locked to type-II ortho. **[P1/S–M]**

**Functionality gaps:** `rfft`/`irfft`, `fftshift`/`fftfreq`, N-D `fftn`, DCT types 1/3/4; `idwt` +
wavelet families, `wavedec`/`waverec`, STFT/ISTFT, CWT; filter design — `butter` high/band fix,
`cheby1`/`cheby2`/`ellip`/`bessel`, `sosfilt` + zpk/sos conversions, `bilinear`, `firls`/`remez`,
`buttord`, `savgol`, `wiener`, `deconvolve`; `csd`/`coherence`; `resample_poly`/`decimate`/`upfirdn`;
`find_peaks`/`peak_widths`; missing window functions. Oracle: `scipy.signal`, `pywt`. Effort: S–L.

## 5. Optimization, Curve Fitting & ML

**Accuracy bug:**

- **A1 `linprog` returns INFEASIBLE "optima"** — `linprog([-1,-1],[[1,1]],[1])` → `x=[1,1]` (sum=2,
  violates the only constraint; scipy → `[1,0]`). Root cause (`numeric.ts:~2087`): the basic-variable
  extraction marks a column basic on unit-vector shape without a one-to-one row↔var map, so on a
  degenerate optimum two columns read the same RHS. **A wrong answer, worse than a missing feature —
  fix first.** Also structurally limited (only `Ax≤b, x≥0, b≥0`; no equality/bounds/status). **[P0/M]**
- A2 `gradientDescent` reports `converged:false` even when it reaches the optimum (misleading flag). **[P2]**

**Already present (do NOT re-scope):** `minimize`/`maximize` (Nelder–Mead), `globalMinimize`
(basin-hopping), `curvefit`/`levenbergMarquardt` (LM), `expfit`/`logfit`/`powerfit`, `leastSquares`
(linear), `linregress`/`linearRegression` (1-predictor OLS), **PCA**, `findRoot` (1-D), k-means,
spectral clustering, `kdTree`. All accurate on Rosenbrock/Himmelblau.

**Functionality gaps (ranked, all buildable on existing primitives):**

| #   | Gap                                                                                                                                                            | Oracle                    | Effort      | Builds on                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------- | ------------------------------------ |
| O1  | **BFGS / L-BFGS-B** quasi-Newton (bounded) — the default smooth-optimization workhorse                                                                         | `scipy.optimize.minimize` | M           | `gradientDescent` grad + line search |
| O2  | **Bounded/robust LS + NNLS** (TRF/dogbox, box-constrained `curve_fit`)                                                                                         | `least_squares`, `nnls`   | M           | extend `levenbergMarquardt`          |
| O3  | **Multivariate root systems** `fsolve`/`broyden` (= D2)                                                                                                        | `scipy.optimize.fsolve`   | M           | LM/Newton + `linsolve`               |
| O4  | **Multiple OLS with inference** (design matrix, coeff±stderr, R², p, CI)                                                                                       | `numpy.lstsq`+statsmodels | S–M         | `leastSquares` + `studentTCDF`       |
| O5  | **Ridge / Lasso / Elastic-Net**                                                                                                                                | sklearn linear_model      | M (ridge S) | `leastSquares`, coord descent        |
| O6  | **DBSCAN** + **kNN classifier/regressor** (kdTree already built)                                                                                               | sklearn                   | M / S       | existing `kdTree`                    |
| O7  | **Logistic regression** (IRLS)                                                                                                                                 | sklearn                   | M           | `gradientDescent`, `logisticCDF`     |
| O8  | **Constrained NLP** SLSQP/trust-constr/COBYLA (biggest structural hole)                                                                                        | scipy                     | L           | penalty/active-set atop O1           |
| O9  | **Proper `linprog` rewrite** (two-phase simplex, equality/bounds/status) — supersedes A1                                                                       | `linprog(highs)`          | M/L         | `linsolve`                           |
| O10 | Scalar `minimize_scalar` (Brent/golden); Powell/CG/Newton-CG; global DE/dual-annealing; MILP; GLM/GP regression; hierarchical/GMM/mean-shift clustering; t-SNE | scipy/sklearn             | S–L         | mixed                                |

## 6. Algebra, CAS & Special Functions & Number Theory

**Special-function accuracy is strong** — lambertW, fresnel, Si/Ci, Ei, li, erfi, digamma, besselI/K,
and the four orthogonal polys all match mpmath to <1e-14. But probes surfaced four concrete bugs:

- **A1 `taylor`/`series` garbage past order ~3** — `taylor('sin(x)','x',0,7)` gives `x −0.167x³
−1.2e-6x⁴ +0.0035x⁵ +5.78x⁶ +17209x⁷` (should be `x −x³/6 +x⁵/120 −x⁷/5040`). Uses numerical finite
  differences; the documented `taylor('exp(x)')='…x^4/24'` example is **false**. **Rewire onto the
  `autograd` forward-mode `DualTensor`** (exact higher derivatives). **[P0/M]**
- **A2 `betainc` returns NaN** for essentially all integer/large `a,b` (`betainc(0.5,2,3)`→NaN vs
  0.6875) — it's the documented building block of Beta/t/F/χ² CDFs. Fix the continued fraction
  (Lentz + symmetry). **[P0/S]**
- **A3 `invmod` throws** `_BigNumber cannot be invoked without 'new'`. **[P0/S]**
- **A4 `lambertW(x,branch)` branch arg unsupported** despite docs — W₋₁ unreachable. **[P0/S]**

**CAS honesty gap — documented (with worked examples) but NON-FUNCTIONAL (return input unchanged):**
`factor`/`casFactor` (doc claims `(x-1)(x+1)`), `expand`/`casExpand`, `apart`, `together`, symbolic
integration beyond power-rule (by-parts/partial-frac/u-sub all absent), `simplify` cancellation,
symbolic summation with symbolic bound (`summation('k','k',1,'n')`→**0**, should be `n(n+1)/2`).
**Reconcile docs with reality first (honesty), then implement.** Effort M–L. (`casSimplify('x+x')=2*x`,
`collect`, `solve`, `groebnerBasis`, `resultant`, `limit`, definite-poly `integrate` **do** work.)

**Missing special functions (ranked, all buildable on gamma/Pochhammer/bessel/elliptic infra):**
`pFq` **hypergeometric** (₀F₁/₁F₁/₂F₁ — the master functions, highest leverage, M); `polygamma`/`trigamma`
(S–M); Jacobi elliptic sn/cn/dn + theta (M); polylog/Lerch (M); Struve/Kelvin (M); Barnes-G (M); Jacobi/
Gegenbauer orthogonal polys (S); Gauss-quadrature nodes/weights via Golub–Welsch (M); Coulomb/Mathieu/
parabolic-cylinder (L). **Number theory fills** (cheap, high completeness/hour): `continuedFraction`,
Euler numbers, `stirlingS1`, `discreteLog`, `primitiveRoot`/`multiplicativeOrder`, Kronecker symbol,
permutation/combination **generators** (only counts exist today). Effort S each. Also `nsolve`,
`radsimp`/`trigsimp`, symbolic `dsolve` (L).

## 7. Geometry, Graph Theory & Misc

**Accuracy: kernels are solid** — `convexHull`/`kdTreeNearest`/`pageRank`/`delaunay`/constants all match
scipy/networkx to floating point. Two semantic issues:

- **A8 `adjacencyMatrix` always symmetrizes** — no way to build a _directed_ graph from an edge list
  (the centrality/pageRank kernels honor asymmetric matrices when hand-built, so it's a constructor
  gap). **[P1/M]**
- A6 `betweennessCentrality` returns **un-normalized** raw counts (exactly 2× networkx default on a
  path graph); add a `normalized` option. **[P2/S]** · A7 constants are CODATA-2018 (one cycle behind
  scipy's 2022). **[P2]**

**Functionality gaps:**

- **Graph (largest gap vs networkx — ~10 fns vs hundreds):** directed constructor + BFS/DFS traversal
  (S, foundational); Floyd–Warshall all-pairs + Bellman–Ford (S–M); closeness/harmonic/Katz centrality
  (S); max-flow/min-cut (M); A\* (S); bipartite matching/Hungarian assignment (M); graph coloring/clique/
  Louvain community (M–L); isomorphism (L); incidence matrix + adjacency spectrum (S).
- **Computational geometry (vs scipy.spatial):** boundingBox/AABB/oriented (S); procrustes (S–M, has SVD);
  SphericalVoronoi (M); halfspace intersection (M); alpha shapes (M, has delaunay); kdTree k-NN + radius
  query (S, only single-nearest exposed); 3-D line/ray intersections (M).
- **Quaternion:** `quaternionSlerp` (S — vector slerp exists but not quaternion), `quaternionInverse` (S),
  quaternion↔Euler (S–M, robotics), exp/log/pow (M).
- **Sets:** `setIsSuperset`/`setEqual`/`setDisjoint` (S, trivial complements).
- **Cross-cutting — Interval arithmetic** (`Interval` type + rounded-bound add/mul; absent entirely;
  oracle mpmath.iv / INTLAB). **[M–L, new leaf type on core]**

---

## Ranked master wishlist & phased plan

Two organizing principles: **(1) a wrong answer is worse than a missing feature** — the P0
correctness bugs ship first; **(2) build foundations before breadth** — a handful of primitives
(numeric Jacobian, hypergeometric `pFq`, design-matrix OLS, a fixed `betainc`) each unlock a whole
family of downstream features, so they precede the features that consume them. Effort: **S** ≤ ~1 day ·
**M** ≈ 2–5 days · **L** ≈ 1–2 weeks (subagent-driven). Each phase is a coherent, independently
shippable release; execution checks in at phase boundaries.

### Phase 0 — Correctness & honesty (P0) — ✅ RELEASED `functions@0.28.0` (2026-07-15)

**Shipped** (9 tasks, subagent-driven, oracle-pinned, verified in the published tarball): `invmod`,
`lambertW` W₋₁, `windowFunction`, `stiffODESolver`→`rosenbrockSolve`, `summation`/`symbolicProduct`,
`taylor`/`series`/`seriesCoefficient` (Cauchy integral), `linprog` feasibility, `betainc` doc order,
CAS pass-through annotations. Patch cascade to compat/statistics/plot/signal/arithmetic/trigonometry.
Follow-up logged: `cancel`/`rationalize`/`simplify` are also pass-through (doc-honesty pass, TODO).

These were the highest priority: every item is a function that ships today, is documented (several with
_worked examples that are false_), and returns a wrong answer, `NaN`, or throws. Mostly S/M; ship as
patch/minor releases per package.

| Bug                                                        | Domain | Symptom                                                                      | Fix                                                                           | Effort   |
| ---------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------- |
| `linprog` infeasible optima                                | Opt A1 | returns points outside the feasible region                                   | one-to-one row↔basic-var map (or fold into Phase 2 rewrite)                   | M        |
| `taylor`/`series` garbage past order ~3                    | Alg A1 | `sin` x⁷ coeff off by 10⁷×; doc example false                                | rewire onto `autograd` forward-mode exact derivatives                         | M        |
| `betainc` → NaN                                            | Alg A2 | broken for integer/large a,b; it's the documented Beta/t/F/χ² building block | fix CF (Lentz + symmetry) / route to the distributions' working internal path | S        |
| `invmod` throws                                            | Alg A3 | `_BigNumber cannot be invoked without 'new'`                                 | fix constructor call site                                                     | S        |
| `lambertW(x,branch)`                                       | Alg A4 | W₋₁ branch unreachable despite docs                                          | add branch param + lower-branch Halley                                        | S        |
| `stiffODESolver` 71% error                                 | ODE    | fixed-step implicit Euler unusable                                           | route to shipped Rosenbrock `ode23s` / deprecate                              | S        |
| `windowFunction` silent rectangular                        | Sig A1 | kaiser/tukey/gaussian/… all return ones                                      | implement the window formulas; throw on unknown                               | S        |
| `butter` ignores `btype`                                   | Sig A2 | `'high'` returns lowpass                                                     | honor btype (high/band/stop)                                                  | S        |
| `firwin` bandpass → `[null,…]`                             | Sig A3 | bandpass FIR broken                                                          | fix multiband coefficient path                                                | S        |
| symbolic `summation` with symbolic bound → 0               | Alg    | `summation('k','k',1,'n')`→0 (want `n(n+1)/2`)                               | closed-form (Faulhaber) path                                                  | M        |
| CAS `expand`/`factor`/`apart`/`together`/symbolic-∫ no-ops | Alg    | return input unchanged, but docs show worked results                         | **reconcile docs to reality now** (honesty); implementation is Phase 8        | S (docs) |

> **Live re-verification (2026-07-15) corrected three of the survey's P0 entries** before planning
> (RFL Rule 4 — a `NaN`/error result is not proof of a bug):
>
> - **`betainc` is NOT broken.** Its signature is `(a, b, x)` (scipy order) and it is machine-precise
>   (`betainc(2,3,0.5)=0.6875` = mpmath). The survey called `betainc(0.5,2,3)` with x=3 out of range.
>   The real defect is a **doc error** — `functions.md` says `betainc(x, a, b)`. Downgraded to a doc fix.
> - **`butter` and `firwin` are NOT bugs.** Both are documented lowpass/scalar-only (`butter(N,Wn)` has
>   no `btype` param; `firwin(numtaps, cutoff)` takes a scalar cutoff). Highpass/bandpass are missing
>   **features → Phase 6**, not correctness bugs. `windowFunction`'s silent-rectangular fallback is the
>   one real signal P0 (fix: throw on unknown type; the missing windows are Phase 6).
> - **`taylor` fix uses the in-package symbolic `derivative`, not `autograd`** — `functions` has no
>   `autograd` dependency and adding one is ADR-level; exact derivatives are already available in-package.
>
> Detailed, oracle-pinned plan: [`docs/superpowers/plans/2026-07-15-phase0-correctness-fixes.md`](../superpowers/plans/2026-07-15-phase0-correctness-fixes.md) (9 tasks).

### Phase 1 — Foundational numeric primitives — ✅ RELEASED `functions@0.29.0` (2026-07-15)

Shipped (6 tasks, oracle-pinned, verified in tarball): `numericJacobian` + polymorphic `jacobian`,
`newton`/`secant`/`halley`, `fsolve`/`root`, `minimizeScalar` (Brent), adaptive Gauss–Kronrod `quad`
(+ `nintegrate` singular fix), full `svd` + `orth` exposed.

_(original scope below)_

`jacobian` numeric F:ℝⁿ→ℝᵐ (D1, S) · open scalar root-finders newton/secant/halley (D3, S) · nonlinear
system solver `fsolve`/`root` (D2/O3, M) · scalar `minimize_scalar` Brent/golden (O5, S) · adaptive
Gauss–Kronrod `quad` + singular path fixing `nintegrate` (D4, M) · expose full `svd(U,S,V)` +`orth` on
the `functions` surface (L4/L10, S). **Effort ≈ M total.**

### Phase 2 — Optimization core — ✅ RELEASED `functions@0.30.0` (2026-07-16)

Shipped: `bfgs` (quasi-Newton + optional bounds), `nnls` + `lsqBounded`, `linprog` two-phase overload
(equality/bounds/status; legacy signature preserved). Oracle-pinned vs scipy, tarball-verified.

_(original scope below)_

BFGS / L-BFGS-B quasi-Newton (O1, M) · bounded/robust LS + NNLS (O2/L5, M) · proper `linprog` two-phase
simplex with equality/bounds/status, superseding the Phase-0 patch (O9, M/L). **≈ L.**

### Phase 3 — Regression & ML breadth — ✅ RELEASED `functions@0.31.0` (2026-07-16)

Shipped: `ols` (+ inference), `ridge`/`lasso`/`elasticNet`, `logisticRegression` (IRLS), `dbscan` +
`knnClassify`/`knnRegress`, `gaussianKDE`, `chi2Contingency` + `multipleTest`. Oracle-pinned vs
sklearn/scipy/statsmodels, tarball-verified.

_(original scope below)_

Multiple/multivariate OLS with inference (O4/S1, M) · ridge/lasso/elastic-net (O5/S8, M) · logistic
regression / GLM IRLS (O7/S6, M–L) · DBSCAN + kNN classifier (O6, kdTree ready, M/S) · Gaussian KDE
(S3, M) · χ² contingency test (S4, S–M) · multiple-testing correction (S5, S). **≈ L.**

### Phase 4 — Statistics inference — ✅ RELEASED `functions@0.32.0` (2026-07-16)

Shipped: `fitDistribution` (MLE), exact MW p-values (default) + KS exact opt-in + `kendallTauTest`,
`pacf`/`ljungBox`/`durbinWatson`/`adfuller`, noncentral CDFs, circular stats, `mcnemar`/`cochranQ`.
Oracle-pinned vs scipy/statsmodels, tarball-verified.

_(original scope below)_

Distribution MLE `.fit(data)` across the family set (S2, M–L) · exact small-n p-values for Mann–Whitney
(A1) + KS-2samp (A2) + Kendall τ p-value (M) · time-series inference PACF/Ljung–Box/Durbin–Watson/ADF
(S7, M–L) · noncentral χ²/F/t CDF+quantile, circular stats + von Mises, McNemar/Cochran-Q (S8, S–M each).
**≈ L.**

### Phase 5 — Special functions & number theory

**`pFq` hypergeometric** ₀F₁/₁F₁/₂F₁ (highest leverage — Bessel/Legendre/erf/incomplete-γβ are special
cases, M) · `polygamma`/`trigamma` (S–M) · Jacobi elliptic sn/cn/dn + theta (M) · Gauss-quadrature
nodes/weights via Golub–Welsch (M) · Jacobi/Gegenbauer orthogonal polys (S) · polylog/Lerch, Struve/
Kelvin, Barnes-G (M each) · number-theory fills `continuedFraction`/Euler-numbers/`stirlingS1`/
`discreteLog`/`primitiveRoot`/Kronecker/permutation-combination **generators** (S each). **≈ L.**

### Phase 6 — Signal processing breadth

`rfft`/`irfft`/`fftshift`/`fftfreq`/`fftn` · DCT types 1/3/4 · filter design cheby1/cheby2/ellip/bessel

- `sosfilt` + zpk/sos + `bilinear`/`buttord`/`firls`/`remez` · `savgol`/`wiener`/`deconvolve` · wavelets
  `idwt`+families/`wavedec`/`waverec`/CWT/STFT · `csd`/`coherence`/`find_peaks`/`peak_widths`/`resample`.
  Oracle scipy.signal + pywt. **≈ L.**

### Phase 7 — Advanced linear algebra & large-scale numerics

Iterative Krylov `cg`/`gmres`/`bicgstab`/`minres` + preconditioners (L1, L) · sparse eigensolver
`eigs`/`eigsh` Lanczos/Arnoldi (L2, L) · complex matrix functions Schur–Parlett `sqrtm`/`logm`/`cosm`/
`sinm`/`funm` (L3, M) · LDLᵀ (L6, M) · discrete-Lyapunov + Riccati care/dare (L7, M/L) · banded/
tridiagonal/Toeplitz structured solvers (L8, M) · rank-revealing/economic QR + rq/ql/lq (L9, M) ·
`generalizedEig` via qz hardening (M). **≈ L–XL.**

### Phase 8 — Graph, geometry, symbolic CAS engine, BVP/PDE, intervals

**Graph:** directed constructor + BFS/DFS, Floyd–Warshall/Bellman–Ford, closeness/harmonic/Katz,
max-flow/min-cut, A\*, Hungarian, coloring/clique/Louvain (M–L). **Geometry:** quaternion slerp/inverse/
Euler, boundingBox, procrustes, kdTree k-NN + radius, alpha shapes, 3-D intersections (S–M). **Numerics:**
N-D interpolation `interpn` (D8, M), BVP collocation (D7, M/L), general PDE/MOL (D9, L). **CAS engine:**
real `expand`/`factor`/`apart`/`together` + by-parts/partial-frac/u-sub integration (L). **Interval
arithmetic** leaf type (M–L). **Sets:** superset/equal/disjoint (S). **≈ XL.**

---

## Execution note

Per the standing directive (comprehensive scope, autonomous per-phase execution), Phase 0 is planned in
detail and executed first via `superpowers:writing-plans` → `subagent-driven-development`, shipping the
correctness fixes as releases, then checking in at the phase boundary before Phase 1. Each subsequent
phase gets its own detailed plan doc under `docs/superpowers/plans/` when reached — writing all eight in
advance would produce stale plans. Every function added or fixed is oracle-pinned (mpmath/scipy/numpy,
all installed) with implementation-independent references, never round-trips.
