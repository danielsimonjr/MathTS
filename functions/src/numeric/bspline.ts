/**
 * B-spline curve **fitting** (`bsplineFit`) and **evaluation** (`bsplineEval`)
 * to/from tabulated `(x, y)` data — as opposed to the existing
 * `bspline(controlPoints, degree, t)` in `../typed/numeric.ts`, which
 * evaluates a control-point B-spline curve and takes no data to fit.
 *
 * `bsplineFit` returns scipy's `tck` tuple shape (`{ t, c, k }`: knot
 * vector, coefficients, degree), matching `scipy.interpolate.splrep`'s
 * return convention so a fitted spline round-trips through `bsplineEval`
 * the same way `splev(x, tck)` would.
 *
 * Two fit modes:
 * - **Interpolation** (`s = 0`, default): the standard de Boor collocation
 *   construction — one basis function per data point (`numCoef = n`), knots
 *   placed by the averaging rule (Piegl & Tiller, *The NURBS Book*, eq.
 *   9.8) — produces a spline passing through every `(x_i, y_i)` exactly.
 * - **Least-squares smoothing** (`s > 0` or an explicit `nknots`): fewer
 *   interior knots than data points, solved by linear least squares. This
 *   is a regression-spline approximation of scipy's FITPACK smoothing
 *   (which additionally *optimizes* knot placement to hit a target
 *   residual `s`); here the knot count is derived from `s` by a documented
 *   heuristic rather than FITPACK's iterative knot-insertion search — a
 *   substantially larger algorithm out of scope for this chunk.
 *
 * Both branches reuse the existing linear-solve primitives
 * (`linsolve`/`leastSquares` in `../typed/numeric.ts`) rather than
 * reimplementing Gaussian elimination.
 *
 * @packageDocumentation
 */
import { linsolve, leastSquares } from '../typed/numeric.js';

type f64 = number;
type i32 = number;

/** Options for {@link bsplineFit}. */
export interface BSplineFitOptions {
  /** Spline degree (default 3, cubic). */
  k?: i32;
  /** Smoothing factor. `0` (default) fits an interpolating spline that
   * passes through every data point exactly. `s > 0` requests a
   * least-squares smoothing spline with fewer basis functions than data
   * points — the number of interior knots shrinks roughly in proportion to
   * `s`. Use `nknots` to control the knot count directly instead. */
  s?: f64;
  /** Explicit number of interior knots for a smoothing fit (used whenever
   * `s > 0`, or set this directly with `s` left at 0). Overrides the
   * `s`-derived heuristic. */
  nknots?: i32;
}

/** A fitted B-spline in scipy's `tck` tuple shape: knot vector `t`,
 * coefficients `c`, and degree `k`. */
export interface BSplineTuple {
  t: f64[];
  c: f64[];
  k: i32;
}

// --- Core B-spline basis machinery ---------------------------------------
// (Piegl & Tiller, *The NURBS Book*, Algorithms A2.1 `FindSpan` / A2.2
// `BasisFuns` — the standard, boundary-correct way to locate the active
// knot span and evaluate its p+1 nonzero basis functions. Used both to
// build the fitting collocation/design matrix and to evaluate a fitted
// spline, so span/boundary handling is guaranteed consistent between fit
// and eval.)

/** Locate the knot span index containing `u` (binary search). `n` is the
 * index of the last coefficient (`numCoef - 1`). */
function findSpan(n: i32, p: i32, u: f64, U: readonly f64[]): i32 {
  if (u >= U[n + 1]) return n;
  if (u <= U[p]) return p;
  let low = p;
  let high = n + 1;
  let mid = Math.floor((low + high) / 2);
  while (u < U[mid] || u >= U[mid + 1]) {
    if (u < U[mid]) high = mid;
    else low = mid;
    mid = Math.floor((low + high) / 2);
  }
  return mid;
}

/** The `p+1` nonzero basis function values at `u` in knot span `span`,
 * corresponding to basis functions `span-p .. span`. */
function basisFuns(span: i32, u: f64, p: i32, U: readonly f64[]): f64[] {
  const N: f64[] = new Array(p + 1);
  N[0] = 1;
  const left: f64[] = new Array(p + 1);
  const right: f64[] = new Array(p + 1);
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[span + 1 - j];
    right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const temp = N[r] / (right[r + 1] + left[j - r]);
      N[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    N[j] = saved;
  }
  return N;
}

function validateXY(x: readonly f64[], y: readonly f64[]): void {
  if (x.length !== y.length) throw new Error('bsplineFit: x and y must have the same length');
  for (let i = 1; i < x.length; i++) {
    if (!(x[i] > x[i - 1])) throw new Error('bsplineFit: x must be strictly increasing');
  }
}

/** Build the `n x numCoef` collocation/design matrix: row `i`'s `k+1`
 * nonzero entries are the basis functions active at `x[i]`. */
function buildDesignMatrix(x: readonly f64[], t: readonly f64[], k: i32, numCoef: i32): f64[][] {
  const n = x.length;
  const A: f64[][] = Array.from({ length: n }, () => new Array(numCoef).fill(0));
  for (let i = 0; i < n; i++) {
    const span = findSpan(numCoef - 1, k, x[i], t);
    const N = basisFuns(span, x[i], k, t);
    for (let j = 0; j <= k; j++) A[i][span - k + j] = N[j];
  }
  return A;
}

/**
 * Fit a B-spline of degree `k` (default cubic) to data `(x, y)`, returned
 * in scipy's `tck` tuple shape `{ t, c, k }`.
 *
 * @example
 * const xs = Array.from({ length: 15 }, (_, i) => (i * 2 * Math.PI) / 14);
 * const ys = xs.map(Math.sin);
 * const tck = bsplineFit(xs, ys); // cubic interpolating spline (s=0)
 * bsplineEval(tck, xs[3]); // === ys[3] exactly (interpolation)
 */
export function bsplineFit(
  x: readonly f64[],
  y: readonly f64[],
  opts: BSplineFitOptions = {}
): BSplineTuple {
  validateXY(x, y);
  const k = opts.k ?? 3;
  const n = x.length;
  if (n <= k) {
    throw new Error(`bsplineFit: need more than ${k} data points for a degree-${k} fit`);
  }
  const s = opts.s ?? 0;
  const x0 = x[0];
  const xN = x[n - 1];

  if (s <= 0 && opts.nknots === undefined) {
    // Interpolation: numCoef = n, knots via de Boor's averaging rule
    // (Piegl & Tiller eq. 9.8).
    const m = n + k + 1;
    const t: f64[] = new Array(m);
    for (let i = 0; i <= k; i++) t[i] = x0;
    for (let i = 0; i <= k; i++) t[m - 1 - i] = xN;
    for (let j = 1; j <= n - k - 1; j++) {
      let sum = 0;
      for (let i = j; i <= j + k - 1; i++) sum += x[i];
      t[k + j] = sum / k;
    }
    const A = buildDesignMatrix(x, t, k, n);
    const c = linsolve(A, [...y]);
    return { t, c, k };
  }

  // Least-squares smoothing: fewer interior knots than the interpolation
  // case (n - k - 1), so numCoef < n and the design matrix is solved by
  // least squares instead of an exact collocation solve.
  const maxInterior = Math.max(0, n - k - 2);
  const heuristicInterior = Math.round((n - k - 1) / (1 + Math.max(0, s)));
  let numInterior = opts.nknots ?? heuristicInterior;
  numInterior = Math.min(Math.max(0, numInterior), maxInterior);

  const numCoef = numInterior + k + 1;
  const m = numCoef + k + 1;
  const t: f64[] = new Array(m);
  for (let i = 0; i <= k; i++) t[i] = x0;
  for (let i = 0; i <= k; i++) t[m - 1 - i] = xN;
  for (let j = 1; j <= numInterior; j++) {
    t[k + j] = x0 + (j * (xN - x0)) / (numInterior + 1);
  }

  const A = buildDesignMatrix(x, t, k, numCoef);
  const c = leastSquares(A, [...y]);
  return { t, c, k };
}

/**
 * Evaluate a fitted B-spline (de Boor's algorithm) at one point or an array
 * of points.
 *
 * @example
 * bsplineEval(bsplineFit(xs, ys), 1.0); // spline value at x=1
 * bsplineEval(bsplineFit(xs, ys), [1, 2, 3]); // vectorized
 */
export function bsplineEval(spline: BSplineTuple, xnew: f64): f64;
export function bsplineEval(spline: BSplineTuple, xnew: readonly f64[]): f64[];
export function bsplineEval(spline: BSplineTuple, xnew: f64 | readonly f64[]): f64 | f64[] {
  const { t, c, k } = spline;
  const nLast = c.length - 1;
  const evalOne = (x: f64): f64 => {
    const span = findSpan(nLast, k, x, t);
    const N = basisFuns(span, x, k, t);
    let val = 0;
    for (let j = 0; j <= k; j++) val += N[j] * c[span - k + j];
    return val;
  };
  return Array.isArray(xnew) ? xnew.map(evalOne) : evalOne(xnew as f64);
}
