import { describe, it, expect } from 'vitest';
import { Fraction } from '../../src/index.js';

/**
 * Oracle tests for the Knuth cross-gcd multiply/divide, the reduced-pair fast paths of
 * negate/abs/inverse and the direct-power `pow`. The reference reduces the textbook product
 * with its own gcd, so it shares no code with the implementation.
 */

function refGcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function refReduce(n: bigint, d: bigint): [bigint, bigint] {
  if (d < 0n) [n, d] = [-n, -d];
  if (n === 0n) return [0n, 1n];
  const g = refGcd(n, d);
  return [n / g, d / g];
}

/** Deterministic xorshift; the tests must not depend on Math.random. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

function randBig(next: () => number, bits: number): bigint {
  let v = 0n;
  for (let i = 0; i < bits; i += 30) v = (v << 30n) | BigInt(Math.floor(next() * 2 ** 30));
  return v & ((1n << BigInt(bits)) - 1n);
}

function randFraction(next: () => number): Fraction {
  const bits = [4, 12, 40, 130][Math.floor(next() * 4)]!;
  let n = randBig(next, bits);
  if (next() < 0.5) n = -n;
  let d = randBig(next, bits) + 1n;
  // Force shared factors now and then, so reduction has real work to do.
  if (next() < 0.4) {
    const k = randBig(next, 20) + 1n;
    n *= k;
    d *= k;
  }
  return new Fraction(n, d);
}

function expectReduced(f: Fraction): void {
  expect(f.denominator > 0n).toBe(true);
  expect(refGcd(f.numerator, f.denominator)).toBe(f.numerator === 0n ? f.denominator : 1n);
  if (f.numerator === 0n) expect(f.denominator).toBe(1n);
}

describe('Fraction multiply / divide vs a BigInt reference', () => {
  it('multiply matches the reduced textbook product on 2000 random pairs', () => {
    const next = rng(12345);
    for (let i = 0; i < 2000; i++) {
      const x = randFraction(next);
      const y = randFraction(next);
      const [n, d] = refReduce(x.numerator * y.numerator, x.denominator * y.denominator);
      const r = x.multiply(y);
      expect([r.numerator, r.denominator]).toEqual([n, d]);
      expectReduced(r);
    }
  });

  it('divide matches the reduced textbook quotient, including negative divisors', () => {
    const next = rng(777);
    let checked = 0;
    for (let i = 0; i < 2000; i++) {
      const x = randFraction(next);
      const y = randFraction(next);
      if (y.numerator === 0n) continue;
      const [n, d] = refReduce(x.numerator * y.denominator, x.denominator * y.numerator);
      const r = x.divide(y);
      expect([r.numerator, r.denominator]).toEqual([n, d]);
      expectReduced(r);
      checked++;
    }
    expect(checked).toBeGreaterThan(1900);
  });

  it('keeps zero canonical and the sign on the numerator', () => {
    const zero = new Fraction(0n);
    const x = new Fraction(-7n, 12n);
    for (const r of [
      zero.multiply(x),
      x.multiply(zero),
      zero.divide(x),
      zero.divide(new Fraction(5n, 3n)),
    ]) {
      expect([r.numerator, r.denominator]).toEqual([0n, 1n]);
    }
    const q = new Fraction(3n, 4n).divide(new Fraction(-9n, 2n));
    expect([q.numerator, q.denominator]).toEqual([-1n, 6n]);
    expect(() => x.divide(zero)).toThrow('Division by zero');
  });

  it('is exact where float arithmetic is not (1/10 * 3 / 3)', () => {
    const r = new Fraction(1n, 10n).multiply(new Fraction(3n)).divide(new Fraction(3n));
    expect([r.numerator, r.denominator]).toEqual([1n, 10n]);
  });
});

describe('Fraction negate / abs / inverse / pow vs a BigInt reference', () => {
  it('negate, abs and inverse stay reduced and match the reference', () => {
    const next = rng(99);
    for (let i = 0; i < 500; i++) {
      const x = randFraction(next);
      const neg = x.negate();
      expect([neg.numerator, neg.denominator]).toEqual(refReduce(-x.numerator, x.denominator));
      const abs = x.abs();
      expect([abs.numerator, abs.denominator]).toEqual(
        refReduce(x.numerator < 0n ? -x.numerator : x.numerator, x.denominator)
      );
      expectReduced(neg);
      expectReduced(abs);
      if (x.numerator !== 0n) {
        const inv = x.inverse();
        expect([inv.numerator, inv.denominator]).toEqual(refReduce(x.denominator, x.numerator));
        expectReduced(inv);
      }
    }
    expect(() => new Fraction(0n).inverse()).toThrow('Cannot invert zero');
  });

  it('pow matches repeated multiplication for exponents -6..9', () => {
    const next = rng(2024);
    for (let i = 0; i < 200; i++) {
      const x = randFraction(next);
      for (let e = -6; e <= 9; e++) {
        if (x.numerator === 0n && e < 0) continue;
        let [n, d] = [1n, 1n];
        const base: [bigint, bigint] =
          e < 0 ? refReduce(x.denominator, x.numerator) : [x.numerator, x.denominator];
        for (let k = 0; k < Math.abs(e); k++) [n, d] = refReduce(n * base[0], d * base[1]);
        const r = x.pow(e);
        expect([r.numerator, r.denominator]).toEqual([n, d]);
        expectReduced(r);
      }
    }
  });

  it('pow accepts bigint exponents and handles 0 and negative bases', () => {
    expect(new Fraction(-2n, 3n).pow(3n).toString()).toBe(new Fraction(-8n, 27n).toString());
    expect(new Fraction(-2n, 3n).pow(2).toString()).toBe(new Fraction(4n, 9n).toString());
    expect(new Fraction(0n).pow(0).toString()).toBe('1');
    expect(new Fraction(0n).pow(5).toString()).toBe('0');
    expect(new Fraction(-1n).pow(-3).toString()).toBe('-1');
    expect(() => new Fraction(0n).pow(-1)).toThrow('Cannot invert zero');
  });

  it('pow throws a TypeError, not a bare RangeError, for a non-integer exponent', () => {
    for (const bad of [0.5, -1.5, Number.NaN, Infinity]) {
      expect(() => new Fraction(2n, 3n).pow(bad)).toThrow(TypeError);
      expect(() => new Fraction(2n, 3n).pow(bad)).toThrow(/exponent must be an integer/);
    }
  });
});
