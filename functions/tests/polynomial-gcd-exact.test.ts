/**
 * polynomialGCD on integer inputs is exact (bigint primitive PRS over Z[x]).
 *
 * Floating-point Euclid cannot decide coprimality for high-degree inputs: the
 * first remainder of `a mod b` is dominated by lambda^n * b(x)/(x - lambda), a
 * scaled factor of `b`, so a spurious linear or quadratic "GCD" came back. For
 * a degree-266 polynomial and a random integer cubic that happened in 53 of
 * 300 draws.
 *
 * The oracle here is construction, not another GCD implementation:
 *  - coprime pairs: `b` has distinct integer roots at which `a` is nonzero,
 *    so gcd(a, b) = 1 exactly;
 *  - planted factors: gcd(c*p, c*q) = c when gcd(p, q) = 1 by the same test.
 */

import { describe, it, expect } from 'vitest';
import { polynomialGCD, polynomialLCM, polymul } from '../src/typed/algebra.js';

/** Deterministic PRNG (mulberry32), so every draw is reproducible. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function randPoly(rand: () => number, degree: number, scale: number): number[] {
  const c = Array.from({ length: degree + 1 }, () => randInt(rand, -scale, scale));
  if (c[degree] === 0) c[degree] = 1;
  return c;
}

/** Exact value of an integer polynomial at an integer point. */
function evalExact(p: number[], x: number): bigint {
  let acc = 0n;
  for (let i = p.length - 1; i >= 0; i--) acc = acc * BigInt(x) + BigInt(p[i]);
  return acc;
}

/** Monic cubic (x - k1)(x - k2)(x - k3) with distinct integer roots avoiding `a`'s roots. */
function coprimeCubic(rand: () => number, a: number[]): number[] {
  const roots: number[] = [];
  while (roots.length < 3) {
    const k = randInt(rand, -5, 5);
    if (!roots.includes(k) && evalExact(a, k) !== 0n) roots.push(k);
  }
  return roots.reduce<number[]>((acc, k) => polymul(acc, [-k, 1]), [1]);
}

describe('polynomialGCD — exact on integer inputs', () => {
  it('returns [1] for every coprime degree-266 / cubic pair (the case float Euclid got wrong)', () => {
    const rand = mulberry32(0x5eed);
    for (let draw = 0; draw < 300; draw++) {
      const a = polymul([-1, 1], randPoly(rand, 264, 10)); // (x - 1) * R, degree 265
      const b = coprimeCubic(rand, a);
      expect(polynomialGCD(a, b), `draw ${draw}`).toEqual([1]);
    }
  });

  it('recovers a planted common quadratic from high-degree multiples', () => {
    const rand = mulberry32(42);
    for (let draw = 0; draw < 50; draw++) {
      let c = randPoly(rand, 2, 6);
      if (c[2] < 0) c = c.map((v) => -v);
      const p = randPoly(rand, 120, 9);
      const q = coprimeCubic(rand, p);
      // gcd(c*p, c*q) = c * gcd(p, q) = c; the monic result is c / lc(c).
      const g = polynomialGCD(polymul(c, p), polymul(c, q));
      const expected = c.map((v) => v / c[2]);
      expect(g.length, `draw ${draw}`).toBe(3);
      for (let i = 0; i < 3; i++) expect(g[i]).toBeCloseTo(expected[i], 12);
    }
  });

  it('keeps the documented small results', () => {
    expect(polynomialGCD([-1, 0, 1], [-1, 1])).toEqual([-1, 1]); // x^2-1, x-1 -> x-1
    expect(polynomialGCD([1, 1], [2, 1])).toEqual([1]); // coprime linears
    expect(polynomialGCD([6, 6], [2, 2])).toEqual([1, 1]); // content ignored, monic
    expect(polynomialGCD([0], [-2, 4])).toEqual([-0.5, 1]); // gcd(0, b) = monic b
    expect(polynomialGCD([0], [0])).toEqual([0]);
  });

  it('polynomialLCM uses the exact GCD', () => {
    const a = polymul([-1, 1], [2, 1]); // (x-1)(x+2)
    const b = polymul([-1, 1], [-3, 1]); // (x-1)(x-3)
    expect(polynomialLCM(a, b)).toEqual(polymul(polymul([-1, 1], [2, 1]), [-3, 1]));
  });
});

describe('polynomialGCD — non-integer inputs keep the floating-point path', () => {
  it('finds a common factor when the coefficients are not integers', () => {
    const g = polynomialGCD([0.5, 0, -0.5], [-0.5, 0.5]); // 0.5(1 - x^2), 0.5(x - 1)
    expect(g).toEqual([-1, 1]);
  });

  it('treats integers beyond 2^53 as floats instead of throwing', () => {
    const big = 2 ** 60;
    expect(() => polynomialGCD([big, big], [1, 1])).not.toThrow();
  });
});
