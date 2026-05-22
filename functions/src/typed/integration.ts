/**
 * Numerical Integration Functions
 *
 * Provides numerical integration (quadrature) methods:
 * - trapz: Trapezoidal rule
 * - simpson: Simpson's 1/3 rule
 * - gaussQuad: Gauss-Legendre quadrature
 * - romberg: Romberg integration (adaptive Richardson extrapolation)
 *
 * These use plain exports (not mathTyped) because they accept function arguments,
 * which typed-function does not handle well.
 *
 * @packageDocumentation
 */

// =============================================================================
// Gauss-Legendre nodes and weights (precomputed for n=2..5)
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
 * Numerical integration using the trapezoidal rule.
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

// =============================================================================
// simpson - Simpson's 1/3 Rule
// =============================================================================

/**
 * Numerical integration using Simpson's 1/3 rule.
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

// =============================================================================
// gaussQuad - Gauss-Legendre Quadrature
// =============================================================================

/**
 * Numerical integration using Gauss-Legendre quadrature.
 *
 * Maps the interval [a, b] to [-1, 1] and applies Gauss-Legendre nodes/weights.
 *
 * @param f - Function to integrate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param n - Number of quadrature points (2-5, default 5)
 * @returns Approximate integral
 *
 * @example
 * gaussQuad(x => x ** 2, 0, 1, 3) // => ~0.3333
 */
export function gaussQuad(f: (x: number) => number, a: number, b: number, n: number = 5): number {
  if (n < 2 || n > 5) {
    throw new Error('gaussQuad supports 2 to 5 quadrature points');
  }

  const nodes = GL_NODES[n];
  const weights = GL_WEIGHTS[n];

  // Transform from [-1, 1] to [a, b]: x = (b-a)/2 * t + (a+b)/2
  const halfWidth = (b - a) / 2;
  const midpoint = (a + b) / 2;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = halfWidth * nodes[i] + midpoint;
    sum += weights[i] * f(x);
  }

  return halfWidth * sum;
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
 * @param f - Function to integrate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param tol - Desired absolute tolerance (default 1e-12)
 * @returns Approximate integral
 *
 * @example
 * romberg(Math.sin, 0, Math.PI) // => ~2.0
 */
export function romberg(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number = 1e-12
): number {
  const maxIter = 20;
  const R: number[][] = [];

  // R[0][0] = trapezoidal rule with 1 interval
  R[0] = [((b - a) * (f(a) + f(b))) / 2];

  for (let n = 1; n < maxIter; n++) {
    // Compute trapezoidal estimate with 2^n intervals
    const h = (b - a) / Math.pow(2, n);
    let sum = 0;
    for (let k = 1; k <= Math.pow(2, n - 1); k++) {
      sum += f(a + (2 * k - 1) * h);
    }
    R[n] = [R[n - 1][0] / 2 + h * sum];

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
