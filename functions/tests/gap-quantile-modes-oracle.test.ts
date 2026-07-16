import { describe, it, expect } from 'vitest';
import { quantileSeq } from '../dist/index.js';

/**
 * quantileSeq interpolation modes, oracle-pinned vs numpy on data [1..10].
 *
 *   python -c "
 *   import numpy as np
 *   d=np.arange(1,11)
 *   for m in ['linear','lower','higher','nearest','midpoint']:
 *       print(m,[np.quantile(d,q,method=m) for q in (0.25,0.5,0.75)])
 *   "
 *   linear   [3.25, 5.5, 7.75]   (default, unchanged)
 *   lower    [3, 5, 7]
 *   higher   [4, 6, 8]
 *   nearest  [3, 5, 8]           (ties -> even index, round-half-to-even)
 *   midpoint [3.5, 5.5, 7.5]
 */

const DATA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const UNSORTED = [10, 1, 7, 3, 5, 9, 2, 8, 4, 6];
const QS = [0.25, 0.5, 0.75];

const EXPECTED: Record<string, number[]> = {
  linear: [3.25, 5.5, 7.75],
  lower: [3, 5, 7],
  higher: [4, 6, 8],
  nearest: [3, 5, 8],
  midpoint: [3.5, 5.5, 7.5],
};

describe('quantileSeq interpolation modes (numpy oracle)', () => {
  for (const mode of Object.keys(EXPECTED)) {
    it(`mode "${mode}" matches numpy on [1..10]`, () => {
      QS.forEach((q, i) => {
        expect(quantileSeq(DATA, q, mode) as number).toBeCloseTo(EXPECTED[mode][i], 12);
      });
    });
  }

  it('default (no mode) still gives linear', () => {
    QS.forEach((q, i) => {
      expect(quantileSeq(DATA, q) as number).toBeCloseTo(EXPECTED.linear[i], 12);
    });
  });

  it('modes work on unsorted input (internal partition-select)', () => {
    for (const mode of Object.keys(EXPECTED)) {
      QS.forEach((q, i) => {
        expect(quantileSeq(UNSORTED, q, mode) as number).toBeCloseTo(EXPECTED[mode][i], 12);
      });
    }
  });

  it('accepts a q-array with a mode', () => {
    // numpy: lower on [1..10] at [0.25,0.5,0.75] -> [3,5,7]
    const got = quantileSeq(DATA, QS, 'lower') as number[];
    expect(got).toEqual([3, 5, 7]);
    const gotMid = quantileSeq(DATA, QS, 'midpoint') as number[];
    gotMid.forEach((v, i) => expect(v).toBeCloseTo(EXPECTED.midpoint[i], 12));
  });

  it('respects sorted flag together with a mode', () => {
    // pre-sorted data, higher mode
    QS.forEach((q, i) => {
      expect(quantileSeq(DATA, q, true, 'higher') as number).toBeCloseTo(EXPECTED.higher[i], 12);
    });
  });

  it('rejects an unknown mode', () => {
    expect(() => quantileSeq(DATA, 0.5, 'bogus')).toThrow(/interpolation mode/);
  });

  it('nearest uses round-half-to-even on the fractional index', () => {
    // len5 [1..5]: q=0.375 -> index 1.5 -> even index 2 -> value 3 (numpy)
    //             q=0.625 -> index 2.5 -> even index 2 -> value 3 (numpy)
    expect(quantileSeq([1, 2, 3, 4, 5], 0.375, 'nearest') as number).toBe(3);
    expect(quantileSeq([1, 2, 3, 4, 5], 0.625, 'nearest') as number).toBe(3);
  });
});
