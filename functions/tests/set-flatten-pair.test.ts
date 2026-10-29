import { describe, it, expect } from 'vitest';
import { setUnion, setSymDifference } from '../src/index.js';

describe('flattenSetPair (setUnion / setSymDifference factory handlers)', () => {
  it('both empty', () => {
    expect(setUnion([], [])).toEqual([]);
    expect(setSymDifference([], [])).toEqual([]);
  });

  it('one empty returns the other flattened', () => {
    expect(setUnion([], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(setUnion([1, 2, 3], [])).toEqual([1, 2, 3]);
    expect(setSymDifference([], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(setSymDifference([1, 2, 3], [])).toEqual([1, 2, 3]);
  });

  it('overlap matches documented concat lines', () => {
    expect((setUnion([1, 2, 3, 4], [3, 4, 5, 6]) as number[]).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    const sym = setSymDifference([1, 2, 3, 4], [3, 4, 5, 6]) as number[];
    expect(sym.sort()).toEqual([1, 2, 5, 6]);
  });

  it('nested arrays flatten before combine', () => {
    const u = setUnion(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [3, 4],
        [5, 6],
      ]
    ) as number[];
    expect(u.sort()).toEqual([1, 2, 3, 4, 5, 6]);
    const d = setSymDifference(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [3, 4],
        [5, 6],
      ]
    ) as number[];
    expect(d.sort()).toEqual([1, 2, 5, 6]);
  });
});
