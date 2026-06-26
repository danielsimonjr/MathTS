/**
 * WASM dispatch bridge for polynomial hot-loop kernels.
 *
 * Four kernels are exposed:
 *   - `poly_mul_f64`         — O(n·m) coefficient convolution
 *   - `poly_div_mod_f64`     — polynomial long division (returns concat [quot|rem])
 *   - `poly_resultant_f64`   — Sylvester-matrix determinant (Slice 4.5)
 *   - `poly_discriminant_f64` — discriminant via Res(p, p') (Slice 4.5)
 *
 * Behavior:
 *   - When `wasmLoader.getModule()` returns null (module not loaded or
 *     load failed), every helper here returns the JS fallback result
 *     without throwing.
 *   - When the loaded module exposes the matching Rust export, we
 *     marshal the Float64Array operands into WASM-owned memory, run
 *     the kernel, and return a JS-side copy of the result.
 *   - When only the AS export is present (the AS binary is loaded),
 *     we pass the Float64Array references directly via the `_as`-named
 *     variant (see `WasmModule` interface entries).
 *   - Any thrown error is swallowed and the JS fallback runs — the
 *     WASM tier is an optimisation, not a correctness requirement.
 *
 * Threshold:
 *   The marshal cost (two memcpys in + one out) pays off when the
 *   O(n·m) inner loop is large enough. A polynomial length ≥ 256
 *   coefficients is the empirically-chosen break-even point; see
 *   `tools/benchmark/wasm/poly.bench.ts`.
 */

import { wasmLoader } from '../WasmLoader.js';
import {
  getWasm,
  isAsWasm,
  withAsF64,
  asReadReturnedF64,
  type RawWasm,
} from '../bridges/common.js';

/**
 * Coefficient-count threshold above which we attempt the WASM kernel.
 * For `poly_mul_f64`, we gate on either operand reaching this length;
 * for `poly_div_mod_f64`, we gate on `num.length`.
 */
export const WASM_POLY_THRESHOLD = 256;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Inline JS multiply — used as the below-threshold / no-WASM fallback. */
function polyMulJS(a: Float64Array, b: Float64Array): Float64Array {
  if (a.length === 0 || b.length === 0) return new Float64Array([0]);
  const out = new Float64Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] += a[i] * b[j];
    }
  }
  return out;
}

/**
 * Inline JS long division — used as the below-threshold / no-WASM fallback.
 * Returns `{ quotient, remainder }`.
 */
function polyDivModJS(
  num: Float64Array,
  den: Float64Array
): { quotient: Float64Array; remainder: Float64Array } {
  if (den.length === 0) throw new Error('Division by zero polynomial');
  if (num.length < den.length) {
    return {
      quotient: new Float64Array([0]),
      remainder: new Float64Array(num),
    };
  }
  const qLen = num.length - den.length + 1;
  const work = new Float64Array(num);
  const quotient = new Float64Array(qLen);
  const bn = den[den.length - 1];
  for (let ii = 0; ii < qLen; ii++) {
    const i = num.length - 1 - ii;
    quotient[i - den.length + 1] = work[i] / bn;
    for (let j = 0; j < den.length; j++) {
      work[i - den.length + 1 + j] -= quotient[i - den.length + 1] * den[j];
    }
  }
  const rLen = den.length > 1 ? den.length - 1 : 0;
  return {
    quotient,
    remainder: rLen > 0 ? work.slice(0, rLen) : new Float64Array([0]),
  };
}

// ---------------------------------------------------------------------------
// Public dispatch helpers
// ---------------------------------------------------------------------------

/**
 * Multiply two polynomials `a` and `b` via the AS WASM kernel when either
 * operand length exceeds the threshold, otherwise falls back to inline JS.
 *
 * Returns a `Float64Array` of length `a.length + b.length - 1`.
 */
export function polyMulDispatch(a: Float64Array, b: Float64Array): Float64Array {
  const bigEnough = a.length >= WASM_POLY_THRESHOLD || b.length >= WASM_POLY_THRESHOLD;
  if (bigEnough) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: poly_mul_f64(a, b) -> Float64Array.
        const out = withAsF64(wasm, [a, b], (mod, [ha, hb]) =>
          asReadReturnedF64(mod, (mod['poly_mul_f64'] as (x: number, y: number) => number)(ha, hb))
        );
        if (out) return out;
      } catch {
        // Fall through to JS
      }
    }
  }
  return polyMulJS(a, b);
}

/**
 * Divide polynomial `num` by `den` via WASM when `num.length` exceeds
 * the threshold, otherwise falls back to inline JS.
 *
 * Returns `{ quotient: Float64Array, remainder: Float64Array }`.
 */
export function polyDivModDispatch(
  num: Float64Array,
  den: Float64Array
): { quotient: Float64Array; remainder: Float64Array } {
  if (den.length === 0) throw new Error('Division by zero polynomial');

  const bigEnough = num.length >= WASM_POLY_THRESHOLD;
  if (bigEnough) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: poly_div_mod_f64(num, den) -> [quotient | remainder].
        const flat = withAsF64(wasm, [num, den], (mod, [hn, hd]) =>
          asReadReturnedF64(
            mod,
            (mod['poly_div_mod_f64'] as (x: number, y: number) => number)(hn, hd)
          )
        );
        if (flat) {
          const actualQLen = num.length >= den.length ? num.length - den.length + 1 : 0;
          const actualRLen = flat.length - actualQLen;
          return {
            quotient: actualQLen > 0 ? flat.slice(0, actualQLen) : new Float64Array([0]),
            remainder: actualRLen > 0 ? flat.slice(actualQLen) : new Float64Array([0]),
          };
        }
      } catch {
        // Fall through to JS
      }
    }
  }

  return polyDivModJS(num, den);
}

// ---------------------------------------------------------------------------
// Scalar-result dispatch (resultant / discriminant)
// ---------------------------------------------------------------------------

/** Inline JS resultant — Sylvester-matrix determinant fallback. */
function resultantJS(p: Float64Array, q: Float64Array): number {
  // Trim trailing zeros.
  let pm = p.length - 1;
  while (pm > 0 && p[pm] === 0) pm--;
  let qn = q.length - 1;
  while (qn > 0 && q[qn] === 0) qn--;
  const m = pm; // degree of p
  const n = qn; // degree of q
  if (m === 0 && n === 0) return 1;
  if (m === 0) return Math.pow(p[0], n);
  if (n === 0) return Math.pow(q[0], m);
  const size = m + n;
  const mat: number[] = new Array(size * size).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= m; j++) {
      mat[i * size + (i + j)] = p[m - j];
    }
  }
  for (let i = 0; i < m; i++) {
    for (let j = 0; j <= n; j++) {
      mat[(n + i) * size + (i + j)] = q[n - j];
    }
  }
  // Gaussian elimination determinant.
  const flat = mat.slice();
  let det = 1;
  for (let col = 0; col < size; col++) {
    let maxRow = col;
    let maxVal = Math.abs(flat[col * size + col]);
    for (let row = col + 1; row < size; row++) {
      const v = Math.abs(flat[row * size + col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    if (maxVal < 1e-15) return 0;
    if (maxRow !== col) {
      for (let k = 0; k < size; k++) {
        const tmp = flat[col * size + k];
        flat[col * size + k] = flat[maxRow * size + k];
        flat[maxRow * size + k] = tmp;
      }
      det = -det;
    }
    det *= flat[col * size + col];
    for (let row = col + 1; row < size; row++) {
      const factor = flat[row * size + col] / flat[col * size + col];
      for (let k = col; k < size; k++) {
        flat[row * size + k] -= factor * flat[col * size + k];
      }
    }
  }
  return det;
}

/** Inline JS discriminant fallback. */
function discriminantJS(p: Float64Array): number {
  // Trim trailing zeros.
  let end = p.length - 1;
  while (end > 0 && p[end] === 0) end--;
  const t = p.slice(0, end + 1);
  const deg = t.length - 1;
  if (deg < 1) return NaN;
  if (deg === 1) return 1;
  if (deg === 2) {
    const [c, b, a] = [t[0], t[1], t[2]];
    return b * b - 4 * a * c;
  }
  if (deg === 3) {
    const [d, c, b, a] = [t[0], t[1], t[2], t[3]];
    return (
      18 * a * b * c * d -
      4 * b * b * b * d +
      b * b * c * c -
      4 * a * c * c * c -
      27 * a * a * d * d
    );
  }
  // deg >= 4: disc(p) = (-1)^(deg*(deg-1)/2) / a_deg * Res(p, p')
  const fp = new Float64Array(deg);
  for (let i = 1; i <= deg; i++) fp[i - 1] = t[i] * i;
  const res = resultantJS(t, fp);
  const an = t[t.length - 1];
  const sign = ((deg * (deg - 1)) / 2) % 2 === 0 ? 1 : -1;
  return (sign * res) / an;
}

/**
 * Compute the resultant of `p` and `q` via WASM when either polynomial
 * length exceeds the threshold, otherwise falls back to inline JS.
 */
export function resultantDispatch(p: Float64Array, q: Float64Array): number {
  const bigEnough = p.length >= WASM_POLY_THRESHOLD || q.length >= WASM_POLY_THRESHOLD;
  if (bigEnough) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: poly_resultant_f64(p, q) -> f64.
        const r = withAsF64(wasm, [p, q], (mod, [hp, hq]) =>
          (mod['poly_resultant_f64'] as (x: number, y: number) => number)(hp, hq)
        );
        if (r !== null) return r;
      } catch {
        // Fall through to JS
      }
    }
  }
  return resultantJS(p, q);
}

/**
 * Compute the discriminant of `p` via WASM when the polynomial length
 * exceeds the threshold, otherwise falls back to inline JS.
 */
export function discriminantDispatch(p: Float64Array): number {
  const bigEnough = p.length >= WASM_POLY_THRESHOLD;
  if (bigEnough) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: poly_discriminant_f64(p) -> f64.
        const r = withAsF64(wasm, [p], (mod, [hp]) =>
          (mod['poly_discriminant_f64'] as (x: number) => number)(hp)
        );
        if (r !== null) return r;
      } catch {
        // Fall through to JS
      }
    }
  }
  return discriminantJS(p);
}

// ---------------------------------------------------------------------------
// Polynomial-fit dispatch (Slice 5.4)
// ---------------------------------------------------------------------------

/**
 * Sample-count threshold above which we attempt the WASM kernel for
 * poly_fit / cheb_fit / legendre_fit.  Below this, the marshal cost
 * (two memcpys in + one out) dominates; above it, the O(n·k²) QR
 * factorisation pays off.
 */
export const WASM_POLY_FIT_THRESHOLD = 1024;

/** Internal helper: build normal equations and solve via Cholesky/Gauss (JS fallback). */
function polyFitJS(
  xs: Float64Array,
  ys: Float64Array,
  degree: number,
  buildRow: (x: number, k: number) => Float64Array
): Float64Array | null {
  const n = xs.length;
  const k = degree + 1;
  if (n < k) return null;

  // Build Vandermonde-like matrix (n × k) in a flat buffer.
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = buildRow(xs[i], k);
    A.push(Array.from(row));
  }

  // Form normal equations: (A^T A) c = A^T y via Gaussian elimination.
  // Build augmented matrix [A^T A | A^T y].
  const ATA: number[][] = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let j = 0; j < k; j++) {
    for (let l = 0; l < k; l++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += A[i][j] * A[i][l];
      ATA[j][l] = s;
    }
    let s = 0;
    for (let i = 0; i < n; i++) s += A[i][j] * ys[i];
    ATA[j][k] = s;
  }

  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < k; col++) {
    let maxRow = col;
    let maxVal = Math.abs(ATA[col][col]);
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(ATA[row][col]) > maxVal) {
        maxVal = Math.abs(ATA[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-14) return null;
    if (maxRow !== col) [ATA[col], ATA[maxRow]] = [ATA[maxRow], ATA[col]];
    for (let row = col + 1; row < k; row++) {
      const factor = ATA[row][col] / ATA[col][col];
      for (let j = col; j <= k; j++) ATA[row][j] -= factor * ATA[col][j];
    }
  }

  const coeffs = new Float64Array(k);
  for (let i = k - 1; i >= 0; i--) {
    coeffs[i] = ATA[i][k];
    for (let j = i + 1; j < k; j++) coeffs[i] -= ATA[i][j] * coeffs[j];
    coeffs[i] /= ATA[i][i];
  }
  return coeffs;
}

/** Build a standard power basis row: [1, x, x^2, ...]. */
function powerBasisRow(x: number, k: number): Float64Array {
  const row = new Float64Array(k);
  let xpow = 1;
  for (let j = 0; j < k; j++) {
    row[j] = xpow;
    xpow *= x;
  }
  return row;
}

/** Build a Chebyshev-T basis row: [T_0(x), T_1(x), ...]. */
function chebBasisRow(x: number, k: number): Float64Array {
  const row = new Float64Array(k);
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

/** Build a Legendre-P basis row: [P_0(x), P_1(x), ...]. */
function legendreBasisRow(x: number, k: number): Float64Array {
  const row = new Float64Array(k);
  let pPrev = 1,
    pCurr = x;
  row[0] = pPrev;
  if (k > 1) row[1] = pCurr;
  for (let n = 1; n < k - 1; n++) {
    const pNext = ((2 * n + 1) * x * pCurr - n * pPrev) / (n + 1);
    row[n + 1] = pNext;
    pPrev = pCurr;
    pCurr = pNext;
  }
  return row;
}

/** JS fallback for polyFit. */
function polyFitJSFallback(xs: Float64Array, ys: Float64Array, degree: number): Float64Array {
  const result = polyFitJS(xs, ys, degree, powerBasisRow);
  if (!result) throw new Error('polyFit: rank-deficient or insufficient data');
  return result;
}

/** JS fallback for chebyshevFit. */
function chebFitJSFallback(xs: Float64Array, ys: Float64Array, degree: number): Float64Array {
  const result = polyFitJS(xs, ys, degree, chebBasisRow);
  if (!result) throw new Error('chebyshevFit: rank-deficient or insufficient data');
  return result;
}

/** JS fallback for legendreFit. */
function legendreFitJSFallback(xs: Float64Array, ys: Float64Array, degree: number): Float64Array {
  const result = polyFitJS(xs, ys, degree, legendreBasisRow);
  if (!result) throw new Error('legendreFit: rank-deficient or insufficient data');
  return result;
}

/**
 * Generic dispatch helper for fit kernels.
 *
 * Currently JS-only. The AS managed fit kernels (poly_fit_f64 / cheb_fit_f64 /
 * legendre_fit_f64) are measurably BROKEN — the AS QR/normal-equations solver
 * returns near-zero garbage where the JS path recovers the coefficients exactly
 * (verified Phase 3b; e.g. a degree-2 fit of 1−x+0.5x² over [−3,3] returns
 * ~[0.007,−0.007,0.004] instead of [1,−1,0.5]). The legacy Rust fit kernel was
 * dropped from the functions dispatch in the Phase 5 AS cutover. So all fits run
 * on the validated JS solver until assembly/src's fit solver is fixed
 * (Rust→AS migration Phase 6 follow-up). `WASM_POLY_FIT_THRESHOLD` is retained
 * for the benchmark/test harness and for re-enabling AS once it is correct.
 */
function fitDispatch(
  xs: Float64Array,
  ys: Float64Array,
  degree: number,
  jsFallback: (xs: Float64Array, ys: Float64Array, degree: number) => Float64Array
): Float64Array {
  if (xs.length !== ys.length) throw new Error('xs and ys must have the same length');
  return jsFallback(xs, ys, degree);
}

/**
 * Fit a polynomial via Vandermonde + normal equations (JS).
 *
 * Returns a `Float64Array` of length `degree + 1` with coefficients
 * `[a0, a1, ..., a_degree]` (constant-first / power-ascending order).
 *
 * Throws when the system is rank-deficient (e.g. all xs equal).
 */
export function polyFitDispatch(xs: Float64Array, ys: Float64Array, degree: number): Float64Array {
  return fitDispatch(xs, ys, degree, polyFitJSFallback);
}

/**
 * Fit a Chebyshev-series via Vandermonde + normal equations (JS).
 *
 * Returns a `Float64Array` of length `degree + 1` with Chebyshev coefficients.
 *
 * Throws when the system is rank-deficient.
 */
export function chebFitDispatch(xs: Float64Array, ys: Float64Array, degree: number): Float64Array {
  return fitDispatch(xs, ys, degree, chebFitJSFallback);
}

/**
 * Fit a Legendre-series via Vandermonde + normal equations (JS).
 *
 * Returns a `Float64Array` of length `degree + 1` with Legendre coefficients.
 *
 * Throws when the system is rank-deficient.
 */
export function legendreFitDispatch(
  xs: Float64Array,
  ys: Float64Array,
  degree: number
): Float64Array {
  return fitDispatch(xs, ys, degree, legendreFitJSFallback);
}

/**
 * Test-only hook — re-exported so tests can reset loader state
 * without importing WasmLoader directly.
 */
export function resetPolyWasm(): void {
  wasmLoader.reset();
}
