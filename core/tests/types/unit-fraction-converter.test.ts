import { describe, expect, it } from 'vitest';
import { BigNumber } from '../../src/types/bignumber.js';
import { Fraction } from '../../src/types/fraction.js';
import { Unit } from '../../src/types/unit.js';

describe('Unit.typeConverters.BigNumber (#1551)', () => {
  it('converts a MathTS Fraction through numerator/denominator', () => {
    const convert = Unit.typeConverters.BigNumber;
    const third = convert(new Fraction(1n, 3n) as never) as BigNumber;
    expect(third.toString()).toBe(new BigNumber('1').div('3').toString());
    const neg = convert(new Fraction(-5n, 2n) as never) as BigNumber;
    expect(neg.toString()).toBe(new BigNumber('-5').div('2').toString());
  });

  it('does not read fraction.js n/d/s fields', () => {
    const convert = Unit.typeConverters.BigNumber;
    const fake = {
      isFraction: true,
      n: undefined,
      d: undefined,
      s: undefined,
      numerator: 2n,
      denominator: 5n,
    };
    expect((convert(fake as never) as BigNumber).toString()).toBe(
      new BigNumber('2').div('5').toString()
    );
  });
});
