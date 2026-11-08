/**
 * Gauss-Legendre quadrature nodes and weights.
 *
 * `rootsLegendre(n)` finds the n roots of the degree-n Legendre polynomial
 * P_n via Newton's method (initial guess from the standard asymptotic
 * approximation), then derives the corresponding quadrature weights. This is
 * the classical fixed-node table underlying Gauss-Legendre quadrature on
 * [-1, 1]; callers needing a custom node count (rather than the library's
 * built-in fixed-order `integrate`/`gaussLegendre` routines) use this
 * directly.
 *
 * @packageDocumentation
 */

const NEWTON_MAX_ITERATIONS = 100;
const NEWTON_TOLERANCE = 1e-15;

/** Result of {@link rootsLegendre}: nodes ascending on [-1, 1] with matching weights. */
export interface RootsLegendreResult {
  nodes: number[];
  weights: number[];
}

/**
 * Evaluate the Legendre polynomial P_n(x) and P_{n-1}(x) via the standard
 * three-term recurrence:
 *
 *   P_0(x) = 1, P_1(x) = x
 *   k P_k(x) = (2k - 1) x P_{k-1}(x) - (k - 1) P_{k-2}(x)
 *
 * @returns [P_n(x), P_{n-1}(x)]
 */
function legendrePair(n: number, x: number): [number, number] {
  let pPrev = 1; // P_0
  let pCurr = x; // P_1
  if (n === 0) return [1, x];
  for (let k = 2; k <= n; k++) {
    const pNext = ((2 * k - 1) * x * pCurr - (k - 1) * pPrev) / k;
    pPrev = pCurr;
    pCurr = pNext;
  }
  return [pCurr, pPrev];
}

const SPLIT = 134217729; // 2^27 + 1, the Dekker split constant

/**
 * The weight term at a node `x`, with P_n and P_{n-1} evaluated in
 * double-double: returns `[pn, t]` where `pn = P_n(x)` and `t = P_{n-1}(x) -
 * x * P_n(x)`, each rounded to a double after the double-double sum. Every
 * value is a pair of scalars (`hi`, `lo`) so the loop allocates nothing.
 */
function legendreWeightTermsDD(n: number, x: number): [number, number] {
  // Dekker split of x, reused by every product with x.
  const cx = SPLIT * x;
  const xh = cx - (cx - x);
  const xl = x - xh;
  let ph = 1; // P_{k-2}
  let pl = 0;
  let ch = x; // P_{k-1}
  let cl = 0;
  for (let k = 2; k <= n; k++) {
    // u = (2k - 1) * P_{k-1}, then v = u * x; each keeps the rounding error of its product.
    const a = 2 * k - 1;
    let uh = ch * a;
    let ul = cl * a + twoProdErr(ch, a, uh);
    let s = uh + ul;
    ul = ul - (s - uh);
    uh = s;
    let vh = uh * x;
    let vl = ul * x + twoProdErrSplit(uh, vh, xh, xl);
    s = vh + vl;
    vl = vl - (s - vh);
    vh = s;
    // w = v - (k - 1) * P_{k-2}
    const m = -(k - 1);
    const wh = ph * m;
    const wl = pl * m + twoProdErr(ph, m, wh);
    const sh = vh + wh;
    const bb = sh - vh;
    let sl = vh - (sh - bb) + (wh - bb) + vl + wl;
    const th = sh + sl;
    sl = sl - (th - sh);
    // divide by k with one correction step
    const q1 = th / k;
    const ph2 = q1 * k;
    const rh = th - ph2 - twoProdErr(q1, k, ph2) + sl;
    const q2 = rh / k;
    const nh = q1 + q2;
    const nl = q2 - (nh - q1);
    ph = ch;
    pl = cl;
    ch = nh;
    cl = nl;
  }
  // t = P_{n-1} - x * P_n in double-double.
  const yh = ch * x;
  const yl = cl * x + twoProdErrSplit(ch, yh, xh, xl);
  const s = ph - yh;
  const bb = s - ph;
  const tl = ph - (s - bb) + (-yh - bb) + pl - yl;
  return [ch + cl, s + tl];
}

/** Rounding error of the product `a * b`, given `p = a * b` (Dekker, no FMA). */
function twoProdErr(a: number, b: number, p: number): number {
  const ca = SPLIT * a;
  const ah = ca - (ca - a);
  const al = a - ah;
  const cb = SPLIT * b;
  const bh = cb - (cb - b);
  const bl = b - bh;
  return ah * bh - p + ah * bl + al * bh + al * bl;
}

/** Rounding error of `a * x`, given `p = a * x` and the split `xh + xl` of x. */
function twoProdErrSplit(a: number, p: number, xh: number, xl: number): number {
  const ca = SPLIT * a;
  const ah = ca - (ca - a);
  const al = a - ah;
  return ah * xh - p + ah * xl + al * xh + al * xl;
}

/**
 * n-point Gauss-Legendre quadrature nodes and weights on [-1, 1].
 *
 * Nodes are the roots of the degree-n Legendre polynomial P_n, refined by
 * Newton's method from the standard asymptotic initial guess
 * `cos(pi*(i+0.75)/(n+0.5))`. Weights are `2 / ((1-x_i^2) * P'_n(x_i)^2)`,
 * evaluated in double-double at the final node and corrected to the exact
 * root, so each weight is within 1e-15 relative for n up to 64.
 *
 * @param n - Number of quadrature points (positive integer)
 * @returns Nodes (ascending) and matching weights
 *
 * @example
 * rootsLegendre(3)
 * // { nodes: [-0.7745966692, 0, 0.7745966692],
 * //   weights: [0.5555555556, 0.8888888889, 0.5555555556] }
 */
export function rootsLegendre(n: number): RootsLegendreResult {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('rootsLegendre: n must be a positive integer');
  }

  const nodes: number[] = [];
  const weights: number[] = [];

  for (let i = 0; i < n; i++) {
    let x = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));

    for (let iter = 0; iter < NEWTON_MAX_ITERATIONS; iter++) {
      const [pCurr, pPrev] = legendrePair(n, x);
      const dpn = (n * (x * pCurr - pPrev)) / (x * x - 1);
      const dx = pCurr / dpn;
      x -= dx;
      if (Math.abs(dx) < NEWTON_TOLERANCE) break;
    }

    // Weight at the final node, with P_n and P_{n-1} in double-double. The node
    // is the root rounded to a double, and the weight is sensitive to that
    // rounding near ±1, so a first-order step moves the weight to the exact root.
    nodes.push(x);
    const [pn, t] = legendreWeightTermsDD(n, x);
    const om = (1 - x) * (1 + x);
    const d = (n * t) / om;
    const w0 = 2 / (om * d * d);
    weights.push(w0 * (1 + (2 * x * pn) / (om * d)));
  }

  // Initial guesses run from near +1 (i=0) down to near -1 (i=n-1); reverse
  // to return nodes in ascending order.
  nodes.reverse();
  weights.reverse();
  return { nodes, weights };
}
