/**
 * Finite-difference weights and two scalar fixed-point / bracketing solvers.
 *
 * - {@link finiteDifferenceCoefficients}: Fornberg's recursion for the weights
 *   of the `derivOrder`-th derivative at 0 from arbitrary offsets.
 * - {@link ridders}: Ridders' bracketing root finder (exponential-fit false
 *   position), quadratic convergence on a sign-change bracket.
 * - {@link fixedPoint}: iteration `x ← g(x)`, optionally accelerated by
 *   Aitken's Δ² extrapolation at every step.
 *
 * @packageDocumentation
 */

/**
 * Weights `c_j` such that `f^{(m)}(0) ≈ Σ_j c_j f(x_j)` for the given offsets
 * `x_j` (Fornberg 1988). The offsets must be distinct and there must be more
 * than `derivOrder` of them.
 *
 * @example
 * finiteDifferenceCoefficients(2, [-1, 0, 1]) // [1, -2, 1]
 * finiteDifferenceCoefficients(1, [-1, 0, 1]) // [-0.5, 0, 0.5]
 */
export function finiteDifferenceCoefficients(
  derivOrder: number,
  offsets: readonly number[]
): number[] {
  if (!Number.isInteger(derivOrder) || derivOrder < 0) {
    throw new RangeError('derivOrder must be a nonnegative integer');
  }
  const n = offsets.length - 1;
  if (n < derivOrder) {
    throw new RangeError('need more than derivOrder offsets');
  }
  const m = derivOrder;
  // c[j][k]: weight of node j for the k-th derivative (k = 0..m).
  const c: number[][] = Array.from({ length: offsets.length }, () =>
    new Array<number>(m + 1).fill(0)
  );
  c[0][0] = 1;
  let c1 = 1;
  let c4 = offsets[0];
  for (let i = 1; i <= n; i++) {
    const mn = Math.min(i, m);
    let c2 = 1;
    const c5 = c4;
    c4 = offsets[i];
    for (let j = 0; j < i; j++) {
      const c3 = offsets[i] - offsets[j];
      c2 *= c3;
      if (c3 === 0) {
        throw new RangeError('offsets must be distinct');
      }
      if (j === i - 1) {
        for (let k = mn; k >= 1; k--) {
          c[i][k] = (c1 * (k * c[i - 1][k - 1] - c5 * c[i - 1][k])) / c2;
        }
        c[i][0] = (-c1 * c5 * c[i - 1][0]) / c2;
      }
      for (let k = mn; k >= 1; k--) {
        c[j][k] = (c4 * c[j][k] - k * c[j][k - 1]) / c3;
      }
      c[j][0] = (c4 * c[j][0]) / c3;
    }
    c1 = c2;
  }
  return c.map((row) => row[m]);
}

/** Options for {@link ridders} and {@link fixedPoint}. */
export interface ScalarSolveOptions {
  /** Tolerance on the step (relative to `max(1, |x|)`). */
  tol?: number;
  /** Maximum iterations. */
  maxIter?: number;
}

/** Options for {@link fixedPoint}. */
export interface FixedPointOptions extends ScalarSolveOptions {
  /** Apply Aitken Δ² extrapolation to each two-step update (default false). */
  aitken?: boolean;
}

/**
 * Root of `f` in the bracket `[a, b]` by Ridders' method. Requires
 * `f(a)·f(b) ≤ 0`; throws `RangeError` otherwise and `Error` if `maxIter` is
 * exhausted.
 *
 * @example
 * ridders((x) => Math.cos(x) - x, 0, 1) // ~0.7390851332151607
 */
export function ridders(
  f: (x: number) => number,
  a: number,
  b: number,
  opts: ScalarSolveOptions = {}
): number {
  const tol = opts.tol ?? 1e-14;
  const maxIter = opts.maxIter ?? 100;
  let xl = a;
  let xh = b;
  let fl = f(xl);
  let fh = f(xh);
  if (fl === 0) return xl;
  if (fh === 0) return xh;
  if (Math.sign(fl) === Math.sign(fh)) {
    throw new RangeError('ridders: f(a) and f(b) must have opposite signs');
  }
  let ans = Number.NaN;
  for (let iter = 0; iter < maxIter; iter++) {
    const xm = 0.5 * (xl + xh);
    const fm = f(xm);
    const s = Math.sqrt(fm * fm - fl * fh);
    if (s === 0) return ans;
    const xnew = xm + ((xm - xl) * (Math.sign(fl - fh) * fm)) / s;
    if (iter > 0 && Math.abs(xnew - ans) <= tol * Math.max(1, Math.abs(xnew))) return xnew;
    ans = xnew;
    const fnew = f(ans);
    if (fnew === 0) return ans;
    if (Math.sign(fm) !== Math.sign(fnew)) {
      xl = xm;
      fl = fm;
      xh = ans;
      fh = fnew;
    } else if (Math.sign(fl) !== Math.sign(fnew)) {
      xh = ans;
      fh = fnew;
    } else if (Math.sign(fh) !== Math.sign(fnew)) {
      xl = ans;
      fl = fnew;
    }
  }
  throw new Error('ridders: did not converge within maxIter');
}

/**
 * Fixed point of `g` from `x0`: iterate `x ← g(x)` until the step is below
 * `tol · max(1, |x|)`. With `aitken: true` each step applies two evaluations
 * of `g` and Aitken's extrapolation `x₂ − (x₂ − x₁)² / (x₂ − 2x₁ + x₀)`.
 * Throws if `maxIter` is exhausted or an iterate is not finite.
 *
 * @example
 * fixedPoint(Math.cos, 1) // ~0.7390851332151607
 */
export function fixedPoint(
  g: (x: number) => number,
  x0: number,
  opts: FixedPointOptions = {}
): number {
  const tol = opts.tol ?? 1e-14;
  const maxIter = opts.maxIter ?? 1000;
  const aitken = opts.aitken ?? false;
  let x = x0;
  for (let iter = 0; iter < maxIter; iter++) {
    const x1 = g(x);
    let next = x1;
    if (aitken) {
      const x2 = g(x1);
      const denom = x2 - 2 * x1 + x;
      if (denom !== 0) next = x2 - ((x2 - x1) * (x2 - x1)) / denom;
      else next = x2;
    }
    if (!Number.isFinite(next)) {
      throw new Error('fixedPoint: iterate is not finite');
    }
    if (Math.abs(next - x) <= tol * Math.max(1, Math.abs(next))) return next;
    x = next;
  }
  throw new Error('fixedPoint: did not converge within maxIter');
}
