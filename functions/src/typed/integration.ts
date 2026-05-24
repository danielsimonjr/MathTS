/**
 * Numerical Integration Functions
 *
 * Provides numerical integration (quadrature) methods:
 * - trapz: Trapezoidal rule
 * - simpson: Simpson's 1/3 rule
 * - gaussQuad: Gauss-Legendre quadrature (composite form for n ≥ 64 sub-intervals)
 * - romberg: Romberg integration (adaptive Richardson extrapolation)
 *
 * Worker-dispatch strategy (Slice 3.8):
 * - gaussQuad / romberg: function evaluation stays on the main thread; the
 *   weighted dot-product reduction (values × weights) is offloaded via
 *   `computePool.dot` when sub-interval count ≥ GAUSS_WORKER_THRESHOLD.
 * - trapz / simpson accepting a Float64Array of pre-computed values: the
 *   summation is offloaded via `computePool.sum` when length ≥
 *   ARRAY_WORKER_THRESHOLD.
 *
 * These use plain exports (not mathTyped) because they accept function
 * arguments, which typed-function does not handle well.
 *
 * @packageDocumentation
 */

import { computePool } from '@danielsimonjr/mathts-parallel';

// =============================================================================
// Thresholds
// =============================================================================

/** Minimum sub-interval count before gaussQuad / romberg offload the reduction. */
export const GAUSS_WORKER_THRESHOLD = 64;

/** Minimum array length before trapzF64 / simpsonF64 offload the summation. */
export const ARRAY_WORKER_THRESHOLD = 65_536;

// =============================================================================
// Gauss-Legendre nodes and weights (precomputed for order=2..5)
// =============================================================================

const GL_NODES: Record<number, number[]> = {
  2: [-0.5773502691896257, 0.5773502691896257],
  3: [-0.7745966692414834, 0, 0.7745966692414834],
  4: [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526],
  5: [-0.906179845938664, -0.5384693101056831, 0, 0.5384693101056831, 0.906179845938664],
};

const GL_WEIGHTS: Record<number, number[]> = {
  2: [1, 1],
  3: [0.5555555555555556, 0.8888888888888888, 0.5555555555555556],
  4: [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538],
  5: [
    0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665,
    0.2369268850561891,
  ],
};

// =============================================================================
// trapz - Trapezoidal Rule
// =============================================================================

/**
 * Numerical integration using the trapezoidal rule over a number array.
 *
 * @param y - Array of function values
 * @param x - Optional array of x-coordinates (defaults to uniform spacing h=1)
 * @returns Approximate integral
 *
 * @example
 * trapz([1, 2, 3], [0, 1, 2]) // => 4
 * trapz([0, 1, 0])             // => 1 (uniform spacing)
 */
export function trapz(y: number[], x?: number[]): number {
  if (y.length < 2) {
    throw new Error('trapz requires at least 2 data points');
  }
  if (x && x.length !== y.length) {
    throw new Error('x and y arrays must have the same length');
  }

  let sum = 0;
  if (!x) {
    // Uniform spacing (h = 1)
    for (let i = 1; i < y.length; i++) {
      sum += (y[i - 1] + y[i]) / 2;
    }
  } else {
    // Non-uniform spacing
    for (let i = 1; i < y.length; i++) {
      sum += ((y[i - 1] + y[i]) * (x[i] - x[i - 1])) / 2;
    }
  }
  return sum;
}

/**
 * Numerical integration using the trapezoidal rule over a Float64Array.
 *
 * For arrays with length ≥ ARRAY_WORKER_THRESHOLD the trapezoidal terms are
 * computed element-wise on the main thread and the final summation is
 * offloaded to the compute pool via `computePool.sum`.
 *
 * @param y  - Float64Array of function values (uniform spacing h=1 unless dx provided)
 * @param dx - Optional uniform step size (default 1)
 * @returns Promise resolving to the approximate integral
 *
 * @example
 * await trapzF64(new Float64Array([0, 1, 0])) // => 1
 */
export async function trapzF64(y: Float64Array, dx = 1): Promise<number> {
  const n = y.length;
  if (n < 2) {
    throw new Error('trapzF64 requires at least 2 data points');
  }

  // Build array of trapezoidal terms: (y[i-1] + y[i]) * dx / 2
  const terms = new Float64Array(n - 1);
  const halfDx = dx / 2;
  for (let i = 1; i < n; i++) {
    terms[i - 1] = (y[i - 1] + y[i]) * halfDx;
  }

  if (terms.length >= ARRAY_WORKER_THRESHOLD && computePool.isReady()) {
    const result = await computePool.sum(terms);
    return result.result;
  }

  // Sequential fallback
  let sum = 0;
  for (let i = 0; i < terms.length; i++) {
    sum += terms[i];
  }
  return sum;
}

// =============================================================================
// simpson - Simpson's 1/3 Rule
// =============================================================================

/**
 * Numerical integration using Simpson's 1/3 rule (function form).
 *
 * @param f - Function to integrate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param n - Number of subintervals (must be even, default 100)
 * @returns Approximate integral
 *
 * @example
 * simpson(x => x ** 2, 0, 1) // => ~0.3333
 */
export function simpson(f: (x: number) => number, a: number, b: number, n: number = 100): number {
  if (n % 2 !== 0) {
    n += 1; // Simpson's rule requires even number of subintervals
  }
  const h = (b - a) / n;
  let sum = f(a) + f(b);

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    sum += i % 2 === 0 ? 2 * f(x) : 4 * f(x);
  }

  return (h / 3) * sum;
}

/**
 * Numerical integration using Simpson's 1/3 rule over a pre-computed
 * Float64Array of uniformly-spaced function values.
 *
 * For arrays with length ≥ ARRAY_WORKER_THRESHOLD the weighted terms are
 * computed on the main thread and the summation is offloaded to the pool.
 *
 * @param y  - Float64Array of function values at uniform spacing
 * @param dx - Uniform step size (default 1)
 * @returns Promise resolving to the approximate integral
 */
export async function simpsonF64(y: Float64Array, dx = 1): Promise<number> {
  const n = y.length - 1; // number of sub-intervals
  if (y.length < 3 || n % 2 !== 0) {
    throw new Error('simpsonF64 requires an odd number of points (even sub-intervals)');
  }

  // Build weighted terms array: each interior point contributes 2x or 4x
  const terms = new Float64Array(y.length);
  terms[0] = y[0];
  terms[y.length - 1] = y[y.length - 1];
  for (let i = 1; i < y.length - 1; i++) {
    terms[i] = (i % 2 === 0 ? 2 : 4) * y[i];
  }

  if (terms.length >= ARRAY_WORKER_THRESHOLD && computePool.isReady()) {
    const result = await computePool.sum(terms);
    return (result.result * dx) / 3;
  }

  let sum = 0;
  for (let i = 0; i < terms.length; i++) {
    sum += terms[i];
  }
  return (sum * dx) / 3;
}

// =============================================================================
// gaussQuad - Gauss-Legendre Quadrature
// =============================================================================

/**
 * Single-interval Gauss-Legendre quadrature (sequential, 2–5 points).
 *
 * @internal
 */
function gaussQuadSerial(f: (x: number) => number, a: number, b: number, order: number): number {
  const nodes = GL_NODES[order];
  const weights = GL_WEIGHTS[order];
  const halfWidth = (b - a) / 2;
  const midpoint = (a + b) / 2;
  let sum = 0;
  for (let i = 0; i < order; i++) {
    sum += weights[i] * f(halfWidth * nodes[i] + midpoint);
  }
  return halfWidth * sum;
}

/**
 * Numerical integration using Gauss-Legendre quadrature.
 *
 * When `n` is in [2, 5] the legacy single-interval mode is used (backward
 * compatible): `n` is the number of GL quadrature points applied to [a, b].
 *
 * When `n` ≥ 64 the domain is split into `n` equal sub-intervals, each
 * integrated with a fixed-order GL rule (default order 5).  Function
 * evaluation stays on the main thread; the weighted dot-product reduction is
 * offloaded to the compute pool when the pool is ready.
 *
 * @param f     - Function to integrate
 * @param a     - Lower bound
 * @param b     - Upper bound
 * @param n     - Number of quadrature points (2–5) OR number of sub-intervals (≥ 6)
 * @param order - GL order to use per sub-interval when n ≥ 6 (default 5)
 * @returns Approximate integral (or Promise when n ≥ GAUSS_WORKER_THRESHOLD and pool is ready)
 *
 * @example
 * gaussQuad(x => x ** 2, 0, 1, 3)        // => ~0.3333  (3-point GL, single interval)
 * await gaussQuad(Math.sin, 0, Math.PI, 64) // => ~2.0    (composite, 64 sub-intervals)
 */
export function gaussQuad(
  f: (x: number) => number,
  a: number,
  b: number,
  n: number = 5,
  order: number = 5
): number | Promise<number> {
  // Legacy single-interval mode (backward compatible)
  if (n >= 2 && n <= 5) {
    if (n < 2 || n > 5) {
      throw new Error('gaussQuad supports 2 to 5 quadrature points in single-interval mode');
    }
    return gaussQuadSerial(f, a, b, n);
  }

  if (n < 2) {
    throw new Error('gaussQuad requires n ≥ 2');
  }

  // Composite Gauss-Legendre: split [a, b] into n sub-intervals
  const clampedOrder = order >= 2 && order <= 5 ? order : 5;
  const nodes = GL_NODES[clampedOrder];
  const weights = GL_WEIGHTS[clampedOrder];
  const subWidth = (b - a) / n;
  const halfSub = subWidth / 2;
  const totalPoints = n * clampedOrder;

  // Evaluate f at all quadrature points on the main thread.
  // Layout: values[i * order + j] = f(node j of sub-interval i)
  const values = new Float64Array(totalPoints);
  const wts = new Float64Array(totalPoints);
  for (let i = 0; i < n; i++) {
    const subA = a + i * subWidth;
    const midSub = subA + halfSub;
    for (let j = 0; j < clampedOrder; j++) {
      const x = halfSub * nodes[j] + midSub;
      values[i * clampedOrder + j] = f(x);
      wts[i * clampedOrder + j] = weights[j] * halfSub;
    }
  }

  // Offload the dot product (values · weights) to the pool above threshold
  if (totalPoints >= GAUSS_WORKER_THRESHOLD && computePool.isReady()) {
    return computePool.dot(values, wts).then((r) => r.result);
  }

  // Sequential dot product
  let sum = 0;
  for (let k = 0; k < totalPoints; k++) {
    sum += values[k] * wts[k];
  }
  return sum;
}

// =============================================================================
// romberg - Romberg Integration
// =============================================================================

/**
 * Romberg integration using Richardson extrapolation on the trapezoidal rule.
 *
 * Adaptively refines the estimate until the desired tolerance is reached
 * or the maximum number of iterations (20) is exceeded.
 *
 * When the intermediate trapezoidal sum at level `n` involves ≥
 * GAUSS_WORKER_THRESHOLD new function evaluations the partial sum is
 * offloaded to the compute pool.  Because each level n evaluates 2^(n-1)
 * *new* points, the pool is engaged once n ≥ log2(GAUSS_WORKER_THRESHOLD),
 * i.e. from level 7 onward (128 new points per level).
 *
 * @param f   - Function to integrate
 * @param a   - Lower bound
 * @param b   - Upper bound
 * @param tol - Desired absolute tolerance (default 1e-12)
 * @returns Promise resolving to the approximate integral
 *
 * @example
 * await romberg(Math.sin, 0, Math.PI) // => ~2.0
 */
export async function romberg(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number = 1e-12
): Promise<number> {
  const maxIter = 20;
  const R: number[][] = [];

  // R[0][0] = trapezoidal rule with 1 interval
  R[0] = [((b - a) * (f(a) + f(b))) / 2];

  for (let n = 1; n < maxIter; n++) {
    // Compute trapezoidal estimate with 2^n intervals.
    // New evaluation points: a + (2k-1)*h  for k = 1 .. 2^(n-1)
    const h = (b - a) / Math.pow(2, n);
    const newPointCount = Math.pow(2, n - 1);

    let partialSum: number;

    if (newPointCount >= GAUSS_WORKER_THRESHOLD && computePool.isReady()) {
      // Evaluate f at the new points on the main thread, then sum via pool
      const newVals = new Float64Array(newPointCount);
      for (let k = 1; k <= newPointCount; k++) {
        newVals[k - 1] = f(a + (2 * k - 1) * h);
      }
      const dotResult = await computePool.sum(newVals);
      partialSum = dotResult.result;
    } else {
      partialSum = 0;
      for (let k = 1; k <= newPointCount; k++) {
        partialSum += f(a + (2 * k - 1) * h);
      }
    }

    R[n] = [R[n - 1][0] / 2 + h * partialSum];

    // Richardson extrapolation
    for (let m = 1; m <= n; m++) {
      const factor = Math.pow(4, m);
      R[n][m] = (factor * R[n][m - 1] - R[n - 1][m - 1]) / (factor - 1);
    }

    // Check convergence
    if (Math.abs(R[n][n] - R[n - 1][n - 1]) < tol) {
      return R[n][n];
    }
  }

  return R[maxIter - 1][maxIter - 1];
}
