/**
 * Typed Numerical Methods Functions
 *
 * Root finding, optimization, integration, interpolation, curve fitting,
 * ODE solvers, and linear algebra utilities. All implementations are
 * pure TypeScript with the WASM acceleration path pattern.
 *
 * These use plain exports (not mathTyped) because most accept function
 * arguments, which typed-function does not handle well.
 *
 * @packageDocumentation
 */

import { wasmLoader } from '../wasm/WasmLoader.js';
import { rosenbrockSolve } from '../numeric/solveODE.js';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

type f64 = number;
type i32 = number;

// Threshold: use WASM for arrays larger than this
const NUMERIC_WASM_THRESHOLD = 16;

// =============================================================================
// Root Finding
// =============================================================================

/**
 * Options for root-finding algorithms.
 */
export interface FindRootOptions {
  /** Absolute tolerance for convergence (default 1e-12) */
  tol?: f64;
  /** Maximum iterations (default 100) */
  maxIter?: i32;
}

/**
 * Find a root of f(x) = 0 in [a, b] using Brent's method.
 *
 * Brent's method combines bisection, secant, and inverse quadratic
 * interpolation for superlinear convergence with guaranteed reliability.
 *
 * @param f - Continuous function
 * @param a - Lower bound (f(a) and f(b) must have opposite signs)
 * @param b - Upper bound
 * @param opts - Options (tol, maxIter)
 * @returns Approximate root
 *
 * @example
 * findRoot(x => x**2 - 2, 1, 2) // => ~1.4142135
 */
export function findRoot(f: (x: f64) => f64, a: f64, b: f64, opts?: FindRootOptions): f64 {
  const tol = opts?.tol ?? 1e-12;
  const maxIter = opts?.maxIter ?? 100;

  let fa = f(a);
  let fb = f(b);

  if (fa * fb > 0) {
    throw new Error('findRoot: f(a) and f(b) must have opposite signs');
  }

  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }

  let c = a;
  let fc = fa;
  let mflag = true;
  let d = 0;
  let s: f64;

  for (let iter = 0; iter < maxIter; iter++) {
    if (Math.abs(fb) < tol || Math.abs(b - a) < tol) {
      return b;
    }

    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      // Secant method
      s = b - (fb * (b - a)) / (fb - fa);
    }

    // Conditions for accepting s
    const cond1 = s < (3 * a + b) / 4 || s > b;
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < tol;
    const cond5 = !mflag && Math.abs(c - d) < tol;

    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    const fs = f(s);
    d = c;
    c = b;
    fc = fb;

    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
  }

  return b;
}

/**
 * Solve linear system Ax = b using LU decomposition with partial pivoting.
 *
 * @param A - Coefficient matrix (n x n)
 * @param b - Right-hand side vector (length n)
 * @returns Solution vector x
 *
 * @example
 * linsolve([[2, 1], [1, 3]], [5, 10]) // => [1, 3]
 */
export function linsolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  if (n === 0) throw new Error('linsolve: empty matrix');
  if (A[0].length !== n) throw new Error('linsolve: matrix must be square');
  if (b.length !== n) throw new Error('linsolve: dimension mismatch');

  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-15) throw new Error('linsolve: singular matrix');
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }

  return x;
}

// =============================================================================
// Optimization
// =============================================================================

/**
 * Options for optimization algorithms.
 */
export interface MinimizeOptions {
  /** Absolute tolerance (default 1e-8) */
  tol?: f64;
  /** Maximum iterations (default 1000) */
  maxIter?: i32;
  /** Initial simplex step size (default 0.1) */
  step?: f64;
}

/**
 * Minimize a function using the Nelder-Mead simplex method.
 *
 * @param f - Objective function (n-dimensional input)
 * @param x0 - Initial guess
 * @param opts - Options
 * @returns Approximate minimizer
 *
 * @example
 * minimize(x => (x[0]-1)**2 + (x[1]-2)**2, [0, 0]) // => ~[1, 2]
 */
export function minimize(f: (x: number[]) => f64, x0: number[], opts?: MinimizeOptions): number[] {
  const tol = opts?.tol ?? 1e-8;
  const maxIter = opts?.maxIter ?? 1000;
  const step = opts?.step ?? 0.1;
  const n = x0.length;
  const alpha = 1.0; // reflection
  const gamma = 2.0; // expansion
  const rho = 0.5; // contraction
  const sigma = 0.5; // shrink

  // Initialize simplex
  const simplex: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] += step;
    simplex.push(p);
  }

  const fValues = simplex.map((p) => f(p));

  for (let iter = 0; iter < maxIter; iter++) {
    // Sort by function value
    const indices = Array.from({ length: n + 1 }, (_, i) => i);
    indices.sort((a, b) => fValues[a] - fValues[b]);
    const sorted = indices.map((i) => simplex[i]);
    const sortedF = indices.map((i) => fValues[i]);
    for (let i = 0; i <= n; i++) {
      simplex[i] = sorted[i];
      fValues[i] = sortedF[i];
    }

    // Check convergence
    let maxDiff: f64 = 0;
    for (let i = 1; i <= n; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(fValues[i] - fValues[0]));
    }
    if (maxDiff < tol) break;

    // Centroid of all points except worst
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += simplex[i][j];
      }
    }
    for (let j = 0; j < n; j++) centroid[j] /= n;

    // Reflection
    const xr = centroid.map((c, j) => c + alpha * (c - simplex[n][j]));
    const fr = f(xr);

    if (fr < fValues[n - 1] && fr >= fValues[0]) {
      simplex[n] = xr;
      fValues[n] = fr;
      continue;
    }

    if (fr < fValues[0]) {
      // Expansion
      const xe = centroid.map((c, j) => c + gamma * (xr[j] - c));
      const fe = f(xe);
      if (fe < fr) {
        simplex[n] = xe;
        fValues[n] = fe;
      } else {
        simplex[n] = xr;
        fValues[n] = fr;
      }
      continue;
    }

    // Contraction
    const xc = centroid.map((c, j) => c + rho * (simplex[n][j] - c));
    const fc = f(xc);
    if (fc < fValues[n]) {
      simplex[n] = xc;
      fValues[n] = fc;
      continue;
    }

    // Shrink
    for (let i = 1; i <= n; i++) {
      for (let j = 0; j < n; j++) {
        simplex[i][j] = simplex[0][j] + sigma * (simplex[i][j] - simplex[0][j]);
      }
      fValues[i] = f(simplex[i]);
    }
  }

  // Return best point
  let bestIdx = 0;
  for (let i = 1; i <= n; i++) {
    if (fValues[i] < fValues[bestIdx]) bestIdx = i;
  }
  return simplex[bestIdx];
}

/**
 * Maximize a function using Nelder-Mead (negates objective).
 *
 * @param f - Objective function
 * @param x0 - Initial guess
 * @param opts - Options
 * @returns Approximate maximizer
 */
export function maximize(f: (x: number[]) => f64, x0: number[], opts?: MinimizeOptions): number[] {
  return minimize((x) => -f(x), x0, opts);
}

/**
 * Global minimization using basin-hopping (random perturbation + local min).
 *
 * @param f - Objective function
 * @param bounds - Array of [min, max] for each dimension
 * @param opts - Options (maxIter controls number of hops)
 * @returns Approximate global minimizer
 */
export function globalMinimize(
  f: (x: number[]) => f64,
  bounds: [number, number][],
  opts?: MinimizeOptions & { nHops?: i32 }
): number[] {
  const nHops = opts?.nHops ?? 20;

  // Random initial point within bounds
  function randomPoint(): number[] {
    return bounds.map(([lo, hi]) => lo + Math.random() * (hi - lo));
  }

  let bestX = randomPoint();
  let bestF = f(bestX);

  for (let hop = 0; hop < nHops; hop++) {
    const x0 = hop === 0 ? bestX : randomPoint();
    const localMin = minimize(f, x0, { ...opts, maxIter: opts?.maxIter ?? 200 });
    const fv = f(localMin);
    if (fv < bestF) {
      bestF = fv;
      bestX = localMin;
    }
  }

  return bestX;
}

/**
 * Least squares solution: minimize ||Ax - b||^2 via normal equations.
 *
 * @param A - Matrix (m x n), m >= n
 * @param b - Right-hand side (length m)
 * @returns Least squares solution x (length n)
 */
export function leastSquares(A: number[][], b: number[]): number[] {
  const m = A.length;
  const n = A[0].length;

  // WASM-accelerated path
  if (m >= NUMERIC_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const flatA = new Float64Array(m * n);
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) flatA[i * n + j] = A[i][j];
        const aAlloc = wasmLoader.allocateFloat64Array(flatA);
        const bAlloc = wasmLoader.allocateFloat64Array(new Float64Array(b));
        const xAlloc = wasmLoader.allocateFloat64Array(new Float64Array(n));
        try {
          wasm.least_squares_wasm(aAlloc.ptr, bAlloc.ptr, m, n, xAlloc.ptr);
          return Array.from(xAlloc.array);
        } finally {
          wasmLoader.free(aAlloc.ptr);
          wasmLoader.free(bAlloc.ptr);
          wasmLoader.free(xAlloc.ptr);
        }
      } catch {
        /* fall through to JS */
      }
    }
  }

  // A^T * A
  const AtA: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += A[k][i] * A[k][j];
      AtA[i][j] = s;
    }
  }

  // A^T * b
  const Atb: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < m; k++) s += A[k][i] * b[k];
    Atb[i] = s;
  }

  return linsolve(AtA, Atb);
}

// =============================================================================
// Integration (Wrappers)
// =============================================================================

/**
 * Adaptive numerical integration using Gauss-Legendre quadrature
 * with recursive subdivision.
 *
 * @param f - Function to integrate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param opts - Options (tol, maxIter for max subdivisions)
 * @returns Approximate integral
 */
export function nintegrate(
  f: (x: f64) => f64,
  a: f64,
  b: f64,
  opts?: { tol?: f64; maxDepth?: i32 }
): f64 {
  const tol = opts?.tol ?? 1e-10;
  const maxDepth = opts?.maxDepth ?? 30;

  function adaptiveQuad(a: f64, b: f64, depth: i32): f64 {
    const mid = (a + b) / 2;
    const whole = gaussLegendre5(f, a, b);
    const left = gaussLegendre5(f, a, mid);
    const right = gaussLegendre5(f, mid, b);
    const refined = left + right;

    if (depth >= maxDepth || Math.abs(refined - whole) < 15 * tol) {
      return refined + (refined - whole) / 15;
    }

    return adaptiveQuad(a, mid, depth + 1) + adaptiveQuad(mid, b, depth + 1);
  }

  return adaptiveQuad(a, b, 0);
}

/** 5-point Gauss-Legendre quadrature on [a,b] */
function gaussLegendre5(f: (x: f64) => f64, a: f64, b: f64): f64 {
  const nodes = [-0.906179845938664, -0.5384693101056831, 0, 0.5384693101056831, 0.906179845938664];
  const weights = [
    0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665,
    0.2369268850561891,
  ];
  const hw = (b - a) / 2;
  const mid = (a + b) / 2;
  let sum = 0;
  for (let i = 0; i < 5; i++) {
    sum += weights[i] * f(hw * nodes[i] + mid);
  }
  return hw * sum;
}

/**
 * Simpson's 1/3 rule (convenience alias).
 *
 * @param f - Function to integrate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param n - Number of subintervals (even, default 100)
 * @returns Approximate integral
 */
export function simpsons(f: (x: f64) => f64, a: f64, b: f64, n: i32 = 100): f64 {
  if (n % 2 !== 0) n += 1;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
  }
  return (h / 3) * sum;
}

// =============================================================================
// Interpolation
// =============================================================================

/**
 * Unified interpolation API.
 *
 * @param xs - Sorted x-coordinates
 * @param ys - Corresponding y-values
 * @param method - 'linear' | 'lagrange' | 'spline' (default 'linear')
 * @returns Interpolation function
 */
export function interpolate(
  xs: number[],
  ys: number[],
  method: 'linear' | 'lagrange' | 'spline' = 'linear'
): (x: f64) => f64 {
  if (xs.length !== ys.length || xs.length < 2) {
    throw new Error('interpolate: need at least 2 matching data points');
  }

  switch (method) {
    case 'lagrange':
      return (x: f64) => {
        let result = 0;
        for (let i = 0; i < xs.length; i++) {
          let basis = 1;
          for (let j = 0; j < xs.length; j++) {
            if (i !== j) basis *= (x - xs[j]) / (xs[i] - xs[j]);
          }
          result += ys[i] * basis;
        }
        return result;
      };

    case 'spline': {
      // Natural cubic spline
      const n = xs.length - 1;
      const h: number[] = [];
      for (let i = 0; i < n; i++) h[i] = xs[i + 1] - xs[i];

      const alpha: number[] = [0];
      for (let i = 1; i < n; i++) {
        alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
      }
      const l: number[] = [1];
      const mu: number[] = [0];
      const z: number[] = [0];
      for (let i = 1; i < n; i++) {
        l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
        mu[i] = h[i] / l[i];
        z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
      }
      const c = new Array(n + 1).fill(0);
      const bArr = new Array(n);
      const d = new Array(n);
      for (let j = n - 1; j >= 0; j--) {
        c[j] = z[j] - mu[j] * c[j + 1];
        bArr[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
        d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
      }
      const aArr = ys.slice(0, n);

      return (x: f64) => {
        let j: i32;
        if (x <= xs[0]) j = 0;
        else if (x >= xs[n]) j = n - 1;
        else {
          j = 0;
          for (j = 0; j < n; j++) {
            if (x >= xs[j] && x <= xs[j + 1]) break;
          }
        }
        const dx = x - xs[j];
        return aArr[j] + bArr[j] * dx + c[j] * dx * dx + d[j] * dx * dx * dx;
      };
    }

    case 'linear':
    default:
      return (x: f64) => {
        let i = 0;
        if (x <= xs[0]) i = 0;
        else if (x >= xs[xs.length - 1]) i = xs.length - 2;
        else {
          for (i = 0; i < xs.length - 1; i++) {
            if (x >= xs[i] && x <= xs[i + 1]) break;
          }
        }
        const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
        return ys[i] + t * (ys[i + 1] - ys[i]);
      };
  }
}

/**
 * Cubic spline interpolation (alias).
 */
export function cspline(xs: number[], ys: number[]): (x: f64) => f64 {
  return interpolate(xs, ys, 'spline');
}

/**
 * PCHIP interpolation (alias wrapping the value-returning function).
 */
export function pchip(xs: number[], ys: number[], x: f64): f64 {
  // Re-implement inline to avoid circular import
  const n = xs.length;
  if (n < 2) throw new Error('pchip: need at least 2 points');

  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) delta[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);

  const m: number[] = new Array(n);
  if (n === 2) {
    m[0] = delta[0];
    m[1] = delta[0];
  } else {
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) {
        m[i] = 0;
        continue;
      }
      const h1 = xs[i] - xs[i - 1];
      const h2 = xs[i + 1] - xs[i];
      const w1 = 2 * h2 + h1;
      const w2 = h2 + 2 * h1;
      m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
    m[0] = delta[0];
    m[n - 1] = delta[n - 2];
  }

  let idx = 0;
  if (x <= xs[0]) idx = 0;
  else if (x >= xs[n - 1]) idx = n - 2;
  else {
    for (idx = 0; idx < n - 1; idx++) {
      if (x >= xs[idx] && x <= xs[idx + 1]) break;
    }
  }

  const h = xs[idx + 1] - xs[idx];
  const t = (x - xs[idx]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[idx] +
    (t3 - 2 * t2 + t) * h * m[idx] +
    (-2 * t3 + 3 * t2) * ys[idx + 1] +
    (t3 - t2) * h * m[idx + 1]
  );
}

/**
 * Evaluate a Bezier curve at parameter t.
 *
 * @param controlPoints - Array of control points (each a number[])
 * @param t - Parameter in [0, 1]
 * @returns Point on curve
 */
export function bezierCurve(controlPoints: number[][], t: f64): number[] {
  if (controlPoints.length === 0) throw new Error('bezierCurve: need at least 1 control point');

  const nPts = controlPoints.length;
  const dims = controlPoints[0].length;

  // WASM-accelerated path
  if (nPts >= NUMERIC_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const flat = new Float64Array(nPts * dims);
        for (let i = 0; i < nPts; i++)
          for (let d = 0; d < dims; d++) flat[i * dims + d] = controlPoints[i][d];
        const ctrlAlloc = wasmLoader.allocateFloat64Array(flat);
        const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(dims));
        try {
          wasm.bezier_eval_wasm(ctrlAlloc.ptr, nPts, dims, t, resultAlloc.ptr);
          return Array.from(resultAlloc.array);
        } finally {
          wasmLoader.free(ctrlAlloc.ptr);
          wasmLoader.free(resultAlloc.ptr);
        }
      } catch {
        /* fall through to JS */
      }
    }
  }

  // De Casteljau's algorithm
  let points = controlPoints.map((p) => p.slice());
  while (points.length > 1) {
    const next: number[][] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p: number[] = [];
      for (let d = 0; d < points[i].length; d++) {
        p.push((1 - t) * points[i][d] + t * points[i + 1][d]);
      }
      next.push(p);
    }
    points = next;
  }
  return points[0];
}

/**
 * Evaluate a B-spline at parameter t.
 *
 * @param controlPoints - Array of control points
 * @param degree - Spline degree (must be < number of control points)
 * @param t - Parameter in [0, 1]
 * @returns Point on B-spline
 */
export function bspline(controlPoints: number[][], degree: i32, t: f64): number[] {
  const n = controlPoints.length;
  const p = degree;

  if (n <= p) throw new Error('bspline: need more control points than degree');

  // Uniform clamped knot vector
  const m = n + p + 1;
  const knots: number[] = new Array(m);
  for (let i = 0; i <= p; i++) knots[i] = 0;
  for (let i = p + 1; i < m - p - 1; i++) knots[i] = (i - p) / (n - p);
  for (let i = m - p - 1; i < m; i++) knots[i] = 1;

  // Clamp t
  const tClamped = Math.max(0, Math.min(1 - 1e-15, t));

  // De Boor's algorithm
  // Find knot span
  let k = p;
  for (let i = p; i < n; i++) {
    if (tClamped >= knots[i] && tClamped < knots[i + 1]) {
      k = i;
      break;
    }
  }

  const dim = controlPoints[0].length;
  const d: number[][] = [];
  for (let j = 0; j <= p; j++) {
    d[j] = controlPoints[k - p + j].slice();
  }

  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const idx = k - p + j;
      const alpha = (tClamped - knots[idx]) / (knots[idx + p - r + 1] - knots[idx]);
      for (let dd = 0; dd < dim; dd++) {
        d[j][dd] = (1 - alpha) * d[j - 1][dd] + alpha * d[j][dd];
      }
    }
  }

  return d[p];
}

/**
 * LOESS/LOWESS locally weighted regression.
 *
 * @param xs - x-coordinates
 * @param ys - y-values
 * @param x - Point to evaluate
 * @param bandwidth - Fraction of data to use (default 0.3)
 * @returns Smoothed value at x
 */
export function loess(xs: number[], ys: number[], x: f64, bandwidth: f64 = 0.3): f64 {
  const n = xs.length;

  // WASM-accelerated path
  if (n >= NUMERIC_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const xsAlloc = wasmLoader.allocateFloat64Array(new Float64Array(xs));
        const ysAlloc = wasmLoader.allocateFloat64Array(new Float64Array(ys));
        try {
          const result = wasm.loess_wasm(xsAlloc.ptr, ysAlloc.ptr, n, x, bandwidth);
          return result as f64;
        } finally {
          wasmLoader.free(xsAlloc.ptr);
          wasmLoader.free(ysAlloc.ptr);
        }
      } catch {
        /* fall through to JS */
      }
    }
  }

  const k = Math.max(2, Math.ceil(bandwidth * n));

  // Find k nearest neighbors
  const dists = xs.map((xi, i) => ({ dist: Math.abs(xi - x), i }));
  dists.sort((a, b) => a.dist - b.dist);
  const neighbors = dists.slice(0, k);
  const maxDist = neighbors[k - 1].dist || 1;

  // Tricube kernel weights
  const weights = neighbors.map((nb) => {
    const u = nb.dist / maxDist;
    return u < 1 ? Math.pow(1 - u * u * u, 3) : 0;
  });

  // Weighted linear regression
  let sw = 0,
    swx = 0,
    swy = 0,
    swxx = 0,
    swxy = 0;
  for (let j = 0; j < k; j++) {
    const i = neighbors[j].i;
    const w = weights[j];
    sw += w;
    swx += w * xs[i];
    swy += w * ys[i];
    swxx += w * xs[i] * xs[i];
    swxy += w * xs[i] * ys[i];
  }

  const det = sw * swxx - swx * swx;
  if (Math.abs(det) < 1e-15) return swy / sw;

  const a = (swxx * swy - swx * swxy) / det;
  const b = (sw * swxy - swx * swy) / det;
  return a + b * x;
}

/**
 * Scattered data gridding using inverse distance weighting.
 *
 * @param points - Array of [x, y] data locations
 * @param values - Corresponding values
 * @param xi - x-coordinates of grid
 * @param yi - y-coordinates of grid
 * @returns 2D array of interpolated values [yi.length][xi.length]
 */
export function griddata(
  points: number[][],
  values: number[],
  xi: number[],
  yi: number[]
): number[][] {
  const n = points.length;

  // WASM-accelerated path (flatten grid to 1D, then reshape)
  if (n >= NUMERIC_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const flatPts = new Float64Array(n * 2);
        for (let i = 0; i < n; i++) {
          flatPts[i * 2] = points[i][0];
          flatPts[i * 2 + 1] = points[i][1];
        }
        // Flatten xi/yi into all grid point pairs
        const ni = xi.length * yi.length;
        const flatXi = new Float64Array(ni);
        const flatYi = new Float64Array(ni);
        let idx = 0;
        for (let j = 0; j < yi.length; j++) {
          for (let i = 0; i < xi.length; i++) {
            flatXi[idx] = xi[i];
            flatYi[idx] = yi[j];
            idx++;
          }
        }
        const ptsAlloc = wasmLoader.allocateFloat64Array(flatPts);
        const valsAlloc = wasmLoader.allocateFloat64Array(new Float64Array(values));
        const xiAlloc = wasmLoader.allocateFloat64Array(flatXi);
        const yiAlloc = wasmLoader.allocateFloat64Array(flatYi);
        const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(ni));
        try {
          wasm.griddata_wasm(
            ptsAlloc.ptr,
            valsAlloc.ptr,
            n,
            xiAlloc.ptr,
            yiAlloc.ptr,
            ni,
            resultAlloc.ptr
          );
          const result2d: number[][] = [];
          let k = 0;
          for (let j = 0; j < yi.length; j++) {
            const row: number[] = [];
            for (let i = 0; i < xi.length; i++) {
              row.push(resultAlloc.array[k++]);
            }
            result2d.push(row);
          }
          return result2d;
        } finally {
          wasmLoader.free(ptsAlloc.ptr);
          wasmLoader.free(valsAlloc.ptr);
          wasmLoader.free(xiAlloc.ptr);
          wasmLoader.free(yiAlloc.ptr);
          wasmLoader.free(resultAlloc.ptr);
        }
      } catch {
        /* fall through to JS */
      }
    }
  }

  const result: number[][] = [];
  const p = 2; // IDW power

  for (let j = 0; j < yi.length; j++) {
    const row: number[] = [];
    for (let i = 0; i < xi.length; i++) {
      let sumW = 0;
      let sumWV = 0;
      let exact = false;
      let exactVal = 0;

      for (let k = 0; k < points.length; k++) {
        const dx = xi[i] - points[k][0];
        const dy = yi[j] - points[k][1];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-15) {
          exact = true;
          exactVal = values[k];
          break;
        }
        const w = 1 / Math.pow(d, p);
        sumW += w;
        sumWV += w * values[k];
      }

      row.push(exact ? exactVal : sumWV / sumW);
    }
    result.push(row);
  }

  return result;
}

/**
 * Radial basis function interpolation.
 *
 * @param points - Data point locations (array of number[])
 * @param values - Data values
 * @param xi - Query points
 * @param kernel - RBF kernel: 'gaussian' | 'multiquadric' | 'thinplate' (default 'gaussian')
 * @returns Interpolated values at xi
 */
export function rbfInterpolate(
  points: number[][],
  values: number[],
  xi: number[][],
  kernel: 'gaussian' | 'multiquadric' | 'thinplate' = 'gaussian'
): number[] {
  const n = points.length;
  const dim = points[0].length;

  // WASM-accelerated path (Gaussian kernel only)
  if (kernel === 'gaussian' && n >= NUMERIC_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const ni = xi.length;
        const flatPts = new Float64Array(n * dim);
        for (let i = 0; i < n; i++)
          for (let d = 0; d < dim; d++) flatPts[i * dim + d] = points[i][d];
        const flatXi = new Float64Array(ni * dim);
        for (let i = 0; i < ni; i++) for (let d = 0; d < dim; d++) flatXi[i * dim + d] = xi[i][d];
        const ptsAlloc = wasmLoader.allocateFloat64Array(flatPts);
        const valsAlloc = wasmLoader.allocateFloat64Array(new Float64Array(values));
        const xiAlloc = wasmLoader.allocateFloat64Array(flatXi);
        const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(ni));
        try {
          wasm.rbf_interp_wasm(
            ptsAlloc.ptr,
            valsAlloc.ptr,
            n,
            dim,
            xiAlloc.ptr,
            ni,
            resultAlloc.ptr
          );
          return Array.from(resultAlloc.array);
        } finally {
          wasmLoader.free(ptsAlloc.ptr);
          wasmLoader.free(valsAlloc.ptr);
          wasmLoader.free(xiAlloc.ptr);
          wasmLoader.free(resultAlloc.ptr);
        }
      } catch {
        /* fall through to JS */
      }
    }
  }

  // Compute average distance for epsilon
  let sumDist = 0;
  let count = 0;
  for (let i = 0; i < Math.min(n, 50); i++) {
    for (let j = i + 1; j < Math.min(n, 50); j++) {
      let d = 0;
      for (let k = 0; k < dim; k++) {
        const dk = points[i][k] - points[j][k];
        d += dk * dk;
      }
      sumDist += Math.sqrt(d);
      count++;
    }
  }
  const eps = count > 0 ? 1 / (sumDist / count) : 1;

  // RBF kernel function
  function phi(r: f64): f64 {
    switch (kernel) {
      case 'multiquadric':
        return Math.sqrt(1 + Math.pow(eps * r, 2));
      case 'thinplate':
        return r === 0 ? 0 : r * r * Math.log(r);
      case 'gaussian':
      default:
        return Math.exp(-Math.pow(eps * r, 2));
    }
  }

  function dist(a: number[], b: number[]): f64 {
    let s = 0;
    for (let k = 0; k < dim; k++) {
      const dk = a[k] - b[k];
      s += dk * dk;
    }
    return Math.sqrt(s);
  }

  // Build interpolation matrix and solve
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(phi(dist(points[i], points[j])));
    }
    A.push(row);
  }

  const weights = linsolve(A, values);

  // Evaluate at query points
  return xi.map((q) => {
    let s = 0;
    for (let j = 0; j < n; j++) {
      s += weights[j] * phi(dist(q, points[j]));
    }
    return s;
  });
}

// =============================================================================
// Curve Fitting
// =============================================================================

/**
 * Nonlinear curve fitting using Levenberg-Marquardt algorithm.
 *
 * @param f - Model function f(x, params) => y
 * @param xs - x data
 * @param ys - y data
 * @param p0 - Initial parameter guess
 * @returns Fitted parameters
 */
export function curvefit(
  f: (x: f64, params: number[]) => f64,
  xs: number[],
  ys: number[],
  p0: number[]
): number[] {
  const m = xs.length;
  const n = p0.length;
  let params = p0.slice();
  let lambda = 0.001;
  const maxIter = 200;
  const delta = 1e-8;

  function residuals(p: number[]): number[] {
    return xs.map((x, i) => ys[i] - f(x, p));
  }

  function jacobian(p: number[]): number[][] {
    const J: number[][] = [];
    const r0 = residuals(p);
    for (let i = 0; i < m; i++) {
      J[i] = [];
      for (let j = 0; j < n; j++) {
        const pj = p.slice();
        pj[j] += delta;
        const rj = ys[i] - f(xs[i], pj);
        J[i][j] = (rj - r0[i]) / delta;
      }
    }
    return J;
  }

  function sumSqResiduals(p: number[]): f64 {
    return residuals(p).reduce((s, r) => s + r * r, 0);
  }

  let prevCost = sumSqResiduals(params);

  for (let iter = 0; iter < maxIter; iter++) {
    const r = residuals(params);
    const J = jacobian(params);

    // J^T J
    const JtJ: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const Jtr: number[] = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < m; k++) s += J[k][i] * J[k][j];
        JtJ[i][j] = s;
      }
      let s = 0;
      for (let k = 0; k < m; k++) s += J[k][i] * r[k];
      Jtr[i] = -s;
    }

    // (J^T J + lambda * diag(J^T J)) dp = -J^T r
    const A: number[][] = JtJ.map((row) => row.slice());
    for (let i = 0; i < n; i++) {
      A[i][i] += lambda * (JtJ[i][i] || 1);
    }

    try {
      const dp = linsolve(A, Jtr);
      const newParams = params.map((p, i) => p + dp[i]);
      const newCost = sumSqResiduals(newParams);

      const costChange = Math.abs(newCost - prevCost);
      if (newCost < prevCost) {
        params = newParams;
        prevCost = newCost;
        lambda *= 0.1;
      } else {
        lambda *= 10;
      }

      if (costChange < 1e-15) break;
    } catch {
      lambda *= 10;
    }
  }

  return params;
}

/**
 * Exponential fit: y = a * exp(b * x).
 *
 * @param xs - x data
 * @param ys - y data (must be positive)
 * @returns [a, b] coefficients
 */
export function expfit(xs: number[], ys: number[]): [f64, f64] {
  // Log-linearize: ln(y) = ln(a) + b*x
  const logYs = ys.map((y) => Math.log(Math.abs(y) || 1e-15));
  const n = xs.length;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += logYs[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * logYs[i];
  }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const lna = (sy - b * sx) / n;
  return [Math.exp(lna), b];
}

/**
 * Logarithmic fit: y = a * ln(x) + b.
 *
 * @param xs - x data (must be positive)
 * @param ys - y data
 * @returns [a, b] coefficients
 */
export function logfit(xs: number[], ys: number[]): [f64, f64] {
  const logXs = xs.map((x) => Math.log(x));
  const n = xs.length;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += logXs[i];
    sy += ys[i];
    sxx += logXs[i] * logXs[i];
    sxy += logXs[i] * ys[i];
  }
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b = (sy - a * sx) / n;
  return [a, b];
}

/**
 * Power fit: y = a * x^b.
 *
 * @param xs - x data (must be positive)
 * @param ys - y data (must be positive)
 * @returns [a, b] coefficients
 */
export function powerfit(xs: number[], ys: number[]): [f64, f64] {
  // Log-linearize: ln(y) = ln(a) + b*ln(x)
  const logXs = xs.map((x) => Math.log(x));
  const logYs = ys.map((y) => Math.log(y));
  const n = xs.length;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += logXs[i];
    sy += logYs[i];
    sxx += logXs[i] * logXs[i];
    sxy += logXs[i] * logYs[i];
  }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const lna = (sy - b * sx) / n;
  return [Math.exp(lna), b];
}

// =============================================================================
// ODE Solvers
// =============================================================================

/**
 * ODE solution result.
 */
export interface ODESolution {
  t: number[];
  y: number[][];
}

/**
 * Solve a system of ODEs dy/dt = f(t, y) using RK45 (Dormand-Prince).
 *
 * @param f - System function (t, y) => dy/dt
 * @param y0 - Initial state vector
 * @param tspan - [t0, tf] time span
 * @param opts - Options (tol, maxIter for max steps)
 * @returns Solution { t, y }
 */
export function solveODESystem(
  f: (t: f64, y: number[]) => number[],
  y0: number[],
  tspan: [f64, f64],
  opts?: { tol?: f64; maxSteps?: i32; dt?: f64 }
): ODESolution {
  const n = y0.length;
  const dt = opts?.dt ?? (tspan[1] - tspan[0]) / 200;
  const nSteps = Math.ceil((tspan[1] - tspan[0]) / dt);
  const h = (tspan[1] - tspan[0]) / nSteps;

  const ts: number[] = [tspan[0]];
  const ys: number[][] = [y0.slice()];
  let t = tspan[0];
  let y = y0.slice();

  function vadd(a: number[], b: number[], s: f64): number[] {
    return a.map((v, i) => v + s * b[i]);
  }

  for (let step = 0; step < nSteps; step++) {
    // RK4 step
    const k1 = f(t, y);
    const k2 = f(t + h / 2, vadd(y, k1, h / 2));
    const k3 = f(t + h / 2, vadd(y, k2, h / 2));
    const k4 = f(t + h, vadd(y, k3, h));

    // WASM-accelerated RK4 combination step
    let yNew: number[];
    const wasmMod = n >= 4 ? wasmLoader.getModule() : null;
    if (wasmMod) {
      try {
        const yArr = new Float64Array(y);
        const kPacked = new Float64Array(4 * n);
        for (let i = 0; i < n; i++) {
          kPacked[i] = k1[i];
          kPacked[n + i] = k2[i];
          kPacked[2 * n + i] = k3[i];
          kPacked[3 * n + i] = k4[i];
        }
        const yAlloc = wasmLoader.allocateFloat64Array(yArr);
        const kAlloc = wasmLoader.allocateFloat64Array(kPacked);
        const rAlloc = wasmLoader.allocateFloat64Array(new Float64Array(n));
        try {
          wasmMod.ode_system_rk4_step_wasm(yAlloc.ptr, kAlloc.ptr, h, n, rAlloc.ptr);
          yNew = Array.from(rAlloc.array);
        } finally {
          wasmLoader.free(yAlloc.ptr);
          wasmLoader.free(kAlloc.ptr);
          wasmLoader.free(rAlloc.ptr);
        }
      } catch {
        yNew = new Array(n);
        for (let i = 0; i < n; i++) {
          yNew[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
        }
      }
    } else {
      yNew = new Array(n);
      for (let i = 0; i < n; i++) {
        yNew[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      }
    }

    t += h;
    y = yNew;
    ts.push(t);
    ys.push(y.slice());
  }

  return { t: ts, y: ys };
}

/**
 * Solve stiff ODE systems.
 *
 * Delegates to the shared L-stable Rosenbrock (ode23s) engine (`rosenbrockSolve`,
 * `functions/src/numeric/solveODE.ts` — the same engine `solveODE(..., {method:'Rosenbrock'})`
 * uses). The previous implementation was fixed-step implicit Euler solved by fixed-point
 * iteration, which cannot converge when `h·|∂f/∂y|` is large — exactly the stiff regime this
 * function targets (71% error on `y'=-15y`; `null`/NaN on the stiff mode of `diag(-1,-1000)`).
 *
 * @param f - System function
 * @param y0 - Initial state
 * @param tspan - Time span
 * @returns Solution
 */
export function stiffODESolver(
  f: (t: f64, y: number[]) => number[],
  y0: number[],
  tspan: [f64, f64]
): ODESolution {
  // rosenbrockSolve's ForcingFunction is typed over the general MathNumericType/MathArray
  // surface (it's shared with the mathjs-style solveODE factory); internally it always calls
  // f with a plain (number, number[]) pair, so these casts just narrow back to that guarantee.
  //
  // stiffODESolver's signature takes no options, so a tolerance is baked in here rather than
  // left at rosenbrockSolve's generic default (rtol=1e-4). That default trades accuracy for
  // speed via atol = rtol*1e-3, which floors the absolute error near the scale of a stiff
  // mode's already-tiny value (e.g. ~13% relative error decaying y'=-15y to ~3e-7) — too loose
  // for a solver whose whole purpose is resolving stiff decay accurately. tol: 1e-7 keeps that
  // error under 1e-9 while remaining well within maxIter (1e5).
  return rosenbrockSolve((t, y) => f(t as number, y as number[]), tspan, y0, { tol: 1e-7 });
}

/**
 * Solve boundary value problem using the shooting method.
 *
 * @param f - System function (t, y) => dy/dt
 * @param bc - Boundary condition function (y0, yf) => residuals
 * @param mesh - Initial mesh points
 * @returns Solution
 */
export function solveBVP(
  f: (t: f64, y: number[]) => number[],
  bc: (y0: number[], yf: number[]) => number[],
  mesh: number[]
): ODESolution {
  const n = 2; // Simple 2-point BVP
  const tspan: [f64, f64] = [mesh[0], mesh[mesh.length - 1]];

  // Shooting method: adjust initial conditions to satisfy BC
  function shoot(guess: number[]): number[] {
    const sol = solveODESystem(f, guess, tspan, { dt: (tspan[1] - tspan[0]) / 50 });
    const yf = sol.y[sol.y.length - 1];
    return bc(guess, yf);
  }

  // Use simple Newton iteration
  const s = new Array(n).fill(0);
  const delta = 1e-7;

  for (let iter = 0; iter < 50; iter++) {
    const r = shoot(s);
    let maxR = 0;
    for (const ri of r) maxR = Math.max(maxR, Math.abs(ri));
    if (maxR < 1e-8) break;

    // Numerical Jacobian
    const J: number[][] = [];
    for (let i = 0; i < n; i++) {
      J[i] = [];
      for (let j = 0; j < n; j++) {
        const sp = s.slice();
        sp[j] += delta;
        const rp = shoot(sp);
        J[i][j] = (rp[i] - r[i]) / delta;
      }
    }

    try {
      const ds = linsolve(
        J,
        r.map((v) => -v)
      );
      for (let i = 0; i < n; i++) s[i] += ds[i];
    } catch {
      break;
    }
  }

  return solveODESystem(f, s, tspan, { dt: (tspan[1] - tspan[0]) / 50 });
}

/**
 * Single adaptive RK step returning (y_new, error_estimate).
 *
 * @param f - System function
 * @param y0 - Current state
 * @param t0 - Current time
 * @param h - Step size
 * @param tol - Error tolerance
 * @returns { y: number[], t: number, h: number } with updated step size
 */
export function odeAdaptiveStep(
  f: (t: f64, y: number[]) => number[],
  y0: number[],
  t0: f64,
  h: f64,
  tol: f64 = 1e-6
): { y: number[]; t: f64; h: f64 } {
  const n = y0.length;

  function vadd(a: number[], b: number[], s: f64): number[] {
    return a.map((v, i) => v + s * b[i]);
  }

  // RK4 full step
  const k1 = f(t0, y0);
  const k2 = f(t0 + h / 2, vadd(y0, k1, h / 2));
  const k3 = f(t0 + h / 2, vadd(y0, k2, h / 2));
  const k4 = f(t0 + h, vadd(y0, k3, h));

  const y4: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    y4[i] = y0[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }

  // Two half-steps
  const hh = h / 2;
  const k2a = f(t0 + hh / 2, vadd(y0, k1, hh / 2));
  const k3a = f(t0 + hh / 2, vadd(y0, k2a, hh / 2));
  const k4a = f(t0 + hh, vadd(y0, k3a, hh));
  const yMid: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    yMid[i] = y0[i] + (hh / 6) * (k1[i] + 2 * k2a[i] + 2 * k3a[i] + k4a[i]);
  }

  const k1b = f(t0 + hh, yMid);
  const k2b = f(t0 + hh + hh / 2, vadd(yMid, k1b, hh / 2));
  const k3b = f(t0 + hh + hh / 2, vadd(yMid, k2b, hh / 2));
  const k4b = f(t0 + h, vadd(yMid, k3b, hh));
  const y8: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    y8[i] = yMid[i] + (hh / 6) * (k1b[i] + 2 * k2b[i] + 2 * k3b[i] + k4b[i]);
  }

  let err = 0;
  for (let i = 0; i < n; i++) err = Math.max(err, Math.abs(y8[i] - y4[i]));

  // Richardson extrapolation
  const yNew = y8.map((v, i) => v + (v - y4[i]) / 15);

  // Adjust step size
  const safety = 0.9;
  const hNew = err > 0 ? h * safety * Math.pow(tol / err, 0.2) : h * 2;

  return { y: yNew, t: t0 + h, h: Math.min(hNew, h * 5) };
}

/**
 * ODE integration with event detection.
 * Stops when event(t, y) crosses zero.
 *
 * @param f - System function
 * @param y0 - Initial state
 * @param tspan - Time span
 * @param event - Event function; integration stops when this crosses zero
 * @returns Solution up to event
 */
export function eventDetection(
  f: (t: f64, y: number[]) => number[],
  y0: number[],
  tspan: [f64, f64],
  event: (t: f64, y: number[]) => f64
): ODESolution & { eventTime?: f64 } {
  const nSteps = 1000;
  const h = (tspan[1] - tspan[0]) / nSteps;
  const n = y0.length;

  const ts: number[] = [tspan[0]];
  const ys: number[][] = [y0.slice()];
  let y = y0.slice();
  let t = tspan[0];
  let prevE = event(t, y);

  for (let step = 0; step < nSteps; step++) {
    const k1 = f(t, y);
    const k2 = f(
      t + h / 2,
      y.map((v, i) => v + (h / 2) * k1[i])
    );
    const k3 = f(
      t + h / 2,
      y.map((v, i) => v + (h / 2) * k2[i])
    );
    const k4 = f(
      t + h,
      y.map((v, i) => v + h * k3[i])
    );

    const yNew: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      yNew[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }

    const tNew = t + h;
    const curE = event(tNew, yNew);

    if (prevE * curE < 0) {
      // Event detected between t and tNew; bisect
      let tLo = t,
        tHi = tNew;
      let yLo = y,
        yHi = yNew;
      for (let bi = 0; bi < 50; bi++) {
        const tMid = (tLo + tHi) / 2;
        const hMid = tMid - tLo;
        const km1 = f(tLo, yLo);
        const km2 = f(
          tLo + hMid / 2,
          yLo.map((v, i) => v + (hMid / 2) * km1[i])
        );
        const yMid = yLo.map((v, i) => v + hMid * km2[i]);
        const eMid = event(tMid, yMid);
        if (Math.abs(eMid) < 1e-12 || tHi - tLo < 1e-14) {
          ts.push(tMid);
          ys.push(yMid);
          return { t: ts, y: ys, eventTime: tMid };
        }
        if (prevE * eMid < 0) {
          tHi = tMid;
          yHi = yMid;
        } else {
          tLo = tMid;
          yLo = yMid;
          prevE = eMid;
        }
      }
      ts.push(tHi);
      ys.push(yHi);
      return { t: ts, y: ys, eventTime: tHi };
    }

    t = tNew;
    y = yNew;
    ts.push(t);
    ys.push(y.slice());
    prevE = curE;
  }

  return { t: ts, y: ys };
}

// =============================================================================
// Other Numerical Methods
// =============================================================================

/**
 * Condition number of a matrix (ratio of largest to smallest singular value).
 * Uses a simple power iteration estimate.
 *
 * @param A - Square matrix
 * @returns Approximate condition number
 */
export function cond(A: number[][]): f64 {
  const n = A.length;
  if (n === 0) return 0;

  // WASM-accelerated path (SVD-based condition number)
  if (n >= NUMERIC_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const flat = new Float64Array(n * n);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) flat[i * n + j] = A[i][j];
        const aAlloc = wasmLoader.allocateFloat64Array(flat);
        try {
          const result = wasm.condition_number_wasm(aAlloc.ptr, n);
          return result as f64;
        } finally {
          wasmLoader.free(aAlloc.ptr);
        }
      } catch {
        /* fall through to JS */
      }
    }
  }

  // A^T A
  const AtA: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += A[k][i] * A[k][j];
      AtA[i][j] = s;
    }
  }

  // Power iteration for largest eigenvalue
  let v = new Array(n).fill(1);
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  v = v.map((x) => x / norm);

  let lambdaMax = 0;
  for (let iter = 0; iter < 100; iter++) {
    const w = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) w[i] += AtA[i][j] * v[j];
    }
    norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
    lambdaMax = norm;
    v = w.map((x) => x / (norm || 1));
  }

  // Inverse power iteration for smallest eigenvalue (use shifted inverse)
  let u = new Array(n).fill(1);
  norm = Math.sqrt(u.reduce((s, x) => s + x * x, 0));
  u = u.map((x) => x / norm);

  let lambdaMin = lambdaMax;
  for (let iter = 0; iter < 100; iter++) {
    try {
      const w = linsolve(AtA, u);
      norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
      lambdaMin = 1 / norm;
      u = w.map((x) => x / (norm || 1));
    } catch {
      return Infinity;
    }
  }

  return Math.sqrt(lambdaMax / (lambdaMin || 1e-30));
}

/**
 * Numerical rank of a matrix using SVD-like approach.
 *
 * @param A - Matrix (m x n)
 * @param tol - Tolerance for zero singular values (default 1e-10)
 * @returns Numerical rank
 */
export function rank(A: number[][], tol: f64 = 1e-10): i32 {
  const m = A.length;
  if (m === 0) return 0;
  const n = A[0].length;

  // WASM-accelerated path (SVD-based rank)
  if (m >= NUMERIC_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const flat = new Float64Array(m * n);
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) flat[i * n + j] = A[i][j];
        const aAlloc = wasmLoader.allocateFloat64Array(flat);
        try {
          const result = wasm.matrix_rank_wasm(aAlloc.ptr, m, n, tol);
          return result as i32;
        } finally {
          wasmLoader.free(aAlloc.ptr);
        }
      } catch {
        /* fall through to JS */
      }
    }
  }

  // Use Gaussian elimination to count pivots
  const M = A.map((row) => row.slice());
  let r = 0;

  for (let col = 0; col < n && r < m; col++) {
    let maxRow = r;
    let maxVal = Math.abs(M[r][col]);
    for (let row = r + 1; row < m; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < tol) continue;
    if (maxRow !== r) [M[r], M[maxRow]] = [M[maxRow], M[r]];

    for (let row = r + 1; row < m; row++) {
      const factor = M[row][col] / M[r][col];
      for (let j = col; j < n; j++) M[row][j] -= factor * M[r][j];
    }
    r++;
  }

  return r;
}

/**
 * Null space basis of a matrix.
 *
 * @param A - Matrix (m x n)
 * @returns Array of basis vectors spanning the null space
 */
export function nullspace(A: number[][]): number[][] {
  const m = A.length;
  if (m === 0) return [];
  const n = A[0].length;

  // RREF
  const M = A.map((row) => row.slice());
  const pivotCols: i32[] = [];
  let r = 0;

  for (let col = 0; col < n && r < m; col++) {
    let maxRow = r;
    let maxVal = Math.abs(M[r][col]);
    for (let row = r + 1; row < m; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-10) continue;
    if (maxRow !== r) [M[r], M[maxRow]] = [M[maxRow], M[r]];

    const pivot = M[r][col];
    for (let j = 0; j < n; j++) M[r][j] /= pivot;

    for (let row = 0; row < m; row++) {
      if (row !== r && Math.abs(M[row][col]) > 1e-15) {
        const factor = M[row][col];
        for (let j = 0; j < n; j++) M[row][j] -= factor * M[r][j];
      }
    }

    pivotCols.push(col);
    r++;
  }

  // Free variables
  const freeCols = [];
  for (let j = 0; j < n; j++) {
    if (!pivotCols.includes(j)) freeCols.push(j);
  }

  const basis: number[][] = [];
  for (const fc of freeCols) {
    const v = new Array(n).fill(0);
    v[fc] = 1;
    for (let i = 0; i < pivotCols.length; i++) {
      v[pivotCols[i]] = -M[i][fc];
    }
    basis.push(v);
  }

  return basis;
}

/**
 * Partial fraction decomposition residues for P(x)/Q(x).
 * Assumes Q has distinct real roots. Returns residues at roots.
 *
 * @param p - Numerator polynomial coefficients [a0, a1, ..., an] for a0 + a1*x + ...
 * @param q - Denominator polynomial coefficients
 * @returns { residues: number[], poles: number[] }
 */
export function residue(p: number[], q: number[]): { residues: number[]; poles: number[] } {
  // Find roots of q using companion matrix eigenvalues (simple for small degree)
  // For simplicity, use Durand-Kerner for roots
  const poles = polyRoots(q);

  function evalPoly(coeffs: number[], x: f64): f64 {
    let s = 0;
    for (let i = coeffs.length - 1; i >= 0; i--) {
      s = s * x + coeffs[i];
    }
    return s;
  }

  function evalPolyDeriv(coeffs: number[], x: f64): f64 {
    let s = 0;
    for (let i = coeffs.length - 1; i >= 1; i--) {
      s = s * x + i * coeffs[i];
    }
    return s;
  }

  const residues = poles.map((pole) => evalPoly(p, pole) / evalPolyDeriv(q, pole));

  return { residues, poles };
}

/** Find real roots of a polynomial using Durand-Kerner method */
function polyRoots(coeffs: number[]): number[] {
  const n = coeffs.length - 1;
  if (n <= 0) return [];

  // Normalize
  const lc = coeffs[n];
  const c = coeffs.map((v) => v / lc);

  // Initial guesses on unit circle
  const roots: { re: f64; im: f64 }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n + 0.4;
    roots.push({ re: 0.4 * Math.cos(angle), im: 0.4 * Math.sin(angle) });
  }

  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < n; i++) {
      // Evaluate polynomial at roots[i]
      let pRe = c[n],
        pIm = 0;
      for (let j = n - 1; j >= 0; j--) {
        const newRe = pRe * roots[i].re - pIm * roots[i].im + c[j];
        const newIm = pRe * roots[i].im + pIm * roots[i].re;
        pRe = newRe;
        pIm = newIm;
      }

      // Product of (roots[i] - roots[j])
      let dRe = 1,
        dIm = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const diffRe = roots[i].re - roots[j].re;
        const diffIm = roots[i].im - roots[j].im;
        const newDRe = dRe * diffRe - dIm * diffIm;
        const newDIm = dRe * diffIm + dIm * diffRe;
        dRe = newDRe;
        dIm = newDIm;
      }

      // roots[i] -= p(roots[i]) / prod
      const denom = dRe * dRe + dIm * dIm;
      if (denom > 1e-30) {
        roots[i].re -= (pRe * dRe + pIm * dIm) / denom;
        roots[i].im -= (pIm * dRe - pRe * dIm) / denom;
      }
    }
  }

  // Return only real roots
  return roots.filter((r) => Math.abs(r.im) < 1e-8).map((r) => r.re);
}

/**
 * Chebyshev polynomial approximation of a function on [a, b].
 *
 * @param f - Function to approximate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param n - Number of terms (default 10)
 * @returns Evaluation function
 */
export function chebyshevApprox(f: (x: f64) => f64, a: f64, b: f64, n: i32 = 10): (x: f64) => f64 {
  // Chebyshev nodes on [-1, 1]
  const nodes: number[] = [];
  const fVals: number[] = [];
  for (let k = 0; k < n; k++) {
    const tk = Math.cos((Math.PI * (k + 0.5)) / n);
    nodes.push(tk);
    fVals.push(f(((b - a) * tk + (a + b)) / 2));
  }

  // Chebyshev coefficients
  const coeffs: number[] = [];
  for (let j = 0; j < n; j++) {
    let c = 0;
    for (let k = 0; k < n; k++) {
      c += fVals[k] * Math.cos((Math.PI * j * (k + 0.5)) / n);
    }
    coeffs.push((2 / n) * c);
  }
  coeffs[0] /= 2;

  return (x: f64): f64 => {
    const t = (2 * x - a - b) / (b - a);
    // Clenshaw recurrence
    let b1 = 0,
      b2 = 0;
    for (let j = n - 1; j >= 1; j--) {
      const tmp = 2 * t * b1 - b2 + coeffs[j];
      b2 = b1;
      b1 = tmp;
    }
    return t * b1 - b2 + coeffs[0];
  };
}

/**
 * Pade approximant [m/n] from Taylor coefficients.
 *
 * @param coeffs - Taylor series coefficients [c0, c1, c2, ...]
 * @param m - Numerator degree
 * @param n - Denominator degree
 * @returns { num: number[], den: number[] } polynomial coefficients
 */
export function padeApproximant(
  coeffs: number[],
  m: i32,
  n: i32
): { num: number[]; den: number[] } {
  // Need at least m + n + 1 coefficients
  const c = [...coeffs];
  while (c.length < m + n + 1) c.push(0);

  // Solve for denominator coefficients b[1..n]
  // Sum_{j=1}^{n} b[j] * c[m+i-j] = -c[m+i] for i = 1..n
  if (n > 0) {
    const A: number[][] = [];
    const rhs: number[] = [];
    for (let i = 1; i <= n; i++) {
      const row: number[] = [];
      for (let j = 1; j <= n; j++) {
        const idx = m + i - j;
        row.push(idx >= 0 && idx < c.length ? c[idx] : 0);
      }
      A.push(row);
      rhs.push(-c[m + i]);
    }

    let b: number[];
    try {
      b = linsolve(A, rhs);
    } catch {
      b = new Array(n).fill(0);
    }

    const den = [1, ...b];

    // Compute numerator: a[i] = c[i] + Sum_{j=1}^{min(i,n)} b[j] * c[i-j]
    const num: number[] = [];
    for (let i = 0; i <= m; i++) {
      let s = c[i];
      for (let j = 1; j <= Math.min(i, n); j++) {
        s += b[j - 1] * (i - j >= 0 ? c[i - j] : 0);
      }
      num.push(s);
    }

    return { num, den };
  }

  return { num: c.slice(0, m + 1), den: [1] };
}

/**
 * Quadratic programming: minimize 0.5 * x^T H x + f^T x subject to A x <= b.
 * Uses projected gradient descent.
 *
 * @param H - Hessian matrix (n x n, positive definite)
 * @param f - Linear term (length n)
 * @param A - Inequality constraint matrix (m x n)
 * @param b - Inequality constraint bounds (length m)
 * @returns Solution vector x
 */
export function quadprog(H: number[][], f: number[], A: number[][], b: number[]): number[] {
  const n = f.length;
  const mConstraints = A.length;
  let x = new Array(n).fill(0);
  const lr = 0.01;

  for (let iter = 0; iter < 2000; iter++) {
    // Gradient: Hx + f
    const grad = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      grad[i] = f[i];
      for (let j = 0; j < n; j++) grad[i] += H[i][j] * x[j];
    }

    // Gradient step
    const xNew = x.map((xi, i) => xi - lr * grad[i]);

    // Project onto feasible region (simple clipping for each constraint)
    for (let c = 0; c < mConstraints; c++) {
      let ax = 0;
      for (let j = 0; j < n; j++) ax += A[c][j] * xNew[j];
      if (ax > b[c]) {
        // Project
        let aNorm = 0;
        for (let j = 0; j < n; j++) aNorm += A[c][j] * A[c][j];
        if (aNorm > 1e-15) {
          const scale = (ax - b[c]) / aNorm;
          for (let j = 0; j < n; j++) xNew[j] -= scale * A[c][j];
        }
      }
    }

    let maxDiff = 0;
    for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(xNew[i] - x[i]));
    x = xNew;
    if (maxDiff < 1e-10) break;
  }

  return x;
}

/**
 * Linear programming: minimize c^T x subject to Ax <= b, x >= 0.
 * Simple simplex method implementation.
 *
 * @param c - Objective coefficients (length n)
 * @param A - Constraint matrix (m x n)
 * @param b - Constraint bounds (length m, non-negative)
 * @returns Solution vector x, or null if infeasible
 */
export function linprog(c: number[], A: number[][], b: number[]): number[] | null {
  const m = A.length;
  const n = c.length;

  // Add slack variables: [A | I] x' = b
  const tableau: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = [...A[i]];
    for (let j = 0; j < m; j++) row.push(i === j ? 1 : 0);
    row.push(b[i]);
    tableau.push(row);
  }

  // Objective row: [-c | 0 | 0] for minimization
  // In simplex, z = c^T x, row is: -c_1, ..., -c_n, 0, ..., 0, 0
  // We look for the most negative entry to enter basis (maximization of z)
  // For minimization of c^T x, we negate: max -c^T x, so row is: c_1, ..., c_n, 0, ..., 0
  const objRow = [...c];
  for (let j = 0; j < m; j++) objRow.push(0);
  objRow.push(0);
  tableau.push(objRow);

  const totalVars = n + m;

  // Simplex iterations
  for (let iter = 0; iter < 1000; iter++) {
    // Find entering variable (most negative in objective row)
    let pivotCol = -1;
    let minVal = -1e-10;
    for (let j = 0; j < totalVars; j++) {
      if (tableau[m][j] < minVal) {
        minVal = tableau[m][j];
        pivotCol = j;
      }
    }
    if (pivotCol === -1) break; // optimal

    // Find leaving variable (minimum ratio test)
    let pivotRow = -1;
    let minRatio = Infinity;
    for (let i = 0; i < m; i++) {
      if (tableau[i][pivotCol] > 1e-10) {
        const ratio = tableau[i][totalVars] / tableau[i][pivotCol];
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }
    if (pivotRow === -1) return null; // unbounded

    // Pivot
    const pivotVal = tableau[pivotRow][pivotCol];
    for (let j = 0; j <= totalVars; j++) tableau[pivotRow][j] /= pivotVal;

    for (let i = 0; i <= m; i++) {
      if (i === pivotRow) continue;
      const factor = tableau[i][pivotCol];
      for (let j = 0; j <= totalVars; j++) {
        tableau[i][j] -= factor * tableau[pivotRow][j];
      }
    }
  }

  // Extract solution
  const x = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    let basicRow = -1;
    let isBasic = true;
    // Check all rows including objective
    for (let i = 0; i <= m; i++) {
      if (Math.abs(tableau[i][j] - 1) < 1e-10) {
        if (basicRow !== -1) {
          isBasic = false;
          break;
        }
        basicRow = i;
      } else if (Math.abs(tableau[i][j]) > 1e-10) {
        isBasic = false;
        break;
      }
    }
    if (isBasic && basicRow !== -1) {
      x[j] = tableau[basicRow][totalVars];
    }
  }

  return x;
}

/**
 * Simple 1D PDE solver using finite differences (heat equation).
 *
 * Solves u_t = alpha * u_xx on domain [0, L] with boundary conditions.
 *
 * @param pde - { alpha: diffusion coefficient }
 * @param domain - { L: domain length, nx: spatial points, nt: time steps, T: final time }
 * @param bc - { left: left BC value, right: right BC value, initial: initial condition function }
 * @returns { x: number[], u: number[] } solution at final time
 */
export function solvePDE(
  pde: { alpha: f64 },
  domain: { L: f64; nx: i32; nt: i32; T: f64 },
  bc: { left: f64; right: f64; initial: (x: f64) => f64 }
): { x: number[]; u: number[] } {
  const { alpha } = pde;
  const { L, nx, nt, T } = domain;
  const dx = L / (nx - 1);
  const dt = T / nt;
  const r = (alpha * dt) / (dx * dx);

  if (r > 0.5) {
    // CFL condition warning - still compute but may be unstable
  }

  const x: number[] = [];
  let u: number[] = [];

  for (let i = 0; i < nx; i++) {
    x[i] = i * dx;
    u[i] = bc.initial(x[i]);
  }

  // Explicit forward Euler
  for (let step = 0; step < nt; step++) {
    const uNew = u.slice();
    uNew[0] = bc.left;
    uNew[nx - 1] = bc.right;
    for (let i = 1; i < nx - 1; i++) {
      uNew[i] = u[i] + r * (u[i + 1] - 2 * u[i] + u[i - 1]);
    }
    u = uNew;
  }

  return { x, u };
}
