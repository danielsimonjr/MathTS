/**
 * Interpolation Functions
 *
 * Provides polynomial and spline interpolation methods:
 * - linearInterp: Linear interpolation between data points
 * - lagrangeInterp: Lagrange polynomial interpolation
 * - cubicSpline: Natural cubic spline (returns evaluation function)
 * - hermiteInterp: Hermite interpolation with derivative data
 * - pchipInterp: Piecewise Cubic Hermite Interpolating Polynomial (shape-preserving)
 * - polyFit: Least-squares polynomial fitting
 *
 * These use plain exports since some return functions.
 *
 * @packageDocumentation
 */

// =============================================================================
// linearInterp - Linear Interpolation
// =============================================================================

/**
 * Linear interpolation between data points.
 *
 * Finds the interval containing x and linearly interpolates.
 * Extrapolates linearly outside the data range.
 *
 * @param xs - Sorted x-coordinates (ascending)
 * @param ys - Corresponding y-values
 * @param x - Point to interpolate at
 * @returns Interpolated value
 *
 * @example
 * linearInterp([0, 1], [0, 1], 0.5) // => 0.5
 * linearInterp([0, 1, 2], [0, 1, 4], 1.5) // => 2.5
 */
export function linearInterp(xs: number[], ys: number[], x: number): number {
  if (xs.length !== ys.length || xs.length < 2) {
    throw new Error('linearInterp requires at least 2 data points with matching lengths');
  }

  // Find interval
  let i = 0;
  if (x <= xs[0]) {
    i = 0;
  } else if (x >= xs[xs.length - 1]) {
    i = xs.length - 2;
  } else {
    for (i = 0; i < xs.length - 1; i++) {
      if (x >= xs[i] && x <= xs[i + 1]) break;
    }
  }

  const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
  return ys[i] + t * (ys[i + 1] - ys[i]);
}

// =============================================================================
// lagrangeInterp - Lagrange Polynomial Interpolation
// =============================================================================

/**
 * Lagrange polynomial interpolation.
 *
 * Computes the unique polynomial of degree n-1 passing through n data points,
 * evaluated at x.
 *
 * @param xs - Distinct x-coordinates
 * @param ys - Corresponding y-values
 * @param x - Point to evaluate at
 * @returns Interpolated value
 *
 * @example
 * lagrangeInterp([0, 1, 2], [0, 1, 4], 1.5) // => 2.25
 */
export function lagrangeInterp(xs: number[], ys: number[], x: number): number {
  if (xs.length !== ys.length || xs.length < 1) {
    throw new Error('lagrangeInterp requires at least 1 data point with matching lengths');
  }

  const n = xs.length;
  let result = 0;

  for (let i = 0; i < n; i++) {
    let basis = 1;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        basis *= (x - xs[j]) / (xs[i] - xs[j]);
      }
    }
    result += ys[i] * basis;
  }

  return result;
}

// =============================================================================
// cubicSpline - Natural Cubic Spline
// =============================================================================

/**
 * Natural cubic spline interpolation.
 *
 * Computes spline coefficients and returns a function that evaluates
 * the spline at any point. Uses natural boundary conditions (second
 * derivative = 0 at endpoints).
 *
 * @param xs - Sorted x-coordinates (ascending, at least 3 points)
 * @param ys - Corresponding y-values
 * @returns Evaluation function
 *
 * @example
 * const spline = cubicSpline([0, 1, 2, 3], [0, 1, 4, 9]);
 * spline(1.5) // => ~2.25
 */
export function cubicSpline(xs: number[], ys: number[]): (x: number) => number {
  if (xs.length !== ys.length || xs.length < 3) {
    throw new Error('cubicSpline requires at least 3 data points with matching lengths');
  }

  const n = xs.length - 1; // number of intervals
  const h: number[] = [];
  for (let i = 0; i < n; i++) {
    h[i] = xs[i + 1] - xs[i];
  }

  // Solve tridiagonal system for second derivatives (c coefficients)
  // Natural spline: c[0] = c[n] = 0
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

  const c: number[] = new Array(n + 1).fill(0);
  const b: number[] = new Array(n);
  const d: number[] = new Array(n);

  l[n] = 1;
  z[n] = 0;

  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  // Store coefficients: S_j(x) = a_j + b_j(x-x_j) + c_j(x-x_j)^2 + d_j(x-x_j)^3
  const a = ys.slice(0, n);

  return (x: number): number => {
    // Clamp to data range
    let j: number;
    if (x <= xs[0]) {
      j = 0;
    } else if (x >= xs[n]) {
      j = n - 1;
    } else {
      // Binary search for interval
      let lo = 0;
      let hi = n - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (x < xs[mid]) {
          hi = mid - 1;
        } else if (x > xs[mid + 1]) {
          lo = mid + 1;
        } else {
          lo = mid;
          break;
        }
      }
      j = lo;
    }

    const dx = x - xs[j];
    return a[j] + b[j] * dx + c[j] * dx * dx + d[j] * dx * dx * dx;
  };
}

// =============================================================================
// hermiteInterp - Hermite Interpolation
// =============================================================================

/**
 * Hermite interpolation using function values and derivatives.
 *
 * Constructs the unique polynomial that matches both function values
 * and first derivatives at each data point.
 *
 * @param xs - Distinct x-coordinates
 * @param ys - Function values at xs
 * @param dys - Derivative values at xs
 * @param x - Point to evaluate at
 * @returns Interpolated value
 *
 * @example
 * hermiteInterp([0, 1], [0, 1], [1, 1], 0.5) // => 0.5 (linear)
 */
export function hermiteInterp(
  xs: number[],
  ys: number[],
  dys: number[],
  x: number,
): number {
  if (xs.length !== ys.length || xs.length !== dys.length || xs.length < 1) {
    throw new Error('hermiteInterp requires matching non-empty arrays');
  }

  const n = xs.length;
  let result = 0;

  for (let i = 0; i < n; i++) {
    // Compute L_i(x) and L_i'(x_i)
    let Li = 1;
    let dLi = 0;

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        Li *= (x - xs[j]) / (xs[i] - xs[j]);
      }
    }

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        dLi += 1 / (xs[i] - xs[j]);
      }
    }

    const Li2 = Li * Li;
    // H_i(x) = (1 - 2(x - x_i) L_i'(x_i)) L_i(x)^2
    const Hi = (1 - 2 * (x - xs[i]) * dLi) * Li2;
    // K_i(x) = (x - x_i) L_i(x)^2
    const Ki = (x - xs[i]) * Li2;

    result += ys[i] * Hi + dys[i] * Ki;
  }

  return result;
}

// =============================================================================
// pchipInterp - Piecewise Cubic Hermite Interpolating Polynomial
// =============================================================================

/**
 * Shape-preserving piecewise cubic Hermite interpolation (PCHIP).
 *
 * Unlike cubic splines, PCHIP preserves monotonicity and avoids overshoot.
 * Uses Fritsch-Carlson method to compute slopes.
 *
 * @param xs - Sorted x-coordinates (ascending, at least 2 points)
 * @param ys - Corresponding y-values
 * @param x - Point to interpolate at
 * @returns Interpolated value
 *
 * @example
 * pchipInterp([0, 1, 2, 3], [0, 1, 4, 9], 1.5)
 */
export function pchipInterp(xs: number[], ys: number[], x: number): number {
  if (xs.length !== ys.length || xs.length < 2) {
    throw new Error('pchipInterp requires at least 2 data points with matching lengths');
  }

  const n = xs.length;

  // Compute slopes of secant lines
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    delta[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  }

  // Compute tangent slopes using Fritsch-Carlson method
  const m: number[] = new Array(n);

  if (n === 2) {
    m[0] = delta[0];
    m[1] = delta[0];
  } else {
    // Interior points
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) {
        m[i] = 0;
      } else {
        const h1 = xs[i] - xs[i - 1];
        const h2 = xs[i + 1] - xs[i];
        const w1 = 2 * h2 + h1;
        const w2 = h2 + 2 * h1;
        m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
      }
    }

    // Endpoint slopes
    m[0] = pchipEndSlope(xs[0], xs[1], xs[2], ys[0], ys[1], ys[2], delta[0], delta[1]);
    m[n - 1] = pchipEndSlope(
      xs[n - 1], xs[n - 2], xs[n - 3],
      ys[n - 1], ys[n - 2], ys[n - 3],
      delta[n - 2], delta[n - 3],
    );
  }

  // Find interval and evaluate cubic Hermite basis
  let i = 0;
  if (x <= xs[0]) {
    i = 0;
  } else if (x >= xs[n - 1]) {
    i = n - 2;
  } else {
    for (i = 0; i < n - 1; i++) {
      if (x >= xs[i] && x <= xs[i + 1]) break;
    }
  }

  const h = xs[i + 1] - xs[i];
  const t = (x - xs[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
}

/** Helper: compute shape-preserving endpoint slope */
function pchipEndSlope(
  x0: number, x1: number, _x2: number,
  _y0: number, _y1: number, _y2: number,
  d0: number, d1: number,
): number {
  const h0 = x1 - x0;
  const h1 = _x2 - x1;
  let slope = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);

  if (Math.sign(slope) !== Math.sign(d0)) {
    slope = 0;
  } else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(slope) > 3 * Math.abs(d0)) {
    slope = 3 * d0;
  }

  return slope;
}

// =============================================================================
// polyFit - Least-Squares Polynomial Fitting
// =============================================================================

/**
 * Least-squares polynomial fit.
 *
 * Fits a polynomial of given degree to data points using the normal equations.
 * Returns coefficients [a0, a1, ..., a_degree] where p(x) = a0 + a1*x + ... + a_d*x^d.
 *
 * @param xs - x-coordinates
 * @param ys - y-values
 * @param degree - Polynomial degree (must be < number of data points)
 * @returns Array of coefficients [a0, a1, ..., a_degree]
 *
 * @example
 * polyFit([0, 1, 2, 3], [0, 1, 4, 9], 2) // => ~[0, 0, 1] (x^2)
 */
export function polyFit(xs: number[], ys: number[], degree: number): number[] {
  if (xs.length !== ys.length || xs.length < degree + 1) {
    throw new Error('polyFit requires more data points than polynomial degree');
  }

  const n = xs.length;
  const m = degree + 1;

  // Build normal equations: (V^T V) c = V^T y
  const VtV: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  const Vty: number[] = new Array(m).fill(0);

  for (let i = 0; i < n; i++) {
    const powers: number[] = new Array(2 * m);
    powers[0] = 1;
    for (let p = 1; p < 2 * m; p++) {
      powers[p] = powers[p - 1] * xs[i];
    }
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < m; k++) {
        VtV[j][k] += powers[j + k];
      }
      Vty[j] += powers[j] * ys[i];
    }
  }

  // Solve via Gaussian elimination with partial pivoting
  const A = VtV.map((row, i) => [...row, Vty[i]]);

  for (let col = 0; col < m; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
    }

    for (let row = col + 1; row < m; row++) {
      const factor = A[row][col] / A[col][col];
      for (let j = col; j <= m; j++) {
        A[row][j] -= factor * A[col][j];
      }
    }
  }

  const coeffs = new Array(m);
  for (let i = m - 1; i >= 0; i--) {
    coeffs[i] = A[i][m];
    for (let j = i + 1; j < m; j++) {
      coeffs[i] -= A[i][j] * coeffs[j];
    }
    coeffs[i] /= A[i][i];
  }

  return coeffs;
}
