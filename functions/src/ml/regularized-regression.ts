/**
 * Regularized linear regression — ridge (L2), lasso (L1), and elastic net (L1+L2).
 *
 * All three center X's columns and y before fitting (so the intercept is never
 * penalized) and recover the intercept afterward as `intercept = yMean - xMean·β`.
 *
 * `ridge` has a closed form on centered data: `β = (XᵀX + αI)⁻¹Xᵀy`.
 *
 * `lasso`/`elasticNet` use cyclic coordinate descent with soft-thresholding on
 * standardized columns (mean 0, unit variance), then un-standardize the fitted
 * coefficients back to the original column scale. This is the classic
 * coordinate-descent lasso algorithm (Friedman, Hastie & Tibshirani 2010,
 * "Regularization Paths for Generalized Linear Models via Coordinate Descent").
 */
import { linsolve } from '../typed/numeric.js';

export interface RidgeOptions {
  /** Center X/y and fit an unpenalized intercept (default true). */
  intercept?: boolean;
}

export interface CoordinateDescentOptions extends RidgeOptions {
  /** Maximum coordinate-descent sweeps (default 1000). */
  maxIter?: number;
  /** Convergence tolerance on the max coefficient change per sweep (default 1e-7). */
  tol?: number;
}

export interface RegularizedRegressionResult {
  /** Fitted coefficients, one per predictor column (intercept excluded). */
  coefficients: number[];
  /** Fitted intercept (0 if `opts.intercept === false`). */
  intercept: number;
}

function validate(X: number[][], y: number[], name: string): { n: number; p: number } {
  const n = X.length;
  if (n === 0) throw new Error(`${name}: empty design matrix`);
  if (y.length !== n) {
    throw new Error(`${name}: length mismatch (X has ${n} rows, y has ${y.length})`);
  }
  const p = X[0].length;
  if (p === 0) throw new Error(`${name}: X must have at least one predictor column`);
  return { n, p };
}

function colMeans(X: number[][], n: number, p: number): number[] {
  const means = new Array<number>(p).fill(0);
  for (const row of X) {
    for (let j = 0; j < p; j++) means[j] += row[j];
  }
  for (let j = 0; j < p; j++) means[j] /= n;
  return means;
}

function mean(y: number[]): number {
  return y.reduce((s, v) => s + v, 0) / y.length;
}

/** Center X's columns and y by their means (or leave uncentered if `useIntercept` is false). */
function center(
  X: number[][],
  y: number[],
  n: number,
  p: number,
  useIntercept: boolean
): { Xc: number[][]; yc: number[]; xMean: number[]; yMean: number } {
  const xMean = useIntercept ? colMeans(X, n, p) : new Array<number>(p).fill(0);
  const yMean = useIntercept ? mean(y) : 0;
  const Xc = X.map((row) => row.map((v, j) => v - xMean[j]));
  const yc = y.map((v) => v - yMean);
  return { Xc, yc, xMean, yMean };
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function softThreshold(a: number, lambda: number): number {
  if (a > lambda) return a - lambda;
  if (a < -lambda) return a + lambda;
  return 0;
}

/**
 * Ridge regression (L2-penalized least squares) with a closed-form solution on
 * centered data: `β = (XᵀX + αI)⁻¹Xᵀy`. The intercept is never penalized.
 *
 * @param X - Design matrix (rows = observations, cols = predictors)
 * @param y - Response vector (length = number of observations)
 * @param alpha - L2 penalty strength (`alpha >= 0`; `alpha = 0` is OLS)
 * @param opts - `intercept` (default true)
 *
 * @example
 * ridge([[1], [2], [3], [4]], [2, 4, 6, 8], 0)
 * // => { coefficients: [2], intercept: 0 } (recovers the exact OLS fit)
 */
export function ridge(
  X: number[][],
  y: number[],
  alpha: number,
  opts?: RidgeOptions
): RegularizedRegressionResult {
  const { n, p } = validate(X, y, 'ridge');
  if (alpha < 0) throw new Error('ridge: alpha must be non-negative');
  const useIntercept = opts?.intercept !== false;

  const { Xc, yc, xMean, yMean } = center(X, y, n, p, useIntercept);

  // Normal equations: (XᵀX + αI) β = Xᵀy
  const XtX: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const Xty = new Array<number>(p).fill(0);
  for (let j = 0; j < p; j++) {
    for (let k = j; k < p; k++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += Xc[i][j] * Xc[i][k];
      XtX[j][k] = s;
      XtX[k][j] = s;
    }
    XtX[j][j] += alpha;
    for (let i = 0; i < n; i++) Xty[j] += Xc[i][j] * yc[i];
  }

  const coefficients = linsolve(XtX, Xty);
  const intercept = useIntercept ? yMean - dot(xMean, coefficients) : 0;
  return { coefficients, intercept };
}

/** Standardize centered columns to unit variance (population, ddof=0). Constant columns keep scale 1. */
function standardize(Xc: number[][], n: number, p: number): { Xs: number[][]; scale: number[] } {
  const scale = new Array<number>(p);
  for (let j = 0; j < p; j++) {
    let ss = 0;
    for (let i = 0; i < n; i++) ss += Xc[i][j] * Xc[i][j];
    const meanSq = ss / n;
    scale[j] = meanSq > 1e-15 ? Math.sqrt(meanSq) : 1;
  }
  const Xs = Xc.map((row) => row.map((v, j) => v / scale[j]));
  return { Xs, scale };
}

/**
 * Shared cyclic coordinate-descent solver for lasso/elastic-net on centered,
 * standardized data. `l1` and `l2` are the (already alpha-scaled) penalty
 * weights: lasso passes `l1 = alpha, l2 = 0`; elastic net splits `alpha` by
 * `l1Ratio`.
 */
function coordinateDescent(
  Xs: number[][],
  yc: number[],
  n: number,
  p: number,
  l1: number,
  l2: number,
  maxIter: number,
  tol: number
): number[] {
  const beta = new Array<number>(p).fill(0);
  const z = new Array<number>(p).fill(n); // standardized columns: sum(x_ij^2) = n
  const residual = [...yc]; // y - Xs*beta, kept updated incrementally

  for (let iter = 0; iter < maxIter; iter++) {
    let maxChange = 0;
    for (let j = 0; j < p; j++) {
      const col = Xs.map((row) => row[j]);
      const oldBeta = beta[j];
      // Partial residual excluding feature j: add back j's current contribution.
      let rho = 0;
      for (let i = 0; i < n; i++) rho += col[i] * (residual[i] + col[i] * oldBeta);

      const newBeta = softThreshold(rho, l1) / (z[j] + l2);
      if (newBeta !== oldBeta) {
        const delta = newBeta - oldBeta;
        for (let i = 0; i < n; i++) residual[i] -= col[i] * delta;
        beta[j] = newBeta;
        maxChange = Math.max(maxChange, Math.abs(delta));
      }
    }
    if (maxChange < tol) break;
  }
  return beta;
}

/**
 * Lasso regression (L1-penalized least squares) via cyclic coordinate descent
 * with soft-thresholding on standardized columns. Unlike ridge, large enough
 * penalties drive coefficients to exactly 0 (sparse solutions). The intercept
 * is never penalized.
 *
 * @param X - Design matrix (rows = observations, cols = predictors)
 * @param y - Response vector (length = number of observations)
 * @param alpha - L1 penalty strength (`alpha >= 0`; `alpha = 0` ~ OLS)
 * @param opts - `intercept` (default true), `maxIter` (default 1000), `tol` (default 1e-7)
 *
 * @example
 * lasso([[1], [2], [3], [4]], [2, 4, 6, 8], 100)
 * // => coefficients[0] === 0 (penalty overwhelms the signal)
 */
export function lasso(
  X: number[][],
  y: number[],
  alpha: number,
  opts?: CoordinateDescentOptions
): RegularizedRegressionResult {
  const { n, p } = validate(X, y, 'lasso');
  if (alpha < 0) throw new Error('lasso: alpha must be non-negative');
  const useIntercept = opts?.intercept !== false;
  const maxIter = opts?.maxIter ?? 1000;
  const tol = opts?.tol ?? 1e-7;

  const { Xc, yc, xMean, yMean } = center(X, y, n, p, useIntercept);
  const { Xs, scale } = standardize(Xc, n, p);

  const betaStd = coordinateDescent(Xs, yc, n, p, alpha, 0, maxIter, tol);
  const coefficients = betaStd.map((b, j) => b / scale[j]);
  const intercept = useIntercept ? yMean - dot(xMean, coefficients) : 0;
  return { coefficients, intercept };
}

/**
 * Elastic-net regression combining an L1 penalty (`alpha * l1Ratio`, soft-
 * thresholded) and an L2 penalty (`alpha * (1 - l1Ratio)`, added to the
 * coordinate-descent denominator) via the same cyclic coordinate descent as
 * `lasso`. `l1Ratio = 1` is pure lasso; `l1Ratio = 0` is (coordinate-descent)
 * ridge. The intercept is never penalized.
 *
 * @param X - Design matrix (rows = observations, cols = predictors)
 * @param y - Response vector (length = number of observations)
 * @param alpha - Overall penalty strength (`alpha >= 0`)
 * @param l1Ratio - Mixing parameter in `[0, 1]` between L1 and L2
 * @param opts - `intercept` (default true), `maxIter` (default 1000), `tol` (default 1e-7)
 *
 * @example
 * elasticNet([[1], [2], [3], [4]], [2, 4, 6, 8], 0.1, 0.5)
 * // => finite coefficients blending ridge shrinkage and lasso sparsity
 */
export function elasticNet(
  X: number[][],
  y: number[],
  alpha: number,
  l1Ratio: number,
  opts?: CoordinateDescentOptions
): RegularizedRegressionResult {
  const { n, p } = validate(X, y, 'elasticNet');
  if (alpha < 0) throw new Error('elasticNet: alpha must be non-negative');
  if (l1Ratio < 0 || l1Ratio > 1) throw new Error('elasticNet: l1Ratio must be in [0, 1]');
  const useIntercept = opts?.intercept !== false;
  const maxIter = opts?.maxIter ?? 1000;
  const tol = opts?.tol ?? 1e-7;

  const { Xc, yc, xMean, yMean } = center(X, y, n, p, useIntercept);
  const { Xs, scale } = standardize(Xc, n, p);

  const l1 = alpha * l1Ratio;
  const l2 = alpha * (1 - l1Ratio);
  const betaStd = coordinateDescent(Xs, yc, n, p, l1, l2, maxIter, tol);
  const coefficients = betaStd.map((b, j) => b / scale[j]);
  const intercept = useIntercept ? yMean - dot(xMean, coefficients) : 0;
  return { coefficients, intercept };
}
