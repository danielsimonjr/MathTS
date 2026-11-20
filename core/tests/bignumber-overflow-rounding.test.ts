/**
 * An add or a multiply of an operand with more digits than the precision, whose exact result is
 * above maxExponent, gave 0: `rounded()` rounded the zero coefficient of the Infinity that
 * `#allocate` returned. The result is Infinity, as for an operand that fits the precision.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

afterEach(() => BigNumber.resetConfig());

describe('overflow of an operand with more digits than the precision', () => {
  it('add and multiply give Infinity, not 0', () => {
    BigNumber.config({ precision: 64, maxExponent: 1000 });
    const wide = BigNumber.parse('9.' + '9'.repeat(70) + 'e1000');
    expect(String(wide.add(wide))).toBe('Infinity');
    expect(String(wide.mul(BigNumber.parse('3')))).toBe('Infinity');
    expect(String(wide.negate().add(wide.negate()))).toBe('-Infinity');
  });

  it('a result at the bound that rounds up to the bound stays finite and exact', () => {
    BigNumber.config({ precision: 5, maxExponent: 1000 });
    const wide = BigNumber.parse('9.99991234567e999');
    expect(String(wide.add(BigNumber.parse('1')))).toBe(String(BigNumber.parse('9.9999e999')));
    expect(String(wide.mul(BigNumber.parse('2')))).toBe(String(BigNumber.parse('2e1000')));
    expect(String(BigNumber.parse('9.9999999e999').add(BigNumber.parse('1e990')))).toBe(
      String(BigNumber.parse('1e1000'))
    );
  });
});
