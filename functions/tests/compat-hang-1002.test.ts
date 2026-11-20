import { describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

/**
 * #1002: gcd and lcm of a BigNumber that is not an integer (NaN, Infinity, 0.1) never ended,
 * nthRoot of a BigNumber with root 0 returned a value, and permutations(n, k) with n above
 * 2^53 never ended because `i++` does not change i. mathjs 15.2.0 throws on the first three.
 */
type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const b = (v: string | number): BigNumber => new BigNumber(v);
const GCD = 'Parameters in function gcd must be integer numbers';
const LCM = 'Parameters in function lcm must be integer numbers';

describe('#1002 gcd and lcm of a BigNumber that is not an integer', () => {
  it('gcd(NaN, BigNumber 0.1) throws as mathjs does', () => {
    expect(() => fn('gcd')(NaN, b('0.1'))).toThrow(GCD);
  });
  it('lcm(NaN, BigNumber 0.1) throws as mathjs does', () => {
    expect(() => fn('lcm')(NaN, b('0.1'))).toThrow(LCM);
  });
  it('gcd throws for a BigNumber NaN, Infinity or fraction', () => {
    expect(() => fn('gcd')(b(NaN), b(2))).toThrow(GCD);
    expect(() => fn('gcd')(b(Infinity), b(2))).toThrow(GCD);
    expect(() => fn('gcd')(b('0.1'), b(2))).toThrow(GCD);
    expect(() => fn('gcd')(b(2), b('0.1'))).toThrow(GCD);
  });
  it('lcm throws for a BigNumber NaN, Infinity or fraction', () => {
    expect(() => fn('lcm')(b(NaN), b(2))).toThrow(LCM);
    expect(() => fn('lcm')(b(Infinity), b(2))).toThrow(LCM);
    expect(() => fn('lcm')(b('0.1'), b(2))).toThrow(LCM);
  });
  it('integer BigNumbers keep their values', () => {
    expect(String(fn('gcd')(b(4), b(6)))).toBe('2');
    expect(String(fn('gcd')(b(4), 6))).toBe('2');
    expect(String(fn('gcd')(b(-4), b(6)))).toBe('2');
    expect(String(fn('lcm')(b(4), b(6)))).toBe('12');
    expect(String(fn('lcm')(b(0), b(6)))).toBe('0');
  });
});

describe('#1002 BigNumber.isInteger', () => {
  it('is false for NaN and Infinity, true for 0 and integers', () => {
    expect(b(NaN).isInteger()).toBe(false);
    expect(b(Infinity).isInteger()).toBe(false);
    expect(b(-Infinity).isInteger()).toBe(false);
    expect(b(0).isInteger()).toBe(true);
    expect(b(7).isInteger()).toBe(true);
    expect(b('0.1').isInteger()).toBe(false);
  });
});

describe('#1002 nthRoot with root 0', () => {
  it('throws "Root must be non-zero" for a BigNumber, as mathjs does', () => {
    for (const x of ['0.1', '1', '0']) {
      expect(() => fn('nthRoot')(b(x), 0)).toThrow('Root must be non-zero');
      expect(() => fn('nthRoot')(b(x), b(0))).toThrow('Root must be non-zero');
    }
  });
  it('keeps the number behaviour and the BigNumber values', () => {
    expect(() => fn('nthRoot')(0.1, 0)).toThrow('Root must be non-zero');
    expect(String(fn('nthRoot')(b(8), 3))).toBe('2');
    expect(String(fn('nthRoot')(b(8), b(3)))).toBe('2');
  });
});

describe('#1002 permutations with n above 2^53', () => {
  it('returns 1 for k = 0 where mathjs returns n (its n + 1 === n artefact)', () => {
    expect(fn('permutations')(1e308, 0)).toBe(1);
    expect(fn('permutations')(2 ** 53, 0)).toBe(1);
    expect(fn('permutations')(2 ** 53 + 2, 0)).toBe(1);
  });
  it('ends for k = 1 and 2', () => {
    expect(fn('permutations')(1e308, 1)).toBe(1e308);
    expect(fn('permutations')(1e308, 2)).toBe(Infinity);
  });
  it('ends when k is as large as n', () => {
    expect(fn('permutations')(1e308, 1e308)).toBe(Infinity);
    expect(fn('permutations')(1e15, 1e15)).toBe(Infinity);
  });
  it('keeps the exact small values', () => {
    expect(fn('permutations')(5, 0)).toBe(1);
    expect(fn('permutations')(5, 1)).toBe(5);
    expect(fn('permutations')(5, 3)).toBe(60);
    expect(fn('permutations')(5, 5)).toBe(120);
    expect(fn('permutations')(5)).toBe(120);
  });
});

describe('#1002 permutations above 2^53 and at the 170! edge (BigInt oracle)', () => {
  it('has one rounding per factor above 2^53', () => {
    expect(fn('permutations')(2 ** 53 + 2, 1)).toBe(9007199254740994);
    expect(fn('permutations')(2 ** 53 + 4, 3)).toBe(7.307508186654523e47);
    expect(fn('permutations')(2 ** 53, 1)).toBe(9007199254740992);
    expect(fn('permutations')(Number.MAX_VALUE, Number.MAX_VALUE)).toBe(Infinity);
  });
  it('is Infinity above k = 170 and exact below', () => {
    expect(fn('permutations')(171, 171)).toBe(Infinity);
    expect(fn('permutations')(200, 171)).toBe(Infinity);
    expect(fn('permutations')(170, 170)).toBe(7.257415615307994e306);
    expect(fn('permutations')(20, 10)).toBe(670442572800);
  });
});

describe('#1002 gcd and lcm of numbers that are not integers throw, as in mathjs', () => {
  const gcdMsg = 'Parameters in function gcd must be integer numbers';
  const lcmMsg = 'Parameters in function lcm must be integer numbers';
  it('gcd throws', () => {
    expect(() => fn('gcd')(NaN, 2)).toThrow(gcdMsg);
    expect(() => fn('gcd')(Infinity, 2)).toThrow(gcdMsg);
    expect(() => fn('gcd')(2.5, 3)).toThrow(gcdMsg);
    expect(() => fn('gcd')(0.1, 0.2)).toThrow(gcdMsg);
    expect(() => fn('gcd')([4, 6.5])).toThrow(gcdMsg);
    expect(() => fn('gcd')('2.5', 6)).toThrow(gcdMsg);
  });
  it('lcm throws', () => {
    expect(() => fn('lcm')(NaN, 2)).toThrow(lcmMsg);
    expect(() => fn('lcm')(2.5, 3)).toThrow(lcmMsg);
    expect(() => fn('lcm')(Infinity, 3)).toThrow(lcmMsg);
    expect(() => fn('lcm')(0, 2.5)).toThrow(lcmMsg);
  });
  it('integers keep their values', () => {
    expect(fn('gcd')(1e300, 6)).toBe(6);
    expect(fn('gcd')(-4, 6)).toBe(2);
    expect(fn('gcd')(0, 0)).toBe(0);
    expect(fn('gcd')(true, 2)).toBe(1);
    expect(fn('gcd')('4', 6)).toBe(2);
    expect(fn('lcm')(4, 6)).toBe(12);
    expect(fn('lcm')(0, 0)).toBe(0);
  });
});

describe('#1002 BigNumber isInteger is false for NaN and Infinity: dependent results match mathjs', () => {
  it('pow, gamma, factorial, format and gcd', () => {
    const p = fn('pow')(b(-2), b(NaN)) as { re: number };
    expect(Number.isNaN(p.re)).toBe(true);
    // mathjs gives Infinity here. #1291 gives NaN, as the number signature of both libraries does.
    expect(Number(fn('gamma')(b(NaN)))).toBeNaN();
    expect(Number(fn('factorial')(b(NaN)))).toBeNaN();
    expect(fn('format')(b(NaN), { notation: 'bin', wordSize: 8 })).toBe('NaN');
    expect(() => fn('gcd')(2n, b(0.1))).toThrow();
  });
});
