import { describe, it, expect } from 'vitest';
import { flattenSetPair, type FlattenSetPairDeps } from '../src/set/flatten-pair.js';
import { flatten } from '../src/utils/array.js';
import { setUnion, setSymDifference } from '../src/index.js';
import type { IndexInterface } from '../src/type/matrix/types.js';

/** Minimal Index that `flattenSetPair` constructs as `new Index(0)`. */
class TestIndex implements IndexInterface {
  readonly isIndex = true;
  readonly type = 'Index';
  constructor(private readonly i: number) {}
  size(): number[] {
    return [1];
  }
  min(): (number | string | undefined)[] {
    return [this.i];
  }
  max(): (number | string | undefined)[] {
    return [this.i];
  }
  dimension(_dim: number): unknown {
    return this.i;
  }
  isScalar(): boolean {
    return true;
  }
  forEach(
    callback: (dimension: unknown, index: number, indexObject: IndexInterface) => void
  ): void {
    callback(this.i, 0, this);
  }
  clone(): IndexInterface {
    return new TestIndex(this.i);
  }
  toArray(): unknown[] {
    return [this.i];
  }
  valueOf(): unknown[] {
    return [this.i];
  }
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
  subset: (dims, index) => {
    const i = index.dimension(0);
    if (typeof i !== 'number') {
      throw new TypeError('TestIndex.dimension(0) must be a number');
    }
    return dims[i] ?? 0;
  },
  Index: TestIndex,
  flatten,
};

type Combine = Parameters<typeof flattenSetPair>[3];

describe('flattenSetPair', () => {
  it('both empty returns flatten of the first empty side and does not call combine', () => {
    let calls = 0;
    const combine: Combine = () => {
      calls += 1;
      return [99];
    };
    expect(flattenSetPair([], [], deps, combine)).toEqual([]);
    expect(calls).toBe(0);
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

describe('setUnion / setSymDifference factory handlers', () => {
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
