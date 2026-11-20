/**
 * #1155, #1279: the bridge DenseMatrix methods `set`, `get`, `subset`, `reshape` and `resize`
 * follow the mathjs DenseMatrix rules, and `matrix(data)` copies the data of the caller.
 *
 * - An assignment at or after the end of an axis grows the matrix (mathjs `_fit`); a new entry
 *   gets the default value (0 when not given). A negative or non-integer index throws.
 * - `get` checks each index against the size.
 * - The `reshape` method changes its matrix and returns it (a copy only with `copy`).
 * - `resize([])` returns the first entry. The `resize` method takes a Matrix size.
 * - `diag` of a 1-D dense matrix puts numbers on the diagonal.
 * - The sparse matrix has a `reshape` method.
 * The oracle is the mathjs devDependency: each case runs on MathTS and on mathjs and the two
 * results (value, or error class and message) must be equal.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Lib = Record<string, (...a: unknown[]) => unknown>;
const ts = math as unknown as Lib;
const mj = mathjs as unknown as Lib;

/** The plain form of a result: an Array for a matrix, the class and message for an error. */
function outcome(run: (lib: Lib) => unknown, lib: Lib): unknown {
  try {
    const r = run(lib) as { toArray?: () => unknown; size?: () => number[] } | unknown;
    if (r && typeof (r as { toArray?: unknown }).toArray === 'function') {
      const m = r as { toArray(): unknown; size(): number[] };
      return { data: m.toArray(), size: m.size() };
    }
    return { value: r };
  } catch (e) {
    const kind =
      e instanceof TypeError ? 'TypeError' : e instanceof RangeError ? 'RangeError' : 'Error';
    return { error: kind, message: (e as Error).message };
  }
}

function expectSame(run: (lib: Lib) => unknown): void {
  expect(outcome(run, ts)).toEqual(outcome(run, mj));
}

type M = {
  subset(...a: unknown[]): unknown;
  set(...a: unknown[]): unknown;
  get(...a: unknown[]): unknown;
  reshape(...a: unknown[]): unknown;
  resize(...a: unknown[]): unknown;
  size(): number[];
  toArray(): unknown;
};
const mat = (lib: Lib, data: unknown, fmt?: string): M =>
  (fmt ? lib.matrix(data, fmt) : lib.matrix(data)) as M;
const d2 = (): number[][] => [
  [1, 2],
  [3, 4],
];
const D2 = d2();

describe('#1155 assignment outside the matrix grows it (mathjs _fit)', () => {
  const cases: Array<[string, (lib: Lib) => unknown]> = [
    ['subset(index(3), 60)', (l) => mat(l, [1, 2, 3]).subset(l.index(3), 60)],
    ['subset(index(5), 60, 7)', (l) => mat(l, [1, 2, 3]).subset(l.index(5), 60, 7)],
    ['subset(index(-1), 60)', (l) => mat(l, [1, 2, 3]).subset(l.index(-1), 60)],
    ['subset(index(1.5), 7)', (l) => mat(l, [1, 2, 3]).subset(l.index(1.5), 7)],
    ['2-D subset(index(2,0), 7)', (l) => mat(l, d2()).subset(l.index(2, 0), 7)],
    [
      '2-D subset(index([2,3],[0,1]), 2x2)',
      (l) =>
        mat(l, d2()).subset(l.index([2, 3], [0, 1]), [
          [5, 6],
          [7, 8],
        ]),
    ],
    [
      '2-D subset block grow with default',
      (l) => mat(l, d2()).subset(l.index([1, 2], 2), [8, 9], 5),
    ],
    ['subset(index([-1,0]), [1,2])', (l) => mat(l, [1, 2, 3]).subset(l.index([-1, 0]), [1, 2])],
    ['set([4], 9)', (l) => mat(l, [1, 2, 3]).set([4], 9)],
    ['set([2,2], 9, 5)', (l) => mat(l, d2()).set([2, 2], 9, 5)],
    ['set([-1], 9)', (l) => mat(l, [1, 2, 3]).set([-1], 9)],
    ['set([1], 9) on 2-D', (l) => mat(l, d2()).set([1], 9)],
    ['set([0.5], 9)', (l) => mat(l, [1, 2, 3]).set([0.5], 9)],
    ['set 3-D grow', (l) => mat(l, [[[1]]]).set([1, 0, 1], 9)],
    ['get([4])', (l) => mat(l, [1, 2, 3]).get([4])],
    ['get([-1])', (l) => mat(l, [1, 2, 3]).get([-1])],
    ['get([2,0]) on 2-D', (l) => mat(l, d2()).get([2, 0])],
    ['get([0,0,0]) on 3-D', (l) => mat(l, [[[7]]]).get([0, 0, 0])],
    ['subset fn, Array, grow', (l) => l.subset([1, 2, 3], l.index(5), 60, 7)],
    ['subset fn, Array, -1', (l) => l.subset([1, 2, 3], l.index(-1), 60)],
    ['subset fn, Array 2-D, grow', (l) => l.subset(d2(), l.index(2, 0), 7)],
    [
      'subset fn, Array 2-D, block grow',
      (l) =>
        l.subset(d2(), l.index([1, 2], [1, 2]), [
          [5, 6],
          [7, 8],
        ]),
    ],
    ['subset fn, Matrix, grow', (l) => l.subset(mat(l, [1, 2, 3]), l.index(5), 60, 7)],
  ];
  for (const [name, run] of cases) it(name, () => expectSame(run));

  it('a grown matrix keeps a consistent size', () => {
    const m = mat(ts, [1, 2, 3]);
    m.subset(ts.index(3), 60);
    expect(m.size()).toEqual([4]);
    expect(m.toArray()).toEqual([1, 2, 3, 60]);
  });
});

describe('#1155 the reshape method changes its matrix (mathjs DenseMatrix.reshape)', () => {
  it('reshape([4]) changes the matrix and returns it', () => {
    const a = mat(ts, d2());
    const r = a.reshape([4]);
    expect(r).toBe(a);
    expect(a.size()).toEqual([4]);
    expect(a.toArray()).toEqual([1, 2, 3, 4]);
  });
  it('reshape([4], true) returns a copy and keeps the matrix', () => {
    const a = mat(ts, d2());
    const r = a.reshape([4], true) as M;
    expect(r).not.toBe(a);
    expect(a.size()).toEqual([2, 2]);
    expect(r.toArray()).toEqual([1, 2, 3, 4]);
  });
  it('the reshape function keeps its input', () => {
    const a = mat(ts, d2());
    ts.reshape(a, [4]);
    expect(a.size()).toEqual([2, 2]);
  });
  it('reshape with -1', () => expectSame((l) => mat(l, d2()).reshape([-1, 1])));
});

describe('#1279 resize to a scalar and to a Matrix size', () => {
  it('method resize([]) returns the first entry', () => expectSame((l) => mat(l, d2()).resize([])));
  it('function resize(m, []) returns the first entry', () =>
    expectSame((l) => l.resize(mat(l, d2()), [])));
  it('dense method resize(matrix([3,3]))', () =>
    expectSame((l) => mat(l, d2()).resize(l.matrix([3, 3]))));
  it('sparse method resize(matrix([3,3]))', () =>
    expectSame((l) => mat(l, d2(), 'sparse').resize(l.matrix([3, 3]))));
});

describe('#1155 matrix(data) copies the data of the caller', () => {
  it('set does not change the Array of the caller', () => {
    const d = [
      [1, 2],
      [3, 4],
    ];
    mat(ts, d).set([0, 0], 9);
    expect(d).toEqual(D2);
  });
  it('matrix(m) is a copy of m', () => {
    const m = mat(ts, d2());
    const c = ts.matrix(m) as M;
    expect(c).not.toBe(m);
    c.set([0, 0], 9);
    expect(m.get([0, 0])).toBe(1);
  });
  it('matrix(sparse) is a copy', () => {
    const s = mat(ts, d2(), 'sparse');
    const c = ts.matrix(s, 'sparse') as M;
    expect(c).not.toBe(s);
    c.set([0, 0], 9);
    expect(s.get([0, 0])).toBe(1);
  });
});

describe('#1155 diag and sparse reshape', () => {
  it('diag(matrix([2,4])) has numbers on the diagonal', () =>
    expectSame((l) => l.diag(mat(l, [2, 4]))));
  it('diag of a 1-D subset', () =>
    expectSame((l) => l.diag(l.subset(mat(l, d2()), l.index([0, 1], 1)))));
  it('sparse reshape([4,1])', () => expectSame((l) => mat(l, d2(), 'sparse').reshape([4, 1])));
  it('sparse reshape([1,4]) changes the matrix', () => {
    const s = mat(ts, d2(), 'sparse');
    expect(s.reshape([1, 4])).toBe(s);
    expect(s.toArray()).toEqual([[1, 2, 3, 4]]);
  });
  it('sparse reshape to 1-D throws as mathjs', () =>
    expectSame((l) => mat(l, d2(), 'sparse').reshape([4])));
  it('sparse reshape count mismatch', () =>
    expectSame((l) => mat(l, d2(), 'sparse').reshape([3, 1])));
});

describe('#1155 an empty or a large selection', () => {
  it('method subset(index([])) of a vector', () =>
    expectSame((l) => mat(l, [1, 2, 3]).subset(l.index([]))));
  it('function subset(m, index([]))', () =>
    expectSame((l) => l.subset(mat(l, [1, 2, 3]), l.index([]))));
  it('an all-false mask', () =>
    expectSame((l) => l.subset(mat(l, [1, 2, 3]), l.index([false, false, false]))));
  it('method subset of a 2-D matrix with an empty row selection has size [0, 2]', () => {
    // mathjs 15.2.0 gives size [0]: it reads the size back from the empty data. MathTS keeps
    // the size of the selection, as `resize([0, 2])` does in both libraries.
    const r = outcome((l) => mat(l, d2()).subset(l.index([], [0, 1])), ts);
    expect(r).toEqual({ data: [], size: [0, 2] });
  });
  it('an empty selection with an assignment changes nothing', () => {
    // mathjs 15.2.0 throws a broadcast error ("shape mismatch ... size 1 to size 0") here.
    const r = outcome((l) => mat(l, [1, 2, 3]).subset(l.index([]), 5), ts);
    expect(r).toEqual({ data: [1, 2, 3], size: [3] });
  });
  it('a selection of 200000 indices', () => {
    const n = 200000;
    const v = Array.from({ length: n }, (_, i) => i);
    const run = (l: Lib) => mat(l, v).subset(l.index(l.range(0, n)));
    const r = outcome(run, ts) as { size: number[] };
    expect(r.size).toEqual([n]);
  });
});
