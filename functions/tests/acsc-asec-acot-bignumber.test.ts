import { describe, it, expect } from 'vitest';
import { acsc, asec, acot } from '@danielsimonjr/mathts-functions';
import { BigNumber } from '@danielsimonjr/mathts-core';

/**
 * GC10 — close the internal inconsistency where the forward csc/sec/cot had a
 * BigNumber path but their inverses acsc/asec/acot did not. Each must agree with
 * the number path.
 *
 * Tolerance note: acsc/asec route through BigNumber.asin/acos, whose series is
 * accurate to ~11 digits at the default precision (a pre-existing core
 * characteristic), so they're checked at 10 digits; acot routes through the
 * tighter BigNumber.atan and is checked at 12.
 */
describe('GC10: acsc/asec/acot BigNumber path', () => {
  const cases = [2, 3, 1.5, -2, 5];

  it('acsc(BigNumber) matches acsc(number)', () => {
    for (const x of cases) {
      const big = acsc(BigNumber.fromNumber(x)) as BigNumber;
      expect(big.toNumber()).toBeCloseTo(acsc(x) as number, 10);
    }
  });

  it('asec(BigNumber) matches asec(number)', () => {
    for (const x of cases) {
      const big = asec(BigNumber.fromNumber(x)) as BigNumber;
      expect(big.toNumber()).toBeCloseTo(asec(x) as number, 10);
    }
  });

  it('acot(BigNumber) matches acot(number)', () => {
    for (const x of cases) {
      const big = acot(BigNumber.fromNumber(x)) as BigNumber;
      expect(big.toNumber()).toBeCloseTo(acot(x) as number, 12);
    }
  });
});
