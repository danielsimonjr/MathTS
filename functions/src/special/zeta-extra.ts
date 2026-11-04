/**
 * Hurwitz zeta, Dirichlet eta, and Bernoulli / Euler polynomials.
 */

import { bernoulli, combinations } from '../typed/probability.js';

function asNumber(value: unknown, name: string): number {
  if (typeof value !== 'number') {
    throw new TypeError(`${name}: expected a scalar result`);
  }
  return value;
}

/** B_2, B_4, …, B_16 for the Euler–Maclaurin correction terms. */
const BERNOULLI_EVEN = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510];

/**
 * Hurwitz zeta `ζ(s, a) = Σ_{k≥0} (k + a)^{−s}` for `s > 1`, `a > 0`, by Euler–Maclaurin
 * with `N = 10` leading terms and eight Bernoulli correction terms. NaN outside the domain.
 *
 * @example
 * hurwitzZeta(2, 1) // 1.6449340668482264
 */
export function hurwitzZeta(s: number, a: number): number {
  if (Number.isNaN(s) || Number.isNaN(a) || s <= 1 || a <= 0) return NaN;
  const N = 10;
  let sum = 0;
  for (let k = 0; k < N; k += 1) sum += Math.pow(a + k, -s);
  const x = a + N;
  sum += Math.pow(x, 1 - s) / (s - 1) + Math.pow(x, -s) / 2;
  // Σ_j B_{2j}/(2j)! · s(s+1)…(s+2j−2) · x^{−s−2j+1}
  let rising = s; // s(s+1)…(s+2j−2), starts at j = 1 with one factor
  let factorial = 2; // (2j)!
  let xPow = Math.pow(x, -s - 1);
  const x2 = x * x;
  for (let j = 1; j <= BERNOULLI_EVEN.length; j += 1) {
    sum += (BERNOULLI_EVEN[j - 1] / factorial) * rising * xPow;
    // advance to j + 1
    rising *= (s + 2 * j - 1) * (s + 2 * j);
    factorial *= (2 * j + 1) * (2 * j + 2);
    xPow /= x2;
  }
  return sum;
}

/**
 * Dirichlet eta function `η(s) = (1 − 2^{1−s}) ζ(s)`, all real s, by Borwein's
 * alternating-series algorithm (n = 40, error below 1e-20 relative).
 *
 * @example
 * dirichletEta(1) // 0.6931471805599453
 * dirichletEta(2) // 0.8224670334241132
 */
export function dirichletEta(s: number): number {
  if (Number.isNaN(s)) return NaN;
  if (s === 1) return Math.LN2;
  const n = 40;
  const fact = (m: number): number => {
    let r = 1;
    for (let i = 2; i <= m; i += 1) r *= i;
    return r;
  };
  // d_k = n · Σ_{i=0}^{k} (n+i−1)! 4^i / ((n−i)! (2i)!)
  const d: number[] = [];
  let acc = 0;
  for (let i = 0; i <= n; i += 1) {
    acc += (fact(n + i - 1) * Math.pow(4, i)) / (fact(n - i) * fact(2 * i));
    d.push(n * acc);
  }
  const dn = d[n];
  let total = 0;
  for (let k = 0; k < n; k += 1) {
    const sign = k % 2 === 0 ? 1 : -1;
    total += (sign * (d[k] - dn)) / Math.pow(k + 1, s);
  }
  return -total / dn;
}

/**
 * Bernoulli polynomial `B_n(x) = Σ_k C(n,k) B_k x^{n−k}` (with `B_1 = −1/2`).
 *
 * @example
 * bernoulliPolynomial(2, 0.5) // -0.08333333333333333
 */
export function bernoulliPolynomial(n: number, x: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('bernoulliPolynomial: n must be a non-negative integer');
  }
  let sum = 0;
  for (let k = 0; k <= n; k += 1) {
    const bk = asNumber(bernoulli(k), 'bernoulliPolynomial');
    const ck = asNumber(combinations(n, k), 'bernoulliPolynomial');
    sum += ck * bk * Math.pow(x, n - k);
  }
  return sum;
}

/**
 * Euler polynomial `E_n(x) = 2/(n+1) · (B_{n+1}(x) − 2^{n+1} B_{n+1}(x/2))`.
 *
 * @example
 * eulerPolynomial(2, 0.5) // -0.25
 * eulerPolynomial(1, 0)   // -0.5
 */
export function eulerPolynomial(n: number, x: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('eulerPolynomial: n must be a non-negative integer');
  }
  const m = n + 1;
  return (2 / m) * (bernoulliPolynomial(m, x) - Math.pow(2, m) * bernoulliPolynomial(m, x / 2));
}
