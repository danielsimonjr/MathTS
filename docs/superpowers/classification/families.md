# Parity classification: controlled family vocabulary

Controlled vocabulary of function-group families used to classify parity issues
#1592-#1713 (tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714)).
Slugs are **package-scoped labels** (`family:<slug>` uses the full slug including the
package prefix). **Implementation homes** are the directories where code actually lives;
thin re-export packages (`statistics`, `signal`, `linalg`, `arithmetic`, `trigonometry`,
`numbers`, …) list those homes explicitly rather than implying all logic lives under
their `src/index.ts`. Gap-only symbols are marked **planned (gap)** in the representative
column.

**63 families across 13 packages** (public npm scopes). The `functions` package carries
most implementation surface; re-export packages typically own one import path per family.

## functions

| slug                               | scope                                                                                                  | source dirs                                                                                                                            | representative functions                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `functions.array-creation`         | Array/matrix creation and grids                                                                        | functions/src/matrix (zeros, ones, identity, range), functions/src/typed                                                               | zeros, ones, identity, range, matrixFromFunction     |
| `functions.array-selection`        | where/select/choose, clip, isclose, find, logical compares (not raw ufunc math)                        | functions/src/logical, functions/src/relational, functions/src/typed                                                                   | clamp, larger, and, or, deepEqual                    |
| `functions.array-reductions`       | all/any, argmax/argmin, nan-aware reductions, percentile, cumreduce on **functions** matrix/stat paths | functions/src/statistics, functions/src/typed                                                                                          | sum, mean, max, cumsum, quantileSeq, mad             |
| `functions.array-sorting`          | sort/argsort, searchsorted, unique, set ops                                                            | functions/src/matrix/sort.ts, functions/src/matrix/partitionSelect.ts, functions/src/set                                               | sort, partitionSelect, setDistinct                   |
| `functions.array-reshaping`        | stack/split/tile/squeeze/flip/roll                                                                     | functions/src/matrix (concat, reshape, resize, squeeze, flatten), functions/src/typed                                                  | concat, reshape, squeeze, flatten                    |
| `functions.array-indexing`         | take, ind2sub, tril/triu, bincount, histogram, accumarray                                              | functions/src/matrix (diag, subset), functions/src/typed                                                                               | diag, subset, histogram, mapSlices                   |
| `functions.list-functional`        | List toolkit: map/filter/forEach/partition (not CAS Reduce)                                            | functions/src/matrix/map.ts, forEach.ts, filter patterns in matrix/                                                                    | map, filter, forEach                                 |
| `functions.polynomials`            | Power-basis polynomials: polyval, polyfit, roots, vander                                               | functions/src/typed/algebra.ts, functions/src/typed/interpolation.ts, functions/src/algebra/polynomialRoot.ts, functions/src/wasm/poly | polyval, polyFit, polynomialRoot, deconvolve         |
| `functions.orthogonal-polynomials` | Chebyshev/Legendre/Laguerre/Hermite series and Gauss nodes                                             | functions/src/numeric/gauss-nodes.ts, gauss-nodes-extra.ts, functions/src/typed/special.ts                                             | rootsChebyshevT, chebyshevT, hermiteH, laguerreL     |
| `functions.cas-simplify`           | simplify/collect/expand/factor, assumptions                                                            | functions/src/cas, functions/src/algebra/simplify*, functions/src/typed/cas.ts                                                         | casSimplify, simplify, collect, rationalize          |
| `functions.cas-calculus`           | symbolic integrate/differentiate, series, limits                                                       | functions/src/cas (antiderivative, taylor-jet, polynomial-limits), functions/src/algebra/derivative.ts                                 | integrate, derivative, series, limit                 |
| `functions.cas-solve`              | symbolic solve, groebner, Root objects                                                                 | functions/src/cas (closed-form-roots, elementary-solve), functions/src/algebra/solver                                                  | solve, polynomialRoot, symbolicSolve                 |
| `functions.cas-transforms`         | Heaviside/Dirac, laplace/fourier/ztrans, RSolve                                                        | functions/src/typed/cas.ts, functions/src/cas                                                                                          | zTransform, laplaceTransform, fourierTransform       |
| `functions.cas-symbolic-core`      | symbolic det/inverse/eigen, resultants                                                                 | functions/src/cas/syntax-tree.ts, functions/src/algebra, functions/src/algebra/sparse                                                  | sylvester, symbolicEqual                             |
| `functions.cas-ode`                | DSolve (symbolic ODE)                                                                                  | functions/src/cas, functions/src/typed/cas.ts                                                                                          | dsolve (planned gap)                                 |
| `functions.special`                | Bessel, gamma, erf, elliptic, hyp2f1, Fresnel, …                                                       | functions/src/special, functions/src/typed/special.ts                                                                                  | gamma, erf, besselJ, fresnelS                        |
| `functions.quadrature`             | quad, romberg, finite differences                                                                      | functions/src/numeric/adaptive-quad.ts, quadrature-extra.ts, finite-differences.ts                                                     | quad, romberg, derivativeAt                          |
| `functions.ode`                    | solveODE / DAE / DDE numeric                                                                           | functions/src/numeric/solveODE.ts, solveDAE.ts, solveDDE.ts                                                                            | solveODE, rk45                                       |
| `functions.optimization`           | minimize, fsolve, NNLS, global search                                                                  | functions/src/numeric (bfgs, fsolve, global-optimizers, nnls), functions/src/optimization-extra.ts                                     | minimize, fsolve, levenbergMarquardt, curvefit       |
| `functions.solve-blocks`           | Mathcad solve-block front ends                                                                         | functions/src/numeric (fsolve, constrained, solveODE), proposed typed layer                                                            | findRoot, minimize (block APIs planned)              |
| `functions.interpolation`          | splines, pchip, interpn, griddata                                                                      | functions/src/numeric/bspline.ts, interpn.ts, functions/src/typed/interpolation.ts                                                     | cubicSpline, pchip, pchipInterp, interpn             |
| `functions.curve-fitting`          | expfit/logfit, fittype, linregress, bounded fits                                                       | functions/src/fit-scalar.ts (shared), functions/src/ml, functions/src/typed/numeric.ts, optimization-extra.ts                          | curvefit, polyFit, linregress, levenbergMarquardt    |
| `functions.symbolic-regression`    | PySR-style scalar search                                                                               | functions/src/scalar-search.ts, scalar-compile.ts, scalar-dimension.ts, fit-scalar.ts (loss hooks)                                     | runScalarSearch, searchScalars, defineScalarOperator |
| `functions.geometry`               | hulls, Delaunay, meshes, coordinate transforms                                                         | functions/src/geometry, geometry-extra.ts, functions/src/typed/geometry.ts                                                             | delaunay, haversine, coordinateTransform             |
| `functions.graphs`                 | graph algorithms, centrality, coloring                                                                 | functions/src/graph (traversal-centrality, optimization, community-coloring)                                                           | graphColoring, louvainCommunities, katzCentrality    |
| `functions.numbertheory`           | primes, modular arithmetic, continued fractions                                                        | functions/src/numbertheory                                                                                                             | continuedFraction, gcd, isPrime                      |
| `functions.combinatorics`          | partitions, Gray codes, Stirling                                                                       | functions/src/combinatorics, functions/src/typed                                                                                       | bellNumbers, catalan, stirlingS2                     |
| `functions.control`                | LTI tf/ss/zpk (mostly planned)                                                                         | functions/src/numeric/control-equations.ts                                                                                             | control helpers today; tf/ss proposed                |
| `functions.pde-fem`                | FEM / solvepde (mostly planned)                                                                        | functions/src/numeric/solveParabolicPDE.ts                                                                                             | solveParabolicPDE                                    |
| `functions.finance`                | pv/fv/irr (proposed module)                                                                            | planned functions/src/finance                                                                                                          | pv, fv (planned gap)                                 |
| `functions.image`                  | image processing (proposed; issues may target future `@danielsimonjr/mathts-image`)                    | planned functions/src/image                                                                                                            | imfilter (planned gap)                               |

## signal

| slug                        | scope                                                                    | source dirs                                                                                 | representative functions                                        |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `signal.fft`                | fft/ifft/rfft, fft2/fftn, dct/dst, fftshift; gap: convmtx, xcorr2, cconv | functions/src/signal/fft-core-f64.ts, fft.ts, typed/signal.ts                               | fft, rfft, fft2d, dct, dst, parallelFFT; convmtx (planned gap)  |
| `signal.filtering`          | lfilter, filtfilt, convolve/correlate                                    | functions/src/signal/conv.ts, signal-filter-extra.ts, typed/signal.ts                       | lfilter, filtfilt, convolve                                     |
| `signal.filter-design`      | butter, firwin, remez, zpk/sos conversions                               | functions/src/signal/iir-design.ts, zpk2tf.ts, remez-exchange.ts                            | butter, firls, zpk2sos                                          |
| `signal.spectral`           | welch, periodogram, findPeaks, lomb-scargle                              | functions/src/signal/spectral-peaks.ts, spectral-segments.ts, lomb-scargle.ts, freqz.ts     | welchPSD, findPeaks, freqz, lombScargle; envelope (planned gap) |
| `signal.windows-waveforms`  | window constructors, chirp/square/sawtooth                               | functions/src/signal/windows-extra.ts, windowFunction in spectral-segments.ts, waveforms.ts | windowFunction, kaiserWindow, blackmanHarrisWindow, chirp       |
| `signal.wavelets-multirate` | wavelets, upfirdn, dtw                                                   | functions/src/signal/wavelets.ts, wavelet-filters.ts, dtw.ts                                | dwt, dtw                                                        |

## statistics

| slug                              | scope                                | source dirs                                                                                  | representative functions            |
| --------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| `statistics.distributions`        | *Dist pdf/cdf/quantile               | functions/src/typed/dist-objects.ts, distributions.ts, stats/distributions-extra.ts          | normalDist, chiSquaredQuantile      |
| `statistics.descriptive`          | cov/corr, robust stats, effect sizes | functions/src/statistics, stats/robust-stats.ts, descriptive-stats.ts                        | mean, std, mad, skewness            |
| `statistics.hypothesis`           | tests, ANOVA, multiple testing       | functions/src/typed/hypothesis.ts, stats/inference-extra*.ts                                 | tTest, kolmogorovSmirnovTest        |
| `statistics.distribution-fitting` | mle fits, paramci                    | functions/src/stats/fit-distribution.ts                                                      | fitDistribution                     |
| `statistics.regression-models`    | glm/ols/GP, factor analysis          | functions/src/ml (ols, glm, regularized-regression), functions/src/stats/gaussian-process.ts | glm, ols, gaussianProcessRegression |
| `statistics.clustering-distances` | cdist, dbscan, kde                   | functions/src/stats/distances.ts, ml/dbscan-knn.ts, ml/kde.ts                                | dbscan, kde                         |
| `statistics.random-sampling`      | Generator API, shuffle, quasi-MC     | functions/src/probability, stats/multivariate-sampling.ts                                    | random, pickRandom                  |
| `statistics.timeseries-processes` | ARMA/GARCH, TimeSeries               | functions/src/stats/timeseries.ts, timeseries-extra.ts                                       | ARIMA helpers                       |
| `statistics.doe-industrial`       | factorial designs, control charts    | functions/src/stats/power-analysis.ts, proportion-intervals.ts                               | powerAnalysis                       |
| `statistics.data-cleaning`        | mov*, fillmissing, smoothdata        | functions/src/typed/statistics.ts, statistics/                                               | mad, std; mov* planned              |

## linalg

| slug                      | scope                                   | source dirs                                                                                                | representative functions                                         |
| ------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `linalg.decompositions`   | lu/qr/eig/svd/schur in matrix package   | matrix/src/operations (lu, qr, eig, svd, cholesky, schur, lstsq, pinv), functions/src/linalg-extra*.ts     | lu, qr, eig, svd, lstsq                                          |
| `linalg.matrix-ops`       | funm, jordanForm, eigsh, Krylov         | functions/src/typed/matrix-ops.ts, numeric/matrix-functions.ts, eigsh.ts, krylov.ts, structured-solvers.ts | jordanForm, funm, matrixRank, eigsh                              |
| `linalg.special-matrices` | hilbert, predicates, gallery-class gaps | functions/src/linalg-special-matrices.ts, matrix/src/operations/common.ts                                  | hilbertMatrix; magic, gallery, rosser (planned gap); isSymmetric |

## matrix

| slug            | scope                                 | source dirs                                                                                             | representative functions         |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `matrix.sparse` | SparseMatrix, CSR/CSC, sparse solvers | matrix/src/types/SparseMatrix.ts, functions/src/algebra/sparse, functions/src/matrix/sparse-csc-tail.ts | SparseMatrix, sparse CSC helpers |

Dense `DenseMatrix` kernels and backends remain under `matrix/src` and `linalg.decompositions`;
no separate unused matrix family slug is required.

## tensor

| slug                     | scope                                         | source dirs                                                            | representative functions             |
| ------------------------ | --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| `tensor.dtypes`          | TensorDtype, astype, finfo/iinfo              | tensor/src/Tensor.ts                                                   | Tensor (float64 today), astype (gap) |
| `tensor.core-operations` | pad, stack, einsum, ndarray methods on Tensor | tensor/src/Tensor.ts, tensor/src/operations/*, contraction-sequence.ts | pad, concatenate, stack, einsum      |

## units

| slug                     | scope                                  | source dirs                                                   | representative functions             |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| `units.numeric-adapters` | strip/attach units in numeric routines | functions/src/unit, functions/src/numeric, core unit handling | unit-aware adapters (mostly planned) |
| `units.core-registry`    | Unit registry, constants               | core/src, functions/src/type/unit, functions/src/unit         | unit(), physical constants           |

## numbers

| slug                         | scope                                           | source dirs                                           | representative functions          |
| ---------------------------- | ----------------------------------------------- | ----------------------------------------------------- | --------------------------------- |
| `numbers.intervals`          | interval arithmetic, IntervalUnion              | functions/src/numeric/interval.ts, core numeric types | interval helpers, BigNumber       |
| `numbers.machine-limits`     | eps, realmax, nextafter, $MachineEpsilon        | core/src (BigNumber, numeric), numbers facade         | bignumber(), machine constants    |
| `numbers.precision-metadata` | Precision/Accuracy/SetPrecision (Wolfram-style) | numbers facade + core (mostly planned)                | Precision, Accuracy (planned gap) |

## arithmetic

| slug                     | scope                                                   | source dirs                                                 | representative functions          |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- |
| `arithmetic.elementwise` | ufunc-style elementwise math (exp2, fmod, heaviside, …) | functions/src/arithmetic, functions/src/typed/arithmetic.ts | dotMultiply, ceil, fix, heaviside |

## trigonometry

| slug                         | scope                                      | source dirs                                                     | representative functions         |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------------------- | -------------------------------- |
| `trigonometry.trig-variants` | sind/cosd/sinpi, degree variants on arrays | functions/src/trigonometry, functions/src/typed/trigonometry.ts | sin, cos, atan2, sec; sind (gap) |

Haversine great-circle distance is implemented in `functions.geometry` (`geometry-extra.ts`), not here.

## expression

| slug                  | scope                               | source dirs    | representative functions |
| --------------------- | ----------------------------------- | -------------- | ------------------------ |
| `expression.language` | parser, ranges, worksheet operators | expression/src | parse, evaluate, compile |

## compat

| slug                 | scope                                       | source dirs | representative functions |
| -------------------- | ------------------------------------------- | ----------- | ------------------------ |
| `compat.conventions` | MATLAB/Mathcad/Mathematica convention flags | compat/src  | create, all              |

## plot

| slug                | scope                          | source dirs | representative functions        |
| ------------------- | ------------------------------ | ----------- | ------------------------------- |
| `plot.data-helpers` | plot marks, polar/3D data prep | plot/src    | plot, marks, histogram, contour |
