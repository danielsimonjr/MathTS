/**
 * Tests for concatenate — join tensors along an existing axis.
 *
 * Coverage:
 *  1.  Concat two row-vectors along axis 0 → longer row-vector.
 *  2.  Concat two matrices along axis 0 (vertical stacking).
 *  3.  Concat two matrices along axis 1 (horizontal stacking).
 *  4.  Concat three tensors along axis 0.
 *  5.  Shape mismatch on non-join axis throws.
 *  6.  Different-rank inputs throw.
 *  7.  Empty tensors array throws.
 *  8.  Axis labels from tensors[0] propagate (join axis label updated).
 *  9.  Non-join axis labels from tensors[0] preserved.
 *  10. Negative axis indexing (-1 = last axis).
 *  11. Concat of slices equals the original.
 *  12. axis out of range throws.
 *  13. Concat single tensor returns equivalent tensor.
 *  14. 3-D tensor concatenation along middle axis.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { concatenate } from '../../src/operations/concatenate';
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

describe('concatenate', () => {
  it('1. Concat two row-vectors along axis 0 → longer row-vector', () => {
    const v1 = new Tensor([3], arr([1, 2, 3]));
    const v2 = new Tensor([3], arr([4, 5, 6]));
    const c = concatenate([v1, v2], 0);
    expect([...c.shape]).toEqual([6]);
    expect([...c.data]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('2. Concat two 2×3 matrices along axis 0 → 4×3 matrix (vertical)', () => {
    const m1 = new Tensor([2, 3], arr([1, 2, 3, 4, 5, 6]));
    const m2 = new Tensor([2, 3], arr([7, 8, 9, 10, 11, 12]));
    const c = concatenate([m1, m2], 0);
    expect([...c.shape]).toEqual([4, 3]);
    expect([...c.data]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('3. Concat two 2×3 matrices along axis 1 → 2×6 matrix (horizontal)', () => {
    const m1 = new Tensor([2, 3], arr([1, 2, 3, 4, 5, 6]));
    const m2 = new Tensor([2, 3], arr([7, 8, 9, 10, 11, 12]));
    const c = concatenate([m1, m2], 1);
    expect([...c.shape]).toEqual([2, 6]);
    // row 0: [1,2,3,7,8,9]; row 1: [4,5,6,10,11,12]
    expect([...c.data]).toEqual([1, 2, 3, 7, 8, 9, 4, 5, 6, 10, 11, 12]);
  });

  it('4. Concat three 1-D tensors along axis 0', () => {
    const v1 = new Tensor([2], arr([1, 2]));
    const v2 = new Tensor([3], arr([3, 4, 5]));
    const v3 = new Tensor([1], arr([6]));
    const c = concatenate([v1, v2, v3], 0);
    expect([...c.shape]).toEqual([6]);
    expect([...c.data]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('5. Shape mismatch on non-join axis throws', () => {
    const m1 = new Tensor([2, 3], new Float64Array(6));
    const m2 = new Tensor([2, 4], new Float64Array(8)); // col count differs
    expect(() => concatenate([m1, m2], 0)).toThrow(/shape mismatch/);
  });

  it('6. Different-rank inputs throw', () => {
    const v = new Tensor([3], arr([1, 2, 3]));
    const m = new Tensor([1, 3], arr([1, 2, 3]));
    expect(() => concatenate([v, m], 0)).toThrow(/rank/);
  });

  it('7. Empty tensors array throws', () => {
    expect(() => concatenate([], 0)).toThrow(/non-empty/);
  });

  it('8. Axis labels from tensors[0] propagate; join-axis label dim updated', () => {
    const rowLabel = new Index(2, { name: 'row' });
    const colLabel = new Index(3, { name: 'col' });
    const m1 = new Tensor([2, 3], new Float64Array(6), [rowLabel, colLabel]);
    const m2 = new Tensor([2, 3], new Float64Array(6), [rowLabel, colLabel]);
    const c = concatenate([m1, m2], 0);
    expect(c.axisLabels).toBeDefined();
    // Join axis (0): new label with dim=4, name='row'
    expect(c.axisLabels![0].name).toBe('row');
    expect(c.axisLabels![0].dim).toBe(4);
  });

  it('9. Non-join axis labels from tensors[0] preserved (same object)', () => {
    const rowLabel = new Index(2, { name: 'row' });
    const colLabel = new Index(3, { name: 'col' });
    const m1 = new Tensor([2, 3], new Float64Array(6), [rowLabel, colLabel]);
    const m2 = new Tensor([2, 3], new Float64Array(6), [rowLabel, colLabel]);
    const c = concatenate([m1, m2], 0); // join on rows
    // col label (axis 1) should be the exact same object from m1
    expect(c.axisLabels![1]).toBe(colLabel);
  });

  it('10. Negative axis indexing (-1 = last axis)', () => {
    const m1 = new Tensor([2, 3], arr([1, 2, 3, 4, 5, 6]));
    const m2 = new Tensor([2, 3], arr([7, 8, 9, 10, 11, 12]));
    const c = concatenate([m1, m2], -1);
    // Same as axis=1
    expect([...c.shape]).toEqual([2, 6]);
    expect([...c.data]).toEqual([1, 2, 3, 7, 8, 9, 4, 5, 6, 10, 11, 12]);
  });

  it('11. Concat of slices equals the original (round-trip)', () => {
    const data = new Float64Array(20);
    for (let i = 0; i < 20; i++) data[i] = i;
    const t = new Tensor([4, 5], data);
    const first2 = slice(t, [{ stop: 2 }, null]); // rows 0-1
    const last2 = slice(t, [{ start: 2 }, null]); // rows 2-3
    const c = concatenate([first2, last2], 0);
    expect([...c.shape]).toEqual([4, 5]);
    expect(maxAbsDiff(c.data, data)).toBe(0);
  });

  it('12. axis out of range throws', () => {
    const m = new Tensor([2, 3], new Float64Array(6));
    expect(() => concatenate([m, m], 2)).toThrow(/axis/);
  });

  it('13. Concat single tensor returns equivalent tensor', () => {
    const data = arr([1, 2, 3, 4]);
    const t = new Tensor([4], data);
    const c = concatenate([t], 0);
    expect([...c.shape]).toEqual([4]);
    expect(maxAbsDiff(c.data, data)).toBe(0);
  });

  it('14. 3-D tensor concatenation along middle axis', () => {
    // Two 2×2×3 tensors concatenated along axis 1 → 2×4×3
    const t1 = new Tensor([2, 2, 3], new Float64Array(12).fill(1));
    const t2 = new Tensor([2, 2, 3], new Float64Array(12).fill(2));
    const c = concatenate([t1, t2], 1);
    expect([...c.shape]).toEqual([2, 4, 3]);
    // First 6 elements (slab 0, first 2 rows): all 1s
    for (let i = 0; i < 6; i++) expect(c.data[i]).toBe(1);
    // Next 6 elements (slab 0, next 2 rows): all 2s
    for (let i = 6; i < 12; i++) expect(c.data[i]).toBe(2);
  });
});
