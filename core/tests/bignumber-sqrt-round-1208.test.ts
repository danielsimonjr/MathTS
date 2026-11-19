/**
 * #1208: `sqrt` rounded twice. Newton ran at the working precision, and the result then rounded
 * to the configured precision, so a root just below a power of ten, such as
 * sqrt(1 - 1e-20) = 0.99999999999999999999499..., came out as 1. Roots now come from an exact
 * integer root with a sticky digit, and round once, in the configured rounding mode.
 *
 * Oracle: decimal.js, whose sqrt and cbrt round the exact root once.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (v: string): BigNumber => BigNumber.parse(v);
const nines = (n: number): string => '9'.repeat(n);

afterEach(() => {
  BigNumber.resetConfig();
});

describe('BigNumber.sqrt rounds the exact root once (#1208)', () => {
  it.each([
    [20, '0.99999999999999999999', '0.99999999999999999999'],
    [5, '0.99999', '0.99999'],
    [64, '0.' + nines(64), '0.' + nines(64)],
    [400, nines(400) + 'e-400', '0.' + nines(400)],
  ])('precision %i: sqrt(%s) stays below 1', (precision, input, expected) => {
    BigNumber.config({ precision });
    expect(bn(input).sqrt().toString()).toBe(expected);
  });

  it('a root just above 1 and a root just below 10^k keep the digit count', () => {
    BigNumber.config({ precision: 20 });
    expect(bn('99.999999999999999999').sqrt().toString()).toBe('9.9999999999999999999');
    expect(bn('1.00000000000000000002').sqrt().toString()).toBe('1');
    expect(bn('1e-20').sqrt().toString()).toBe('0.0000000001');
  });

  it('an exact root rounds to itself and a half-way input rounds by the mode', () => {
    BigNumber.config({ precision: 3 });
    expect(bn('0.25').sqrt().toString()).toBe('0.5');
    expect(bn('1.5129').sqrt().toString()).toBe('1.23');
    BigNumber.config({ precision: 20, rounding: 'down' });
    expect(bn('2').sqrt().toString()).toBe('1.4142135623730950488');
    BigNumber.config({ precision: 20, rounding: 'up' });
    expect(bn('2').sqrt().toString()).toBe('1.4142135623730950489');
  });
});

describe('BigNumber.cbrt rounds the exact root once (#1208)', () => {
  it.each([
    [20, '0.99999999999999999999', '1'],
    [20, '0.999999999999999999999999999999', '1'],
    [5, '0.99999999', '1'],
    [20, '7.99999999999999999999', '2'],
    [20, '-0.99999999999999999999', '-1'],
  ])('precision %i: cbrt(%s)', (precision, input, expected) => {
    BigNumber.config({ precision });
    expect(bn(input).cbrt().toString()).toBe(expected);
  });

  it('a root just below 10^k, and negative values, round once', () => {
    BigNumber.config({ precision: 20 });
    expect(bn('0.99999999999999999999').cbrt().toString()).toBe('1');
    expect(bn('-8').cbrt().toString()).toBe('-2');
    BigNumber.config({ precision: 20, rounding: 'floor' });
    expect(bn('2').cbrt().toString()).toBe('1.2599210498948731647');
    expect(bn('-2').cbrt().toString()).toBe('-1.2599210498948731648');
  });
});

describe('BigNumber.cbrt in a directed mode (#1208)', () => {
  it('rounds the exact root, not a working-precision value', () => {
    BigNumber.config({ precision: 20, rounding: 'down' });
    expect(bn('0.99999999999999999999').cbrt().toString()).toBe('0.99999999999999999999');
    expect(bn('7.99999999999999999999').cbrt().toString()).toBe('1.9999999999999999999');
  });
});
