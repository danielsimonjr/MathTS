import { describe, it, expect } from 'vitest';
import {
  isSquarefree,
  radical,
  bigOmega,
  smallOmega,
  liouvilleLambda,
  vonMangoldt,
  mertens,
  isPerfect,
  isPerfectPower,
  isPrimePower,
  integerSqrt,
  integerNthRoot,
  digitSum,
  digitalRoot,
  collatzSteps,
  primorial,
} from '../src/numbertheory/arithmetic-functions.js';

describe('arithmetic functions', () => {
  it('squarefree, radical and Omega counts', () => {
    expect(radical(360)).toBe(30);
    expect(isSquarefree(30)).toBe(true);
    expect(isSquarefree(12)).toBe(false);
    expect(bigOmega(12)).toBe(3);
    expect(smallOmega(12)).toBe(2);
    expect(liouvilleLambda(12)).toBe(-1);
  });
  it('von Mangoldt and Mertens', () => {
    expect(vonMangoldt(8)).toBeCloseTo(0.6931471805599453, 12);
    expect(vonMangoldt(6)).toBe(0);
    expect(mertens(10)).toBe(-1);
  });
  it('perfect numbers', () => {
    expect(isPerfect(28)).toBe(true);
    expect(isPerfect(12)).toBe(false);
  });
  it('perfect powers and prime powers', () => {
    expect(isPerfectPower(64)).toEqual({ base: 2, exp: 6 });
    expect(isPerfectPower(12)).toBeNull();
    expect(isPrimePower(27)).toEqual({ p: 3, k: 3 });
    expect(isPrimePower(12)).toBeNull();
  });
  it('exact integer roots', () => {
    expect(integerSqrt(10n ** 40n)).toBe(10n ** 20n);
    expect(integerSqrt(10n)).toBe(3n);
    expect(integerNthRoot(1001n, 3)).toBe(10n);
    expect(integerNthRoot(10n ** 30n, 3)).toBe(10n ** 10n);
  });
  it('digit sums and roots', () => {
    expect(digitSum(12345)).toBe(15);
    expect(digitSum(255, 16)).toBe(30);
    expect(digitalRoot(12345)).toBe(6);
    expect(digitalRoot(0)).toBe(0);
  });
  it('Collatz steps and primorial', () => {
    expect(collatzSteps(27)).toBe(111);
    expect(primorial(7)).toBe(210n);
    expect(primorial(1)).toBe(1n);
  });
});
