/**
 * Scalar (1-D) function minimization via Brent's method.
 *
 * Distinct from root-finding (`findRoot`, `newton`, `secant`, `halley`, which
 * solve f(x) = 0): this locates a local minimizer of f over a bounded
 * interval. Combines golden-section search (guaranteed, slow) with parabolic
 * interpolation (fast near a smooth minimum) — the classic algorithm of
 * Brent (1973) / Numerical Recipes §10.2, and the same method behind
 * `scipy.optimize.minimize_scalar(method='bounded')`.
 *
 * @packageDocumentation
 */

type f64 = number;
type i32 = number;

/** Golden ratio conjugate: (3 - sqrt(5)) / 2 ≈ 0.3819660. */
const GOLD = (3 - Math.sqrt(5)) / 2;

/** Machine epsilon (IEEE-754 double). */
const EPS = 2.220446049250313e-16;

/**
 * Options for {@link minimizeScalar}.
 */
export interface MinimizeScalarOptions {
  /**
   * Interval `[a, b]` to search over (bounded Brent). If omitted, defaults to
   * `[-10, 10]` — a generic finite bracket; supply an explicit bracket for
   * functions whose minimum may lie outside that range.
   */
  bracket?: [f64, f64];
  /** Convergence tolerance on the interval width (default 1e-8). */
  tol?: f64;
  /** Maximum iterations (default 100). */
  maxIter?: i32;
}

/**
 * Result of {@link minimizeScalar}.
 */
export interface MinimizeScalarResult {
  /** The minimizer. */
  x: f64;
  /** f(x) at the minimizer. */
  fval: f64;
}

/**
 * Minimize a scalar function `f: R -> R` over a bounded interval using
 * Brent's method (golden-section search + parabolic interpolation).
 *
 * If `opts.bracket` is not supplied, the default search interval is
 * `[-10, 10]`.
 *
 * @param f - Function to minimize
 * @param opts - Options (bracket, tol, maxIter)
 * @returns `{ x, fval }` — the minimizer and its function value
 *
 * @example
 * minimizeScalar(x => (x - 2) ** 2) // => { x: ~2, fval: ~0 }
 * minimizeScalar(Math.sin, { bracket: [0, 2 * Math.PI] }) // => { x: ~3pi/2, fval: ~-1 }
 */
export function minimizeScalar(
  f: (x: f64) => f64,
  opts?: MinimizeScalarOptions
): MinimizeScalarResult {
  const [a0, b0] = opts?.bracket ?? [-10, 10];
  const tol = opts?.tol ?? 1e-8;
  const maxIter = opts?.maxIter ?? 100;

  let a = Math.min(a0, b0);
  let b = Math.max(a0, b0);

  // x: point with least function value so far; w: point with second-least;
  // v: previous value of w. e: step size two iterations back (0 disables
  // parabolic fit on the first pass); d: the most recent step taken.
  let x = a + GOLD * (b - a);
  let w = x;
  let v = x;
  let fx = f(x);
  let fw = fx;
  let fv = fx;
  let e = 0;
  let d = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    const xm = 0.5 * (a + b);
    const tol1 = tol * Math.abs(x) + EPS;
    const tol2 = 2 * tol1;

    if (Math.abs(x - xm) <= tol2 - 0.5 * (b - a)) break;

    let useGolden = true;
    if (Math.abs(e) > tol1) {
      // Attempt parabolic interpolation through (x, fx), (w, fw), (v, fv).
      const r = (x - w) * (fx - fv);
      let q = (x - v) * (fx - fw);
      let p = (x - v) * q - (x - w) * r;
      q = 2 * (q - r);
      if (q > 0) p = -p;
      q = Math.abs(q);
      const eTemp = e;
      e = d;

      // Accept the parabolic step only if it stays within the bracket and
      // is smaller than half the pre-previous step (Brent's guard against
      // slow/non-convergent parabolic sequences).
      if (Math.abs(p) < Math.abs(0.5 * q * eTemp) && p > q * (a - x) && p < q * (b - x)) {
        d = p / q;
        const u = x + d;
        if (u - a < tol2 || b - u < tol2) {
          d = xm - x >= 0 ? tol1 : -tol1;
        }
        useGolden = false;
      }
    }

    if (useGolden) {
      e = x >= xm ? a - x : b - x;
      d = GOLD * e;
    }

    const u = Math.abs(d) >= tol1 ? x + d : x + (d >= 0 ? tol1 : -tol1);
    const fu = f(u);

    if (fu <= fx) {
      if (u >= x) a = x;
      else b = x;
      v = w;
      fv = fw;
      w = x;
      fw = fx;
      x = u;
      fx = fu;
    } else {
      if (u < x) a = u;
      else b = u;
      if (fu <= fw || w === x) {
        v = w;
        fv = fw;
        w = u;
        fw = fu;
      } else if (fu <= fv || v === x || v === w) {
        v = u;
        fv = fu;
      }
    }
  }

  return { x, fval: fx };
}
