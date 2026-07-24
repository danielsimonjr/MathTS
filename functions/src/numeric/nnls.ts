/**
 * Constrained least squares: `nnls` (Lawson–Hanson active-set non-negative
 * least squares) and `lsqBounded` (projected-gradient box-constrained least
 * squares). Both minimize `||Ax - b||_2` subject to simple bound constraints
 * on `x`, complementing the unconstrained `leastSquares` (`../typed/numeric.ts`).
 *
 * @packageDocumentation
 */

import { leastSquares } from '../typed/numeric.js';

/** Options shared by `nnls` and `lsqBounded`. */
export interface NnlsOptions {
  /** Convergence tolerance (default 1e-10). */
  tol?: number;
  /** Maximum iterations (default `3 * n`). */
  maxIter?: number;
}

/** Options for `lsqBounded` (same shape as `NnlsOptions`, kept as a distinct alias for clarity). */
export type LsqBoundedOptions = NnlsOptions;

/** Result of `nnls` / `lsqBounded`: the solution and its residual norm. */
export interface NnlsResult {
  /** Solution vector x. */
  x: number[];
  /** `||Ax - b||_2` at the returned solution. */
  residual: number;
}

/** Alias for `NnlsResult` (used by `lsqBounded`). */
export type LsqBoundedResult = NnlsResult;

/** Matrix-vector product `A * x`. */
function matVec(A: readonly (readonly number[])[], x: readonly number[]): number[] {
  const m = A.length;
  const result = new Array<number>(m);
  for (let i = 0; i < m; i++) {
    const row = A[i];
    let s = 0;
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    result[i] = s;
  }
  return result;
}

/** Euclidean norm of the residual `Ax - b`. */
function residualNorm(
  A: readonly (readonly number[])[],
  x: readonly number[],
  b: readonly number[]
): number {
  const Ax = matVec(A, x);
  let s = 0;
  for (let i = 0; i < b.length; i++) {
    const d = Ax[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/**
 * Non-negative least squares: `min ||Ax - b||_2 s.t. x >= 0`, via the
 * Lawson–Hanson active-set algorithm.
 *
 * Maintains a "passive" set `P` of coordinates allowed to be nonzero (all
 * others held at 0). Each outer iteration adds to `P` the inactive index
 * with the most positive gradient component `w_j = (A^T(b - Ax))_j`, solves
 * the unconstrained least-squares problem restricted to the columns in `P`
 * (via `leastSquares`), and — if that restricted solution has any
 * non-positive component — walks back along the line from the current `x`
 * toward it until the first such component would hit zero, dropping that
 * index from `P` and re-solving. Terminates when no inactive index has a
 * positive gradient (KKT optimality) or `maxIter` is exhausted.
 *
 * @param A - Matrix (m x n)
 * @param b - Right-hand side (length m)
 * @param opts - Options (tol, maxIter; default maxIter = 3n)
 * @returns `{ x, residual }` with `x >= 0` (up to `tol`) and `residual = ||Ax - b||_2`
 *
 * @example
 * nnls([[1, 0], [0, 1]], [3, -2]) // => { x: [3, 0], residual: 2 }
 */
export function nnls(A: number[][], b: number[], opts: NnlsOptions = {}): NnlsResult {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  const tol = opts.tol ?? 1e-10;
  const maxIter = opts.maxIter ?? 3 * n;

  let x = new Array<number>(n).fill(0);
  const passive = new Set<number>();

  /** Gradient of the LS objective w.r.t. x: `A^T (b - Ax)`. */
  const gradient = (xv: readonly number[]): number[] => {
    const Ax = matVec(A, xv);
    const w = new Array<number>(n).fill(0);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let i = 0; i < m; i++) s += A[i][j] * (b[i] - Ax[i]);
      w[j] = s;
    }
    return w;
  };

  /** Unconstrained LS solution restricted to columns `P`, zero elsewhere. */
  const solvePassive = (P: readonly number[]): number[] => {
    const z = new Array<number>(n).fill(0);
    if (P.length === 0) return z;
    const Asub = A.map((row) => P.map((j) => row[j]));
    let zp: number[];
    try {
      zp = leastSquares(Asub, b);
    } catch {
      return x.slice(); // singular restricted system: keep current iterate
    }
    for (let k = 0; k < P.length; k++) z[P[k]] = zp[k];
    return z;
  };

  let outerIter = 0;
  while (outerIter < maxIter) {
    const w = gradient(x);

    let maxW = -Infinity;
    let maxJ = -1;
    for (let j = 0; j < n; j++) {
      if (!passive.has(j) && w[j] > maxW) {
        maxW = w[j];
        maxJ = j;
      }
    }
    if (maxJ === -1 || maxW <= tol) break;

    passive.add(maxJ);
    let z = solvePassive(Array.from(passive));

    let innerIter = 0;
    while (Array.from(passive).some((j) => z[j] <= tol) && innerIter < maxIter) {
      innerIter++;
      let alpha = Infinity;
      for (const j of passive) {
        if (z[j] <= tol) {
          const denom = x[j] - z[j];
          if (denom > 0) alpha = Math.min(alpha, x[j] / denom);
        }
      }
      if (!isFinite(alpha)) alpha = 0;

      for (let j = 0; j < n; j++) x[j] = x[j] + alpha * (z[j] - x[j]);
      for (const j of Array.from(passive)) {
        if (Math.abs(x[j]) < tol) passive.delete(j);
      }
      z = solvePassive(Array.from(passive));
    }

    x = z;
    outerIter++;
  }

  return { x, residual: residualNorm(A, x, b) };
}

/** Clip each component of `v` into `[lower[i], upper[i]]`. */
function clip(v: readonly number[], lower: readonly number[], upper: readonly number[]): number[] {
  return v.map((vi, i) => Math.min(Math.max(vi, lower[i]), upper[i]));
}

/**
 * Box-constrained least squares: `min ||Ax - b||_2 s.t. lower <= x <= upper`,
 * via projected-gradient descent.
 *
 * Each iteration computes the gradient `g = A^T(Ax - b)` of the smooth
 * objective `f(x) = (1/2)||Ax - b||^2`, takes a candidate step
 * `x - alpha*g` projected (clipped) into the box, and backtracks
 * (`alpha /= 2`) until the projected step does not increase `f`. Converges
 * when the projected-gradient norm `||x - clip(x - g, lower, upper)||` is
 * below `tol`.
 *
 * @param A - Matrix (m x n)
 * @param b - Right-hand side (length m)
 * @param lower - Per-component lower bounds (length n)
 * @param upper - Per-component upper bounds (length n)
 * @param opts - Options (tol, maxIter; default maxIter = max(200, 20n))
 * @returns `{ x, residual }` with `lower <= x <= upper` and `residual = ||Ax - b||_2`
 *
 * @example
 * lsqBounded([[1, 0], [0, 1]], [5, -3], [0, 0], [2, 2]) // => { x: [2, 0], residual: ... }
 */
export function lsqBounded(
  A: number[][],
  b: number[],
  lower: number[],
  upper: number[],
  opts: LsqBoundedOptions = {}
): LsqBoundedResult {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  const tol = opts.tol ?? 1e-10;
  const maxIter = opts.maxIter ?? Math.max(200, 20 * n);

  let x = clip(new Array<number>(n).fill(0), lower, upper);

  const gradient = (xv: readonly number[]): number[] => {
    const Ax = matVec(A, xv);
    const r = new Array<number>(m);
    for (let i = 0; i < m; i++) r[i] = Ax[i] - b[i];
    const g = new Array<number>(n).fill(0);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let i = 0; i < m; i++) s += A[i][j] * r[i];
      g[j] = s;
    }
    return g;
  };

  const objective = (xv: readonly number[]): number => {
    const r = residualNorm(A, xv, b);
    return 0.5 * r * r;
  };

  for (let iter = 0; iter < maxIter; iter++) {
    const g = gradient(x);

    const projFull = clip(
      x.map((xi, i) => xi - g[i]),
      lower,
      upper
    );
    let pgNorm = 0;
    for (let i = 0; i < n; i++) pgNorm += (x[i] - projFull[i]) ** 2;
    pgNorm = Math.sqrt(pgNorm);
    if (pgNorm < tol) break;

    const fx = objective(x);
    let alpha = 1;
    let xNext = clip(
      x.map((xi, i) => xi - alpha * g[i]),
      lower,
      upper
    );
    let fNext = objective(xNext);

    let backtrack = 0;
    while (fNext > fx && backtrack < 50) {
      alpha /= 2;
      xNext = clip(
        x.map((xi, i) => xi - alpha * g[i]),
        lower,
        upper
      );
      fNext = objective(xNext);
      backtrack++;
    }

    x = xNext;
  }

  return { x, residual: residualNorm(A, x, b) };
}
