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

/**
 * n-point Gauss-Legendre quadrature nodes and weights on [-1, 1].
 *
 * Nodes are the roots of the degree-n Legendre polynomial P_n, refined by
 * Newton's method from the standard asymptotic initial guess
 * `cos(pi*(i+0.75)/(n+0.5))`. Weights are `2 / ((1-x_i^2) * P'_n(x_i)^2)`.
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

    let pn: number;
    let dpn = 0;
    for (let iter = 0; iter < NEWTON_MAX_ITERATIONS; iter++) {
      const [pCurr, pPrev] = legendrePair(n, x);
      pn = pCurr;
      dpn = (n * (x * pCurr - pPrev)) / (x * x - 1);
      const dx = pn / dpn;
      x -= dx;
      if (Math.abs(dx) < NEWTON_TOLERANCE) break;
    }

    nodes.push(x);
    weights.push(2 / ((1 - x * x) * dpn * dpn));
  }

  // Initial guesses run from near +1 (i=0) down to near -1 (i=n-1); reverse
  // to return nodes in ascending order.
  nodes.reverse();
  weights.reverse();
  return { nodes, weights };
}
