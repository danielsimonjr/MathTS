> **In-repo archive** of the merged six-system deep parity report, produced on
> 2026-11-25 (America/Chicago). MathTS commit at review time:
> [`e09eb301570b`](https://github.com/danielsimonjr/MathTS/commit/e09eb301570bbd18fbade0cdb4984a73bffafb54)
> (2026-11-25 07:41 CT). Pass 1 used
> [`76f7a5b7f859`](https://github.com/danielsimonjr/MathTS/commit/76f7a5b7f859d29622b9300cd5ee9a7966f7b18d).
> Related: issues [#1592](https://github.com/danielsimonjr/MathTS/issues/1592)–[#1713](https://github.com/danielsimonjr/MathTS/issues/1713)
> (122 issues), tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714).
> Per-reference reviews: [numpy](numpy.md), [scipy](scipy.md), [pysr](pysr.md),
> [mathematica](mathematica.md), [mathcad](mathcad.md), [matlab](matlab.md).
> Pass 1 overview: [2026-11-25-six-system-parity-review.md](../2026-11-25-six-system-parity-review.md).
> Companion data: [merged-gaps.csv](data/merged-gaps.csv), [bugs.csv](data/bugs.csv),
> [filed.json](data/filed.json). Issue body drafts, filing scripts, and
> re-verification scratch from the original working copy were not imported.
> Local paths have been rewritten to repo-relative links. Findings are
> otherwise unchanged.

# MathTS six-system parity review: consolidated report

## Sources of truth

MathTS cannot run Mathematica, Mathcad, or MATLAB to check results. For
correctness of numeric and symbolic output, the sources of truth are
**NumPy**, **SciPy**, **SymPy**, and **PySR**.

Mathematica, Mathcad, and MATLAB are **feature references only**. They
inform API shape and feature-coverage decisions. They are never used to
verify numeric or symbolic output.

Where this report, or a companion deep review, treats a closed system's
documented or observed behavior as expected output — including GNU Octave
stand-in values used in place of MATLAB — that expectation is
**unverified** until it is confirmed against NumPy, SciPy, SymPy, or
PySR.

Generated 2026-11-25 (America/Chicago). Inputs: the six deep reviews under `docs/reports/2026-11-25-six-system-parity/{numpy,scipy,pysr,mathematica,mathcad,matlab}.md, with inventories and mappings in data/` (all at MathTS `master` @ `e09eb301`, which is still master HEAD) and pass 1 in `docs/reports/2026-11-25-six-system-parity-review.md`. Tracker: https://github.com/danielsimonjr/MathTS/issues/1714.

Actions taken on GitHub: created labels and issues only. No PRs, no code changes, no edits or closes of existing issues, no comments.

## 1. Package map (MathTS master e09eb301)

| Package                                                                           | Kind                    | Purpose / where the code lives                                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions`                                                                       | implementation          | Main math library: arithmetic, algebra/CAS, calculus, special functions, numerics (quadrature, ODE, optimisation, interpolation), polynomials, geometry, graphs, number theory, symbolic regression. Most code lives here. |
| `statistics`                                                                      | facade over functions   | Descriptive stats, distributions, hypothesis tests, combinatorics (implementation in functions/src/{stats,statistics,ml,probability}).                                                                                     |
| `signal`                                                                          | facade over functions   | FFT, filters, spectral analysis, windows, wavelets (implementation in functions/src/signal and typed/signal.ts).                                                                                                           |
| `linalg`                                                                          | facade over matrix      | Decompositions and matrix functions (implementation in matrix/src and functions/src/typed/matrix-ops.ts, numeric/*).                                                                                                       |
| `matrix`                                                                          | implementation          | DenseMatrix/SparseMatrix with WASM/WebGPU backends.                                                                                                                                                                        |
| `tensor`                                                                          | implementation          | Rank-N Float64Array Tensor (dtype tag fixed to float64).                                                                                                                                                                   |
| `autograd`                                                                        | implementation          | Forward/reverse autodiff on Tensor (no parity gaps assigned).                                                                                                                                                              |
| `units`                                                                           | facade over core        | Unit class, registry, SI prefixes (implementation in core/src; unit-aware numerics in functions).                                                                                                                          |
| `arithmetic`                                                                      | facade over functions   | Elementwise arithmetic functions.                                                                                                                                                                                          |
| `trigonometry`                                                                    | facade over functions   | Trigonometric functions.                                                                                                                                                                                                   |
| `numbers`                                                                         | facade over core        | Complex, Fraction, BigNumber.                                                                                                                                                                                              |
| `core`                                                                            | implementation          | Types, config, Unit class, dispatch (no parity batch assigned directly).                                                                                                                                                   |
| `expression`                                                                      | implementation          | Parser, evaluator, transforms, SR grammar builders.                                                                                                                                                                        |
| `parser / ast / evaluator`                                                        | facades over expression | Focused entry points (no batch assigned).                                                                                                                                                                                  |
| `compat`                                                                          | implementation          | mathjs-compatible layer; home for reference-system convention options.                                                                                                                                                     |
| `workbook`                                                                        | implementation          | .mtsw notebook runtime (Mathcad worksheet rows folded into EXPR-1).                                                                                                                                                        |
| `plot`                                                                            | implementation          | Headless SVG plotting.                                                                                                                                                                                                     |
| `gpu / parallel / assembly(wasm) / packages/typed-function / packages/workerpool` | implementation          | Backends and infrastructure (no parity batch assigned).                                                                                                                                                                    |

Ownership rule: a gap is filed against the package users import it from. For facade packages (signal, statistics, linalg, units, arithmetic, trigonometry, numbers) the issue names both the facade and the implementation path, because the code goes in `functions`/`matrix`/`core` and the export goes in the facade. Image processing has no home today; it is filed under `functions` with a proposal for a new `functions/src/image` module plus a focused entry point.

## 2. Headline counts

| Reference                                                                                         | rows | full | partial | missing | n/a |
| ------------------------------------------------------------------------------------------------- | ---- | ---- | ------- | ------- | --- |
| NumPy 2.5.5                                                                                       | 705  | 108  | 211     | 356     | 30  |
| SciPy 1.18.1                                                                                      | 1627 | 411  | 273     | 879     | 64  |
| MATLAB R2026b reference lists (GNU Octave 9.4 + SciPy/SymPy stand-ins)                            | 3203 | 490  | 450     | 1286    | 977 |
| PTC Mathcad Prime 12.0.1 (help pages; not executed - SciPy/SymPy/Pint stand-ins)                  | 724  | 296  | 198     | 197     | 33  |
| Mathematica / Wolfram Language (reference.wolfram.com; no kernel - SymPy 1.14 / mpmath stand-ins) | 3048 | 562  | 143     | 2095    | 248 |
| PySR 2.7.3 (SymbolicRegression.jl 2.7.2)                                                          | 307  | 100  | 46      | 129     | 32  |

Gap rows (missing+partial): 6263 → 6062 merged features in `gaps.csv` (153 shared by 2+ systems) + 63 report-text rows. Bugs: 52 after de-duplication ([`bugs.csv`](data/bugs.csv)), plus 1 skipped as a duplicate of #1560.

## 3. Method

1. Each mapping row with status missing/partial was assigned to one batch by rules on the reference area and name (`scripts/assign.py`, batch catalog `scripts/batches.py`).
2. Rows with the same normalised name inside a batch were merged; `refs` lists every system that has the feature, `priority` is the highest any review gave, `status` is partial if any review found a partial implementation.
3. Batches over 90 features were split into parts ordered by priority then name.
4. Bugs from all six reports were de-duplicated by root cause and function (`scripts/bugs.py`); the best repro was kept and the root-cause file:line references were checked against the e09eb301 source.
5. Second-method check: 39 of the 52 bugs were re-run on the built e09eb301 clone (`reverify*.mjs` → `reverify_output.txt`); each reproduced the reported wrong value (acsch, the #1560 duplicate, also reproduced). The other 13 bugs rely on the original reviews only.
6. Open issues (#1549-#1590 and 42 total) and the 525 closed issues were scanned for overlaps before filing.

## 4. Bugs (de-duplicated)

| Bug      | Issue                             | Package    | Function                                                                                                            | Pri | Found by                                                           | Re-verified                                         |
| -------- | --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------ | --------------------------------------------------- |
| BUG-01   | #1592                             | statistics | `chiSquaredQuantile, chiSquaredDist(k).quantile`                                                                    | P0  | scipy B3; matlab B3                                                | yes: 3963327.2976060137                             |
| BUG-02   | #1592                             | statistics | `tDist.quantile, studentTQuantile, fDist.quantile, fQuantile`                                                       | P1  | scipy B4, B5                                                       | yes: 999.9999999999995 for both                     |
| BUG-03   | #1592                             | statistics | `gammaDist.quantile, betaDist.quantile`                                                                             | P1  | scipy B6                                                           | no (reported by scipy review, bugs_output.txt)      |
| BUG-04   | #1592                             | statistics | `chiSquaredDist(k).sampleN`                                                                                         | P1  | matlab B4                                                          | yes: 3.0020258941238187                             |
| BUG-05   | #1593                             | statistics | `kendalltau, kendallTauTest (exact p-value, n<=33, no ties)`                                                        | P0  | scipy B7                                                           | yes: 0.050679876745129825                           |
| BUG-06   | #1593                             | statistics | `kolmogorovSmirnovTest (one-sample p-value)`                                                                        | P1  | scipy B12; matlab B14                                              | yes: 0.9919165462225639                             |
| BUG-07   | #1593                             | statistics | `multipleTest`                                                                                                      | P2  | scipy B13                                                          | yes: unknown method returned BH values              |
| BUG-08   | #1593                             | statistics | `glm({family:'binomial'\|'poisson'\|'normal'})`                                                                     | P0  | matlab B5                                                          | yes: throws gamma-family error                      |
| BUG-09   | #1593                             | statistics | `cov, std, variance (ddof validation)`                                                                              | P2  | numpy BUG-8                                                        | no                                                  |
| BUG-10   | #1594                             | signal     | `fft2d (and unexported fft2/ifft2)`                                                                                 | P0  | numpy BUG-1; matlab B2; scipy (documented convention note); pass 1 | yes: shape [4,4]                                    |
| BUG-11   | #1594                             | signal     | `hilbertTransform, envelope`                                                                                        | P0  | matlab B11                                                         | yes: [-1.5178,-1.5178,-1.3107,0.1036,2.0178,2.0178] |
| BUG-12   | #1594                             | signal     | `convolve, correlate, rfft (extra args ignored)`                                                                    | P1  | numpy BUG-6                                                        | yes (convolve): [1,3,6,9,12,9,5]                    |
| BUG-13   | #1594                             | signal     | `irfft`                                                                                                             | P2  | numpy BUG-7                                                        | yes: throws conj TypeError                          |
| BUG-14   | #1594                             | signal     | `sinc (array input)`                                                                                                | P2  | numpy BUG-3                                                        | yes: NaN                                            |
| BUG-15   | #1595                             | signal     | `dst, idst`                                                                                                         | P1  | scipy B2                                                           | yes: [0.7929,2.2071,2.7929,4.2071]                  |
| BUG-16   | #1595                             | signal     | `findPeaks`                                                                                                         | P1  | scipy B16                                                          | yes: [1,6,8]                                        |
| BUG-17   | #1595                             | signal     | `butter (btype validation)`                                                                                         | P1  | matlab B12                                                         | yes: NaN coefficients                               |
| BUG-18   | #1595                             | signal     | `firls`                                                                                                             | P2  | scipy B15; matlab B13                                              | no                                                  |
| BUG-19   | #1595                             | signal     | `firwinBandpass (passband scaling)`                                                                                 | P2  | matlab B16                                                         | no                                                  |
| BUG-20   | #1595                             | signal     | `zpk2sos`                                                                                                           | P2  | scipy (robustness note)                                            | no                                                  |
| BUG-21   | #1596                             | functions  | `fresnelS, fresnelC`                                                                                                | P0  | scipy B9; mathematica BUG-7                                        | yes: -9.977954194453338e+59, -0.028392951449120574  |
| BUG-22   | #1596                             | functions  | `sinIntegral, cosIntegral`                                                                                          | P0  | scipy B10; mathematica BUG-8                                       | yes: sinIntegral(60) = 15788599.2                   |
| BUG-23   | #1596                             | functions  | `gamma (near overflow)`                                                                                             | P2  | scipy B11; mathematica BUG-15                                      | yes: Infinity                                       |
| BUG-24   | #1596                             | functions  | `ellipticF (amplitude > pi/2)`                                                                                      | P0  | mathematica BUG-10                                                 | yes: 0.14182932992197916                            |
| BUG-25   | #1596                             | functions  | `hyp2f1 (z near 1)`                                                                                                 | P1  | mathematica BUG-11                                                 | yes: 14.514749893682831                             |
| BUG-26   | #1596                             | functions  | `airyAi, erfcx, ellipticEIncomplete, carlsonRD, carlsonRJ (accuracy)`                                               | P2  | scipy B14                                                          | no                                                  |
| BUG-27   | #1597                             | functions  | `casSimplify (negation)`                                                                                            | P0  | mathematica BUG-1                                                  | yes: '-x^2 + x - 1'                                 |
| BUG-28   | #1597                             | functions  | `collect`                                                                                                           | P0  | mathcad B2; mathematica BUG-13; matlab B6                          | yes: '2*x', '3*x'                                   |
| BUG-29   | #1597                             | functions  | `fullSimplify (decimal literals)`                                                                                   | P0  | mathcad B1                                                         | yes: '2.x'                                          |
| BUG-30   | #1597                             | functions  | `coefficientList, degree, resultant, discriminant, polynomialQuotient, polynomialRemainder, combine (string input)` | P1  | numpy BUG-9; mathcad B9; mathematica BUG-14, BUG-17; matlab B9     | yes: characters, 4, NaN                             |
| BUG-31   | #1597                             | functions  | `zTransform (unevaluated placeholder)`                                                                              | P2  | mathcad B10; mathematica BUG-16                                    | yes: 'Z{n^2}(z)'                                    |
| BUG-32   | #1598                             | functions  | `series (poles, fractional powers, rounding)`                                                                       | P0  | mathcad B3; mathematica BUG-5                                      | yes: '0.1666666667*x + 0.01944444444*x^3'           |
| BUG-33   | #1598                             | functions  | `limit (numeric sampling)`                                                                                          | P1  | mathcad B12; mathematica BUG-6                                     | yes: limit(floor(x),x,1) = 1                        |
| BUG-34   | #1598                             | functions  | `solve (complex / higher-degree roots)`                                                                             | P0  | mathematica BUG-2 (also mathcad/numpy polyroots gap)               | yes: []                                             |
| BUG-35   | #1598                             | functions  | `integrate (indefinite front door)`                                                                                 | P0  | mathematica BUG-3; matlab capability failures                      | yes: 'integral(exp(2*x), x)'                        |
| BUG-36   | #1598                             | functions  | `integrate (definite), quad/nintegrate infinite limits`                                                             | P0  | mathematica BUG-4; matlab capability failures; mathcad B5          | yes: Infinity                                       |
| BUG-37   | #1599                             | functions  | `pchip (end slopes)`                                                                                                | P0  | scipy B1; mathcad B8; mathematica BUG-9; matlab B1; pass 1         | yes: 0.2265625 (pchipInterp control 0.0859375)      |
| BUG-38   | #1599                             | functions  | `sort (NaN)`                                                                                                        | P1  | numpy BUG-5                                                        | yes: [2,NaN,1,3,NaN]                                |
| BUG-39   | #1599                             | functions  | `polyval (array x)`                                                                                                 | P2  | numpy BUG-3                                                        | yes: returns scalar 3                               |
| BUG-40   | #1599                             | functions  | `continuedFraction (termination)`                                                                                   | P2  | matlab B15                                                         | yes: [3,4,12,3,1,247777268231,...]                  |
| BUG-41   | #1599                             | functions  | `minimizeConstrained (infeasible problems)`                                                                         | P2  | mathcad (minor)                                                    | no                                                  |
| BUG-42   | #1600                             | functions  | `searchScalars / runScalarSearch (signal / time limit)`                                                             | P1  | pysr BUG-1                                                         | no (reproduced by the pysr review on Bun and Node)  |
| BUG-43   | #1600                             | functions  | `'huber' loss`                                                                                                      | P2  | pysr BUG-2                                                         | no                                                  |
| BUG-44   | #1600                             | functions  | `runScalarSearch option validation`                                                                                 | P2  | pysr FINDING-3                                                     | no                                                  |
| BUG-45   | #1601                             | linalg     | `jordanForm (defective matrices)`                                                                                   | P0  | matlab B8                                                          | yes: P=[[0,1],[1,0]]                                |
| BUG-46   | #1601                             | linalg     | `funm (callback contract)`                                                                                          | P1  | matlab B10                                                         | yes: all NaN                                        |
| BUG-47   | #1601                             | linalg     | `matrixRank (tolerance)`                                                                                            | P1  | numpy BUG-2                                                        | yes: 0                                              |
| BUG-48   | #1601                             | linalg     | `eigsh (and svds)`                                                                                                  | P1  | scipy B8                                                           | no                                                  |
| BUG-49   | #1601                             | linalg     | `solveBanded (pivoting)`                                                                                            | P2  | scipy (robustness note)                                            | no                                                  |
| BUG-50   | #1602                             | tensor     | `pad (Tensor) modes`                                                                                                | P1  | numpy BUG-4                                                        | yes: [3,2,1,2,3,2,1]                                |
| BUG-51   | #1603                             | units      | `linearInterp, cubicSpline, romberg, curvefit with Unit inputs`                                                     | P0  | mathcad B4                                                         | yes: '0 mNaN'                                       |
| BUG-52   | #1603                             | units      | `quad, nintegrate, findRoot, norm, lusolve with Units; sin/log of dimensioned values`                               | P1  | mathcad B5, B6, B7                                                 | no                                                  |
| DUP-1560 | #1560 (open, mathjs parity Relay) | functions  | `acsch(Complex)`                                                                                                    | -   | mathematica BUG-12                                                 | yes: throws                                         |

## 5. Issues by package

### statistics

| Issue | Batch        | Pri | Rows | Depends on | Title                                                                                                           |
| ----- | ------------ | --- | ---- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| #1592 | `STAT-BUG-1` | P0  | bugs | -          | [parity][statistics] Distribution quantile inversion and chi-square sampler are wrong in the tails (STAT-BUG-1) |
| #1593 | `STAT-BUG-2` | P0  | bugs | -          | [parity][statistics] Test p-values and model-family validation return wrong numbers silently (STAT-BUG-2)       |
| #1676 | `STAT-1`     | P0  | 72   | STAT-BUG-1 | [parity][statistics] Distribution object API breadth (STAT-1)                                                   |
| #1677 | `STAT-2-p1`  | P0  | 90   | STAT-1     | [parity][statistics] Probability distribution families (part 1/5) (STAT-2-p1)                                   |
| #1678 | `STAT-2-p2`  | P1  | 90   | STAT-1     | [parity][statistics] Probability distribution families (part 2/5) (STAT-2-p2)                                   |
| #1679 | `STAT-2-p3`  | P2  | 90   | STAT-1     | [parity][statistics] Probability distribution families (part 3/5) (STAT-2-p3)                                   |
| #1680 | `STAT-2-p4`  | P2  | 90   | STAT-1     | [parity][statistics] Probability distribution families (part 4/5) (STAT-2-p4)                                   |
| #1681 | `STAT-2-p5`  | P2  | 71   | STAT-1     | [parity][statistics] Probability distribution families (part 5/5) (STAT-2-p5)                                   |
| #1682 | `STAT-3`     | P0  | 65   | -          | [parity][statistics] Random Generator API and samplers (NumPy Generator) (STAT-3)                               |
| #1683 | `STAT-4-p1`  | P0  | 90   | -          | [parity][statistics] Descriptive statistics completion (part 1/3) (STAT-4-p1)                                   |
| #1684 | `STAT-4-p2`  | P2  | 90   | -          | [parity][statistics] Descriptive statistics completion (part 2/3) (STAT-4-p2)                                   |
| #1685 | `STAT-4-p3`  | P2  | 29   | -          | [parity][statistics] Descriptive statistics completion (part 3/3) (STAT-4-p3)                                   |
| #1686 | `STAT-5`     | P0  | 82   | STAT-BUG-2 | [parity][statistics] Hypothesis tests, ANOVA and resampling (STAT-5)                                            |
| #1687 | `STAT-6`     | P1  | 26   | STAT-2     | [parity][statistics] Distribution fitting and likelihoods (STAT-6)                                              |
| #1688 | `STAT-7`     | P0  | 67   | -          | [parity][statistics] Regression models and dimensionality reduction (STAT-7)                                    |
| #1689 | `STAT-8`     | P0  | 62   | -          | [parity][statistics] Spatial distances and clustering (STAT-8)                                                  |
| #1690 | `STAT-9`     | P1  | 11   | -          | [parity][statistics] Quasi-Monte Carlo sampling (STAT-9)                                                        |
| #1691 | `STAT-10-p1` | P1  | 90   | -          | [parity][statistics] Random processes and time series (part 1/2) (STAT-10-p1)                                   |
| #1692 | `STAT-10-p2` | P2  | 13   | -          | [parity][statistics] Random processes and time series (part 2/2) (STAT-10-p2)                                   |
| #1693 | `STAT-11`    | P0  | 63   | -          | [parity][statistics] Design of experiments and industrial statistics (STAT-11)                                  |
| #1694 | `STAT-12`    | P0  | 42   | -          | [parity][statistics] Missing data, outliers and moving-window statistics (STAT-12)                              |

### signal

| Issue | Batch       | Pri | Rows | Depends on | Title                                                                                                                         |
| ----- | ----------- | --- | ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| #1594 | `SIG-BUG-1` | P0  | bugs | -          | [parity][signal] FFT family pads to powers of two and ignores size/mode arguments (SIG-BUG-1)                                 |
| #1595 | `SIG-BUG-2` | P1  | bugs | -          | [parity][signal] Transform and filter-design correctness (dst, findPeaks, firls, butter, firwinBandpass, zpk2sos) (SIG-BUG-2) |
| #1695 | `SIG-1`     | P0  | 71   | SIG-BUG-1  | [parity][signal] FFT completeness (SIG-1)                                                                                     |
| #1696 | `SIG-2-p1`  | P0  | 90   | SIG-BUG-2  | [parity][signal] Filtering API and filter design (part 1/2) (SIG-2-p1)                                                        |
| #1697 | `SIG-2-p2`  | P1  | 59   | SIG-BUG-2  | [parity][signal] Filtering API and filter design (part 2/2) (SIG-2-p2)                                                        |
| #1698 | `SIG-3-p1`  | P0  | 90   | SIG-2      | [parity][signal] Spectral estimation, linear prediction and signal measurements (part 1/2) (SIG-3-p1)                         |
| #1699 | `SIG-3-p2`  | P1  | 37   | SIG-2      | [parity][signal] Spectral estimation, linear prediction and signal measurements (part 2/2) (SIG-3-p2)                         |
| #1700 | `SIG-4`     | P0  | 87   | -          | [parity][signal] Windows, waveform generation and smoothing (SIG-4)                                                           |
| #1701 | `SIG-5-p1`  | P0  | 90   | SIG-3      | [parity][signal] Multirate, wavelets, time-frequency and DSP System toolbox long tail (part 1/2) (SIG-5-p1)                   |
| #1702 | `SIG-5-p2`  | P2  | 39   | SIG-3      | [parity][signal] Multirate, wavelets, time-frequency and DSP System toolbox long tail (part 2/2) (SIG-5-p2)                   |

### functions

| Issue | Batch           | Pri | Rows | Depends on                 | Title                                                                                                                                                                         |
| ----- | --------------- | --- | ---- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1596 | `FN-BUG-SPEC`   | P0  | bugs | -                          | [parity][functions] Special functions: Fresnel, Si/Ci, gamma near overflow, ellipticF amplitude, hyp2f1 near 1, accuracy (FN-BUG-SPEC)                                        |
| #1597 | `FN-BUG-CAS-1`  | P0  | bugs | -                          | [parity][functions] CAS silent wrong answers: casSimplify negation, collect, fullSimplify decimals, string-coefficient helpers, zTransform placeholder (FN-BUG-CAS-1)         |
| #1598 | `FN-BUG-CAS-2`  | P0  | bugs | FN-BUG-CAS-1               | [parity][functions] CAS calculus wrong/incomplete results: series poles, numeric limits, solve missing complex roots, integrate front door, definite integrate (FN-BUG-CAS-2) |
| #1599 | `FN-BUG-NUM`    | P0  | bugs | -                          | [parity][functions] Numeric/array correctness: pchip end slopes, sort with NaN, polyval arrays, continuedFraction, minimizeConstrained infeasible (FN-BUG-NUM)                |
| #1600 | `FN-BUG-SR`     | P1  | bugs | -                          | [parity][functions] Symbolic regression: AbortSignal/timeouts cannot stop searchScalars, Huber loss is 2x, unknown options ignored (FN-BUG-SR)                                |
| #1604 | `FN-ARR-1`      | P0  | 33   | -                          | [parity][functions] Array creation and grids (FN-ARR-1)                                                                                                                       |
| #1608 | `FN-ARR-2`      | P0  | 52   | -                          | [parity][functions] Elementwise selection, predicates and comparisons (FN-ARR-2)                                                                                              |
| #1609 | `FN-ARR-3`      | P0  | 36   | FN-ARR-2                   | [parity][functions] Reductions: boolean, arg, nan-aware, keepdims/axis (FN-ARR-3)                                                                                             |
| #1610 | `FN-ARR-4`      | P0  | 28   | FN-BUG-NUM                 | [parity][functions] Sorting, searching and set operations (FN-ARR-4)                                                                                                          |
| #1611 | `FN-ARR-5`      | P0  | 53   | -                          | [parity][functions] Stacking, splitting, reshaping and flipping (FN-ARR-5)                                                                                                    |
| #1612 | `FN-ARR-6`      | P0  | 42   | FN-ARR-5                   | [parity][functions] Indexing helpers, binning and lookup (FN-ARR-6)                                                                                                           |
| #1613 | `FN-ARR-7`      | P0  | 76   | -                          | [parity][functions] List and functional primitives (Mathematica Lists & arrays) (FN-ARR-7)                                                                                    |
| #1614 | `FN-POLY-1`     | P0  | 31   | FN-BUG-CAS-1               | [parity][functions] Polynomial core: roots of any degree and power-basis series arithmetic (FN-POLY-1)                                                                        |
| #1615 | `FN-POLY-2`     | P2  | 55   | FN-POLY-1                  | [parity][functions] Orthogonal polynomial series A: Chebyshev and Legendre (numpy.polynomial) (FN-POLY-2)                                                                     |
| #1616 | `FN-POLY-3`     | P2  | 79   | FN-POLY-2                  | [parity][functions] Orthogonal polynomial series B: Laguerre, Hermite and HermiteE (numpy.polynomial) (FN-POLY-3)                                                             |
| #1617 | `FN-POLY-4`     | P1  | 22   | FN-POLY-3                  | [parity][functions] Polynomial convenience classes (Polynomial, Chebyshev, Legendre, Laguerre, Hermite, HermiteE) (FN-POLY-4)                                                 |
| #1618 | `FN-CAS-1`      | P0  | 62   | FN-BUG-CAS-1               | [parity][functions] CAS simplify engine and formula manipulation (FN-CAS-1)                                                                                                   |
| #1619 | `FN-CAS-2`      | P0  | 48   | FN-BUG-CAS-2, FN-CAS-1     | [parity][functions] Symbolic integration and differentiation breadth (FN-CAS-2)                                                                                               |
| #1620 | `FN-CAS-3`      | P0  | 60   | FN-BUG-CAS-2, FN-CAS-1     | [parity][functions] Series, limits and function analysis (FN-CAS-3)                                                                                                           |
| #1621 | `FN-CAS-4`      | P0  | 26   | FN-POLY-1, FN-CAS-1        | [parity][functions] Equation solving breadth (symbolic) (FN-CAS-4)                                                                                                            |
| #1622 | `FN-CAS-5`      | P0  | 72   | FN-CAS-1                   | [parity][functions] Generalised functions, integral transforms, symbolic sums and recurrences (FN-CAS-5)                                                                      |
| #1623 | `FN-CAS-6`      | P1  | 12   | FN-CAS-2, FN-CAS-5         | [parity][functions] DSolve: symbolic ODE solving (FN-CAS-6)                                                                                                                   |
| #1624 | `FN-CAS-7-p1`   | P0  | 90   | FN-BUG-CAS-1               | [parity][functions] Symbolic core, polynomial algebra and symbolic linear algebra (part 1/3) (FN-CAS-7-p1)                                                                    |
| #1625 | `FN-CAS-7-p2`   | P1  | 90   | FN-BUG-CAS-1               | [parity][functions] Symbolic core, polynomial algebra and symbolic linear algebra (part 2/3) (FN-CAS-7-p2)                                                                    |
| #1626 | `FN-CAS-7-p3`   | P2  | 2    | FN-BUG-CAS-1               | [parity][functions] Symbolic core, polynomial algebra and symbolic linear algebra (part 3/3) (FN-CAS-7-p3)                                                                    |
| #1627 | `FN-SPEC-1`     | P0  | 62   | FN-BUG-SPEC                | [parity][functions] Special functions: complex and extended domains (FN-SPEC-1)                                                                                               |
| #1628 | `FN-SPEC-2`     | P0  | 64   | FN-BUG-SPEC                | [parity][functions] Special functions: everyday missing functions (FN-SPEC-2)                                                                                                 |
| #1629 | `FN-SPEC-3-p1`  | P2  | 90   | FN-SPEC-1                  | [parity][functions] Special functions: long tail (scipy.special, Wolfram, MATLAB symbolic functions) (part 1/4) (FN-SPEC-3-p1)                                                |
| #1630 | `FN-SPEC-3-p2`  | P2  | 90   | FN-SPEC-1                  | [parity][functions] Special functions: long tail (scipy.special, Wolfram, MATLAB symbolic functions) (part 2/4) (FN-SPEC-3-p2)                                                |
| #1631 | `FN-SPEC-3-p3`  | P2  | 90   | FN-SPEC-1                  | [parity][functions] Special functions: long tail (scipy.special, Wolfram, MATLAB symbolic functions) (part 3/4) (FN-SPEC-3-p3)                                                |
| #1632 | `FN-SPEC-3-p4`  | P2  | 69   | FN-SPEC-1                  | [parity][functions] Special functions: long tail (scipy.special, Wolfram, MATLAB symbolic functions) (part 4/4) (FN-SPEC-3-p4)                                                |
| #1633 | `FN-NUM-1`      | P0  | 24   | FN-BUG-CAS-2               | [parity][functions] Quadrature and numeric differentiation (FN-NUM-1)                                                                                                         |
| #1634 | `FN-NUM-2-p1`   | P0  | 90   | -                          | [parity][functions] ODE solvers: solve_ivp parity, multistep, dynamical systems (part 1/2) (FN-NUM-2-p1)                                                                      |
| #1635 | `FN-NUM-2-p2`   | P2  | 13   | -                          | [parity][functions] ODE solvers: solve_ivp parity, multistep, dynamical systems (part 2/2) (FN-NUM-2-p2)                                                                      |
| #1636 | `FN-NUM-3`      | P0  | 67   | -                          | [parity][functions] Optimization front end (minimize methods, least squares, roots) (FN-NUM-3)                                                                                |
| #1637 | `FN-NUM-4`      | P0  | 73   | FN-NUM-3                   | [parity][functions] MILP, cone/quadratic programming and global optimization (FN-NUM-4)                                                                                       |
| #1640 | `FN-NUM-5`      | P0  | 12   | UNITS-1, UNITS-2, FN-NUM-3 | [parity][functions] Mathcad solve blocks (Given/Find/Minerr/Odesolve) (FN-NUM-5)                                                                                              |
| #1641 | `FN-NUM-6-p1`   | P0  | 90   | FN-BUG-NUM                 | [parity][functions] Interpolation and splines (part 1/2) (FN-NUM-6-p1)                                                                                                        |
| #1642 | `FN-NUM-6-p2`   | P2  | 33   | FN-BUG-NUM                 | [parity][functions] Interpolation and splines (part 2/2) (FN-NUM-6-p2)                                                                                                        |
| #1643 | `FN-NUM-7`      | P0  | 55   | FN-NUM-3                   | [parity][functions] Curve fitting objects and regression family (FN-NUM-7)                                                                                                    |
| #1644 | `FN-SR-2`       | P1  | 2    | FN-BUG-SR                  | [parity][functions] Symbolic regression: per-leaf constant optimisation (FN-SR-2)                                                                                             |
| #1645 | `FN-SR-3`       | P1  | 22   | FN-BUG-SR                  | [parity][functions] Symbolic regression: operator registry and smooth operators (FN-SR-3)                                                                                     |
| #1646 | `FN-SR-4`       | P1  | 19   | FN-SR-3                    | [parity][functions] Symbolic regression: non-smooth and logical operators (FN-SR-4)                                                                                           |
| #1647 | `FN-SR-5`       | P1  | 5    | FN-SR-3                    | [parity][functions] Symbolic regression: user-defined operators (FN-SR-5)                                                                                                     |
| #1648 | `FN-SR-6`       | P1  | 28   | FN-BUG-SR                  | [parity][functions] Symbolic regression: losses and objectives (FN-SR-6)                                                                                                      |
| #1649 | `FN-SR-7`       | P2  | 7    | -                          | [parity][functions] Symbolic regression: throughput (35-45x gap vs PySR) (FN-SR-7)                                                                                            |
| #1650 | `FN-SR-8`       | P1  | 6    | FN-BUG-SR                  | [parity][functions] Symbolic regression: parsimony, complexity and stopping (FN-SR-8)                                                                                         |
| #1651 | `FN-SR-9`       | P2  | 33   | FN-SR-5                    | [parity][functions] Symbolic regression: evolution controls, mutations and migration (FN-SR-9)                                                                                |
| #1652 | `FN-SR-10`      | P2  | 6    | FN-SR-7                    | [parity][functions] Symbolic regression: data-scale features (FN-SR-10)                                                                                                       |
| #1653 | `FN-SR-11`      | P1  | 33   | FN-SR-2                    | [parity][functions] Symbolic regression: estimator object, persistence, monitoring and export (FN-SR-11)                                                                      |
| #1654 | `FN-SR-12`      | P2  | 12   | FN-SR-5                    | [parity][functions] Symbolic regression: expression specs and types (FN-SR-12)                                                                                                |
| #1655 | `FN-GEOM-1-p1`  | P0  | 90   | -                          | [parity][functions] Computational geometry and regions (part 1/4) (FN-GEOM-1-p1)                                                                                              |
| #1656 | `FN-GEOM-1-p2`  | P2  | 90   | -                          | [parity][functions] Computational geometry and regions (part 2/4) (FN-GEOM-1-p2)                                                                                              |
| #1657 | `FN-GEOM-1-p3`  | P2  | 90   | -                          | [parity][functions] Computational geometry and regions (part 3/4) (FN-GEOM-1-p3)                                                                                              |
| #1658 | `FN-GEOM-1-p4`  | P2  | 26   | -                          | [parity][functions] Computational geometry and regions (part 4/4) (FN-GEOM-1-p4)                                                                                              |
| #1659 | `FN-GRAPH-1-p1` | P0  | 90   | -                          | [parity][functions] Graphs and networks (part 1/3) (FN-GRAPH-1-p1)                                                                                                            |
| #1660 | `FN-GRAPH-1-p2` | P2  | 90   | -                          | [parity][functions] Graphs and networks (part 2/3) (FN-GRAPH-1-p2)                                                                                                            |
| #1661 | `FN-GRAPH-1-p3` | P2  | 77   | -                          | [parity][functions] Graphs and networks (part 3/3) (FN-GRAPH-1-p3)                                                                                                            |
| #1662 | `FN-NT-1`       | P0  | 84   | FN-BUG-NUM                 | [parity][functions] Number theory (FN-NT-1)                                                                                                                                   |
| #1663 | `FN-COMB-1-p1`  | P0  | 90   | -                          | [parity][functions] Combinatorics and discrete math (part 1/2) (FN-COMB-1-p1)                                                                                                 |
| #1664 | `FN-COMB-1-p2`  | P2  | 45   | -                          | [parity][functions] Combinatorics and discrete math (part 2/2) (FN-COMB-1-p2)                                                                                                 |
| #1665 | `FN-CTRL-1`     | P0  | 48   | -                          | [parity][functions] Control systems: LTI models and classical design (FN-CTRL-1)                                                                                              |
| #1666 | `FN-CTRL-2-p1`  | P1  | 90   | FN-CTRL-1                  | [parity][functions] Control systems: estimation, reduction and discretisation (part 1/2) (FN-CTRL-2-p1)                                                                       |
| #1667 | `FN-CTRL-2-p2`  | P2  | 62   | FN-CTRL-1                  | [parity][functions] Control systems: estimation, reduction and discretisation (part 2/2) (FN-CTRL-2-p2)                                                                       |
| #1668 | `FN-PDE-1-p1`   | P0  | 90   | FN-NUM-2                   | [parity][functions] PDE and FEM (part 1/2) (FN-PDE-1-p1)                                                                                                                      |
| #1669 | `FN-PDE-1-p2`   | P2  | 37   | FN-NUM-2                   | [parity][functions] PDE and FEM (part 2/2) (FN-PDE-1-p2)                                                                                                                      |
| #1670 | `FN-FIN-1`      | P2  | 28   | -                          | [parity][functions] Finance and actuarial (FN-FIN-1)                                                                                                                          |
| #1671 | `FN-IMG-1-p1`   | P0  | 90   | -                          | [parity][functions] Image processing A: filtering, enhancement, colour and histograms (part 1/3) (FN-IMG-1-p1)                                                                |
| #1672 | `FN-IMG-1-p2`   | P2  | 90   | -                          | [parity][functions] Image processing A: filtering, enhancement, colour and histograms (part 2/3) (FN-IMG-1-p2)                                                                |
| #1673 | `FN-IMG-1-p3`   | P2  | 83   | -                          | [parity][functions] Image processing A: filtering, enhancement, colour and histograms (part 3/3) (FN-IMG-1-p3)                                                                |
| #1674 | `FN-IMG-2-p1`   | P0  | 90   | FN-IMG-1                   | [parity][functions] Image processing B: morphology, segmentation, geometry and image transforms (part 1/2) (FN-IMG-2-p1)                                                      |
| #1675 | `FN-IMG-2-p2`   | P2  | 25   | FN-IMG-1                   | [parity][functions] Image processing B: morphology, segmentation, geometry and image transforms (part 2/2) (FN-IMG-2-p2)                                                      |

### linalg

| Issue | Batch         | Pri | Rows | Depends on | Title                                                                                                                                     |
| ----- | ------------- | --- | ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| #1601 | `LINALG-BUG`  | P0  | bugs | -          | [parity][linalg] Linear-algebra correctness: jordanForm, funm, matrixRank tolerance, eigsh convergence, solveBanded pivoting (LINALG-BUG) |
| #1703 | `LINALG-1-p1` | P0  | 90   | LINALG-BUG | [parity][linalg] Linear algebra options, batching and missing decompositions (part 1/2) (LINALG-1-p1)                                     |
| #1704 | `LINALG-1-p2` | P2  | 78   | LINALG-BUG | [parity][linalg] Linear algebra options, batching and missing decompositions (part 2/2) (LINALG-1-p2)                                     |
| #1705 | `LINALG-2`    | P1  | 51   | -          | [parity][linalg] Matrix constructors, special matrices and structure predicates (LINALG-2)                                                |

### matrix

| Issue | Batch      | Pri | Rows | Depends on | Title                                                                                        |
| ----- | ---------- | --- | ---- | ---------- | -------------------------------------------------------------------------------------------- |
| #1706 | `MATRIX-1` | P0  | 82   | LINALG-BUG | [parity][matrix] Sparse matrices: constructors, formats and sparse linear algebra (MATRIX-1) |

### tensor

| Issue | Batch        | Pri | Rows | Depends on | Title                                                                                       |
| ----- | ------------ | --- | ---- | ---------- | ------------------------------------------------------------------------------------------- |
| #1602 | `TENSOR-BUG` | P1  | bugs | -          | [parity][tensor] Tensor pad: unknown modes silently fall through to reflect (TENSOR-BUG)    |
| #1707 | `TENSOR-1`   | P0  | 38   | -          | [parity][tensor] Tensor dtypes (follow-up to #760) (TENSOR-1)                               |
| #1708 | `TENSOR-2`   | P0  | 58   | TENSOR-1   | [parity][tensor] ndarray-style Tensor methods, einsum strings and tensor algebra (TENSOR-2) |

### units

| Issue | Batch        | Pri | Rows | Depends on | Title                                                                                               |
| ----- | ------------ | --- | ---- | ---------- | --------------------------------------------------------------------------------------------------- |
| #1603 | `UNITS-BUG`  | P0  | bugs | -          | [parity][units] Units fed to numeric routines give garbage strings or misleading errors (UNITS-BUG) |
| #1638 | `UNITS-1`    | P0  | 21   | UNITS-BUG  | [parity][units] Units through scalar numeric calculus (shared strip/re-attach adapter) (UNITS-1)    |
| #1639 | `UNITS-2`    | P0  | 20   | UNITS-1    | [parity][units] Units through data and matrix routines (UNITS-2)                                    |
| #1709 | `UNITS-3-p1` | P0  | 90   | -          | [parity][units] Unit systems, registry breadth and physical constants (part 1/2) (UNITS-3-p1)       |
| #1710 | `UNITS-3-p2` | P2  | 8    | -          | [parity][units] Unit systems, registry breadth and physical constants (part 2/2) (UNITS-3-p2)       |

### arithmetic

| Issue | Batch     | Pri | Rows | Depends on | Title                                                                                                     |
| ----- | --------- | --- | ---- | ---------- | --------------------------------------------------------------------------------------------------------- |
| #1605 | `ARITH-1` | P0  | 85   | FN-ARR-1   | [parity][arithmetic] Elementwise math completion (NumPy ufuncs, MATLAB/Mathcad elementary math) (ARITH-1) |

### trigonometry

| Issue | Batch    | Pri | Rows | Depends on | Title                                                                   |
| ----- | -------- | --- | ---- | ---------- | ----------------------------------------------------------------------- |
| #1606 | `TRIG-1` | P1  | 41   | -          | [parity][trigonometry] Degree-based and pi-scaled trigonometry (TRIG-1) |

### numbers

| Issue | Batch       | Pri | Rows | Depends on | Title                                                                        |
| ----- | ----------- | --- | ---- | ---------- | ---------------------------------------------------------------------------- |
| #1607 | `NUMBERS-1` | P0  | 29   | -          | [parity][numbers] Numeric precision and machine-number utilities (NUMBERS-1) |

### expression

| Issue | Batch    | Pri | Rows | Depends on | Title                                                                                                        |
| ----- | -------- | --- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| #1711 | `EXPR-1` | P0  | 32   | FN-NUM-5   | [parity][expression] Expression language: ranges, vectorisation, ORIGIN/TOL and worksheet operators (EXPR-1) |

### compat

| Issue | Batch      | Pri | Rows | Depends on        | Title                                                                                          |
| ----- | ---------- | --- | ---- | ----------------- | ---------------------------------------------------------------------------------------------- |
| #1712 | `COMPAT-1` | P1  | 27   | FN-ARR-1, STAT-12 | [parity][compat] Reference-system convention options (MATLAB, Mathcad, Mathematica) (COMPAT-1) |

### plot

| Issue | Batch    | Pri | Rows | Depends on | Title                                                           |
| ----- | -------- | --- | ---- | ---------- | --------------------------------------------------------------- |
| #1713 | `PLOT-1` | P1  | 9    | -          | [parity][plot] Plot data helpers from Mathcad graphing (PLOT-1) |

### Counts per package and priority

| Package      | P0  | P1  | P2  | total |
| ------------ | --- | --- | --- | ----- |
| statistics   | 11  | 4   | 6   | 21    |
| signal       | 6   | 3   | 1   | 10    |
| functions    | 35  | 12  | 25  | 72    |
| linalg       | 2   | 1   | 1   | 4     |
| matrix       | 1   | 0   | 0   | 1     |
| tensor       | 2   | 1   | 0   | 3     |
| units        | 4   | 0   | 1   | 5     |
| arithmetic   | 1   | 0   | 0   | 1     |
| trigonometry | 0   | 1   | 0   | 1     |
| numbers      | 1   | 0   | 0   | 1     |
| expression   | 1   | 0   | 0   | 1     |
| compat       | 0   | 1   | 0   | 1     |
| plot         | 0   | 1   | 0   | 1     |

## 6. Duplicates and related existing issues

- Skipped as duplicate: acsch(Complex) throws → #1560 (open).
- #760 Tensor dtypes is closed (fixed by a float64-only `dtype` tag); multi-dtype storage is filed as the follow-up TENSOR-1.
- Related, different bugs (closed): #777, #783, #1312, #926, #1023, #719, #884, #717, #832, #1145, #1303. Related open: #1583, #1589. None of the mathjs-parity issues #1549-#1589 overlap a six-system gap row beyond these.

## 7. What was and was not verified

- Missing rows: two static methods each (runtime export scan + source grep), no runtime call possible.
- Runtime differential coverage per review: NumPy 320/705 rows, SciPy 705/1627, PySR 144/307, Mathematica 443/3048, Mathcad 393/724, MATLAB 919/2226 in-scope.
- Mathematica, Mathcad and MATLAB were not run; reference values come from mpmath/SymPy/SciPy/Pint/GNU Octave with documented conventions applied by hand. See [Sources of truth](#sources-of-truth): closed-system behavior (and Octave stand-ins used in place of MATLAB) is unverified as a correctness oracle until confirmed against NumPy, SciPy, SymPy, or PySR.
- The batch assignment for long-tail rows is rule-based and may misplace some P2 rows; same-feature/different-name rows (e.g. argsort vs Ordering) are not merged.
- Issue priority is the highest row priority in the issue, which overstates some long-tail batches that contain a handful of P0 rows; per-row priorities are listed in each issue.
- The MATLAB clone used for re-verification has a locally re-saved `bun.lock` (the reinstall ran without --frozen-lockfile); source is e09eb301.

## 8. Files

This archive keeps this report plus [`merged-gaps.csv`](data/merged-gaps.csv), [`bugs.csv`](data/bugs.csv), and [`filed.json`](data/filed.json). The original review also produced the following working-copy files (not all imported):

- `gaps.csv`, `bugs.csv`, `REPORT.md`, `reverify.mjs`, `reverify2.mjs`, `reverify3.mjs`, `reverify_output.txt`
- `issues/filed.json` (ledger: a rerun of `scripts/file_issues.py` skips anything in it and also matches titles on GitHub), `issues/bodies/*.md`, `issues/tracker_body.md`, `issues/tracker.json`
- `scripts/` (batches.py, assign.py, consolidate.py, bugs.py, extras.py, render.py, file_issues.py, tracker.py, report.py)
- `open_issues.json`, `closed_issues.json` (snapshots used for the duplicate check)
