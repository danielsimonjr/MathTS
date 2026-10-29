/**
 * Named optimizers (Wave D / remaining). Derivative-free simplex (`nelderMead`;
 * `minimize` is the absolute-step wrapper), gradient descent, and Levenberg–Marquardt
 * nonlinear least squares. LM reuses the matrix `inv` for the normal-equations solve
 * rather than re-implementing elimination.
 */
import { pairwiseDot } from '@danielsimonjr/mathts-core';
import { inv as _invRaw } from './factories/index.js';
import { centralDifferenceGradient, numericJacobian } from './numeric/numeric-jacobian.js';

const _inv = _invRaw as unknown as (m: number[][]) => number[][];

/**
 * Result of `nelderMead` and `gradientDescent`: the best point `x`,
 * its value `fx`, the iteration count, and a convergence flag.
 */
export interface OptimizeResult {
  x: number[];
  fx: number;
  iterations: number;
  converged: boolean;
}

/**
 * Options for {@link nelderMead}. Defaults use a relative simplex step and relative
 * convergence test (SciPy-style); set `stepRule` / `tolRule` to `'absolute'` for the
 * contract used by {@link minimize}.
 */
export interface NelderMeadOptions {
  maxIter?: number;
  tol?: number;
  step?: number;
  /** `'relative'` (default): perturb each coordinate by `step * x_j` (or `step` at zero). */
  stepRule?: 'relative' | 'absolute';
  /** `'relative'` (default): `|f_worst−f_best| ≤ tol·(|f_best|+tol)`. `'absolute'`: max vertex spread `< tol`. */
  tolRule?: 'relative' | 'absolute';
}

/**
 * Nelder–Mead downhill-simplex minimization of `f: ℝⁿ → ℝ` from `x0`. Derivative-free.
 * Matches `scipy.optimize.minimize(method='Nelder-Mead')` to the requested tolerance.
 *
 * @example
 * nelderMead((x) => (x[0] - 1) ** 2, [2]) // => { x: ~[1], … }; relative step 0.05 by default
 */
export function nelderMead(
  f: (x: number[]) => number,
  x0: readonly number[],
  opts: NelderMeadOptions = {}
): OptimizeResult {
  const {
    maxIter = 2000,
    tol = 1e-8,
    step = 0.05,
    stepRule = 'relative',
    tolRule = 'relative',
  } = opts;
  const n = x0.length;
  const alpha = 1;
  const gamma = 2;
  const rho = 0.5;
  const sigma = 0.5;
  // initial simplex
  let simplex: number[][] = [Array.from(x0)];
  for (let i = 0; i < n; i++) {
    const p = Array.from(x0);
    if (stepRule === 'absolute') {
      p[i] += step;
    } else {
      p[i] += p[i] !== 0 ? step * p[i] : step;
    }
    simplex.push(p);
  }
  let fv = simplex.map(f);
  let iter = 0;
  const centroid = (pts: number[][]): number[] => {
    const c = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += pts[i][j] / n;
    return c;
  };
  const add = (a: number[], b: number[], s: number): number[] => a.map((v, i) => v + s * b[i]);
  const sub = (a: number[], b: number[]): number[] => a.map((v, i) => v - b[i]);

  for (; iter < maxIter; iter++) {
    // sort by value
    const order = fv.map((_, i) => i).sort((i, j) => fv[i] - fv[j]);
    simplex = order.map((i) => simplex[i]);
    fv = order.map((i) => fv[i]);
    if (tolRule === 'absolute') {
      let maxDiff = 0;
      for (let i = 1; i <= n; i++) maxDiff = Math.max(maxDiff, Math.abs(fv[i] - fv[0]));
      if (maxDiff < tol) break;
    } else if (Math.abs(fv[n] - fv[0]) <= tol * (Math.abs(fv[0]) + tol)) {
      break;
    }
    const c = centroid(simplex.slice(0, n));
    const xr = add(c, sub(c, simplex[n]), alpha);
    const fr = f(xr);
    if (fr < fv[0]) {
      const xe = add(c, sub(c, simplex[n]), gamma);
      const fe = f(xe);
      if (fe < fr) {
        simplex[n] = xe;
        fv[n] = fe;
      } else {
        simplex[n] = xr;
        fv[n] = fr;
      }
    } else if (fr < fv[n - 1]) {
      simplex[n] = xr;
      fv[n] = fr;
    } else {
      const xc = add(c, sub(simplex[n], c), rho);
      const fc = f(xc);
      if (fc < fv[n]) {
        simplex[n] = xc;
        fv[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = add(simplex[0], sub(simplex[i], simplex[0]), sigma);
          fv[i] = f(simplex[i]);
        }
      }
    }
  }
  const best = fv.map((_, i) => i).sort((i, j) => fv[i] - fv[j])[0];
  return { x: simplex[best], fx: fv[best], iterations: iter, converged: iter < maxIter };
}

/**
 * Gradient-descent minimization with optional backtracking line search. `grad` may
 * be supplied; otherwise a central-difference gradient with constant step `1e-6`
 * is used ({@link centralDifferenceGradient}). That step is not the
 * `max(1, |x_i|) · cbrt(eps)` step `bfgs` uses.
 */
export function gradientDescent(
  f: (x: number[]) => number,
  x0: readonly number[],
  opts: { grad?: (x: number[]) => number[]; rate?: number; maxIter?: number; tol?: number } = {}
): OptimizeResult {
  const { rate = 0.1, maxIter = 10000, tol = 1e-8 } = opts;
  const grad =
    opts.grad ?? ((x: number[]): number[] => centralDifferenceGradient(f, x, () => 1e-6));
  let x = Array.from(x0);
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const g = grad(x);
    const gnorm = Math.hypot(...g);
    if (gnorm <= tol) break;
    // backtracking line search
    let t = rate;
    const fx = f(x);
    while (t > 1e-15 && f(x.map((v, i) => v - t * g[i])) > fx - 0.5 * t * gnorm * gnorm) t *= 0.5;
    x = x.map((v, i) => v - t * g[i]);
  }
  return { x, fx: f(x), iterations: iter, converged: iter < maxIter };
}

/**
 * Result of `levenbergMarquardt`: the solution `x`, the residual norm, the iteration
 * count, and a convergence flag.
 */
export interface LMResult {
  x: number[];
  residualNorm: number;
  iterations: number;
  converged: boolean;
}

/** Options for {@link levenbergMarquardt}. */
export interface LMOptions {
  maxIter?: number;
  tol?: number;
  /**
   * Analytic Jacobian `J` with `J[i][j] = ∂r_i/∂x_j`. When omitted, a forward
   * difference via {@link numericJacobian} is used (`h = 1e-7`).
   */
  jacobian?: (x: number[]) => number[][];
}

/**
 * Levenberg–Marquardt nonlinear least squares: minimize ½‖r(x)‖² for a vector
 * residual `r`. Uses `opts.jacobian` when provided, otherwise a forward-difference
 * {@link numericJacobian} (`h = 1e-7`). Damped normal equations `(JᵀJ + λI)δ = Jᵀr`
 * solved via the matrix `inv`. Mirrors `scipy.optimize.least_squares(method='lm')`.
 */
export function levenbergMarquardt(
  residual: (x: number[]) => number[],
  x0: readonly number[],
  opts: LMOptions = {}
): LMResult {
  const { maxIter = 200, tol = 1e-10, jacobian } = opts;
  const n = x0.length;
  let x = Array.from(x0);
  let lambda = 1e-3;
  let r = residual(x);
  let cost = pairwiseDot(r, r);
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const J = jacobian
      ? (() => {
          const Jx = jacobian(x);
          if (Jx.length !== r.length) {
            throw new TypeError(
              `levenbergMarquardt: jacobian returned ${Jx.length} rows, expected ${r.length}`
            );
          }
          for (let i = 0; i < Jx.length; i++) {
            if (Jx[i].length < n) {
              throw new TypeError(
                `levenbergMarquardt: jacobian row ${i} has length ${Jx[i].length}, expected ${n}`
              );
            }
          }
          return Jx;
        })()
      : numericJacobian(residual, x, { h: 1e-7, scheme: 'forward' });
    const m = r.length;
    // JᵀJ and Jᵀr
    const JtJ: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const Jtr = new Array<number>(n).fill(0);
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        let s = 0;
        for (let i = 0; i < m; i++) s += J[i][a] * J[i][b];
        JtJ[a][b] = s;
      }
      let sr = 0;
      for (let i = 0; i < m; i++) sr += J[i][a] * r[i];
      Jtr[a] = sr;
    }
    // damped solve (JᵀJ + λ diag(JᵀJ)) δ = −Jᵀr
    const A = JtJ.map((row, a) => row.map((v, b) => v + (a === b ? lambda * JtJ[a][a] : 0)));
    let delta: number[];
    try {
      const Ainv = _inv(A);
      delta = Ainv.map((row) => row.reduce((s, v, k) => s - v * Jtr[k], 0));
    } catch (e) {
      // A singular damped normal-equations matrix is the one expected failure —
      // bumping λ adds to the diagonal and restores invertibility. Any OTHER error
      // must not be silently retried as "bump λ"; re-throw it so a real bug surfaces
      // instead of being reported as converged:false. (A is always square/numeric, so
      // in practice only the singular case reaches here — matches inv.ts's own guard.)
      if (e instanceof Error && /determinant is zero|singular|zero pivot/i.test(e.message)) {
        lambda *= 10;
        continue;
      }
      throw e;
    }
    const xNew = x.map((v, i) => v + delta[i]);
    const rNew = residual(xNew);
    const costNew = pairwiseDot(rNew, rNew);
    if (costNew < cost) {
      x = xNew;
      r = rNew;
      if (Math.abs(cost - costNew) <= tol * cost) {
        cost = costNew;
        break;
      }
      cost = costNew;
      lambda = Math.max(lambda / 3, 1e-12);
    } else {
      lambda *= 3;
    }
  }
  return { x, residualNorm: Math.sqrt(cost), iterations: iter, converged: iter < maxIter };
}
