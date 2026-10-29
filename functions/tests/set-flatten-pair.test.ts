import { describe, it, expect } from 'vitest';
import { flattenSetPair, type FlattenSetPairDeps } from '../src/set/flatten-pair.js';
import { flatten } from '../src/utils/array.js';

class Index {
  constructor(readonly i: number) {}
}

const deps: FlattenSetPairDeps = {
  size: (arr) => {
    if (Array.isArray(arr)) {
      return arr.length === 0 ? [0] : [arr.length];
    }
    const matrix = arr as { size?: () => number[] };
    if (typeof matrix.size === 'function') {
      return matrix.size();
    }
    return [0];
  },
  subset: (dims, index) => dims[(index as Index).i],
  Index: Index as unknown as FlattenSetPairDeps['Index'],
  flatten,
};

type Combine = Parameters<typeof flattenSetPair>[3];

describe('flattenSetPair', () => {
  it('both empty returns flatten of the first empty side', () => {
    const combine: Combine = () => [99];
    expect(flattenSetPair([], [], deps, combine)).toEqual([]);
  });

  it('one empty returns the other flattened and does not call combine', () => {
    let calls = 0;
    const combine: Combine = (b1, b2) => {
      calls += 1;
      return [...b1, ...b2];
    };
    expect(flattenSetPair([], [1, 2, 3], deps, combine)).toEqual([1, 2, 3]);
    expect(flattenSetPair([1, 2, 3], [], deps, combine)).toEqual([1, 2, 3]);
    expect(calls).toBe(0);
  });

  it('overlap invokes combine once with flattened operands', () => {
    let calls = 0;
    const seen: unknown[][] = [];
    const combine: Combine = (b1, b2) => {
      calls += 1;
      seen.push(b1, b2);
      return [...b1, ...b2];
    };
    expect(flattenSetPair([1, 2, 3, 4], [3, 4, 5, 6], deps, combine)).toEqual([
      1, 2, 3, 4, 3, 4, 5, 6,
    ]);
    expect(calls).toBe(1);
    expect(seen).toEqual([
      [1, 2, 3, 4],
      [3, 4, 5, 6],
    ]);
  });

  it('nested arrays flatten before combine', () => {
    let calls = 0;
    const combine: Combine = (b1, b2) => {
      calls += 1;
      return [...b1, ...b2];
    };
    expect(
      flattenSetPair(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [3, 4],
          [5, 6],
        ],
        deps,
        combine
      )
    ).toEqual([1, 2, 3, 4, 3, 4, 5, 6]);
    expect(calls).toBe(1);
  });
});
