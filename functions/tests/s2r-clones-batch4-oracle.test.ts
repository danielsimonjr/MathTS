/**
 * Sprint 2R clone-merge batch 4 (G12, G24–G25, G28–G32) — independent oracles.
 * Pins behavior before deduplicating functions matrix / statistics / string / types.
 */

import { describe, it, expect } from 'vitest';
import DecimalJs from 'decimal.js';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  factory_max as max,
  factory_min as min,
  mapSlices,
  matrixFromColumns,
  matrixFromRows,
  index,
  range,
  factory_sum as sum,
  matrix,
} from '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { print as typedPrint } from '../src/typed/string.js';
import { Decimal } from '../src/type/local/Decimal.js';
import { matrixFromVectorList, vectorLength } from '../src/matrix/from-vectors.js';

const factoryPrint = factoryScope.print as (
  template: string,
  values: Record<string, unknown> | unknown[],
  options?: number | Record<string, unknown>
) => string;

type ImmutableDenseMatrixCtor = new (data: { data: number[][]; size: number[] }) => {
  min(): unknown;
  max(): unknown;
  _min: unknown | null;
  _max: unknown | null;
};

const ImmutableDenseMatrix = factoryScope.ImmutableDenseMatrix as ImmutableDenseMatrixCtor;

function handTranspose2D(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const out: number[][] = [];
  for (let j = 0; j < cols; j++) {
    const row: number[] = [];
    for (let i = 0; i < rows; i++) {
      row.push(m[i][j]);
    }
    out.push(row);
  }
  return out;
}

function flatNumberMax(values: number[]): number {
  return values.reduce((a, b) => (Number.isNaN(b) ? b : Math.max(a, b)), -Infinity);
}

function flatNumberMin(values: number[]): number {
  return values.reduce((a, b) => (Number.isNaN(b) ? b : Math.min(a, b)), Infinity);
}

/** Independent shape oracle for `vectorLength` (not `math.size`). */
function sizeOf(vec: unknown): number[] {
  if (!Array.isArray(vec)) {
    throw new TypeError('sizeOf expects an array');
  }
  if (vec.length === 0) {
    return [0];
  }
  if (Array.isArray(vec[0])) {
    return [vec.length, (vec[0] as unknown[]).length];
  }
  return [vec.length];
}

describe('S2R batch4 — mapSlices / _switch (G12)', () => {
  const A = [
    [1, 2],
    [3, 4],
  ];

  it('column sums match hand transpose then row sums', () => {
    const transposed = handTranspose2D(A);
    const oracle = transposed.map((row) => row.reduce((a, b) => a + b, 0));
    expect(mapSlices(A, 0, sum)).toEqual(oracle);
  });

  it('identity callback along dim 0 equals a hand 2-D transpose', () => {
    expect(mapSlices(A, 0, (col: unknown) => col)).toEqual(handTranspose2D(A));
  });

  it('row sums [3, 7] for [[1,2],[3,4]]', () => {
    expect(mapSlices(A, 1, sum)).toEqual([3, 7]);
  });
});

describe('S2R batch4 — matrixFromColumns / Rows (G24, G25)', () => {
  it('matrixFromColumns: dense two column vectors', () => {
    expect(matrixFromColumns([1, 2, 3], [4, 5, 6])).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('matrixFromRows: dense two row vectors', () => {
    expect(matrixFromRows([1, 2, 3], [4, 5, 6])).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('matrixFromColumns: all sparse Matrix inputs', () => {
    const c1 = matrix([[1], [2], [3]], 'sparse');
    const c2 = matrix([[4], [5], [6]], 'sparse');
    const result = matrixFromColumns(c1, c2) as { storage(): string; toArray(): unknown };
    expect(result.storage()).toBe('sparse');
    expect(result.toArray()).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('matrixFromRows: mixed plain array and Matrix', () => {
    const rowMat = matrix([4, 5, 6]);
    expect(matrixFromRows([1, 2, 3], rowMat)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('matrixFromColumns: mixed plain array and Matrix', () => {
    const colMat = matrix([[4], [5], [6]]);
    expect(matrixFromColumns([1, 2, 3], colMat)).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('matrixFromRows: all sparse Matrix inputs', () => {
    const r1 = matrix([[1, 2, 3]], 'sparse');
    const r2 = matrix([[4, 5, 6]], 'sparse');
    const result = matrixFromRows(r1, r2) as { storage(): string; toArray(): unknown };
    expect(result.storage()).toBe('sparse');
    expect(result.toArray()).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('matrixFromColumns: zero variadic args throws (typed-function guard)', () => {
    expect(() => matrixFromColumns()).toThrow(/Too few arguments in function matrixFromColumns/);
  });

  it('matrixFromRows: zero variadic args throws (typed-function guard)', () => {
    expect(() => matrixFromRows()).toThrow(/Too few arguments in function matrixFromRows/);
  });

  it('matrixFromVectorList empty column throw text', () => {
    const unused = (() => {
      throw new Error('should not be called');
    }) as never;
    expect(() => matrixFromVectorList([], 'column', unused, unused, unused)).toThrow(
      'At least one column is needed to construct a matrix.'
    );
  });

  it('matrixFromVectorList empty row throw text', () => {
    const unused = (() => {
      throw new Error('should not be called');
    }) as never;
    expect(() => matrixFromVectorList([], 'row', unused, unused, unused)).toThrow(
      'At least one row is needed to construct a matrix.'
    );
  });

  it('matrixFromColumns: 2×2 matrix argument throws not a vector', () => {
    expect(() =>
      matrixFromColumns(
        [1, 2],
        [
          [3, 4],
          [5, 6],
        ]
      )
    ).toThrow('At least one of the arguments is not a vector.');
  });

  it('matrixFromRows: 2×2 matrix argument throws not a vector', () => {
    expect(() =>
      matrixFromRows(
        [1, 2],
        [
          [3, 4],
          [5, 6],
        ]
      )
    ).toThrow('At least one of the arguments is not a vector.');
  });

  it('vectorLength: 1-d, row [1,n], col [n,1], 2×2 throw', () => {
    expect(vectorLength([1, 2, 3], sizeOf)).toBe(3);
    expect(vectorLength([[1, 2, 3]], sizeOf)).toBe(3);
    expect(vectorLength([[1], [2], [3]], sizeOf)).toBe(3);
    expect(() =>
      vectorLength(
        [
          [1, 2],
          [3, 4],
        ],
        sizeOf
      )
    ).toThrow('At least one of the arguments is not a vector.');
  });

  it('vectorLength shapes: row [1,n] and col [n,1] accepted for rows', () => {
    expect(matrixFromRows([[1, 2, 3]], [[4], [5], [6]])).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });
});

describe('S2R batch4 — reduceExtreme max/min (G28)', () => {
  it('max [1,3,2] equals Math.max on plain numbers', () => {
    expect(max([1, 3, 2])).toBe(flatNumberMax([1, 3, 2]));
  });

  it('min [1,3,2] equals Math.min on plain numbers', () => {
    expect(min([1, 3, 2])).toBe(flatNumberMin([1, 3, 2]));
  });

  it('max nested array flattens like Math.max spread', () => {
    const nested = [1, [3, 2]];
    expect(max(nested)).toBe(3);
  });

  it('min nested array flattens', () => {
    expect(min([5, [1, 4]])).toBe(1);
  });

  it('max propagates NaN', () => {
    expect(max([1, NaN, 2])).toBeNaN();
  });

  it('min propagates NaN', () => {
    expect(min([1, NaN, 2])).toBeNaN();
  });

  it('max empty throws expected message', () => {
    expect(() => max([])).toThrow('Cannot calculate max of an empty array');
  });

  it('min empty throws expected message', () => {
    expect(() => min([])).toThrow('Cannot calculate min of an empty array');
  });

  it('max improveErrorMessage names max for complex input', () => {
    expect(() => max([1, new Complex(1, 1)])).toThrow(
      /Cannot calculate max, no ordering relation is defined for complex numbers/
    );
  });

  it('min improveErrorMessage names min for complex input', () => {
    expect(() => min([1, new Complex(1, 1)])).toThrow(
      /Cannot calculate min, no ordering relation is defined for complex numbers/
    );
  });
});

describe('S2R batch4 — fillPrintTemplate (G29)', () => {
  const nestedValues = { user: { name: 'Mary' }, pi: Math.PI };

  it('factory and typed print agree on nested $user.name', () => {
    const template = 'Hello $user.name!';
    expect(factoryPrint(template, nestedValues)).toBe('Hello Mary!');
    expect(typedPrint(template, nestedValues)).toBe('Hello Mary!');
  });

  it('factory and typed print leave missing key unchanged', () => {
    const template = 'Hello $missing';
    expect(factoryPrint(template, nestedValues)).toBe('Hello $missing');
    expect(typedPrint(template, nestedValues)).toBe('Hello $missing');
  });

  it('factory and typed print format matrix-like via toArray', () => {
    const template = 'm = $m';
    const values = { m: { isMatrix: true, toArray: () => [1, 2, 3] } };
    expect(factoryPrint(template, values)).toContain('[1, 2, 3]');
    expect(typedPrint(template, values)).toContain('[1, 2, 3]');
    expect(factoryPrint(template, values)).toBe(typedPrint(template, values));
  });

  it('factory and typed print agree on precision 4', () => {
    const template = 'pi is $pi';
    expect(factoryPrint(template, nestedValues, 4)).toBe('pi is 3.142');
    expect(typedPrint(template, nestedValues, 4)).toBe('pi is 3.142');
  });
});

describe('S2R batch4 — Decimal max/min (G30)', () => {
  it('empty max is NaN', () => {
    expect(Decimal.max().toNumber()).toBeNaN();
  });

  it('empty min is NaN', () => {
    expect(Decimal.min().toNumber()).toBeNaN();
  });

  it('max with negatives matches decimal.js', () => {
    const values = [-3, '-1', 0, 2];
    const expected = DecimalJs.max(...values.map((v) => new DecimalJs(v)));
    expect(Decimal.max(...values).toString()).toBe(expected.toString());
  });

  it('min with ties matches decimal.js', () => {
    const values = [5, '5', 5.0];
    const expected = DecimalJs.min(...values.map((v) => new DecimalJs(v)));
    expect(Decimal.min(...values).toString()).toBe(expected.toString());
  });

  it('max string and number inputs match decimal.js', () => {
    const values = ['1.5', 2, '2.0'];
    const expected = DecimalJs.max(...values.map((v) => new DecimalJs(v)));
    expect(Decimal.max(...values).toString()).toBe(expected.toString());
  });

  it('min string and number inputs match decimal.js', () => {
    const values = ['1.5', 2, '0.5'];
    const expected = DecimalJs.min(...values.map((v) => new DecimalJs(v)));
    expect(Decimal.min(...values).toString()).toBe(expected.toString());
  });
});

describe('S2R batch4 — ImmutableDenseMatrix min/max (G31)', () => {
  it('min and max differ on a non-constant matrix', () => {
    const m = new ImmutableDenseMatrix({
      data: [
        [1, 9],
        [3, 4],
      ],
      size: [2, 2],
    });
    expect(m.min()).toBe(1);
    expect(m.max()).toBe(9);
  });

  it('second call uses cache (_min/_max slots)', () => {
    const m = new ImmutableDenseMatrix({
      data: [[2, 5]],
      size: [1, 2],
    });
    expect(m._min).toBe(null);
    expect(m._max).toBe(null);
    const firstMin = m.min();
    const firstMax = m.max();
    expect(m._min).toBe(firstMin);
    expect(m._max).toBe(firstMax);
    expect(m.min()).toBe(firstMin);
    expect(m.max()).toBe(firstMax);
  });
});

describe('S2R batch4 — Index min/max (G32)', () => {
  it('mixed number, string, and range dimensions', () => {
    const idx = index(0, 'prop', range(2, 5)) as {
      min(): (number | string | undefined)[];
      max(): (number | string | undefined)[];
    };
    const mins = idx.min();
    const maxs = idx.max();
    expect(mins[0]).toBe(0);
    expect(mins[1]).toBe('prop');
    expect(maxs[0]).toBe(0);
    expect(maxs[1]).toBe('prop');
    expect(mins[2]).toBe(2);
    expect(maxs[2]).toBe(4);
    expect(mins[2]).toBeLessThan(maxs[2] as number);
  });
});
