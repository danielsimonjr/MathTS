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
 * The hot-loop tridiagonal solver used by `cubicSpline` is dispatched
 * through `functions/src/wasm/interpolation/wasm-bridge.ts` when the
 * knot count reaches the WASM_TRIDIAG_THRESHOLD (1024).
 *
 * @packageDocumentation
 */

import { tridiagSolveDispatch } from '../wasm/interpolation/wasm-bridge.js';
import {
  dividedDifferenceDispatch,
  dividedDifferenceJS,
  WASM_INTERP_THRESHOLD,
} from '../wasm/interpolation/wasm-bridge.js';
import {
  polyFitDispatch,
  chebFitDispatch,
  legendreFitDispatch,
  WASM_POLY_FIT_THRESHOLD,
} from '../wasm/poly/wasm-bridge.js';

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
  let i: number;
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
// Internal helper — Newton-form evaluation from divided-difference coefficients
// =============================================================================

/**
 * Evaluate the Newton-form interpolating polynomial at `x`.
 *
 * Uses Horner's method in the Newton basis:
 *   P(x) = c[0] + c[1]·(x-x[0]) + c[2]·(x-x[0])(x-x[1]) + …
 *
 * @param xs     - Interpolation nodes
 * @param coeffs - Divided-difference (Newton) coefficients
 * @param x      - Evaluation point
 * @returns P(x)
 */
function evalNewton(xs: Float64Array, coeffs: Float64Array, x: number): number {
  const n = coeffs.length;
  let result = coeffs[n - 1];
  for (let k = n - 2; k >= 0; k--) {
    result = result * (x - xs[k]) + coeffs[k];
  }
  return result;
}

// =============================================================================
// lagrangeInterp - Lagrange / Newton Polynomial Interpolation
// =============================================================================

/**
 * Lagrange polynomial interpolation.
 *
 * Computes the unique polynomial of degree n-1 passing through n data points,
 * evaluated at x.
 *
 * When `xs.length >= WASM_INTERP_THRESHOLD` (256), the O(n²)
 * divided-difference table is computed via the AssemblyScript WASM kernel
 * and the result is evaluated in Newton form.
 * Below the threshold the classical direct Lagrange formula is used.
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

  // Above threshold: use WASM-dispatched divided-difference → Newton eval.
  if (n >= WASM_INTERP_THRESHOLD) {
    const xsF = new Float64Array(xs);
    const ysF = new Float64Array(ys);
    try {
      const coeffs = dividedDifferenceDispatch(xsF, ysF);
      return evalNewton(xsF, coeffs, x);
    } catch {
      // fall through to direct Lagrange below
    }
  }

  // Below threshold (or fallback): direct Lagrange formula.
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
// newtonInterp - Newton Divided-Difference Polynomial Interpolation (Slice 5.5)
// =============================================================================

/**
 * Newton's divided-difference polynomial interpolation.
 *
 * Evaluates the unique interpolating polynomial of degree n-1 at `x` using
 * Newton's divided-difference representation.  Mathematically identical to
 * Lagrange interpolation but computed via a different (and more numerically
 * efficient) algorithm.
 *
 * When `xs.length >= WASM_INTERP_THRESHOLD` (256), the O(n²)
 * divided-difference table is dispatched to the WASM kernel; otherwise the
 * pure-JS path runs.
 *
 * @param xs - Distinct x-coordinates
 * @param ys - Corresponding y-values
 * @param x  - Point to evaluate at
 * @returns Interpolated value
 * @throws RangeError when any two xs are equal (degenerate / duplicate nodes)
 *
 * @example
 * newtonInterp([0, 1, 2], [0, 1, 4], 1.5) // => 2.25
 */
export function newtonInterp(xs: number[], ys: number[], x: number): number {
  if (xs.length !== ys.length || xs.length < 1) {
    throw new Error('newtonInterp requires at least 1 data point with matching lengths');
  }

  const xsF = new Float64Array(xs);
  const ysF = new Float64Array(ys);

  // WASM-dispatched divided-difference (falls back to JS below threshold).
  let coeffs: Float64Array;
  if (xs.length >= WASM_INTERP_THRESHOLD) {
    coeffs = dividedDifferenceDispatch(xsF, ysF);
  } else {
    coeffs = dividedDifferenceJS(xsF, ysF);
  }

  return evalNewton(xsF, coeffs, x);
}

/**
 * Re-export the WASM_INTERP_THRESHOLD constant for external consumers
 * that need to know the dispatch boundary.
 */
export { WASM_INTERP_THRESHOLD };

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

  // Build the tridiagonal system for the interior second-derivative unknowns
  // c[1..n-1].  Natural spline: c[0] = c[n] = 0 (boundary conditions).
  //
  // System size is (n-1) × (n-1) — the interior points only.
  const m = n - 1; // system size

  // RHS (alpha in the standard natural-spline derivation).
  const rhs = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const row = i + 1; // interior index 1..n-1
    rhs[i] = (3 / h[row]) * (ys[row + 1] - ys[row]) - (3 / h[row - 1]) * (ys[row] - ys[row - 1]);
  }

  // Main diagonal: 2*(h[i-1]+h[i]) for interior i = 1..n-1.
  const diagArr = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    diagArr[i] = 2 * (h[i] + h[i + 1]);
  }

  // Sub- and super-diagonals: h[i] for off-diagonal entries.
  const lowerArr = new Float64Array(Math.max(0, m - 1));
  const upperArr = new Float64Array(Math.max(0, m - 1));
  for (let i = 0; i < m - 1; i++) {
    lowerArr[i] = h[i + 1]; // sub-diagonal
    upperArr[i] = h[i + 1]; // super-diagonal (symmetric)
  }

  // Solve via WASM-gated dispatch (falls back to pure JS below threshold).
  const cInterior = tridiagSolveDispatch(diagArr, lowerArr, upperArr, rhs);

  // Reconstruct full c[] array including the boundary zeros.
  const c: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < m; i++) {
    c[i + 1] = cInterior[i];
  }

  const b: number[] = new Array(n);
  const d: number[] = new Array(n);

  for (let j = 0; j < n; j++) {
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
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
export function hermiteInterp(xs: number[], ys: number[], dys: number[], x: number): number {
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
      xs[n - 1],
      xs[n - 2],
      xs[n - 3],
      ys[n - 1],
      ys[n - 2],
      ys[n - 3],
      delta[n - 2],
      delta[n - 3]
    );
  }

  // Find interval and evaluate cubic Hermite basis
  let i: number;
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
  x0: number,
  x1: number,
  _x2: number,
  _y0: number,
  _y1: number,
  _y2: number,
  d0: number,
  d1: number
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
// polyFit - Least-Squares Polynomial Fitting (WASM-routed, Slice 5.4)
// =============================================================================

/**
 * Least-squares polynomial fit.
 *
 * Fits a polynomial of given degree to data points using Vandermonde + QR.
 * Returns coefficients [a0, a1, ..., a_degree] where p(x) = a0 + a1*x + ... + a_d*x^d.
 *
 * When xs.length >= WASM_POLY_FIT_THRESHOLD (1024), the hot-loop is dispatched
 * to the AssemblyScript WASM backend. Below the threshold, a normal-
 * equation / Gaussian-elimination path runs in pure JS.
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

  if (xs.length >= WASM_POLY_FIT_THRESHOLD) {
    try {
      const result = polyFitDispatch(new Float64Array(xs), new Float64Array(ys), degree);
      return Array.from(result);
    } catch {
      // fall through to JS path
    }
  }

  // --- JS path (normal equations + Gaussian elimination) ---
  const n = xs.length;
  const m = degree + 1;

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
    if (Math.abs(A[col][col]) < 1e-14) {
      throw new Error('polyFit: rank-deficient system (all xs equal or collinear)');
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

// =============================================================================
// chebyshevFit — Chebyshev-basis least-squares fit (Slice 5.4)
// =============================================================================

/**
 * Fit a Chebyshev-series of given degree to data points.
 *
 * Returns coefficients [c0, c1, ..., c_degree] in the Chebyshev-T basis so
 * that f(x) ≈ c0·T_0(x) + c1·T_1(x) + ... + c_d·T_d(x).
 *
 * When xs.length >= WASM_POLY_FIT_THRESHOLD, the QR solve is dispatched
 * to WASM.  Below the threshold, a normal-equation JS path is used.
 *
 * @param xs - x-coordinates (ideally in [-1, 1] for numerical stability)
 * @param ys - y-values
 * @param degree - Chebyshev degree
 * @returns Array of Chebyshev coefficients [c0, ..., c_degree]
 *
 * @example
 * // T_2(x) = 2x² - 1: coefficients should be approx [-1, 0, 2] (wait — basis order)
 * // T_0 = 1, T_1 = x, T_2 = 2x²-1 → recovery coefficients [0, 0, 1] for T_2 alone
 * chebyshevFit(xs, ys, 2) // ys = T_2(xs): => ~[0, 0, 1]
 */
export function chebyshevFit(xs: number[], ys: number[], degree: number): number[] {
  if (xs.length !== ys.length || xs.length < degree + 1) {
    throw new Error('chebyshevFit requires more data points than polynomial degree');
  }

  if (xs.length >= WASM_POLY_FIT_THRESHOLD) {
    try {
      const result = chebFitDispatch(new Float64Array(xs), new Float64Array(ys), degree);
      return Array.from(result);
    } catch {
      // fall through to JS path
    }
  }

  // --- JS path (normal equations using Chebyshev basis) ---
  const n = xs.length;
  const k = degree + 1;

  /** Build Chebyshev-T basis row. */
  function chebRow(x: number): number[] {
    const row: number[] = new Array(k);
    let tPrev = 1,
      tCurr = x;
    row[0] = tPrev;
    if (k > 1) row[1] = tCurr;
    for (let j = 2; j < k; j++) {
      const tNext = 2 * x * tCurr - tPrev;
      row[j] = tNext;
      tPrev = tCurr;
      tCurr = tNext;
    }
    return row;
  }

  const ATA: number[][] = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < n; i++) {
    const row = chebRow(xs[i]);
    for (let j = 0; j < k; j++) {
      for (let l = 0; l < k; l++) ATA[j][l] += row[j] * row[l];
      ATA[j][k] += row[j] * ys[i];
    }
  }

  for (let col = 0; col < k; col++) {
    let maxRow = col;
    let maxVal = Math.abs(ATA[col][col]);
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(ATA[row][col]) > maxVal) {
        maxVal = Math.abs(ATA[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [ATA[col], ATA[maxRow]] = [ATA[maxRow], ATA[col]];
    if (Math.abs(ATA[col][col]) < 1e-14) {
      throw new Error('chebyshevFit: rank-deficient system');
    }
    for (let row = col + 1; row < k; row++) {
      const factor = ATA[row][col] / ATA[col][col];
      for (let j = col; j <= k; j++) ATA[row][j] -= factor * ATA[col][j];
    }
  }

  const coeffs = new Array(k);
  for (let i = k - 1; i >= 0; i--) {
    coeffs[i] = ATA[i][k];
    for (let j = i + 1; j < k; j++) coeffs[i] -= ATA[i][j] * coeffs[j];
    coeffs[i] /= ATA[i][i];
  }
  return coeffs;
}

// =============================================================================
// legendreFit — Legendre-basis least-squares fit (Slice 5.4)
// =============================================================================

/**
 * Fit a Legendre-series of given degree to data points.
 *
 * Returns coefficients [c0, c1, ..., c_degree] in the Legendre-P basis so
 * that f(x) ≈ c0·P_0(x) + c1·P_1(x) + ... + c_d·P_d(x).
 *
 * When xs.length >= WASM_POLY_FIT_THRESHOLD, the QR solve is dispatched
 * to WASM.  Below the threshold, a normal-equation JS path is used.
 *
 * @param xs - x-coordinates (ideally in [-1, 1] for numerical stability)
 * @param ys - y-values
 * @param degree - Legendre degree
 * @returns Array of Legendre coefficients [c0, ..., c_degree]
 *
 * @example
 * // P_2(x) = (3x² - 1)/2: recovery coefficients [0, 0, 1] for P_2 alone
 * legendreFit(xs, ys, 2) // ys = P_2(xs): => ~[0, 0, 1]
 */
export function legendreFit(xs: number[], ys: number[], degree: number): number[] {
  if (xs.length !== ys.length || xs.length < degree + 1) {
    throw new Error('legendreFit requires more data points than polynomial degree');
  }

  if (xs.length >= WASM_POLY_FIT_THRESHOLD) {
    try {
      const result = legendreFitDispatch(new Float64Array(xs), new Float64Array(ys), degree);
      return Array.from(result);
    } catch {
      // fall through to JS path
    }
  }

  // --- JS path (normal equations using Legendre basis) ---
  const n = xs.length;
  const k = degree + 1;

  /** Build Legendre-P basis row. */
  function legRow(x: number): number[] {
    const row: number[] = new Array(k);
    let pPrev = 1,
      pCurr = x;
    row[0] = pPrev;
    if (k > 1) row[1] = pCurr;
    for (let dn = 1; dn < k - 1; dn++) {
      const pNext = ((2 * dn + 1) * x * pCurr - dn * pPrev) / (dn + 1);
      row[dn + 1] = pNext;
      pPrev = pCurr;
      pCurr = pNext;
    }
    return row;
  }

  const ATA: number[][] = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < n; i++) {
    const row = legRow(xs[i]);
    for (let j = 0; j < k; j++) {
      for (let l = 0; l < k; l++) ATA[j][l] += row[j] * row[l];
      ATA[j][k] += row[j] * ys[i];
    }
  }

  for (let col = 0; col < k; col++) {
    let maxRow = col;
    let maxVal = Math.abs(ATA[col][col]);
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(ATA[row][col]) > maxVal) {
        maxVal = Math.abs(ATA[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [ATA[col], ATA[maxRow]] = [ATA[maxRow], ATA[col]];
    if (Math.abs(ATA[col][col]) < 1e-14) {
      throw new Error('legendreFit: rank-deficient system');
    }
    for (let row = col + 1; row < k; row++) {
      const factor = ATA[row][col] / ATA[col][col];
      for (let j = col; j <= k; j++) ATA[row][j] -= factor * ATA[col][j];
    }
  }

  const coeffs = new Array(k);
  for (let i = k - 1; i >= 0; i--) {
    coeffs[i] = ATA[i][k];
    for (let j = i + 1; j < k; j++) coeffs[i] -= ATA[i][j] * coeffs[j];
    coeffs[i] /= ATA[i][i];
  }
  return coeffs;
}
