/**
 * Tests for gather — pull elements along one axis (NumPy take / JAX gather).
 *
 * Coverage:
 *  1.  Take a single index → output rank unchanged, gathered axis has length 1.
 *  2.  Take multiple contiguous indices (equivalent to a row slice).
 *  3.  Take multiple indices including duplicates.
 *  4.  Gather all indices in order → identical to input.
 *  5.  Out-of-bounds index throws RangeError.
 *  6.  Negative index throws RangeError (indices must be non-negative).
 *  7.  Axis label is primed (primeLevel incremented by 1).
 *  8.  Other axis labels are preserved unchanged.
 *  9.  Gather on axis 1 of a 2-D matrix.
 *  10. Gather on axis 0 of a 3-D tensor.
 *  11. Gather on negative axis (-1 = last axis).
 *  12. Round-trip: gather(t, 0, [0,1,...,n-1]) equals input.
 *  13. Out-of-range axis throws Error.
 *  14. Empty indices array produces zero-length axis.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { gather } from '../../src/operations/gather';

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

describe('gather', () => {
  it('1. Single index: output has shape[axis]=1, same rank', () => {
    // 3×4 matrix
    const data = new Float64Array(12);
    for (let i = 0; i < 12; i++) data[i] = i;
    const t = new Tensor([3, 4], data);
    const g = gather(t, 0, [1]);
    expect([...g.shape]).toEqual([1, 4]);
    // row 1: values 4,5,6,7
    expect([...g.data]).toEqual([4, 5, 6, 7]);
  });

  it('2. Multiple contiguous indices (rows 0 and 1)', () => {
    const data = new Float64Array(12);
    for (let i = 0; i < 12; i++) data[i] = i;
    const t = new Tensor([3, 4], data);
    const g = gather(t, 0, [0, 1]);
    expect([...g.shape]).toEqual([2, 4]);
    expect([...g.data]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('3. Indices with duplicates', () => {
    const t = new Tensor([4], arr([10, 20, 30, 40]));
    const g = gather(t, 0, [2, 2, 0]);
    expect([...g.shape]).toEqual([3]);
    expect([...g.data]).toEqual([30, 30, 10]);
  });

  it('4. Gather all indices in order → identical to input', () => {
    const data = arr([1, 2, 3, 4, 5]);
    const t = new Tensor([5], data);
    const g = gather(t, 0, [0, 1, 2, 3, 4]);
    expect([...g.shape]).toEqual([5]);
    expect(maxAbsDiff(g.data, data)).toBe(0);
  });

  it('5. Out-of-bounds index throws RangeError', () => {
    const t = new Tensor([3], arr([1, 2, 3]));
    expect(() => gather(t, 0, [0, 3])).toThrow(RangeError);
  });

  it('6. Negative index throws RangeError', () => {
    const t = new Tensor([3], arr([1, 2, 3]));
    expect(() => gather(t, 0, [-1])).toThrow(RangeError);
  });

  it('7. Axis label is primed (primeLevel incremented by 1)', () => {
    const i = new Index(3, { name: 'row' });
    const j = new Index(4, { name: 'col' });
    const t = new Tensor([3, 4], new Float64Array(12), [i, j]);
    const g = gather(t, 0, [0, 2]);
    expect(g.axisLabels).toBeDefined();
    // Gathered axis (0) should have primeLevel = i.primeLevel + 1 = 1
    const gatheredLabel = g.axisLabels![0];
    expect(gatheredLabel.primeLevel).toBe(1);
    // Must share same id as original (matches check with primeLevel 1 ≠ 0)
    expect(gatheredLabel.id).toBe(i.id);
  });

  it('8. Other axis labels are preserved unchanged', () => {
    const i = new Index(3, { name: 'row' });
    const j = new Index(4, { name: 'col' });
    const t = new Tensor([3, 4], new Float64Array(12), [i, j]);
    const g = gather(t, 0, [1]);
    expect(g.axisLabels![1]).toBe(j); // exact same object
  });

  it('9. Gather on axis 1 of a 2-D matrix (column selection)', () => {
    // 2×4 matrix
    const data = new Float64Array(8);
    for (let i = 0; i < 8; i++) data[i] = i;
    const t = new Tensor([2, 4], data);
    // Select columns 3, 1, 2
    const g = gather(t, 1, [3, 1, 2]);
    expect([...g.shape]).toEqual([2, 3]);
    // row 0: [0,1,2,3] → select cols 3,1,2 → [3,1,2]
    // row 1: [4,5,6,7] → select cols 3,1,2 → [7,5,6]
    expect([...g.data]).toEqual([3, 1, 2, 7, 5, 6]);
  });

  it('10. Gather on axis 0 of a 3-D tensor', () => {
    // 3×2×2 tensor, values 0..11
    const data = new Float64Array(12);
    for (let i = 0; i < 12; i++) data[i] = i;
    const t = new Tensor([3, 2, 2], data);
    // Select slabs 2 and 0
    const g = gather(t, 0, [2, 0]);
    expect([...g.shape]).toEqual([2, 2, 2]);
    // slab 2: [8,9,10,11], slab 0: [0,1,2,3]
    expect([...g.data]).toEqual([8, 9, 10, 11, 0, 1, 2, 3]);
  });

  it('11. Gather on negative axis (-1 = last axis)', () => {
    const t = new Tensor([2, 3], arr([1, 2, 3, 4, 5, 6]));
    const g = gather(t, -1, [2, 0]);
    expect([...g.shape]).toEqual([2, 2]);
    // row 0: [1,2,3] → cols 2,0 → [3,1]; row 1: [4,5,6] → [6,4]
    expect([...g.data]).toEqual([3, 1, 6, 4]);
  });

  it('12. Round-trip: gather with all indices in order == input', () => {
    const data = new Float64Array(6);
    for (let i = 0; i < 6; i++) data[i] = i * 2;
    const t = new Tensor([2, 3], data);
    const g = gather(t, 1, [0, 1, 2]);
    expect([...g.shape]).toEqual([2, 3]);
    expect(maxAbsDiff(g.data, data)).toBe(0);
  });

  it('13. Out-of-range axis throws Error', () => {
    const t = new Tensor([3, 4], new Float64Array(12));
    expect(() => gather(t, 2, [0])).toThrow(/axis/);
  });

  it('14. Empty indices array produces zero-length axis', () => {
    const t = new Tensor([3, 4], new Float64Array(12));
    const g = gather(t, 0, []);
    expect([...g.shape]).toEqual([0, 4]);
    expect(g.data.length).toBe(0);
  });
});
