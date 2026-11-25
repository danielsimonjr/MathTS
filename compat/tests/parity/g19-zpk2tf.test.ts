import { describe, it } from 'vitest';
import { expectSame } from './differential.js';

/**
 * #1589 — `zpk2tf` of a 2-D matrix produced `NaN + NaNi` where the mathjs 15.3.0 oracle
 * produces `Infinity + Infinityi`. The polynomial product code is identical in both
 * implementations; the difference is the complex product itself: mathjs multiplies
 * Complex values through complex.js `mul`, which treats a NaN operand as infinite
 * (`finite × NaN → Infinity + Infinityi`, `Infinity × 0 → NaN`), while compat propagated
 * plain IEEE NaN. The fix aligns the product used to build the polynomial with the
 * complex.js semantics the oracle uses; the 1-D result must stay unchanged.
 */
describe('zpk2tf parity (#1589)', () => {
  it('2-D Matrix arguments match the oracle on both rows', () => {
    expectSame('zpk2tf(matrix([[1,2],[3,4]]), matrix([[5,6],[7,8]]))', {}, (L) =>
      (L.zpk2tf as (z: unknown, p: unknown) => unknown)(
        (L.matrix as (v: unknown) => unknown)([
          [1, 2],
          [3, 4],
        ]),
        (L.matrix as (v: unknown) => unknown)([
          [5, 6],
          [7, 8],
        ])
      )
    );
  });

  it('the 1-D result is unchanged', () => {
    expectSame('zpk2tf([1,2],[-1,-2],1)', {}, (L) =>
      (L.zpk2tf as (z: unknown, p: unknown, k?: unknown) => unknown)([1, 2], [-1, -2], 1)
    );
  });
});
