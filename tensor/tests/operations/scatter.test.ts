/**
 * Tests for scatter — inverse of gather; writes updates into a tensor at given
 * indices along an axis.
 *
 * Coverage:
 *  1.  Round-trip with gather: scatter(zeros, axis, indices, gather(t, axis, indices))
 *      reproduces t at gathered positions, 0 elsewhere.
 *  2.  Scatter overwrites only the specified positions; others unchanged.
 *  3.  Duplicate indices → last-wins (overwrite mode).
 *  4.  reduce='add' accumulates at duplicate indices.
 *  5.  Out-of-bounds index throws RangeError.
 *  6.  Negative axis indexing.
 *  7.  Axis labels preserved from t.
 *  8.  Rank-1 scatter.
 *  9.  Rank-2 scatter on axis 0.
 *  10. Rank-2 scatter on axis 1.
 *  11. Rank-3 scatter on axis 1.
 *  12. Wrong updates rank throws.
 *  13. Wrong updates shape on non-scatter axis throws.
 *  14. Empty indices → t is copied unchanged.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { scatter } from '../../src/operations/scatter';
import { gather } from '../../src/operations/gather';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seq(n: number, start = 0): Float64Array {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = start + i;
  return d;
}

function zeros(n: number): Float64Array {
  return new Float64Array(n);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scatter', () => {
  it('1. Round-trip with gather: scatter(zeros, 0, [0,2], gather(t, 0, [0,2]))', () => {
    // 3×4 matrix, values 0..11
    const t = new Tensor([3, 4], seq(12));
    const base = new Tensor([3, 4], zeros(12));
    const gathered = gather(t, 0, [0, 2]);
    const result = scatter(base, 0, [0, 2], gathered);

    // rows 0 and 2 should match t; row 1 should remain 0
    expect([...result.shape]).toEqual([3, 4]);
    // row 0
    for (let j = 0; j < 4; j++) expect(result.data[j]).toBe(t.data[j]);
    // row 1 (index 4..7) stays 0
    for (let j = 4; j < 8; j++) expect(result.data[j]).toBe(0);
    // row 2
    for (let j = 8; j < 12; j++) expect(result.data[j]).toBe(t.data[j]);
  });

  it('2. Scatter overwrites only the specified rows; others unchanged', () => {
    const base = new Tensor([4, 3], seq(12, 100));
    const updates = new Tensor([2, 3], seq(6, 0));
    const result = scatter(base, 0, [1, 3], updates);

    expect([...result.shape]).toEqual([4, 3]);
    // row 0 (index 0..2) unchanged: 100, 101, 102
    expect(result.data[0]).toBe(100);
    expect(result.data[1]).toBe(101);
    expect(result.data[2]).toBe(102);
    // row 1 overwritten: 0, 1, 2
    expect(result.data[3]).toBe(0);
    expect(result.data[4]).toBe(1);
    expect(result.data[5]).toBe(2);
    // row 2 unchanged: 106, 107, 108
    expect(result.data[6]).toBe(106);
    // row 3 overwritten: 3, 4, 5
    expect(result.data[9]).toBe(3);
    expect(result.data[10]).toBe(4);
    expect(result.data[11]).toBe(5);
  });

  it('3. Duplicate indices → last-wins (overwrite mode)', () => {
    const base = new Tensor([3], zeros(3));
    // updates: [10, 20] → scatter at [0, 0]; second write (20) wins
    const updates = new Tensor([2], new Float64Array([10, 20]));
    const result = scatter(base, 0, [0, 0], updates);
    expect(result.data[0]).toBe(20);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it('4. reduce=add accumulates at duplicate indices', () => {
    const base = new Tensor([3], new Float64Array([1, 2, 3]));
    const updates = new Tensor([2], new Float64Array([10, 20]));
    const result = scatter(base, 0, [1, 1], updates, { reduce: 'add' });
    // index 1: 2 + 10 + 20 = 32
    expect(result.data[0]).toBe(1);
    expect(result.data[1]).toBe(32);
    expect(result.data[2]).toBe(3);
  });

  it('5. Out-of-bounds index throws RangeError', () => {
    const base = new Tensor([3, 4], zeros(12));
    const updates = new Tensor([1, 4], seq(4));
    expect(() => scatter(base, 0, [3], updates)).toThrow(RangeError);
    expect(() => scatter(base, 0, [-1], updates)).toThrow(RangeError);
  });

  it('6. Negative axis: axis -1 refers to last axis', () => {
    // 3×4; scatter on axis -1 (=1)
    const base = new Tensor([3, 4], zeros(12));
    const updates = new Tensor([3, 2], seq(6));
    const result = scatter(base, -1, [0, 2], updates);
    expect([...result.shape]).toEqual([3, 4]);
    // col 0 of result should equal col 0 of updates (first 3 elements of updates)
    // updates row-major: [0,1,2,3,4,5] → shape [3,2]
    // updates[0,0]=0, updates[0,1]=1
    // updates[1,0]=2, updates[1,1]=3
    // updates[2,0]=4, updates[2,1]=5
    // scatter to cols [0, 2]:
    // result[0,0]=0, result[0,2]=1; result[1,0]=2, result[1,2]=3; result[2,0]=4, result[2,2]=5
    expect(result.data[0]).toBe(0); // [0,0]
    expect(result.data[2]).toBe(1); // [0,2]
    expect(result.data[4]).toBe(2); // [1,0]
    expect(result.data[6]).toBe(3); // [1,2]
    expect(result.data[8]).toBe(4); // [2,0]
    expect(result.data[10]).toBe(5); // [2,2]
  });

  it('7. Axis labels preserved from t', () => {
    const iA = new Index(3, { name: 'rows' });
    const iB = new Index(4, { name: 'cols' });
    const base = new Tensor([3, 4], zeros(12), [iA, iB]);
    const updates = new Tensor([1, 4], seq(4));
    const result = scatter(base, 0, [0], updates);
    expect(result.axisLabels).toBeDefined();
    expect(result.axisLabels![0].name).toBe('rows');
    expect(result.axisLabels![1].name).toBe('cols');
    // Same id as input labels
    expect(result.axisLabels![0].id).toBe(iA.id);
    expect(result.axisLabels![1].id).toBe(iB.id);
  });

  it('8. Rank-1 scatter: overwrite single element', () => {
    const base = new Tensor([5], new Float64Array([10, 20, 30, 40, 50]));
    const updates = new Tensor([1], new Float64Array([99]));
    const result = scatter(base, 0, [2], updates);
    expect([...result.data]).toEqual([10, 20, 99, 40, 50]);
  });

  it('9. Rank-2 scatter on axis 0: scatter two rows', () => {
    const base = new Tensor([4, 2], zeros(8));
    const updates = new Tensor([2, 2], new Float64Array([1, 2, 3, 4]));
    const result = scatter(base, 0, [3, 1], updates);
    // row 3 → [1,2], row 1 → [3,4]
    expect([...result.data]).toEqual([0, 0, 3, 4, 0, 0, 1, 2]);
  });

  it('10. Rank-2 scatter on axis 1: scatter two columns', () => {
    const base = new Tensor([2, 4], zeros(8));
    const updates = new Tensor([2, 2], new Float64Array([1, 2, 3, 4]));
    const result = scatter(base, 1, [0, 3], updates);
    // [0,0]=1, [0,3]=2, [1,0]=3, [1,3]=4
    expect(result.data[0]).toBe(1);
    expect(result.data[3]).toBe(2);
    expect(result.data[4]).toBe(3);
    expect(result.data[7]).toBe(4);
    // interior stays 0
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it('11. Rank-3 scatter on axis 1', () => {
    // shape [2, 3, 2], scatter axis=1, indices=[0,2]
    const base = new Tensor([2, 3, 2], zeros(12));
    const updates = new Tensor([2, 2, 2], seq(8));
    const result = scatter(base, 1, [0, 2], updates);
    expect([...result.shape]).toEqual([2, 3, 2]);
    // updates row-major: 0,1,2,3,4,5,6,7
    // output[0,0,:] = updates[0,0,:] = 0,1
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(1);
    // output[0,1,:] = 0 (not scattered)
    expect(result.data[2]).toBe(0);
    expect(result.data[3]).toBe(0);
    // output[0,2,:] = updates[0,1,:] = 2,3
    expect(result.data[4]).toBe(2);
    expect(result.data[5]).toBe(3);
    // output[1,0,:] = updates[1,0,:] = 4,5
    expect(result.data[6]).toBe(4);
    expect(result.data[7]).toBe(5);
  });

  it('12. Wrong updates rank throws', () => {
    const base = new Tensor([3, 4], zeros(12));
    const updates = new Tensor([4], seq(4));
    expect(() => scatter(base, 0, [0], updates)).toThrow();
  });

  it('13. Wrong updates shape on non-scatter axis throws', () => {
    const base = new Tensor([3, 4], zeros(12));
    // axis=0, indices=[0] → updates should be [1,4] but we provide [1,3]
    const updates = new Tensor([1, 3], seq(3));
    expect(() => scatter(base, 0, [0], updates)).toThrow();
  });

  it('14. Empty indices → t is copied unchanged', () => {
    const base = new Tensor([3, 4], seq(12, 1));
    const updates = new Tensor([0, 4], new Float64Array(0));
    const result = scatter(base, 0, [], updates);
    expect([...result.data]).toEqual([...base.data]);
  });
});
