import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { create, all } from '../src/index.js';

const math = create(all);

describe('mathjs 15.3.0 arithmetic dispatch parity (#1787)', () => {
  it('addScalar merges numeric strings with fractions', () => {
    expect(math.add('2', math.fraction(3)).toString()).toBe('5');
    expect(math.add(math.fraction(3), '2').toString()).toBe('5');
  });

  it('subtractScalar keeps decimal.js operand order with BigNumber', () => {
    expect(
      (math.subtractScalar as (a: unknown, b: unknown) => { toString(): string })(
        new math.BigNumber(0.2),
        Decimal(0.1)
      ).toString()
    ).toBe('0.1');
  });

  it('multiply routes scalar×unit through unit.multiply and fraction magnitudes', () => {
    expect(math.multiply(2, math.unit('5 mm')).toString()).toBe('10 mm');
    expect(math.multiply(2n, math.unit('5 mm')).toString()).toBe('10 mm');
    expect(math.multiply(3, math.unit(math.fraction(1, 4), 'm')).toString()).toBe('3/4 m');
  });

  it('divide inverts units with fraction magnitudes', () => {
    expect(math.divide(10, math.unit(math.fraction(4), 'mg/s')).toString()).toBe('5/2 s / mg');
    expect(math.divide(math.fraction(10), math.unit(4, 'mg/s')).toString()).toBe('5/2 s / mg');
  });

  it('log matches decimal.js ln at instance precision', () => {
    const bigmath = math.create({ precision: 100 });
    expect(bigmath.log(bigmath.bignumber(2)).toString()).toBe(
      '0.6931471805599453094172321214581765680755001343602552541206800094933936219696947156058633269964186875'
    );
  });

  it('norm with p=0 is +Infinity for finite vectors', () => {
    expect(math.norm([1, 2, 3], 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
