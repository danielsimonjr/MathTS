/**
 * Named optimizers (Wave D / remaining). Derivative-free simplex, gradient descent,
 * and Levenberg–Marquardt nonlinear least squares — the canonical methods the gap
 * analysis flagged (today only a generic `minimize` exists). LM reuses the matrix
 * `inv` for the normal-equations solve rather than re-implementing elimination.
 */
import { inv as _invRaw } from './factories/index.js';

const _inv = _invRaw as unknown as (m: number[][]) => number[][];

export interface OptimizeResult {
  x: number[];
  fx: number;
  iterations: number;
  converged: boolean;
}

/**
 * Nelder–Mead downhill-simplex minimization of `f: ℝⁿ → ℝ` from `x0`. Derivative-free.
 * Matches `scipy.optimize.minimize(method='Nelder-Mead')` to the requested tolerance.
 */
export function nelderMead(
  f: (x: number[]) => number,
  x0: readonly number[],
  opts: { maxIter?: number; tol?: number; step?: number } = {}
): OptimizeResult {
  const { maxIter = 2000, tol = 1e-8, step = 0.05 } = opts;
  const n = x0.length;
  const alpha = 1;
  const gamma = 2;
  const rho = 0.5;
  const sigma = 0.5;
  // initial simplex
  let simplex: number[][] = [Array.from(x0)];
  for (let i = 0; i < n; i++) {
    const p = Array.from(x0);
    p[i] += p[i] !== 0 ? step * p[i] : step;
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
    if (Math.abs(fv[n] - fv[0]) <= tol * (Math.abs(fv[0]) + tol)) break;
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
 * be supplied; otherwise a central-difference gradient is used.
 */
export function gradientDescent(
  f: (x: number[]) => number,
  x0: readonly number[],
  opts: { grad?: (x: number[]) => number[]; rate?: number; maxIter?: number; tol?: number } = {}
): OptimizeResult {
  const { rate = 0.1, maxIter = 10000, tol = 1e-8 } = opts;
  const n = x0.length;
  const numGrad = (x: number[]): number[] => {
    const h = 1e-6;
    const g = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const xp = x.slice();
      const xm = x.slice();
      xp[i] += h;
      xm[i] -= h;
      g[i] = (f(xp) - f(xm)) / (2 * h);
    }
    return g;
  };
  const grad = opts.grad ?? numGrad;
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

export interface LMResult {
  x: number[];
  residualNorm: number;
  iterations: number;
  converged: boolean;
}

/**
 * Levenberg–Marquardt nonlinear least squares: minimize ½‖r(x)‖² for a vector
 * residual `r`. Numeric Jacobian; damped normal equations `(JᵀJ + λI)δ = Jᵀr`
 * solved via the matrix `inv`. Mirrors `scipy.optimize.least_squares(method='lm')`.
 */
export function levenbergMarquardt(
  residual: (x: number[]) => number[],
  x0: readonly number[],
  opts: { maxIter?: number; tol?: number } = {}
): LMResult {
  const { maxIter = 200, tol = 1e-10 } = opts;
  const n = x0.length;
  let x = Array.from(x0);
  let lambda = 1e-3;
  const h = 1e-7;
  const norm2 = (v: number[]): number => v.reduce((s, c) => s + c * c, 0);
  const jacobian = (xc: number[], r0: number[]): number[][] => {
    const m = r0.length;
    const J: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(0));
    for (let j = 0; j < n; j++) {
      const xp = xc.slice();
      xp[j] += h;
      const rp = residual(xp);
      for (let i = 0; i < m; i++) J[i][j] = (rp[i] - r0[i]) / h;
    }
    return J;
  };
  let r = residual(x);
  let cost = norm2(r);
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const J = jacobian(x, r);
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
    const costNew = norm2(rNew);
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
