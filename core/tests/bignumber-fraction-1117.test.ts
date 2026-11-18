import { describe, it, expect } from 'vitest';
import { BigNumber, Fraction } from '../src/index.js';

describe('#1117 a Fraction operand of a BigNumber method keeps the BigNumber precision', () => {
  it('BigNumber.add(Fraction) and Fraction conversion by the typed bridge', () => {
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
});
