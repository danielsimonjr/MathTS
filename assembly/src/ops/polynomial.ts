/**
 * Polynomial algebra — AssemblyScript fallback mirroring the original
 * Rust `algebra/polynomial_ext.rs` implementation.
 *
 * Polynomials are coefficient arrays, constant term first (`index = power`).
 * Functions take and return `Float64Array`; `discriminant` / `resultant`
 * return a scalar.
 */

function toArr(fa: Float64Array): Array<f64> {
  const out = new Array<f64>(fa.length);
  for (let i = 0; i < fa.length; i++) out[i] = fa[i];
  return out;
}

function toF64(a: Array<f64>): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i];
  return out;
}

function single(v: f64): Array<f64> {
  const a = new Array<f64>(1);
  a[0] = v;
  return a;
}

/** Trim trailing zero coefficients, keeping at least one. */
function trim(c: Array<f64>): Array<f64> {
  if (c.length == 0) return single(0.0);
  let end: i32 = c.length - 1;
  while (end > 0 && c[end] == 0.0) end--;
  return c.slice(0, end + 1);
}

/** Polynomial long division — returns [quotient, remainder], trimmed. */
function polyDivmod(a: Array<f64>, b: Array<f64>): Array<Array<f64>> {
  const at = trim(a);
  const bt = trim(b);
  const res = new Array<Array<f64>>(2);
  if (bt.length == 1 && bt[0] == 0.0) {
    res[0] = single(NaN);
    res[1] = single(NaN);
    return res;
  }
  if (at.length < bt.length) {
    res[0] = single(0.0);
    res[1] = at;
    return res;
  }
  const remainder = at.slice(0, at.length);
  const qLen: i32 = at.length - bt.length + 1;
  const quotient = new Array<f64>(qLen);
  for (let x = 0; x < qLen; x++) quotient[x] = 0.0;
  const bl: i32 = bt.length;
  let i: i32 = qLen;
  while (i > 0) {
    i--;
    quotient[i] = remainder[i + bl - 1] / bt[bl - 1];
    for (let j = 0; j < bl; j++) {
      remainder[i + j] -= quotient[i] * bt[j];
    }
  }
  res[0] = trim(quotient);
  res[1] = bl >= 2 ? trim(remainder.slice(0, bl - 1)) : single(0.0);
  return res;
}

function polyMul(a: Array<f64>, b: Array<f64>): Array<f64> {
  if (a.length == 0 || b.length == 0) return single(0.0);
  const out = new Array<f64>(a.length + b.length - 1);
  for (let x = 0; x < out.length; x++) out[x] = 0.0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] += a[i] * b[j];
    }
  }
  return trim(out);
}

function polyDerivative(c: Array<f64>): Array<f64> {
  if (c.length <= 1) return single(0.0);
  const out = new Array<f64>(c.length - 1);
  for (let i = 1; i < c.length; i++) out[i - 1] = c[i] * <f64>i;
  return out;
}

function determinant(m: Array<f64>, n: i32): f64 {
  let det: f64 = 1.0;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(m[col * n + col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(m[row * n + col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    if (maxVal < 1e-15) return 0.0;
    if (maxRow != col) {
      for (let k = 0; k < n; k++) {
        const t = m[col * n + k];
        m[col * n + k] = m[maxRow * n + k];
        m[maxRow * n + k] = t;
      }
      det = -det;
    }
    det *= m[col * n + col];
    for (let row = col + 1; row < n; row++) {
      const factor = m[row * n + col] / m[col * n + col];
      for (let k = col; k < n; k++) {
        m[row * n + k] -= factor * m[col * n + k];
      }
    }
  }
  return det;
}

function makeMonic(p: Array<f64>): Array<f64> {
  const leading = p[p.length - 1];
  if (leading != 0.0 && leading != 1.0) {
    const out = new Array<f64>(p.length);
    for (let i = 0; i < p.length; i++) out[i] = p[i] / leading;
    return out;
  }
  return p;
}

function polyGcd(a: Array<f64>, b: Array<f64>): Array<f64> {
  let r0 = trim(a);
  let r1 = trim(b);
  while (r1.length > 1 || r1[0] != 0.0) {
    const dm = polyDivmod(r0, r1);
    r0 = r1;
    r1 = dm[1];
  }
  return makeMonic(r0);
}

function resultantValue(p: Array<f64>, q: Array<f64>): f64 {
  const pt = trim(p);
  const qt = trim(q);
  const m: i32 = pt.length - 1;
  const n: i32 = qt.length - 1;
  if (m == 0 && n == 0) return 1.0;
  if (m == 0) return Math.pow(pt[0], <f64>n);
  if (n == 0) return Math.pow(qt[0], <f64>m);
  const size: i32 = m + n;
  const mat = new Array<f64>(size * size);
  for (let x = 0; x < size * size; x++) mat[x] = 0.0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= m; j++) mat[i * size + (i + j)] = pt[m - j];
  }
  for (let i = 0; i < m; i++) {
    for (let j = 0; j <= n; j++) mat[(n + i) * size + (i + j)] = qt[n - j];
  }
  return determinant(mat, size);
}

// --- Exports ----------------------------------------------------------------

/** Add polynomials `a + b`. */
export function polyadd(a: Float64Array, b: Float64Array): Float64Array {
  const aa = toArr(a);
  const bb = toArr(b);
  const len: i32 = aa.length > bb.length ? aa.length : bb.length;
  const sum = new Array<f64>(len < 1 ? 1 : len);
  for (let x = 0; x < sum.length; x++) sum[x] = 0.0;
  for (let i = 0; i < len; i++) {
    const av = i < aa.length ? aa[i] : 0.0;
    const bv = i < bb.length ? bb[i] : 0.0;
    sum[i] = av + bv;
  }
  return toF64(trim(sum));
}

/** Quotient of polynomial division `a / b`. */
export function polynomialQuotient(a: Float64Array, b: Float64Array): Float64Array {
  return toF64(polyDivmod(toArr(a), toArr(b))[0]);
}

/** Remainder of polynomial division `a / b`. */
export function polynomialRemainder(a: Float64Array, b: Float64Array): Float64Array {
  return toF64(polyDivmod(toArr(a), toArr(b))[1]);
}

/** Monic GCD of polynomials `a` and `b`. */
export function polynomialGCD(a: Float64Array, b: Float64Array): Float64Array {
  return toF64(polyGcd(toArr(a), toArr(b)));
}

/** Monic LCM of polynomials `a` and `b`. */
export function polynomialLCM(a: Float64Array, b: Float64Array): Float64Array {
  const aa = toArr(a);
  const bb = toArr(b);
  const g = polyGcd(aa, bb);
  const dm = polyDivmod(polyMul(aa, bb), g);
  return toF64(makeMonic(dm[0]));
}

/** Discriminant of a polynomial of degree >= 1. */
export function discriminant(coeffs: Float64Array): f64 {
  const t = trim(toArr(coeffs));
  const deg: i32 = t.length - 1;
  if (deg < 1) return NaN;
  if (deg == 1) return 1.0;
  if (deg == 2) {
    return t[1] * t[1] - 4.0 * t[2] * t[0];
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
  const fp = polyDerivative(t);
  const res = resultantValue(t, fp);
  const an = t[t.length - 1];
  const sign: f64 = ((deg * (deg - 1)) / 2) % 2 == 0 ? 1.0 : -1.0;
  return (sign * res) / an;
}

/** Resultant of two polynomials (Sylvester-matrix determinant). */
export function resultant(p: Float64Array, q: Float64Array): f64 {
  return resultantValue(toArr(p), toArr(q));
}
