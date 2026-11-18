import { describe, it, expect } from 'vitest';
import { BigNumber, Fraction, createMathTSTyped } from '../src/index.js';

describe('#1117 a Fraction operand of a BigNumber method keeps the BigNumber precision', () => {
  it('BigNumber.add(Fraction) divides numerator by denominator in BigNumber', () => {
    const third = new Fraction(1n, 3n);
    const r = BigNumber.fromNumber(1).add(third as never);
    const exact = BigNumber.parse('1.' + '3'.repeat(70));
    expect(r.subtract(exact).abs().compareTo(BigNumber.parse('1e-60'))).toBeLessThan(0);
    const neg = BigNumber.fromNumber(1).add(new Fraction(-1n, 3n) as never);
    expect(
      neg
        .subtract(BigNumber.parse('0.' + '6'.repeat(70)))
        .abs()
        .compareTo(BigNumber.parse('1e-60'))
    ).toBeLessThan(0);
  });
  it('the typed bridge converts a Fraction argument of a BigNumber signature the same way', () => {
    const addBig = createMathTSTyped()('addBig', {
      'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.add(b),
    }) as (a: unknown, b: unknown) => BigNumber;
    const exact = BigNumber.parse('1.' + '3'.repeat(70));
    const tol = BigNumber.parse('1e-60');
    for (const r of [
      addBig(new Fraction(1n, 3n), BigNumber.fromNumber(1)),
      addBig(BigNumber.fromNumber(1), new Fraction(1n, 3n)),
    ]) {
      expect(r.subtract(exact).abs().compareTo(tol)).toBeLessThan(0);
    }
  });
  it('the conversion follows a precision above the default', () => {
    const saved = BigNumber.config().precision;
    try {
      BigNumber.config({ precision: 500 });
      const r = BigNumber.fromNumber(1).add(new Fraction(1n, 3n) as never);
      const exact = BigNumber.parse('1.' + '3'.repeat(520));
      expect(r.subtract(exact).abs().compareTo(BigNumber.parse('1e-490'))).toBeLessThan(0);
    } finally {
      BigNumber.config({ precision: saved });
    }
  });
});
