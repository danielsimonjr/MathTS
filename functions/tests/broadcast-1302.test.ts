/**
 * #1302, #1007 item 3: element-wise `add`, `subtract` and `mod` broadcast like mathjs.
 *
 * The walk of `elementwiseNumber` zipped the OUTER axis and required equal lengths, so a 1-D
 * operand against a 2-D one aligned with the first axis, not the last. Now the axes are
 * right-aligned and a size-1 axis stretches (NumPy and mathjs rule). The oracle is the mathjs
 * devDependency (15.2.0): every expected value below was read from it, and the live mathjs call
 * is compared as well.
 *
 * `dotMultiply`, `dotDivide` and `dotPow` are the mathjs factories and broadcast correctly at
 * base; their tests below are pins, not RED tests.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const add = math.add as unknown as Fn;
const subtract = math.subtract as unknown as Fn;
const mod = math.mod as unknown as Fn;
const dotMultiply = math.dotMultiply as unknown as Fn;
const dotDivide = math.dotDivide as unknown as Fn;
const dotPow = math.dotPow as unknown as Fn;
const matrix = math.matrix as unknown as (d: unknown) => { toArray(): unknown; size(): number[] };
const sparse = math.sparse as unknown as (d: unknown) => { toArray(): unknown };
const zeros = math.zeros as unknown as Fn;
const mj = mathjs as unknown as Record<string, Fn>;

const A = [
  [1, 2],
  [3, 4],
];

/** The nested Array of a matrix, or the value itself. */
function plain(x: unknown): unknown {
  const t = (x as { toArray?: () => unknown } | null)?.toArray;
  return typeof t === 'function' ? t.call(x) : x;
}

/** Complex leaves as `re,im` strings, so toEqual can compare them. */
function leaves(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(leaves);
  if (x !== null && typeof x === 'object' && 're' in x && 'im' in x) {
    const c = x as { re: number; im: number };
    return `${c.re},${c.im}`;
  }
  return x;
}

describe('#1302 the three values of the issue', () => {
  it('add([9,8], zeros([2,1])) is [[9,8],[9,8]]', () => {
    expect(plain(add([9, 8], zeros([2, 1])))).toEqual([
      [9, 8],
      [9, 8],
    ]);
    expect(plain(add([9, 8], [[0], [0]]))).toEqual([
      [9, 8],
      [9, 8],
    ]);
  });
  it('add([[1,2],[3,4]], [10,20]) is [[11,22],[13,24]]', () => {
    expect(add(A, [10, 20])).toEqual([
      [11, 22],
      [13, 24],
    ]);
    expect(plain(mj.add(A, [10, 20]))).toEqual([
      [11, 22],
      [13, 24],
    ]);
  });
  it('add([[1,2],[3,4]], [[10],[20]]) is [[11,12],[23,24]]', () => {
    expect(add(A, [[10], [20]])).toEqual([
      [11, 12],
      [23, 24],
    ]);
  });
});

describe('#1007 item 3: add(matrix([1,2]), 2x2)', () => {
  it('matrix + matrix gives a dense matrix with the mathjs values', () => {
    const r = add(matrix([1, 2]), matrix(A)) as { toArray(): unknown; size(): number[] };
    expect(r.toArray()).toEqual([
      [2, 4],
      [4, 6],
    ]);
    expect(r.size()).toEqual([2, 2]);
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
  });
  it('the mixed Array / matrix call has the same values (its class is #993)', () => {
    expect(plain(add(matrix([1, 2]), A))).toEqual([
      [2, 4],
      [4, 6],
    ]);
    expect(plain(add(A, matrix([1, 2])))).toEqual([
      [2, 4],
      [4, 6],
    ]);
  });
});

describe('element-wise broadcast, values read from mathjs 15.2.0', () => {
  const cases: Array<[string, Fn, unknown, unknown, unknown]> = [
    ['add [1] + [1,2,3]', add, [1], [1, 2, 3], [2, 3, 4]],
    [
      'add row + column',
      add,
      [[1, 2]],
      [[1], [2]],
      [
        [2, 3],
        [3, 4],
      ],
    ],
    [
      'add [[1]] + 2x2',
      add,
      [[1]],
      A,
      [
        [2, 3],
        [4, 5],
      ],
    ],
    ['add 3-D + vector', add, [[[1]], [[2]]], [10, 20], [[[11, 21]], [[12, 22]]]],
    [
      'subtract vector - 2x2',
      subtract,
      [10, 20],
      A,
      [
        [9, 18],
        [7, 16],
      ],
    ],
    [
      'subtract 2x2 - vector',
      subtract,
      A,
      [10, 20],
      [
        [-9, -18],
        [-7, -16],
      ],
    ],
    [
      'subtract 2x2 - column',
      subtract,
      A,
      [[10], [20]],
      [
        [-9, -8],
        [-17, -16],
      ],
    ],
    [
      'mod 2x2 by vector',
      mod,
      A,
      [2, 3],
      [
        [1, 2],
        [1, 1],
      ],
    ],
  ];
  for (const [name, fn, a, b, expected] of cases) {
    it(name, () => {
      expect(fn(a, b)).toEqual(expected);
    });
  }

  it('the live mathjs gives the same values for each case', () => {
    const live: Record<string, Fn> = { add: mj.add, subtract: mj.subtract, mod: mj.mod };
    for (const [name, fn, a, b] of cases) {
      const key = name.split(' ')[0];
      expect(plain(fn(a, b))).toEqual(plain(live[key](a, b)));
    }
  });

  it('Complex leaves broadcast the same way', () => {
    const row = [math.complex(0, 1), math.complex(0, 2)];
    const r = add(A, row);
    expect(leaves(r)).toEqual([
      ['1,1', '2,2'],
      ['3,1', '4,2'],
    ]);
    expect(leaves(plain(mj.add(A, [mathjs.complex(0, 1), mathjs.complex(0, 2)])))).toEqual(
      leaves(r)
    );
  });

  it('a sparse pair broadcasts to the mathjs value', () => {
    const r = add(sparse(A), sparse([[10], [20]]));
    expect(plain(r)).toEqual([
      [11, 12],
      [23, 24],
    ]);
  });
});

describe('shapes that cannot broadcast', () => {
  it('add([[1,2,3],[4,5,6]], [1,2]) throws RangeError (it returned a value before)', () => {
    const run = () =>
      add(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        [1, 2]
      );
    expect(run).toThrow(RangeError);
    expect(run).toThrow('Dimension mismatch (3 != 2) in element-wise operation');
    expect(() =>
      mj.add(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        [1, 2]
      )
    ).toThrow();
  });
  it('add([1,2,3], [1,2]) keeps its RangeError text', () => {
    expect(() => add([1, 2, 3], [1, 2])).toThrow(RangeError);
    expect(() => add([1, 2, 3], [1, 2])).toThrow(
      'Dimension mismatch (3 != 2) in element-wise operation'
    );
  });
  it('a size-1 axis does not stretch to a size-0 axis: add([1], []) throws', () => {
    expect(() => add([1], [])).toThrow(RangeError);
    expect(() => mj.add([1], [])).toThrow();
  });
  it('add([], []) is []', () => {
    expect(add([], [])).toEqual([]);
    expect(plain(mj.add([], []))).toEqual([]);
  });
});

describe('same-shape calls keep their values (the fast path)', () => {
  it('add(A, A), add([1,2,3],[4,5,6]), add(A, 5)', () => {
    expect(add(A, A)).toEqual([
      [2, 4],
      [6, 8],
    ]);
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(add(A, 5)).toEqual([
      [6, 7],
      [8, 9],
    ]);
    expect(subtract([5, 7], [1, 2])).toEqual([4, 5]);
  });
});

describe('PIN (green at base): dotMultiply, dotDivide and dotPow already broadcast', () => {
  it('dotMultiply(A, [10,20])', () => {
    expect(plain(dotMultiply(A, [10, 20]))).toEqual([
      [10, 40],
      [30, 80],
    ]);
  });
  it('dotDivide(A, [10,20])', () => {
    expect(plain(dotDivide(A, [10, 20]))).toEqual(plain(mj.dotDivide(A, [10, 20])));
  });
  it('dotPow(A, [1,2])', () => {
    expect(plain(dotPow(A, [1, 2]))).toEqual([
      [1, 4],
      [3, 16],
    ]);
  });
});
