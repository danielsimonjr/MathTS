/**
 * Polynomial hot-loop kernels — AssemblyScript parity port.
 *
 * These two exports mirror the Rust kernels in
 * `wasm-rust/crates/mathts-wasm/src/poly.rs`.
 *
 * Naming uses snake_case to match the Rust export surface so the
 * bridge can probe for either backend with the same name lookup.
 *
 * Polynomials are coefficient arrays, constant term first (index = power):
 *   p(x) = a[0] + a[1]*x + a[2]*x^2 + …
 */

// ---------------------------------------------------------------------------
// poly_mul_f64  — O(n·m) convolution
// ---------------------------------------------------------------------------

/**
 * Multiply polynomials `a` and `b`.
 * Returns a `Float64Array` of length `a.length + b.length - 1`,
 * or `[0.0]` if either operand is empty.
 */
export function poly_mul_f64(a: Float64Array, b: Float64Array): Float64Array {
  if (a.length == 0 || b.length == 0) {
    const z = new Float64Array(1);
    z[0] = 0.0;
    return z;
  }
  const outLen: i32 = a.length + b.length - 1;
  const out = new Float64Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = 0.0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    for (let j = 0; j < b.length; j++) {
      out[i + j] += ai * b[j];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internal helpers for resultant / discriminant
// ---------------------------------------------------------------------------

/** Trim trailing zero coefficients, keeping at least one element. */
function trimCoeffs(c: Float64Array): Float64Array {
  if (c.length == 0) {
    const z = new Float64Array(1);
    z[0] = 0.0;
    return z;
  }
  let end: i32 = c.length - 1;
  while (end > 0 && c[end] == 0.0) end--;
  const out = new Float64Array(end + 1);
  for (let i: i32 = 0; i <= end; i++) out[i] = c[i];
  return out;
}

/**
 * Gaussian-elimination determinant of a row-major `n × n` matrix
 * stored in a flat Float64Array.
 */
function detSquare(flat: Float64Array, n: i32): f64 {
  // Copy into a mutable work buffer.
  const m = new Float64Array(n * n);
  for (let i: i32 = 0; i < n * n; i++) m[i] = flat[i];

  let det: f64 = 1.0;
  for (let col: i32 = 0; col < n; col++) {
    // Partial pivoting.
    let maxRow: i32 = col;
    let maxVal: f64 = Math.abs(m[col * n + col]);
    for (let row: i32 = col + 1; row < n; row++) {
      const v: f64 = Math.abs(m[row * n + col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    if (maxVal < 1e-15) return 0.0;
    if (maxRow != col) {
      for (let k: i32 = 0; k < n; k++) {
        const tmp: f64 = m[col * n + k];
        m[col * n + k] = m[maxRow * n + k];
        m[maxRow * n + k] = tmp;
      }
      det = -det;
    }
    det *= m[col * n + col];
    for (let row: i32 = col + 1; row < n; row++) {
      const factor: f64 = m[row * n + col] / m[col * n + col];
      for (let k: i32 = col; k < n; k++) {
        m[row * n + k] -= factor * m[col * n + k];
      }
    }
  }
  return det;
}

/** Build the (m+n) × (m+n) Sylvester matrix and return its determinant. */
function sylvesterDet(p: Float64Array, q: Float64Array): f64 {
  const pt = trimCoeffs(p);
  const qt = trimCoeffs(q);
  const m: i32 = pt.length - 1; // degree of p
  const n: i32 = qt.length - 1; // degree of q
  if (m == 0 && n == 0) return 1.0;
  if (m == 0) return Math.pow(pt[0], <f64>n);
  if (n == 0) return Math.pow(qt[0], <f64>m);
  const size: i32 = m + n;
  const mat = new Float64Array(size * size);
  // First n rows: shifted copies of p (highest-degree first).
  for (let i: i32 = 0; i < n; i++) {
    for (let j: i32 = 0; j <= m; j++) {
      mat[i * size + (i + j)] = pt[m - j];
    }
  }
  // Next m rows: shifted copies of q (highest-degree first).
  for (let i: i32 = 0; i < m; i++) {
    for (let j: i32 = 0; j <= n; j++) {
      mat[(n + i) * size + (i + j)] = qt[n - j];
    }
  }
  return detSquare(mat, size);
}

// ---------------------------------------------------------------------------
// poly_div_mod_f64  — polynomial long division
// ---------------------------------------------------------------------------

/**
 * Divide polynomial `num` by `den`.
 *
 * Returns a concatenated `Float64Array`:
 *   `[ quotient (q_len elements) | remainder (r_len elements) ]`
 *
 * where:
 *   q_len  = max(0, num.length - den.length + 1)  when den.length <= num.length
 *   q_len  = 0                                    when den.length  > num.length
 *   r_len  = den.length - 1                        (un-trimmed; caller trims)
 *
 * Returns `[NaN]` when `den` is empty (division by zero).
 */
export function poly_div_mod_f64(num: Float64Array, den: Float64Array): Float64Array {
  if (den.length == 0) {
    const e = new Float64Array(1);
    e[0] = NaN;
    return e;
  }

  const numLen: i32 = num.length;
  const denLen: i32 = den.length;

  // degree(num) < degree(den): quotient = 0, remainder = num
  if (numLen < denLen) {
    const out = new Float64Array(numLen);
    for (let i = 0; i < numLen; i++) out[i] = num[i];
    return out;
  }

  const qLen: i32 = numLen - denLen + 1;
  const rMax: i32 = denLen - 1;

  // Work buffer (copy of num).
  const work = new Float64Array(numLen);
  for (let i = 0; i < numLen; i++) work[i] = num[i];

  const bn = den[denLen - 1];

  const quotient = new Float64Array(qLen);
  for (let i = 0; i < qLen; i++) quotient[i] = 0.0;

  // Long division, highest degree first.
  let ii: i32 = 0;
  while (ii < qLen) {
    const i: i32 = numLen - 1 - ii;
    const q = work[i] / bn;
    quotient[i - denLen + 1] = q;
    for (let j: i32 = 0; j < denLen; j++) {
      work[i - denLen + 1 + j] -= q * den[j];
    }
    ii++;
  }

  const rLen: i32 = rMax < numLen ? rMax : numLen;
  const totalLen: i32 = qLen + rLen;
  const out = new Float64Array(totalLen);
  for (let i: i32 = 0; i < qLen; i++) out[i] = quotient[i];
  for (let i: i32 = 0; i < rLen; i++) out[qLen + i] = work[i];
  return out;
}

// ---------------------------------------------------------------------------
// poly_resultant_f64  — Sylvester-matrix determinant
// ---------------------------------------------------------------------------

/**
 * Compute the resultant of polynomials `p` and `q`.
 * Returns NaN when either input is empty.
 */
export function poly_resultant_f64(p: Float64Array, q: Float64Array): f64 {
  if (p.length == 0 || q.length == 0) return NaN;
  return sylvesterDet(p, q);
}

// ---------------------------------------------------------------------------
// Internal Householder QR least-squares solver
// Used by poly_fit_f64 / cheb_fit_f64 / legendre_fit_f64.
// a: Float64Array of shape n×k row-major (modified in-place)
// b: Float64Array length n (right-hand side, modified in-place → solution)
// Returns true on success, false on rank-deficient input.
// ---------------------------------------------------------------------------

function householderQRSolve(a: Float64Array, n: i32, k: i32, b: Float64Array): bool {
  const tol: f64 = 1e-12;

  for (let col: i32 = 0; col < k; col++) {
    // Compute norm of column col from row col downward.
    let norm2: f64 = 0.0;
    for (let row: i32 = col; row < n; row++) {
      const v: f64 = a[row * k + col];
      norm2 += v * v;
    }
    const norm: f64 = Math.sqrt(norm2);
    if (norm < tol) return false;

    const sign: f64 = a[col * k + col] >= 0.0 ? 1.0 : -1.0;
    const u1: f64 = a[col * k + col] + sign * norm;
    let vtv: f64 = u1 * u1;
    for (let row: i32 = col + 1; row < n; row++) {
      vtv += a[row * k + col] * a[row * k + col];
    }
    const tau: f64 = 2.0 / vtv;

    // Apply H to columns col+1..k of A.
    //
    // The reflection must NOT be applied to column `col` through this generic
    // loop: doing so overwrites the Householder vector entries a[row*k+col]
    // (which live in the sub-diagonal of column `col`) before they are consumed
    // by the remaining columns and the RHS, corrupting every subsequent update.
    // Column `col` is handled explicitly below (R diagonal = -sign*norm, the
    // sub-diagonal is zeroed), so we start the loop at col+1.
    for (let c: i32 = col + 1; c < k; c++) {
      let dot: f64 = u1 * a[col * k + c];
      for (let row: i32 = col + 1; row < n; row++) {
        dot += a[row * k + col] * a[row * k + c];
      }
      dot *= tau;
      a[col * k + c] -= u1 * dot;
      for (let row: i32 = col + 1; row < n; row++) {
        a[row * k + c] -= a[row * k + col] * dot;
      }
    }

    // Apply H to b[col..n].
    {
      let dot: f64 = u1 * b[col];
      for (let row: i32 = col + 1; row < n; row++) {
        dot += a[row * k + col] * b[row];
      }
      dot *= tau;
      b[col] -= u1 * dot;
      for (let row: i32 = col + 1; row < n; row++) {
        b[row] -= a[row * k + col] * dot;
      }
    }

    // Update R diagonal and clear sub-diagonal.
    a[col * k + col] = -sign * norm;
    for (let row: i32 = col + 1; row < n; row++) {
      a[row * k + col] = 0.0;
    }
  }

  // Back-substitution.
  for (let i: i32 = k - 1; i >= 0; i--) {
    let s: f64 = b[i];
    for (let j: i32 = i + 1; j < k; j++) {
      s -= a[i * k + j] * b[j];
    }
    const r_ii: f64 = a[i * k + i];
    if (Math.abs(r_ii) < tol) return false;
    b[i] = s / r_ii;
  }
  return true;
}

// ---------------------------------------------------------------------------
// poly_fit_f64  — Vandermonde + QR least-squares polynomial fit
// ---------------------------------------------------------------------------

/**
 * Fit a polynomial of given degree to (xs, ys) using Vandermonde + QR.
 * Returns a Float64Array of length (degree+1) with coefficients [a0..a_d],
 * or a length-1 array containing NaN on rank-deficient input.
 */
export function poly_fit_f64(xs: Float64Array, ys: Float64Array, degree: i32): Float64Array {
  const n: i32 = xs.length;
  const k: i32 = degree + 1;
  const nanResult = new Float64Array(1);
  nanResult[0] = NaN;
  if (n < k || k <= 0 || n != ys.length) return nanResult;

  // Build Vandermonde matrix (n × k), row-major.
  const a = new Float64Array(n * k);
  for (let i: i32 = 0; i < n; i++) {
    const x: f64 = xs[i];
    let xpow: f64 = 1.0;
    for (let j: i32 = 0; j < k; j++) {
      a[i * k + j] = xpow;
      xpow *= x;
    }
  }

  // Copy ys into work buffer (modified in-place by QR solver).
  const b = new Float64Array(n);
  for (let i: i32 = 0; i < n; i++) b[i] = ys[i];

  if (!householderQRSolve(a, n, k, b)) return nanResult;

  const out = new Float64Array(k);
  for (let j: i32 = 0; j < k; j++) out[j] = b[j];
  return out;
}

// ---------------------------------------------------------------------------
// cheb_fit_f64  — Chebyshev-basis + QR least-squares fit
// ---------------------------------------------------------------------------

/**
 * Fit a Chebyshev-series of given degree to (xs, ys) using QR.
 * Returns a Float64Array of coefficients [c0..c_d] (Chebyshev basis),
 * or a length-1 NaN array on rank-deficient input.
 */
export function cheb_fit_f64(xs: Float64Array, ys: Float64Array, degree: i32): Float64Array {
  const n: i32 = xs.length;
  const k: i32 = degree + 1;
  const nanResult = new Float64Array(1);
  nanResult[0] = NaN;
  if (n < k || k <= 0 || n != ys.length) return nanResult;

  // Build Chebyshev Vandermonde (n × k), row-major.
  const a = new Float64Array(n * k);
  for (let i: i32 = 0; i < n; i++) {
    const x: f64 = xs[i];
    let tPrev: f64 = 1.0;
    let tCurr: f64 = x;
    a[i * k + 0] = tPrev;
    if (k > 1) a[i * k + 1] = tCurr;
    for (let j: i32 = 2; j < k; j++) {
      const tNext: f64 = 2.0 * x * tCurr - tPrev;
      a[i * k + j] = tNext;
      tPrev = tCurr;
      tCurr = tNext;
    }
  }

  const b = new Float64Array(n);
  for (let i: i32 = 0; i < n; i++) b[i] = ys[i];

  if (!householderQRSolve(a, n, k, b)) return nanResult;

  const out = new Float64Array(k);
  for (let j: i32 = 0; j < k; j++) out[j] = b[j];
  return out;
}

// ---------------------------------------------------------------------------
// legendre_fit_f64  — Legendre-basis + QR least-squares fit
// ---------------------------------------------------------------------------

/**
 * Fit a Legendre-series of given degree to (xs, ys) using QR.
 * Returns a Float64Array of coefficients [c0..c_d] (Legendre basis),
 * or a length-1 NaN array on rank-deficient input.
 */
export function legendre_fit_f64(xs: Float64Array, ys: Float64Array, degree: i32): Float64Array {
  const n: i32 = xs.length;
  const k: i32 = degree + 1;
  const nanResult = new Float64Array(1);
  nanResult[0] = NaN;
  if (n < k || k <= 0 || n != ys.length) return nanResult;

  // Build Legendre Vandermonde (n × k), row-major.
  const a = new Float64Array(n * k);
  for (let i: i32 = 0; i < n; i++) {
    const x: f64 = xs[i];
    let pPrev: f64 = 1.0;
    let pCurr: f64 = x;
    a[i * k + 0] = pPrev;
    if (k > 1) a[i * k + 1] = pCurr;
    for (let degN: i32 = 1; degN < k - 1; degN++) {
      // (degN+1) P_{degN+1} = (2*degN+1)*x*P_{degN} - degN*P_{degN-1}
      const pNext: f64 =
        (<f64>(2 * degN + 1) * x * pCurr - <f64>degN * pPrev) / <f64>(degN + 1);
      a[i * k + degN + 1] = pNext;
      pPrev = pCurr;
      pCurr = pNext;
    }
  }

  const b = new Float64Array(n);
  for (let i: i32 = 0; i < n; i++) b[i] = ys[i];

  if (!householderQRSolve(a, n, k, b)) return nanResult;

  const out = new Float64Array(k);
  for (let j: i32 = 0; j < k; j++) out[j] = b[j];
  return out;
}

// ---------------------------------------------------------------------------
// poly_discriminant_f64  — disc(p) = (-1)^(m(m-1)/2) / a_m · Res(p, p')
// ---------------------------------------------------------------------------

/**
 * Compute the discriminant of polynomial `p`.
 * Returns NaN for degree < 1 inputs.
 */
export function poly_discriminant_f64(p: Float64Array): f64 {
  if (p.length == 0) return NaN;
  const t = trimCoeffs(p);
  const deg: i32 = t.length - 1;
  if (deg < 1) return NaN;
  if (deg == 1) return 1.0;
  if (deg == 2) {
    const c = t[0];
    const b = t[1];
    const a = t[2];
    return b * b - 4.0 * a * c;
  }
  if (deg == 3) {
    const d = t[0];
    const c = t[1];
    const b = t[2];
    const a = t[3];
    return (
      18.0 * a * b * c * d -
      4.0 * b * b * b * d +
      b * b * c * c -
      4.0 * a * c * c * c -
      27.0 * a * a * d * d
    );
  }
  // deg >= 4: disc(p) = (-1)^(deg*(deg-1)/2) / a_deg * Res(p, p')
  const fp = new Float64Array(deg);
  for (let i: i32 = 1; i <= deg; i++) {
    fp[i - 1] = t[i] * <f64>i;
  }
  const res = sylvesterDet(t, fp);
  const an = t[t.length - 1];
  const exponent: i32 = (deg * (deg - 1)) / 2;
  const sign: f64 = exponent % 2 == 0 ? 1.0 : -1.0;
  return (sign * res) / an;
}
