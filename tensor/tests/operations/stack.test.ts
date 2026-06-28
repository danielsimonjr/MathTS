/**
 * Tests for stack — stack same-shape tensors along a new axis.
 *
 * Coverage:
 *  1.  Stack two 1-D vectors along axis=0 → 2-D matrix (row-stack).
 *  2.  Stack two 1-D vectors along axis=1 → 2-D matrix (column-stack).
 *  3.  Stack three 2-D matrices along axis=0.
 *  4.  Stack three 3-D tensors along a new axis.
 *  5.  Shape-mismatched inputs throw.
 *  6.  Different-rank inputs throw.
 *  7.  Empty tensors array throws.
 *  8.  `newAxisLabel` option is honored.
 *  9.  Default new axis label is undefined (axisLabels[axis] has no name).
 *  10. Other axis labels from tensors[0] propagate to output.
 *  11. Stack single tensor (trivial case).
 *  12. Stack along negative axis (-1 appends trailing axis).
 *  13. Output rank = input rank + 1.
 *  14. axis out of range throws.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { stack } from '../../src/operations/stack';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arr(values: number[]): Float64Array {
  return new Float64Array(values);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stack', () => {
  it('1. Stack two 1-D vectors along axis=0 → row-stacked 2×n matrix', () => {
    const v1 = new Tensor([3], arr([1, 2, 3]));
    const v2 = new Tensor([3], arr([4, 5, 6]));
    const s = stack([v1, v2], 0);
    expect([...s.shape]).toEqual([2, 3]);
    expect([...s.data]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('2. Stack two 1-D vectors along axis=1 → column-stacked n×2 matrix', () => {
    const v1 = new Tensor([3], arr([1, 2, 3]));
    const v2 = new Tensor([3], arr([4, 5, 6]));
    const s = stack([v1, v2], 1);
    expect([...s.shape]).toEqual([3, 2]);
    // [1,4], [2,5], [3,6] → row-major: [1,4,2,5,3,6]
    expect([...s.data]).toEqual([1, 4, 2, 5, 3, 6]);
  });

  it('3. Stack three 2-D matrices along axis=0', () => {
    const m1 = new Tensor([2, 2], arr([1, 2, 3, 4]));
    const m2 = new Tensor([2, 2], arr([5, 6, 7, 8]));
    const m3 = new Tensor([2, 2], arr([9, 10, 11, 12]));
    const s = stack([m1, m2, m3], 0);
    expect([...s.shape]).toEqual([3, 2, 2]);
    expect([...s.data]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('4. Stack three 2-D tensors along axis=1 (new middle axis)', () => {
    // Input: three tensors of shape [2, 3]; output: [2, 3(new), 3]
    // s[i, ti, k] = tensors[ti][i, k]
    const shape = [2, 3];
    const t1 = new Tensor(shape, new Float64Array(6).fill(1));
    const t2 = new Tensor(shape, new Float64Array(6).fill(2));
    const t3 = new Tensor(shape, new Float64Array(6).fill(3));
    const s = stack([t1, t2, t3], 1);
    expect([...s.shape]).toEqual([2, 3, 3]);
    // Output strides for [2, 3, 3]: [9, 3, 1]
    // s[i, ti, k] — ti is the new axis (axis 1), value = (ti+1)
    for (let i = 0; i < 2; i++) {
      for (let ti = 0; ti < 3; ti++) {
        for (let k = 0; k < 3; k++) {
          expect(s.data[i * 9 + ti * 3 + k]).toBe(ti + 1);
        }
      }
    }
  });

  it('5. Shape-mismatched inputs throw', () => {
    const v1 = new Tensor([3], arr([1, 2, 3]));
    const v2 = new Tensor([4], arr([1, 2, 3, 4]));
    expect(() => stack([v1, v2], 0)).toThrow(/shape mismatch/);
  });

  it('6. Different-rank inputs throw', () => {
    const v1 = new Tensor([3], arr([1, 2, 3]));
    const m2 = new Tensor([1, 3], arr([1, 2, 3]));
    expect(() => stack([v1, m2], 0)).toThrow(/rank/);
  });

  it('7. Empty tensors array throws', () => {
    expect(() => stack([], 0)).toThrow(/non-empty/);
  });

  it('8. newAxisLabel option is honored', () => {
    const i = new Index(3, { name: 'x' });
    const v1 = new Tensor([3], arr([1, 2, 3]), [i]);
    const v2 = new Tensor([3], arr([4, 5, 6]), [i]);
    const newLabel = new Index(2, { name: 'batch' });
    const s = stack([v1, v2], 0, { newAxisLabel: newLabel });
    expect(s.axisLabels).toBeDefined();
    expect(s.axisLabels![0]).toBe(newLabel);
  });

  it('9. Default new axis has no name when inputs have labels', () => {
    const i = new Index(3, { name: 'x' });
    const v1 = new Tensor([3], arr([1, 2, 3]), [i]);
    const v2 = new Tensor([3], arr([4, 5, 6]), [i]);
    const s = stack([v1, v2], 0);
    expect(s.axisLabels).toBeDefined();
    expect(s.axisLabels![0].name).toBeUndefined();
  });

  it('10. Other axis labels from tensors[0] propagate to output', () => {
    const i = new Index(3, { name: 'x' });
    const v1 = new Tensor([3], arr([1, 2, 3]), [i]);
    const v2 = new Tensor([3], arr([4, 5, 6]), [i]);
    const s = stack([v1, v2], 0);
    // axis 0 is new; axis 1 (was axis 0 in input) carries the 'x' label
    expect(s.axisLabels![1]).toBe(i);
  });

  it('11. Stack single tensor (trivial case)', () => {
    const t = new Tensor([2, 3], arr([1, 2, 3, 4, 5, 6]));
    const s = stack([t], 0);
    expect([...s.shape]).toEqual([1, 2, 3]);
    expect([...s.data]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('12. Stack along negative axis (-1 appends trailing axis)', () => {
    const v1 = new Tensor([3], arr([1, 2, 3]));
    const v2 = new Tensor([3], arr([4, 5, 6]));
    // For rank-1 inputs, output rank=2; -1 refers to axis 1
    const s = stack([v1, v2], -1);
    expect([...s.shape]).toEqual([3, 2]);
    // Same as axis=1 case above
    expect([...s.data]).toEqual([1, 4, 2, 5, 3, 6]);
  });

  it('13. Output rank equals input rank + 1', () => {
    const t = new Tensor([2, 3, 4], new Float64Array(24));
    const s = stack([t, t], 0);
    expect(s.shape.length).toBe(4);
  });

  it('14. axis out of range throws', () => {
    const v = new Tensor([3], arr([1, 2, 3]));
    // For rank-1 input, valid output axes are 0 and 1 (and -1,-2). axis=3 is invalid.
    expect(() => stack([v, v], 3)).toThrow(/axis/);
  });
});
