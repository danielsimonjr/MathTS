/**
 * Ordinary least-squares regression for a general design matrix (Wave — ML primitives).
 *
 * `linearRegression` (`../regression-extra.ts`) only handles a single predictor
 * (`y ≈ slope·x + intercept`, matching `scipy.stats.linregress`). `ols` generalizes
 * to an arbitrary number of predictors via the normal equations, with the same
 * `studentTCDF`-based significance testing.
 */
import { studentTCDF } from '../distribution-functions.js';

export interface OlsOptions {
  /** Prepend a column of ones (default true). */
  intercept?: boolean;
}

export interface OlsResult {
  /** Fitted coefficients (intercept first, if included). */
  coefficients: number[];
  /** Standard error of each coefficient. */
  stderr: number[];
  /** t-statistic for each coefficient (H0: coefficient = 0). */
  tValues: number[];
  /** Two-sided p-value for each coefficient's t-statistic. */
  pValues: number[];
  /** Coefficient of determination. */
  r2: number;
  /** R² adjusted for the number of predictors. */
  adjR2: number;
  /** Overall model F-statistic (H0: all slope coefficients = 0). */
  fStat: number;
  /** Residuals y - Xβ. */
  residuals: number[];
}

function transpose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const out: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[j][i] = m[i][j];
    }
  }
  return out;
}

function matmul(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const k = b.length;
  const m = b[0].length;
  const out: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < k; c++) {
      const aic = a[i][c];
      if (aic === 0) continue;
      for (let j = 0; j < m; j++) {
        out[i][j] += aic * b[c][j];
      }
    }
  }
  return out;
}

function matVec(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((sum, val, j) => sum + val * v[j], 0));
}

/** Invert a square matrix via Gauss-Jordan elimination with partial pivoting. */
function invert(a: number[][]): number[][] {
  const n = a.length;
  // Augment [A | I]
  const M = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        pivotRow = row;
      }
    }
    if (maxVal < 1e-15) throw new Error('ols: X^T X is singular (predictors are collinear)');
    if (pivotRow !== col) [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivot = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row.slice(n));
}

/**
 * Multiple linear regression `y ≈ Xβ` by ordinary least squares (normal equations),
 * with full inference: standard errors, t/p-values per coefficient, R²/adjusted-R²,
 * the overall model F-statistic, and residuals.
 *
 * @param X - Design matrix (rows = observations, cols = predictors)
 * @param y - Response vector (length = number of observations)
 * @param opts - `intercept` (default true) prepends a column of ones to X
 *
 * @example
 * ols([[1, 1], [2, 0], [3, 1], [4, 0]], [6, 5, 10, 9])
 * // => coefficients ~= [1, 2, 3] (y = 1 + 2*x1 + 3*x2), r2 = 1
 */
export function ols(X: number[][], y: number[], opts?: OlsOptions): OlsResult {
  const n = X.length;
  if (n === 0) throw new Error('ols: empty design matrix');
  if (y.length !== n) throw new Error(`ols: length mismatch (X has ${n} rows, y has ${y.length})`);

  const useIntercept = opts?.intercept !== false;
  const design: number[][] = useIntercept ? X.map((row) => [1, ...row]) : X.map((row) => [...row]);
  const p = design[0].length;
  if (n <= p) throw new Error(`ols: need more observations (${n}) than parameters (${p})`);

  const Xt = transpose(design);
  const XtX = matmul(Xt, design);
  const Xty = matVec(Xt, y);
  const XtXinv = invert(XtX);
  const coefficients = matVec(XtXinv, Xty);

  const fitted = matVec(design, coefficients);
  const residuals = y.map((yi, i) => yi - fitted[i]);
  const rss = residuals.reduce((sum, e) => sum + e * e, 0);

  const yMean = y.reduce((sum, v) => sum + v, 0) / n;
  const tss = y.reduce((sum, v) => sum + (v - yMean) * (v - yMean), 0);

  const dfResid = n - p;
  const sigma2 = rss / dfResid;

  const stderr = XtXinv.map((row, j) => Math.sqrt(sigma2 * row[j]));
  const tValues = coefficients.map((b, j) => b / stderr[j]);
  const pValues = tValues.map((t) => 2 * (1 - studentTCDF(Math.abs(t), dfResid)));

  const r2 = tss === 0 ? 1 : 1 - rss / tss;
  const adjR2 = 1 - ((1 - r2) * (n - 1)) / dfResid;
  const fStat = p > 1 ? (tss - rss) / (p - 1) / (rss / dfResid) : NaN;

  return { coefficients, stderr, tValues, pValues, r2, adjR2, fStat, residuals };
}
