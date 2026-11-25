# Parity classification: controlled family vocabulary

Controlled vocabulary of function-group families used to classify parity issues
#1592-#1713 (tracker #1714). Slugs are package-scoped and grounded in the actual
source layout; where a family spans a thin re-export package (statistics, signal,
linalg, units, numbers, arithmetic, trigonometry), the source directories listed
are the real implementation home, and the public re-export package is the import
surface. Families marked *proposed* name code that does not exist yet.

62 families across 13 packages.

## functions

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `functions.array-creation` | Array/matrix creation and grids: linspace/logspace/geomspace, meshgrid, *_like creators, eye/identity/tri/diagflat, repmat/repelem | functions/src/matrix (zeros.ts, ones.ts, identity.ts, range.ts), functions/src/typed | zeros, ones, identity, range, matrix, matrixFromFunction |
| `functions.array-selection` | Elementwise selection, predicates and comparisons: where/select/choose, elementwise max/min, clip, isclose/allclose, find/nonzero, logical helpers | functions/src/logical, functions/src/relational, functions/src/typed | clamp, larger, and/or, deepEqual |
| `functions.array-reductions` | Reductions: all/any, argmax/argmin, nan-aware reductions, percentile, keepdims/axis variants, cumulative ops | functions/src/statistics, functions/src/typed | sum, mean, max, cumsum, quantileSeq, mad |
| `functions.array-sorting` | Sorting, searching and set operations: sort/argsort, searchsorted, unique, isin/ismember, sortrows, set_* family | functions/src/matrix/sort.ts, functions/src/matrix/partitionSelect.ts, functions/src/set | sort, partitionSelect, setDistinct, setIntersect |
| `functions.array-reshaping` | Stacking, splitting, reshaping and flipping: vstack/hstack, split family, tile/repeat, expandDims/squeeze, moveaxis, flip/roll/rot90, circshift | functions/src/matrix (concat.ts, reshape.ts, resize.ts, squeeze.ts, flatten.ts), functions/src/typed | concat, reshape, resize, squeeze, flatten |
| `functions.array-indexing` | Indexing helpers, binning and lookup: take/putAlongAxis, ind2sub/sub2ind, tril/triu indices, fillDiagonal, bincount/digitize/histogram, accumarray, lookup | functions/src/matrix (diag.ts, subset.ts), functions/src/typed | diag, subset, histogram, mapSlices |
| `functions.list-functional` | List/functional primitives (Wolfram lists & arrays): Nest/Fold/Position/Partition/Cases/Riffle/Append and the rest of the list toolkit | functions/src/matrix/map.ts, functions/src/matrix/forEach.ts, functions/src/typed | map, filter, forEach, reduce |
| `functions.polynomials` | Polynomial core: roots of any degree, polyval/polyfit/polydiv/polyint/power-basis arithmetic, vander, polyvalm | functions/src/typed/poly.ts, functions/src/wasm/poly, functions/src/algebra (polynomialRoot.ts, solver) | polyval, polyFit, polynomialRoot, deconvolve, characteristicPolynomial |
| `functions.orthogonal-polynomials` | Orthogonal polynomial series (numpy.polynomial): cheb*/leg*/lag*/herm*/herme* arithmetic, evaluation, fitting, roots, gauss nodes | functions/src/special/polygamma-orthopoly.ts, functions/src/numeric/gauss-nodes.ts | chebyshevFit, chebyshevApprox, rootsChebyshevT, hermite (nodes) |
| `functions.cas-simplify` | CAS simplify engine and formula manipulation: simplify/collect/expand/factor, trig rules, rational cancellation, assumptions | functions/src/cas, functions/src/algebra/simplify, functions/src/algebra/simplifyConstant.ts, functions/src/algebra/simplifyCore.ts, functions/src/typed/cas.ts | casSimplify, simplify, collect, fullSimplify, rationalize |
| `functions.cas-calculus` | CAS calculus, series and limits: symbolic integrate/differentiate, antiderivative breadth, Laurent/Puiseux series, symbolic limits, function analysis | functions/src/cas (antiderivative.ts, rational-integrate.ts, taylor-jet.ts, polynomial-limits.ts), functions/src/algebra/derivative.ts, functions/src/typed/cas.ts | integrate, symbolicIntegral, derivative, series, limit |
| `functions.cas-solve` | Symbolic equation solving: complete roots with radicals/Root objects, polynomial systems via groebnerBasis, Reduce/FindInstance, equationsToMatrix | functions/src/cas (closed-form-roots.ts, exact-roots.ts, real-roots.ts, elementary-solve.ts), functions/src/algebra/solver | solve, polynomialRoot, symbolicSolve |
| `functions.cas-transforms` | Generalised functions, integral transforms, symbolic sums and recurrences: Heaviside/DiracDelta, laplace/ilaplace, fourier, ztrans, closed-form Sum/Product, RSolve | functions/src/typed/cas.ts, functions/src/cas | zTransform, laplaceTransform, fourierTransform |
| `functions.cas-symbolic-core` | Symbolic core, polynomial algebra and symbolic linear algebra: symbolic variables/settings, coefficient/resultant/discriminant on expressions, symbolic det/inverse/eigen | functions/src/cas/syntax-tree.ts, functions/src/algebra, functions/src/algebra/sparse | sylvester, lyap, symbolicEqual, leafCount |
| `functions.cas-ode` | DSolve: symbolic ODE solving — first-order separable/linear/exact, constant-coefficient and Euler 2nd order, linear systems via matrix exponential | functions/src/cas, functions/src/typed/cas.ts | dsolve (proposed), solveODE (numeric counterpart) |
| `functions.special` | Special functions: Bessel/Airy/elliptic/hypergeometric/zeta/erf families, Fresnel, Si/Ci, complex-domain extensions and the scipy.special long tail | functions/src/special, functions/src/typed/special.ts | gamma, erf, besselJ, ellipticE, hyp2f1, fresnelS, airyAi |
| `functions.quadrature` | Quadrature and numeric differentiation: adaptive Gauss-Kronrod/tanh-sinh with infinite limits, simpson/romb, Ridders derivatives | functions/src/numeric/adaptive-quad.ts, functions/src/numeric/quadrature-extra.ts, functions/src/numeric/gauss-legendre4.ts, functions/src/numeric/finite-differences.ts, functions/src/typed | quad, romberg, simpson, derivativeAt, tanhSinh |
| `functions.ode` | ODE/DAE/DDE solvers: solve_ivp parity (RK/DOP853/LSODA/Adams/BDF), dense output, events, dynamical-systems helpers | functions/src/numeric (solveODE.ts, solveDAE.ts, solveDDE.ts, ode-norm.ts, ode-step-limit.ts), functions/src/typed | solveODE, rk4, rk45 |
| `functions.optimization` | Optimization: minimize method dispatcher, least squares/curve_fit bounds, root finding, MILP/cone/quadprog and global optimizers | functions/src/numeric (bfgs.ts, constrained.ts, global-optimizers.ts, fsolve.ts, minimize-scalar.ts, nnls.ts), functions/src/typed | minimize, curvefit, fsolve, findRoot, levenbergMarquardt |
| `functions.solve-blocks` | Mathcad solve blocks: solveBlock({unknowns, guesses, equalities, ...}) with find/minerr/minimize/odesolve front ends | functions/src/numeric (fsolve.ts, constrained.ts, solveODE.ts), functions/src/typed (proposed solve-block layer) | findRoot, minimize, solveODE (reusable block front ends) |
| `functions.interpolation` | Interpolation and splines: CubicSpline/Akima/BSpline objects, 2-D/N-D splines and griddata, RBF, pchip/pchipInterp | functions/src/numeric/bspline.ts, functions/src/numeric/interpn.ts, functions/src/typed/interpolation.ts | cubicSpline, pchip, pchipInterp, linearInterp, interpn |
| `functions.curve-fitting` | Curve fitting and regression family: Mathcad expfit/pwrfit/logfit/..., fittype/cfit objects, nonlinear regression, confidence intervals | functions/src/fit-scalar.ts, functions/src/ml (ols.ts, logistic-regression.ts, regularized-regression.ts), functions/src/typed | curvefit, polyFit, linregress, levenbergMarquardt |
| `functions.symbolic-regression` | Symbolic regression engine: scalar-search loop, operator registry, losses, evolution controls, estimator object/persistence/export | functions/src/scalar-search.ts, functions/src/scalar-compile.ts, functions/src/scalar-dimension.ts, functions/src/scalar-batch-parallel.ts, functions/src/fit-scalar.ts | runScalarSearch, searchScalars, defineScalarOperator |
| `functions.geometry` | Computational geometry and regions: hulls, Delaunay/Voronoi, alpha shapes, polyhedra, region objects and measures, triangulation | functions/src/geometry, functions/src/geometry-extra.ts | delaunay, voronoi, convexHull, circumcircle, quaternion |
| `functions.graphs` | Graphs and networks: graph/digraph objects, traversal/centrality, community detection, random graphs, connectivity | functions/src/graph (traversal-centrality.ts, optimization.ts, community-coloring.ts) | communityColoring, graph centrality helpers |
| `functions.numbertheory` | Number theory: primes, divisor functions, modular arithmetic, continued fractions, digits, Diophantine helpers | functions/src/numbertheory | isPrime, mod, gcd, continuedFraction, diophantine helpers |
| `functions.combinatorics` | Combinatorics and discrete math: permutation/partition/composition generators, Young tableaux, set partitions, Gray codes | functions/src/combinatorics, functions/src/typed | bellNumbers, catalan, stirlingS2, composition |
| `functions.control` | Control systems: LTI models (tf/ss/zpk), classical design, estimation/reduction/discretisation, PID tuning | functions/src/numeric/control-equations.ts, functions/src/typed (proposed control module) | control-equation helpers today; tf/ss/zpk objects proposed |
| `functions.pde-fem` | PDE and FEM: femodel/geometry/mesh, Dirichlet/Neumann conditions, assembly, solvepde, method of lines | functions/src/numeric/solveParabolicPDE.ts, functions/src/typed (proposed pde module) | solveParabolicPDE |
| `functions.finance` | Finance and actuarial: pv/fv/pmt/nper/rate/irr/npv, eff/nom, Wolfram finance symbols (proposed module) | proposed functions/src/finance (none today) | pv, fv, pmt, irr (all proposed) |
| `functions.image` | Image processing: N-D filters, edge operators, colour-space conversion, morphology, segmentation, image transforms (proposed functions/src/image) | proposed functions/src/image (none today) | imfilter, rgb2gray, label, radon (all proposed) |

## signal

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `signal.fft` | FFT family: fft/ifft/rfft/irfft with n/axis/norm, fft2/ifft2/fftn, dct/dst, fftshift, cconv, xcorr2, convmtx | functions/src/signal/fft-core-f64.ts, functions/src/signal/fft.ts, functions/src/signal/fft-helpers.ts, functions/src/signal/conv.ts, functions/src/typed/signal.ts | fft, ifft, rfft, fft2d, fftn, dct, dst, parallelFFT |
| `signal.filtering` | Filter application: lfilter zi/zf, filtfilt, sosfiltfilt, fftfilt, convolve/correlate modes | functions/src/signal (conv.ts, fir-smoothing.ts), functions/src/signal-filter-extra.ts, functions/src/typed/signal.ts | lfilter, filtfilt, convolve, correlate |
| `signal.filter-design` | Filter design: butter/cheby*/ellip/bessel, firwin/fir2/firls/remez, tf2sos/sos2zp/zp2ss conversions, iirdesign, *ord functions | functions/src/signal/iir-design.ts, functions/src/signal/zpk2tf.ts, functions/src/signal/remez-exchange.ts, functions/src/signal-filter-extra.ts | butter, cheby1, firwin, firls, zpk2tf, zpk2sos |
| `signal.spectral` | Spectral estimation, linear prediction and measurements: welch/periodogram/csd/stft, lpc/levinson, bandpower, snr/thd, peak metrics, lomb-scargle | functions/src/signal/spectral-peaks.ts, functions/src/signal/spectral-segments.ts, functions/src/signal/lomb-scargle.ts, functions/src/signal/freqz.ts, functions/src/typed/signal.ts | welchPSD, findPeaks, freqz, lombScargle, envelope |
| `signal.windows-waveforms` | Windows and waveform generation: window family, chirp/gausspulse/sawtooth/square, smoothing, cepstrum/walsh/quantize | functions/src/signal/windows-extra.ts, functions/src/signal/waveforms.ts, functions/src/signal/fir-smoothing.ts, functions/src/typed/signal.ts | hannWindow, blackmanWindow, chirp, square, sawtooth |
| `signal.wavelets-multirate` | Multirate, wavelets and time-frequency: upfirdn, CWT/wavelet families, time-frequency analysis, DSP System toolbox objects | functions/src/signal/wavelets.ts, functions/src/signal/wavelet-filters.ts, functions/src/signal/dtw.ts | wavelet helpers, dwt, dtw |

## statistics

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `statistics.distributions` | Distribution object API and families: *Dist objects (pdf/cdf/quantile/sf/entropy/...), missing continuous/discrete/multivariate families | functions/src/typed/dist-objects.ts, functions/src/typed/distributions.ts, functions/src/stats/distributions-extra.ts, functions/src/probability | normalDist, gammaDist, chiSquaredQuantile, tDist |
| `statistics.descriptive` | Descriptive statistics: cov/corrcoef forms, trimmed/winsorised/robust stats, MATLAB/Mathcad/Wolfram descriptive symbols, effect sizes | functions/src/statistics, functions/src/stats (robust-stats.ts, effect-sizes.ts, weighted-stats.ts), functions/src/descriptive-stats.ts | mean, std, cov, corr, mad, skewness, kurtosis |
| `statistics.hypothesis` | Hypothesis tests, ANOVA, resampling and multiple-testing: t/chi2/KS tests, contingency, bootstrap/permutation, multipleTest | functions/src/typed/hypothesis.ts, functions/src/stats/inference-extra.ts, functions/src/stats/inference-extra2.ts, functions/src/kendall-exact.ts | tTest, chiSquaredTest, kolmogorovSmirnovTest, multipleTest |
| `statistics.distribution-fitting` | Distribution fitting and likelihoods: *fit family, log-likelihoods, mle options, paramci | functions/src/stats/fit-distribution.ts, functions/src/typed/distributions.ts | fitDistribution, normFit, binofit-style fits |
| `statistics.regression-models` | Regression models and dimensionality reduction: fitlm/fitglm/fitlme parity, model objects, factoran/ppca/nnmf, GP regression | functions/src/ml (ols.ts, glm.ts, gaussian-process.ts, regularized-regression.ts), functions/src/stats/gaussian-process.ts | glm, ols, logisticRegression, gaussianProcess |
| `statistics.clustering-distances` | Spatial distances and clustering: cdist/pdist metrics, linkage/fcluster, vq, kmedoids, fitgmdist, knnsearch, KDE | functions/src/stats/distances.ts, functions/src/ml/dbscan-knn.ts, functions/src/ml/kde.ts, functions/src/stats/multivariate-sampling.ts | cdist-style distances, dbscan, kde, mvn |
| `statistics.random-sampling` | Random Generator API and sampling: Generator/BitGenerator/SeedSequence, defaultRng, choice/shuffle, quasi-Monte Carlo (Sobol/Halton/LHS) | functions/src/probability (random.ts, randomInt.ts, pickRandom.ts), functions/src/stats/multivariate-sampling.ts | random, randomInt, pickRandom, sampling helpers |
| `statistics.timeseries-processes` | Random processes and time series: Wiener/Poisson/Markov, AR/MA/ARMA/ARIMA/GARCH, TimeSeries, HMM | functions/src/stats/timeseries.ts, functions/src/timeseries-extra.ts | AR/ARIMA fit helpers, timeseries utilities |
| `statistics.doe-industrial` | Design of experiments and industrial statistics: factorial/Plackett-Burman/Box-Behnken designs, control charts, survival analysis | functions/src/stats/power-analysis.ts, functions/src/stats/proportion-intervals.ts, functions/src/typed (proposed doe module) | powerAnalysis helpers, proportion intervals |
| `statistics.data-cleaning` | Missing data, outliers and moving-window statistics: mov* family, fillmissing/rmmissing, isoutlier, rescale/normalize, smoothdata, groupsummary | functions/src/typed/statistics.ts, functions/src/statistics, functions/src/typed (proposed mov* module) | std, variance, mad; mov*/fillmissing proposed |

## linalg

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `linalg.decompositions` | Matrix decompositions and solvers: lu/qr/cholesky/eig/svd/schur + options, batching, lstsq/pinv/cond/norm | matrix/src/operations (lu.ts, qr.ts, eig.ts, svd.ts, cholesky.ts, schur.ts, lstsq.ts, pinv.ts), functions/src/linalg-extra*.ts | lu, qr, eig, svd, cholesky, schur, lstsq, pinv |
| `linalg.matrix-ops` | Matrix functions and structured/Krylov solvers: funm/jordanForm/matrixRank, eigsh/svds, solveBanded, expmv, polyeig | functions/src/typed/matrix-ops.ts, functions/src/numeric/matrix-functions.ts, functions/src/numeric/krylov.ts, functions/src/numeric/structured-solvers.ts, functions/src/numeric/eigsh.ts | jordanForm, funm, matrixRank, eigsh, svds, solveBanded |
| `linalg.special-matrices` | Matrix constructors, special matrices and structure predicates: magic/gallery/rosser, issymmetric/ishermitian/istril | functions/src/linalg-special-matrices.ts, functions/src/typed/matrix-ops.ts | magic, hilbert (special matrices), structure predicates |

## matrix

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `matrix.sparse` | Sparse matrices: sparse constructors (diags), CSR class, formats, sparse linear algebra (lsqr/lsmr/spsolve), sparse eig/svd | matrix/src (sparse support in operations/ + typed-operations.ts), functions/src/algebra/sparse, functions/src/matrix/sparse-csc-tail.ts | sparse, SparseMatrix, sparse-csc helpers |
| `matrix.dense-operations` | Dense matrix operations and construction on DenseMatrix: arithmetic, transpose, subset, concat, det/inv entry points | matrix/src/operations, matrix/src/typed-operations.ts, matrix/src/backends | DenseMatrix, multiply, transpose, det, inv |

## tensor

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `tensor.dtypes` | Tensor dtypes: TensorDtype beyond float64, astype, finfo/iinfo, resultType/promoteTypes | tensor/src/Tensor.ts, tensor/src/operations/random.ts (proposed dtype module) | Tensor (float64-only today), Tensor.full/zeros/ones |
| `tensor.core-operations` | ndarray-style Tensor methods and tensor algebra: pad/slice/gather/stack/roll, einsum strings, einsumPath, contraction sequences | tensor/src/Tensor.ts, tensor/src/operations (pad.ts, slice.ts, gather.ts, stack.ts, roll.ts), tensor/src/contraction-sequence.ts | Tensor.fromNested, pad, concatenate, stack, kron |

## units

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `units.numeric-adapters` | Units through numeric routines: strip/re-attach adapter for calculus, interpolation, fitting, matrix routines; accurate dimension errors | functions/src/unit, functions/src/numeric, core/src/unit handling in functions/src/typed | unit-aware quad/interp/fit adapters (proposed shared adapter) |
| `units.core-registry` | Unit systems, registry breadth and physical constants: CGS/USCS display systems, money dimension, scipy.constants names, Quantity functions | core/src (unit type definitions, constants.ts), functions/src/type/unit, functions/src/unit | unit(), Unit class, physical constants |

## numbers

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `numbers.precision` | Numeric precision and machine-number utilities: Precision/Accuracy, $MachineEpsilon family, interval arithmetic, Chop, per-number precision | numbers/src (facade), core/src (BigNumber, numeric), functions/src/numeric/interval.ts | BigNumber, bignumber(), interval helpers |

## arithmetic

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `arithmetic.elementwise` | Elementwise math completion (ufuncs): exp2, floorDivide, fmod, divmod, rint, heaviside, nextafter, spacing, frexp/modf, copysign/ldexp | functions/src/arithmetic, functions/src/typed/arithmetic.ts | ceil, floor, round, dotDivide, dotMultiply, dotPow, fix |

## trigonometry

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `trigonometry.trig-variants` | Degree-based and pi-scaled trigonometry: sind/cosd/.../atan2d, sinpi/cospi, cart2pol/cart2sph, haversine variants, Gudermannian | functions/src/trigonometry, functions/src/typed/trigonometry.ts | sin, cos, atan2, sec, csc, haversine |

## expression

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `expression.language` | Expression language features: ranges, vectorisation, ORIGIN/TOL, worksheet operators, parser/compiler surface | expression/src (Parser.ts, parse.ts, operators.ts, compiler, evaluator) | parse, evaluate, compile, Parser |

## compat

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `compat.conventions` | Reference-system convention options: opt-in MATLAB/Mathcad/Mathematica compatibility flags and wrappers | compat/src (shims.ts, instance-api.ts, unary-fast-path.ts) | create, all, instance wrappers |

## plot

| slug | scope | source dirs | representative functions |
|---|---|---|---|
| `plot.data-helpers` | Plot data helpers: data prep with units, polar/3-D helpers feeding the SVG/TikZ/PNG render bridge | plot/src (plot.ts, marks2d.ts, coerce.ts, scale.ts) | plot, marks, histogram, contour |

