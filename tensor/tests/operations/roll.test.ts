/**
 * Tests for roll — cyclic shift along given axes.
 *
 * Coverage:
 *  1.  Single-axis shift positive: [1,2,3,4,5] by +2 → [4,5,1,2,3].
 *  2.  Single-axis shift negative: [1,2,3,4,5] by -1 → [2,3,4,5,1].
 *  3.  Shift by 0 is identity.
 *  4.  Shift by axis-size is identity (full wrap).
 *  5.  Shift larger than dimension: modulo'd correctly.
 *  6.  Multi-axis shift: 2-D matrix shifted on both axes.
 *  7.  Flat (no axes) shift on a 2-D tensor.
 *  8.  Flat shift with negative shift.
 *  9.  Negative axis indexing.
 *  10. Axis labels preserved.
 *  11. roll(roll(t, [k], [ax]), [-k], [ax]) is identity.
 *  12. Rank-3 shift on axis 1.
 *  13. Duplicate axes: last specification wins.
 *  14. Out-of-range axis throws Error.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { roll } from '../../src/operations/roll';

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

describe('roll', () => {
  it('1. Single-axis shift +2: [1,2,3,4,5] → [4,5,1,2,3]', () => {
    const t = new Tensor([5], new Float64Array([1, 2, 3, 4, 5]));
    const r = roll(t, 2, [0]);
    expect([...r.data]).toEqual([4, 5, 1, 2, 3]);
  });

  it('2. Single-axis shift -1: [1,2,3,4,5] → [2,3,4,5,1]', () => {
    const t = new Tensor([5], new Float64Array([1, 2, 3, 4, 5]));
    const r = roll(t, -1, [0]);
    expect([...r.data]).toEqual([2, 3, 4, 5, 1]);
  });

  it('3. Shift by 0 is identity', () => {
    const t = new Tensor([4], seq(4));
    const r = roll(t, 0, [0]);
    expect([...r.data]).toEqual([...t.data]);
  });

  it('4. Shift by axis-size is identity (full wrap)', () => {
    const t = new Tensor([3, 4], seq(12));
    const r = roll(t, 3, [0]);
    expect([...r.data]).toEqual([...t.data]);
  });

  it('5. Shift larger than dimension is modulo-reduced', () => {
    // shift by 7 on size-5 = shift by 2
    const t = new Tensor([5], new Float64Array([1, 2, 3, 4, 5]));
    const r7 = roll(t, 7, [0]);
    const r2 = roll(t, 2, [0]);
    expect([...r7.data]).toEqual([...r2.data]);
  });

  it('6. Multi-axis shift: 3×4 matrix shifted on both axes', () => {
    // shift axis-0 by 1 and axis-1 by 2 simultaneously
    const t = new Tensor([3, 4], seq(12));
    const r = roll(t, [1, 2], [0, 1]);
    expect([...r.shape]).toEqual([3, 4]);
    // out[i,j] = in[(i-1+3)%3, (j-2+4)%4]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        const si = (((i - 1) % 3) + 3) % 3;
        const sj = (((j - 2) % 4) + 4) % 4;
        expect(r.data[i * 4 + j]).toBe(t.data[si * 4 + sj]);
      }
    }
  });

  it('7. Flat (no axes) shift on a 2-D tensor', () => {
    // 2×3 matrix treated as flat [0..5], shift by 2
    const t = new Tensor([2, 3], seq(6));
    const r = roll(t, 2);
    // flat shift: out[i] = in[(i-2+6)%6]
    const expected = new Float64Array([4, 5, 0, 1, 2, 3]);
    expect([...r.data]).toEqual([...expected]);
    expect([...r.shape]).toEqual([2, 3]);
  });

  it('8. Flat shift with negative shift', () => {
    const t = new Tensor([2, 3], seq(6));
    const r = roll(t, -2);
    // out[i] = in[(i+2)%6]
    const expected = new Float64Array([2, 3, 4, 5, 0, 1]);
    expect([...r.data]).toEqual([...expected]);
  });

  it('9. Negative axis indexing: axis -1 === last axis', () => {
    const t = new Tensor([3, 4], seq(12));
    const rPos = roll(t, 1, [1]);
    const rNeg = roll(t, 1, [-1]);
    expect(maxAbsDiff(rPos.data, rNeg.data)).toBe(0);
  });

  it('10. Axis labels preserved', () => {
    const iA = new Index(3, { name: 'batch' });
    const iB = new Index(4, { name: 'feat' });
    const t = new Tensor([3, 4], seq(12), [iA, iB]);
    const r = roll(t, 1, [0]);
    expect(r.axisLabels).toBeDefined();
    expect(r.axisLabels![0].name).toBe('batch');
    expect(r.axisLabels![1].name).toBe('feat');
    expect(r.axisLabels![0].id).toBe(iA.id);
    expect(r.axisLabels![1].id).toBe(iB.id);
  });

  it('11. roll(roll(t, [k], [ax]), [-k], [ax]) is identity', () => {
    const t = new Tensor([5], seq(5));
    const k = 3;
    const roundTrip = roll(roll(t, k, [0]), -k, [0]);
    expect(maxAbsDiff(roundTrip.data, t.data)).toBe(0);
  });

  it('12. Rank-3 shift on axis 1', () => {
    // shape [2,3,2], shift axis 1 by 1
    const t = new Tensor([2, 3, 2], seq(12));
    const r = roll(t, 1, [1]);
    expect([...r.shape]).toEqual([2, 3, 2]);
    // out[i,j,k] = in[i, (j-1+3)%3, k]
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 2; k++) {
          const sj = (((j - 1) % 3) + 3) % 3;
          expect(r.data[i * 6 + j * 2 + k]).toBe(t.data[i * 6 + sj * 2 + k]);
        }
      }
    }
  });

  it('13. Duplicate axes: last specification wins', () => {
    // Shift axis 0 twice: [+1, +2] for axis [0, 0] → net shift +2
    const t = new Tensor([4], seq(4));
    const r = roll(t, [1, 2], [0, 0]);
    const rNet = roll(t, 2, [0]);
    expect([...r.data]).toEqual([...rNet.data]);
  });

  it('14. Out-of-range axis throws Error', () => {
    const t = new Tensor([3, 4], seq(12));
    expect(() => roll(t, 1, [2])).toThrow();
    expect(() => roll(t, 1, [-3])).toThrow();
  });
});
