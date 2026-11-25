> **In-repo archive** of the matlab deep parity review, produced on 2026-11-25
> (America/Chicago). MathTS commit at review time:
> [`e09eb301570b`](https://github.com/danielsimonjr/MathTS/commit/e09eb301570bbd18fbade0cdb4984a73bffafb54)
> (2026-11-25 07:41 CT).
> Related: issues [#1592](https://github.com/danielsimonjr/MathTS/issues/1592)–[#1713](https://github.com/danielsimonjr/MathTS/issues/1713),
> tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714).
> Sibling reviews and the merged report live in this folder; pass 1 is
> [2026-11-25-six-system-parity-review.md](../2026-11-25-six-system-parity-review.md).
> Imported data: [inventory](data/matlab-inventory.csv), [mapping](data/matlab-mapping.csv).
> Runtime harnesses, scripts, scratch, and vendored clones from the original
> working copy were not imported. Local paths have been rewritten to
> repo-relative links. Findings are otherwise unchanged.

# MathTS vs MATLAB: deep parity review

## Sources of truth (closed-system review)

This is a feature-coverage review of a closed-source system. MathTS
cannot run the closed system to check results. For correctness of
numeric and symbolic output, the sources of truth are **NumPy**,
**SciPy**, **SymPy**, and **PySR**. The closed system is a **feature
reference only**: it informs API shape and feature coverage, and it is
never used to verify numeric or symbolic output.

Where this report treats the closed system's documented or observed
behavior as expected output — including GNU Octave, mpmath, SymPy, or
other stand-in values used in its place — that expectation is
**unverified** as a closed-system result. A numeric or symbolic claim
is verified for MathTS only when it has been confirmed against NumPy,
SciPy, SymPy, or PySR.

Run date: 2026-11-25 (America/Chicago, CT). Read-only toward GitHub: no issues, PRs, pushes or comments were made.

## 1. Versions and sources

- **MathTS:** own clone at `deep/matlab/mathts`, SHA `e09eb301570bbd18fbade0cdb4984a73bffafb54` (commit time 2026-11-25 07:41 CT). Built with Bun 1.4.4 + turbo (`bun install && bun run build`, logs `install2.log`, `build2.log`).
  - Honesty note: after the box was replaced, the reinstall ran without `--frozen-lockfile`. Bun re-saved `bun.lock` in our private clone (it shows as modified locally and was not pushed). The source tree is otherwise the recorded SHA.
- **Reference (MATLAB):** MATLAB itself is closed source and not installed. The function inventory comes from MathWorks' official reference lists, `https://www.mathworks.com/help/<product>/referencelist.html` (category and alphabetical views, release tags up to R2026b), fetched 2026-11-25 and kept in `refs/`. There is one URL per row in [`inventory.csv`](data/matlab-inventory.csv).
  - Products: MATLAB, Symbolic Math, Optimization, Global Optimization, Signal Processing, Statistics and ML, Curve Fitting, Control System, PDE, Image Processing, DSP System.
- **Runtime reference engines:**
  - GNU Octave 9.4.0, with packages control 4.1.1, image 2.16.0, optim 1.6.2, signal 1.4.6, statistics 1.7.3, struct 1.0.18 and symbolic 3.2.1.
  - SciPy 1.18.1 / NumPy 2.5.5 / SymPy 1.14.0, in our own venv `venv-scipy`.
  - SciPy/SymPy was used where Octave lacks the function or is known to differ from MATLAB: partialcorr, ksdensity, jbtest, swtest, trimmean, corr 'type', pagemtimes, tensorprod, unidinv, mle normal sigma, fir1, ellip, flattopwin, nuttallwin, bilinear (Octave takes T, MATLAB takes fs), grpdelay and findpeaks options.

## 2. Method

1. **Inventory** ([`inventory.csv`](data/matlab-inventory.csv), 3203 rows): parsed from the MathWorks lists. Out-of-scope products and items (apps, GUI, code generation, Simulink, hardware, file I/O, and so on) are split into `out_of_scope.csv` (3438 rows). Rows inside in-scope files that are non-math were marked `n/a-out-of-scope` in the mapping.
2. **Mapping** ([`mapping.csv`](data/matlab-mapping.csv)): per-toolbox hand maps in `map/*.txt` (`name | loc@package | f/p/m/o | gaps | notes`), assembled by `build.py`.
   - Every MathTS location is checked against the built runtime exports (`checkloc.py`, 0 warnings).
   - Every **missing** claim used two methods: (a) a runtime export check, exact and case-insensitive, over 5063 runtime names; (b) a source grep for exported names in `*/src`. The 31 rows where method 2 found something were reviewed by hand: they are name collisions (for example `all` is the mathjs bundle, `.isEmpty` is a method, `norm` is the vector norm, not the LTI norm) or src-only code (`ifft2` exists in functions/src/signal/fft.ts but is not exported). The note is kept in each row.
   - Priority: P0 means core everyday MATLAB use; P2 means niche areas, DSP, and functions new since R2023. Two name collisions were excluded from P0 (graph `simplify`, control `norm`).
3. **Runtime differential checks** (`verify/`):
   - The `c_*.mjs` case files call MathTS. `run.mjs` produces `js_out.json`. `compare.py` generates the Octave script (`oct_cases.m`) and the Python script (`py_cases.py`), runs them, and compares the results.
   - Pass rule: `|a-b| <= tol * max(1,|b|)`, elementwise.
   - Tolerances: 1e-12 (299 checks), 1e-9 (247), exact (179), 1e-10 (141), 1e-8 (47), 1e-6 to 1e-5 for iterative or ODE code, and 2% for random-sampler means over 2e5 draws.
   - Every check records its engine and `ref_kind`: computed by the reference engine, or a hand/analytic constant.
   - **1047 checks:** 978 pass, 42 mismatch-convention (a documented convention difference), 21 FAIL, 6 mathts-error.
   - **Engines:** Octave 890 checks, SciPy/SymPy 153, constant-only 4.
   - **Rows covered:** 936 (toolbox, function) pairs have at least one check; 765 of them have at least one engine-computed reference. 171 rows rely only on hand/analytic constants, for example `gamma(5)=24`.
4. **Bugs:** each FAIL was minimised into `verify/repro_bugs.mjs` (output in `verify/repro_output.txt`) and documented in `verify/BUGS.md`.

## 3. Counts

**In-scope rows: 2226.** These split into full 490, partial 450 and missing 1286.

| Priority | full | partial | missing |
| -------- | ---- | ------- | ------- |
| P0       | 87   | 96      | 15      |
| P1       | 400  | 344     | 1052    |
| P2       | 3    | 10      | 219     |

**Runtime-verified** (`verified=runtime`): 919 of 2226 in-scope rows = **41.3%**, which meets the ≥40% target. That is 97.7% of the 940 full+partial rows. The other 1307 rows are `export+grep` (all missing rows plus 21 full/partial rows).

By toolbox (f/p/m):

| Toolbox                                 | P0 f/p/m | P1 f/p/m   | P2 f/p/m | out of scope | runtime-verified rows |
| --------------------------------------- | -------- | ---------- | -------- | ------------ | --------------------- |
| MATLAB                                  | 69/48/12 | 147/91/279 | 2/3/8    | 40           | 353                   |
| Symbolic Math Toolbox                   | 4/9/0    | 131/96/95  | 0/0/1    | 6            | 231                   |
| Optimization Toolbox                    | 0/8/1    | 0/2/30     | 0/0/5    | 15           | 14                    |
| Global Optimization Toolbox             | 0/0/0    | 0/5/11     | 0/0/0    | 35           | 5                     |
| Signal Processing Toolbox               | 3/10/0   | 26/26/204  | 0/0/10   | 90           | 62                    |
| Statistics and Machine Learning Toolbox | 11/13/0  | 94/79/150  | 1/2/63   | 163          | 199                   |
| Curve Fitting Toolbox                   | 0/1/0    | 1/9/42     | 0/0/0    | 27           | 12                    |
| Control System Toolbox                  | 0/4/2    | 1/16/92    | 0/0/4    | 269          | 20                    |
| Partial Differential Equation Toolbox   | 0/2/0    | 0/5/33     | 0/1/52   | 5            | 8                     |
| Image Processing Toolbox                | 0/1/0    | 0/7/111    | 0/0/6    | 7            | 11                    |
| DSP System Toolbox                      | 0/0/0    | 0/8/5      | 0/4/70   | 320          | 12                    |

## 4. Bugs found (details and repros: `verify/BUGS.md`)

| #   | Bug                                                                                                 | Engine             | Severity |
| --- | --------------------------------------------------------------------------------------------------- | ------------------ | -------- |
| B1  | pchip endpoint slopes wrong (`pchipInterp` is correct)                                              | Octave             | high     |
| B2  | fft2d zero-pads to a power of two, so the output shape is wrong; the correct fft2/ifft2 is src-only | Octave             | high     |
| B3  | chiSquaredQuantile diverges in the low tail (3.96e6 instead of 0.3518)                              | Octave             | high     |
| B4  | chi-square sampler is wrong for non-integer df (mean 3.0 for df 2.5)                                | analytic           | medium   |
| B5  | glm family 'binomial' silently runs gamma and throws                                                | Octave             | high     |
| B6  | collect('x*y+x','x') returns 2*x                                                                    | SymPy              | high     |
| B7  | simplify/fullSimplify miss sin²+cos²=1                                                              | Octave sym / SymPy | medium   |
| B8  | jordanForm returns a wrong P for defective matrices                                                 | Octave sym         | high     |
| B9  | degree/coefficientList treat strings as character arrays                                            | SymPy              | medium   |
| B10 | funm callback contract is broken (Math.exp gives NaN, M.exp throws)                                 | Octave             | medium   |
| B11 | hilbertTransform (and envelope) wrong for non-power-of-two length                                   | Octave             | high     |
| B12 | butter with an unrecognised btype returns NaN instead of an error                                   | Octave             | medium   |
| B13 | firls relative error 2.6e-5                                                                         | Octave + SciPy     | low      |
| B14 | one-sample KS p-value inaccurate (0.9919 vs exact 0.9858)                                           | Octave + SciPy     | medium   |
| B15 | continuedFraction has no termination tolerance (float noise)                                        | exact              | low      |
| B16 | firwinBandpass passband not normalised (gain 0.981)                                                 | SciPy              | low      |

Runtime capability failures: `integral` over an infinite range; symbolic definite integrals; `int(exp(-x)cos(x))`; `laplace(t sin t)`; `ilaplace(1/(s²+1)²)`.

## 5. Top gaps, ranked

Ranked by priority, then breadth of use.

1. **Array construction (P0):** linspace, logspace, repmat, repelem, meshgrid, ndgrid, freqspace.
2. **Logical and search (P0):** find, any, all, isinf, rem, plus allfinite, anynan, ismember/union variants, isequaln.
3. **Random and number basics (P0):** randn, primes, length; also ndims, isempty, isscalar as functions.
4. **Array manipulation:** fliplr, flipud, rot90, sortrows, ind2sub, sub2ind, ipermute, shiftdim, accumarray, head/tail, issorted.
5. **Integer and single dtypes:** int8 through uint64, single, cast, typecast, intmax/intmin, eps, realmax/realmin, flintmax, idivide. Tensor is always float64 (tensor/src/Tensor.ts:31).
6. **ifft2 export** and the fft2 fix (B2). Also nextpow2, pow2, cconv, xcorr2, convmtx.
7. **intlinprog** (MILP, P0), plus coneprog, fminimax, fgoalattain, fseminf, and problem-based optimization (optimvar/optimproblem).
8. **LTI control layer:** feedback, lqr (P0), series/parallel/connect, margin/allmargin, ctrb/obsv, place, kalman/lqg, dcgain, damp, stepinfo, minreal, balred, pid/pidtune, tf/ss/zpk objects, LTI norm.
9. **Data cleaning and moving statistics:** movsum, movmax, movmin, movstd, movvar, movmad, movprod; fillmissing, rmmissing, ismissing; isoutlier, filloutliers, rmoutliers; rescale, rms, bounds, maxk/mink, histcounts2, discretize; groupsummary/findgroups/splitapply.
10. **Filter design and analysis:** fir2, kaiserord, cheb1ord, cheb2ord, ellipord, designfilt, tf2sos, sos2zp, zp2ss, ss2sos, impz, stepz, zerophase, phasez, sgolay, levinson, lpc, arburg, aryule, yulewalk, fftfilt, downsample, interp, bandpower, snr, thd, sinad.
11. **Image processing:** imgaussfilt, medfilt2, imboxfilt, fspecial; imresize, imrotate, imcrop; morphology (imerode, imdilate, imopen, imclose, strel, imfill, bwmorph); histeq, imadjust, adapthisteq; radon, hough; dct2/idct2.
12. **Stats fitting and inference:** binofit, betafit, wblfit, evfit, gevfit, gpfit, unifit, raylfit; likelihoods and paramci; mvncdf, mvt*; fitgmdist, linkage, cluster, kmedoids; factoran, ppca, nnmf, cmdscale; ztest, vartest, lillietest; anovan, manova; fitlme, stepwiselm, mvregress, plsregress.
13. **Symbolic:** dsolve, finverse, poles, horner, equationsToMatrix; heaviside, dirac, kroneckerDelta; iztrans/htrans; DAE reduction tools; the Jacobi elliptic family; symbolic units; potential/vectorPotential. Also the CAS fixes B6–B9.
14. **PDE FEM:** createpde, femodel, BCs/ICs/loads, assembleFEMatrices, solvepdeeig, interpolateSolution.
15. **Curve-fitting objects and spline toolbox:** fittype, cfit/sfit, confint, predint; csaps, spaps; the fn* and knot utilities (fnder, fnint, fnval-style, augknt, optknt).

## 6. Where MathTS is ahead of MATLAB

All names below were confirmed present in the runtime exports.

- **One package instead of paid toolboxes:**
  - distributions and hypothesis tests: shapiroWilkTest, andersonDarlingTest, jarqueBera, durbinWatson, cohensD, hedgesG, bootstrapCI;
  - robust regression: theilSen, siegelSlopes (MATLAB has no Siegel slopes);
  - clustering: dbscan, spectralClustering;
  - gaussianProcessRegression, all without a toolbox licence.
- **Arbitrary precision and exact arithmetic in core:** bignumber and fraction types work across the API. MATLAB needs Symbolic `vpa`/`sym` for this.
- **Units in core** (`unit`), compared with MATLAB's Symbolic-only units.
- **Autograd** (`grad`), compared with MATLAB's dlarray in the Deep Learning Toolbox only.
- **Graph centralities** on plain matrices: katzCentrality, harmonicCentrality, pageRank, betweenness. MATLAB has no Katz or harmonic centrality.
- **Number theory beyond MATLAB core:** eulerPhi, jacobiSymbol, primitiveRoot.
- **Special functions:** pFq, polylog, lambertW, zeta, without the Symbolic toolbox.
- **Signal processing:** lombScargle (MATLAB plomb is Signal toolbox), multiTaperPSD, chirpZTransform, dtw, coherence/csd.
- **Numerics:** tanhSinh quadrature, solveDDE with event detection, solveBVP, solveParabolicPDE, fractionalMatrixPower, isolateRealRoots/realRoots, polynomialGCD/resultant, kdTree, procrustes, mvnPdf/wishartSample.
- **Async/parallel backends** (ParallelBackend, GPUBackend), and the `paretoFront` multi-objective helper.

## 7. Proposed build batches

Each batch is one cloud-agent PR, ordered by priority and dependency. "Package" is where the code belongs in MathTS; the parent can file one issue per batch/package. Typed implementations live in `functions`, re-exported via `compat`/`expression` where those apply.

| #   | Batch (root cause)                                           | Package                                                | Functions                                                                                                                                                                                                                              | Priority |
| --- | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | FFT padding bugs and src-only exports                        | functions (signal)                                     | fix fft2d (B2), hilbertTransform/envelope (B11); export fft2, ifft2 (functions/src/signal/fft.ts); add nextpow2, pow2, cconv                                                                                                           | P0       |
| 2   | Distribution numerical bugs                                  | functions (dist-objects, ml, hypothesis)               | chiSquaredQuantile/quantile (B3), chi2 sampler (B4), glm binomial/poisson/normal families (B5), KS one-sample p (B14)                                                                                                                  | P0       |
| 3   | Interpolation and filter-design bugs                         | functions (numeric, signal)                            | pchip endpoints (B1), butter btype validation and aliases (B12), firls precision (B13), firwinBandpass scaling option (B16)                                                                                                            | P0/P1    |
| 4   | CAS correctness                                              | functions (algebra, matrix-ops, numbertheory, numeric) | collect (B6), trig simplify rules (B7), jordanForm (B8), degree/coefficientList input validation (B9), continuedFraction tolerance (B15), funm callback (B10)                                                                          | P0/P1    |
| 5   | MATLAB array basics (P0)                                     | compat + functions (matrix utils)                      | linspace, logspace, repmat, repelem, meshgrid, ndgrid, find, any, all, isinf, rem, randn, primes, length, ndims, isempty, isscalar                                                                                                     | P0       |
| 6   | Array manipulation                                           | functions (matrix) / matrix                            | fliplr, flipud, rot90, sortrows, ind2sub, sub2ind, ipermute, shiftdim, accumarray, issorted, head, tail, histcounts2, discretize                                                                                                       | P1       |
| 7   | Degree trig and real-only math                               | functions (trigonometry/arithmetic)                    | sind, cosd, tand, asind, acosd, atand, atan2d, secd, cscd, cotd, sinpi, cospi, reallog, realpow, realsqrt, cart2sph, sph2cart                                                                                                          | P1       |
| 8   | Integer/single dtypes (depends on Tensor dtype work #760)    | tensor + numbers                                       | int8…uint64, single, cast, typecast, intmax, intmin, eps, realmax, realmin, flintmax, idivide, bitget, bitset, swapbytes                                                                                                               | P1       |
| 9   | Missing data, outliers, moving windows                       | statistics / functions                                 | movsum, movmax, movmin, movstd, movvar, movmad, movprod, fillmissing, rmmissing, ismissing, isoutlier, filloutliers, rmoutliers, rescale, rms, bounds, maxk, mink, findgroups, groupsummary, splitapply                                | P1       |
| 10  | Integration and symbolic-calculus capability                 | functions (numeric, cas)                               | integral/quadgk infinite limits, symbolic definite integrals, laplace/ilaplace table extension, dsolve, finverse, poles, horner, heaviside, dirac, kroneckerDelta, iztrans                                                             | P1       |
| 11  | Linear algebra extras                                        | linalg / functions                                     | lscov, rcond, condeig, normest, vecnorm, polyeig, polyvalm, polyint, gsvd, ordschur, ordeig, qrupdate/qrinsert/qrdelete, expmv, pageinv, issymmetric, ishermitian, istril, istriu, isdiag, isbanded, magic, gallery, rosser, wilkinson | P1       |
| 12  | MILP and constrained optimisation                            | functions (optimization)                               | intlinprog, coneprog, fminimax, fgoalattain, fseminf; then ga, particleswarm, patternsearch, surrogateopt (second PR)                                                                                                                  | P0/P1    |
| 13  | LTI control layer, part 1                                    | functions (control)                                    | tf/ss/zpk objects, feedback, series, parallel, lqr, dlqr, place, ctrb, obsv, dcgain, damp, margin, allmargin, stepinfo, lsiminfo, LTI norm                                                                                             | P0/P1    |
| 14  | LTI control, part 2                                          | functions (control)                                    | kalman, lqg, minreal, balreal, balred, hsvd, gram, c2d/d2c/d2d, pid, pidtune, nyquist/nichols/sigma data, tzero                                                                                                                        | P1       |
| 15  | Filter design and analysis                                   | signal / functions                                     | fir2, kaiserord, cheb1ord, cheb2ord, ellipord, yulewalk, tf2sos, sos2zp, zp2ss, ss2sos, impz, stepz, zerophase, phasez, sgolay, fftfilt, downsample, interp                                                                            | P1       |
| 16  | Spectral, linear-prediction and measurement                  | signal                                                 | levinson, lpc, arburg, aryule, arcov, prony, bandpower, snr, thd, sinad, sfdr, obw, powerbw, instfreq, findchangepts, finddelay, risetime, settlingtime                                                                                | P1       |
| 17  | Distribution fits and likelihoods                            | statistics / functions                                 | binofit, betafit, wblfit, evfit, gevfit/gev*, gp*, unifit, raylfit, nbinfit, ncx2/ncf/nct inv/rnd/stat, _like, paramci, mvncdf, mvt_                                                                                                   | P1       |
| 18  | Multivariate and models                                      | statistics / functions                                 | fitgmdist, linkage, cluster, kmedoids, factoran, ppca, nnmf, cmdscale, ztest, vartest, lillietest, anovan, manova, mvregress, plsregress, fitlme, stepwiselm                                                                           | P1       |
| 19  | Image filtering and morphology                               | new `image` module in functions (or a new package)     | fspecial, imgaussfilt, imboxfilt, medfilt2, ordfilt2, imresize, imrotate, imcrop, imerode, imdilate, imopen, imclose, strel, imfill, bwmorph, histeq, imadjust, adapthisteq, dct2, idct2, radon, hough                                 | P1       |
| 20  | PDE FEM                                                      | functions (pde)                                        | createpde, femodel, geometry/mesh, BC/IC/load objects, assembleFEMatrices, solvepde, solvepdeeig, interpolateSolution                                                                                                                  | P1       |
| 21  | Curve-fit objects and spline toolbox                         | functions (fitting)                                    | fittype, cfit, sfit, confint, predint, prepareCurveData, csaps, spaps, fnder, fnint, fnzeros, augknt, optknt, aptknt                                                                                                                   | P1       |
| 22  | MATLAB-compat conventions (option flags, no behaviour break) | compat                                                 | kurtosis flag, zscore/std weight flag, gamma scale/rate naming, ev min-type, normalised betweenness option, periodogram/pwelch/stft defaults, resample/decimate/filtfilt MATLAB modes, polynomial order convention                     | P1       |

**Dependencies:**

- Batch 8 (dtypes) depends on Tensor dtype support.
- Batch 14 depends on 13.
- Batches 15 and 16 should land after 3.
- Batch 22 should land after 5 and 9, because it adds MATLAB-mode flags to the functions those batches create.

## 8. Not verified (explicit)

- **All 1286 `missing` rows:** these are export+grep only (two methods), not runtime-differential.
- **21 full/partial rows with no runtime check:**
  - MATLAB: permute, pol2cart, pageeig, spconvert, amd, symamd.
  - Symbolic: fold, quorem, coeffs, divergence, gradient, laplacian, pade, fourier, ifourier, resultant.
  - Signal: bandpass, highpass, lowpass.
  - Stats: fitrgp.
  - Control: ssdata.
- **171 runtime rows checked only against hand/analytic constants,** not a reference engine.
- **Octave as a MATLAB proxy:** MATLAB itself was never run. Where Octave is known to differ, SciPy/SymPy or MATLAB's documented values were used. Residual Octave-vs-MATLAB differences we don't know about are possible.
- **Statistical samplers:** checked only by the mean of 2e5 draws at 2% tolerance. Variance, higher moments and distribution shape were not checked.
- **Unresolved items:**
  - lasso scaling: unresolved, counted as partial;
  - csAmd ordering quality: not checked;
  - stochastic optimizers: local minima with the seeds used, not judged as bugs.
- **Options:** coverage is representative-input only. Per-row option gaps are listed in `option_gaps` but were not runtime-tested option by option.
- **Out of scope** (`out_of_scope.csv`, 3438 rows, plus 977 `n/a-out-of-scope` mapping rows): not examined beyond classification.

## Files

This archive keeps this report plus [`inventory.csv`](data/matlab-inventory.csv) and [`mapping.csv`](data/matlab-mapping.csv). The original review also produced the following working-copy files (not imported):

- [`inventory.csv`](data/matlab-inventory.csv), `out_of_scope.csv`
- [`mapping.csv`](data/matlab-mapping.csv)
- `map/*.txt`, `build.py`, `checkloc.py`, `setrow.py`
- `verify/`:
  - case files: `c_core1-3.mjs`, `c_sym.mjs`, `c_sym2.mjs`, `c_signal.mjs`, `c_stats.mjs`, `c_misc.mjs`, `c_bulk.mjs`
  - harness: `run.mjs`, `compare.py`
  - results: `results.json`, `results.csv`, `cmp_all.txt`
  - bugs: `BUGS.md`, `repro_bugs.mjs`, `repro_output.txt`
  - `NOTES.md`
- `SHA.txt`, `refs/`, `REPORT.md`
