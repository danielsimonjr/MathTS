import { describe, it, expect, expectTypeOf } from 'vitest';
import type { NestedArray } from '../src/array.js';
import { deepForEach, deepMap, reduce } from '../src/collection.js';
import { DimensionError } from '../src/error/DimensionError.js';

describe('collection nested types (runtime)', () => {
  it('deepMap preserves nested shape', () => {
    expect(deepMap([[1, 2], [3]], (n) => n + 1)).toEqual([[2, 3], [4]]);
  });

  it('deepForEach visits leaves in order', () => {
    const visited: number[] = [];
    deepForEach([[1, 2], [3]], (n) => visited.push(n));
    expect(visited).toEqual([1, 2, 3]);
  });

  it('reduce of a vector along dim 0 is a scalar', () => {
    expect(reduce([1, 2, 3], 0, (a, b) => Number(a) + Number(b))).toBe(6);
  });

  it('reduce along dim 0 on a matrix matches a loop oracle', () => {
    const mat = [
      [1, 2],
      [3, 4],
    ];
    const result = reduce(mat, 0, (acc, val) => Number(acc) + Number(val));
    const expected = mat[0].map((_, col) => mat.reduce((sum, row) => sum + row[col], 0));
    expect(result).toEqual(expected);
  });

  it('reduce of an empty vector along dim 0 returns undefined (legacy _reduce)', () => {
    expect(reduce([], 0, (a, b) => Number(a) + Number(b))).toBeUndefined();
  });

  it('throws DimensionError when dim is out of range', () => {
    expect(() => reduce([1, 2, 3], 5, (a, b) => Number(a) + Number(b))).toThrow(DimensionError);
    expect(() => reduce([1, 2, 3], -1, (a, b) => Number(a) + Number(b))).toThrow(DimensionError);
  });

  it('skipZeros: true leaves numeric zeros unchanged', () => {
    expect(deepMap([0, 2], (n) => n + 1, true)).toEqual([0, 3]);
  });

  it('skipZeros: true keeps zeros at every depth', () => {
    expect(
      deepMap(
        [
          [0, 2],
          [3, [0]],
        ],
        (n) => n + 1,
        true
      )
    ).toEqual([
      [0, 3],
      [4, [0]],
    ]);
  });
});

/** The smallest object `collection.ts` treats as a matrix: `isMatrix` flag on the prototype. */
class TinyMatrix<T = number> {
  constructor(
    private readonly data: T[],
    private readonly type?: string
  ) {}
  size(): number[] {
    return [this.data.length];
  }
  valueOf(): T[] {
    return this.data;
  }
  datatype(): string | undefined {
    return this.type;
  }
  create(data: T[], datatype?: string): TinyMatrix<T> {
    return new TinyMatrix(data, datatype);
  }
  forEach(callback: (value: T) => void, _skipZeros: boolean, _recurse: boolean): void {
    for (const v of this.data) callback(v);
  }
  map<U>(callback: (value: T) => U, _skipZeros: boolean, _recurse: boolean): TinyMatrix<U> {
    return new TinyMatrix(this.data.map(callback), this.type);
  }
}
(TinyMatrix.prototype as unknown as { isMatrix: boolean }).isMatrix = true;

describe('collection matrix arguments pick the matrix overloads', () => {
  it('deepMap and deepForEach follow the matrix, not the array path', () => {
    const m = new TinyMatrix([1, 2, 3], 'number');
    const mapped = deepMap(m, (n: number) => n * 2);
    expect(mapped).toBeInstanceOf(TinyMatrix);
    expect(mapped.valueOf()).toEqual([2, 4, 6]);
    const seen: number[] = [];
    deepForEach(m, (n: number) => seen.push(n));
    expect(seen).toEqual([1, 2, 3]);
  });

  it('reduce of a matrix returns a matrix that keeps the datatype', () => {
    const m = new TinyMatrix([1, 2, 3], 'number');
    const reduced = reduce(m, 0, (a: number, b: number) => a + b);
    expect(reduced).toBeInstanceOf(TinyMatrix);
    expect(reduced.datatype()).toBe('number');
  });
});

describe('collection overload types (compile-time)', () => {
  it('maps nested arrays to nested arrays without a cast', () => {
    const mapped = deepMap([[1, 2], [3]], (n) => String(n));
    expectTypeOf(mapped).toEqualTypeOf<NestedArray<string>>();
    const kept = deepMap([[0, 2]], (n) => String(n), true);
    expectTypeOf(kept).toEqualTypeOf<NestedArray<number | string>>();
  });

  it('types a vector reduce as the scalar or a nested array', () => {
    const total = reduce([1, 2, 3], 0, (a: number, b: number) => a + b);
    expectTypeOf(total).toEqualTypeOf<number | NestedArray<number>>();
    expectTypeOf(total).not.toEqualTypeOf<number[]>();
  });

  it('types a matrix argument as a matrix result', () => {
    const m = new TinyMatrix([1]);
    expectTypeOf(reduce(m, 0, (a: number, b: number) => a + b)).not.toEqualTypeOf<
      number | NestedArray<number>
    >();
  });
});
