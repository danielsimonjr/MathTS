/**
 * Numeric Jacobian of a vector-valued function `f: R^n -> R^m` via central
 * differences. Complements the symbolic `jacobian(exprs, vars, scope)` in
 * `typed/cas.ts` — that path requires expression strings and throws on a
 * plain numeric function (`exprs.map is not a function`). This is the
 * foundation for numeric root-finding (`fsolve`, Phase 1 Task 3).
 */

/** A vector field ℝⁿ → ℝᵐ. */
export type VectorField = (x: number[]) => number[];

export interface NumericJacobianOptions {
  /** Absolute step override. Default: per-coordinate relative step (see below). */
  h?: number;
}

/**
 * Central-difference Jacobian: `J[i][j] = ∂f_i/∂x_j = (f_i(x0 + h·e_j) − f_i(x0 − h·e_j)) / (2h)`.
 *
 * `f` need not be square (`m = f(x0).length` rows, `n = x0.length` columns).
 * The per-coordinate step defaults to `h = max(1, |x0[j]|) * cbrt(eps)`
 * (eps = 2.22e-16, i.e. Number.EPSILON), the standard relative step for
 * central differences (~6e-6 relative) that balances truncation error
 * (O(h^2)) against floating-point round-off (O(eps/h)).
 *
 * @example
 * numericJacobian((v) => [v[0] ** 2 + v[1], v[0] * v[1]], [1, 2])
 * // => [[2, 1], [2, 1]]
 */
export function numericJacobian(
  f: VectorField,
  x0: readonly number[],
  opts: NumericJacobianOptions = {}
): number[][] {
  const n = x0.length;
  const base = Array.from(x0);
  const f0 = f(base);
  const m = f0.length;
  const cbrtEps = Math.cbrt(2.22e-16);

  const J: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(0));

  for (let j = 0; j < n; j++) {
    const h = opts.h ?? Math.max(1, Math.abs(base[j])) * cbrtEps;

    const xPlus = base.slice();
    xPlus[j] += h;
    const fPlus = f(xPlus);

    const xMinus = base.slice();
    xMinus[j] -= h;
    const fMinus = f(xMinus);

    for (let i = 0; i < m; i++) {
      J[i][j] = (fPlus[i] - fMinus[i]) / (2 * h);
    }
  }

  return J;
}
