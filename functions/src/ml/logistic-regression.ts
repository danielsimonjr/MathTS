/**
 * Binary logistic regression via IRLS (Wave — ML primitives, Phase 3 Task 3).
 *
 * The first classifier/GLM in the library. Fits `p = sigmoid(Xβ)` by Newton-Raphson
 * on the Bernoulli log-likelihood, i.e. iteratively reweighted least squares (IRLS):
 * each step solves `(XᵀWX) Δ = Xᵀ(y - p)` for the Newton update, `W = diag(p(1-p))`.
 */
import { linsolve } from '../typed/numeric.js';

export interface LogisticRegressionOptions {
  /** Prepend a column of ones (default true). */
  intercept?: boolean;
  /** Convergence tolerance on the max-norm of the Newton step (default 1e-8). */
  tol?: number;
  /** Maximum IRLS iterations (default 100). */
  maxIter?: number;
}

export interface LogisticRegressionResult {
  /** Fitted coefficients for the original predictors (excludes the intercept). */
  coefficients: number[];
  /** Fitted intercept (0 if `opts.intercept === false`). */
  intercept: number;
  /** Predict class probabilities (P(y=1|x)) for new rows. */
  predictProba: (x: number[][]) => number[];
  /** Predict class labels (threshold 0.5) for new rows. */
  predict: (x: number[][]) => number[];
}

function sigmoid(z: number): number {
  // Numerically stable logistic sigmoid.
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

// Cap the Newton step's max-norm to keep IRLS from overshooting into NaN
// territory on perfectly separable data (where the unconstrained MLE diverges
// to +-infinity and the weights p(1-p) collapse toward 0, making X^T W X
// increasingly ill-conditioned).
const MAX_STEP_NORM = 25;

/**
 * Binary logistic regression `P(y=1|x) = sigmoid(xᵀβ)` fit by IRLS (Newton-Raphson
 * on the Bernoulli log-likelihood).
 *
 * @param X - Design matrix (rows = observations, cols = predictors)
 * @param y - Binary labels, each in {0, 1}
 * @param opts - `intercept` (default true) prepends a column of ones to X;
 *   `tol` (default 1e-8) convergence tolerance; `maxIter` (default 100)
 * @returns Fitted coefficients/intercept plus `predict`/`predictProba`
 *
 * @example
 * const m = logisticRegression([[-2], [-1], [1], [2]], [0, 0, 1, 1]);
 * m.predict([[3]]) // => [1]
 */
export function logisticRegression(
  X: number[][],
  y: number[],
  opts?: LogisticRegressionOptions
): LogisticRegressionResult {
  const n = X.length;
  if (n === 0) throw new Error('logisticRegression: empty design matrix');
  if (y.length !== n) {
    throw new Error(`logisticRegression: length mismatch (X has ${n} rows, y has ${y.length})`);
  }
  for (const yi of y) {
    if (yi !== 0 && yi !== 1) {
      throw new Error('logisticRegression: y must be binary (0 or 1)');
    }
  }

  const useIntercept = opts?.intercept !== false;
  const tol = opts?.tol ?? 1e-8;
  const maxIter = opts?.maxIter ?? 100;

  const design = (rows: number[][]): number[][] =>
    useIntercept ? rows.map((row) => [1, ...row]) : rows.map((row) => [...row]);

  const D = design(X);
  const p = D[0].length;

  let beta = new Array(p).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    const eta = D.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
    const probs = eta.map(sigmoid);
    const weights = probs.map((pi) => Math.max(pi * (1 - pi), 1e-9));

    // X^T W X
    const XtWX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < n; i++) {
      const w = weights[i];
      const row = D[i];
      for (let a = 0; a < p; a++) {
        const wa = w * row[a];
        if (wa === 0) continue;
        for (let b = 0; b < p; b++) {
          XtWX[a][b] += wa * row[b];
        }
      }
    }

    // X^T (y - p)
    const score: number[] = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const resid = y[i] - probs[i];
      const row = D[i];
      for (let a = 0; a < p; a++) {
        score[a] += row[a] * resid;
      }
    }

    // Tiny ridge term on the diagonal: keeps X^T W X solvable when predictors
    // are exactly (or near-)collinear — otherwise linsolve's singular-matrix
    // guard aborts IRLS on its very first step. Negligible for well-conditioned
    // designs; for a singular direction it picks the minimum-norm split, which
    // doesn't change the fitted probabilities (only how a shared effect is
    // divided across collinear columns).
    const ridgeEps = 1e-8;
    const regularized = XtWX.map((row, a) => row.map((v, b) => (a === b ? v + ridgeEps : v)));

    let delta: number[];
    try {
      delta = linsolve(regularized, score);
    } catch {
      break;
    }

    let stepNorm = 0;
    for (const d of delta) stepNorm = Math.max(stepNorm, Math.abs(d));

    // Damp the step if it would overshoot (perfectly separable data drives
    // beta to +-infinity; without damping the weights collapse to the floor
    // and the next XtWX solve produces NaN).
    if (stepNorm > MAX_STEP_NORM) {
      const scale = MAX_STEP_NORM / stepNorm;
      delta = delta.map((d) => d * scale);
      stepNorm = MAX_STEP_NORM;
    }

    beta = beta.map((b, j) => b + delta[j]);

    if (stepNorm < tol) break;
  }

  const intercept = useIntercept ? beta[0] : 0;
  const coefficients = useIntercept ? beta.slice(1) : beta.slice();

  const predictProba = (x: number[][]): number[] => {
    const Dx = design(x);
    return Dx.map((row) => sigmoid(row.reduce((s, v, j) => s + v * beta[j], 0)));
  };

  const predict = (x: number[][]): number[] => predictProba(x).map((pi) => (pi >= 0.5 ? 1 : 0));

  return { coefficients, intercept, predictProba, predict };
}
