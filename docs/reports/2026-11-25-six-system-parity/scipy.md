> **In-repo archive** of the scipy deep parity review, produced on 2026-11-25
> (America/Chicago). MathTS commit at review time:
> [`e09eb301570b`](https://github.com/danielsimonjr/MathTS/commit/e09eb301570bbd18fbade0cdb4984a73bffafb54)
> (2026-11-25 07:41 CT).
> Related: issues [#1592](https://github.com/danielsimonjr/MathTS/issues/1592)–[#1713](https://github.com/danielsimonjr/MathTS/issues/1713),
> tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714).
> Sibling reviews and the merged report live in this folder; pass 1 is
> [2026-11-25-six-system-parity-review.md](../2026-11-25-six-system-parity-review.md).
> Imported data: [inventory](data/scipy-inventory.csv), [mapping](data/scipy-mapping.csv).
> Runtime harnesses, scripts, scratch, and vendored clones from the original
> working copy were not imported. Local paths have been rewritten to
> repo-relative links. Findings are otherwise unchanged.

# MathTS vs SciPy: deep parity review (pass 2, reference = SciPy)

## 1. Versions and sources

- **Reference:** SciPy **1.18.1**, the latest on PyPI (checked with `pip index versions scipy`). Also NumPy 2.5.5 and mpmath 1.4.1, on Python 3.13.5. Everything is installed in `deep/scipy/venv`.
- **MathTS:** my own clone at `deep/scipy/mathts`, SHA **`e09eb301570bbd18fbade0cdb4984a73bffafb54`** (committed 2026-11-25 07:41 CST). `@danielsimonjr/mathts-functions` is 0.89.22. Built with `bun install --frozen-lockfile && bun run build` (bun 1.4.4, exit 0) and run on Node v24.22.1. Logs: `clone.log`, `install.log`, `build.log`.
- The shared mathjs-parity MathTS checkout (76f7a5b) was not modified; `git status` is clean. Nothing was sent to GitHub: no issues, PRs, pushes or comments.
- **Inventory source:** introspection of the installed package (`scripts/enum_scipy.py`). For each of 23 public modules it reads `__all__`: linalg, sparse, sparse.linalg, sparse.csgraph, optimize, optimize.elementwise, integrate, interpolate, signal, signal.windows, fft, special, stats, stats.qmc, stats.contingency, spatial, spatial.distance, spatial.transform, ndimage, cluster.vq, cluster.hierarchy, differentiate and constants. Distribution methods come from `rv_continuous`, `rv_discrete` and `UnivariateDistribution` (from `scipy.stats._distribution_infrastructure`, since `ContinuousDistribution` is not public in 1.18.1). `physical_constants` is a single row covering 445 CODATA entries.

## 2. Method

1. **Inventory:** 1627 items. **137 names were excluded:**
   - 77 submodule re-exports
   - 53 aliases (same object id as a canonical name, e.g. `psi`/`digamma`, `jv`/`jn`; plus an explicit table for same-value unit constants)
   - 7 deprecated items (interpolate `approximate_taylor_polynomial`, `lagrange`, `pade`; spatial `distance_matrix`, `minkowski_distance`, `minkowski_distance_p`, `tsearch`)

   Deprecation was detected only from function-level docstrings, so `qr`, `diags`, `lombscargle` and `anderson_ksamp`, which merely have deprecated parameters, are kept. Private names are never in `__all__`: dir() shows **529 underscore names** across these modules (`scratch/private_counts.txt`), plus 67 non-underscore leakage names outside `__all__`. None of them were counted.

2. **Mapping:** I curated a mapping per area (`curated/*.txt`) using the MathTS runtime export list (2662 top-level exports plus 710 methods), the source export grep (5722 lines) and the TS signatures. `scripts/build_mapping.py` checks every cited MathTS name against the runtime exports. Every **missing** row gets a second check: a normalised runtime-name lookup **plus** a source grep. Hits are reviewed, and 33 of them are name collisions (e.g. ndimage `mean`, distribution `entropy`). Source-only (unexported) hits are noted in the row.
3. **Runtime differential checks:** **1413 cases** in `verify/`. SciPy (or mpmath) computes each expected value, and the MathTS build computes the actual one. Tolerances are listed in `verify/results.md`. Every failure is classified as bug, accuracy, or gap/convention, and every bug has a standalone repro in `verify/bugs/`.

## 3. Counts

### By priority

| priority | full | partial | missing | n/a | total |
| -------- | ---- | ------- | ------- | --- | ----- |
| P0       | 75   | 48      | 6       | 0   | 129   |
| P1       | 172  | 99      | 79      | 0   | 350   |
| P2       | 164  | 126     | 794     | 64  | 1148  |

**Runtime-verified rows:** 705 of 1627, or **43.3%** of all rows. That is 682 of the 684 full/partial rows (99.7%), plus 23 missing constants whose absence was confirmed by a runtime probe. The remaining 856 missing rows are `export+grep` (two methods). The 64 n/a rows are Python-only classes, warnings and exceptions.

### By area

| area                       | rows | full | partial | missing | n/a | runtime-verified |
| -------------------------- | ---- | ---- | ------- | ------- | --- | ---------------- |
| cluster.hierarchy          | 33   | 0    | 0       | 31      | 2   | 0                |
| cluster.vq                 | 6    | 0    | 2       | 3       | 1   | 3                |
| constants                  | 129  | 68   | 37      | 23      | 1   | 123              |
| differentiate              | 3    | 3    | 0       | 0       | 0   | 3                |
| fft                        | 41   | 9    | 5       | 21      | 6   | 14               |
| integrate                  | 33   | 10   | 6       | 15      | 2   | 16               |
| interpolate                | 53   | 6    | 13      | 33      | 1   | 21               |
| linalg                     | 97   | 51   | 12      | 29      | 5   | 63               |
| ndimage                    | 75   | 0    | 5       | 70      | 0   | 5                |
| optimize                   | 71   | 14   | 21      | 32      | 4   | 35               |
| optimize.elementwise       | 4    | 0    | 2       | 2       | 0   | 2                |
| signal                     | 158  | 35   | 31      | 90      | 2   | 66               |
| signal.windows             | 26   | 15   | 1       | 10      | 0   | 16               |
| sparse                     | 54   | 9    | 15      | 18      | 12  | 24               |
| sparse.csgraph             | 26   | 4    | 7       | 9       | 6   | 11               |
| sparse.linalg              | 38   | 7    | 11      | 16      | 4   | 19               |
| spatial                    | 14   | 4    | 5       | 1       | 4   | 9                |
| spatial.distance           | 27   | 6    | 2       | 19      | 0   | 8                |
| spatial.transform          | 4    | 1    | 2       | 1       | 0   | 2                |
| special                    | 341  | 104  | 25      | 207     | 5   | 128              |
| stats.classes              | 9    | 1    | 0       | 8       | 0   | 1                |
| stats.contingency          | 7    | 1    | 2       | 4       | 0   | 3                |
| stats.descriptive          | 78   | 19   | 8       | 47      | 4   | 27               |
| stats.distribution-methods | 72   | 19   | 4       | 44      | 5   | 23               |
| stats.distributions        | 154  | 0    | 48      | 106     | 0   | 49               |
| stats.qmc                  | 11   | 0    | 0       | 11      | 0   | 0                |
| stats.tests                | 63   | 25   | 9       | 29      | 0   | 34               |
| **total**                  | 1627 | 411  | 273     | 879     | 64  | 705              |

### Runtime cases

| case module | cases | pass | bug | accuracy | gap/convention |
| ----------- | ----- | ---- | --- | -------- | -------------- |
| constants   | 152   | 130  | 0   | 0        | 22             |
| dist        | 340   | 327  | 13  | 0        | 0              |
| extra       | 128   | 121  | 1   | 0        | 6              |
| linalg      | 76    | 75   | 0   | 0        | 1              |
| numeric     | 83    | 70   | 4   | 0        | 9              |
| signal      | 115   | 108  | 0   | 0        | 7              |
| spatial     | 67    | 65   | 2   | 0        | 0              |
| special     | 322   | 303  | 5   | 5        | 9              |
| stats       | 130   | 119  | 4   | 3        | 4              |
| **total**   | 1413  | 1318 | 29  | 8        | 58             |

## 4. Bugs found (repro: `node verify/bugs/<file>`; captured output in `verify/bugs_output.txt`)

| id  | severity                                         | function and location                                                                                                                                                                                                   | minimal repro                          | MathTS                       | SciPy/mpmath                                                                                    |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| B3  | **high**                                         | `chiSquaredDist(k).quantile`, `chiSquaredQuantile` (functions/src/typed/dist-objects.ts:578-591), unguarded Newton from x0=k                                                                                            | `chiSquaredQuantile(0.05,3)`           | 3963327.3                    | 0.3518463                                                                                       |
| B7  | **high**                                         | `kendallPExact` (functions/src/kendall-exact.ts:46-50), in-place recurrence reads already-updated cells; affects every tie-free `kendalltau`/`kendallTauTest` with n≤33                                                 | n=20, 60 discordant pairs              | p=0.05068                    | p=0.02373                                                                                       |
| B1  | **high** (re-check of the pass-1 bug, confirmed) | `pchip` (functions/src/typed/numeric.ts:658-684): end slopes are the one-sided secant instead of SciPy's 3-point shape-preserving formula. `pchipInterp` (typed/interpolation.ts) is correct and matches SciPy exactly. | `pchip([0,1,2,3,4],[0,1,4,9,16],0.25)` | 0.2265625                    | 0.0859375 (rel 1.64; pass 1 reported "up to 12.5%"; it is worse in the first and last interval) |
| B9  | high                                             | `fresnelS`/`fresnelC` (functions/src/typed/special.ts:557-595), Maclaurin series only                                                                                                                                   | `fresnelC(5)`, `fresnelS(10)`          | -0.02839, -9.98e59           | 0.563631, 0.468170                                                                              |
| B10 | high                                             | `sinIntegral` (special.ts:~507) series only; `cosIntegral` (special.ts:~459) uses the series up to 35                                                                                                                   | `sinIntegral(60)`, `cosIntegral(30)`   | 1.58e7, -0.0330288           | 1.586746, -0.0330324                                                                            |
| B8  | high                                             | `eigsh` (functions/src/numeric/eigsh.ts:223): fixed 2k+20 Lanczos steps, no restart, no residual check, no `converged` flag                                                                                             | 200×200 tridiagonal, k=5               | λ5 = 7.2013                  | 7.4205                                                                                          |
| B2  | medium                                           | `dst` (typed/signal.ts:691-703) misses the 1/√2 on k=N-1, so it is not orthonormal and `idst(dst(x)) ≠ x`                                                                                                               | `idst(dst([1,2,3,4]))`                 | [0.793, 2.207, 2.793, 4.207] | [1, 2, 3, 4]                                                                                    |
| B4  | medium                                           | `tDist.quantile`/`studentTQuantile` (dist-objects.ts:1037-1048), bisection on ±1000                                                                                                                                     | `tDist(1).quantile(0.9999)`            | 1000                         | 3183.10                                                                                         |
| B5  | medium                                           | `fDist.quantile`/`fQuantile` (dist-objects.ts:700-714), hi=1000                                                                                                                                                         | `fDist(1,1).quantile(0.99)`            | 1000                         | 4052.18                                                                                         |
| B6  | medium                                           | `gammaDist.quantile` (dist-objects.ts:852-866) stops at an absolute width of 1e-12; `betaDist.quantile` (dist-objects.ts:428) clamps at 1e-15                                                                           | `gammaDist(0.3,1).quantile(1e-4)`      | 3.41e-13                     | 3.24e-14                                                                                        |
| B16 | medium                                           | `findPeaks` (functions/src/signal/spectral-peaks.ts:119) drops plateau maxima                                                                                                                                           | `findPeaks([0,1,0,2,2,0,3,1,4,0])`     | [1, 6, 8]                    | [1, 3, 6, 8]                                                                                    |
| B11 | low                                              | `gamma` (functions/src/plain/number/probability.ts:36) gives Infinity for x≥171.35, though Γ is finite up to 171.624                                                                                                    | `gamma(171.5)`                         | Infinity                     | 9.4834e307                                                                                      |
| B12 | low (accuracy)                                   | `kolmogorovSmirnovTest` p-value matches neither the exact nor the asymptotic method                                                                                                                                     | n=10 sample vs N(0,1)                  | 1.93e-9                      | 7.63e-16 exact, 1.28e-8 asymp                                                                   |
| B13 | low (validation)                                 | `multipleTest` treats any unknown method (e.g. 'by') as BH without an error                                                                                                                                             | `multipleTest(p,'by')`                 | BH values                    | BY values                                                                                       |
| B14 | low (accuracy)                                   | airyAi(5) 6e-10, erfcx(30) 1e-11, ellipticEIncomplete(1.2,0.8) 8e-11, carlsonRD 3.6e-11, carlsonRJ 4.4e-11 relative                                                                                                     | `verify/results_special.json`          |                              | mpmath                                                                                          |
| B15 | low (accuracy)                                   | `firls` integrates by trapezoid sampling (~2.4e-5 relative)                                                                                                                                                             | `firls(11,[0,.2,.4,1],[1,1,0,0])`      | -0.0349258                   | -0.0349249                                                                                      |
| -   | low (robustness)                                 | `zpk2sos` gives NaN silently for plain `{re,im}` roots (needs Complex instances)                                                                                                                                        |                                        | NaN                          |                                                                                                 |
| -   | low                                              | `solveBanded` does no pivoting and throws on a matrix that needs it ("zero pivot at row 0")                                                                                                                             |                                        | throws                       | SciPy solves it                                                                                 |

Behaviour differences that are documented or by convention are listed in `verify/results.md` and are not counted as bugs. Examples: Welch t-test by default, entropy in base 2, Silverman bandwidth for KDE, Hann-windowed periodogram, `fft2d` padding to a power of two, `year` = Julian year, and `bbl` = 31-gallon barrel.

## 5. Top gaps, ranked (priority, then how common the use is)

1. **Distribution objects lack sf/isf/logpdf/logcdf/logpmf/median/entropy/interval/std and generic loc/scale** (P0/P1: `rv_continuous.sf`, `.logpdf`; all 48 partial distributions).
2. **`minimize` is Nelder–Mead only.** There is no method dispatcher for BFGS, L-BFGS-B, Powell, CG, Newton-CG, trust-constr or SLSQP, and the result is `number[]` rather than an OptimizeResult (P0).
3. **`scipy.spatial.distance.cdist` is missing, `pdist` has Euclidean only, and `squareform`, `cosine`, `sqeuclidean` and `hamming` are missing** (P0/P1).
4. **ndimage is almost entirely missing**: gaussian_filter(1d), uniform/min/max filters, label, binary morphology, sobel, distance_transform_edt, zoom, rotate, affine_transform and map_coordinates (P0/P1, 70 of 75 rows).
5. **`cluster.hierarchy` is entirely missing**: linkage, fcluster, single/complete/average/ward (P0/P1, 31 rows).
6. **`CubicSpline` is natural-BC only.** There is no not-a-knot (SciPy's default), clamped or periodic option, and no PPoly derivative/integrate/roots. `Akima1DInterpolator`, `UnivariateSpline`, `PPoly` and explicit-knot LSQ splines are missing (P0/P1).
7. **`quad` has no infinite limits (tanhSinh doesn't either), and no `points=`/`weight=`.** `simpson` has no sample-array form (P0).
8. **`curve_fit`/`least_squares`**: no pcov, sigma or bounds, no trf/dogbox, no robust loss. `root` is fsolve only (P0).
9. **`solve_ivp`** has no dense_output, events or t_eval in the same call, and no DOP853 or LSODA (P0/P1).
10. **Signal filtering options**: `convolve`/`correlate` have only the full mode, `lfilter` has no `zi`, and `filtfilt` has no padtype/gust. `sosfiltfilt` and `tf2sos` are missing, and `butter`/`cheby` have no `output='sos'/'zpk'` or `analog=` (P0/P1).
11. **Spectral estimators don't follow SciPy's defaults or options**: welch, periodogram, stft, spectrogram (fs, detrend, scaling, periodic windows), `resample` (FFT), `decimate`. Also missing: bessel, cheb1ord, cheb2ord, ellipord, iirdesign and freqs (P0/P1).
12. **`stats.qmc`** is entirely missing: Sobol, Halton, LatinHypercube, discrepancy (P1).
13. **Missing special functions**: `betaln`, `betaincc`, `log_ndtr`, `logit`/`expit`, `xlogy`, `wofz`, `eval_chebyu`, real-argument `binom`, and `polylog` for |z|≥1 (`spence(2)` fails) (P1).
14. **sparse**: no `diags` constructor, no CSR storage class, no `lsqr`/`lsmr` (P1). `eigsh` needs the B8 fix first.
15. **linalg `eigh`/`lstsq`**: no dedicated symmetric solver with subset selection, and no residues/rank/sv outputs. `ifft2` exists in the source but is not exported, which pass 1 also found (P0/P1).

## 6. Where MathTS is ahead of SciPy (runtime-checked where stated)

- **Special functions SciPy lacks**, checked against mpmath at 1e-12 or better: general `polylog(s,z)` for |z|<1 (`polylog(3,0.5)`), `lerchPhi`, `barnesG`, `dirichletEta`.
- **Exact derivatives:** `derivativeAt` uses forward-mode dual numbers, so it is exact to rounding (2.837498137307049 vs the analytic 2.8374981373070494). `scipy.differentiate.derivative` uses finite-difference extrapolation. MathTS also has reverse-mode `grad`/`hessian` and symbolic `derivative`/`simplify`/`symbolicIntegral`, which have no SciPy equivalent.
- **Units:** physical constants are dimensioned Unit objects with conversion. All 46 CODATA constants checked agree with SciPy to 1e-9, and temperature conversion goes through the Unit system.
- Arbitrary precision (`BigNumber`), `Interval` arithmetic, quaternion and mat4 algebra, and an expression parser. SciPy has none of these. They were checked by name only, apart from the quaternion and slerp cases.
- Some extras match SciPy and are packaged more conveniently: `tanhSinh` handles endpoint singularities (∫log x and ∫1/√x are exact to 1e-10), and `chi2Contingency` returns Cramér's V.

## 7. Proposed build batches (each sized for one cloud-agent PR; ordered by priority, then dependency)

1. **Batch A, distribution quantile robustness** (fixes B3–B6; P0): replace the ad-hoc Newton/bisection with bracketed, safeguarded inversion that works in log space or uses `gammaincinv`/`betaincinv`. Functions: `chiSquaredDist.quantile`, `chiSquaredQuantile`, `tDist.quantile`, `studentTQuantile`, `fDist.quantile`, `fQuantile`, `gammaDist.quantile`, `gammaQuantile`, `betaDist.quantile`, `betaQuantile`; audit `invGaussDist.quantile` and `weibull`/`logNormal`. Add tail tests at p ∈ {1e-12, 1e-8, 1e-4, 0.9999}.
2. **Batch B, rank and test p-values** (B7, B12, B13; P0/P1): fix the `kendallPExact` recurrence (copy before subtracting); make the KS one-sample p-value exact (Simard–L'Ecuyer) with an asymptotic option; add 'by' to `multipleTest` and throw on unknown methods (accept 'fdr_bh'/'fdr_by' aliases).
3. **Batch C, special-function asymptotics** (B9, B10, B11, B14; P1): asymptotic auxiliary functions f/g for `fresnelS`/`fresnelC`, the Cephes-style asymptotic branch for `sinIntegral`/`cosIntegral` beyond x≈4, `gamma` via exp(lgamma) on 171.35–171.62, and tighter `airyAi`, `erfcx`, `ellipticEIncomplete`, `carlsonRD`, `carlsonRJ`.
4. **Batch D, interpolation and transform fixes** (B1, B2, B16; P0/P1): make `pchip` delegate to `pchipInterp`; give `dst`/`idst` the orthonormal k=N-1 factor plus `type`/`norm` options for `dct`/`dst`; handle plateaus in `findPeaks` (`plateau_size`); add a no-pad option to `fft2d` and export `ifft2`.
5. **Batch E, `eigsh`/`svds` robustness** (B8; P1): thick-restart or implicitly restarted Lanczos with full reorthogonalisation, a Ritz-residual stopping test, a `converged` flag and `ncv`. Re-check `svds`.
6. **Batch F, Distribution API breadth** (P0; depends on A): `sf`, `isf`, `logpdf`/`logpmf`, `logcdf`, `median`, `entropy`, `interval`, `std` and `moment` on every `*Dist` object, plus generic `loc`/`scale`. Promote function-only families (cauchy, laplace, logistic, skewnorm, vonmises, nakagami, rice, gev, invgamma) to objects. Add `genpareto` and `halfnorm`.
7. **Batch G, optimize front end** (P0): a `minimize(method=)` dispatcher (BFGS, L-BFGS-B with bounds, Powell, CG, trust-constr → `minimizeConstrained`) returning an OptimizeResult; `curve_fit` pcov/sigma/bounds; `least_squares` bounds and robust losses; `root(method=)`; `root_scalar`.
8. **Batch H, splines** (P0/P1): `CubicSpline` `bc_type` (not-a-knot by default, clamped, periodic) with PPoly derivative/integrate/roots, `Akima1DInterpolator`, `make_lsq_spline`/`LSQUnivariateSpline` with explicit knots, `UnivariateSpline(s=)`, Delaunay-based linear/nearest `griddata`, and a polynomial tail for RBF (thin_plate default).
9. **Batch I, integrate** (P0/P1): `quad` infinite limits (variable transform) plus `points=`/`weight=`; `tanhSinh` infinite limits; `solve_ivp`-style `dense_output`/`events`/`t_eval`, DOP853 and LSODA; sample-array `simpson`/`cumulative_simpson`/`romb`.
10. **Batch J, signal filtering API** (P0/P1): `mode=` for `convolve`/`correlate`, `lfilter` `zi`/`zf`, `filtfilt` padtype/padlen, `sosfiltfilt`, `tf2sos`, `output='sos'|'zpk'` and `analog=` for butter/cheby1/cheby2/ellip, `bessel`, `cheb1ord`/`cheb2ord`/`ellipord`, `iirdesign`/`iirfilter`, `freqs`, `freqz_sos`, `firwin` `pass_zero`/`window`/`scale`, `firwin2`.
11. **Batch K, spectral estimation parity** (P1; depends on J for windows): SciPy-compatible `welch`/`periodogram`/`csd`/`stft`/`spectrogram` (fs, nperseg/noverlap, detrend, scaling, periodic `get_window` with fftbins), FFT `resample`, `resample_poly`, `decimate` (ftype/zero_phase), `envelope`.
12. **Batch L, spatial distance and clustering** (P0/P1): `cdist` and `pdist` with metrics (sqeuclidean, cosine, cityblock, chebyshev, minkowski, hamming, jaccard, correlation), `squareform`, `cluster.hierarchy` (linkage single/complete/average/ward, fcluster, cophenet), `vq.vq`.
13. **Batch M, ndimage core** (P0/P1, a large area; split into M1 filters and M2 morphology/geometry if needed): N-D `gaussian_filter(1d)`, `uniform`/`minimum`/`maximum`/`median_filter` with `mode=`, `sobel`/`laplace`, `label`, `binary_erosion`/`dilation`, `distance_transform_edt`, `center_of_mass`, `zoom`/`rotate`/`affine_transform`/`map_coordinates`.
14. **Batch N, missing special functions** (P1): `betaln`, `betaincc`, `log_ndtr`, `logit`/`expit`, `xlogy`/`xlog1py`, `wofz`, `eval_chebyu`, real `binom`, `polylog` continuation for |z|≥1 (so `spence` works), and a plain-array `log_softmax`.
15. **Batch O, QMC and sparse odds and ends** (P1/P2): `qmc.Sobol`/`Halton`/`LatinHypercube`/`discrepancy`; `sparse.diags`, a CSR class, `lsqr`/`lsmr`; pivoting in `solveBanded`; make `zpk2sos` accept `{re,im}` roots.

## 8. What was NOT verified

- **856 missing rows** were checked only by two static methods (a normalised runtime export lookup and a source grep), not by running anything. This includes all of `cluster.hierarchy` and `stats.qmc` and 70 ndimage rows.
- **2 partial rows** are name-only plus export: `special.log_softmax` (TapedTensor method) and `spatial.transform.RigidTransform` (mat4 helpers).
- **Coverage within verified rows is representative, not exhaustive.** Each runtime-verified row has 1 to 18 cases. Option combinations, `axis=`, N-D arrays, complex arguments (most special functions were tested on real inputs only), extreme parameters (beyond the tail-quantile probes), dtypes, BigNumber paths and NaN policies were mostly not exercised.
- **Statistical checks are tolerance-based**: sampling (`sampleN`, `wishartSample`), `permutationTest`, `bootstrapCI`, `differentialEvolution`, `globalMinimize` and `simulatedAnnealing`. Reproducibility across seeds was not checked.
- **Global optimisers**: `globalMinimize` (basin hopping) and `simulatedAnnealing` did not reach the Rastrigin global minimum where SciPy's `dual_annealing` does. This was recorded as a gap and not investigated further.
- **CODATA uncertainties and units were not compared** (values only). The `physical_constants` dict was sampled at 27 of 445 entries.
- **Performance, memory, worker and WASM/GPU paths were not tested.** All calls went through the JS `functions`/`matrix`/`compat` builds on Node.
- **Spheroidal functions**: `spheroidalAngular`/`spheroidalRadial` differ from SciPy's `pro_ang1`/`pro_rad1`. The documented normalisation differs, but I did not establish whether it is a constant factor.
- **Pass-1 MATLAB/Mathematica rows** are outside this SciPy-only review.

## 9. Files

- [`inventory.csv`](data/scipy-inventory.csv) (1627 rows), `ref.json`, `scripts/enum_scipy.py`
- [`mapping.csv`](data/scipy-mapping.csv) (1627 rows), `curated/*.txt`, `scripts/build_mapping.py`, `scratch/mapping-problems.txt` (33 reviewed name collisions)
- `verify/`: the `cases_*.py` modules, `runner.mjs`, `run_all.sh`, `merge.py`, `results_*.json`, `results.json` (1413 classified cases), `results.md`, `bugs/*.mjs`, `bugs_output.txt`
- `SHA.txt`, `clone.log`, `install.log`, `build.log`, `scratch/private_counts.txt`
