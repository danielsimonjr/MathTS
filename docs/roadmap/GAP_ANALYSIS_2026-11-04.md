# MathTS Gap Analysis — 2026-11-04

> **Status:** SHIPPED — every item of the §4 work list landed in functions@0.72.0 (PR #590, squash `b8d55ee`; review fixes in the same PR), and the reference docs plus the landing site followed in PR #592 (`f4ab636`). The text below is the original planner report, kept as the record of what was verified missing on 2026-11-04. Planner report for the
> Planner/Builder/Challenger/Checker/Fixer team. Every "missing" claim below was
> grep-verified against the live source tree on 2026-11-04 (HEAD `ccb51a6`,
> `functions@0.71.0`). Estimates are marked as estimates. Oracle values are either
> closed forms or well-known tabulated values; the few that the Planner could not
> derive in closed form are flagged `VERIFY` and must be pinned against the named
> reference library before the test is committed.

---

## 1. Method and sources

**Reference surfaces compared against** (from the Planner's knowledge of each
library's public API — no network access was used):

- `scipy` — `special`, `stats`, `signal`, `linalg`, `optimize`, `integrate`,
  `interpolate`, `spatial`.
- `numpy` — `np.*`, `np.linalg`, `np.fft`, `np.polynomial`.
- `sympy` — `ntheory`, `combinatorics`, `functions.special`, `matrices.normalforms`,
  `polys` (Sturm/real roots), `solvers`.
- `mathjs` — the full canonical function list (v14).
- MATLAB — core + Signal Processing / Statistics / Optimization toolboxes (names only).

**What was compared.** The live export surface, not the docs:

| Package      | Source of truth read                                                       | Public identifiers (counted from the generated "Complete export index")                                                |
| ------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `functions`  | `functions/src/index.ts` (720 lines) + `typed/index.ts` + 12 typed barrels | **1,121** backticked identifiers in `docs/reference/functions.md` (header says 1,090 exports + constants/type helpers) |
| `core`       | `core/src/index.ts`                                                        | 145                                                                                                                    |
| `matrix`     | `matrix/src/index.ts`, `matrix/src/operations/index.ts`                    | 149                                                                                                                    |
| `expression` | `expression/src/index.ts`                                                  | 76                                                                                                                     |
| `compat`     | `compat/src/index.ts`                                                      | 78                                                                                                                     |
| `workbook`   | `workbook/src/index.ts`                                                    | 28                                                                                                                     |
| `plot`       | `plot/src/index.ts`                                                        | 18                                                                                                                     |
| `tensor`     | `tensor/src/index.ts` + `Tensor.ts` method list                            | 27 exports; `Tensor` has 30 methods                                                                                    |
| `autograd`   | `autograd/src/index.ts` + `tape.ts`/`dual-tensor.ts` method lists          | 9 exports; `TapedTensor` 50 methods, `DualTensor` 35                                                                   |

**How absence was verified.** A candidate list of **579** names (the union of the
reference surfaces minus what the prior audits already closed) was run through two
greps over `functions/src core/src matrix/src tensor/src autograd/src expression/src
plot/src workbook/src compat/src`:

1. exact export: `export (async )?(function|const|class|let) NAME` or `export { … NAME … }`;
2. case-insensitive stem search (e.g. `erfinv|erfInv|inverseErf|invErf`,
   `lombscargle|lomb`, `winsor`, `hausdorff|frechet`) to catch alternate names.

**565 of 579** had no export; the 14 hits (`lq/rq/ql` in matrix, `gather/pad/stack`
in tensor, `sinc` in `signal-filter-extra.ts`, `householder` in matrix, `luSolve`, …)
were removed from the gap list. Every stem hit was opened and classified (e.g. the 10
"lomb" files were all `coulomb*`; "faddeeva" is a `TODO` comment in `special/erf.ts:75`;
`bareiss` is an internal det routine; `modPow` is a private helper inside
`utils/isPrime.ts:117`; `sphericalTriangleArea` is a private helper in
`geometry/spherical-voronoi.ts:59`; `blockDiag` is private in `matrix/eigs/complexEigs.ts:709`).

**Prior audits read** (so nothing already shipped is re-proposed): `FUNCTION_GAPS.md`,
`FUNCTION_GAPS_AUDIT.md`, `DOMAIN_FUNCTION_GAP_ANALYSIS_2026-06-30.md`,
`STATISTICS_GAP_AUDIT_2026-07-06.md`, `GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md`,
`SCIENTIFIC_LIBRARY_ROADMAP_2026-07-02.md`, `GAP_CLOSURE_PROPOSAL*.md`,
`ORACLE_GAP_INVENTORY_2026-07-15.md`, `ROADMAP.md`, `TODO.md` (2 open items, both infra).

**Deferred items from those audits — re-checked today:**

| Deferred in                  | Item                                                                                                                                                                                                                                                                                                                                                             | Status today                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DOMAIN_…_2026-06-30          | `tukeyHSD` (needed studentized range)                                                                                                                                                                                                                                                                                                                            | **SHIPPED** — `studentizedRangeCDF/Quantile`, `tukeyHSD` in `hypothesis-extra.ts`                                                                      |
| STATISTICS_GAP_AUDIT §P3     | full GLM                                                                                                                                                                                                                                                                                                                                                         | **SHIPPED** — `ml/glm.ts` (Poisson/Gamma)                                                                                                              |
| STATISTICS_GAP_AUDIT §P3     | ridge/lasso                                                                                                                                                                                                                                                                                                                                                      | **SHIPPED** — `ml/regularized-regression.ts`                                                                                                           |
| STATISTICS_GAP_AUDIT §P3     | circular stats, von Mises PDF, noncentral t/F/χ²                                                                                                                                                                                                                                                                                                                 | **SHIPPED** — `stats/inference-extra2.ts`                                                                                                              |
| STATISTICS_GAP_AUDIT §P3     | Dirichlet, Wishart                                                                                                                                                                                                                                                                                                                                               | **SHIPPED** — `stats/multivariate-sampling.ts`                                                                                                         |
| STATISTICS_GAP_AUDIT §P3     | robust regression (Theil–Sen/Siegel/Huber), jackknife, pmean, gstd/gzscore, kstat, differential entropy, distance correlation, Nakagami/Rice, Zipf/logser/Skellam, multivariate-t, Ansari/Mood/Brunner–Munzel, G-test, Welch ANOVA, Dunnett/Games–Howell, MANOVA, canonical correlation, covariance shrinkage, skew-normal, truncated normal, GEV, inverse-gamma | **STILL OPEN** (all verified absent) — see §3.1                                                                                                        |
| ORACLE_GAP_INVENTORY Phase 5 | polylog/Lerch/Struve/Kelvin ber,bei/Barnes-G/Coulomb/Mathieu/Riemann–Siegel                                                                                                                                                                                                                                                                                      | **SHIPPED** (`special/niche.ts`, `wave-functions.ts`, `mathieu.ts`); **Kelvin ker/kei still absent**                                                   |
| ORACLE_GAP_INVENTORY Phase 6 | DCT types 1/3/4, Bessel filter                                                                                                                                                                                                                                                                                                                                   | **STILL OPEN** — `dct` is Type-II only (`typed/signal.ts:578`); no `besself`                                                                           |
| ORACLE_GAP_INVENTORY Phase 7 | rank-revealing QR, rq/ql/lq                                                                                                                                                                                                                                                                                                                                      | **SHIPPED in `matrix`** (`qrPivoted`, `lq/rq/ql` in `matrix/src/operations/qr-family.ts`) but **not re-exported from `functions`** (re-export gap, §5) |
| FUNCTION_GAPS §G4a           | `TapedTensor.pow(taped, taped)`                                                                                                                                                                                                                                                                                                                                  | **SHIPPED** — `autograd/src/tape.ts:1001` accepts `number \| TapedTensor`                                                                              |
| FUNCTION_GAPS §G5            | Workbook GUI / hard timeout / exports                                                                                                                                                                                                                                                                                                                            | `runWorkbookWithTimeout` + `WorkbookTimeoutError` **SHIPPED**; GUI/PDF/ipynb export still open (not code-gap scope here)                               |

**mathjs parity.** Diffing the canonical mathjs list against the `functions` index
leaves only `compile` (MathTS exports it as `compileExpr`), `import` (exists in
`compat`, 6 references) and `typed` (exposed as `mathTyped` from `core`). mathjs
parity is effectively complete; nothing below is a mathjs gap.

---

## 2. Current-state snapshot

Strong domains (dense, oracle-pinned, nothing material missing): arithmetic/elementary
functions with typed dispatch across number/bigint/Complex/Fraction/BigNumber/Unit/Dual;
distributions (22 distribution objects + 20 standalone CDF/quantiles + noncentral);
hypothesis tests (≈35); regression/ML (`ols`, ridge/lasso/elastic-net, logistic, GLM, GP,
KDE, kmeans/dbscan/knn/spectral); linear algebra (dense decompositions, Krylov, Lanczos,
structured solvers, matrix functions, Riccati/Lyapunov); signal (FFT family, IIR/FIR
design, wavelets, STFT, peaks); ODE/DAE/DDE/BVP/PDE; symbolic CAS (expand/factor/apart/
Gröbner/limits/series/Laplace); graph (traversal, flows, Hungarian, Louvain, coloring);
computational geometry (hulls, Delaunay, Voronoi, alpha shapes, halfspaces, kd-tree);
number theory basics; special functions (Bessel/Airy/elliptic/hypergeometric/polygamma/
Mathieu/spheroidal/Coulomb); quaternions; intervals; units; physical constants.

What is genuinely thin (verified): **robust/weighted/effect-size statistics**, the
**specialist distribution tail**, **inverse/scaled error functions and spherical
Bessel/Hankel**, **angular-momentum coupling** (Wigner/CG), **global and constrained
optimizers**, **Gauss–Hermite/Laguerre/Chebyshev nodes and tanh-sinh/nested quadrature**,
**integer normal forms (HNF/SNF/LLL)**, **real-root isolation (Sturm)**, **special
matrices** (Hilbert/Hadamard/Pascal/DFT/Hankel/block-diag/Khatri–Rao), **signal
generators + window family + Lomb–Scargle + system response**, **polygon algorithms**
(clipping, simplification, Hausdorff/Fréchet, ear-clipping, min-enclosing circle),
and the long tail of **number-theory sequences and Diophantine solvers**. Tensor/autograd
lack index-returning reductions and shape ops on the tape.

---

## 3. Gap catalogue by domain

Columns: **Ref** = reference equivalent · **Pri** · **LOC** (estimate) · **Where** (package/file)
· **Reuse** (actual existing symbols/files) · **Oracle** · **Risk**.

### 3.1 Statistics

| #   | Gap                                                                                             | Ref                                                                                                                                                                     | Pri | LOC | Where                                      | Reuse                                                                                                                                                                                                                                                          | Oracle                                                                                                               | Risk                                            |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| S1  | `weightedMean/weightedVariance/weightedMedian/weightedQuantile`                                 | `np.average(weights=)`, MATLAB `wmean`; no `weights` option exists anywhere (grep `weights` in `typed/arithmetic.ts`, `factories/index.ts`, `descriptive-stats.ts` = 0) | P1  | 120 | `functions/src/stats/weighted-stats.ts`    | `Vec`/`arr` pattern from `hypothesis-extra.ts:15-16`                                                                                                                                                                                                           | `weightedMean([1,2,3,4],[1,1,1,5]) = 3.25`; `weightedMedian([1,2,3,4,5],[1,1,1,1,10]) = 5`                           | define frequency vs reliability weights clearly |
| S2  | `pmean(x,p)`, `gstd`, `gzscore`                                                                 | `scipy.stats.pmean/gstd/gzscore`                                                                                                                                        | P2  | 60  | same file as S1 or `stats/robust-stats.ts` | `gmean`, `hmean` (`descriptive-stats.ts`), `std` (`typed/arithmetic.ts`)                                                                                                                                                                                       | `pmean([1,2,4],2)=√7=2.6457513110645907`; `pmean([1,4],-1)=1.6`; `gstd([1,2,4])=2`; `gzscore([1,2,4])=[-1,0,1]`      | ddof convention (scipy gstd ddof=1)             |
| S3  | `theilSen(x,y)`, `siegelSlopes`                                                                 | `scipy.stats.theilslopes/siegelslopes`, MATLAB `robustfit`                                                                                                              | P1  | 90  | `stats/robust-stats.ts`                    | `median` (`typed/arithmetic.ts`)                                                                                                                                                                                                                               | x=[0..4], y=[1,3,5,7,100] → slope 2, intercept 1                                                                     | O(n²) pairs; document                           |
| S4  | `kstat(x,n)`, `kstatvar`                                                                        | `scipy.stats.kstat`                                                                                                                                                     | P3  | 50  | `stats/robust-stats.ts`                    | `moment` (`descriptive-stats.ts`)                                                                                                                                                                                                                              | [1,2,3,4,5]: k1=3, k2=2.5, k3=0, k4=−7.5 `VERIFY k4 vs scipy`                                                        | formula transcription                           |
| S5  | `winsorize`, `sigmaClip`, `boxCox(x,λ)`, `yeoJohnson(x,λ)`                                      | `scipy.stats.mstats.winsorize`, `sigmaclip`, `boxcox`, `yeojohnson`                                                                                                     | P2  | 120 | `stats/transforms.ts`                      | `minimizeScalar` (`numeric/minimize-scalar.ts`) for λ-MLE (optional)                                                                                                                                                                                           | winsorize(1..10, 0.1,0.1) = [2,2,3,4,5,6,7,8,9,9]; boxCox(4,0.5)=2; boxCox(x,0)=ln x                                 | λ-MLE optional, keep fixed-λ core               |
| S6  | `ecdf(x)` → {x,y,evaluate}                                                                      | `scipy.stats.ecdf`, MATLAB `ecdf`                                                                                                                                       | P2  | 40  | `stats/transforms.ts`                      | —                                                                                                                                                                                                                                                              | ecdf([3,1,2,2]) → x=[1,2,3], y=[0.25,0.75,1]; evaluate(0)=0                                                          | none                                            |
| S7  | effect sizes `cohensD`, `hedgesG`, `glassDelta`, `etaSquared`, `rankBiserial`                   | statsmodels/pingouin, MATLAB `meanEffectSize`                                                                                                                           | P1  | 80  | `stats/effect-sizes.ts`                    | `mean`, `variance` (`typed/arithmetic.ts`), `anova` (`typed/hypothesis.ts`)                                                                                                                                                                                    | cohensD([1,2,3],[4,5,6]) = −3; hedgesG = −2.4; etaSquared([[1,2,3],[4,5,6]]) = 27/31 = 0.870967741935                | sign convention (a−b)                           |
| S8  | `wassersteinDistance`, `energyDistance` (1-D)                                                   | `scipy.stats.wasserstein_distance/energy_distance`                                                                                                                      | P2  | 70  | `stats/distances.ts`                       | —                                                                                                                                                                                                                                                              | wasserstein([0,1,3],[5,6,8]) = 5; energy([0,1,3],[5,6,8]) = √(22/3) = 2.7080128015453203 (closed form via CDF ∫)     | energy value derived by hand — double-check     |
| S9  | `mutualInformation`, `conditionalEntropy` (discrete)                                            | sklearn `mutual_info_score`                                                                                                                                             | P2  | 50  | `stats/distances.ts`                       | `entropy` (`typed/distributions.ts`)                                                                                                                                                                                                                           | x=y=[0,0,1,1] → ln2 = 0.6931471805599453 nats; x=[0,0,1,1], y=[0,1,0,1] → 0                                          | base (nats) — document                          |
| S10 | `jackknife(x, stat)` → {estimate, bias, se}                                                     | astropy/R `jackknife`                                                                                                                                                   | P2  | 40  | `stats/resampling-extra.ts`                | `bootstrapCI` (`typed/hypothesis.ts`) for API shape                                                                                                                                                                                                            | mean of [1,2,3,4,5]: estimate 3, bias 0, se = √(2.5/5) = 0.7071067811865476                                          | none                                            |
| S11 | `signTest`, `runsTest`, `moodMedianTest`, `flignerKilleen`, `brunnerMunzel`                     | `scipy.stats.*`                                                                                                                                                         | P2  | 180 | `stats/nonparametric-extra.ts`             | `binomialTest`, `chiSquareTest` (`typed/hypothesis.ts`), `normalCDF`, `studentTCDF`, `rankdata`                                                                                                                                                                | signTest([1,2,3,4,5], 0) p = 2·0.5⁵ = 0.0625; runsTest([1,1,1,0,0,0]) runs=2, z=−1.8257418583505538, p=0.0679        | Brunner–Munzel df formula                       |
| S12 | `gTest` / `powerDivergence(obs, exp, λ)`                                                        | `scipy.stats.power_divergence`                                                                                                                                          | P2  | 60  | `stats/nonparametric-extra.ts`             | `chiSquaredCDF`                                                                                                                                                                                                                                                | obs=[16,18,16,14,12,12], uniform exp, λ=0 (G): statistic 2.006573162632538, p=0.8482347660754797 (scipy doc example) | none                                            |
| S13 | `gamesHowell(groups)`                                                                           | `scipy.stats`-adjacent / pingouin                                                                                                                                       | P2  | 80  | `stats/posthoc-extra.ts`                   | `studentizedRangeCDF` (`hypothesis-extra.ts`)                                                                                                                                                                                                                  | identical groups → p=1; `VERIFY` vs pingouin for an unequal-variance example                                         | Welch–Satterthwaite df per pair                 |
| S14 | `welchAnova`                                                                                    | `scipy.stats.alexandergovern` / `oneway.anova(welch)`                                                                                                                   | P3  | 60  | `stats/posthoc-extra.ts`                   | `fCDF`                                                                                                                                                                                                                                                         | equal-variance balanced data ≈ `anova` F                                                                             | `VERIFY`                                        |
| S15 | `partialCorrelation(x,y,z)`                                                                     | pingouin `partial_corr`                                                                                                                                                 | P2  | 40  | `stats/robust-stats.ts`                    | `corrcoef` (`descriptive-stats.ts`)                                                                                                                                                                                                                            | r_xy.z = (r_xy − r_xz r_yz)/√((1−r_xz²)(1−r_yz²)); y=2x → 1 for any z                                                | none                                            |
| S16 | `canonicalCorrelation(X,Y)`                                                                     | sklearn `CCA`, MATLAB `canoncorr`                                                                                                                                       | P3  | 80  | `stats/multivariate-extra.ts`              | `qr` (`@danielsimonjr/mathts-matrix`), `singularValues`                                                                                                                                                                                                        | Y = X·M (invertible M) → all correlations 1                                                                          | rank deficiency                                 |
| S17 | `ledoitWolf(X)` covariance shrinkage                                                            | sklearn `LedoitWolf`                                                                                                                                                    | P3  | 60  | `stats/multivariate-extra.ts`              | `cov`                                                                                                                                                                                                                                                          | identity-shaped data → shrinkage → identity                                                                          | `VERIFY`                                        |
| S18 | distributions: skew-normal, truncated-normal, inverse-gamma, GEV, Skellam, Zipf, Nakagami, Rice | `scipy.stats.skewnorm/truncnorm/invgamma/genextreme/skellam/zipf/nakagami/rice`                                                                                         | P2  | 220 | `stats/distributions-extra.ts`             | `normalPDF/normalCDF` (`typed/distributions.ts`), `normalQuantile`, `gammainc` (regularized lower P, `typed/special.ts:657`), `besselIScalar(n,x)` (`wasm/special/scalars.ts:689`), `quad` for Owen's T, `Distribution` interface (`typed/dist-objects.ts:70`) | see §4 Batch A items A4–A5                                                                                           | Owen's T accuracy; GEV support bounds           |
| S19 | `owensT(h,a)`                                                                                   | `scipy.special.owens_t`                                                                                                                                                 | P2  | 40  | with S18                                   | `quad` (`numeric/adaptive-quad.ts`), `normalCDF`                                                                                                                                                                                                               | T(0,1)=0.125; T(1,1)=Φ(1)(1−Φ(1))/2 = 0.0667418… (0.8413447460685429·0.1586552539314571/2 = 0.06674188216570097)     | h large → underflow guard                       |
| S20 | `multivariateT` (pdf/sample)                                                                    | `scipy.stats.multivariate_t`                                                                                                                                            | P3  | 80  | `stats/multivariate-extra.ts`              | `mvnPdf`, `mvnSample` (`stats/mvn.ts`), `lgamma`                                                                                                                                                                                                               | ν→∞ pdf → mvnPdf                                                                                                     | numeric stability of Γ ratio                    |
| S21 | `differentialEntropy` (Vasicek)                                                                 | `scipy.stats.differential_entropy`                                                                                                                                      | P3  | 40  | `stats/distances.ts`                       | —                                                                                                                                                                                                                                                              | `VERIFY`                                                                                                             | window-length default                           |
| S22 | `histogram2d`, `binnedStatistic`                                                                | `np.histogram2d`, `scipy.stats.binned_statistic`                                                                                                                        | P3  | 90  | `stats/binning.ts`                         | `histogram` (`descriptive-stats.ts`)                                                                                                                                                                                                                           | 4 points at the 4 corners of a 2×2 grid → each bin 1                                                                 | edge inclusivity                                |

### 3.2 Special functions

| #   | Gap                                                          | Ref                                           | Pri | LOC | Where                         | Reuse                                                                                   | Oracle                                                                                                                                                                      | Risk                                            |
| --- | ------------------------------------------------------------ | --------------------------------------------- | --- | --- | ----------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| F1  | `erfinv`, `erfcinv`                                          | `scipy.special.erfinv`, MATLAB `erfinv`       | P1  | 50  | `special/erf-extra.ts`        | `normalQuantile` (`distribution-functions.ts:22`), `erf`, Newton polish                 | erfinv(0)=0; erfinv(0.5)=0.4769362762044699; erfinv(erf(1))=1; erfcinv(1)=0                                                                                                 | ±1 → ±Infinity                                  |
| F2  | `erfcx` (scaled erfc), `logerfc`                             | `scipy.special.erfcx`                         | P2  | 50  | `special/erf-extra.ts`        | `erfcScalar` (`wasm/special/scalars.ts:103`); asymptotic CF for x>25                    | erfcx(0)=1; erfcx(1)=e·erfc(1)=0.42758357615580705; erfcx(30)≈1/(30√π)·(1−1/1800)=0.018795…                                                                                 | large-x asymptotic                              |
| F3  | `dawson(x)`                                                  | `scipy.special.dawsn`                         | P2  | 20  | `special/erf-extra.ts`        | `erfi` (`typed/special.ts`): D(x)=(√π/2)e^{−x²}erfi(x)                                  | D(0)=0; D(1)=0.5380795069127684; max D(0.9241388730)=0.5410442246                                                                                                           | erfi overflow for x>~26 → use asymptotic 1/(2x) |
| F4  | `expIntegralE1`, `expn(n,x)`                                 | `scipy.special.exp1/expn`                     | P1  | 60  | `special/exp-integrals.ts`    | `expIntegralEi` (`typed/special.ts`): E1(x)=−Ei(−x); recurrence E_{n+1}=(e^{−x}−xE_n)/n | E1(1)=0.21938393439552029; E2(1)=e⁻¹−E1(1)=0.14849550677592205; E_n(0)=1/(n−1)                                                                                              | recurrence unstable for x>n → use CF            |
| F5  | `sinhIntegral` (Shi), `coshIntegral` (Chi)                   | `scipy.special.shichi`                        | P2  | 30  | `special/exp-integrals.ts`    | `expIntegralEi`: Shi=(Ei(x)−Ei(−x))/2, Chi=(Ei(x)+Ei(−x))/2                             | Shi(1)=1.0572508753757285; Chi(1)=0.8378669409802082; Shi(0)=0                                                                                                              | small-x cancellation → series below 0.5         |
| F6  | spherical Bessel `sphericalJ/Y/I/K(n,x)`                     | `scipy.special.spherical_jn/yn/in/kn`         | P1  | 120 | `special/spherical-bessel.ts` | closed forms j0=sin x/x, y0=−cos x/x; Miller downward recurrence for x<n                | j0(1)=0.8414709848078965; j1(1)=0.30116867893975674; y0(1)=−0.5403023058681398; y1(1)=−1.3817732906760363                                                                   | x→0 limits; large n                             |
| F7  | Hankel `hankelH1/H2(ν,x)` → Complex                          | `scipy.special.hankel1/2`                     | P2  | 30  | `special/spherical-bessel.ts` | `besselJ`, `besselY` (`typed/special.ts`), `Complex` (`@danielsimonjr/mathts-core`)     | H1_0(1)=0.7651976865579666+0.08825696421567696i                                                                                                                             | none                                            |
| F8  | `besselZeros(ν,k)` (j_{ν,k}), `besselYZeros`                 | `scipy.special.jn_zeros`, MATLAB `besselzero` | P2  | 60  | `special/spherical-bessel.ts` | `besselJScalar(n,x)`, McMahon guess + Newton (J'ν=(J_{ν−1}−J_{ν+1})/2)                  | j_{0,1}=2.404825557695773; j_{0,2}=5.520078110286311; j_{1,1}=3.8317059702075125                                                                                            | Newton jumping zeros                            |
| F9  | `wigner3j`, `clebschGordan`, `wigner6j`                      | `sympy.physics.wigner`                        | P2  | 150 | `special/angular-momentum.ts` | `lgamma`/`factorial` (`wasm/special/scalars.ts:536`) — Racah formula                    | CG⟨½,½;½,−½\|0,0⟩=1/√2=0.7071067811865476; CG⟨1,0;1,0\|2,0⟩=√(2/3)=0.816496580927726; 3j(1 1 0;0 0 0)=−1/√3=−0.5773502691896258; 3j(1 1 2;0 0 0)=√(2/15)=0.3651483716701107 | half-integer validation; sign conventions       |
| F10 | `sphericalHarmonic(l,m,θ,φ)` → Complex                       | `scipy.special.sph_harm`                      | P2  | 40  | `special/angular-momentum.ts` | `ferrersP(n,m,x)` (`special/spheroidal.ts:35`)                                          | \|Y₀⁰\|=1/(2√π)=0.28209479177387814; Y₁⁰(0,·)=√(3/4π)=0.4886025119029199; Y₁¹(π/2,0)=−√(3/8π)=−0.3454941494713355 (Condon–Shortley)                                         | **check whether `ferrersP` includes (−1)^m**    |
| F11 | `bernoulliPolynomial(n,x)`, `eulerPolynomial(n,x)`           | `sympy.bernoulli(n,x)`, `euler(n,x)`          | P3  | 40  | `special/zeta-extra.ts`       | `bernoulli` (`typed/probability.ts:177`), `eulerNumbers` (`numbertheory/extra.ts`)      | B₂(½)=−1/12=−0.08333333333333333; B₁(x)=x−½; E₂(½)=−0.25                                                                                                                    | B₁ sign convention (−½)                         |
| F12 | `hurwitzZeta(s,a)`, `dirichletEta(s)`                        | `scipy.special.zeta(s,a)`, `mpmath.altzeta`   | P2  | 70  | `special/zeta-extra.ts`       | `zeta` (`special/zeta.ts`); Euler–Maclaurin for Hurwitz                                 | ζ(2,1)=π²/6=1.6449340668482264; ζ(2,½)=π²/2=4.934802200544679; η(1)=ln2=0.6931471805599453; η(2)=π²/12=0.8224670334241132                                                   | s=1 limit for η                                 |
| F13 | Kelvin `kelvinKer`, `kelvinKei` (order 0)                    | `scipy.special.ker/kei`                       | P3  | 80  | `special/niche.ts` (extend)   | `kelvinBer/Bei` (`special/niche.ts`)                                                    | ker(1)=0.2867062087283160; kei(1)=−0.4949946365187199 (A&S 9.11)                                                                                                            | series only valid x≲8                           |
| F14 | Airy derivatives `airyAiPrime/BiPrime`                       | `scipy.special.airy[1],[3]`                   | P3  | 90  | `special/airy-extra.ts`       | `airyUCoeffs/airyAsymPQ` (`wasm/special/scalars.ts`)                                    | Ai'(0)=−0.2588194037928068; Bi'(0)=0.4482883573538264                                                                                                                       | asymptotic match point                          |
| F15 | `voigtProfile`, `faddeeva w(z)`                              | `scipy.special.voigt_profile/wofz`            | P3  | 150 | `special/erf-extra.ts`        | `erfc` complex (TODO at `special/erf.ts:75`)                                            | voigt(0;σ=1,γ=0)=1/√(2π)=0.3989422804014327; σ=0 → Lorentzian 1/(πγ)                                                                                                        | needs complex erfc (Weideman) — bigger job      |
| F16 | `logit`, `expit` alias, `xlogy`, `log1pmx`, `sinc` re-export | `scipy.special.*`                             | P3  | 30  | `numeric-extra.ts` (extend)   | `sigmoid` (`numeric-extra.ts`), `sinc` (`signal-filter-extra.ts`, **not exported**)     | logit(0.5)=0; logit(0.75)=ln3=1.0986122886681098; xlogy(0,0)=0                                                                                                              | none                                            |

### 3.3 Linear algebra

| #   | Gap                                                                                                                                                               | Ref                                                | Pri | LOC | Where                                      | Reuse                                                             | Oracle                                                                                                                                                                                                         | Risk                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --- | --- | ------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| L1  | special matrices `hilbert`, `invHilbert`, `hadamard`, `pascalMatrix`, `dftMatrix`, `hankelMatrix`, `blockDiag`, `khatriRao`, `fiedlerMatrix`, `leslie`, `helmert` | `scipy.linalg.*`                                   | P1  | 180 | `functions/src/linalg-special-matrices.ts` | `toeplitz/circulant/vander` style in `linalg-extra.ts`; `Complex` | invhilbert(3)=[[9,−36,30],[−36,192,−180],[30,−180,180]]; hadamard(4)·hadamard(4)ᵀ=4I; pascal(4)[3][3]=20, det=1; dft(4)[1]=[1,−i,−1,i]; khatriRao([[1,2],[3,4]],[[5,6],[7,8]])=[[5,12],[7,16],[15,24],[21,32]] | none                                |
| L2  | `subspaceAngles(A,B)`                                                                                                                                             | `scipy.linalg.subspace_angles`, MATLAB `subspace`  | P2  | 50  | `linalg-extra2.ts`                         | `qr`, `singularValues` (`@danielsimonjr/mathts-matrix`)           | span(e1,e2) vs (1,0,1): π/4=0.7853981633974483; vs e3: π/2; vs e1: 0                                                                                                                                           | small-angle accuracy (use sin form) |
| L3  | `signm(A)`, `fractionalMatrixPower(A,t)`                                                                                                                          | `scipy.linalg.signm/fractional_matrix_power`       | P2  | 80  | `linalg-extra2.ts`                         | `matrixExpm`, `matrixLogm` (`matrix`), `inv`, `eigs`              | signm(diag(2,−3))=diag(1,−1); diag(4,9)^0.5=diag(2,3); A^(1/2)·A^(1/2)=A for [[2,1],[1,2]]                                                                                                                     | non-diagonalizable input            |
| L4  | `choleskyUpdate(L,x)`, `choleskyDowndate`                                                                                                                         | MATLAB `cholupdate`, `scipy.linalg.cho_*`-adjacent | P2  | 60  | `linalg-extra2.ts`                         | `cholesky` (`matrix`)                                             | I₂ + [1,1][1,1]ᵀ → L=[[√2,0],[1/√2,√(3/2)]]=[[1.4142135623730951,0],[0.7071067811865476,1.224744871391589]]                                                                                                    | downdate losing PD                  |
| L5  | `eighTridiagonal(d,e)`                                                                                                                                            | `scipy.linalg.eigh_tridiagonal`                    | P2  | 120 | `numeric/tridiagonal-eig.ts`               | implicit QL (tql2)                                                | d=[2,2,2], e=[−1,−1] → 2−√2=0.5857864376269049, 2, 2+√2=3.414213562373095                                                                                                                                      | none                                |
| L6  | `hermiteNormalForm`, `smithNormalForm` (bigint)                                                                                                                   | `sympy.matrices.normalforms`, Mathematica          | P2  | 220 | `numbertheory/integer-matrices.ts`         | `bigintGcd` (`typed/factorization/integer-poly.ts`)               | SNF([[2,4,4],[−6,6,12],[10,−4,−16]]) = diag(2,6,12); HNF([[2,3,6,2],[5,6,1,6],[8,3,1,1]]) = [[1,0,50,−11],[0,3,28,−2],[0,0,61,−13]] (Wikipedia)                                                                | HNF row vs column convention        |
| L7  | `lll(basis, δ)`                                                                                                                                                   | `sympy`/`fpylll`                                   | P3  | 120 | `numbertheory/integer-matrices.ts`         | Fraction arithmetic or f64 Gram–Schmidt                           | [[1,1,1],[−1,0,2],[3,5,6]], δ=¾ → [[0,1,0],[1,0,1],[−1,0,2]] (Wikipedia)                                                                                                                                       | f64 Gram–Schmidt precision          |
| L8  | re-export `qrPivoted`, `lq/rq/ql`, `condest`, `eigvals`, `powerIteration` from `functions`                                                                        | (already in `matrix`)                              | P1  | 5   | `functions/src/index.ts`                   | `matrix/src/operations/index.ts`                                  | existing matrix tests                                                                                                                                                                                          | none                                |
| L9  | `lsqr`/`lsmr`, `lobpcg`, `expmFrechet`, `matrixBalance`                                                                                                           | `scipy.sparse.linalg`, `scipy.linalg`              | P3  | —   | `numeric/`                                 | `cg`, `eigsh`                                                     | —                                                                                                                                                                                                              | large; skip this round              |

### 3.4 Signal processing

| #   | Gap                                                                                                                                                                                                                            | Ref                                                                   | Pri | LOC    | Where                                      | Reuse                                                                               | Oracle                                                                                                                                                   | Risk                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | --- | ------ | ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| G1  | **`conv2` not exported** (`signal/conv.ts:439` exists; grep in `index.ts`/`typed/index.ts`/`typed/signal.ts` = 0); `correlate2d` absent                                                                                        | `scipy.signal.convolve2d/correlate2d`                                 | P1  | 5 + 40 | `functions/src/index.ts`, `signal/conv.ts` | `conv2`, `conv2Direct`, `conv2FFT`                                                  | conv2([[1,2],[3,4]],[[1]]) = same; correlate2d = conv2 with flipped kernel                                                                               | none                           |
| G2  | window family: `kaiser`, `gaussian`, `tukey`, `blackmanHarris`, `nuttall`, `flattop`, `bohman`, `parzen`, `cosine`, `exponential` (`windowFunction` supports only hamming/hann/blackman/bartlett/rect, `typed/signal.ts:1198`) | `scipy.signal.windows.*`                                              | P1  | 150    | `signal/windows-extra.ts`                  | `besselIScalar(0,x)` for Kaiser                                                     | tukey(n,0)=ones; tukey(n,1)=hann; blackmanHarris center=1; flattop center=1; kaiser(n,0)=ones; gaussian(σ) center=1                                      | sym vs periodic flag           |
| G3  | waveform generators `chirp`, `squareWave`, `sawtooth`, `gaussPulse`, `unitImpulse`, `sweepPoly`                                                                                                                                | `scipy.signal.chirp/square/sawtooth/gausspulse/unit_impulse`          | P1  | 120    | `signal/waveforms.ts`                      | —                                                                                   | square(0)=1, square(π)=−1; sawtooth(0)=−1, sawtooth(π)=0; chirp(0,…)=1; unitImpulse(5,2)=[0,0,1,0,0]; chirp f0=f1=f → cos(2πft)                          | phase conventions (scipy: cos) |
| G4  | `lombScargle(t, y, ω)`                                                                                                                                                                                                         | `scipy.signal.lombscargle`, MATLAB `plomb`                            | P1  | 70     | `signal/lomb-scargle.ts`                   | —                                                                                   | irregular samples of sin(2π·1·t): argmax of power at ω=2π (±1%); `VERIFY` absolute normalisation vs scipy                                                | normalize option               |
| G5  | `iirNotch`, `iirPeak`, `iirComb`                                                                                                                                                                                               | `scipy.signal.iirnotch/iirpeak/iircomb`                               | P2  | 80     | `signal/iir-extra.ts`                      | `freqz` (`signal/freqz.ts`)                                                         | notch(w0=0.3π,Q=30): \|H(e^{jw0})\|=0, \|H(1)\|=1, \|H(−1)\|=1                                                                                           | none                           |
| G6  | `tf2zpk`, `tf2sos`, `sos2tf`, `sosfreqz`                                                                                                                                                                                       | `scipy.signal.*`                                                      | P2  | 100    | `signal/iir-extra.ts`                      | `polynomialRoot` (`factories/index.ts:1316`), `zpk2sos`, `zpk2tf`, `polymul`        | sos2tf([[1,2,1,1,0,0]]) → b=[1,2,1], a=[1,0,0]; tf2zpk([1,−3,2],[1]) → zeros {1,2}, k=1                                                                  | root ordering                  |
| G7  | system response `impulseResponse`, `stepResponse`, `cont2discrete` (zoh/bilinear), `tf2ss`, `ss2tf`                                                                                                                            | `scipy.signal.dimpulse/dstep/cont2discrete/tf2ss/ss2tf`, MATLAB `c2d` | P2  | 150    | `signal/system-response.ts`                | `lfilter`, `expm` (`functions`), `characteristicPolynomial` (`typed/matrix-ops.ts`) | c2d(A=[[−1]],B=[[1]],dt=1,zoh) → Ad=e⁻¹=0.36787944117144233, Bd=1−e⁻¹=0.6321205588285577; tf2ss([1],[1,3,2]) → A=[[−3,−2],[1,0]], B=[[1],[0]], C=[[0,1]] | ZOH needs augmented expm       |
| G8  | DCT types I/III/IV, `idct` types, `dctn`                                                                                                                                                                                       | `scipy.fft.dct(type=)`                                                | P2  | 120    | `signal/dct-types.ts`                      | `dct`/`idct` (`typed/signal.ts:578`)                                                | DCT-I([1,2,3,4]) unnormalized: X₀=15, X₁=−4; idct_k(dct_k(x))=x roundtrip for k∈{1,3,4}                                                                  | scipy scaling conventions      |
| G9  | `upfirdn`, `resamplePoly`                                                                                                                                                                                                      | `scipy.signal.upfirdn/resample_poly`                                  | P2  | 90     | `signal/multirate.ts`                      | `firwin`, `lfilter`                                                                 | upfirdn([1],[1,2,3],2)=[1,0,2,0,3,0]; upfirdn([1,1],[1,1,1],2)=[1,1,1,1,1,1]                                                                             | edge trimming                  |
| G10 | `dtw(a,b)` dynamic time warping                                                                                                                                                                                                | MATLAB `dtw`, tslearn                                                 | P2  | 60     | `signal/dtw.ts`                            | —                                                                                   | dtw([1,2,3],[1,2,3])=0; dtw([1,2,3],[1,2,2,3])=0; dtw([0,0],[1,1])=2 (abs cost)                                                                          | window constraint optional     |
| G11 | `realCepstrum`, `complexCepstrum`, `envelope` (Hilbert)                                                                                                                                                                        | MATLAB `rceps/cceps/envelope`                                         | P3  | 60     | `signal/cepstrum.ts`                       | `fft`, `hilbertTransform` (`typed/signal.ts`)                                       | rceps([1,0,0,0]) = [0,0,0,0]; envelope(cos(2π·5t), n=512) ≈ 1 away from edges                                                                            | phase unwrapping for cceps     |
| G12 | `besself`, `cheb1ord/cheb2ord/ellipord`                                                                                                                                                                                        | `scipy.signal.*`                                                      | P3  | 150    | `signal/iir-design.ts` (extend)            | `bilinear`, `buttord`                                                               | cheb1ord: N=⌈acosh(√((10^{0.1As}−1)/(10^{0.1Ap}−1)))/acosh(ωs/ωp)⌉ `VERIFY vs scipy`                                                                     | Bessel pole tables             |
| G13 | `resample` (`typed/signal.ts:1141`) — body shows no anti-alias/sinc step                                                                                                                                                       | `scipy.signal.resample`                                               | P3  | —      | inspect                                    | `decimate` (anti-aliased) exists                                                    | —                                                                                                                                                        | doc/behaviour clarification    |

### 3.5 Numerical methods — optimization / integration / interpolation / ODE

| #   | Gap                                                                                 | Ref                                                                               | Pri | LOC | Where                                                    | Reuse                                                                                        | Oracle                                                                                                                                                                                                                                                                                        | Risk                                 |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --- | --- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| N1  | `differentialEvolution(f, bounds, opts)`                                            | `scipy.optimize.differential_evolution`, MATLAB `ga`-adjacent                     | P1  | 150 | `numeric/global-optimizers.ts`                           | seeded RNG pattern from `numeric/monte-carlo.ts`; `OptimizeResult` (`optimization-extra.ts`) | Rastrigin 2-D on [−5.12,5.12]² → f*≤1e−6 at ≈(0,0); Rosenbrock → (1,1) within 1e−3 (seed fixed)                                                                                                                                                                                               | stochastic — fix seed, tolerance     |
| N2  | `simulatedAnnealing`, `particleSwarm`                                               | `scipy.optimize.dual_annealing`, MATLAB `simulannealbnd/particleswarm`            | P2  | 150 | `numeric/global-optimizers.ts`                           | as N1                                                                                        | same benchmarks                                                                                                                                                                                                                                                                               | as N1                                |
| N3  | `minimizeConstrained(f, x0, {eq, ineq, bounds})` (augmented Lagrangian over `bfgs`) | `scipy.optimize.minimize(method='SLSQP'/'trust-constr')`, MATLAB `fmincon`        | P1  | 180 | `numeric/constrained.ts`                                 | `bfgs` (`numeric/bfgs.ts`), `numericJacobian`                                                | min x²+y² s.t. x+y=1 → (0.5,0.5), f=0.5; min (x−2)²+(y−2)² s.t. x+y≤2 → (1,1), f=2; tolerance 1e−4                                                                                                                                                                                            | penalty schedule; KKT reporting      |
| N4  | Gauss nodes `rootsHermite`, `rootsLaguerre`, `rootsChebyshev`, `rootsJacobi`        | `scipy.special.roots_hermite/laguerre/chebyt/jacobi`                              | P1  | 140 | `numeric/gauss-nodes.ts` (extend; export block separate) | `rootsLegendre` pattern (`numeric/gauss-nodes.ts:60`), `hermiteH`, `laguerreL`, `jacobiP`    | Hermite n=2: ±1/√2=±0.7071067811865476, w=√π/2=0.8862269254527580; n=3: 0,±1.224744871391589, w=1.1816359006036774, 0.2954089751509193; Laguerre n=2: 2∓√2=0.5857864376269049/3.414213562373095, w=(2±√2)/4=0.8535533905932737/0.14644660940672627; Chebyshev-T: nodes cos((2k−1)π/2n), w=π/n | Newton convergence for large n       |
| N5  | `tanhSinh(f,a,b)`, `clenshawCurtis(f,a,b,n)`                                        | `mpmath.quad` (tanh-sinh), `scipy.integrate` CC-adjacent                          | P2  | 120 | `numeric/quadrature-extra.ts`                            | `QuadResult` shape (`numeric/adaptive-quad.ts`)                                              | ∫₋₁¹ dx/√(1−x²)=π (tanh-sinh, 1e−10); ∫₀¹ ln x dx=−1; CC n=8 on x⁴ over [−1,1] = 0.4 exactly                                                                                                                                                                                                  | endpoint evaluation (never touch ±1) |
| N6  | `dblquad(f, ax, bx, gy, hy)`, `tplquad`                                             | `scipy.integrate.dblquad/tplquad`, MATLAB `integral2`                             | P1  | 80  | `numeric/quadrature-extra.ts`                            | `quad` (`numeric/adaptive-quad.ts:126`) nested                                               | ∫₀¹∫₀¹ xy = 0.25; unit disk area via gy=−√(1−x²), hy=√(1−x²) → π (1e−8); ∫ unit cube xyz = 0.125                                                                                                                                                                                              | cost; expose inner tol               |
| N7  | `finiteDifferenceCoefficients(derivOrder, offsets)` (Fornberg)                      | `findiff`, `scipy`-adjacent, MATLAB FD tables                                     | P2  | 50  | `numeric/finite-differences.ts`                          | —                                                                                            | d²/dx² [−1,0,1] → [1,−2,1]; d/dx [−1,0,1] → [−0.5,0,0.5]; d/dx [−2..2] → [1/12,−2/3,0,2/3,−1/12]                                                                                                                                                                                              | none                                 |
| N8  | root extras `ridders`, `bisection`, `toms748`, `fixedPoint`                         | `scipy.optimize.ridder/bisect/toms748/fixed_point`                                | P3  | 100 | `numeric/open-root-finders.ts` (extend)                  | `findRoot` (bracketing Brent, `typed/numeric.ts:108`)                                        | cos x−x on [0,1] → 0.7390851332151607; fixedPoint(cos,1) → same                                                                                                                                                                                                                               | none                                 |
| N9  | symplectic integrators `velocityVerlet`, `leapfrog`, `stormerVerlet`                | `scipy`-adjacent, physics standard                                                | P2  | 90  | `numeric/symplectic.ts`                                  | `gaussLegendre4` (symplectic GL exists, `numeric/gauss-legendre4.ts`)                        | harmonic oscillator h=0.01, t=2π: x≈1 (1e−3); energy drift <1e−4 over 100 periods                                                                                                                                                                                                             | API shape vs `solveODESystem`        |
| N10 | `akimaInterp`, `barycentricInterp`, `kroghInterp`                                   | `scipy.interpolate.Akima1DInterpolator/BarycentricInterpolator/KroghInterpolator` | P2  | 120 | `numeric/interp-extra.ts`                                | `lagrangeInterp` (`typed/interpolation.ts`)                                                  | barycentric on y=x³ at nodes 0..3 → 15.625 at 2.5; akima on linear data → linear (2.5 → 2.5)                                                                                                                                                                                                  | Akima end-slope rule (scipy variant) |
| N11 | 2-D interpolators `bilinear`, `bicubic` on grids                                    | `scipy.interpolate.RectBivariateSpline`, MATLAB `interp2`                         | P3  | —   | `numeric/interpn.ts` (bilinear exists as interpn 2-D)    | `interpn`                                                                                    | —                                                                                                                                                                                                                                                                                             | bicubic only                         |
| N12 | `odeint`-style Adams–Bashforth/Moulton, Bulirsch–Stoer                              | `scipy.integrate.ode`                                                             | P3  | —   | —                                                        | `solveODE` has adaptive RK + stiff                                                           | —                                                                                                                                                                                                                                                                                             | skip                                 |
| N13 | `isotonicRegression` (PAVA)                                                         | `scipy.optimize.isotonic_regression`, sklearn                                     | P2  | 40  | `ml/isotonic.ts`                                         | —                                                                                            | [1,3,2,4] → [1,2.5,2.5,4]; sorted input unchanged                                                                                                                                                                                                                                             | none                                 |

### 3.6 Number theory & combinatorics

| #   | Gap                                                                                                                                                                                                                                                                    | Ref                                                  | Pri | LOC | Where                                  | Reuse                                                                                            | Oracle                                                                                                                                                                                                                                                        | Risk                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --- | --- | -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| T1  | `prevPrime`, `legendreSymbol`, `sqrtMod` (Tonelli–Shanks), `modPow` (public, bigint), `isCarmichael`                                                                                                                                                                   | `sympy.prevprime/legendre_symbol/sqrt_mod`, mathjs — | P1  | 120 | `numbertheory/modular.ts`              | `isPrime` (`factories/index.ts:214`), `jacobiSymbol`, private `modPow` in `utils/isPrime.ts:117` | prevPrime(10)=7; legendreSymbol(2,7)=1, (3,7)=−1, (7,7)=0; sqrtMod(2,7)=3; sqrtMod(10,13)=6; modPow(2,10,1000)=24                                                                                                                                             | p≡1 mod 8 branch     |
| T2  | arithmetic functions `isSquarefree`, `radical`, `bigOmega`, `smallOmega`, `liouvilleLambda`, `vonMangoldt`, `mertens`, `isPerfect`, `isPerfectPower`, `isPrimePower`, `integerSqrt` (bigint), `integerNthRoot`, `digitSum`, `digitalRoot`, `collatzSteps`, `primorial` | `sympy.ntheory.*`                                    | P1  | 150 | `numbertheory/arithmetic-functions.ts` | `primeFactors` (`typed/combinatorics.ts:399`), `moebiusMu`, `divisorSigma`                       | radical(360)=30; bigOmega(12)=3, smallOmega(12)=2; liouville(12)=−1; vonMangoldt(8)=ln2=0.6931471805599453, (6)=0; mertens(10)=−1; isPerfect(28)=true; isPerfectPower(64)={base:2,exp:6}; integerNthRoot(1001n,3)=10n; collatzSteps(27)=111; primorial(7)=210 | bigint vs number API |
| T3  | sequences `motzkin`, `narayana`, `schroder`, `delannoy`, `pell`, `tribonacci`, `eulerianNumber`, `lahNumber`                                                                                                                                                           | `sympy.functions.combinatorial`, OEIS                | P2  | 100 | `numbertheory/sequences.ts`            | `combinations`, `catalan` (exists)                                                               | M(5)=21, M(6)=51; N(4,2)=6; S(4)=90; D(3,3)=63; P(6)=70; T(8)=24 (T₀=T₁=0,T₂=1); A(4,1)=11, A(4,2)=11, ΣA(4,k)=24; L(3,2)=6, L(4,2)=36                                                                                                                        | index conventions    |
| T4  | enumerators `integerPartitionsGen(n)`, `compositionsGen(n)`, `grayCode(n)`, `binomialMod(n,k,p)` (Lucas)                                                                                                                                                               | `sympy.utilities.iterables`, `sympy.binomial % p`    | P2  | 100 | `numbertheory/sequences.ts`            | `permutationsGen/combinationsGen` style (`numbertheory/extra.ts`)                                | partitions(4) → 5 lists, first [4], last [1,1,1,1]; compositions(3) → 4; grayCode(3)=[0,1,3,2,6,7,5,4]; binomialMod(10,3,7)=1                                                                                                                                 | none                 |
| T5  | Diophantine `linearDiophantine(a,b,c)`, `pellSolve(D)` (bigint), `frobeniusNumber(set)`, `zeckendorf(n)`, `sumOfTwoSquares(n)`, `egyptianFraction(p,q)`, `fareySequence(n)`                                                                                            | `sympy.solvers.diophantine`, `sympy.ntheory`         | P2  | 180 | `numbertheory/diophantine.ts`          | `xgcd` (`typed/arithmetic.ts:1134`), `continuedFraction` (`numbertheory/extra.ts`), `fibonacci`  | 3x+5y=1 → (2,−1); pell(2)=(3,2), pell(3)=(2,1), pell(61)=(1766319049n,226153980n); frobenius([3,5])=7, ([6,9,20])=43; zeckendorf(100)=[89,8,3]; egyptian(4,5)=[2,4,20]; farey(3) has 5 terms                                                                  | Pell needs bigint CF |

### 3.7 Geometry

| #   | Gap                                                                                                                | Ref                                                  | Pri | LOC | Where                              | Reuse                                                                                                                        | Oracle                                                                                                                                           | Risk                     |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | --- | --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Y1  | predicates `orient2D`, `inCircle`, `orient3D`, `pointInTriangle`, `barycentricCoordinates`, `polygonIsConvex`      | Shewchuk / CGAL, MATLAB `inpolygon`-adjacent         | P1  | 90  | `geometry/predicates.ts`           | `cross3D`, `triangleArea` (`typed/geometry.ts`)                                                                              | orient2D((0,0),(1,0),(0,1))=+1; barycentric of centroid=(⅓,⅓,⅓); unit square convex=true, L-shape=false                                          | exactness (f64 only)     |
| Y2  | `polygonClip` (Sutherland–Hodgman), `minkowskiSum` (convex)                                                        | Clipper/Shapely, MATLAB `polyshape.intersect`        | P1  | 110 | `geometry/polygon-ops.ts`          | `convexHull2D`, `polygonArea`                                                                                                | clip [0,2]² by [1,3]² → area 1; square⊕square = [0,2]² (area 4)                                                                                  | convex clip window only  |
| Y3  | `earClipping(polygon)` triangulation                                                                               | mapbox/earcut, MATLAB `triangulation`                | P1  | 90  | `geometry/polygon-ops.ts`          | `pointInTriangle` (Y1 — same batch file set)                                                                                 | square → 2 triangles summing to area 4; 6-vertex L-shape → 4 triangles, Σ area = polygonArea                                                     | collinear/degenerate     |
| Y4  | `douglasPeucker(points, ε)`                                                                                        | `shapely.simplify`, rdp                              | P1  | 50  | `geometry/curves.ts`               | `distancePointToLine2D`                                                                                                      | rdp example: [[0,0],[1,0.1],[2,−0.1],[3,5],[4,6],[5,7],[6,8.1],[7,9],[8,9],[9,9]], ε=1 → [[0,0],[2,−0.1],[3,5],[7,9],[9,9]]                      | none                     |
| Y5  | `hausdorffDistance`, `frechetDistance` (discrete)                                                                  | `scipy.spatial.distance.directed_hausdorff`, shapely | P2  | 70  | `geometry/curves.ts`               | `distance2D`                                                                                                                 | A={(0,0),(1,0)}, B={(0,1),(1,1)} → Hausdorff 1; Fréchet P=[(0,0),(1,0)], Q=[(0,1),(1,1),(2,1)] → √2=1.4142135623730951                           | none                     |
| Y6  | `minimumEnclosingCircle` (Welzl), `minimumBoundingRectangle`, `polygonDiameter` (rotating calipers), `closestPair` | `scipy.spatial`-adjacent, MATLAB `minboundcircle`    | P2  | 150 | `geometry/extremal.ts`             | `convexHull2D`                                                                                                               | unit-square ×2 corners → center (1,1), r=√2=1.4142135623730951; diameter 2√2=2.8284271247461903; closestPair([(0,0),(5,5),(1,1),(10,10)]) → d=√2 | Welzl recursion          |
| Y7  | `catmullRom`, `arcLength(curve,a,b)`, `curvature(curve,t)`, `frenetFrame`                                          | MATLAB `cscvn`-adjacent, SymPy `Curve`               | P2  | 100 | `geometry/curves.ts`               | `quad`, `bezierCurve` (`typed/numeric.ts`)                                                                                   | catmullRom through (1,1),(2,2) at t=0.5 → (1.5,1.5); arcLength of unit circle over [0,2π] = 2π; curvature of radius-2 circle = 0.5               | parametrization choice   |
| Y8  | geodesy `bearing`, `destinationPoint`, `sphericalPolygonArea`, `vincenty`                                          | geographiclib, MATLAB `azimuth/reckon/areaint`       | P2  | 110 | `geometry/geodesy.ts`              | `haversine`, `EARTH_RADIUS_KM` (`geometry-extra.ts`); private `sphericalTriangleArea` in `spherical-voronoi.ts:59` (promote) | bearing (0,0)→(0,90)=90°, (0,0)→(90,0)=0°; destination(0,0,90°,πR/2) → (0,90); octant triangle area on unit sphere = π/2 = 1.5707963267948966    | Vincenty non-convergence |
| Y9  | 3-D `raySphereIntersect`, `rayAABBIntersect`, `triangleTriangleIntersect`, `boundingSphere`                        | three.js/CGAL                                        | P3  | 120 | `geometry/intersect3d.ts` (extend) | `rayTriangleIntersect`, `rayPlaneIntersect`                                                                                  | ray (0,0,−5)+t(0,0,1) vs unit sphere → t=4, hit (0,0,−1); AABB [0,1]³ from (−1,.5,.5) dir (1,0,0) → tmin 1, tmax 2                               | degenerate triangles     |

### 3.8 CAS / symbolic

| #   | Gap                                                                                           | Ref                                                 | Pri | LOC | Where                 | Reuse                                                                                                         | Oracle                                                                                                                                                                       | Risk                              |
| --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- | --- | --- | --------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| C1  | `sturmSequence(p)`, `sturmRootCount(p,a,b)`, `isolateRealRoots(p)`, `descartesSignChanges(p)` | `sympy.polys.polytools.sturm/count_roots/intervals` | P1  | 120 | `cas/real-roots.ts`   | `polyval`, `polyder`, `polynomialRemainder` (`typed/algebra.ts`; ascending coefficients `coeffs[0]`=constant) | x³−3x+1: roots in [−2,2]=3, in [0,1]=1; Descartes(+,−,+)=2; isolation → 3 disjoint intervals each containing one of −1.8793852415718, 0.3472963553338607, 1.5320888862379562 | coefficient order; exact vs float |
| C2  | `identifyConstant(x)` / nsimplify                                                             | `sympy.nsimplify`, `mpmath.identify`                | P3  | 100 | `cas/identify.ts`     | `continuedFraction`, `toRadicals` (`typed/cas.ts:1913`)                                                       | 0.5 → '1/2'; 1.4142135623730951 → 'sqrt(2)'; 3.141592653589793 → 'pi'                                                                                                        | false positives                   |
| C3  | symbolic ODE `dsolve` (first-order linear/separable), `rsolve`                                | `sympy.dsolve/rsolve`                               | P3  | —   | `typed/cas.ts`        | `odeGeneral` is numeric; `symbolicIntegral`                                                                   | y'=y → C·exp(x)                                                                                                                                                              | large; defer                      |
| C4  | exact rational `rref`/`det`/`inv` over `Fraction`                                             | `sympy.Matrix.rref`                                 | P3  | —   | `typed/matrix-ops.ts` | `rowReduce` is `number[][]` only (`matrix-ops.ts:185`); Bareiss det exists internally                         | —                                                                                                                                                                            | typed dispatch breadth            |

### 3.9 Expression / parser

No functional gaps found: mathjs name parity is complete (§1), and `FUNCTION_GAPS.md §7`
already documented full parser parity. Not re-audited token-by-token here.

### 3.10 Tensor / autograd (belongs in `tensor` / `autograd`, not `functions`)

| #   | Gap                                                                                                                                        | Ref              | Pri | LOC | Where                                       | Oracle                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | --- | --- | ------------------------------------------- | ---------------------------------------------------------------- |
| X1  | `Tensor.argmax/argmin/argsort/sort/cumsum/cumprod/std/var/where/clip` (none exist; grep in `Tensor.ts` = 0)                                | `np.*`           | P2  | 200 | `tensor/src/operations/reductions-extra.ts` | argmax([[1,5],[7,2]], axis=1) = [1,0]; cumsum([1,2,3]) = [1,3,6] |
| X2  | `TapedTensor.reshape/transpose/concat/slice/softmax/logsumexp/relu` (tape has elementwise + matmul + contract + reductions + eig/svd only) | PyTorch autograd | P2  | 250 | `autograd/src/tape.ts`                      | d/dx logsumexp = softmax; reshape gradient is identity           |
| X3  | `DualTensor.matmul` (forward-mode has no matmul)                                                                                           | JAX `jvp`        | P3  | 60  | `autograd/src/dual-tensor.ts`               | tangent of A·B = Ȧ·B + A·Ḃ                                       |

### 3.11 Units, workbook, plotting (non-`functions`, listed for completeness)

- **Units**: `Unit.toSI`, `simplify`, `toBest`, `splitUnit`, `createUnit` all exist. No code gap identified.
- **Workbook**: `runWorkbookWithTimeout` shipped; remaining items (GUI, PDF/ipynb export, multi-doc serve) are product features tracked in `TODO.md`, not math gaps.
- **Plot**: exports `line/scatter/bar/area/step/errorbar/quiver/histogram/heatmap/contour/surface/scatter3d/curve3d`. No `polar`, `boxplot`, `violin`, `pie` (verified absent in `plot/src/index.ts`). P3; not in this work list.

---

## 4. Prioritized implementation work list (27 items in 5 independent batches)

**Conventions for every item** (mirror `functions/src/descriptive-stats.ts` /
`hypothesis-extra.ts` / `numeric/*.ts`):

- New source file in **kebab-case** under `functions/src/<dir>/`; relative imports end in `.js`.
- `strict: true`, no `any`, no `@ts-ignore`; `oxlint --deny-warnings` clean; `noUnusedLocals`.
- Vector inputs: `type Vec = readonly number[] | Float64Array;` with the `arr()` helper, as in `hypothesis-extra.ts:15-16`.
- Test file `functions/tests/<same-name>.test.ts` starting with `import { describe, it, expect } from 'vitest';` (vitest `include: ['tests/**/*.test.ts']`).
- Export: append **one explicit named-export block** to `functions/src/index.ts` with a comment header, e.g.
  ```ts
  // Gap-analysis 2026-11-04 Batch A — weighted & robust statistics.
  export {
    weightedMean,
    weightedVariance,
    weightedMedian,
    weightedQuantile,
  } from './stats/weighted-stats.js';
  export type { WeightedQuantileOptions } from './stats/weighted-stats.js';
  ```
  (never `export *` — the index uses explicit blocks so the duplicate-symbol gate and consumer typecheck can see every name).
- One changeset per batch in `.changeset/<batch-slug>.md`:
  ```md
  ---
  '@danielsimonjr/mathts-functions': minor
  ---

  Add …
  ```
- Each batch touches **disjoint files**; the only shared file is `functions/src/index.ts`, where each batch appends its own block (merge conflicts are trivial append-only). After each batch: `bunx vitest run functions/tests/<file>.test.ts`, then `cd functions && bunx tsc --noEmit && bunx tsc -p tsconfig.test.json`, then `bun run lint`. Note `docs:functions` pre-commit needs a rebuilt dist (`bunx turbo build --filter=@danielsimonjr/mathts-functions`).

### Batch A — Statistics (weighted / robust / effect sizes / distributions)

Files: `functions/src/stats/weighted-stats.ts`, `stats/robust-stats.ts`, `stats/effect-sizes.ts`, `stats/distributions-extra.ts`, `stats/nonparametric-extra.ts` (+ matching tests).

**A1. Weighted statistics** — `stats/weighted-stats.ts` (~120 LOC, P1)

```ts
export function weightedMean(x: Vec, w: Vec): number;
export function weightedVariance(x: Vec, w: Vec, opts?: { ddof?: 0 | 1 }): number; // ddof 0 = Σw(x−m)²/Σw
export function weightedMedian(x: Vec, w: Vec): number; // lower weighted median (first x where cumw ≥ Σw/2)
export function weightedQuantile(x: Vec, w: Vec, p: number): number; // same rule generalized
```

Edge cases: length mismatch → `RangeError`; negative or all-zero weights → `RangeError`; NaN weight → NaN; single element returns it.
Tests: `weightedMean([1,2,3,4],[1,1,1,5])` → `3.25`; `weightedMean([2,4,6],[1,1,1])` → `4`; `weightedVariance([1,2,3,4],[1,1,1,5])` → `1.1875`; `weightedMedian([1,2,3,4,5],[1,1,1,1,10])` → `5`; `weightedMedian([1,2,3],[1,1,1])` → `2`.

**A2. Robust & generalized means** — `stats/robust-stats.ts` (~160 LOC, P1)

```ts
export function pmean(x: Vec, p: number): number; // p=0 → gmean, p=1 → mean, p=−1 → hmean
export function gstd(x: Vec, opts?: { ddof?: number }): number; // exp(std(log x)), ddof default 1 (scipy)
export function gzscore(x: Vec, opts?: { ddof?: number }): number[];
export function theilSen(x: Vec, y: Vec): { slope: number; intercept: number }; // intercept = median(y) − slope·median(x) (scipy)
export function siegelSlopes(x: Vec, y: Vec): { slope: number; intercept: number }; // median of per-point medians
export function partialCorrelation(x: Vec, y: Vec, z: Vec): number;
```

Reuse `gmean/hmean/corrcoef` from `../descriptive-stats.js`, `median/mean/std` from `../typed/arithmetic.js`.
Edge: `pmean` with non-positive x and non-integer p → `RangeError`; `theilSen` n<2 → `RangeError`; duplicate x pairs skipped.
Tests: `pmean([1,2,4],2)` → `2.6457513110645907`; `pmean([1,4],-1)` → `1.6`; `pmean([1,4],0)` → `2`; `gstd([1,2,4])` → `2` (1e-12); `gzscore([1,2,4])` → `[-1,0,1]`; `theilSen([0,1,2,3,4],[1,3,5,7,100])` → `{slope: 2, intercept: 1}`; `partialCorrelation([1,2,3,4,5],[2,4,6,8,10],[1,0,2,0,3])` → `1` (1e-12).

**A3. Effect sizes** — `stats/effect-sizes.ts` (~90 LOC, P1)

```ts
export function cohensD(a: Vec, b: Vec): number; // (mean a − mean b) / pooled sd (ddof 1)
export function hedgesG(a: Vec, b: Vec): number; // cohensD · (1 − 3/(4(n₁+n₂)−9))
export function glassDelta(a: Vec, b: Vec): number; // (mean a − mean b) / sd(b)
export function etaSquared(groups: readonly Vec[]): number; // SS_between / SS_total
export function rankBiserial(a: Vec, b: Vec): number; // 1 − 2U/(n₁n₂), U from mannWhitneyTest
```

Tests: `cohensD([1,2,3],[4,5,6])` → `-3`; `hedgesG([1,2,3],[4,5,6])` → `-2.4`; `glassDelta([1,2,3],[4,5,6])` → `-3`; `etaSquared([[1,2,3],[4,5,6]])` → `27/31 = 0.8709677419354839` (SS_between = 2·3·(1.5)² = 13.5, SS_total = 17.5 → **recompute**: means 2 and 5, grand 3.5; SS_b = 3·(1.5²)+3·(1.5²) = 13.5; SS_w = 2+2 = 4; SS_t = 17.5; η² = 13.5/17.5 = **0.7714285714285715**). Use 0.7714285714285715.

**A4. Distributions (closed-form family)** — `stats/distributions-extra.ts` (~220 LOC, P2). Each returns the existing `Distribution` object shape from `typed/dist-objects.ts:70` (pdf/cdf/quantile/mean/variance/sample) where feasible; otherwise standalone `*PDF/*CDF`.

```ts
export function owensT(h: number, a: number): number; // quad over [0,a] of exp(−h²(1+x²)/2)/(1+x²) / 2π
export function skewNormalPDF(x: number, alpha: number, loc?: number, scale?: number): number; // 2φ(z)Φ(αz)/scale
export function skewNormalCDF(x: number, alpha: number, loc?: number, scale?: number): number; // Φ(z) − 2T(z,α)
export function truncatedNormalPDF(
  x: number,
  a: number,
  b: number,
  mu?: number,
  sigma?: number
): number;
export function truncatedNormalCDF(
  x: number,
  a: number,
  b: number,
  mu?: number,
  sigma?: number
): number;
export function truncatedNormalMean(a: number, b: number, mu?: number, sigma?: number): number;
export function inverseGammaPDF(x: number, alpha: number, beta: number): number;
export function inverseGammaCDF(x: number, alpha: number, beta: number): number; // 1 − gammainc(α, β/x)
export function gevCDF(x: number, xi: number, mu?: number, sigma?: number): number; // exp(−t), t=(1+ξz)^{−1/ξ}, ξ=0 → exp(−z)
export function gevPDF(x: number, xi: number, mu?: number, sigma?: number): number;
export function skellamPMF(k: number, mu1: number, mu2: number): number; // e^{−(μ₁+μ₂)}(μ₁/μ₂)^{k/2} I_{|k|}(2√(μ₁μ₂))
export function zipfPMF(k: number, s: number, n: number): number; // k^{−s}/H_{n,s}
export function nakagamiPDF(x: number, m: number, omega: number): number;
export function ricePDF(x: number, nu: number, sigma: number): number;
```

Reuse: `normalPDF`, `normalCDF` (`../typed/distributions.js`), `gammainc` (`../typed/special.js`, regularized lower P), `besselIScalar` (`../wasm/special/scalars.js`), `quad` (`../numeric/adaptive-quad.js`), `lgamma`.
Edge: GEV support — outside support cdf is 0 or 1, pdf 0; truncated normal a≥b → `RangeError`; Skellam negative k uses I_{|k|}.
Tests: `owensT(0,1)` → `0.125`; `owensT(1,1)` → `0.06674188216570097` (1e-9); `skewNormalCDF(0,1)` → `0.25` (1e-9); `skewNormalPDF(0,0)` → `0.3989422804014327`; `truncatedNormalPDF(0,-1,1)` → `0.5843686…` = φ(0)/(Φ(1)−Φ(−1)) = 0.3989422804014327/0.6826894921370859 = **0.5843686904855…** (assert 1e-9 against that quotient computed in the test from `normalPDF/normalCDF`); `truncatedNormalMean(0, Infinity)` → `0.7978845608028654`; `inverseGammaCDF(1,1,1)` → `0.36787944117144233`; inverseGamma mean β/(α−1): α=3, β=2 → `1` (assert via numeric ∫x·pdf with `quad` to 1e-6); `gevCDF(0,0)` → `0.36787944117144233`; `gevCDF(1,0.5)` → `exp(−1.5⁻²) = 0.6411803884299546`; `gevCDF(1,-0.5)` → `exp(−0.25) = 0.7788007830714049`; `skellamPMF(0,1,1)` → `0.3085083225…` = e⁻²·I₀(2) (I₀(2)=2.2795853023360673 → 0.30850832251); `zipfPMF(1,1,3)` → `6/11 = 0.5454545454545454`; `nakagamiPDF(1,1,1)` → `2e⁻¹ = 0.7357588823428847`; `ricePDF(1,0,1)` → `e^{−0.5} = 0.6065306597126334`.

**A5. Nonparametric & categorical tests** — `stats/nonparametric-extra.ts` (~200 LOC, P2)

```ts
export function signTest(
  x: Vec,
  median?: number
): { statistic: number; pValue: number; nPos: number; nNeg: number };
export function runsTest(
  x: Vec | readonly boolean[],
  opts?: { cutoff?: number }
): { runs: number; z: number; pValue: number };
export function moodMedianTest(groups: readonly Vec[]): {
  statistic: number;
  pValue: number;
  grandMedian: number;
};
export function powerDivergence(
  observed: Vec,
  expected?: Vec,
  lambda?: number
): { statistic: number; pValue: number }; // λ=1 χ², λ=0 G
export function gTest(observed: Vec, expected?: Vec): { statistic: number; pValue: number };
export function jackknife(
  x: Vec,
  stat: (sample: number[]) => number
): { estimate: number; bias: number; se: number };
```

Reuse: `binomialTest`, `chiSquareTest` (`../typed/hypothesis.js`), `chiSquaredCDF`, `normalCDF`, `median`.
Edge: ties with the median are dropped in `signTest`; `runsTest` with n₁=0 or n₂=0 → z = NaN, p = 1; `powerDivergence` λ=0 and observed 0 counts contribute 0; λ=−1 singular → `RangeError`.
Tests: `signTest([1,2,3,4,5],0).pValue` → `0.0625`; `runsTest([1,1,1,0,0,0])` → `{runs: 2, z: -1.8257418583505538}` (1e-12), `pValue` → `0.0679` (1e-3); `powerDivergence([16,18,16,14,12,12], undefined, 0)` → statistic `2.006573162632538`, pValue `0.8482347660754797` (1e-10); `powerDivergence([16,18,16,14,12,12])` (λ=1) → statistic `2`; `jackknife([1,2,3,4,5], mean)` → `{estimate: 3, bias: 0, se: 0.7071067811865476}`.

**A6. Distances & information** — add to `stats/robust-stats.ts`? No — keep separate: `stats/distances.ts` (~110 LOC, P2)

```ts
export function wassersteinDistance(
  u: Vec,
  v: Vec,
  opts?: { uWeights?: Vec; vWeights?: Vec }
): number;
export function energyDistance(u: Vec, v: Vec): number;
export function mutualInformation(x: readonly number[], y: readonly number[]): number; // nats, discrete labels
export function ecdf(x: Vec): { x: number[]; y: number[]; evaluate: (t: number) => number };
```

Tests: `wassersteinDistance([0,1,3],[5,6,8])` → `5`; `wassersteinDistance([0,1],[0,1])` → `0`; `energyDistance([0,1,3],[5,6,8])` → `2.7080128015453203` (=√(22/3), 1e-9); `mutualInformation([0,0,1,1],[0,0,1,1])` → `0.6931471805599453`; `mutualInformation([0,0,1,1],[0,1,0,1])` → `0` (1e-12); `ecdf([3,1,2,2])` → `x=[1,2,3], y=[0.25,0.75,1]`, `evaluate(0)=0`, `evaluate(2)=0.75`.

### Batch B — Special functions

Files: `functions/src/special/erf-extra.ts`, `special/exp-integrals.ts`, `special/spherical-bessel.ts`, `special/angular-momentum.ts`, `special/zeta-extra.ts`.

**B1. Inverse / scaled error functions & Dawson** — `special/erf-extra.ts` (~120 LOC, P1)

```ts
export function erfinv(y: number): number; // |y|>1 → NaN, ±1 → ±Infinity; seed normalQuantile((1+y)/2)/√2, 2 Newton/Halley steps on erf
export function erfcinv(y: number): number; // erfinv(1−y) with care near y→0 (use log-domain seed)
export function erfcx(x: number): number; // e^{x²}erfc(x); x<−26 → overflow guard; x>25 asymptotic 1/(x√π)·(1 − 1/(2x²) + 3/(4x⁴))
export function dawson(x: number): number; // (√π/2)e^{−x²}erfi(x) for |x|<5, else asymptotic 1/(2x)(1+1/(2x²)+3/(4x⁴))
```

Reuse: `normalQuantile` (`../distribution-functions.js`), `erf`, `erfc`, `erfi` (`../typed/special.js`).
Tests: `erfinv(0)` → `0`; `erfinv(0.5)` → `0.4769362762044699` (1e-12); `erfinv(erf(1))` → `1` (1e-12); `erfcinv(1)` → `0`; `erfcx(0)` → `1`; `erfcx(1)` → `0.42758357615580705` (1e-12); `erfcx(30)` → `1/(30√π)·(1−1/1800+…)` ≈ `0.018795888…` (assert 1e-9 relative vs the 3-term asymptotic); `dawson(0)` → `0`; `dawson(1)` → `0.5380795069127684` (1e-12); `dawson(-1)` → `-0.5380795069127684`.

**B2. Exponential-type integrals** — `special/exp-integrals.ts` (~90 LOC, P1)

```ts
export function expIntegralE1(x: number): number; // x>0: −Ei(−x); x=0 → Infinity; x<0 → NaN (real branch)
export function expn(n: number, x: number): number; // E_n(x): n=0 → e^{−x}/x; n≥1 upward recurrence for x≤n, continued fraction for x>n
export function sinhIntegral(x: number): number; // Shi
export function coshIntegral(x: number): number; // Chi, x>0
```

Reuse: `expIntegralEi` (`../typed/special.js`).
Tests: `expIntegralE1(1)` → `0.21938393439552029` (1e-12); `expn(2,1)` → `0.14849550677592205` (1e-10); `expn(3,0)` → `0.5`; `sinhIntegral(1)` → `1.0572508753757285` (1e-10); `coshIntegral(1)` → `0.8378669409802082` (1e-10); `sinhIntegral(0)` → `0`.

**B3. Spherical Bessel, Hankel, Bessel zeros** — `special/spherical-bessel.ts` (~200 LOC, P1)

```ts
export function sphericalBesselJ(n: number, x: number): number;
export function sphericalBesselY(n: number, x: number): number;
export function sphericalBesselI(n: number, x: number): number;
export function sphericalBesselK(n: number, x: number): number;
export function hankelH1(nu: number, x: number): Complex; // J + iY
export function hankelH2(nu: number, x: number): Complex; // J − iY
export function besselJZeros(nu: number, k: number): number[]; // first k positive zeros
```

Reuse: `besselJ`, `besselY`, `besselI`, `besselK` (`../typed/special.js`), `Complex` from `@danielsimonjr/mathts-core`. j_n: upward recurrence j_{n+1} = (2n+1)/x·j_n − j_{n−1} when x > n, else Miller downward with normalization by j₀; y_n always upward. Zeros: McMahon guess β − (μ−1)/(8β) with β=(k+ν/2−¼)π, then Newton using J′_ν = (J_{ν−1} − J_{ν+1})/2.
Edge: x=0 → j₀=1, j_n=0 (n>0), y_n=−Infinity; negative n → `RangeError`.
Tests: `sphericalBesselJ(0,1)` → `0.8414709848078965`; `sphericalBesselJ(1,1)` → `0.30116867893975674` (1e-12); `sphericalBesselY(0,1)` → `-0.5403023058681398`; `sphericalBesselY(1,1)` → `-1.3817732906760363` (1e-12); `sphericalBesselJ(0,0)` → `1`; `hankelH1(0,1)` → `re 0.7651976865579666, im 0.08825696421567696` (1e-10); `besselJZeros(0,2)` → `[2.404825557695773, 5.520078110286311]` (1e-10); `besselJZeros(1,1)` → `[3.8317059702075125]`.

**B4. Angular momentum coupling & spherical harmonics** — `special/angular-momentum.ts` (~190 LOC, P2)

```ts
export function wigner3j(
  j1: number,
  j2: number,
  j3: number,
  m1: number,
  m2: number,
  m3: number
): number;
export function clebschGordan(
  j1: number,
  m1: number,
  j2: number,
  m2: number,
  J: number,
  M: number
): number;
export function wigner6j(
  j1: number,
  j2: number,
  j3: number,
  j4: number,
  j5: number,
  j6: number
): number;
export function sphericalHarmonic(l: number, m: number, theta: number, phi: number): Complex; // θ polar, φ azimuth; Condon–Shortley phase
```

Reuse: `lgamma` (`../typed/special.js`) for Δ-coefficients, `ferrersP` (`./spheroidal.js`). **Builder must first check whether `ferrersP(n,m,x)` includes the (−1)^m Condon–Shortley factor** (read `special/spheroidal.ts:35` docstring) and compensate so that Y₁¹(π/2,0) is negative.
Edge: triangle inequality / m-sum violation → `0`; half-integer inputs allowed, non-multiples of ½ → `RangeError`.
Tests: `clebschGordan(0.5,0.5,0.5,-0.5,0,0)` → `0.7071067811865476`; `clebschGordan(1,0,1,0,2,0)` → `0.816496580927726`; `wigner3j(1,1,0,0,0,0)` → `-0.5773502691896258`; `wigner3j(1,1,2,0,0,0)` → `0.3651483716701107`; `wigner3j(1,1,1,0,0,0)` → `0` (odd J-sum rule); `sphericalHarmonic(0,0,0.3,1.2)` → `re 0.28209479177387814, im 0`; `sphericalHarmonic(1,0,0,0)` → `0.4886025119029199`; `sphericalHarmonic(1,1,Math.PI/2,0)` → `-0.3454941494713355` (1e-12).

**B5. Zeta-family & Bernoulli/Euler polynomials** — `special/zeta-extra.ts` (~120 LOC, P2)

```ts
export function hurwitzZeta(s: number, a: number): number; // s>1, a>0; Euler–Maclaurin with N=10 terms + B₂ₖ corrections
export function dirichletEta(s: number): number; // (1−2^{1−s})ζ(s); s=1 → ln2
export function bernoulliPolynomial(n: number, x: number): number;
export function eulerPolynomial(n: number, x: number): number;
```

Reuse: `zeta` (`./zeta.js`), `bernoulli` (`../typed/probability.js`), `combinations` (`../typed/probability.js`), `eulerNumbers` (`../numbertheory/extra.js`).
Tests: `hurwitzZeta(2,1)` → `1.6449340668482264` (1e-12); `hurwitzZeta(2,0.5)` → `4.934802200544679` (1e-10); `dirichletEta(1)` → `0.6931471805599453` (1e-12); `dirichletEta(2)` → `0.8224670334241132`; `bernoulliPolynomial(2,0.5)` → `-0.08333333333333333`; `bernoulliPolynomial(1,0)` → `-0.5`; `eulerPolynomial(2,0.5)` → `-0.25`; `eulerPolynomial(1,0)` → `-0.5`.

### Batch C — Numerical methods (optimization & quadrature)

Files: `functions/src/numeric/global-optimizers.ts`, `numeric/constrained.ts`, `numeric/gauss-nodes-extra.ts`, `numeric/quadrature-extra.ts`, `numeric/finite-differences.ts`.

**C1. Differential evolution + simulated annealing** — `numeric/global-optimizers.ts` (~230 LOC, P1)

```ts
export interface GlobalOptimizeOptions { seed?: number; maxIter?: number; popSize?: number; tol?: number; F?: number; CR?: number; }
export interface GlobalOptimizeResult { x: number[]; fx: number; iterations: number; evaluations: number; converged: boolean; }
export function differentialEvolution(f: (x: number[]) => number, bounds: ReadonlyArray<readonly [number, number]>, opts?: GlobalOptimizeOptions): GlobalOptimizeResult; // rand/1/bin, F=0.8, CR=0.9, popSize=15·dim
export function simulatedAnnealing(f: (x: number[]) => number, x0: readonly number[], opts?: GlobalOptimizeOptions & { T0?: number; cooling?: number; bounds?: … }): GlobalOptimizeResult;
```

Reuse: the seeded xorshift/mulberry RNG pattern in `numeric/monte-carlo.ts` (copy the 10-line generator, do not import private symbols); result shape consistent with `OptimizeResult` in `optimization-extra.ts`.
Edge: empty bounds → `RangeError`; lo≥hi → `RangeError`; non-finite f → treated as +Infinity.
Tests (seed 42): Rastrigin 2-D `10n + Σ(x²−10cos(2πx))` on [−5.12,5.12]² → `fx < 1e-6`, each `|x_i| < 1e-3`; Rosenbrock on [−2,2]² → `x ≈ [1,1]` (1e-3); sphere Σx² on [−1,1]³ → `fx < 1e-8`; same seed → identical result (determinism).

**C2. Constrained minimization** — `numeric/constrained.ts` (~180 LOC, P1)

```ts
export interface ConstrainedOptions {
  eq?: ReadonlyArray<(x: number[]) => number>;
  ineq?: ReadonlyArray<(x: number[]) => number> /* g(x) ≤ 0 */;
  bounds?: ReadonlyArray<readonly [number, number]>;
  tol?: number;
  maxOuter?: number;
  mu0?: number;
}
export function minimizeConstrained(
  f: (x: number[]) => number,
  x0: readonly number[],
  opts: ConstrainedOptions
): {
  x: number[];
  fx: number;
  constraintViolation: number;
  outerIterations: number;
  converged: boolean;
};
```

Augmented Lagrangian (Powell–Hestenes–Rockafellar) with inner `bfgs` from `./bfgs.js` (pass `bounds` through its projection); multiplier update λ ← λ + μ·h(x); μ ×10 when violation does not drop by 4×.
Tests: min x²+y² s.t. x+y=1 → `x ≈ [0.5,0.5]`, `fx ≈ 0.5` (1e-4); min (x−2)²+(y−2)² s.t. x+y−2 ≤ 0 → `[1,1]`, `fx ≈ 2` (1e-4); unconstrained call (no eq/ineq) equals `bfgs` on x² → `[0]`; inactive inequality (x+y ≤ 10 for min x²+y²) → `[0,0]`.

**C3. Gauss quadrature nodes** — `numeric/gauss-nodes-extra.ts` (~150 LOC, P1)

```ts
export function rootsHermite(n: number): { nodes: number[]; weights: number[] }; // physicists', weight e^{−x²}
export function rootsLaguerre(n: number, alpha?: number): { nodes: number[]; weights: number[] };
export function rootsChebyshevT(n: number): { nodes: number[]; weights: number[] }; // closed form
export function rootsChebyshevU(n: number): { nodes: number[]; weights: number[] };
export function rootsJacobi(
  n: number,
  alpha: number,
  beta: number
): { nodes: number[]; weights: number[] };
export function gaussHermiteIntegrate(f: (x: number) => number, n: number): number; // ∫ e^{−x²} f
export function gaussLaguerreIntegrate(f: (x: number) => number, n: number): number; // ∫₀^∞ e^{−x} f
```

Reuse: `rootsLegendre` structure (`./gauss-nodes.js`), `hermiteH`, `laguerreL` (`../typed/special.js`), `jacobiP` (`../special/polygamma-orthopoly.js`). Golub–Welsch via `eigs` is an alternative but Newton on the recurrence is simpler and dependency-free.
Tests: Hermite n=2 → nodes `[-0.7071067811865476, 0.7071067811865476]`, weights `[0.886226925452758, 0.886226925452758]` (1e-12); n=3 → nodes `[-1.224744871391589, 0, 1.224744871391589]`, weights `[0.2954089751509193, 1.1816359006036774, 0.2954089751509193]`; Laguerre n=2 → nodes `[0.5857864376269049, 3.414213562373095]`, weights `[0.8535533905932737, 0.14644660940672627]`; `gaussHermiteIntegrate(x => x*x, 5)` → `√π/2 = 0.886226925452758`; `gaussLaguerreIntegrate(x => x*x, 5)` → `2`; Chebyshev-T n=3 nodes `cos(π/6), 0, cos(5π/6)` = `[0.8660254037844387, 0, -0.8660254037844387]`, weights all `π/3`.

**C4. Extra quadrature** — `numeric/quadrature-extra.ts` (~170 LOC, P1)

```ts
export function tanhSinh(f: (x: number) => number, a: number, b: number, opts?: { tol?: number; maxLevel?: number }): QuadResult;
export function clenshawCurtis(f: (x: number) => number, a: number, b: number, n: number): number;
export function dblquad(f: (y: number, x: number) => number, ax: number, bx: number, gy: number | ((x: number) => number), hy: number | ((x: number) => number), opts?: QuadOptions): QuadResult;
export function tplquad(f: (z: number, y: number, x: number) => number, ax: number, bx: number, gy: …, hy: …, qz: …, rz: …, opts?: QuadOptions): QuadResult;
```

Reuse: `quad`, `QuadOptions`, `QuadResult` (`./adaptive-quad.js`). `dblquad` argument order matches scipy (`f(y, x)`).
Edge: tanh-sinh must never evaluate at the endpoints (abscissa clamp); infinite limits → `RangeError` this round.
Tests: `tanhSinh(x => 1/Math.sqrt(1-x*x), -1, 1).value` → `π` (1e-10); `tanhSinh(Math.log, 0, 1).value` → `-1` (1e-10); `clenshawCurtis(x => x**4, -1, 1, 8)` → `0.4` (1e-12); `dblquad((y,x) => x*y, 0, 1, 0, 1).value` → `0.25` (1e-10); `dblquad(() => 1, -1, 1, x => -Math.sqrt(1-x*x), x => Math.sqrt(1-x*x)).value` → `π` (1e-7); `tplquad((z,y,x) => x*y*z, 0,1,0,1,0,1).value` → `0.125` (1e-9).

**C5. Finite-difference coefficients + fixed-point/Ridders** — `numeric/finite-differences.ts` (~110 LOC, P2)

```ts
export function finiteDifferenceCoefficients(
  derivOrder: number,
  offsets: readonly number[]
): number[]; // Fornberg
export function ridders(
  f: (x: number) => number,
  a: number,
  b: number,
  opts?: { tol?: number; maxIter?: number }
): number;
export function fixedPoint(
  g: (x: number) => number,
  x0: number,
  opts?: { tol?: number; maxIter?: number; aitken?: boolean }
): number;
```

Tests: `finiteDifferenceCoefficients(2,[-1,0,1])` → `[1,-2,1]`; `finiteDifferenceCoefficients(1,[-1,0,1])` → `[-0.5,0,0.5]`; `finiteDifferenceCoefficients(1,[-2,-1,0,1,2])` → `[1/12,-2/3,0,2/3,-1/12]` (1e-12); `ridders(x => Math.cos(x)-x, 0, 1)` → `0.7390851332151607` (1e-12); `fixedPoint(Math.cos, 1)` → `0.7390851332151607` (1e-10).

### Batch D — Number theory, integer linear algebra, real roots

Files: `functions/src/numbertheory/modular.ts`, `numbertheory/arithmetic-functions.ts`, `numbertheory/sequences.ts`, `numbertheory/diophantine.ts`, `numbertheory/integer-matrices.ts`, `cas/real-roots.ts`.

**D1. Modular arithmetic** — `numbertheory/modular.ts` (~130 LOC, P1)

```ts
export function modPow(base: bigint | number, exp: bigint | number, mod: bigint | number): bigint; // right-to-left binary
export function prevPrime(n: number): number; // n ≤ 2 → RangeError
export function legendreSymbol(a: number, p: number): -1 | 0 | 1; // p odd prime else RangeError; Euler criterion via modPow
export function sqrtMod(a: number, p: number): number | null; // Tonelli–Shanks; smallest root; null if non-residue
export function isCarmichael(n: number): boolean; // Korselt: squarefree, composite, (p−1) | (n−1) ∀p
```

Reuse: `isPrime` (`../factories/index.js`), `primeFactors` (`../typed/combinatorics.js`).
Tests: `modPow(2,10,1000)` → `24n`; `modPow(3n,200n,50n)` → `(3**200 mod 50)` computed in-test with bigint → `1n` (3²⁰ ≡ 1 mod 50, 200 = 10·20); `prevPrime(10)` → `7`; `prevPrime(3)` → `2`; `legendreSymbol(2,7)` → `1`; `legendreSymbol(3,7)` → `-1`; `legendreSymbol(7,7)` → `0`; `sqrtMod(2,7)` → `3`; `sqrtMod(10,13)` → `6`; `sqrtMod(3,7)` → `null`; `isCarmichael(561)` → `true`; `isCarmichael(560)` → `false`.

**D2. Arithmetic functions** — `numbertheory/arithmetic-functions.ts` (~170 LOC, P1)

```ts
export function isSquarefree(n: number): boolean;
export function radical(n: number): number;
export function bigOmega(n: number): number;
export function smallOmega(n: number): number;
export function liouvilleLambda(n: number): -1 | 1;
export function vonMangoldt(n: number): number;
export function mertens(n: number): number;
export function isPerfect(n: number): boolean;
export function isPerfectPower(n: number): { base: number; exp: number } | null; // largest exp
export function isPrimePower(n: number): { p: number; k: number } | null;
export function integerSqrt(n: bigint): bigint;
export function integerNthRoot(n: bigint, k: number): bigint;
export function digitSum(n: number | bigint, base?: number): number;
export function digitalRoot(n: number): number;
export function collatzSteps(n: number): number;
export function primorial(n: number): bigint;
```

Reuse: `primeFactors`, `moebiusMu`, `divisorSigma` (`../typed/combinatorics.js`), `isqrt` private in `typed/factorization/integer-poly.ts:281` (re-implement, 8 lines, don't import private).
Tests: `radical(360)` → `30`; `isSquarefree(30)` → `true`, `(12)` → `false`; `bigOmega(12)` → `3`; `smallOmega(12)` → `2`; `liouvilleLambda(12)` → `-1`; `vonMangoldt(8)` → `0.6931471805599453`; `vonMangoldt(6)` → `0`; `mertens(10)` → `-1`; `isPerfect(28)` → `true`, `(12)` → `false`; `isPerfectPower(64)` → `{base:2, exp:6}`; `isPerfectPower(12)` → `null`; `isPrimePower(27)` → `{p:3,k:3}`; `integerSqrt(10n**40n)` → `10n**20n`; `integerNthRoot(1001n,3)` → `10n`; `digitSum(12345)` → `15`; `digitalRoot(12345)` → `6`; `collatzSteps(27)` → `111`; `primorial(7)` → `210n`.

**D3. Sequences & enumerators** — `numbertheory/sequences.ts` (~160 LOC, P2)

```ts
export function motzkin(n: number): number;
export function narayana(n: number, k: number): number;
export function schroder(n: number): number;
export function delannoy(m: number, n: number): number;
export function pell(n: number): number;
export function tribonacci(n: number): number;
export function eulerianNumber(n: number, k: number): number;
export function lahNumber(n: number, k: number): number;
export function integerPartitionsGen(n: number): number[][]; // descending lexicographic
export function compositionsGen(n: number): number[][];
export function grayCode(bits: number): number[];
export function binomialMod(n: bigint, k: bigint, p: bigint): bigint; // Lucas' theorem, p prime
```

Reuse: `combinations` (`../typed/probability.js`), `partitions` (count, `../typed/combinatorics.js`) to cross-check length.
Tests: `motzkin(5)` → `21`, `motzkin(6)` → `51`; `narayana(4,2)` → `6`; `schroder(4)` → `90`; `delannoy(3,3)` → `63`, `delannoy(2,2)` → `13`; `pell(6)` → `70`; `tribonacci(8)` → `24`; `eulerianNumber(4,1)` → `11`, `eulerianNumber(4,2)` → `11`, Σ_k `eulerianNumber(4,k)` → `24`; `lahNumber(3,2)` → `6`, `lahNumber(4,2)` → `36`; `integerPartitionsGen(4)` → `[[4],[3,1],[2,2],[2,1,1],[1,1,1,1]]`; `compositionsGen(3).length` → `4`; `grayCode(3)` → `[0,1,3,2,6,7,5,4]`; `binomialMod(10n,3n,7n)` → `1n`.

**D4. Diophantine solvers** — `numbertheory/diophantine.ts` (~190 LOC, P2)

```ts
export function linearDiophantine(
  a: number,
  b: number,
  c: number
): { x: number; y: number; stepX: number; stepY: number } | null;
export function pellSolve(d: number): { x: bigint; y: bigint } | null; // fundamental solution via continued fraction of √d
export function frobeniusNumber(coins: readonly number[]): number; // gcd≠1 → RangeError; round-robin / Wilf
export function zeckendorf(n: number): number[]; // descending Fibonacci parts
export function sumOfTwoSquares(n: number): Array<[number, number]>; // all a≤b with a²+b²=n
export function egyptianFraction(p: number, q: number): number[]; // greedy denominators
export function fareySequence(n: number): Array<[number, number]>; // [num, den] pairs ascending
```

Reuse: `xgcd` (`../typed/arithmetic.js`), `continuedFraction` (`./extra.js`), `fibonacci` (`../typed/combinatorics.js`).
Tests: `linearDiophantine(3,5,1)` → `{x:2, y:-1, stepX:5, stepY:-3}` (any particular solution is fine — assert 3x+5y=1 and steps); `pellSolve(2)` → `{x:3n,y:2n}`; `pellSolve(3)` → `{x:2n,y:1n}`; `pellSolve(61)` → `{x:1766319049n, y:226153980n}`; `pellSolve(4)` → `null`; `frobeniusNumber([3,5])` → `7`; `frobeniusNumber([6,9,20])` → `43`; `zeckendorf(100)` → `[89,8,3]`; `sumOfTwoSquares(25)` → `[[0,5],[3,4]]`; `egyptianFraction(4,5)` → `[2,4,20]`; `fareySequence(3)` → `[[0,1],[1,3],[1,2],[2,3],[1,1]]`.

**D5. Integer normal forms** — `numbertheory/integer-matrices.ts` (~240 LOC, P2)

```ts
export function hermiteNormalForm(A: ReadonlyArray<readonly (number | bigint)[]>): bigint[][];   // row-style HNF (upper triangular), as Wikipedia
export function smithNormalForm(A: …): { D: bigint[][]; invariants: bigint[] };
export function lll(basis: ReadonlyArray<readonly number[]>, delta?: number): number[][];       // δ=0.75; f64 Gram–Schmidt
```

Reuse: none needed (bigint gcd 5 lines; `bigintGcd` exists in `typed/factorization/integer-poly.ts` but is an internal module — re-implement rather than deepen the import graph).
Tests: `smithNormalForm([[2,4,4],[-6,6,12],[10,-4,-16]]).invariants` → `[2n,6n,12n]`; `hermiteNormalForm([[2,3,6,2],[5,6,1,6],[8,3,1,1]])` → `[[1,0,50,-11],[0,3,28,-2],[0,0,61,-13]]`; `lll([[1,1,1],[-1,0,2],[3,5,6]])` → `[[0,1,0],[1,0,1],[-1,0,2]]`; HNF of identity → identity.

**D6. Real-root isolation** — `cas/real-roots.ts` (~130 LOC, P1)

```ts
export function sturmSequence(coeffs: readonly number[]): number[][]; // ascending coefficients, same convention as polyval
export function sturmRootCount(coeffs: readonly number[], a: number, b: number): number;
export function descartesSignChanges(coeffs: readonly number[]): number; // upper bound on positive roots
export function isolateRealRoots(
  coeffs: readonly number[],
  opts?: { bound?: number; minWidth?: number }
): Array<[number, number]>; // Cauchy bound + bisection by Sturm counts
export function realRoots(coeffs: readonly number[], tol?: number): number[]; // isolate + findRoot per interval
```

Reuse: `polyval`, `polyder`, `polynomialRemainder` (`../typed/algebra.js`), `findRoot` (`../typed/numeric.js`).
Edge: zero polynomial → `RangeError`; roots at interval endpoints (Sturm counts half-open (a,b]); repeated roots → squarefree part via `polynomialGCD` first.
Tests (p = x³−3x+1 = `[1,-3,0,1]`): `sturmRootCount(p,-2,2)` → `3`; `sturmRootCount(p,0,1)` → `1`; `descartesSignChanges(p)` → `2`; `realRoots(p)` → `[-1.8793852415718169, 0.3472963553338607, 1.532088886237956]` (1e-10); `realRoots([1,0,1])` (x²+1) → `[]`.

### Batch E — Signal, linear algebra matrices, geometry

Files: `functions/src/signal/windows-extra.ts`, `signal/waveforms.ts`, `signal/lomb-scargle.ts`, `signal/system-response.ts`, `signal/dtw.ts`, `functions/src/linalg-special-matrices.ts`, `functions/src/linalg-extra2.ts`, `geometry/predicates.ts`, `geometry/polygon-ops.ts`, `geometry/curves.ts`.

**E1. `conv2` re-export (P1, 2 lines)** — add to `index.ts`: `export { conv2 } from './signal/conv.js'; export type { ConvMode } from './signal/conv.js';` (`ConvMode` is already exported at `signal/conv.ts:14`). Test: `conv2([[1,2],[3,4]],[[1]])` → `[[1,2],[3,4]]`; `conv2([[1,2],[3,4]],[[1,1],[1,1]],'full')` → `[[1,3,2],[4,10,6],[3,7,4]]`. Also `export { sinc } from './signal-filter-extra.js'` if not yet public (verified: `sinc` defined there, absent from the export index).

**E2. Window family** — `signal/windows-extra.ts` (~160 LOC, P1)

```ts
export type ExtraWindowName =
  | 'kaiser'
  | 'gaussian'
  | 'tukey'
  | 'blackmanharris'
  | 'nuttall'
  | 'flattop'
  | 'bohman'
  | 'parzen'
  | 'cosine'
  | 'exponential';
export function kaiserWindow(n: number, beta: number, opts?: { sym?: boolean }): number[];
export function gaussianWindow(n: number, std: number, opts?: { sym?: boolean }): number[];
export function tukeyWindow(n: number, alpha?: number, opts?: { sym?: boolean }): number[];
export function blackmanHarrisWindow(n: number, opts?): number[];
export function nuttallWindow(n, opts?): number[];
export function flattopWindow(n, opts?): number[];
export function bohmanWindow(n, opts?): number[];
export function parzenWindow(n, opts?): number[];
export function cosineWindow(n, opts?): number[];
export function exponentialWindow(n: number, tau: number, opts?): number[];
export function getWindow(
  name: ExtraWindowName | 'hamming' | 'hann' | 'blackman' | 'bartlett' | 'rectangular',
  n: number,
  param?: number
): number[]; // delegates to windowFunction for the 5 existing names
```

Reuse: `windowFunction` (`../typed/signal.js`), `besselIScalar(0, x)` (`../wasm/special/scalars.js`). scipy coefficients: Blackman–Harris [0.35875, 0.48829, 0.14128, 0.01168]; Nuttall [0.3635819, 0.4891775, 0.1365995, 0.0106411]; flattop [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368].
Tests: `tukeyWindow(8,0)` → all `1`; `tukeyWindow(9,1)` → equals `windowFunction(9,'hann')` (1e-12); `kaiserWindow(5,0)` → all `1`; `blackmanHarrisWindow(9)[4]` → `1` (1e-12); `flattopWindow(9)[4]` → `1` (1e-9); `gaussianWindow(7,1)[3]` → `1`, `[2]` → `exp(-0.5) = 0.6065306597126334`; `parzenWindow(5)[2]` → `1`.

**E3. Waveforms** — `signal/waveforms.ts` (~120 LOC, P1)

```ts
export function chirp(
  t: Vec,
  f0: number,
  t1: number,
  f1: number,
  opts?: { method?: 'linear' | 'quadratic' | 'logarithmic' | 'hyperbolic'; phi?: number }
): number[]; // cos(phase), scipy
export function squareWave(t: Vec, duty?: number): number[]; // +1 for frac(t/2π) < duty
export function sawtooth(t: Vec, width?: number): number[]; // scipy: −1 at 0 rising to +1
export function gaussPulse(t: Vec, fc: number, bw?: number, bwr?: number): number[];
export function unitImpulse(n: number, idx?: number | 'mid'): number[];
export function sweepPoly(t: Vec, polyCoeffs: readonly number[], phi?: number): number[];
```

Tests: `squareWave([0])` → `[1]`, `squareWave([Math.PI])` → `[-1]`; `sawtooth([0, Math.PI])` → `[-1, 0]` (1e-12); `chirp([0], 1, 1, 10)` → `[1]`; `chirp(t, 2, 1, 2)` equals `cos(2π·2·t)` for t=[0,0.1,0.2] (1e-12); `gaussPulse([0], 1000)` → `[1]`; `unitImpulse(5,2)` → `[0,0,1,0,0]`; `unitImpulse(5,'mid')` → `[0,0,1,0,0]`.

**E4. Lomb–Scargle** — `signal/lomb-scargle.ts` (~80 LOC, P1)

```ts
export function lombScargle(
  t: Vec,
  y: Vec,
  freqs: Vec /* angular ω */,
  opts?: { normalize?: boolean; precenter?: boolean }
): number[];
```

Classic Scargle formula with τ phase offset. Test: t = 100 pseudo-random points in [0,10] (seeded), y = sin(2π·1·t); `freqs` = 2π·linspace(0.1,3,291); argmax power at ω within 1% of 2π; `normalize:true` peak ≈ 1 (±0.05); constant y → all ≈ 0 with `precenter`.

**E5. System response & conversions** — `signal/system-response.ts` (~170 LOC, P2)

```ts
export function impulseResponse(b: Vec, a: Vec, n: number): number[];
export function stepResponse(b: Vec, a: Vec, n: number): number[];
export function tf2ss(
  b: Vec,
  a: Vec
): { A: number[][]; B: number[][]; C: number[][]; D: number[][] }; // controllable canonical (scipy)
export function ss2tf(
  A: number[][],
  B: number[][],
  C: number[][],
  D: number[][]
): { num: number[]; den: number[] };
export function cont2discrete(
  sys: { A; B; C; D },
  dt: number,
  method?: 'zoh' | 'bilinear' | 'euler'
): { A; B; C; D };
export function iirNotch(w0: number, Q: number): { b: number[]; a: number[] }; // w0 normalized (0,1), ×π rad/sample
export function iirPeak(w0: number, Q: number): { b: number[]; a: number[] };
export function tf2zpk(b: Vec, a: Vec): { z: Complex[]; p: Complex[]; k: number };
export function sos2tf(sos: ReadonlyArray<readonly number[]>): { b: number[]; a: number[] };
```

Reuse: `lfilter` (`../signal-filter-extra.js`), `expm` (`../typed/matrix-ops.js` or matrix package `matrixExpm`), `characteristicPolynomial` (`../typed/matrix-ops.js`), `polynomialRoot` (`../factories/index.js`), `polymul`, `freqz` for the notch test.
Tests: `impulseResponse([1],[1,-0.5],4)` → `[1,0.5,0.25,0.125]`; `stepResponse([1],[1,-0.5],3)` → `[1,1.5,1.75]`; `tf2ss([1],[1,3,2])` → `A=[[-3,-2],[1,0]], B=[[1],[0]], C=[[0,1]], D=[[0]]`; `ss2tf` of that → `num=[0,0,1]`→ trimmed `[1]`, `den=[1,3,2]` (1e-12); `cont2discrete({A:[[-1]],B:[[1]],C:[[1]],D:[[0]]},1,'zoh')` → `A=[[0.36787944117144233]], B=[[0.6321205588285577]]` (1e-12); `iirNotch(0.3,30)`: `|H|` at ω=0.3π → `< 1e-10`, at ω=0 → `1` (1e-10); `sos2tf([[1,2,1,1,0,0]])` → `b=[1,2,1], a=[1,0,0]`; `tf2zpk([1,-3,2],[1]).z` → `{1,2}` (sorted real parts, 1e-12).

**E6. DTW** — `signal/dtw.ts` (~60 LOC, P2)

```ts
export function dtw(
  a: Vec,
  b: Vec,
  opts?: { window?: number; dist?: (x: number, y: number) => number }
): { distance: number; path: Array<[number, number]> };
```

Tests: `dtw([1,2,3],[1,2,3]).distance` → `0`; `dtw([1,2,3],[1,2,2,3]).distance` → `0`; `dtw([0,0],[1,1]).distance` → `2`; path starts `[0,0]` and ends `[a.length-1, b.length-1]`.

**E7. Special matrices** — `linalg-special-matrices.ts` (~180 LOC, P1)

```ts
export function hilbertMatrix(n: number): number[][];
export function invHilbertMatrix(n: number): number[][]; // exact integer formula
export function hadamardMatrix(n: number): number[][]; // n power of 2 else RangeError
export function pascalMatrix(n: number, kind?: 'symmetric' | 'lower' | 'upper'): number[][];
export function dftMatrix(n: number, opts?: { scale?: 'none' | 'sqrtn' | 'n' }): Complex[][];
export function hankelMatrix(c: Vec, r?: Vec): number[][];
export function blockDiag(...blocks: ReadonlyArray<ReadonlyArray<readonly number[]>>): number[][];
export function khatriRao(A: number[][], B: number[][]): number[][];
export function fiedlerMatrix(a: Vec): number[][];
export function leslieMatrix(f: Vec, s: Vec): number[][];
export function helmertMatrix(n: number, full?: boolean): number[][];
```

Reuse: `toeplitz/circulant/vander` idioms in `linalg-extra.ts`; `Complex`.
Tests: `invHilbertMatrix(3)` → `[[9,-36,30],[-36,192,-180],[30,-180,180]]`; `hilbertMatrix(3)[2][2]` → `0.2`; `hadamardMatrix(4)` → `[[1,1,1,1],[1,-1,1,-1],[1,1,-1,-1],[1,-1,-1,1]]` and H·Hᵀ = 4I; `pascalMatrix(4)` → `[[1,1,1,1],[1,2,3,4],[1,3,6,10],[1,4,10,20]]`, `det` = 1 (via `det`); `dftMatrix(4)[1]` → `[1, −i, −1, i]` (1e-12); `hankelMatrix([1,2,3])` → `[[1,2,3],[2,3,0],[3,0,0]]`; `blockDiag([[1]],[[2,3],[4,5]])` → `[[1,0,0],[0,2,3],[0,4,5]]`; `khatriRao([[1,2],[3,4]],[[5,6],[7,8]])` → `[[5,12],[7,16],[15,24],[21,32]]`; `leslieMatrix([0.1,2,1],[0.5,0.8])` → `[[0.1,2,1],[0.5,0,0],[0,0.8,0]]`.

**E8. Subspace angles, matrix sign, fractional power, Cholesky update** — `linalg-extra2.ts` (~190 LOC, P2)

```ts
export function subspaceAngles(A: number[][], B: number[][]): number[]; // descending, radians
export function signm(A: number[][], opts?: { tol?: number; maxIter?: number }): number[][]; // Newton X ← (X + X⁻¹)/2 with scaling
export function fractionalMatrixPower(A: number[][], t: number): number[][]; // expm(t·logm(A)); integer t → matrixPower
export function choleskyUpdate(L: number[][], x: Vec): number[][]; // L Lᵀ + x xᵀ
export function choleskyDowndate(L: number[][], x: Vec): number[][]; // L Lᵀ − x xᵀ, RangeError if not PD
```

Reuse: `qr`, `singularValues` (`@danielsimonjr/mathts-matrix` — `functions` already re-exports `svd` from there), `inv`, `matrixPower`, `expm`, `matrixLog` (`../typed/matrix-ops.js` / `factories`).
Tests: `subspaceAngles([[1,0],[0,1],[0,0]], [[1],[0],[1]])` → `[0.7853981633974483]` (1e-12); vs `[[0],[0],[1]]` → `[1.5707963267948966]`; vs `[[1],[0],[0]]` → `[0]` (1e-12); `signm([[2,0],[0,-3]])` → `[[1,0],[0,-1]]` (1e-12); `fractionalMatrixPower([[4,0],[0,9]],0.5)` → `[[2,0],[0,3]]` (1e-10); `fractionalMatrixPower([[2,1],[1,2]],0.5)` squared → `[[2,1],[1,2]]` (1e-10); `choleskyUpdate([[1,0],[0,1]],[1,1])` → `[[1.4142135623730951,0],[0.7071067811865476,1.224744871391589]]` (1e-12); downdate of that by `[1,1]` → identity (1e-12).

**E9. Geometry predicates & polygon ops** — `geometry/predicates.ts` + `geometry/polygon-ops.ts` (~200 LOC, P1)

```ts
// predicates.ts
export function orient2D(a: Pt, b: Pt, c: Pt): -1 | 0 | 1;
export function orient3D(a, b, c, d): -1 | 0 | 1;
export function inCircle(a: Pt, b: Pt, c: Pt, d: Pt): -1 | 0 | 1; // ccw triangle; +1 inside
export function pointInTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean;
export function barycentricCoordinates(p: Pt, a: Pt, b: Pt, c: Pt): [number, number, number];
export function polygonIsConvex(poly: readonly Pt[]): boolean;
// polygon-ops.ts
export function polygonClip(subject: readonly Pt[], clipConvex: readonly Pt[]): Pt[]; // Sutherland–Hodgman
export function minkowskiSum(a: readonly Pt[], b: readonly Pt[]): Pt[]; // convex result via hull of pairwise sums
export function earClipping(poly: readonly Pt[]): Array<[number, number, number]>; // vertex-index triangles
```

Reuse: `polygonArea`, `convexHull2D`, `triangleArea` (`../typed/geometry.js`).
Tests: `orient2D([0,0],[1,0],[0,1])` → `1`; reversed → `-1`; collinear → `0`; `inCircle([0,0],[1,0],[0,1],[0.2,0.2])` → `1`, `[2,2]` → `-1`; `barycentricCoordinates([1/3,1/3],[0,0],[1,0],[0,1])` → `[1/3,1/3,1/3]` (1e-12); `polygonIsConvex(square)` → `true`, L-shape → `false`; `polygonArea(polygonClip(square02, square13))` → `1` (1e-12); `polygonArea(convexHull2D(minkowskiSum(unitSquare, unitSquare)))` → `4`; `earClipping(square).length` → `2` and Σ triangle areas → `4`; L-shape (6 vertices) → `4` triangles, Σ areas = `polygonArea` (1e-12).

**E10. Curves & distances** — `geometry/curves.ts` (~190 LOC, P1)

```ts
export function douglasPeucker(points: readonly Pt[], epsilon: number): Pt[];
export function hausdorffDistance(a: readonly Pt[], b: readonly Pt[]): number;
export function frechetDistance(p: readonly Pt[], q: readonly Pt[]): number; // discrete Fréchet
export function closestPair(points: readonly Pt[]): { i: number; j: number; distance: number }; // O(n log n) divide & conquer
export function minimumEnclosingCircle(points: readonly Pt[]): { center: Pt; radius: number }; // Welzl (iterative)
export function catmullRom(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number, alpha?: number): Pt;
export function arcLength(curve: (t: number) => Pt, a: number, b: number): number; // quad over |r′| via central difference
export function curvature(curve: (t: number) => Pt, t: number, h?: number): number;
```

Reuse: `distancePointToLine2D`, `distance2D` (`../typed/geometry.js`), `quad`.
Tests: `douglasPeucker([[0,0],[1,0.1],[2,-0.1],[3,5],[4,6],[5,7],[6,8.1],[7,9],[8,9],[9,9]],1)` → `[[0,0],[2,-0.1],[3,5],[7,9],[9,9]]`; `hausdorffDistance([[0,0],[1,0]],[[0,1],[1,1]])` → `1`; `frechetDistance([[0,0],[1,0]],[[0,1],[1,1],[2,1]])` → `1.4142135623730951` (1e-12); `closestPair([[0,0],[5,5],[1,1],[10,10]]).distance` → `1.4142135623730951`; `minimumEnclosingCircle([[0,0],[2,0],[2,2],[0,2]])` → center `[1,1]`, radius `1.4142135623730951` (1e-9); `catmullRom([0,0],[1,1],[2,2],[3,3],0.5)` → `[1.5,1.5]` (1e-12); `arcLength(t => [Math.cos(t), Math.sin(t)], 0, 2π)` → `6.283185307179586` (1e-8); `curvature(t => [2cos t, 2sin t], 1)` → `0.5` (1e-6).

### Batch summary

| Batch | Items                                 | New source files                                                                                                                                                                                                                                      | Est. LOC | P1 count |
| ----- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| A     | A1–A6 (6)                             | `stats/weighted-stats.ts`, `stats/robust-stats.ts`, `stats/effect-sizes.ts`, `stats/distributions-extra.ts`, `stats/nonparametric-extra.ts`, `stats/distances.ts`                                                                                     | ~900     | 3        |
| B     | B1–B5 (5)                             | `special/erf-extra.ts`, `special/exp-integrals.ts`, `special/spherical-bessel.ts`, `special/angular-momentum.ts`, `special/zeta-extra.ts`                                                                                                             | ~720     | 3        |
| C     | C1–C5 (5)                             | `numeric/global-optimizers.ts`, `numeric/constrained.ts`, `numeric/gauss-nodes-extra.ts`, `numeric/quadrature-extra.ts`, `numeric/finite-differences.ts`                                                                                              | ~840     | 4        |
| D     | D1–D6 (6)                             | `numbertheory/modular.ts`, `numbertheory/arithmetic-functions.ts`, `numbertheory/sequences.ts`, `numbertheory/diophantine.ts`, `numbertheory/integer-matrices.ts`, `cas/real-roots.ts`                                                                | ~1,020   | 3        |
| E     | E1–E10 (10; E1 is a 2-line re-export) | `signal/windows-extra.ts`, `signal/waveforms.ts`, `signal/lomb-scargle.ts`, `signal/system-response.ts`, `signal/dtw.ts`, `linalg-special-matrices.ts`, `linalg-extra2.ts`, `geometry/predicates.ts`, `geometry/polygon-ops.ts`, `geometry/curves.ts` | ~1,350   | 6        |

Total: **32 items** (27 substantive + 5 small), **~4,800 LOC** source (estimate), every file ≤250 LOC.
Batch E is the largest; if the Builder pool is 4, split E into E-signal (E1–E6) and E-linalg/geometry (E7–E10): they share no files.

**Cross-batch file-collision check:** none of the 31 new files are shared; the only
shared file is `functions/src/index.ts` (append-only blocks) — Builders must append
at the end of the file, never edit existing blocks.

---

## 5. Non-code gaps (docs, typing, DX) — separate from the work list

1. **Re-export gaps from `matrix`** (P1, trivial): `qrPivoted`, `lq/rq/ql`, `condest`, `eigvals`, `powerIteration`, `matrixPinv` exist in `matrix/src/operations/index.ts` but are not on the `functions` surface (verified: 0 hits for each in the generated export index; `schur`, `svd`, `expm`, `matrixLog`, `matrixPower` already are), so `docs/reference/functions.md` and the roadmap's "rank-revealing QR + rq/ql/lq deferred" note are both stale. Recommend one explicit block in `functions/src/index.ts` (as done for `svd`) and a note in `ORACLE_GAP_INVENTORY` Phase 7.
2. **`conv2` and `sinc` are implemented but unexported** (`signal/conv.ts:439`, `signal-filter-extra.ts`). Covered by E1; also fix the `docs/reference/functions.md` "Coverage" paragraph.
3. **`windowFunction(n, type: string)`** (`typed/signal.ts:1198`) takes an untyped string; after E2 lands, retype as a union and route unknown names through `getWindow`. Consumer-visible typing improvement.
4. **`resample` (`typed/signal.ts:1141`)** — its body has no anti-aliasing step (0 matches for `interp|sinc|filter` in the function body). Either document that it is a plain rate-change and point to `decimate`, or implement polyphase (`resamplePoly`, §3.4 G9).
5. **`special/erf.ts:75` carries a `TODO` for complex erf via Faddeeva** — the only path to `voigtProfile`/`wofz` (§3.2 F15). Track it explicitly in `ROADMAP.md`.
6. **`docs/reference/functions.md` header says 1,090 exports; the generated index has 1,121 backticked names** — the prose number is maintained by hand. Recommend the generator (`npm run docs:functions`) writes the count.
7. **`STATISTICS_GAP_AUDIT_2026-07-06.md` P3 list** says "deferred as genuinely rare" but several of those P3 rows (circular stats, noncentral, GLM, ridge/lasso, Dirichlet/Wishart) have since shipped. Add a status table (like §1 here) to that doc, or mark it superseded by this file.
8. **Typed functions return `unknown`** (documented in CLAUDE.md). New files in this plan are plain TS functions with concrete return types — keep them that way; do not wrap in `mathTyped` unless multi-type dispatch is needed.
9. **`core` `deepMap/deepForEach/reduce` nested typing** (CLAUDE.md Known Issues) — still open; unrelated to this plan but any new `functions` code must not add further casts around it.
10. **Tensor/autograd index-returning reductions and tape shape ops** (§3.10) are the largest non-`functions` capability gap; they belong to those packages' own roadmaps (`ITENSOR_PARITY.md`).
11. **Plot** lacks `polar`, `boxplot`, `violin`, `pie` marks (verified absent). P3, separate package.

---

## 6. Verification notes for the Checker

- Every oracle value marked without `VERIFY` is a closed form or a textbook/A&S/Wikipedia/scipy-doc value the Planner is confident in; those marked `VERIFY` (S4 k4, S13, S14, S17, S21, G4 normalization, G12) must be pinned against the named library before merge or carried as `toBeCloseTo` with a documented tolerance.
- Two values were recomputed during drafting and the corrected numbers are the ones to use: `etaSquared([[1,2,3],[4,5,6]]) = 0.7714285714285715` (not 27/31), and `energyDistance([0,1,3],[5,6,8]) = √(22/3) = 2.7080128015453203` (derived from the CDF-integral definition, not from memory of the scipy docstring).
- The `ferrersP` Condon–Shortley question (B4) and the `polyval` ascending-coefficient convention (D6, `typed/algebra.ts:203`) are the two places where a sign/order convention can silently flip a test.
