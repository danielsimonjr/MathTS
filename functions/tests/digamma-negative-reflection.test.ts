/* eslint-disable no-loss-of-precision -- the oracle values are written at the 17 digits that
   mpmath prints; each one rounds to the nearest double, which is the value the test pins. */
/**
 * digamma next to a negative integer. The reflection used Math.tan(Math.PI * -x): Math.PI * -x
 * rounds by ulp(pi x), and tan there is about pi times the distance to the pole, so the old form
 * lost log10(x / distance) digits (3.7e-6 at -10.0000000001). The exact reduction of sinPiScalar
 * and cosPiScalar keeps them. Oracle: mpmath 1.3.0 on the exact doubles.
 */
import { describe, it, expect } from 'vitest';
import { digamma } from '../src/typed/special.js';

// [x, digamma(x)]
const ROWS: Array<[number, number]> = [
  [-1.0000001, 10000000.4169454],
  [-2.0000001, 10000000.939149834],
  [-3.000000001, 999999918.51575351],
  [-10.0000000001, 9999999174.9481106],
  [-100.00000001, 100000067.39043771],
];

describe('digamma at a negative argument next to an integer', () => {
  it.each(ROWS)('digamma(%s) is within 1e-14', (x, want) => {
    const got = digamma(x) as number;
    expect(Math.abs(got - want) / Math.abs(want)).toBeLessThanOrEqual(1e-14);
  });
});
