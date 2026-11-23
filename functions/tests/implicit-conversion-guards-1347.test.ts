import { mathTyped } from '@danielsimonjr/mathts-core';
import { all, create } from 'mathjs';
import { describe, expect, it } from 'vitest';
import {
  bignumber,
  dotPow,
  evaluate,
  fraction,
  larger,
  log,
  multiply,
  smaller,
} from '../src/index.js';

const oracle = create(all);

describe('#1347 guarded conversions for mixed scalar arguments', () => {
  it('prefers the BigNumber signature in the evaluator', () => {
    expect(String(evaluate('nthRoot(bignumber(8), 3)'))).toBe('2');
  });

  it('guards implicit BigNumber and Fraction conversion and keeps explicit construction', () => {
    expect(() => multiply(bignumber(5), 1 / 3)).toThrow(/>15 significant digits/);
    expect(() => mathTyped.convert(Math.PI, 'Fraction')).toThrow(/loss of precision/);
    expect(String(mathTyped.convert(5e-7, 'Fraction'))).toBe(String(oracle.fraction(5e-7)));
    expect(String(bignumber(1 / 3))).toBe('0.3333333333333333');
    expect(String(fraction(Math.PI))).toBeTruthy();
  });

  it('avoids forcing small mixed comparisons through Fraction', () => {
    expect(larger(fraction(2), 1e-17)).toBe(oracle.larger(oracle.fraction(2), 1e-17));
    expect(smaller(1e-17, fraction(2))).toBe(oracle.smaller(1e-17, oracle.fraction(2)));
  });

  it('preserves the complex log path for negative mixed arguments', () => {
    const x = -0.123456789123456;
    const expected = oracle.log(oracle.bignumber(2), x) as unknown as { re: number; im: number };
    const actual = log(bignumber(2), x) as { re: number; im: number };
    expect(actual.re).toBeCloseTo(expected.re, 14);
    expect(actual.im).toBeCloseTo(expected.im, 14);
  });

  it('rejects a mixed Fraction logarithm without changing other exact operands', () => {
    expect(() => (log as (a: unknown, b: unknown) => unknown)(fraction(2), 3)).toThrow(
      /Cannot implicitly convert a Fraction to BigNumber/
    );
    expect(String(dotPow(fraction(2), 3))).toBe('8');
  });

  it('accepts representable fractional exponents through the factory', () => {
    expect(dotPow(fraction(2), 5e-7)).toBeCloseTo(
      (oracle.dotPow as (a: unknown, b: number) => number)(oracle.fraction(2), 5e-7),
      14
    );
  });
});
