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

// Gap-analysis Wave B — additional hypothesis tests (bridge C9).
export { fTest, jarqueBera, kruskalWallis, wilcoxon, fisherExact } from './hypothesis-extra.js';
export type {
  FTestResult,
  JarqueBeraResult,
  KruskalResult,
  WilcoxonResult,
  FisherExactResult,
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
} from './linalg-extra.js';

// Gap-analysis Wave C — numeric Hessian (bridge C3); Wave D — numeric gradient.
export { hessian, gradient } from './calculus-extra.js';

// Gap-analysis Wave D — time-series basics (bridge signal ↔ statistics).
export { movingAverage, ewma, detrend, acf } from './timeseries-extra.js';

// Gap-analysis Wave D — OLS regression (bridge statistics ↔ linear algebra).
export { linearRegression } from './regression-extra.js';
export type { LinregressResult } from './regression-extra.js';

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
