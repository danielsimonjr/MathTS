import { describe, it, expect } from 'vitest';
import {
  bernoulli,
  bernoulliPolynomial,
  catalan,
  combinations,
  composition,
  delannoy,
  divisors,
  divisorSigma,
  doubleFactorial,
  eulerNumbers,
  eulerPolynomial,
  fallingFactorial,
  fareySequence,
  harmonicNumber,
  integerPartitionsGen,
  integerSqrt,
  lucasL,
  mertens,
  motzkin,
  partitions,
  pell,
  pellSolve,
  prime,
  primePi,
  primorial,
  risingFactorial,
  schroder,
  subfactorial,
  tribonacci,
} from '../src/index.js';

// An integer sequence or a number-theory function with a huge argument returns its
// saturated value (Infinity, where the same function already returns Infinity for a
// smaller argument) or throws a RangeError. It never loops for ever (#989).
//
// A test name that holds "[slow]" marks a call that loops for ever, or allocates
// without a bound, in the code before the fix. The command that checks the failing
// state leaves those tests out with a name filter.

describe('saturated sequences (#989)', () => {
  it('lucasL returns Infinity above 1474 and the exact boundary value at 1474 [slow]', () => {
    expect(lucasL(1474)).toBe(1.1163020658834692e308);
    expect(lucasL(1475)).toBe(Infinity);
    expect(lucasL(1e308)).toBe(Infinity);
    expect(lucasL(10)).toBe(123);
  });

  it('subfactorial returns Infinity above 170 [slow]', () => {
    expect(subfactorial(170)).toBe(2.669854000908407e306);
    expect(subfactorial(171)).toBe(Infinity);
    expect(subfactorial(1e308)).toBe(Infinity);
    expect(subfactorial(5)).toBe(44);
  });

  it('doubleFactorial returns Infinity above 300 [slow]', () => {
    expect(doubleFactorial(300)).toBe(8.154414069380598e307);
    expect(doubleFactorial(301)).toBe(Infinity);
    expect(doubleFactorial(1e308)).toBe(Infinity);
    expect(doubleFactorial(7)).toBe(105);
  });

  it('motzkin, schroder, pell and tribonacci return Infinity above their last finite index [slow]', () => {
    expect(motzkin(654)).toBe(9.514687635986132e307);
    expect(motzkin(655)).toBe(Infinity);
    expect(motzkin(1e15)).toBe(Infinity);
    expect(schroder(407)).toBe(3.734401957554718e307);
    expect(schroder(408)).toBe(Infinity);
    expect(schroder(1e15)).toBe(Infinity);
    expect(pell(806)).toBe(1.1632080225582444e308);
    expect(pell(807)).toBe(Infinity);
    expect(pell(1e15)).toBe(Infinity);
    expect(tribonacci(1167)).toBe(1.2819914567367673e308);
    expect(tribonacci(1168)).toBe(Infinity);
    expect(tribonacci(1e15)).toBe(Infinity);
    expect(motzkin(4)).toBe(9);
    expect(pell(5)).toBe(29);
  });

  it('delannoy returns Infinity when both indices reach 405 [slow]', () => {
    expect(delannoy(404, 404)).toBe(5.461980098755548e307);
    expect(delannoy(405, 405)).toBe(Infinity);
    expect(delannoy(405, 2000)).toBe(Infinity);
    expect(delannoy(2000, 405)).toBe(Infinity);
    expect(delannoy(1e15, 1e15)).toBe(Infinity);
    expect(delannoy(3, 3)).toBe(63);
  });

  it('partitions returns Infinity from 79446 [slow]', () => {
    expect(partitions(1e6)).toBe(Infinity);
    expect(partitions(100)).toBe(190569292);
  });

  it('bernoulli returns the signed Infinity above 258 [slow]', () => {
    expect(bernoulli(1e6)).toBe(-Infinity);
    expect(bernoulli(1e6 + 2)).toBe(Infinity);
    expect(bernoulli(1e308)).toBe(-Infinity);
    expect(bernoulli(260)).toBe(-Infinity);
    expect(bernoulli(262)).toBe(Infinity);
    expect(bernoulli(1e6 + 1)).toBe(0);
    expect(bernoulli(20)).toBe(-529.1242424242421);
  });

  it('harmonicNumber uses the asymptotic series above 1e7 [slow]', () => {
    const exact = 35.11599205981222; // mpmath harmonic(10**15)
    expect(Math.abs((harmonicNumber(1e15) as number) - exact) / exact).toBeLessThan(1e-13);
    const big = harmonicNumber(1e308) as number;
    expect(Math.abs(big - (Math.log(1e308) + 0.5772156649015329))).toBeLessThan(1e-9);
    // the series and the sum agree at the switch
    const sum = harmonicNumber(1e7) as number;
    expect(Math.abs((harmonicNumber(1e7 + 1) as number) - sum - 1 / (1e7 + 1))).toBeLessThan(1e-9);
    expect(harmonicNumber(4)).toBeCloseTo(2.0833333333333335, 14);
  });
});

describe('rising and falling factorial (#989)', () => {
  it('keeps the value that the full product gives', () => {
    expect(risingFactorial(3, 4)).toBe(360);
    expect(fallingFactorial(5, 3)).toBe(60);
    expect(risingFactorial(2, 1e9)).toBe(Infinity);
    expect(fallingFactorial(5, 1e9)).toBe(0);
    expect(Object.is(fallingFactorial(5, 6), 0)).toBe(true);
    expect(Object.is(fallingFactorial(5, 7), -0)).toBe(true);
    expect(Object.is(fallingFactorial(5, 8), 0)).toBe(true);
    expect(Object.is(risingFactorial(-3, 1e9), -0)).toBe(true);
    expect(risingFactorial(NaN, 1e9)).toBeNaN();
  });

  it('throws when the product has not settled within the bound', () => {
    expect(() => risingFactorial(-Infinity, 1e9)).toThrow(RangeError);
    expect(() => risingFactorial(-Infinity, 1e9)).toThrow(
      'risingFactorial: n = 1000000000 exceeds the supported maximum of 10000000'
    );
    expect(() => fallingFactorial(Infinity, 1e9)).not.toThrow();
  });
});

describe('number theory with a huge argument (#989)', () => {
  it('divisors and divisorSigma need a safe integer [slow]', () => {
    expect(() => divisors(1e308)).toThrow(/safe integer/);
    expect(() => divisorSigma(1e308)).toThrow(/safe integer/);
    expect(() => divisorSigma(1e308, 2)).toThrow(RangeError);
    expect(divisors(12)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(divisorSigma(12)).toBe(28);
  });

  it('prime and primePi bound the sieve', () => {
    expect(() => prime(5e6)).toThrow(/prime: result too large/);
    expect(() => primePi(1e308)).toThrow(/primePi: result too large/);
    expect(prime(10)).toBe(29);
    expect(primePi(100)).toBe(25);
  });

  it('mertens uses a linear sieve and a bound [slow]', () => {
    expect(mertens(1e6)).toBe(212);
    expect(() => mertens(1e9)).toThrow(RangeError);
    expect(() => mertens(1e9)).toThrow(
      'mertens: n = 1000000000 exceeds the supported maximum of 10000000'
    );
    const direct = [1, 0, -1, -1, -2, -1, -2, -2, -2, -1, -2, -2, -3];
    direct.forEach((m, i) => expect(mertens(i + 1)).toBe(m));
  });

  it('integerSqrt is exact for big values [slow]', () => {
    expect(integerSqrt(10n ** 60n)).toBe(10n ** 30n);
    expect(integerSqrt(10n ** 60n - 1n)).toBe(10n ** 30n - 1n);
    expect(integerSqrt(16)).toBe(4n);
    expect(integerSqrt(16n)).toBe(4n);
    expect(integerSqrt(0n)).toBe(0n);
    expect(() => integerSqrt(1e308)).toThrow(/safe integer/);
    expect(() => integerSqrt(-1n)).toThrow(RangeError);
  });

  it('pellSolve gives the fundamental solution and stops on a very long period', () => {
    expect(pellSolve(61)).toEqual({ x: 1766319049n, y: 226153980n });
    expect(pellSolve(2)).toEqual({ x: 3n, y: 2n });
    expect(() => pellSolve(1000000017)).toThrow(
      'pellSolve: no solution within 20000 continued-fraction steps for d = 1000000017'
    );
  }, 30_000); // the 20000-step bound takes about 4 s: the bigint grows by about 1.18 nats per step

  it('combinations and the functions built on it stop at a huge argument [slow]', () => {
    expect(() => composition(1e308, 3)).toThrow(RangeError);
    expect(() => catalan(1e9)).toThrow(RangeError);
    expect(combinations(10, 3)).toBe(120);
    expect(combinations(1e9, 5e8)).toBe(Infinity);
    expect(catalan(10)).toBe(16796);
  });

  it('list and table builders carry an order bound', () => {
    expect(() => eulerNumbers(1001)).toThrow(
      'eulerNumbers: n = 1001 exceeds the supported maximum of 1000'
    );
    expect(eulerNumbers(6)).toEqual([1, 0, -1, 0, 5, 0, -61]);
    expect(() => primorial(1_000_001)).toThrow(RangeError);
    expect(primorial(10)).toBe(210n);
    expect(() => integerPartitionsGen(71)).toThrow(
      'integerPartitionsGen: n = 71 exceeds the supported maximum of 70'
    );
    expect(integerPartitionsGen(4)).toEqual([[4], [3, 1], [2, 2], [2, 1, 1], [1, 1, 1, 1]]);
    expect(() => fareySequence(1e6)).toThrow(/fareySequence: result too large/);
    expect(fareySequence(3)).toEqual([
      [0, 1],
      [1, 3],
      [1, 2],
      [2, 3],
      [1, 1],
    ]);
    expect(() => bernoulliPolynomial(10001, 0.5)).toThrow(
      'bernoulliPolynomial: n = 10001 exceeds the supported maximum of 10000'
    );
    expect(() => eulerPolynomial(10001, 0.5)).toThrow(
      'eulerPolynomial: n = 10001 exceeds the supported maximum of 10000'
    );
    expect(bernoulliPolynomial(2, 0.5)).toBeCloseTo(-1 / 12, 14);
    expect(eulerPolynomial(2, 0.5)).toBe(-0.25);
  });
});
