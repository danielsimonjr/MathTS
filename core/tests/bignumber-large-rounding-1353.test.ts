import { describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const exponent = 4000;
const decade = 10n ** BigInt(exponent);

describe('BigNumber rounding of large coefficients (#1353)', () => {
  it('rounds on both sides of a decimal digit-count boundary', () => {
    const below = BigNumber.fromBigInt(decade - 1n);
    const above = BigNumber.fromBigInt(decade + 1n);
    expect(below.roundToPrecision(3).equals(`1e${exponent}`)).toBe(true);
    expect(below.roundToPrecision(3, 'down').equals(`9.99e${exponent - 1}`)).toBe(true);
    expect(above.roundToPrecision(3).equals(`1e${exponent}`)).toBe(true);
    expect(above.roundToPrecision(3, 'up').equals(`1.01e${exponent}`)).toBe(true);
  });

  it('distinguishes either side of a tie at large scale', () => {
    const tie = (125n * decade) / 100n;
    expect(
      BigNumber.fromBigInt(tie - 1n)
        .roundToPrecision(2, 'halfEven')
        .equals(`1.2e${exponent}`)
    ).toBe(true);
    expect(
      BigNumber.fromBigInt(tie + 1n)
        .roundToPrecision(2, 'halfEven')
        .equals(`1.3e${exponent}`)
    ).toBe(true);
    expect(
      BigNumber.fromBigInt(-tie - 1n)
        .roundToPrecision(2, 'halfEven')
        .equals(`-1.3e${exponent}`)
    ).toBe(true);
  });
});
