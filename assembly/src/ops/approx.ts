/**
 * Rational approximation — AssemblyScript fallback: partial-fraction
 * residues and Padé approximants.
 */

function evalPoly(c: Float64Array, x: f64): f64 {
  let s: f64 = 0.0;
  let i: i32 = c.length;
  while (i > 0) {
    i--;
    s = s * x + c[i];
  }
  return s;
}

function evalPolyDeriv(c: Float64Array, x: f64): f64 {
  let s: f64 = 0.0;
  let i: i32 = c.length;
  while (i > 1) {
    i--;
    s = s * x + <f64>i * c[i];
  }
  return s;
}

/** Real roots of a polynomial via the Durand-Kerner method. */
function polyRoots(coeffs: Float64Array): Array<f64> {
  const out = new Array<f64>();
  if (coeffs.length < 2) return out;
  const n: i32 = coeffs.length - 1;
  const lc: f64 = coeffs[n];
  const c = new Float64Array(coeffs.length);
  for (let i = 0; i < coeffs.length; i++) c[i] = coeffs[i] / lc;

  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const angle: f64 = (2.0 * Math.PI * <f64>i) / <f64>n + 0.4;
    re[i] = 0.4 * Math.cos(angle);
    im[i] = 0.4 * Math.sin(angle);
  }

  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < n; i++) {
      let pRe: f64 = c[n];
      let pIm: f64 = 0.0;
      let j: i32 = n;
      while (j > 0) {
        j--;
        const nr: f64 = pRe * re[i] - pIm * im[i] + c[j];
        const ni: f64 = pRe * im[i] + pIm * re[i];
        pRe = nr;
        pIm = ni;
      }
      let dRe: f64 = 1.0;
      let dIm: f64 = 0.0;
      for (let k = 0; k < n; k++) {
        if (k == i) continue;
        const diffRe: f64 = re[i] - re[k];
        const diffIm: f64 = im[i] - im[k];
        const nr: f64 = dRe * diffRe - dIm * diffIm;
        const ni: f64 = dRe * diffIm + dIm * diffRe;
        dRe = nr;
        dIm = ni;
      }
      const denom: f64 = dRe * dRe + dIm * dIm;
      if (denom > 1e-30) {
        re[i] -= (pRe * dRe + pIm * dIm) / denom;
        im[i] -= (pIm * dRe - pRe * dIm) / denom;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (Math.abs(im[i]) < 1e-8) out.push(re[i]);
  }
  return out;
}

/** Solve `A x = b` (`A` is n x n row-major). Returns zeros if singular. */
function linsolveAS(a: Float64Array, n: i32, b: Float64Array): Float64Array {
  const w: i32 = n + 1;
  const m = new Float64Array(n * w);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) m[i * w + j] = a[i * n + j];
    m[i * w + n] = b[i];
  }
  for (let col = 0; col < n; col++) {
    let maxRow: i32 = col;
    let maxVal: f64 = Math.abs(m[col * w + col]);
    for (let row = col + 1; row < n; row++) {
      const v: f64 = Math.abs(m[row * w + col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    if (maxVal < 1e-15) return new Float64Array(n); // singular -> zeros
    if (maxRow != col) {
      for (let j = 0; j < w; j++) {
        const t: f64 = m[col * w + j];
        m[col * w + j] = m[maxRow * w + j];
        m[maxRow * w + j] = t;
      }
    }
    for (let row = col + 1; row < n; row++) {
      const factor: f64 = m[row * w + col] / m[col * w + col];
      for (let j = col; j < w; j++) m[row * w + j] -= factor * m[col * w + j];
    }
  }
  const x = new Float64Array(n);
  let i: i32 = n;
  while (i > 0) {
    i--;
    let s: f64 = m[i * w + n];
    for (let j = i + 1; j < n; j++) s -= m[i * w + j] * x[j];
    x[i] = s / m[i * w + i];
  }
  return x;
}

/**
 * Partial-fraction residues of `P(x)/Q(x)`. Returns a packed
 * `Float64Array` `[residues (count) | poles (count)]`; the caller derives
 * `count = result.length / 2`.
 */
export function residue(p: Float64Array, q: Float64Array): Float64Array {
  if (p.length <= 0 || q.length <= 1) return new Float64Array(0);
  const poles = polyRoots(q);
  const count: i32 = poles.length;
  const out = new Float64Array(2 * count);
  for (let k = 0; k < count; k++) {
    const pole: f64 = poles[k];
    out[k] = evalPoly(p, pole) / evalPolyDeriv(q, pole);
    out[count + k] = pole;
  }
  return out;
}

/**
 * Padé approximant `[m/n]` from Taylor coefficients. Returns a packed
 * `Float64Array` `[numerator (m+1) | denominator (n+1)]`.
 */
export function padeApproximant(coeffs: Float64Array, m: i32, n: i32): Float64Array {
  if (m < 0 || n < 0) return new Float64Array(0);
  const cLen: i32 = coeffs.length > m + n + 1 ? coeffs.length : m + n + 1;
  const c = new Float64Array(cLen);
  for (let i = 0; i < coeffs.length; i++) c[i] = coeffs[i];

  const out = new Float64Array(m + 1 + n + 1);
  if (n > 0) {
    const a = new Float64Array(n * n);
    const rhs = new Float64Array(n);
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= n; j++) {
        const idx: i32 = m + i - j;
        a[(i - 1) * n + (j - 1)] = idx >= 0 && idx < cLen ? c[idx] : 0.0;
      }
      rhs[i - 1] = -c[m + i];
    }
    const b = linsolveAS(a, n, rhs);
    out[m + 1] = 1.0;
    for (let j = 0; j < n; j++) out[m + 1 + j + 1] = b[j];
    for (let i = 0; i <= m; i++) {
      let s: f64 = c[i];
      const jmax: i32 = i < n ? i : n;
      for (let j = 1; j <= jmax; j++) s += b[j - 1] * c[i - j];
      out[i] = s;
    }
  } else {
    for (let i = 0; i <= m; i++) out[i] = c[i];
    out[m + 1] = 1.0;
  }
  return out;
}
