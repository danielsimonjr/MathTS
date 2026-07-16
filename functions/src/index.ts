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
// synced-mathjs factory layer (factories/index.js) and the new typed Unit
// implementation (typed/unit.js). The typed-dispatch version supersedes
// the factory version for the public barrel, mirroring how `cond` is
// resolved inside typed/index.js.
export { to, toBest } from './typed/unit.js';

// Expression evaluator (wired to full math scope)
export { evaluate, compileExpr, parse, parser, reviver, replacer } from './factories/evaluate.js';

// GC4 — mathjs canonical `help(search)` export (Help class + embedded docs).
export { help } from './help.js';

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
  ptp,
  variation,
  trimmedMean,
  describe,
  histogram,
} from './descriptive-stats.js';
export type {
  LinRegressResult,
  CorrelationTestResult,
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

// Gap-analysis Wave D — time-series basics (bridge signal ↔ statistics).
export { movingAverage, ewma, detrend, acf } from './timeseries-extra.js';

// Gap-analysis Wave D — OLS regression (bridge statistics ↔ linear algebra).
export { linearRegression } from './regression-extra.js';
export type { LinregressResult } from './regression-extra.js';

// Gap-analysis Wave D — named optimizers + nonlinear least squares.
export { nelderMead, gradientDescent, levenbergMarquardt } from './optimization-extra.js';
export type { OptimizeResult, LMResult } from './optimization-extra.js';

// Gap-analysis Wave D — clustering (kmeans + spectral, reuse laplacianMatrix + eigs).
export { kmeans, spectralClustering } from './clustering-extra.js';
export type { KMeansResult } from './clustering-extra.js';

// Gap-analysis Wave D — symbolic indefinite integration (complements numeric integrate).
export { symbolicIntegral } from './cas-integration.js';

// Gap-analysis Wave D — digital filter design + application (vs scipy.signal).
export { firwin, butter, lfilter, lfilterZi, filtfilt } from './signal-filter-extra.js';

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
// Note: the rendering generators (toMathML/toHTML/…) live in and are imported
// directly from `@danielsimonjr/mathts-expression`; re-exporting them here broke
// cross-package type resolution (the package-name re-export poisoned this
// module's export list for consumers).
