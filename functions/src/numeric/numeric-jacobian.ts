/**
 * Numeric Jacobian of a vector-valued function `f: R^n -> R^m` via finite
 * differences. Default `scheme` is `'central'`; `'forward'` is
 * `(f(x + h·e_j) − f(x)) / h` and reuses the `f(x)` value already computed.
 * Complements the symbolic `jacobian(exprs, vars, scope)` in `typed/cas.ts` —
 * that path requires expression strings and throws on a plain numeric function
 * (`exprs.map is not a function`). This is the foundation for numeric
 * root-finding (`fsolve`, Phase 1 Task 3).
 */

/** A vector field ℝⁿ → ℝᵐ. */
export type VectorField = (x: number[]) => number[];

/** Relative forward/central step rule used when `h` is omitted. */
export interface NumericJacobianStepRule {
  /** Multiplier on `|x_j|` (default central rule uses `cbrt(eps)` instead). */
  rel: number;
  /** Minimum absolute step per coordinate. */
  floor: number;
}

/** Options for `numericJacobian`. */
export interface NumericJacobianOptions {
  /** Absolute step override. Default: per-coordinate relative step (see below). */
  h?: number;
  /** `'central'` (default) or forward difference `(f(x+h·e_j) − f(x)) / h`. */
  scheme?: 'central' | 'forward';
  /**
   * When `h` is omitted, use `max(floor, rel * |x_j|)` per column instead of the
   * default central-difference rule `max(1, |x_j|) * cbrt(eps)`.
   */
  step?: NumericJacobianStepRule;
  /** Precomputed `f(x0)`; skips the base evaluation at `x0`. */
  f0?: readonly number[];
}

/**
 * Numeric Jacobian `J[i][j] = ∂f_i/∂x_j`.
 *
 * Default `scheme` is `'central'`:
 * `(f_i(x0 + h·e_j) − f_i(x0 − h·e_j)) / (2h)`.
 * `scheme: 'forward'` uses the already-computed `f(x0)`:
 * `(f_i(x0 + h·e_j) − f_i(x0)) / h`.
 *
 * `f` need not be square (`m = f(x0).length` rows, `n = x0.length` columns).
 * The per-coordinate step defaults to `h = max(1, |x0[j]|) * cbrt(eps)`
 * (eps = 2.22e-16, i.e. Number.EPSILON), the standard relative step for
 * central differences (~6e-6 relative) that balances truncation error
 * (O(h^2)) against floating-point round-off (O(eps/h)). Passing `h` uses
 * that absolute step for every column (both schemes). With `step: { rel, floor }`
 * and no `h`, each column uses `max(floor, rel * |x0[j]|)`.
 *
 * @param f - Vector field ℝⁿ → ℝᵐ.
 * @param x0 - Point at which to evaluate the Jacobian.
 * @param opts.h - Absolute step override. Default: per-coordinate relative step.
 * @param opts.scheme - `'central'` (default) or `'forward'`. Existing callers
 *   that omit `scheme` keep central differences.
 * @param opts.step - Relative step rule when `h` is omitted.
 * @param opts.f0 - Optional precomputed `f(x0)` (must match `f(x0)` if supplied).
 *
 * @example
 * numericJacobian((v) => [v[0] ** 2 + v[1], v[0] * v[1]], [1, 2])
 * // => [[2, 1], [2, 1]]
 *
 * @example
 * // Forward differences on a linear map are exact for any step.
 * const A = [[1, 2], [3, 4]];
 * const f = (v) => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
 * numericJacobian(f, [1, 2], { scheme: 'forward', h: 1e-7 })
 * // => [[1, 2], [3, 4]]
 */
export function numericJacobian(
  f: VectorField,
  x0: readonly number[],
  opts: NumericJacobianOptions = {}
): number[][] {
  const n = x0.length;
  const base = Array.from(x0);
  const f0 = opts.f0 !== undefined ? Array.from(opts.f0) : f(base);
  const m = f0.length;
  const cbrtEps = Math.cbrt(2.22e-16);
  const stepRule = opts.step;

  const columnStep = (j: number): number => {
    if (opts.h !== undefined) return opts.h;
    if (stepRule !== undefined) {
      return Math.max(stepRule.floor, stepRule.rel * Math.abs(base[j]));
    }
    return Math.max(1, Math.abs(base[j])) * cbrtEps;
  };

  const J: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(0));
  const forward = opts.scheme === 'forward';

  for (let j = 0; j < n; j++) {
    const h = columnStep(j);

    const xPlus = base.slice();
    xPlus[j] += h;
    const fPlus = f(xPlus);

    if (forward) {
      for (let i = 0; i < m; i++) {
        J[i][j] = (fPlus[i] - f0[i]) / h;
      }
    } else {
      const xMinus = base.slice();
      xMinus[j] -= h;
      const fMinus = f(xMinus);

      for (let i = 0; i < m; i++) {
        J[i][j] = (fPlus[i] - fMinus[i]) / (2 * h);
      }
    }
  }

  return J;
}

/**
 * Central-difference gradient of a scalar `f: ℝⁿ → ℝ`.
 *
 * Coordinate `i` uses the step `stepAt(x[i])`, which the caller must make
 * non-zero. {@link bfgs} passes `max(1, |x_i|) · cbrt(Number.EPSILON)`.
 * `gradientDescent` passes the constant `1e-6`. Both stay thin wrappers.
 *
 * {@link numericJacobian} does not call this helper. It is vector-valued,
 * it also implements a forward scheme, and its default step uses
 * `cbrt(2.22e-16)` rather than full `Number.EPSILON`. Folding those into
 * one function would change one of the two step policies.
 *
 * @param f - Scalar objective. Receives a mutable copy of the point.
 * @param x - Point at which to differentiate. The input is not modified.
 * @param stepAt - Per-coordinate step. Receives `x[i]`.
 * @returns A new array `g` with `g[i] = (f(x + h e_i) − f(x − h e_i)) / (2h)`.
 */
export function centralDifferenceGradient(
  f: (x: number[]) => number,
  x: readonly number[],
  stepAt: (coordinate: number) => number
): number[] {
  const n = x.length;
  const g = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const h = stepAt(x[i]);
    const xp = x.slice();
    const xm = x.slice();
    xp[i] += h;
    xm[i] -= h;
    g[i] = (f(xp) - f(xm)) / (2 * h);
  }
  return g;
}
