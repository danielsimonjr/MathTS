/**
 * BFGS quasi-Newton minimization of `f: ℝⁿ → ℝ`.
 *
 * Maintains an approximate inverse Hessian `H` (started at the identity) and
 * updates it after every accepted step via the classic BFGS formula:
 *
 *   s = x_{k+1} − x_k,  y = g_{k+1} − g_k,  ρ = 1 / (yᵀs)
 *   H ← (I − ρ s yᵀ) H (I − ρ y sᵀ) + ρ s sᵀ
 *
 * The update is skipped (H left unchanged) when `yᵀs ≤ 1e-12` — a near-zero
 * or negative curvature pairing would make H indefinite. The search direction
 * is `d = −H g`, accepted via a backtracking Armijo line search (`c1 = 1e-4`,
 * starting step `α = 1`, halved up to 50 times).
 *
 * `opts.bounds`, if supplied, turns this into a lightweight **projected**
 * BFGS: after every accepted step each coordinate is clipped into its
 * `[lo, hi]` range. This is NOT the full active-set L-BFGS-B method (no
 * distinction between free/active variables in the Hessian update) — it is a
 * simple, effective projection that keeps the iterate feasible.
 *
 * Complements the derivative-free `minimize` (Nelder–Mead): BFGS converges
 * superlinearly on smooth functions using gradient information (analytic or
 * numeric), at the cost of assuming enough smoothness for the gradient/line
 * search to behave.
 *
 * @packageDocumentation
 */

type f64 = number;

/** Options for {@link bfgs}. */
export interface BfgsOptions {
  /**
   * Analytic gradient `∇f(x)`. If omitted, a central-difference gradient is
   * used with per-coordinate step `h_i = max(1, |x_i|) · cbrt(machine eps)`.
   */
  grad?: (x: number[]) => number[];
  /**
   * Box constraints `[lo_i, hi_i]` per coordinate. After each accepted step,
   * `x` is clipped into these bounds (projected BFGS — a lightweight
   * approximation of L-BFGS-B, not the full active-set method).
   */
  bounds?: [f64, f64][];
  /** Convergence tolerance on `‖g‖∞` (default 1e-8). */
  tol?: f64;
  /** Maximum iterations (default 500). */
  maxIter?: number;
}

/** Result of {@link bfgs}. */
export interface BfgsResult {
  /** The minimizer. */
  x: number[];
  /** `f(x)` at the minimizer. */
  fval: f64;
  /** Number of iterations performed. */
  iterations: number;
  /** Whether `‖g‖∞ < tol` was reached within `maxIter`. */
  converged: boolean;
}

/** Cube root of the IEEE-754 double machine epsilon — the standard central-difference step scale. */
const CBRT_EPS = Math.cbrt(2.220446049250313e-16);

/** Local central-difference gradient (self-contained; no shared-state step cache). */
function numericGradient(f: (x: number[]) => number, x: number[]): number[] {
  const n = x.length;
  const g = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const h = Math.max(1, Math.abs(x[i])) * CBRT_EPS;
    const xp = x.slice();
    const xm = x.slice();
    xp[i] += h;
    xm[i] -= h;
    g[i] = (f(xp) - f(xm)) / (2 * h);
  }
  return g;
}

function clipToBounds(x: number[], bounds: [f64, f64][] | undefined): number[] {
  if (!bounds) return x;
  return x.map((v, i) => {
    const b = bounds[i];
    if (!b) return v;
    const [lo, hi] = b;
    return Math.min(hi, Math.max(lo, v));
  });
}

function dot(a: readonly number[], b: readonly number[]): f64 {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function matVec(H: number[][], v: readonly number[]): number[] {
  const n = v.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += H[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

/**
 * Minimize `f: ℝⁿ → ℝ` from `x0` via BFGS quasi-Newton with an Armijo
 * backtracking line search. Uses `opts.grad` if supplied, else a local
 * central-difference gradient. `opts.bounds` clips each accepted step
 * (projected BFGS, not full L-BFGS-B).
 *
 * @example
 * bfgs((v) => (1 - v[0]) ** 2 + 100 * (v[1] - v[0] ** 2) ** 2, [-1.2, 1])
 * // => { x: ~[1, 1], fval: ~0, ... }
 */
export function bfgs(f: (x: number[]) => number, x0: number[], opts: BfgsOptions = {}): BfgsResult {
  const { grad, bounds, tol = 1e-8, maxIter = 500 } = opts;
  const gradOf = grad ?? ((x: number[]): number[] => numericGradient(f, x));
  const n = x0.length;
  const c1 = 1e-4;

  let x = clipToBounds(x0.slice(), bounds);
  let fx = f(x);
  let g = gradOf(x);

  // Inverse-Hessian approximation, started at the identity.
  let H: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  const infNorm = (v: readonly number[]): f64 => v.reduce((m, c) => Math.max(m, Math.abs(c)), 0);

  let iter = 0;
  let converged = infNorm(g) < tol;

  while (!converged && iter < maxIter) {
    const d = matVec(H, g).map((v) => -v);
    const gd = dot(g, d);

    // Backtracking Armijo line search. If d is not a descent direction
    // (can happen after a skipped/degenerate curvature update), reset to
    // steepest descent for this step.
    const dir = gd < 0 ? d : g.map((v) => -v);
    const dirSlope = gd < 0 ? gd : -dot(g, g);

    let alpha = 1;
    let xNew = clipToBounds(
      x.map((v, i) => v + alpha * dir[i]),
      bounds
    );
    let fNew = f(xNew);
    let halvings = 0;
    while (fNew > fx + c1 * alpha * dirSlope && halvings < 50) {
      alpha *= 0.5;
      xNew = clipToBounds(
        x.map((v, i) => v + alpha * dir[i]),
        bounds
      );
      fNew = f(xNew);
      halvings++;
    }

    const gNew = gradOf(xNew);
    const s = xNew.map((v, i) => v - x[i]);
    const y = gNew.map((v, i) => v - g[i]);
    const sy = dot(s, y);

    if (sy > 1e-12) {
      const rho = 1 / sy;
      // H <- (I - rho*s*y^T) H (I - rho*y*s^T) + rho*s*s^T
      const Hy = matVec(H, y);
      const yHy = dot(y, Hy);
      const HNew: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          HNew[i][j] =
            H[i][j] -
            rho * (s[i] * Hy[j] + Hy[i] * s[j]) +
            rho * rho * yHy * s[i] * s[j] +
            rho * s[i] * s[j];
        }
      }
      H = HNew;
    }

    x = xNew;
    fx = fNew;
    g = gNew;
    iter++;
    converged = infNorm(g) < tol;
  }

  return { x, fval: fx, iterations: iter, converged };
}
