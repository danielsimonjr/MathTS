/**
 * Exact rational arithmetic (lowest-terms, positive denominator).
 * Shared by the Layer 1–3 rational-function integrators so those modules
 * can import each other without a cycle.
 */

import { bigintGcd } from '../typed/factorization/integer-poly.js';

export interface Rat {
  num: bigint;
  den: bigint;
}

export function ratNormalize(num: bigint, den: bigint): Rat {
  if (den === 0n) {
    throw new Error('Rat: zero denominator');
  }
  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) {
    return { num: 0n, den: 1n };
  }
  const g = bigintGcd(n, d);
  return { num: n / g, den: d / g };
}

export function ratAdd(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function ratSub(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function ratMul(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.num, a.den * b.den);
}

export function ratDiv(a: Rat, b: Rat): Rat {
  if (b.num === 0n) {
    throw new Error('Rat: division by zero');
  }
  return ratNormalize(a.num * b.den, a.den * b.num);
}

export function ratFromBigint(n: bigint): Rat {
  return { num: n, den: 1n };
}

export const RAT_ZERO: Rat = { num: 0n, den: 1n };
