/**
 * Tests for pad — pad each axis by [before, after] amounts.
 *
 * Coverage:
 *  1.  Constant mode with default fill 0.
 *  2.  Constant mode with explicit constantValue.
 *  3.  Edge mode: boundary element is repeated in pad region.
 *  4.  Reflect mode: values mirrored across boundary (excluding boundary).
 *  5.  Pad width 0 on all axes is identity (returns copy of input).
 *  6.  Asymmetric pads ([2,0] on one axis, [0,1] on another).
 *  7.  Mismatched padWidths.length throws.
 *  8.  Reflect mode with pad >= axis size throws.
 *  9.  Axis labels preserved from input.
 *  10. Rank-1 constant pad.
 *  11. Rank-3 constant pad.
 *  12. Edge mode on a 1-D vector.
 *  13. Reflect mode on a 1-D vector with [1,1].
 *  14. Pad with [0,0] on all axes yields same data.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { pad } from '../../src/operations/pad';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seq(n: number, start = 0): Float64Array {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = start + i;
  return d;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pad', () => {
  it('1. Constant mode with default fill 0: 3×4 → 5×6 with [1,1] padding', () => {
    const t = new Tensor([3, 4], seq(12));
    const p = pad(t, [
      [1, 1],
      [1, 1],
    ]);
    expect([...p.shape]).toEqual([5, 6]);
    // First row all 0
    for (let j = 0; j < 6; j++) expect(p.data[j]).toBe(0);
    // Last row all 0
    for (let j = 24; j < 30; j++) expect(p.data[j]).toBe(0);
    // Second row: [0, 0,1,2,3, 0]
    expect(p.data[6]).toBe(0);
    expect(p.data[7]).toBe(0);
    expect(p.data[8]).toBe(1);
    expect(p.data[9]).toBe(2);
    expect(p.data[10]).toBe(3);
    expect(p.data[11]).toBe(0);
  });

  it('2. Constant mode with explicit constantValue=9', () => {
    const t = new Tensor([2, 2], new Float64Array([1, 2, 3, 4]));
    const p = pad(
      t,
      [
        [1, 0],
        [0, 1],
      ],
      { mode: 'constant', constantValue: 9 }
    );
    // output shape [3, 3]
    expect([...p.shape]).toEqual([3, 3]);
    // first row should be [9, 9, 9]
    expect(p.data[0]).toBe(9);
    expect(p.data[1]).toBe(9);
    expect(p.data[2]).toBe(9);
    // second row: [1, 2, 9]
    expect(p.data[3]).toBe(1);
    expect(p.data[4]).toBe(2);
    expect(p.data[5]).toBe(9);
    // third row: [3, 4, 9]
    expect(p.data[6]).toBe(3);
    expect(p.data[7]).toBe(4);
    expect(p.data[8]).toBe(9);
  });

  it('3. Edge mode: boundary element repeated', () => {
    // [1,2,3,4,5] → edge pad [2,1] → [1,1,1,2,3,4,5,5]
    const t = new Tensor([5], new Float64Array([1, 2, 3, 4, 5]));
    const p = pad(t, [[2, 1]], { mode: 'edge' });
    expect([...p.shape]).toEqual([8]);
    expect([...p.data]).toEqual([1, 1, 1, 2, 3, 4, 5, 5]);
  });

  it('4. Reflect mode: mirrors values (excluding boundary)', () => {
    // [1,2,3,4,5] → reflect pad [2,2] → [3,2,1,2,3,4,5,4,3]
    const t = new Tensor([5], new Float64Array([1, 2, 3, 4, 5]));
    const p = pad(t, [[2, 2]], { mode: 'reflect' });
    expect([...p.shape]).toEqual([9]);
    expect([...p.data]).toEqual([3, 2, 1, 2, 3, 4, 5, 4, 3]);
  });

  it('5. Pad width 0 on all axes is identity', () => {
    const data = seq(6);
    const t = new Tensor([2, 3], data);
    const p = pad(t, [
      [0, 0],
      [0, 0],
    ]);
    expect([...p.shape]).toEqual([2, 3]);
    expect([...p.data]).toEqual([...data]);
  });

  it('6. Asymmetric pads: [2,0] on axis 0, [0,1] on axis 1', () => {
    const t = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    const p = pad(t, [
      [2, 0],
      [0, 1],
    ]);
    // output shape [4, 4]
    expect([...p.shape]).toEqual([4, 4]);
    // first two rows all 0 (before-pad on axis 0)
    for (let i = 0; i < 8; i++) expect(p.data[i]).toBe(0);
    // row 2 (was row 0): [1,2,3,0]
    expect(p.data[8]).toBe(1);
    expect(p.data[9]).toBe(2);
    expect(p.data[10]).toBe(3);
    expect(p.data[11]).toBe(0);
    // row 3 (was row 1): [4,5,6,0]
    expect(p.data[12]).toBe(4);
    expect(p.data[13]).toBe(5);
    expect(p.data[14]).toBe(6);
    expect(p.data[15]).toBe(0);
  });

  it('7. Mismatched padWidths.length throws', () => {
    const t = new Tensor([3, 4], seq(12));
    expect(() => pad(t, [[1, 1]])).toThrow();
    expect(() =>
      pad(t, [
        [1, 1],
        [1, 1],
        [1, 1],
      ])
    ).toThrow();
  });

  it('8. Reflect mode with pad >= axis size throws', () => {
    const t = new Tensor([3], new Float64Array([1, 2, 3]));
    expect(() => pad(t, [[3, 0]], { mode: 'reflect' })).toThrow();
    expect(() => pad(t, [[2, 3]], { mode: 'reflect' })).toThrow();
  });

  it('9. Axis labels preserved from input', () => {
    const iA = new Index(2, { name: 'row' });
    const iB = new Index(3, { name: 'col' });
    const t = new Tensor([2, 3], seq(6), [iA, iB]);
    const p = pad(t, [
      [1, 0],
      [0, 1],
    ]);
    expect(p.axisLabels).toBeDefined();
    expect(p.axisLabels![0].name).toBe('row');
    expect(p.axisLabels![1].name).toBe('col');
    expect(p.axisLabels![0].id).toBe(iA.id);
    expect(p.axisLabels![1].id).toBe(iB.id);
  });

  it('10. Rank-1 constant pad: [3] → [6] with [2,1]', () => {
    const t = new Tensor([3], new Float64Array([7, 8, 9]));
    const p = pad(t, [[2, 1]]);
    expect([...p.shape]).toEqual([6]);
    expect([...p.data]).toEqual([0, 0, 7, 8, 9, 0]);
  });

  it('11. Rank-3 constant pad', () => {
    // shape [1,1,1] → [3,3,3] with [1,1] on all axes
    const t = new Tensor([1, 1, 1], new Float64Array([42]));
    const p = pad(t, [
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
    expect([...p.shape]).toEqual([3, 3, 3]);
    // center element (index 13 = 1*9+1*3+1) should be 42
    expect(p.data[13]).toBe(42);
    // all others 0
    for (let i = 0; i < 27; i++) {
      if (i !== 13) expect(p.data[i]).toBe(0);
    }
  });

  it('12. Edge mode on 1-D vector [1,1]', () => {
    const t = new Tensor([4], new Float64Array([10, 20, 30, 40]));
    const p = pad(t, [[1, 1]], { mode: 'edge' });
    expect([...p.data]).toEqual([10, 10, 20, 30, 40, 40]);
  });

  it('13. Reflect mode on 1-D vector [1,1]', () => {
    // [a,b,c,d] reflect [1,1] → [b,a,b,c,d,c]
    const t = new Tensor([4], new Float64Array([1, 2, 3, 4]));
    const p = pad(t, [[1, 1]], { mode: 'reflect' });
    expect([...p.shape]).toEqual([6]);
    expect([...p.data]).toEqual([2, 1, 2, 3, 4, 3]);
  });

  it('14. Pad with [0,0] on all axes yields identical data', () => {
    const t = new Tensor([3, 2, 4], seq(24));
    const p = pad(t, [
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    expect([...p.shape]).toEqual([3, 2, 4]);
    expect([...p.data]).toEqual([...t.data]);
  });
});
