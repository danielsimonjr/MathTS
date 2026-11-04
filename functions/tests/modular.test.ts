import { describe, it, expect } from 'vitest';
import {
  modPow,
  prevPrime,
  legendreSymbol,
  sqrtMod,
  isCarmichael,
} from '../src/numbertheory/modular.js';

describe('modPow', () => {
  it('computes modular exponentiation', () => {
    expect(modPow(2, 10, 1000)).toBe(24n);
    expect(modPow(3n, 200n, 50n)).toBe(3n ** 200n % 50n);
    expect(modPow(3n, 200n, 50n)).toBe(1n);
  });
  it('rejects negative exponents and non-positive moduli', () => {
    expect(() => modPow(2, -1, 7)).toThrow(RangeError);
    expect(() => modPow(2, 3, 0)).toThrow(RangeError);
  });
});

describe('prevPrime', () => {
  it('returns the largest prime strictly below n', () => {
    expect(prevPrime(10)).toBe(7);
    expect(prevPrime(3)).toBe(2);
  });
  it('throws for n <= 2', () => {
    expect(() => prevPrime(2)).toThrow(RangeError);
  });
});

describe('legendreSymbol', () => {
  it('matches the Legendre symbol for odd primes', () => {
    expect(legendreSymbol(2, 7)).toBe(1);
    expect(legendreSymbol(3, 7)).toBe(-1);
    expect(legendreSymbol(7, 7)).toBe(0);
  });
  it('rejects non-odd-prime moduli', () => {
    expect(() => legendreSymbol(2, 9)).toThrow(RangeError);
    expect(() => legendreSymbol(2, 2)).toThrow(RangeError);
  });
});

describe('sqrtMod', () => {
  it('returns the smallest square root, or null for non-residues', () => {
    expect(sqrtMod(2, 7)).toBe(3);
    expect(sqrtMod(10, 13)).toBe(6);
    expect(sqrtMod(3, 7)).toBeNull();
    expect(sqrtMod(0, 13)).toBe(0);
  });
  it('squares back to a for every residue mod 17', () => {
    for (let a = 1; a < 17; a++) {
      const r = sqrtMod(a, 17);
      if (r === null) continue;
      expect((r * r) % 17).toBe(a);
    }
  });
});

describe('isCarmichael', () => {
  it('follows Korselt criterion', () => {
    expect(isCarmichael(561)).toBe(true);
    expect(isCarmichael(560)).toBe(false);
    expect(isCarmichael(7)).toBe(false);
  });
});
