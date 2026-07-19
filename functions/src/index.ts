/**
 * @danielsimonjr/mathts-functions
 *
 * Mathematical functions for MathTS - arithmetic, algebra,
 * trigonometry, statistics, and more.
 *
 * Uses typed-function for polymorphic dispatch across numeric types.
 *
 * @packageDocumentation
 */

// Typed functions (polymorphic via mathTyped)
export * from './typed/index.js';

// CAS functions — re-exported from the entry point rather than from
// `typed/index.js` so the module graph stays acyclic: `cas.ts` depends on the
// expression evaluator, which depends on the `typed/index.js` barrel.
export * from './typed/cas.js';

// Activated mathjs leaf factory functions
export * from './factories/index.js';
export { config } from './config-api.js'; // GC12: runtime config accessor

// Explicit re-export to resolve `to` / `toBest` ambiguity between the
// activated mathjs-derived factory layer (factories/index.js) and the new typed Unit
// implementation (typed/unit.js). The typed-dispatch version supersedes
// the factory version for the public barrel, mirroring how `cond` is
// resolved inside typed/index.js.
export { to, toBest } from './typed/unit.js';

// Expression evaluator (wired to full math scope)
export { evaluate, compileExpr, parse, parser, reviver, replacer } from './factories/evaluate.js';

// GC4 — mathjs canonical `help(search)` export (Help class + embedded docs).
export { help } from './help.js';

// Number-theory fills (Task 4): continued fractions, Euler numbers, signed
// Stirling 1st kind, discrete log (BSGS), primitive roots, multiplicative
// order, Kronecker symbol, and lexicographic permutation/combination
// enumerators (the existing `permutations`/`combinations` only count).
export {
  continuedFraction,
  eulerNumbers,
  stirlingS1,
  discreteLog,
  primitiveRoot,
  multiplicativeOrder,
  kroneckerSymbol,
  permutationsGen,
  combinationsGen,
} from './numbertheory/extra.js';

// Forward-mode AD over the plain functions surface (Dual-number overloading).
export { derivativeAt, valueAndDerivativeAt, gradientAt } from './grad-forward.js';
export type { DualFn } from './grad-forward.js';

// Gap-analysis Wave A — descriptive-statistics composites (reuse mean/std/quantileSeq).
export {
  gmean,
  hmean,
  moment,
  skewness,
  kurtosis,
  iqr,
  sem,
  zscore,
  cov,
  corrcoef,
  rankdata,
  spearman,
  kendallTau,
  linregress,
  pearsonr,
  spearmanr,
  kendalltau,
  kendallTauTest,
  ptp,
  variation,
  trimmedMean,
  describe,
  histogram,
} from './descriptive-stats.js';
export type {
  LinRegressResult,
  CorrelationTestResult,
  KendallTauTestResult,
  DescribeResult,
  HistogramResult,
} from './descriptive-stats.js';

// Gap-analysis Wave A — elementwise / cumulative / log-domain primitives.
export {
  clamp,
  sigmoid,
  logsumexp,
  softmax,
  cumprod,
  cummax,
  cummin,
  cumtrapz,
} from './numeric-extra.js';

// Gap-analysis Wave B — standalone distribution CDF/quantile surface (bridge C4).
export {
  normalQuantile,
  studentTCDF,
  studentTQuantile,
  chiSquaredCDF,
  chiSquaredQuantile,
  fCDF,
  fQuantile,
  gammaCDF,
  gammaQuantile,
  betaCDF,
  betaQuantile,
  cauchyPDF,
  cauchyCDF,
  cauchyQuantile,
  laplacePDF,
  laplaceCDF,
  laplaceQuantile,
  logisticPDF,
  logisticCDF,
  logisticQuantile,
} from './distribution-functions.js';

// Gap-analysis Wave B/D — additional hypothesis tests (bridge C9) + Tukey HSD.
export {
  fTest,
  jarqueBera,
  kruskalWallis,
  wilcoxon,
  fisherExact,
  studentizedRangeCDF,
  studentizedRangeQuantile,
  tukeyHSD,
} from './hypothesis-extra.js';
export type {
  FTestResult,
  JarqueBeraResult,
  KruskalResult,
  WilcoxonResult,
  FisherExactResult,
  TukeyComparison,
} from './hypothesis-extra.js';

// Gap-analysis Wave C — structured-matrix constructors + logdet + graph Laplacian
// (bridges C2, C5, C6).
export {
  tril,
  triu,
  vander,
  toeplitz,
  circulant,
  companion,
  logdet,
  laplacianMatrix,
  generalizedEig,
  qz,
} from './linalg-extra.js';

// Gap-analysis Wave C — numeric Hessian (bridge C3); Wave D — numeric gradient.
export { hessian, gradient } from './calculus-extra.js';

// Phase 1 Task 6 — full SVD (matrix package already has it; only
// singularValues/pinv were reachable from this surface) + orth (orthonormal
// basis for the column space, built on svd's U).
export { svd } from '@danielsimonjr/mathts-matrix';
export type { SVDResult, SVDOptions } from '@danielsimonjr/mathts-matrix';
export { orth } from './linalg-svd-extra.js';
export type { OrthOptions } from './linalg-svd-extra.js';

// Numeric Jacobian (F: R^n -> R^m, central differences) — foundation for
// fsolve (Phase 1 Task 3). Complements the symbolic `jacobian` (typed/cas.ts).
export { numericJacobian } from './numeric/numeric-jacobian.js';
export type { VectorField, NumericJacobianOptions } from './numeric/numeric-jacobian.js';

// Phase 1 Task 2 — open (non-bracketing) scalar root-finders. Complement the
// bracketing `findRoot` (bisection/Brent, typed/numeric.ts).
export { newton, secant, halley } from './numeric/open-root-finders.js';
export type { NewtonOptions, SecantOptions, HalleyOptions } from './numeric/open-root-finders.js';

// Phase 1 Task 3 — nonlinear system solver (damped Newton), reusing
// numericJacobian (Task 1) + linsolve (typed/numeric.ts). `root` is an alias.
export { fsolve, root } from './numeric/fsolve.js';
export type { FsolveOptions } from './numeric/fsolve.js';

// Phase 7 Task 1 — iterative Krylov-subspace linear solvers (cg/minres for
// symmetric systems, gmres/bicgstab for general nonsymmetric ones) for the
// large sparse systems a dense factorization can't handle. Each accepts a
// dense matrix or a matvec callback plus an optional Jacobi preconditioner.
export { cg, minres, gmres, bicgstab, incompleteLU, incompleteCholesky } from './numeric/krylov.js';
export type {
  LinearOperatorInput,
  Preconditioner,
  KrylovOptions,
  GmresOptions,
  KrylovResult,
} from './numeric/krylov.js';

// Phase 7 Task 2 — eigsh: iterative Lanczos symmetric eigensolver returning
// the k largest/smallest eigenpairs of a symmetric matrix (dense or matvec),
// for large problems where the dense `eigs` (full eigendecomposition) is
// prohibitive.
export { eigsh } from './numeric/eigsh.js';
export type { EigshOperatorInput, EigshOptions, EigshResult } from './numeric/eigsh.js';

// Sparse / partial SVD — the top-k singular triplets via Lanczos on the
// smaller normal operator (AᵀA / AAᵀ), for large/sparse A where a full `svd`
// is wasteful. Singular values returned descending (opposite of scipy svds).
export { svds } from './numeric/svds.js';
export type { SvdsOptions, SvdsResult } from './numeric/svds.js';

// Phase 7 Task 3 — structured & indefinite direct solvers: O(n) tridiagonal
// (thomasSolve), banded-aware Gaussian elimination (solveBanded), O(n^2)
// Toeplitz via Levinson-Durbin (toeplitzSolve), and Bunch-Kaufman-pivoted
// LDL^T for symmetric indefinite matrices (ldl) — for structure `lusolve`/
// `cholesky` don't exploit.
export { thomasSolve, solveBanded, toeplitzSolve, ldl } from './numeric/structured-solvers.js';
export type { LDLResult } from './numeric/structured-solvers.js';

// Phase 7 Task 4 — complex matrix functions: `funm(A, f)` evaluates a general
// matrix function returning a complex-valued result (via diagonal fast path
// or Lagrange-Sylvester interpolation on the spectrum for diagonalizable
// matrices with distinct eigenvalues), plus `cosm`/`sinm` built on it — so
// indefinite/complex-spectrum inputs work where `sqrtm`/`matrixLogm` only
// handle real positive spectra.
export { funm, cosm, sinm, complexCos, complexSin } from './numeric/matrix-functions.js';
export type {
  ComplexValue,
  ComplexMatrix,
  ScalarComplexFunction,
} from './numeric/matrix-functions.js';

// Phase 7 Task 5 — control-theory matrix equations for LQR/Kalman design:
// `dlyap` (discrete Lyapunov, via an explicit Kronecker-product linear
// system), `care`/`dare` (continuous/discrete algebraic Riccati, via the
// matrix sign function / structure-preserving doubling algorithm — neither
// needs a stabilizing initial gain or complex eigenvectors), complementing
// the existing continuous `sylvester`/`lyap`.
export { dlyap, care, dare } from './numeric/control-equations.js';

// Phase 1 Task 4 — scalar minimizer (Brent's method: golden-section +
// parabolic interpolation). Distinct from root-finding; complements the
// vector Nelder–Mead `minimize` (typed/numeric.ts) for the 1-D case.
export { minimizeScalar } from './numeric/minimize-scalar.js';
export type { MinimizeScalarOptions, MinimizeScalarResult } from './numeric/minimize-scalar.js';

// Phase 1 Task 5 — adaptive Gauss-Kronrod (G7-K15) quadrature. `nintegrate`
// (typed/numeric.ts) now routes through this, fixing its endpoint-singular
// accuracy (was ~1.7e-6 off on x^-1/2, now ~1e-10).
export { quad } from './numeric/adaptive-quad.js';
export type { QuadOptions, QuadResult } from './numeric/adaptive-quad.js';

// Phase 8 Task 4 — regular-grid N-D multilinear interpolation, matching
// `scipy.interpolate.interpn`. Distinct from `griddata`/`rbfInterpolate`
// (scattered-data) — this requires a rectilinear grid but is exact O(2^n)
// per query rather than a scattered-data reconstruction.
export { interpn } from './numeric/interpn.js';
export type { NDArrayInput } from './numeric/interpn.js';

// B-spline fitting (de Boor collocation for s=0 interpolation, least-squares
// smoothing for s>0) + de Boor evaluation. Distinct from the existing
// control-point `bspline(controlPoints, degree, t)` curve evaluator
// (typed/numeric.ts) — this fits data (x, y), matching scipy's
// `splrep`/`splev` tck-tuple convention.
export { bsplineFit, bsplineEval } from './numeric/bspline.js';
export type { BSplineFitOptions, BSplineTuple } from './numeric/bspline.js';

// Monte-Carlo / quasi-Monte-Carlo integration over an axis-aligned box:
// uniform (seeded RNG, variance-based stderr), Halton (dimension-general
// low-discrepancy), Sobol (dimensions 1-2, forced direction numbers, no
// external table — see monte-carlo.ts module doc).
export { monteCarloIntegrate } from './numeric/monte-carlo.js';
export type { Bound, MonteCarloOptions, MonteCarloResult } from './numeric/monte-carlo.js';

// Gap-analysis Wave D — time-series basics (bridge signal ↔ statistics).
export { movingAverage, ewma, detrend, acf } from './timeseries-extra.js';

// Phase 4 Task 3 — time-series inference (pacf, portmanteau/autocorrelation
// diagnostics, unit-root test) built on the basics above + `ols`.
export { pacf, ljungBox, durbinWatson, adfuller } from './stats/timeseries.js';
export type { LjungBoxResult, AdfullerResult } from './stats/timeseries.js';

// Gap-analysis Wave D — OLS regression (bridge statistics ↔ linear algebra).
export { linearRegression } from './regression-extra.js';
export type { LinregressResult } from './regression-extra.js';

// Phase 3 Task 1 — multiple linear regression (general design matrix) with inference.
export { ols } from './ml/ols.js';
export type { OlsOptions, OlsResult } from './ml/ols.js';

// Phase 3 Task 2 — regularized regression (ridge/lasso/elastic net).
export { ridge, lasso, elasticNet } from './ml/regularized-regression.js';
export type {
  RidgeOptions,
  CoordinateDescentOptions,
  RegularizedRegressionResult,
} from './ml/regularized-regression.js';

// Phase 3 Task 3 — binary logistic regression via IRLS (first classifier/GLM).
export { logisticRegression } from './ml/logistic-regression.js';
export type {
  LogisticRegressionOptions,
  LogisticRegressionResult,
} from './ml/logistic-regression.js';

// Gap-analysis Wave D — named optimizers + nonlinear least squares.
export { nelderMead, gradientDescent, levenbergMarquardt } from './optimization-extra.js';
export type { OptimizeResult, LMResult } from './optimization-extra.js';

// Gap-analysis Wave D — clustering (kmeans + spectral, reuse laplacianMatrix + eigs).
export { kmeans, spectralClustering } from './clustering-extra.js';

// Phase 3 Task 4 — density-based clustering (DBSCAN) + k-nearest-neighbour
// classifier/regressor (brute-force Euclidean neighbour search).
export { dbscan, knnClassify, knnRegress } from './ml/dbscan-knn.js';

// Phase 3 Task 5 — 1-D Gaussian kernel density estimation (first nonparametric
// density estimator), with Silverman's rule-of-thumb default bandwidth.
export { gaussianKDE } from './ml/kde.js';
export type { GaussianKDEOptions, GaussianKDEResult } from './ml/kde.js';

// Phase 3 Task 6 — chi-square test of independence (Yates correction +
// Cramer's V) and multiple-testing p-value correction (Bonferroni/Holm/BH).
export { chi2Contingency, multipleTest } from './stats/inference-extra.js';
export type {
  Chi2ContingencyOptions,
  Chi2ContingencyResult,
  MultipleTestMethod,
} from './stats/inference-extra.js';

// Phase 4 Task 1 — MLE distribution fitting (normal/exponential/lognormal/
// poisson closed-form; gamma via the digamma shape equation + a root-finder).
export { fitDistribution } from './stats/fit-distribution.js';
export type { DistributionName, FitDistributionResult } from './stats/fit-distribution.js';

// Phase 2 Task 1 — BFGS quasi-Newton minimizer (inverse-Hessian update +
// Armijo line search; optional analytic gradient or box-bounds projection).
// The smooth-optimization workhorse complementing derivative-free `minimize`
// / `nelderMead`.
export { bfgs } from './numeric/bfgs.js';
export type { BfgsOptions, BfgsResult } from './numeric/bfgs.js';
export type { KMeansResult } from './clustering-extra.js';

// Phase 2 Task 2 — nnls (Lawson-Hanson non-negative least squares) + lsqBounded
// (projected-gradient box-constrained least squares); complements the
// unconstrained `leastSquares` (typed/numeric.ts).
export { nnls, lsqBounded } from './numeric/nnls.js';
export type {
  NnlsOptions,
  NnlsResult,
  LsqBoundedOptions,
  LsqBoundedResult,
} from './numeric/nnls.js';

// Gap-analysis Wave D — symbolic indefinite integration (complements numeric integrate).
export { symbolicIntegral } from './cas-integration.js';

// Gap-analysis Wave D — digital filter design + application (vs scipy.signal).
export { firwin, butter, lfilter, lfilterZi, filtfilt } from './signal-filter-extra.js';

// Phase 6 Task 1 — numpy.fft-style helpers (rfft/irfft, fftshift/ifftshift, fftfreq/rfftfreq, fftn).
export { rfft, irfft, fftshift, ifftshift, fftfreq, rfftfreq, fftn } from './signal/fft-helpers.js';

// Phase 6 Task 2 — Chebyshev/elliptic IIR design (extends the butter/lfilter pipeline
// above with cheby1/cheby2/ellip prototypes, btype routing, and SOS cascades).
export { cheby1, cheby2, ellip, sosfilt, zpk2sos, bilinear, buttord } from './signal/iir-design.js';

// Phase 6 Task 3 — FIR bandpass design, least-squares/equiripple FIR design,
// Savitzky-Golay smoothing, Wiener adaptive filter, and FIR/polynomial deconvolution.
export {
  firwinBandpass,
  firls,
  remez,
  savgol,
  wiener,
  deconvolve,
} from './signal/fir-smoothing.js';
export type { DeconvolveResult } from './signal/fir-smoothing.js';
export type { RemezType } from './signal/remez-exchange.js';

// Phase 6 Task 4 — inverse DWT, multilevel wavedec/waverec (perfect
// reconstruction), and the continuous wavelet transform (cwt, Ricker/Morlet).
export { idwt, wavedec, waverec, cwt } from './signal/wavelets.js';

// Phase 6 Task 5 — peak detection (findPeaks/peakWidths), cross-spectral density +
// magnitude-squared coherence (Welch averaging), short-time FFT + COLA-normalized
// inverse (stft/istft), and anti-aliased decimation (decimate).
export {
  findPeaks,
  peakWidths,
  csd,
  coherence,
  stft,
  istft,
  decimate,
} from './signal/spectral-peaks.js';
export type {
  FindPeaksOptions,
  CsdOptions,
  StftOptions,
  StftResult,
} from './signal/spectral-peaks.js';

// Gap-analysis Wave C — geodesy + quaternion rotation algebra (bridge C7).
export {
  haversine,
  EARTH_RADIUS_KM,
  slerp,
  quaternionMultiply,
  quaternionConjugate,
  quaternionNormalize,
  quaternionFromAxisAngle,
  quaternionRotate,
  quaternionToRotationMatrix,
} from './geometry-extra.js';

// Phase 8 Task 3 — quaternion slerp/inverse/Euler, boundingBox, procrustes,
// kd-tree kNN/radius queries, and multiset setIsSuperset/setEqual/setDisjoint.
export {
  quaternionInverse,
  quaternionSlerp,
  quaternionToEuler,
  quaternionLog,
  quaternionExp,
  quaternionPow,
  boundingBox,
  procrustes,
  kdTreeKNN,
  kdTreeRadius,
  setIsSuperset,
  setEqual,
  setDisjoint,
} from './geometry/geometry-extra.js';
export type { ProcrustesResult } from './geometry/geometry-extra.js';

// Geometry breadth follow-up — 3-D ray/segment intersections.
export {
  rayTriangleIntersect,
  rayPlaneIntersect,
  segmentSegmentClosest,
} from './geometry/intersect3d.js';
export type { RayHit, SegmentClosestResult } from './geometry/intersect3d.js';

// Computational-geometry engine — convex hull (2-D/3-D), Delaunay, and the
// hull-based consumers (Voronoi, spherical Voronoi, alpha shapes). Pinned
// against scipy.spatial.
export { convexHull } from './geometry/hull.js';
export type { ConvexHullResult } from './geometry/hull.js';
export { delaunay } from './geometry/delaunay.js';
export type { DelaunayResult } from './geometry/delaunay.js';
export { voronoi } from './geometry/voronoi.js';
export type { VoronoiResult } from './geometry/voronoi.js';
export { alphaShape } from './geometry/alpha-shape.js';
export type { AlphaShapeResult } from './geometry/alpha-shape.js';
export { sphericalVoronoi } from './geometry/spherical-voronoi.js';
export type { SphericalVoronoiResult } from './geometry/spherical-voronoi.js';
// Note: the rendering generators (toMathML/toHTML/…) live in and are imported
// directly from `@danielsimonjr/mathts-expression`; re-exporting them here broke
// cross-package type resolution (the package-name re-export poisoned this
// module's export list for consumers).

// Phase 4 Task 4 — noncentral distribution CDFs (Poisson-mixture series over
// the existing central chiSquaredCDF/fCDF, plus a Simpson-quadrature
// noncentral-t), circular statistics (circmean/circstd/circvar + von Mises
// PDF), and paired-categorical tests (McNemar / Cochran's Q).
export {
  noncentralChi2CDF,
  noncentralFCDF,
  noncentralTCDF,
  circmean,
  circstd,
  circvar,
  vonMisesPDF,
  mcnemar,
  cochranQ,
} from './stats/inference-extra2.js';
export type {
  CircularOptions,
  McNemarOptions,
  McNemarResult,
  CochranQResult,
} from './stats/inference-extra2.js';

// Phase 5 Task 1 — hypergeometric master functions (0F1/1F1/2F1) + the
// generic pFq series engine they delegate to.
export { hyp0f1, hyp1f1, hyp2f1, pFq } from './special/hypergeometric.js';

// Phase 5 Task 2 — polygamma/trigamma (higher derivatives of digamma) plus
// the Jacobi/Gegenbauer orthogonal polynomials, generalizing the existing
// Chebyshev/Hermite/Laguerre/Legendre family.
export { polygamma, trigamma, jacobiP, gegenbauerC } from './special/polygamma-orthopoly.js';

// Phase 5 Task 3 — Jacobi elliptic functions sn/cn/dn (AGM/descending-Landen;
// parameter m = k^2), the elliptic *functions* complementing the existing
// elliptic *integrals*, plus rootsLegendre(n) (Gauss-Legendre quadrature
// nodes/weights via Newton refinement) for custom-order quadrature.
export { jacobiSN, jacobiCN, jacobiDN } from './special/jacobi-elliptic.js';
export { rootsLegendre } from './numeric/gauss-nodes.js';
export type { RootsLegendreResult } from './numeric/gauss-nodes.js';

// Niche special functions — polylogarithm (|z| < 1 series), Struve H/L,
// Kelvin ber/bei (order 0), and the Barnes G-function (real z > 0).
export { polylog, struveH, struveL, kelvinBer, kelvinBei, barnesG } from './special/niche.js';

// Advanced niche special functions — the Riemann–Siegel Z-function, the Lerch
// transcendent Φ(z,s,a) (|z| < 1 series), the parabolic-cylinder function
// D_ν(x), and the regular Coulomb wave function F_L(η,ρ).
export {
  siegelZ,
  riemannSiegelZ,
  lerchPhi,
  parabolicCylinderD,
  coulombF,
} from './special/wave-functions.js';

// Phase 8 Task 1 — graph traversal (bfs/dfs), all-pairs Floyd-Warshall,
// single-source Bellman-Ford (negative-weight/cycle-aware), and
// closeness/harmonic centrality, complementing the existing Dijkstra
// shortestPath/graphDistance in typed/graph.ts.
export {
  bfs,
  dfs,
  floydWarshall,
  bellmanFord,
  closenessCentrality,
  harmonicCentrality,
} from './graph/traversal-centrality.js';
export type { BellmanFordResult } from './graph/traversal-centrality.js';

// Phase 8 Task 2 — graph optimization: Edmonds-Karp max-flow/min-cut, A*
// heuristic shortest path (reduces to Dijkstra with heuristic = 0), and the
// Kuhn-Munkres Hungarian algorithm for optimal (minimum-cost) assignment.
export { maxFlow, minCut, astar, hungarian } from './graph/optimization.js';
export type {
  MaxFlowResult,
  MinCutResult,
  AStarResult,
  HungarianResult,
} from './graph/optimization.js';

// Phase 8 Task 5 — rigorous interval arithmetic with outward rounding
// (Interval type, add/sub/mul/div/neg, width/mid/contains, sqrt/exp/log/pow),
// the first verified-bounds numeric type in the library (mpmath.iv / INTLAB
// analogue).
export { interval, Interval } from './numeric/interval.js';

// Graph breadth (Phase 8 follow-up) — greedy proper vertex coloring
// (Welsh-Powell), maximum clique (Bron-Kerbosch), Louvain modularity
// community detection, Katz centrality (networkx-compatible), and a
// backtracking graph-isomorphism test, complementing the existing
// traversal/shortest-path/optimization graph functions.
export {
  graphColoring,
  maxClique,
  louvainCommunities,
  katzCentrality,
  isIsomorphic,
} from './graph/community-coloring.js';

// Stats-breadth chunk — generalized linear models (IRLS/Fisher scoring;
// Poisson log link, Gamma log/inverse link) generalizing the existing
// logistic-regression IRLS to the wider GLM family.
export { glm } from './ml/glm.js';
export type { GlmFamily, GlmLink, GlmOptions, GlmResult } from './ml/glm.js';

// Stats-breadth chunk — multivariate-normal density (thin wrapper over the
// existing `multivariateNormal` distribution object) + Cholesky-based
// sampling, handling both the 1-D and general k-D cases.
export { mvnPdf, mvnSample } from './stats/mvn.js';
export type { MvnVector, MvnCov, MvnSampleOptions } from './stats/mvn.js';

// Stats-breadth chunk — two-sample t-test power analysis via the existing
// noncentral-t CDF, matching statsmodels' tt_ind_solve_power.
export { tTestPower } from './stats/power-analysis.js';
export type { TTestPowerAlternative, TTestPowerOptions } from './stats/power-analysis.js';

// Stats-breadth chunk — Gaussian-process regression (RBF / Matérn 3/2 & 5/2
// kernels; posterior mean + variance), oracle-pinned against sklearn.
export { gaussianProcessRegression, gpRegression } from './stats/gaussian-process.js';
export type { GPKernel, GPOptions, GPPrediction, GPModel } from './stats/gaussian-process.js';

// Stats-breadth chunk — Dirichlet + Wishart sampling and Dirichlet density,
// beyond MVN (Gamma-normalization / Bartlett decomposition).
export { dirichletSample, dirichletPdf, wishartSample } from './stats/multivariate-sampling.js';
export type { SampleSeedOptions } from './stats/multivariate-sampling.js';
