/**
 * Gauss quadrature nodes and weights for classical weight functions.
 *
 * - Hermite (weight `e^{−x²}` on ℝ) and Laguerre (weight `x^α e^{−x}` on `[0, ∞)`):
 *   the Golub–Welsch method. The nodes are the eigenvalues of the symmetric tridiagonal
 *   Jacobi matrix of the weight (O(n²), `tridiagonal-eigen.ts`), refined by Newton steps
 *   on the orthonormal polynomial `p_n`; the weights come from the Christoffel formula
 *   `w_i = 1 / Σ_{k<n} p_k(x_i)²` with orthonormal `p_k`, rescaled so that the sum does
 *   not overflow.
 * - Jacobi (weight `(1−x)^α (1+x)^β` on `[−1, 1]`): the nodes are the roots of the
 *   degree-n orthogonal polynomial, found by a sign-change scan with bisection; the
 *   weights come from the same Christoffel formula.
 * - Chebyshev T and U: closed-form nodes and weights.
 *
 * @packageDocumentation
 */

import { assertAllocSize, assertLoopOrder } from '../utils/limits.js';
import { symTridiagEigenvalues } from './tridiagonal-eigen.js';

/**
 * Largest `n` for the Golub–Welsch rules (`rootsHermite`, `rootsLaguerre`). The cost is O(n²):
 * n = 5000 took 6.2 s (Hermite) and 7.1 s (Laguerre), and n = 9000 took 13.4 s and 29.1 s at
 * about 40% machine load, so 7000 is below the 20 s point.
 */
const MAX_GAUSS_RULE_DEGREE = 7000;

/** Largest `n` for `rootsJacobi` (n = 1200 took 14.0 s). */
const MAX_JACOBI_NODES = 1300;

/** Nodes (ascending) and matching weights. */
export interface GaussRule {
  nodes: number[];
  weights: number[];
}

function checkDegree(n: number, name: string, max?: number): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`${name}: n must be a positive integer`);
  }
  if (max !== undefined) assertLoopOrder(name, 'n', n, max);
}

function checkExponent(a: number, name: string): void {
  if (!Number.isFinite(a) || a <= -1) {
    throw new RangeError(`${name}: exponent must be finite and > -1`);
  }
}

/**
 * Γ(z) for z > 0: shift the argument up to ≥ 15 with the recurrence
 * `Γ(z) = Γ(z+1)/z`, then apply the Stirling series for ln Γ (relative error
 * well below 1e-14 at that size).
 */
function gammaFn(z: number): number {
  let shift = 1;
  let x = z;
  while (x < 15) {
    shift /= x;
    x += 1;
  }
  const inv = 1 / x;
  const inv2 = inv * inv;
  const series =
    inv *
    (1 / 12 -
      inv2 *
        (1 / 360 -
          inv2 *
            (1 / 1260 -
              inv2 * (1 / 1680 - inv2 * (1 / 1188 - inv2 * (691 / 360360 - inv2 / 156))))));
  const lnGamma = (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) + series;
  return shift * Math.exp(lnGamma);
}

/**
 * Find the `n` roots of `p` in `(lo, hi)` by scanning a grid for sign changes
 * and bisecting each bracket. The grid is offset so no node falls exactly on
 * a root. Throws if fewer than `n` roots are bracketed.
 */
function scanRoots(p: (x: number) => number, lo: number, hi: number, n: number): number[] {
  const m = Math.max(400, 400 * n);
  const h = (hi - lo) / m;
  const roots: number[] = [];
  let xPrev = lo + 0.37 * h;
  let sPrev = p(xPrev) >= 0;
  for (let j = 1; j <= m; j++) {
    const xCur = lo + (j + 0.37) * h;
    const sCur = p(xCur) >= 0;
    if (sCur !== sPrev) {
      let a = xPrev;
      let b = xCur;
      let sa = sPrev;
      for (let it = 0; it < 200; it++) {
        const mid = 0.5 * (a + b);
        if (mid === a || mid === b) break;
        if (p(mid) >= 0 === sa) {
          a = mid;
        } else {
          b = mid;
        }
      }
      roots.push(0.5 * (a + b));
      sa = sCur;
      sPrev = sa;
    } else {
      sPrev = sCur;
    }
    xPrev = xCur;
  }
  if (roots.length !== n) {
    throw new Error(`root scan found ${roots.length} of ${n} expected roots`);
  }
  return roots;
}

/** Jacobi P_k^{(α,β)}(x) for k = 0..n. */
function jacobiValues(n: number, alpha: number, beta: number, x: number): number[] {
  const vals = [1, alpha + 1 + ((alpha + beta + 2) * (x - 1)) / 2];
  for (let k = 1; k < n; k++) {
    const c = 2 * k + alpha + beta;
    const a1 = 2 * (k + 1) * (k + alpha + beta + 1) * c;
    const a2 = (c + 1) * (alpha * alpha - beta * beta);
    const a3 = c * (c + 1) * (c + 2);
    const a4 = 2 * (k + alpha) * (k + beta) * (c + 2);
    vals.push(((a2 + a3 * x) * vals[k] - a4 * vals[k - 1]) / a1);
  }
  return vals;
}

/**
 * Golub–Welsch rule for a weight whose orthonormal polynomials `p_k` satisfy
 * `x p_k = b_{k+1} p_{k+1} + a_k p_k + b_k p_{k−1}` with `p_0 = p0`.
 *
 * The nodes are the eigenvalues of the symmetric tridiagonal Jacobi matrix (diagonal `a_k`,
 * off-diagonal `b_k`). The eigenvalues are accurate to about `ε · max|node|` in absolute terms,
 * so two Newton steps on `p_n` restore the relative accuracy of the small nodes. The weights are
 * `w_i = μ_0 / Σ_{k<n} p_k(x_i)²`, here `1 / Σ p_k²` because `p0² = μ_0`. The recurrences
 * rescale by `1e-150` when a value passes `1e150`, so a weight below `1e-300` ends as 0 or as a
 * subnormal number instead of an overflow.
 */
function golubWelschRule(
  n: number,
  a: (k: number) => number,
  b: (k: number) => number,
  p0: number
): GaussRule {
  const diag = new Float64Array(n);
  const off = new Float64Array(n - 1);
  for (let k = 0; k < n; k++) diag[k] = a(k);
  for (let k = 1; k < n; k++) off[k - 1] = b(k);
  const nodes = symTridiagEigenvalues(diag, off);

  /** `p_n(x)`, `p_n'(x)`, `Σ_{k<n} p_k(x)²` and the number of rescales, all in the scaled units. */
  const evaluate = (x: number) => {
    let previous = 0;
    let current = p0;
    let dPrevious = 0;
    let dCurrent = 0;
    let sum = p0 * p0;
    let rescales = 0;
    for (let k = 0; k < n; k++) {
      const bk = k === 0 ? 0 : b(k);
      const bNext = b(k + 1);
      const next = ((x - a(k)) * current - bk * previous) / bNext;
      const dNext = ((x - a(k)) * dCurrent + current - bk * dPrevious) / bNext;
      previous = current;
      current = next;
      dPrevious = dCurrent;
      dCurrent = dNext;
      if (k + 1 < n) sum += current * current;
      if (Math.abs(current) > 1e150) {
        current *= 1e-150;
        previous *= 1e-150;
        dCurrent *= 1e-150;
        dPrevious *= 1e-150;
        sum *= 1e-300;
        rescales++;
      }
    }
    return { value: current, slope: dCurrent, sum, rescales };
  };

  const weights = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let x = nodes[i];
    for (let step = 0; step < 2; step++) {
      const v = evaluate(x);
      const dx = v.value / v.slope;
      if (Number.isFinite(dx)) x -= dx;
    }
    nodes[i] = x;
    const { sum, rescales } = evaluate(x);
    // Each rescale divides the sum by 1e300, so 1 / sum is too large by that factor.
    weights[i] = rescales === 0 ? 1 / sum : rescales === 1 ? (1 / sum) * 1e-300 : 0;
  }
  return { nodes, weights };
}

/**
 * Hermite Gauss rule: nodes are the roots of H_n; weights satisfy
 * `Σ w_i f(x_i) ≈ ∫ e^{−x²} f(x) dx`. Golub–Welsch (`a_k = 0`, `b_k = √(k/2)`,
 * `p_0 = π^{−1/4}`), so the cost is O(n²) and `n` up to `MAX_GAUSS_RULE_DEGREE` works.
 * The nodes are symmetric: `x_i = −x_{n−1−i}` and the middle node of an odd `n` is 0.
 *
 * @example
 * rootsHermite(2).nodes // [-0.7071067811865476, 0.7071067811865476]
 */
export function rootsHermite(n: number): GaussRule {
  checkDegree(n, 'rootsHermite', MAX_GAUSS_RULE_DEGREE);
  const rule = golubWelschRule(
    n,
    () => 0,
    (k) => Math.sqrt(k / 2),
    Math.pow(Math.PI, -0.25)
  );
  for (let i = 0; i < n >> 1; i++) {
    const j = n - 1 - i;
    const x = (rule.nodes[j] - rule.nodes[i]) / 2;
    const w = (rule.weights[i] + rule.weights[j]) / 2;
    rule.nodes[i] = -x;
    rule.nodes[j] = x;
    rule.weights[i] = w;
    rule.weights[j] = w;
  }
  if (n % 2 === 1) rule.nodes[n >> 1] = 0;
  return rule;
}

/**
 * Generalized Laguerre Gauss rule for weight `x^α e^{−x}` on `[0, ∞)`
 * (`α = 0` by default). Golub–Welsch (`a_k = 2k+α+1`, `b_k = √(k(k+α))`,
 * `p_0 = 1/√Γ(α+1)`), so the cost is O(n²) and `n` up to `MAX_GAUSS_RULE_DEGREE` works.
 *
 * @example
 * rootsLaguerre(2).nodes // [0.5857864376269049, 3.414213562373095]
 */
export function rootsLaguerre(n: number, alpha = 0): GaussRule {
  checkDegree(n, 'rootsLaguerre', MAX_GAUSS_RULE_DEGREE);
  checkExponent(alpha, 'rootsLaguerre');
  return golubWelschRule(
    n,
    (k) => 2 * k + alpha + 1,
    (k) => Math.sqrt(k * (k + alpha)),
    1 / Math.sqrt(gammaFn(alpha + 1))
  );
}

/**
 * Chebyshev first-kind Gauss rule for weight `1/√(1−x²)`: closed-form nodes
 * `cos((2i−1)π/(2n))` and equal weights `π/n`.
 *
 * @example
 * rootsChebyshevT(3).nodes // [-0.8660254037844387, 0, 0.8660254037844387]
 */
export function rootsChebyshevT(n: number): GaussRule {
  checkDegree(n, 'rootsChebyshevT');
  assertAllocSize('rootsChebyshevT', [n, 2]);
  const nodes: number[] = [];
  const weights: number[] = [];
  for (let i = n; i >= 1; i--) {
    nodes.push(Math.cos(((2 * i - 1) * Math.PI) / (2 * n)));
    weights.push(Math.PI / n);
  }
  return { nodes, weights };
}

/**
 * Chebyshev second-kind Gauss rule for weight `√(1−x²)`: nodes `cos(iπ/(n+1))`
 * and weights `π/(n+1) · sin²(iπ/(n+1))`.
 *
 * @example
 * rootsChebyshevU(1).nodes // [0]
 */
export function rootsChebyshevU(n: number): GaussRule {
  checkDegree(n, 'rootsChebyshevU');
  assertAllocSize('rootsChebyshevU', [n, 2]);
  const nodes: number[] = [];
  const weights: number[] = [];
  for (let i = n; i >= 1; i--) {
    const theta = (i * Math.PI) / (n + 1);
    nodes.push(Math.cos(theta));
    weights.push((Math.PI / (n + 1)) * Math.sin(theta) ** 2);
  }
  return { nodes, weights };
}

/**
 * Jacobi Gauss rule for weight `(1−x)^α (1+x)^β` on `[−1, 1]`. Weights use
 * the Christoffel formula with the Jacobi norms
 * `h_k = 2^{α+β+1}/(2k+α+β+1) · Γ(k+α+1)Γ(k+β+1)/(Γ(k+α+β+1) k!)`.
 *
 * @example
 * rootsJacobi(3, 0, 0) // Legendre: nodes ±√(3/5), 0
 */
export function rootsJacobi(n: number, alpha: number, beta: number): GaussRule {
  checkDegree(n, 'rootsJacobi', MAX_JACOBI_NODES);
  checkExponent(alpha, 'rootsJacobi');
  checkExponent(beta, 'rootsJacobi');
  const nodes = scanRoots((x) => jacobiValues(n, alpha, beta, x)[n], -1, 1, n);
  const hk: number[] = [];
  for (let k = 0; k < n; k++) {
    // k = 0: the generic factor 1/((2k+s)Γ(k+s)) with s = α+β+1 is 0·∞ at
    // s = 0 (α+β = −1, e.g. Chebyshev T); its limit is 1/Γ(s+1), used for k = 0.
    const norm =
      k === 0
        ? Math.pow(2, alpha + beta + 1) *
          Math.exp(lgammaAt(alpha + 1) + lgammaAt(beta + 1) - lgammaAt(alpha + beta + 2))
        : (Math.pow(2, alpha + beta + 1) / (2 * k + alpha + beta + 1)) *
          Math.exp(
            lgammaAt(k + alpha + 1) +
              lgammaAt(k + beta + 1) -
              lgammaAt(k + alpha + beta + 1) -
              lgammaAt(k + 1)
          );
    hk.push(norm);
  }
  const weights = nodes.map((x) => {
    const vals = jacobiValues(n - 1, alpha, beta, x);
    let s = 0;
    for (let k = 0; k < n; k++) s += (vals[k] * vals[k]) / hk[k];
    return 1 / s;
  });
  return { nodes, weights };
}

function lgammaAt(z: number): number {
  return Math.log(gammaFn(z));
}

/**
 * Gauss–Hermite approximation of `∫_ℝ e^{−x²} f(x) dx` with `n` nodes.
 *
 * @example
 * gaussHermiteIntegrate((x) => x * x, 5) // √π / 2
 */
export function gaussHermiteIntegrate(f: (x: number) => number, n: number): number {
  const { nodes, weights } = rootsHermite(n);
  let s = 0;
  for (let i = 0; i < n; i++) s += weights[i] * f(nodes[i]);
  return s;
}

/**
 * Gauss–Laguerre approximation of `∫₀^∞ e^{−x} f(x) dx` with `n` nodes.
 *
 * @example
 * gaussLaguerreIntegrate((x) => x * x, 5) // 2
 */
export function gaussLaguerreIntegrate(f: (x: number) => number, n: number): number {
  const { nodes, weights } = rootsLaguerre(n);
  let s = 0;
  for (let i = 0; i < n; i++) s += weights[i] * f(nodes[i]);
  return s;
}
