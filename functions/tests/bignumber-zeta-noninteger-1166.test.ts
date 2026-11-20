/**
 * #1166 item 1: the terms k^s of the Borwein sum of a BigNumber come from a table with one `pow`
 * for each prime k, and the other terms are products (the power is completely multiplicative).
 * A `pow` of a non-integer exponent costs an exp and a ln at the work precision, so `zeta(0.5)`
 * at precision 200 took 26 s with a `pow` for each k.
 *
 * Oracle: mpmath 1.3.0, rounded half up to 64 digits.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

type AnyFn = (...args: unknown[]) => unknown;
const zeta = (s: string): unknown =>
  ((f as unknown as Record<string, AnyFn>).zeta as AnyFn)(BigNumber.parse(s));

afterEach(() => BigNumber.resetConfig());

describe('zeta of a non-integer BigNumber at precision 64', () => {
  it.each([
    ['0.5', '-1.460354508809586812889499152515298012467229331012581490542886088'],
    ['1.5', '2.612375348685488343348567567924071630570800652400063407573328249'],
    ['2.5', '1.341487257250917179756769693348612136623037629505986511253796728'],
    ['0.1', '-0.6030375198562417152484319382634382079141478245521286336667126326'],
    ['1.0001', '10000.57722294643762907001858881490182432584561087533320508018211'],
    ['37.25', '1.000000000006118328362801379968042012562074970917531681314084157'],
  ])('zeta(%s)', { timeout: 20000 }, (s, expected) => {
    BigNumber.config({ precision: 64 });
    expect(String(zeta(s))).toBe(String(BigNumber.parse(expected)));
  });
});

describe('zeta of a non-integer BigNumber needs one ln for each prime term, not for each term', () => {
  // Precision 64 has 98 Borwein terms. The worker head calls ln 98 times (one pow for each term),
  // the table of prime powers calls it 26 times (25 primes up to 98, and 2^(1 - s)).
  it('calls ln at most 30 times at precision 64', () => {
    BigNumber.config({ precision: 64 });
    const spy = vi.spyOn(BigNumber.prototype as unknown as { ln: () => unknown }, 'ln');
    try {
      zeta('0.5');
      expect(spy.mock.calls.length).toBeLessThanOrEqual(30);
    } finally {
      spy.mockRestore();
    }
  });
});
