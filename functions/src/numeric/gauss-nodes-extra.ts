/**
 * Gauss quadrature nodes and weights for classical weight functions.
 *
 * - Hermite (weight `e^{−x²}` on ℝ), Laguerre (weight `x^α e^{−x}` on `[0, ∞)`),
 *   Jacobi (weight `(1−x)^α (1+x)^β` on `[−1, 1]`): the nodes are the roots of
 *   the degree-n orthogonal polynomial, found by a sign-change scan with
 *   bisection; the weights come from the Christoffel formula
 *   `w_i = 1 / Σ_{k<n} p_k(x_i)²` with orthonormal `p_k`.
 * - Chebyshev T and U: closed-form nodes and weights.
 *
 * @packageDocumentation
 */

/** Nodes (ascending) and matching weights. */
export interface GaussRule {
  nodes: number[];
  weights: number[];
}

function checkDegree(n: number, name: string): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`${name}: n must be a positive integer`);
  }
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

/** Physicists' Hermite H_k(x) by the three-term recurrence. */
function hermiteValues(n: number, x: number): number[] {
  const vals = [1, 2 * x];
  for (let k = 1; k < n; k++) {
    vals.push(2 * x * vals[k] - 2 * k * vals[k - 1]);
  }
  return vals;
}

/** Generalized Laguerre L_k^{(α)}(x) for k = 0..n. */
function laguerreValues(n: number, alpha: number, x: number): number[] {
  const vals = [1, 1 + alpha - x];
  for (let k = 1; k < n; k++) {
    vals.push(((2 * k + 1 + alpha - x) * vals[k] - (k + alpha) * vals[k - 1]) / (k + 1));
  }
  return vals;
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
 * Hermite Gauss rule: nodes are the roots of H_n; weights satisfy
 * `Σ w_i f(x_i) ≈ ∫ e^{−x²} f(x) dx`.
 *
 * @example
 * rootsHermite(2).nodes // [-0.7071067811865476, 0.7071067811865476]
 */
export function rootsHermite(n: number): GaussRule {
  checkDegree(n, 'rootsHermite');
  const bound = Math.sqrt(2 * n + 1) + 1;
  const nodes = scanRoots((x) => hermiteValues(n, x)[n], -bound, bound, n);
  const weights = nodes.map((x) => {
    const vals = hermiteValues(n - 1, x);
    let s = 0;
    for (let k = 0; k < n; k++) {
      s += (vals[k] * vals[k]) / (Math.pow(2, k) * gammaFn(k + 1) * Math.sqrt(Math.PI));
    }
    return 1 / s;
  });
  return { nodes, weights };
}

/**
 * Generalized Laguerre Gauss rule for weight `x^α e^{−x}` on `[0, ∞)`
 * (`α = 0` by default). Weights: `w_i = 1 / Σ_{k<n} k! (L_k^α(x_i))² / Γ(k+α+1)`.
 *
 * @example
 * rootsLaguerre(2).nodes // [0.5857864376269049, 3.414213562373095]
 */
export function rootsLaguerre(n: number, alpha = 0): GaussRule {
  checkDegree(n, 'rootsLaguerre');
  checkExponent(alpha, 'rootsLaguerre');
  const upper = 4 * n + 2 * alpha + 4;
  const nodes = scanRoots((x) => laguerreValues(n, alpha, x)[n], 0, upper, n);
  const hk: number[] = [];
  let fact = 1;
  for (let k = 0; k < n; k++) {
    hk.push(fact / gammaFn(k + alpha + 1));
    fact *= k + 1;
  }
  const weights = nodes.map((x) => {
    const vals = laguerreValues(n - 1, alpha, x);
    let s = 0;
    for (let k = 0; k < n; k++) s += hk[k] * vals[k] * vals[k];
    return 1 / s;
  });
  return { nodes, weights };
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
  checkDegree(n, 'rootsJacobi');
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
