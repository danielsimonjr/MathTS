/**
 * Constrained minimization by the augmented Lagrangian method
 * (Powell–Hestenes–Rockafellar).
 *
 * Equality constraints `h_i(x) = 0` and inequality constraints `g_j(x) ≤ 0`
 * are handled by an augmented Lagrangian
 *
 *   L(x) = f + Σ_i [λ_i h_i + (μ/2) h_i²]
 *            + Σ_j (1/(2μ)) [max(0, λ_j + μ g_j)² − λ_j²]
 *
 * minimized in `x` by the projected BFGS of `./bfgs.js` (bounds are passed
 * through as its projection). Multipliers are updated after each inner solve,
 * `λ_i ← λ_i + μ h_i` and `λ_j ← max(0, λ_j + μ g_j)`, and the penalty `μ` is
 * multiplied by 10 whenever the constraint violation has not dropped by a
 * factor of 4.
 *
 * @packageDocumentation
 */
import { bfgs } from './bfgs.js';

/** Options for {@link minimizeConstrained}. */
export interface ConstrainedOptions {
  /** Equality constraints `h(x) = 0`. */
  eq?: ReadonlyArray<(x: number[]) => number>;
  /** Inequality constraints `g(x) ≤ 0`. */
  ineq?: ReadonlyArray<(x: number[]) => number>;
  /** Box constraints `[lo, hi]` per coordinate. */
  bounds?: ReadonlyArray<readonly [number, number]>;
  /** Feasibility tolerance on the maximum constraint violation (default 1e-8). */
  tol?: number;
  /** Maximum number of outer (multiplier) iterations (default 50). */
  maxOuter?: number;
  /** Initial penalty parameter `μ` (default 10). */
  mu0?: number;
}

/** Result of {@link minimizeConstrained}. */
export interface ConstrainedResult {
  /** The constrained minimizer estimate. */
  x: number[];
  /** Objective value `f(x)` (not the augmented Lagrangian). */
  fx: number;
  /** Maximum of `|h_i(x)|` and `max(0, g_j(x))` at the returned point. */
  constraintViolation: number;
  /** Number of outer iterations performed. */
  outerIterations: number;
  /** Whether the constraint violation fell below `tol`. */
  converged: boolean;
}

const INNER_TOL = 1e-10;
const INNER_MAX_ITER = 500;

/**
 * Minimize `f` from `x0` subject to the constraints in `opts`.
 *
 * With no equality or inequality constraints this is a single {@link bfgs}
 * call (projected onto `bounds` if given).
 *
 * @example
 * // min x² + y²  s.t.  x + y = 1  →  x ≈ [0.5, 0.5], fx ≈ 0.5
 * minimizeConstrained((v) => v[0] ** 2 + v[1] ** 2, [0, 0], {
 *   eq: [(v) => v[0] + v[1] - 1],
 * });
 */
export function minimizeConstrained(
  f: (x: number[]) => number,
  x0: readonly number[],
  opts: ConstrainedOptions = {}
): ConstrainedResult {
  const eq = opts.eq ?? [];
  const ineq = opts.ineq ?? [];
  const tol = opts.tol ?? 1e-8;
  const maxOuter = opts.maxOuter ?? 50;
  const mu0 = opts.mu0 ?? 10;
  const bounds = opts.bounds?.map(([lo, hi]): [number, number] => [lo, hi]);
  const innerOpts = { tol: INNER_TOL, maxIter: INNER_MAX_ITER, ...(bounds ? { bounds } : {}) };

  const violationAt = (x: number[]): number => {
    let v = 0;
    for (const h of eq) v = Math.max(v, Math.abs(h(x)));
    for (const g of ineq) v = Math.max(v, Math.max(0, g(x)));
    return v;
  };

  if (eq.length === 0 && ineq.length === 0) {
    const r = bfgs(f, x0.slice(), innerOpts);
    return {
      x: r.x,
      fx: r.fval,
      constraintViolation: 0,
      outerIterations: 0,
      converged: r.converged,
    };
  }

  const lambdaEq = eq.map(() => 0);
  const lambdaIneq = ineq.map(() => 0);
  let mu = mu0;
  let x = x0.slice();
  let prevViolation = Number.POSITIVE_INFINITY;
  let outer = 0;
  let violation = violationAt(x);

  while (outer < maxOuter) {
    const muNow = mu;
    const lEq = lambdaEq.slice();
    const lIneq = lambdaIneq.slice();
    const augmented = (y: number[]): number => {
      let val = f(y);
      eq.forEach((h, i) => {
        const hv = h(y);
        val += lEq[i] * hv + (muNow / 2) * hv * hv;
      });
      ineq.forEach((g, j) => {
        const t = Math.max(0, lIneq[j] + muNow * g(y));
        val += (t * t - lIneq[j] * lIneq[j]) / (2 * muNow);
      });
      return Number.isFinite(val) ? val : Number.POSITIVE_INFINITY;
    };

    x = bfgs(augmented, x, innerOpts).x;
    outer++;

    eq.forEach((h, i) => {
      lambdaEq[i] += mu * h(x);
    });
    ineq.forEach((g, j) => {
      lambdaIneq[j] = Math.max(0, lambdaIneq[j] + mu * g(x));
    });

    violation = violationAt(x);
    if (violation <= tol) break;
    if (violation > 0.25 * prevViolation) mu *= 10;
    prevViolation = violation;
  }

  return {
    x,
    fx: f(x),
    constraintViolation: violation,
    outerIterations: outer,
    converged: violation <= tol,
  };
}
