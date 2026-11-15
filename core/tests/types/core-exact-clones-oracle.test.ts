/**
 * Clone consolidation batch H (M11, M12): hard-coded oracles from the pre-merge
 * Fraction.add/subtract and BigNumber sin/cos Taylor paths (default precision 64).
 */
import { describe, it, expect } from 'vitest';
import type { Scalar } from '../../src/types/interfaces';
import { Fraction } from '../../src/types/fraction';
import { BigNumber } from '../../src/types/bignumber';

function expectFractionEquals(result: Fraction, n: bigint, d: bigint): void {
  expect(result.numerator).toBe(n);
  expect(result.denominator).toBe(d);
}

describe('M11 oracle — Fraction.add / subtract', () => {
  it('same denominator (add and subtract)', () => {
    expectFractionEquals(new Fraction(1n, 6n).add(new Fraction(5n, 6n)), 1n, 1n);
    expectFractionEquals(new Fraction(5n, 6n).subtract(new Fraction(1n, 6n)), 2n, 3n);
  });

  it('coprime denominators', () => {
    expectFractionEquals(new Fraction(1n, 3n).add(new Fraction(1n, 4n)), 7n, 12n);
    expectFractionEquals(new Fraction(1n, 3n).subtract(new Fraction(1n, 4n)), 1n, 12n);
  });

  it('negative numerators', () => {
    expectFractionEquals(new Fraction(-1n, 2n).add(new Fraction(1n, 3n)), -1n, 6n);
    expectFractionEquals(new Fraction(-1n, 2n).subtract(new Fraction(1n, 3n)), -5n, 6n);
  });

  it('coerces a number operand', () => {
    expectFractionEquals(new Fraction(1n, 4n).add(2 as unknown as Scalar), 9n, 4n);
    expectFractionEquals(new Fraction(9n, 4n).subtract(2 as unknown as Scalar), 1n, 4n);
  });

  it('coerces a bigint operand', () => {
    expectFractionEquals(new Fraction(1n, 2n).add(3n as unknown as Scalar), 7n, 2n);
    expectFractionEquals(new Fraction(7n, 2n).subtract(3n as unknown as Scalar), 1n, 2n);
  });

  it('1/2 − 1/2 = 0', () => {
    expectFractionEquals(new Fraction(1n, 2n).subtract(new Fraction(1n, 2n)), 0n, 1n);
  });
});

describe('M12 oracle — BigNumber.sin / cos (Taylor via public API)', () => {
  it('sin(0) and cos(0)', () => {
    expect(BigNumber.fromNumber(0).sin().toString()).toBe('0');
    expect(BigNumber.fromNumber(0).cos().toString()).toBe('1');
  });

  it('sin(π/2) and cos(π/2) at default precision', () => {
    // A 51-digit π literal, so cos(halfPi) is about 2.9e-51 and the series must cancel to that value.
    const halfPi = BigNumber.parse('3.14159265358979323846264338327950288419716939937510').divide(
      2
    );
    expect(halfPi.sin().toString()).toBe('1');
    // cos(halfPi) is about 2.9e-51. The value comes from
    // a sum near 1, so the error bound is absolute: 64 digits plus guard digits give < 1e-72.
    // Reference from mpmath at 200 digits (#1043; the earlier pinned string was wrong from digit 12).
    const reference = BigNumber.parse(
      '2.910487472296153908203143104499314017412671058533991074043256641e-51'
    );
    expect(halfPi.cos().subtract(reference).abs().lessThan(BigNumber.parse('1e-72'))).toBe(true);
  });

  it('negative angle', () => {
    expect(BigNumber.fromNumber(-0.1).sin().toString()).toBe(
      '-0.09983341664682815230681419841062202698991538801798225999276686156'
    );
    expect(BigNumber.fromNumber(-0.1).cos().toString()).toBe(
      '0.9950041652780257660955619878038702948385762254150840359593527447'
    );
  });

  it('tiny angle (early series convergence)', () => {
    const tiny = BigNumber.fromNumber(1e-30);
    expect(tiny.sin().toString()).toBe(
      '0.0000000000000000000000000000009999999999999999999999999999999999999999999999999999999999998333'
    );
    expect(tiny.cos().toString()).toBe(
      '0.9999999999999999999999999999999999999999999999999999999999995'
    );
  });
});
