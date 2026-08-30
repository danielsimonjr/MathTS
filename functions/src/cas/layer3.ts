/**
 * Risch Layer 3 — Hermite reduction + Rothstein–Trager / residue formula
 * for rational functions whose denominator has a degree-≥3 irreducible
 * factor or a repeated positive-discriminant quadratic.
 *
 * After Ostrogradsky–Hermite peels the rational part (any repeated factor),
 * the remaining square-free integrand is integrated by Rothstein–Trager
 * when every residue is rational, otherwise by the residue formula
 * (companion-matrix roots of the denominator, conjugate pairs folded into
 * real `log` + `atan2`). Correctness is verified by differentiation; the
 * string form is not contractual.
 */

import { eig } from '@danielsimonjr/mathts-matrix';
import {
  trim,
  degree,
  sub,
  mul,
  scalarMul,
  derivative,
  exactDivide,
  polyGcdZ,
  type IntPoly,
} from '../typed/factorization/integer-poly.js';
import { factorUnivariateZ } from '../typed/factorization/zassenhaus.js';
import { ratAdd, ratSub, ratMul, ratDiv, ratFromBigint, RAT_ZERO, type Rat } from './rat.js';

function ratEq(a: Rat, b: Rat): boolean {
  return a.num === b.num && a.den === b.den;
}

function joinTerms(parts: string[]): string {
  if (parts.length === 0) return '0';
  return parts.join(' + ').replace(/\+ -/g, '- ');
}

function renderCoeffTimes(r: Rat, rest: string): string {
  const neg = r.num < 0n;
  const absNum = neg ? -r.num : r.num;
  const sign = neg ? '-' : '';
  if (absNum === r.den) return `${sign}${rest}`;
  const denPart = r.den === 1n ? '' : `/${r.den}`;
  return `${sign}${absNum}${denPart}*${rest}`;
}

function renderPoly(p: IntPoly, v: string): string {
  const t = trim(p);
  if (t.length === 0) return '0';
  const parts: string[] = [];
  for (let i = t.length - 1; i >= 0; i -= 1) {
    const c = t[i];
    if (c === 0n) continue;
    const sign = c < 0n ? '-' : parts.length === 0 ? '' : '+';
    const abs = c < 0n ? -c : c;
    let term: string;
    if (i === 0) term = `${abs}`;
    else if (i === 1) term = abs === 1n ? v : `${abs}*${v}`;
    else term = abs === 1n ? `${v}^${i}` : `${abs}*${v}^${i}`;
    parts.push(parts.length === 0 && sign === '' ? term : `${sign} ${term}`);
  }
  return parts.join(' ').replace(/^\+ /, '');
}

/** Bareiss fraction-free determinant over ℤ. */
export function detZ(matrix: bigint[][]): bigint {
  const n = matrix.length;
  if (n === 0) return 1n;
  const a = matrix.map((row) => row.slice());
  let sign = 1n;
  let prev = 1n;
  for (let k = 0; k < n; k += 1) {
    let pivot = k;
    while (pivot < n && a[pivot][k] === 0n) pivot += 1;
    if (pivot === n) return 0n;
    if (pivot !== k) {
      [a[k], a[pivot]] = [a[pivot], a[k]];
      sign = -sign;
    }
    if (k === n - 1) break;
    for (let i = k + 1; i < n; i += 1) {
      for (let j = k + 1; j < n; j += 1) {
        a[i][j] = (a[i][j] * a[k][k] - a[i][k] * a[k][j]) / prev;
      }
    }
    prev = a[k][k];
  }
  return sign * a[n - 1][n - 1];
}

/** Sylvester resultant of two integer polynomials. */
export function resultantZ(a: IntPoly, b: IntPoly): bigint {
  const ta = trim(a);
  const tb = trim(b);
  const m = ta.length - 1;
  const n = tb.length - 1;
  if (m < 0 || n < 0) return 0n;
  if (m === 0 && n === 0) return 1n;
  if (m === 0) return ta[0] ** BigInt(n);
  if (n === 0) return tb[0] ** BigInt(m);
  const dim = m + n;
  const s: bigint[][] = Array.from({ length: dim }, () => Array<bigint>(dim).fill(0n));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= m; j += 1) s[i][i + j] = ta[m - j];
  }
  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j <= n; j += 1) s[n + i][i + j] = tb[n - j];
  }
  return detZ(s);
}

/**
 * Rothstein–Trager resultant `R(t) = Res_x(A − t B', B)`, recovered by
 * interpolating integer samples `R(k)` at `k = 0..N`.
 */
export function rothsteinResultant(A: IntPoly, B: IntPoly): IntPoly {
  const Bp = derivative(B);
  const n = Math.max(degree(B), 0) + Math.max(degree(Bp), 0) + 2;
  const samples: bigint[] = [];
  for (let k = 0; k <= n; k += 1) {
    const p = sub(A, scalarMul(Bp, BigInt(k)));
    samples.push(resultantZ(p, B));
  }
  return interpolateAtIntegers(samples);
}

/** Unique polynomial of degree ≤ n with `p(k) = values[k]` for k = 0..n. */
function interpolateAtIntegers(values: bigint[]): IntPoly {
  const n = values.length - 1;
  const size = n + 1;
  const matrix: Rat[][] = [];
  const rhs: Rat[] = [];
  for (let k = 0; k < size; k += 1) {
    const row: Rat[] = [];
    let pk = 1n;
    for (let j = 0; j < size; j += 1) {
      row.push(ratFromBigint(pk));
      pk *= BigInt(k);
    }
    matrix.push(row);
    rhs.push(ratFromBigint(values[k]));
  }
  const coeffs = solveLinearSystemRat(matrix, rhs);
  return trim(
    coeffs.map((r) => {
      if (r.den !== 1n) {
        throw new Error('rothsteinResultant: non-integer interpolated coefficient');
      }
      return r.num;
    })
  );
}

function solveLinearSystemRat(matrix: readonly Rat[][], rhs: readonly Rat[]): Rat[] {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    while (pivot < n && a[pivot][col].num === 0n) pivot += 1;
    if (pivot === n) throw new Error('singular Rat system');
    if (pivot !== col) [a[col], a[pivot]] = [a[pivot], a[col]];
    const pv = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] = ratDiv(a[col][j], pv);
    for (let i = 0; i < n; i += 1) {
      if (i === col) continue;
      const f = a[i][col];
      if (f.num === 0n) continue;
      for (let j = col; j <= n; j += 1) a[i][j] = ratSub(a[i][j], ratMul(f, a[col][j]));
    }
  }
  return a.map((row) => row[n]);
}

function intToRatPoly(p: IntPoly): Rat[] {
  return trim(p).map(ratFromBigint);
}

function ratPolyToInt(p: Rat[]): { poly: IntPoly; den: bigint } {
  if (p.length === 0) return { poly: [], den: 1n };
  let lcm = 1n;
  const gcd = (a: bigint, b: bigint): bigint => {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x;
  };
  for (const r of p) {
    const g = gcd(lcm, r.den);
    lcm = (lcm / g) * r.den;
  }
  return { poly: trim(p.map((r) => (r.num * lcm) / r.den)), den: lcm };
}

function rpAdd(a: Rat[], b: Rat[]): Rat[] {
  const n = Math.max(a.length, b.length);
  const out: Rat[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(ratAdd(a[i] ?? RAT_ZERO, b[i] ?? RAT_ZERO));
  }
  let m = out.length;
  while (m > 0 && out[m - 1].num === 0n) m -= 1;
  return out.slice(0, m);
}

function rpScale(p: Rat[], s: Rat): Rat[] {
  if (s.num === 0n) return [];
  return p.map((c) => ratMul(c, s));
}

function rpMul(a: Rat[], b: Rat[]): Rat[] {
  if (a.length === 0 || b.length === 0) return [];
  const out: Rat[] = Array.from({ length: a.length + b.length - 1 }, () => RAT_ZERO);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].num === 0n) continue;
    for (let j = 0; j < b.length; j += 1) {
      out[i + j] = ratAdd(out[i + j], ratMul(a[i], b[j]));
    }
  }
  let m = out.length;
  while (m > 0 && out[m - 1].num === 0n) m -= 1;
  return out.slice(0, m);
}

function rpDerivative(p: Rat[]): Rat[] {
  if (p.length <= 1) return [];
  const out: Rat[] = [];
  for (let i = 1; i < p.length; i += 1) {
    out.push(ratMul(p[i], ratFromBigint(BigInt(i))));
  }
  return out;
}

/**
 * Ostrogradsky–Hermite: `R/Q = (P/Q1)' + S/Q2` with `Q1 = gcd(Q,Q')`,
 * `Q2 = Q/Q1` square-free. Returns the rational part `P/Q1` as a string
 * (or `'0'`) and the remaining square-free numerator `S`.
 */
export function hermiteReduce(
  R: IntPoly,
  Q: IntPoly,
  v: string
): { rational: string; squareFreeNumer: IntPoly; squareFreeDenom: IntPoly } {
  const Q1 = polyGcdZ(Q, derivative(Q));
  if (degree(Q1) <= 0) {
    return { rational: '0', squareFreeNumer: trim(R), squareFreeDenom: trim(Q) };
  }
  const Q2 = exactDivide(Q, Q1);
  if (Q2 === null) {
    throw new Error('hermiteReduce: Q1 does not divide Q');
  }
  const Q1p = derivative(Q1);
  const Wnum = mul(Q2, Q1p);
  const Wdiv = exactDivide(Wnum, Q1);
  let W: Rat[];
  if (Wdiv !== null) {
    W = intToRatPoly(Wdiv);
  } else {
    W = ratPolyExactQuotient(intToRatPoly(Wnum), intToRatPoly(Q1));
  }

  const d1 = degree(Q1);
  const d2 = degree(Q2);
  const nP = Math.max(d1, 0);
  const nS = Math.max(d2, 0);
  const n = nP + nS;
  const q2 = intToRatPoly(Q2);
  const q1 = intToRatPoly(Q1);
  const r = intToRatPoly(R);

  const matrix: Rat[][] = Array.from({ length: n }, () => Array<Rat>(n).fill(RAT_ZERO));
  const rhs: Rat[] = Array.from({ length: n }, () => RAT_ZERO);
  for (let i = 0; i < r.length && i < n; i += 1) rhs[i] = r[i];

  // Columns 0..nP-1: coefficients of P. Contribution C P' − W P.
  for (let k = 0; k < nP; k += 1) {
    const Pk: Rat[] = Array.from({ length: k + 1 }, () => RAT_ZERO);
    Pk[k] = { num: 1n, den: 1n };
    const Pp = rpDerivative(Pk);
    const term = rpAdd(rpMul(q2, Pp), rpScale(rpMul(W, Pk), ratFromBigint(-1n)));
    for (let i = 0; i < term.length && i < n; i += 1) matrix[i][k] = term[i];
  }
  // Columns nP..n-1: coefficients of S. Contribution Q1 S.
  for (let k = 0; k < nS; k += 1) {
    const Sk: Rat[] = Array.from({ length: k + 1 }, () => RAT_ZERO);
    Sk[k] = { num: 1n, den: 1n };
    const term = rpMul(q1, Sk);
    for (let i = 0; i < term.length && i < n; i += 1) matrix[i][nP + k] = term[i];
  }

  const sol = solveLinearSystemRat(matrix, rhs);
  const P = sol.slice(0, nP);
  const S = sol.slice(nP);
  const Pint = ratPolyToInt(P);
  const Sint = ratPolyToInt(S);
  const q1Scaled = Pint.den === 1n ? Q1 : scalarMul(Q1, Pint.den);
  const rational =
    degree(Pint.poly) < 0 ? '0' : `(${renderPoly(Pint.poly, v)})/(${renderPoly(q1Scaled, v)})`;
  const q2Scaled = Sint.den === 1n ? Q2 : scalarMul(Q2, Sint.den);
  return { rational, squareFreeNumer: Sint.poly, squareFreeDenom: trim(q2Scaled) };
}

function ratPolyExactQuotient(a: Rat[], b: Rat[]): Rat[] {
  const db = b.length - 1;
  if (db < 0) throw new Error('ratPolyExactQuotient: zero divisor');
  const lb = b[db];
  let rem = a.slice();
  const q: Rat[] = [];
  while (rem.length - 1 >= db) {
    const coeff = ratDiv(rem[rem.length - 1], lb);
    const shift = rem.length - 1 - db;
    while (q.length <= shift) q.push(RAT_ZERO);
    q[shift] = coeff;
    for (let i = 0; i <= db; i += 1) {
      rem[shift + i] = ratSub(rem[shift + i] ?? RAT_ZERO, ratMul(coeff, b[i]));
    }
    let m = rem.length;
    while (m > 0 && rem[m - 1].num === 0n) m -= 1;
    rem = rem.slice(0, m);
  }
  if (rem.some((c) => c.num !== 0n)) {
    throw new Error('ratPolyExactQuotient: nonzero remainder');
  }
  return q;
}

function evalPolyC(p: IntPoly, re: number, im: number): { re: number; im: number } {
  let r = 0;
  let i = 0;
  for (let k = p.length - 1; k >= 0; k -= 1) {
    const c = Number(p[k]);
    const nr = r * re - i * im + c;
    const ni = r * im + i * re;
    r = nr;
    i = ni;
  }
  return { re: r, im: i };
}

function companionRoots(B: IntPoly): Array<{ re: number; im: number }> {
  const t = trim(B);
  const n = t.length - 1;
  if (n <= 0) return [];
  const lead = Number(t[n]);
  if (n === 1) {
    return [{ re: -Number(t[0]) / lead, im: 0 }];
  }
  const m: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 1; i < n; i += 1) m[i][i - 1] = 1;
  for (let j = 0; j < n; j += 1) m[0][j] = -Number(t[n - 1 - j]) / lead;
  // Companion laid as row-companion of the monic poly: last row is -coeffs.
  // Rebuild in the standard Frobenius form (last row = -c0..-c_{n-1}).
  for (let i = 0; i < n; i += 1) m[i].fill(0);
  for (let i = 0; i < n - 1; i += 1) m[i][i + 1] = 1;
  for (let j = 0; j < n; j += 1) m[n - 1][j] = -Number(t[j]) / lead;
  const { values } = eig(m, { computeVectors: false });
  return values;
}

/**
 * Residue-formula antiderivative of a square-free proper `A/B`:
 * `Σ (A(r)/B'(r)) log(x − r)`, with conjugate pairs folded into a real
 * `log` + `atan2` pair so the result is evaluable over ℝ.
 */
export function residueIntegral(A: IntPoly, B: IntPoly, v: string): string {
  const roots = companionRoots(B);
  const Bp = derivative(B);
  const used = new Array<boolean>(roots.length).fill(false);
  const parts: string[] = [];
  const eps = 1e-10;

  for (let i = 0; i < roots.length; i += 1) {
    if (used[i]) continue;
    const r = roots[i];
    const Ar = evalPolyC(A, r.re, r.im);
    const Bpr = evalPolyC(Bp, r.re, r.im);
    const den = Bpr.re * Bpr.re + Bpr.im * Bpr.im;
    if (den < 1e-30) continue;
    const resRe = (Ar.re * Bpr.re + Ar.im * Bpr.im) / den;
    const resIm = (Ar.im * Bpr.re - Ar.re * Bpr.im) / den;

    if (Math.abs(r.im) < eps) {
      used[i] = true;
      if (Math.abs(resRe) < eps) continue;
      const rootStr = Math.abs(r.re) < eps ? v : `${v} - (${r.re})`;
      parts.push(`(${resRe})*log(abs(${rootStr}))`);
      continue;
    }

    let j = -1;
    for (let k = i + 1; k < roots.length; k += 1) {
      if (!used[k] && Math.abs(roots[k].re - r.re) < 1e-8 && Math.abs(roots[k].im + r.im) < 1e-8) {
        j = k;
        break;
      }
    }
    used[i] = true;
    if (j >= 0) used[j] = true;
    const a = r.re;
    const b = r.im;
    const quad = `(${v} - (${a}))^2 + (${b})^2`;
    if (Math.abs(resRe) > eps) {
      parts.push(`(${resRe})*log(${quad})`);
    }
    if (Math.abs(resIm) > eps) {
      parts.push(`(${-2 * resIm})*atan2(${-b}, ${v} - (${a}))`);
    }
  }
  return joinTerms(parts);
}

/**
 * Exact Rothstein–Trager when every residue is rational; otherwise the
 * residue formula. `A/B` must be proper and `B` square-free.
 */
export function rothsteinTrager(A: IntPoly, B: IntPoly, v: string): string {
  try {
    const R = rothsteinResultant(A, B);
    if (degree(R) < 0) return '0';
    const { factors } = factorUnivariateZ(R);
    const allLinear = factors.every((f) => trim(f.poly).length - 1 === 1);
    if (allLinear) {
      const Bp = derivative(B);
      const parts: string[] = [];
      for (const { poly } of factors) {
        const q = trim(poly);
        if (q.length !== 2) continue;
        const c = ratDiv(ratFromBigint(-q[0]), ratFromBigint(q[1]));
        if (ratEq(c, RAT_ZERO)) continue;
        const scaled = sub(scalarMul(A, c.den), scalarMul(Bp, c.num));
        const g = polyGcdZ(scaled, B);
        if (degree(g) < 1) continue;
        parts.push(renderCoeffTimes(c, `log(${renderPoly(g, v)})`));
      }
      return joinTerms(parts);
    }
  } catch {
    // Interpolation can fail for a scaled square-free kernel.
  }
  return residueIntegral(A, B, v);
}

/**
 * Full Layer-3 pipeline for a proper remainder `R/Q` (already split off the
 * polynomial part). Hermite-reduces repeated factors, then integrates the
 * square-free remainder.
 */
export function integrateLayer3(R: IntPoly, Q: IntPoly, v: string): string {
  const { rational, squareFreeNumer, squareFreeDenom } = hermiteReduce(R, Q, v);
  const parts: string[] = [];
  if (rational !== '0') parts.push(rational);
  if (degree(squareFreeDenom) >= 1 && degree(squareFreeNumer) >= 0) {
    const sf = rothsteinTrager(squareFreeNumer, squareFreeDenom, v);
    if (sf !== '0') parts.push(sf);
  }
  return joinTerms(parts);
}
