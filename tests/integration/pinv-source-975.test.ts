/**
 * #975 item 4: `pinv` of a sparse matrix that holds Complex entries, under the root vitest config.
 *
 * The defect was `pinv: unexpected type` (`addScalar`): when two copies of the `Complex` class
 * are loaded, the typed dispatch tested Complex with `instanceof`, and an instance of the other
 * copy matched no signature. The cause was in core (#1033, closed), not in `pinv`. This test
 * builds the two-copy situation: `vi.resetModules()` clears the module registry, so the dynamic
 * import of the built core makes a second `Complex` class. The precondition test checks that the
 * two classes differ, so a pass of the second test proves the item.
 */
import { describe, it, expect, vi } from 'vitest';
import { Complex as ComplexFirstCopy } from '@danielsimonjr/mathts-core';
import { pinv, sparse } from '../../functions/src/index.js';

type Entry = { re: number; im: number };

async function secondCopyOfComplex(): Promise<typeof ComplexFirstCopy> {
  vi.resetModules();
  const second = await import('../../core/dist/index.js');
  return second.Complex as typeof ComplexFirstCopy;
}

describe('#975 item 4: pinv with a Complex from a second copy of core', () => {
  it('precondition: the Complex of the second copy is a different class', async () => {
    const Second = await secondCopyOfComplex();
    expect(Second).not.toBe(ComplexFirstCopy);
    expect(new Second(1, 2) instanceof ComplexFirstCopy).toBe(false);
  });

  it('pinv of a sparse matrix of Complex entries does not throw and has the right values', async () => {
    const C = await secondCopyOfComplex();
    // #1582: a Complex 0 is a structural zero, so `sparse` does not store it — as
    // mathjs 15.3.0 does (input and pinv result have density 0.5).
    const m = sparse([
      [new C(1, 2), new C(0, 0)],
      [new C(0, 0), new C(3, -1)],
    ]);
    const result = (pinv as (x: unknown) => unknown)(m);
    const rows = (
      Array.isArray(result) ? result : (result as { toArray(): unknown[] }).toArray()
    ) as Entry[][];
    // The inverse of a diagonal matrix is the reciprocal of each diagonal entry:
    // 1 / (1 + 2i) = 0.2 - 0.4i and 1 / (3 - i) = 0.3 + 0.1i. The dropped Complex
    // zeros read back as the number 0, as in mathjs 15.3.0.
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const cell = rows[i]![j]!;
        if (i === j) {
          const want = i === 0 ? { re: 0.2, im: -0.4 } : { re: 0.3, im: 0.1 };
          expect(cell.re).toBeCloseTo(want.re, 12);
          expect(cell.im).toBeCloseTo(want.im, 12);
        } else {
          expect(cell).toBe(0);
        }
      }
    }
  });
});
