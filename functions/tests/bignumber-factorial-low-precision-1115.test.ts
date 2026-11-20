/**
 * #1115: `factorial` and `gamma` of a BigNumber with more digits than the precision. `add` and
 * `sub` round to the precision, so factorial(100000) at precision 5 was the factorial of
 * 100001 rounded to 100000 minus 1, that is 99999!, and a result with an exponent that was 5 too
 * low. The Stirling path (#1115) makes such an n practical.
 *
 * Oracle: mpmath 1.3.0, rounded half up to the precision.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

type AnyFn = (...args: unknown[]) => unknown;
const call = (name: string, n: string): unknown =>
  ((f as unknown as Record<string, AnyFn>)[name] as AnyFn)(BigNumber.parse(n));

afterEach(() => BigNumber.resetConfig());

describe('factorial and gamma of an n with more digits than the precision', () => {
  it.each([
    [5, 'factorial', '100000', '2.8242e+456573'],
    [5, 'factorial', '123456', '2.6041e+574964'],
    [5, 'factorial', '123456789', '2.8535e+945335859'],
    [5, 'gamma', '100002', '2.8243e+456578'],
    [5, 'gamma', '123457', '2.6041e+574964'],
    [10, 'factorial', '100000000000', '3.748928599e+1056570551815'],
    [10, 'factorial', '12345678901', '3.886855204e+119224943316'],
  ])('precision %i: %s(%s)', { timeout: 10000 }, (precision, name, n, expected) => {
    BigNumber.config({ precision });
    expect(String(call(name, n))).toBe(String(BigNumber.parse(expected)));
  });
});
