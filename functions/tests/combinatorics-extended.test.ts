/**
 * Number Theory & Extended Combinatorics Tests
 */

import { describe, it, expect } from 'vitest';
import {
  prime,
  nextPrime,
  primePi,
  primeFactors,
  divisors,
  eulerPhi,
  divisorSigma,
  carmichaelLambda,
  moebiusMu,
  jacobiSymbol,
  chineseRemainder,
  lucasL,
  partitions,
  harmonicNumber,
  integerDigits,
} from '../src/typed/combinatorics.js';

describe('Number Theory & Extended Combinatorics', () => {
  // ===========================================================================
  // prime
  // ===========================================================================
  describe('prime', () => {
    it('should return the 1st prime', () => {
      expect(prime(1)).toBe(2);
    });

    it('should return the 4th prime', () => {
      expect(prime(4)).toBe(7);
    });

    it('should return the 10th prime', () => {
      expect(prime(10)).toBe(29);
    });

    it('should return the 25th prime', () => {
      expect(prime(25)).toBe(97);
    });

    it('should throw for n < 1', () => {
      expect(() => prime(0)).toThrow();
    });
  });

  // ===========================================================================
  // nextPrime
  // ===========================================================================
  describe('nextPrime', () => {
    it('should return 2 for n=0', () => {
      expect(nextPrime(0)).toBe(2);
    });

    it('should return 2 for n=1', () => {
      expect(nextPrime(1)).toBe(2);
    });

    it('should return 5 for n=4', () => {
      expect(nextPrime(4)).toBe(5);
    });

    it('should return 11 for n=7', () => {
      expect(nextPrime(7)).toBe(11);
    });

    it('should return 11 for n=10', () => {
      expect(nextPrime(10)).toBe(11);
    });
  });

  // ===========================================================================
  // primePi
  // ===========================================================================
  describe('primePi', () => {
    it('should return 0 for n < 2', () => {
      expect(primePi(1)).toBe(0);
    });

    it('should return 4 for n=10', () => {
      expect(primePi(10)).toBe(4);
    });

    it('should return 25 for n=100', () => {
      expect(primePi(100)).toBe(25);
    });

    it('should return 1 for n=2', () => {
      expect(primePi(2)).toBe(1);
    });
  });

  // ===========================================================================
  // primeFactors
  // ===========================================================================
  describe('primeFactors', () => {
    it('should factorize 12', () => {
      expect(primeFactors(12)).toEqual([2, 2, 3]);
    });

    it('should factorize 60', () => {
      expect(primeFactors(60)).toEqual([2, 2, 3, 5]);
    });

    it('should factorize prime 7', () => {
      expect(primeFactors(7)).toEqual([7]);
    });

    it('should factorize 2', () => {
      expect(primeFactors(2)).toEqual([2]);
    });

    it('should throw for n < 2', () => {
      expect(() => primeFactors(1)).toThrow();
    });
  });

  // ===========================================================================
  // divisors
  // ===========================================================================
  describe('divisors', () => {
    it('should find divisors of 12', () => {
      expect(divisors(12)).toEqual([1, 2, 3, 4, 6, 12]);
    });

    it('should find divisors of 7 (prime)', () => {
      expect(divisors(7)).toEqual([1, 7]);
    });

    it('should find divisors of 1', () => {
      expect(divisors(1)).toEqual([1]);
    });

    it('should throw for n < 1', () => {
      expect(() => divisors(0)).toThrow();
    });
  });

  // ===========================================================================
  // eulerPhi
  // ===========================================================================
  describe('eulerPhi', () => {
    it('should return 1 for n=1', () => {
      expect(eulerPhi(1)).toBe(1);
    });

    it('should return 4 for n=10', () => {
      expect(eulerPhi(10)).toBe(4);
    });

    it('should return 4 for n=12', () => {
      expect(eulerPhi(12)).toBe(4);
    });

    it('should return p-1 for prime p', () => {
      expect(eulerPhi(7)).toBe(6);
      expect(eulerPhi(13)).toBe(12);
    });
  });

  // ===========================================================================
  // divisorSigma
  // ===========================================================================
  describe('divisorSigma', () => {
    it('should compute sum of divisors (k=1)', () => {
      expect(divisorSigma(12)).toBe(28); // 1+2+3+4+6+12
    });

    it('should compute number of divisors (k=0)', () => {
      expect(divisorSigma(12, 0)).toBe(6);
    });

    it('should compute sum of squares of divisors (k=2)', () => {
      expect(divisorSigma(12, 2)).toBe(210); // 1+4+9+16+36+144
    });

    it('should work for prime', () => {
      expect(divisorSigma(7)).toBe(8); // 1+7
    });
  });

  // ===========================================================================
  // carmichaelLambda
  // ===========================================================================
  describe('carmichaelLambda', () => {
    it('should return 1 for n=1', () => {
      expect(carmichaelLambda(1)).toBe(1);
    });

    it('should return 1 for n=2', () => {
      expect(carmichaelLambda(2)).toBe(1);
    });

    it('should return 2 for n=8', () => {
      expect(carmichaelLambda(8)).toBe(2);
    });

    it('should return 4 for n=15', () => {
      expect(carmichaelLambda(15)).toBe(4);
    });

    it('should return p-1 for prime p', () => {
      expect(carmichaelLambda(7)).toBe(6);
    });
  });

  // ===========================================================================
  // moebiusMu
  // ===========================================================================
  describe('moebiusMu', () => {
    it('should return 1 for n=1', () => {
      expect(moebiusMu(1)).toBe(1);
    });

    it('should return -1 for prime', () => {
      expect(moebiusMu(2)).toBe(-1);
      expect(moebiusMu(3)).toBe(-1);
    });

    it('should return 0 for squared factor', () => {
      expect(moebiusMu(4)).toBe(0);
      expect(moebiusMu(12)).toBe(0);
    });

    it('should return 1 for product of 2 primes', () => {
      expect(moebiusMu(6)).toBe(1); // 2*3
    });

    it('should return -1 for product of 3 primes', () => {
      expect(moebiusMu(30)).toBe(-1); // 2*3*5
    });
  });

  // ===========================================================================
  // jacobiSymbol
  // ===========================================================================
  describe('jacobiSymbol', () => {
    it('should compute (1/n) = 1', () => {
      expect(jacobiSymbol(1, 3)).toBe(1);
      expect(jacobiSymbol(1, 7)).toBe(1);
    });

    it('should compute (2/7) = 1', () => {
      expect(jacobiSymbol(2, 7)).toBe(1);
    });

    it('should compute (7/15) = -1', () => {
      expect(jacobiSymbol(7, 15)).toBe(-1);
    });

    it('should return 0 when gcd > 1', () => {
      expect(jacobiSymbol(3, 9)).toBe(0);
    });

    it('should throw for even n', () => {
      expect(() => jacobiSymbol(1, 4)).toThrow();
    });
  });

  // ===========================================================================
  // chineseRemainder
  // ===========================================================================
  describe('chineseRemainder', () => {
    it('should solve CRT system', () => {
      // x === 2 (mod 3), x === 3 (mod 5), x === 2 (mod 7)
      expect(chineseRemainder([2, 3, 2], [3, 5, 7])).toBe(23);
    });

    it('should solve simple system', () => {
      // x === 1 (mod 2), x === 2 (mod 3)
      expect(chineseRemainder([1, 2], [2, 3])).toBe(5);
    });

    it('should throw for mismatched lengths', () => {
      expect(() => chineseRemainder([1], [2, 3])).toThrow();
    });
  });

  // ===========================================================================
  // lucasL
  // ===========================================================================
  describe('lucasL', () => {
    it('should return L(0) = 2', () => {
      expect(lucasL(0)).toBe(2);
    });

    it('should return L(1) = 1', () => {
      expect(lucasL(1)).toBe(1);
    });

    it('should return L(5) = 11', () => {
      expect(lucasL(5)).toBe(11);
    });

    it('should return L(10) = 123', () => {
      expect(lucasL(10)).toBe(123);
    });

    it('should throw for negative', () => {
      expect(() => lucasL(-1)).toThrow();
    });
  });

  // ===========================================================================
  // partitions
  // ===========================================================================
  describe('partitions', () => {
    it('should return p(0) = 1', () => {
      expect(partitions(0)).toBe(1);
    });

    it('should return p(4) = 5', () => {
      expect(partitions(4)).toBe(5);
    });

    it('should return p(5) = 7', () => {
      expect(partitions(5)).toBe(7);
    });

    it('should return p(10) = 42', () => {
      expect(partitions(10)).toBe(42);
    });

    it('should throw for negative', () => {
      expect(() => partitions(-1)).toThrow();
    });
  });

  // ===========================================================================
  // harmonicNumber
  // ===========================================================================
  describe('harmonicNumber', () => {
    it('should return H(1) = 1', () => {
      expect(harmonicNumber(1)).toBe(1);
    });

    it('should return H(4) ~ 2.0833', () => {
      expect(harmonicNumber(4)).toBeCloseTo(2.08333333, 5);
    });

    it('should return H(10) ~ 2.9290', () => {
      expect(harmonicNumber(10)).toBeCloseTo(2.928968, 4);
    });

    it('should throw for n < 1', () => {
      expect(() => harmonicNumber(0)).toThrow();
    });
  });

  // ===========================================================================
  // integerDigits
  // ===========================================================================
  describe('integerDigits', () => {
    it('should return digits of 123 in base 10', () => {
      expect(integerDigits(123)).toEqual([1, 2, 3]);
    });

    it('should return digits of 10 in base 2', () => {
      expect(integerDigits(10, 2)).toEqual([1, 0, 1, 0]);
    });

    it('should return digits of 255 in base 16', () => {
      expect(integerDigits(255, 16)).toEqual([15, 15]);
    });

    it('should return [0] for n=0', () => {
      expect(integerDigits(0)).toEqual([0]);
    });

    it('should throw for negative', () => {
      expect(() => integerDigits(-1)).toThrow();
    });

    it('should throw for base < 2', () => {
      expect(() => integerDigits(10, 1)).toThrow();
    });
  });
});
