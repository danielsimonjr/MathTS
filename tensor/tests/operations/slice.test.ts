/**
 * Tests for slice — extract a sub-tensor by per-axis [start, stop, step] ranges.
 *
 * Coverage:
 *  1.  Trivial slice (all nulls) is identity.
 *  2.  Single-axis subset (rows 1–3 of a 5×4 matrix).
 *  3.  Multi-axis subset.
 *  4.  Step > 1 on a 1-D vector.
 *  5.  Step > 1 on a 2-D matrix.
 *  6.  Negative start index.
 *  7.  Negative stop index.
 *  8.  Empty result (start === stop).
 *  9.  Out-of-range start throws.
 *  10. Wrong ranges length throws.
 *  11. Axis labels preserved (same name/tags on output axes).
 *  12. Stride-aware correctness on a 3-D tensor.
 *  13. Step with negative start.
 *  14. Slice of a rank-1 tensor.
 *  15. Non-zero start with step > 1.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { slice } from '../../src/operations/slice';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arr(values: number[]): Float64Array {
  return new Float64Array(values);
}

function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('slice', () => {
  it('1. Trivial slice (all nulls) returns equal data as input', () => {
    const data = arr([1, 2, 3, 4, 5, 6]);
    const t = new Tensor([2, 3], data);
    const s = slice(t, [null, null]);
    expect([...s.shape]).toEqual([2, 3]);
    expect(maxAbsDiff(s.data, data)).toBe(0);
  });

  it('2. Single-axis subset: rows 1–3 of a 5×4 matrix', () => {
    // rows: 0-4, cols: 0-3
    const data = new Float64Array(20);
    for (let i = 0; i < 20; i++) data[i] = i;
    const t = new Tensor([5, 4], data);
    const s = slice(t, [{ start: 1, stop: 3 }, null]);
    expect([...s.shape]).toEqual([2, 4]);
    // rows 1 and 2: values 4..7, 8..11
    expect([...s.data]).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('3. Multi-axis subset: rows 0–2, cols 1–3', () => {
    const data = new Float64Array(12);
    for (let i = 0; i < 12; i++) data[i] = i;
    const t = new Tensor([3, 4], data);
    const s = slice(t, [
      { start: 0, stop: 2 },
      { start: 1, stop: 3 },
    ]);
    expect([...s.shape]).toEqual([2, 2]);
    // row 0: [0,1,2,3] → cols 1,2 → [1,2]; row 1: [4,5,6,7] → [5,6]
    expect([...s.data]).toEqual([1, 2, 5, 6]);
  });

  it('4. Step > 1 on a 1-D vector', () => {
    const t = new Tensor([10], arr([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    const s = slice(t, [{ start: 0, stop: 10, step: 2 }]);
    expect([...s.shape]).toEqual([5]);
    expect([...s.data]).toEqual([0, 2, 4, 6, 8]);
  });

  it('5. Step > 1 on a 2-D matrix (every other row, every other col)', () => {
    // 4×4 matrix with values 0..15
    const data = new Float64Array(16);
    for (let i = 0; i < 16; i++) data[i] = i;
    const t = new Tensor([4, 4], data);
    const s = slice(t, [{ step: 2 }, { step: 2 }]);
    // rows 0, 2 and cols 0, 2 → values at (0,0)=0,(0,2)=2,(2,0)=8,(2,2)=10
    expect([...s.shape]).toEqual([2, 2]);
    expect([...s.data]).toEqual([0, 2, 8, 10]);
  });

  it('6. Negative start index (-2 means last-2)', () => {
    const t = new Tensor([6], arr([10, 20, 30, 40, 50, 60]));
    const s = slice(t, [{ start: -2 }]);
    // -2 → index 4, stop defaults to 6
    expect([...s.shape]).toEqual([2]);
    expect([...s.data]).toEqual([50, 60]);
  });

  it('7. Negative stop index', () => {
    const t = new Tensor([6], arr([10, 20, 30, 40, 50, 60]));
    const s = slice(t, [{ start: 0, stop: -1 }]);
    // stop -1 → index 5
    expect([...s.shape]).toEqual([5]);
    expect([...s.data]).toEqual([10, 20, 30, 40, 50]);
  });

  it('8. Empty result when start === stop', () => {
    const t = new Tensor([4], arr([1, 2, 3, 4]));
    const s = slice(t, [{ start: 2, stop: 2 }]);
    expect([...s.shape]).toEqual([0]);
    expect(s.data.length).toBe(0);
  });

  it('9. Out-of-range start throws RangeError', () => {
    const t = new Tensor([4], arr([1, 2, 3, 4]));
    expect(() => slice(t, [{ start: 5 }])).toThrow(RangeError);
  });

  it('10. Wrong ranges length throws Error', () => {
    const t = new Tensor([3, 3], new Float64Array(9));
    expect(() => slice(t, [null])).toThrow(/ranges length/);
  });

  it('11. Axis labels preserved with same name', () => {
    const i = new Index(3, { name: 'row' });
    const j = new Index(4, { name: 'col' });
    const t = new Tensor([3, 4], new Float64Array(12), [i, j]);
    const s = slice(t, [{ start: 0, stop: 2 }, null]);
    expect(s.axisLabels).toBeDefined();
    expect(s.axisLabels![0].name).toBe('row');
    expect(s.axisLabels![1].name).toBe('col');
  });

  it('12. Stride-aware correctness on a 3-D tensor', () => {
    // 2×3×4 tensor with values 0..23
    const data = new Float64Array(24);
    for (let i = 0; i < 24; i++) data[i] = i;
    const t = new Tensor([2, 3, 4], data);
    // Take all of dim0, first 2 of dim1, last 2 of dim2
    const s = slice(t, [null, { stop: 2 }, { start: 2 }]);
    expect([...s.shape]).toEqual([2, 2, 2]);
    // t[0,0,2]=2, t[0,0,3]=3, t[0,1,2]=6, t[0,1,3]=7
    // t[1,0,2]=14, t[1,0,3]=15, t[1,1,2]=18, t[1,1,3]=19
    expect([...s.data]).toEqual([2, 3, 6, 7, 14, 15, 18, 19]);
  });

  it('13. Step with negative start', () => {
    const t = new Tensor([10], arr([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    // start=-8 → index 2, stop defaults to 10, step=3 → [2,5,8]
    const s = slice(t, [{ start: -8, step: 3 }]);
    expect([...s.shape]).toEqual([3]);
    expect([...s.data]).toEqual([2, 5, 8]);
  });

  it('14. Slice of a rank-1 tensor (single-element result)', () => {
    const t = new Tensor([5], arr([10, 20, 30, 40, 50]));
    const s = slice(t, [{ start: 2, stop: 3 }]);
    expect([...s.shape]).toEqual([1]);
    expect([...s.data]).toEqual([30]);
  });

  it('15. Non-zero start with step > 1', () => {
    const t = new Tensor([8], arr([0, 1, 2, 3, 4, 5, 6, 7]));
    // start=1, stop=7, step=2 → indices 1,3,5 → values 1,3,5
    const s = slice(t, [{ start: 1, stop: 7, step: 2 }]);
    expect([...s.shape]).toEqual([3]);
    expect([...s.data]).toEqual([1, 3, 5]);
  });
});
