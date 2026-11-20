/**
 * #1279, #1155: `resize`, `zeros`, `reshape` and `subset` of a dense matrix with 3 or more axes.
 *
 * The bridge DenseMatrix `resize` had a 1-D and a 2-D branch only, so it dropped every axis
 * after the second (`zeros(1, 0, 0)` had size [1, 0]) and it ignored the `copy` flag of the
 * `resize` factory. `reshape` flattened one level and built two axes. `subset` read one or two
 * selector lists, so a 3-D matrix gave wrong values and a scalar selector kept its axis.
 * The oracle is the mathjs devDependency: each expected value below was read from mathjs 15.2.0
 * and the in-test `expectSame` compares to the live mathjs result as well.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Mat = {
  size(): number[];
  toArray(): unknown;
  resize(size: number[], defaultValue?: unknown, copy?: boolean): Mat;
  reshape(size: number[], copy?: boolean): Mat;
  subset(index: unknown, replacement?: unknown, defaultValue?: unknown): unknown;
};

const matrix = math.matrix as unknown as (data: unknown) => Mat;
const mjMatrix = mathjs.matrix as unknown as (data: unknown) => Mat;
const index = math.index as unknown as Fn;
const mjIndex = mathjs.index as unknown as Fn;
const subset = math.subset as unknown as Fn;
const mjSubset = mathjs.subset as unknown as Fn;
const resize = math.resize as unknown as Fn;
const mjResize = mathjs.resize as unknown as Fn;
const reshape = math.reshape as unknown as Fn;
const mjReshape = mathjs.reshape as unknown as Fn;
const zeros = math.zeros as unknown as Fn;
const ones = math.ones as unknown as Fn;
const mjZeros = mathjs.zeros as unknown as Fn;
const mjOnes = mathjs.ones as unknown as Fn;

const D2 = [
  [1, 2],
  [3, 4],
];
const D3 = [
  [
    [1, 2],
    [3, 4],
  ],
  [
    [5, 6],
    [7, 8],
  ],
];

/** The size of an Array or a matrix. */
function sizeOf(x: unknown): number[] {
  if (x !== null && typeof x === 'object' && !Array.isArray(x)) return (x as Mat).size();
  const s: number[] = [];
  let cur: unknown = x;
  while (Array.isArray(cur)) {
    s.push(cur.length);
    cur = cur[0];
  }
  return s;
}

/** The nested data of an Array or a matrix. */
function dataOf(x: unknown): unknown {
  return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Mat).toArray() : x;
}

function thrown(fn: () => unknown): Error | undefined {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  return undefined;
}

/** The MathTS result has the size and data of the mathjs result. */
function expectSame(actual: unknown, expected: unknown): void {
  expect(sizeOf(actual)).toEqual(sizeOf(expected));
  expect(dataOf(actual)).toEqual(dataOf(expected));
}

describe('#1279 resize keeps every axis', () => {
  it.each([
    [[1, 0, 0], [[]]],
    [
      [2, 0, 3],
      [[], []],
    ],
    [[0, 2, 3], []],
    [[0, 4], []],
  ])('matrix([]).resize(%j)', (size, data) => {
    const m = matrix([]).resize(size as number[]);
    expect(m.size()).toEqual(size);
    expect(m.toArray()).toEqual(data);
    expectSame(m, mjMatrix([]).resize(size as number[]));
  });

  it.each([[[1, 0, 0]], [[2, 3, 0]], [[0, 2, 3]]])(
    'zeros(%j, "dense") keeps every axis',
    (size) => {
      expectSame(zeros(size, 'dense'), mjZeros(size, 'dense'));
      expect(sizeOf(zeros(size, 'dense'))).toEqual(size);
    }
  );

  it('zeros(1, 0, 0) has size [1, 0, 0]', () => {
    expect(sizeOf(zeros(1, 0, 0))).toEqual([1, 0, 0]);
    expectSame(zeros(1, 0, 0), mjZeros(1, 0, 0));
  });

  it('zeros(2, 3, 4) and ones(2, 1, 2) fill every axis', () => {
    expect(sizeOf(zeros(2, 3, 4))).toEqual([2, 3, 4]);
    expect(dataOf(zeros(2, 3, 4))).toEqual(
      Array.from({ length: 2 }, () => Array.from({ length: 3 }, () => [0, 0, 0, 0]))
    );
    expectSame(zeros(2, 3, 4), mjZeros(2, 3, 4));
    expect(dataOf(ones(2, 1, 2))).toEqual([[[1, 1]], [[1, 1]]]);
    expectSame(ones(2, 1, 2), mjOnes(2, 1, 2));
  });

  it('zeros of a huge 3-D size throws the size RangeError before it allocates', () => {
    const e = thrown(() => zeros(1e4, 1e4, 1e4));
    expect(e).toBeInstanceOf(RangeError);
    expect(e!.message).toMatch(/too large/);
  });

  it('resize of a 2-D matrix to 3 axes pads the new axis', () => {
    expect(dataOf(resize(matrix(D2), [2, 2, 2]))).toEqual([
      [
        [1, 0],
        [2, 0],
      ],
      [
        [3, 0],
        [4, 0],
      ],
    ]);
    expectSame(resize(matrix(D2), [2, 2, 2]), mjResize(mjMatrix(D2), [2, 2, 2]));
  });

  it('resize of a 3-D matrix grows, shrinks and drops an axis', () => {
    expect(dataOf(resize(matrix(D3), [2, 2, 3]))).toEqual([
      [
        [1, 2, 0],
        [3, 4, 0],
      ],
      [
        [5, 6, 0],
        [7, 8, 0],
      ],
    ]);
    expect(dataOf(resize(matrix(D3), [2, 2]))).toEqual([
      [1, 3],
      [5, 7],
    ]);
    expect(dataOf(resize(matrix(D3), [1, 1, 1], 5))).toEqual([[[1]]]);
    expectSame(resize(matrix(D3), [2, 2]), mjResize(mjMatrix(D3), [2, 2]));
    expectSame(resize(matrix(D3), [2, 2, 3]), mjResize(mjMatrix(D3), [2, 2, 3]));
  });

  it('resize of a 2-D matrix with a default value is unchanged', () => {
    expect(dataOf(resize(matrix(D2), [3, 3], 9))).toEqual([
      [1, 2, 9],
      [3, 4, 9],
      [9, 9, 9],
    ]);
  });

  it('resize of a 1-D matrix to 2 axes keeps its values (mathjs: [[1, 0], [2, 0]])', () => {
    expect(dataOf(resize(matrix([1, 2]), [2, 2]))).toEqual([
      [1, 0],
      [2, 0],
    ]);
    expectSame(resize(matrix([1, 2]), [2, 2]), mjResize(mjMatrix([1, 2]), [2, 2]));
  });

  it('resize of a 1-D matrix along its axis is unchanged', () => {
    expect(dataOf(resize(matrix([1, 2, 3]), [2]))).toEqual([1, 2]);
    expect(dataOf(resize(matrix([1, 2, 3]), [5], 7))).toEqual([1, 2, 3, 7, 7]);
  });

  it('the resize factory does not change its input', () => {
    const d2 = matrix(D2);
    const r = resize(d2, [3, 3]) as Mat;
    expect(d2.size()).toEqual([2, 2]);
    expect(d2.toArray()).toEqual(D2);
    expect(r).not.toBe(d2);
    expect(r.size()).toEqual([3, 3]);
  });

  it('the method without copy changes the matrix and returns it, as in mathjs', () => {
    const d2 = matrix(D2);
    const r = d2.resize([2, 2, 2]);
    expect(r).toBe(d2);
    expect(d2.size()).toEqual([2, 2, 2]);
    const c = matrix(D2);
    const copy = c.resize([2, 2, 2], 0, true);
    expect(copy).not.toBe(c);
    expect(c.size()).toEqual([2, 2]);
    expect(copy.size()).toEqual([2, 2, 2]);
  });

  it('kron of a 3-D matrix and an empty matrix has size [1, 1, 0], as in mathjs', () => {
    const kron = math.kron as unknown as Fn;
    const mjKron = mathjs.kron as unknown as Fn;
    expect(sizeOf(mjKron([[[1]]], mjZeros(0, 0)))).toEqual([1, 1, 0]);
    expect(sizeOf(kron([[[1]]], zeros(0, 0)))).toEqual([1, 1, 0]);
  });
});

describe('#1155 reshape reads every axis', () => {
  it.each([
    ['d2 to [4]', D2, [4]],
    ['d2 to [2, 2, 1]', D2, [2, 2, 1]],
    ['d3 to [4, 2]', D3, [4, 2]],
    ['d3 to [8]', D3, [8]],
    ['d2 to [-1]', D2, [-1]],
    ['d3 to [2, -1]', D3, [2, -1]],
  ])('reshape(%s)', (_name, data, size) => {
    expectSame(reshape(matrix(data), size), mjReshape(mjMatrix(data), size));
  });

  it('gives the values from the issue', () => {
    expect(dataOf(reshape(matrix(D2), [4]))).toEqual([1, 2, 3, 4]);
    expect(dataOf(reshape(matrix(D2), [2, 2, 1]))).toEqual([
      [[1], [2]],
      [[3], [4]],
    ]);
    expect(dataOf(reshape(matrix(D3), [4, 2]))).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    expect(sizeOf(reshape(matrix(D2), [-1]))).toEqual([4]);
  });

  it('a size with the wrong element count throws the mathjs RangeError', () => {
    const e = thrown(() => reshape(matrix(D2), [3]));
    expect(e).toBeInstanceOf(RangeError);
    expect(e!.message).toBe('Dimension mismatch (3 != 4)');
    expect(thrown(() => mjReshape(mjMatrix(D2), [3]))!.message).toBe(e!.message);
  });

  it('the method form reshapes, and the input is unchanged', () => {
    const d2 = matrix(D2);
    expect(dataOf(d2.reshape([4]))).toEqual([1, 2, 3, 4]);
    reshape(d2, [4, 1]);
    expect(d2.size()).toEqual([2, 2]);
    expect(d2.toArray()).toEqual(D2);
  });
});

describe('#1155 subset get reads every axis', () => {
  const cases: Array<[string, unknown, unknown[]]> = [
    ['d3 index(1, 0, 1)', D3, [1, 0, 1]],
    ['d3 index(0, [0, 1], 1)', D3, [0, [0, 1], 1]],
    ['d3 index([0, 1], 1, [0, 1])', D3, [[0, 1], 1, [0, 1]]],
    ['d3 index([0, 1], [0, 1], [1])', D3, [[0, 1], [0, 1], [1]]],
    ['d2 index([0, 1], 1)', D2, [[0, 1], 1]],
    ['d2 index(1, [0, 1])', D2, [1, [0, 1]]],
    ['d2 index([0, 1], [1])', D2, [[0, 1], [1]]],
    ['d2 index(0, 0)', D2, [0, 0]],
    ['1-D index([0, 2])', [1, 2, 3], [[0, 2]]],
    ['1-D index(1)', [1, 2, 3], [1]],
  ];

  it.each(cases)('%s on a matrix gives the mathjs result', (_name, data, sel) => {
    const actual = subset(matrix(data), index(...sel));
    const expected = mjSubset(mjMatrix(data), mjIndex(...sel));
    if (typeof expected === 'number') expect(actual).toBe(expected);
    else expectSame(actual, expected);
  });

  it.each(cases)('%s on a plain Array gives the mathjs result', (_name, data, sel) => {
    const actual = subset(data, index(...sel));
    const expected = mjSubset(data, mjIndex(...sel));
    if (typeof expected === 'number') expect(actual).toBe(expected);
    else expectSame(actual, expected);
  });

  it('gives the values and sizes of the issue', () => {
    expect(subset(matrix(D3), index(1, 0, 1))).toBe(6);
    const col = subset(matrix(D3), index(0, [0, 1], 1)) as Mat;
    expect(col.size()).toEqual([2]);
    expect(col.toArray()).toEqual([2, 4]);
    const plane = subset(matrix(D3), index([0, 1], 1, [0, 1])) as Mat;
    expect(plane.size()).toEqual([2, 2]);
    expect(plane.toArray()).toEqual([
      [3, 4],
      [7, 8],
    ]);
    // A scalar selector drops its axis; an array selector of one index keeps it.
    expect((subset(matrix(D2), index([0, 1], 1)) as Mat).size()).toEqual([2]);
    expect((subset(matrix(D2), index([0, 1], [1])) as Mat).size()).toEqual([2, 1]);
  });

  it('an index with too few dimensions throws the mathjs RangeError', () => {
    const e = thrown(() => subset(matrix(D3), index(1)));
    expect(e).toBeInstanceOf(RangeError);
    expect(e!.message).toBe('Dimension mismatch (1 != 3)');
    expect(thrown(() => mjSubset(mjMatrix(D3), mjIndex(1)))!.message).toBe(e!.message);
  });

  it('an index out of range throws an IndexError, not a TypeError', () => {
    const e = thrown(() => subset(matrix(D2), index(2, 0)));
    expect(e).toBeInstanceOf(RangeError);
    expect(e!.message).toMatch(/Index out of range/);
    expect(thrown(() => mjSubset(mjMatrix(D2), mjIndex(2, 0)))!.message).toBe(e!.message);
  });

  it('the row and column functions keep their shapes', () => {
    expectSame(
      (math.row as unknown as Fn)(matrix(D2), 1),
      (mathjs.row as unknown as Fn)(mjMatrix(D2), 1)
    );
    expect(sizeOf((math.row as unknown as Fn)(matrix(D2), 1))).toEqual([1, 2]);
    expect(sizeOf((math.column as unknown as Fn)(matrix(D2), 1))).toEqual([2, 1]);
  });

  it('the expression A[2, :] and A[:, 2] give a vector, as in mathjs', () => {
    const evaluate = math.evaluate as unknown as Fn;
    // The scope holds A: assignment in an expression is disabled by default.
    const row = evaluate('A[2,:]', { A: matrix(D2) });
    const col = evaluate('A[:,2]', { A: matrix(D2) });
    // mathjs: the same expressions give size [2] (`evaluate('A=[1,2;3,4]; A[2,:]')` is a ResultSet).
    const mjRow = (mathjs.evaluate as unknown as Fn)('A[2,:]', { A: mjMatrix(D2) });
    expect(sizeOf(mjRow)).toEqual([2]);
    expect(sizeOf(row)).toEqual([2]);
    expect(dataOf(row)).toEqual([3, 4]);
    expect(sizeOf(col)).toEqual([2]);
    expect(dataOf(col)).toEqual([2, 4]);
  });

  it('diag of a 3-D matrix still throws the two-dimensional error', () => {
    const e = thrown(() => (math.diag as unknown as Fn)(matrix(D3)));
    expect(e).toBeInstanceOf(RangeError);
    expect(e!.message).toBe('Matrix for function diag must be 2 dimensional');
  });
});

describe('#1155 subset set reads every axis', () => {
  const D3_SET_SCALAR = [
    [
      [1, 2],
      [3, 4],
    ],
    [
      [5, 60],
      [7, 8],
    ],
  ];

  it('sets one entry of a 3-D matrix', () => {
    expect(dataOf(subset(matrix(D3), index(1, 0, 1), 60))).toEqual(D3_SET_SCALAR);
    expect(dataOf(subset(D3, index(1, 0, 1), 60))).toEqual(D3_SET_SCALAR);
  });

  it('sets a plane of a 3-D matrix', () => {
    const r = subset(matrix(D3), index(1, [0, 1], [0, 1]), [
      [9, 8],
      [7, 6],
    ]);
    expect(dataOf(r)).toEqual([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [9, 8],
        [7, 6],
      ],
    ]);
    expectSame(
      r,
      mjSubset(mjMatrix(D3), mjIndex(1, [0, 1], [0, 1]), [
        [9, 8],
        [7, 6],
      ])
    );
  });

  it('sets a row of a 3-D matrix from a vector', () => {
    const r = subset(matrix(D3), index(0, 1, [0, 1]), [9, 8]);
    expect(dataOf(r)).toEqual([
      [
        [1, 2],
        [9, 8],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ]);
    expectSame(r, mjSubset(mjMatrix(D3), mjIndex(0, 1, [0, 1]), [9, 8]));
  });

  it('sets a row of a 2-D matrix from a vector (was [9, 9])', () => {
    const r = subset(matrix(D2), index(1, [0, 1]), [9, 8]);
    expect(dataOf(r)).toEqual([
      [1, 2],
      [9, 8],
    ]);
    expectSame(r, mjSubset(mjMatrix(D2), mjIndex(1, [0, 1]), [9, 8]));
  });

  it('sets every entry from a scalar (was null)', () => {
    const r = subset(matrix(D2), index([0, 1], [0, 1]), 5);
    expect(dataOf(r)).toEqual([
      [5, 5],
      [5, 5],
    ]);
    expectSame(r, mjSubset(mjMatrix(D2), mjIndex([0, 1], [0, 1]), 5));
  });

  it('sets a column from a column matrix', () => {
    const r = subset(matrix(D2), index([0, 1], 1), [[9], [8]]);
    expect(dataOf(r)).toEqual([
      [1, 9],
      [3, 8],
    ]);
    expectSame(r, mjSubset(mjMatrix(D2), mjIndex([0, 1], 1), [[9], [8]]));
  });

  it('a replacement with the wrong shape throws the Dimension mismatch RangeError, as mathjs', () => {
    for (const sel of [
      [[0, 1], 1],
      [[0, 1], [1]],
    ]) {
      const e = thrown(() => subset(matrix(D2), index(...sel), [9, 8]));
      expect(e).toBeInstanceOf(RangeError);
      expect(e!.message).toMatch(/Dimension mismatch/);
      expect(thrown(() => mjSubset(mjMatrix(D2), mjIndex(...sel), [9, 8]))).toBeInstanceOf(
        RangeError
      );
    }
  });

  it('the input matrix is not changed by subset(matrix, index, value)', () => {
    const d3 = matrix(D3);
    subset(d3, index(1, 0, 1), 60);
    expect(d3.toArray()).toEqual(D3);
  });
});
