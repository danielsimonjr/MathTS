/**
 * Tests for flip — reverse element order along given axes.
 *
 * Coverage:
 *  1.  Single-axis flip on axis 0 of a 2-D matrix: rows reversed.
 *  2.  Single-axis flip on axis 1 of a 2-D matrix: columns reversed.
 *  3.  Multi-axis flip: flip both axes equals 180° rotation.
 *  4.  flip(flip(t, axes), axes) is identity.
 *  5.  Empty axes array → no-op (returns copy).
 *  6.  Rank-1 flip: [1,2,3,4,5] → [5,4,3,2,1].
 *  7.  Rank-3 flip on axis 2.
 *  8.  Negative axis indexing: -1 equals last axis.
 *  9.  Axis labels preserved.
 *  10. Multi-axis flip equals composition of single-axis flips.
 *  11. Out-of-range axis throws Error.
 *  12. Duplicate axes in input → deduplicated (double-flip == no-op on that axis).
 *  13. Flip of a 1×N matrix on axis 0 is identity.
 *  14. Flip produces a new tensor (does not mutate input).
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { flip } from '../../src/operations/flip';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seq(n: number, start = 0): Float64Array {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = start + i;
  return d;
}

function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('flip', () => {
  it('1. Flip axis 0 of 3×4 matrix: rows reversed', () => {
    //  [[0,1,2,3],[4,5,6,7],[8,9,10,11]]
    // → [[8,9,10,11],[4,5,6,7],[0,1,2,3]]
    const t = new Tensor([3, 4], seq(12));
    const f = flip(t, [0]);
    expect([...f.shape]).toEqual([3, 4]);
    expect([...f.data]).toEqual([8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3]);
  });

  it('2. Flip axis 1 of 3×4 matrix: columns reversed', () => {
    const t = new Tensor([3, 4], seq(12));
    const f = flip(t, [1]);
    // each row reversed: [3,2,1,0], [7,6,5,4], [11,10,9,8]
    expect([...f.data]).toEqual([3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8]);
  });

  it('3. Multi-axis flip [0,1] equals 180-degree rotation', () => {
    const t = new Tensor([3, 4], seq(12));
    const f = flip(t, [0, 1]);
    // Equivalent to reversing the entire flat array (row-major 180-degree rotation)
    const expected = [...t.data].reverse();
    expect([...f.data]).toEqual(expected);
  });

  it('4. flip(flip(t, axes), axes) is identity', () => {
    const t = new Tensor([3, 4], seq(12));
    const roundTrip = flip(flip(t, [0, 1]), [0, 1]);
    expect(maxAbsDiff(roundTrip.data, t.data)).toBe(0);
  });

  it('5. Empty axes array → no-op (returns a copy)', () => {
    const t = new Tensor([2, 3], seq(6));
    const f = flip(t, []);
    expect([...f.data]).toEqual([...t.data]);
    expect(f).not.toBe(t); // new object
  });

  it('6. Rank-1 flip: [1,2,3,4,5] → [5,4,3,2,1]', () => {
    const t = new Tensor([5], new Float64Array([1, 2, 3, 4, 5]));
    const f = flip(t, [0]);
    expect([...f.data]).toEqual([5, 4, 3, 2, 1]);
  });

  it('7. Rank-3 flip on axis 2', () => {
    // shape [2,2,3]: each depth slice reversed
    const t = new Tensor([2, 2, 3], seq(12));
    const f = flip(t, [2]);
    expect([...f.shape]).toEqual([2, 2, 3]);
    // out[i,j,k] = in[i,j,2-k]
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 3; k++) {
          expect(f.data[i * 6 + j * 3 + k]).toBe(t.data[i * 6 + j * 3 + (2 - k)]);
        }
      }
    }
  });

  it('8. Negative axis indexing: -1 equals last axis', () => {
    const t = new Tensor([3, 4], seq(12));
    const fPos = flip(t, [1]);
    const fNeg = flip(t, [-1]);
    expect(maxAbsDiff(fPos.data, fNeg.data)).toBe(0);
  });

  it('9. Axis labels preserved', () => {
    const iA = new Index(3, { name: 'time' });
    const iB = new Index(4, { name: 'freq' });
    const t = new Tensor([3, 4], seq(12), [iA, iB]);
    const f = flip(t, [0]);
    expect(f.axisLabels).toBeDefined();
    expect(f.axisLabels![0].name).toBe('time');
    expect(f.axisLabels![1].name).toBe('freq');
    expect(f.axisLabels![0].id).toBe(iA.id);
    expect(f.axisLabels![1].id).toBe(iB.id);
  });

  it('10. Multi-axis flip equals composition of single-axis flips', () => {
    const t = new Tensor([3, 4], seq(12));
    // flip both axes at once
    const fBoth = flip(t, [0, 1]);
    // flip axis 0 then axis 1 separately
    const fComp = flip(flip(t, [0]), [1]);
    expect(maxAbsDiff(fBoth.data, fComp.data)).toBe(0);
  });

  it('11. Out-of-range axis throws Error', () => {
    const t = new Tensor([3, 4], seq(12));
    expect(() => flip(t, [2])).toThrow();
    expect(() => flip(t, [-3])).toThrow();
  });

  it('12. Duplicate axes deduplicated: equivalent to flipping once', () => {
    // Flipping an axis twice returns to original; deduplicate → flip once
    // Without dedup, [0,0] would flip twice = identity
    // With dedup (as a Set), [0,0] → flip once
    const t = new Tensor([4], new Float64Array([1, 2, 3, 4]));
    // With deduplication: flip axis 0 once
    const fDedup = flip(t, [0, 0]);
    const fOnce = flip(t, [0]);
    expect([...fDedup.data]).toEqual([...fOnce.data]);
  });

  it('13. Flip of a 1×N matrix on axis 0 is identity', () => {
    const t = new Tensor([1, 5], seq(5));
    const f = flip(t, [0]);
    // Only one row; reversing it is a no-op
    expect([...f.data]).toEqual([...t.data]);
  });

  it('14. Flip produces a new tensor (does not mutate input)', () => {
    const original = new Float64Array([1, 2, 3, 4, 5]);
    const t = new Tensor([5], original);
    const f = flip(t, [0]);
    // Mutating f's data should not affect t
    (f.data as Float64Array)[0] = 999;
    expect(t.data[0]).toBe(1);
    expect(f.data[4]).toBe(1);
  });
});
