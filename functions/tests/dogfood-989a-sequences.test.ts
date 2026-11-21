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
  egyptianFraction,
  eulerianNumber,
  eulerNumbers,
  eulerPolynomial,
  fallingFactorial,
  fareySequence,
  harmonicNumber,
  integerPartitionsGen,
  integerSqrt,
  lahNumber,
  lucasL,
  mertens,
  motzkin,
  narayana,
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
    expect(bernoulli(652)).toBe(-Infinity);
    expect(bernoulli(1000)).toBe(-Infinity);
  });

  it('harmonicNumber uses the asymptotic series above 100 [slow]', () => {
    const exact = 35.11599205981222; // mpmath harmonic(10**15)
    expect(Math.abs((harmonicNumber(1e15) as number) - exact) / exact).toBeLessThan(1e-13);
    const big = harmonicNumber(1e308) as number;
    expect(Math.abs(big - (Math.log(1e308) + 0.5772156649015329))).toBeLessThan(1e-9);
    // mpmath harmonic(n), absolute error 4e-15 (one ulp is 3.6e-15 at 17)
    expect(Math.abs((harmonicNumber(101) as number) - 5.19727850773863)).toBeLessThan(4e-15);
    expect(Math.abs((harmonicNumber(1e6) as number) - 14.392726722865724)).toBeLessThan(4e-15);
    expect(Math.abs((harmonicNumber(2e7) as number) - 17.3884585214198)).toBeLessThan(4e-15);
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

  it('gives the sign and the zero of the remaining factors once the product is infinite [slow]', () => {
    expect(fallingFactorial(5.5, 1e9)).toBe(Infinity);
    expect(fallingFactorial(5.5, 1e9 + 1)).toBe(-Infinity);
    expect(risingFactorial(-2e9 + 0.5, 1e9)).toBe(Infinity);
    expect(risingFactorial(-Infinity, 1e9 + 1)).toBe(-Infinity);
    expect(fallingFactorial(1e9, 2e9)).toBeNaN();
    expect(fallingFactorial(1e9 + 0.5, 2e9)).toBe(-Infinity);
    expect(fallingFactorial(Infinity, 1e9)).toBe(Infinity);
  });
});

describe('number theory with a huge argument (#989)', () => {
  it('divisors and divisorSigma bound sqrt(n) [slow]', () => {
    expect(() => divisors(1e308)).toThrow(/sqrt\(n\)/);
    expect(() => divisorSigma(1e308)).toThrow(/sqrt\(n\)/);
    const d = divisors(2 ** 53 + 2) as number[];
    expect(d.length).toBe(16);
    expect(d.slice(0, 6)).toEqual([1, 2, 17, 34, 858001, 1716002]);
    expect(() => divisorSigma(1e308, 2)).toThrow(RangeError);
    // The bound is 2e9 for sqrt(n): divisors(1e18 + 2 ** 10) returned 44 divisors before (14 s).
    expect(() => divisors(4.1e18)).toThrow(
      'divisors: sqrt(n) = 2024845673.1316588 exceeds the supported maximum of 2000000000'
    );
    expect(divisors(12)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(divisorSigma(12)).toBe(28);
  });

  it('prime and primePi use a segmented sieve with a bound [slow]', () => {
    expect(prime(5e6)).toBe(86028121);
    expect(primePi(1e8)).toBe(5761455);
    expect(() => prime(5e7)).toThrow(/sieve limit/);
    expect(() => primePi(1e308)).toThrow(/primePi: n = 1e\+308 exceeds/);
    expect(prime(7)).toBe(17);
    expect(primePi(2)).toBe(1);
    expect(prime(10)).toBe(29);
    expect(primePi(100)).toBe(25);
  });

  it('mertens uses a linear sieve and a bound [slow]', () => {
    expect(mertens(1e6)).toBe(212);
    expect(() => mertens(1e9)).toThrow(RangeError);
    expect(() => mertens(1e9)).toThrow(
      'mertens: n = 1000000000 exceeds the supported maximum of 100000000'
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
    const big = integerSqrt(1e308);
    expect(typeof big).toBe('bigint');
    expect(big.toString().length).toBe(155);
    expect(integerSqrt(1e30)).toBe(10n ** 15n);
    expect(integerSqrt(2.5)).toBe(1n);
    expect(integerSqrt(1)).toBe(1n);
    expect(() => integerSqrt(Infinity)).toThrow(/finite/);
    expect(() => integerSqrt(NaN)).toThrow(/finite/);
    expect(() => integerSqrt(-1)).toThrow(/non-negative/);
    expect(() => integerSqrt(-1n)).toThrow(RangeError);
  });

  it('pellSolve gives the fundamental solution and stops on a very long period', () => {
    expect(pellSolve(61)).toEqual({ x: 1766319049n, y: 226153980n });
    expect(pellSolve(2)).toEqual({ x: 3n, y: 2n });
    const s = pellSolve(1000000017)!;
    expect(s.x.toString().length).toBe(15570);
    expect(s.x * s.x - 1000000017n * s.y * s.y).toBe(1n);
  });

  it('pellSolve stops on a very long period [slow]', () => {
    expect(() => pellSolve(2 ** 53 - 1)).toThrow(
      `pellSolve: no solution within 100000 continued-fraction steps for d = ${2 ** 53 - 1}`
    );
  });

  it('combinations and the functions built on it stop at a huge argument [slow]', () => {
    // The typed combinations loops min(k, n - k) times, so a huge n ends at once and the
    // value (about 5e615) is Infinity. The number path of the former factory refused it (#1093).
    expect(composition(1e308, 3)).toBe(Infinity);
    expect(catalan(1e9)).toBe(Infinity);
    expect(catalan(2e7)).toBe(Infinity);
    expect(composition(3e7, 1.5e7)).toBe(Infinity);
    expect(combinations(10, 3)).toBe(120);
    expect(combinations(1e9, 5e8)).toBe(Infinity);
    expect(catalan(10)).toBe(16796);
  });

  it('list and table builders carry an order bound', () => {
    // From index 188 every even Euler number is NaN in double, and every odd one is 0.
    const e = eulerNumbers(4000);
    expect(e).toHaveLength(4001);
    expect(e[186]).toBe(-3.2455474583892485e306);
    expect(e[188]).toBeNaN();
    expect(e[3999]).toBe(0);
    expect(e[4000]).toBeNaN();
    expect(() => eulerNumbers(1e9)).toThrow(RangeError);
    expect(eulerNumbers(6)).toEqual([1, 0, -1, 0, 5, 0, -61]);
    expect(() => primorial(10_000_001)).toThrow(
      'primorial: n = 10000001 exceeds the supported maximum of 10000000'
    );
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
    // The sum is NaN from degree 262, so a degree above 10000 returns NaN at once.
    expect(bernoulliPolynomial(10001, 0.5)).toBeNaN();
    expect(eulerPolynomial(10001, 0.5)).toBeNaN();
    expect(bernoulliPolynomial(1e15, 2)).toBeNaN();
    expect(eulerPolynomial(1e15, 2)).toBeNaN();
    expect(bernoulliPolynomial(2, 0.5)).toBeCloseTo(-1 / 12, 14);
    expect(eulerPolynomial(2, 0.5)).toBe(-0.25);
  });
});

describe('sequences with a large n and a small k (#989)', () => {
  it('lahNumber returns Infinity when n - k is above 170 [slow]', () => {
    expect(lahNumber(5, 2)).toBe(240);
    expect(lahNumber(171, 1)).toBe(Infinity);
    expect(lahNumber(172, 1)).toBe(Infinity);
    expect(lahNumber(1e7, 3)).toBe(Infinity);
  });

  it('narayana returns Infinity when min(k, n + 1 - k) is 262 or more [slow]', () => {
    expect(narayana(5, 2)).toBe(10);
    expect(narayana(521, 261)).toBe(1.102075601799376e308);
    expect(narayana(523, 262)).toBe(Infinity);
    expect(narayana(1e7, 5e6)).toBe(Infinity);
  });

  it('eulerianNumber returns Infinity from n = 1024 for 1 <= k <= n - 2 [slow]', () => {
    expect(eulerianNumber(5, 2)).toBe(66);
    expect(eulerianNumber(1023, 1)).toBe(8.98846567431158e307);
    expect(eulerianNumber(1024, 1)).toBe(Infinity);
    expect(eulerianNumber(1024, 1023)).toBe(1);
    expect(eulerianNumber(1024, 0)).toBe(1);
    expect(eulerianNumber(1e9, 3)).toBe(Infinity);
  });

  it('egyptianFraction takes the whole part first and bounds it [slow]', () => {
    expect(egyptianFraction(4, 13)).toEqual([4, 18, 468]);
    expect(egyptianFraction(7, 3)).toEqual([1, 1, 3]);
    expect(() => egyptianFraction(1e7 + 1, 1)).toThrow(
      'egyptianFraction: floor(p / q) = 10000001 exceeds the supported maximum of 10000000'
    );
    expect(() => egyptianFraction(2 ** 53 - 1, 3)).toThrow(RangeError);
  });
});
