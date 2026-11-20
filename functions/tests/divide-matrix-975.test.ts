/**
 * #975 (comment on `divide`): `divide(M, M)` and `divide(A, A)` are matrix divisions.
 *
 * mathjs divides a matrix by a matrix as `a * inv(b)`. MathTS threw because only the scalar
 * and `scalar / matrix` rows existed. The collection row calls `multiply(a, inv(b))`, with the
 * public `inv`, so the errors of `inv` pass unchanged. The oracle is the mathjs devDependency
 * (15.2.0): the values below were read from it.
 *
 * The class of a mixed Array / matrix result is #993 (M2): typed-function converts a matrix
 * operand to an Array. These tests pin the VALUES of the mixed calls.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';
import * as compat from '../../compat/src/index.js';

type Fn = (...a: unknown[]) => unknown;
const divide = math.divide as unknown as Fn;
const matrix = math.matrix as unknown as (d: unknown) => { toArray(): unknown };
const sparse = math.sparse as unknown as (d: unknown) => { toArray(): unknown };
const mj = mathjs as unknown as Record<string, Fn>;

const A = [
  [1, 2],
  [3, 4],
];
const I2 = [
  [1, 0],
  [0, 1],
];

/** The nested Array of a matrix, or the value itself. */
function plain(x: unknown): unknown {
  const t = (x as { toArray?: () => unknown } | null)?.toArray;
  return typeof t === 'function' ? t.call(x) : x;
}

/** Round a nested value to 12 places, so an inverse product compares with the identity. */
function round(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(round);
  return typeof x === 'number' ? Math.round(x * 1e12) / 1e12 + 0 : x;
}

describe('#975 divide(matrix, matrix) is a * inv(b)', () => {
  it('divide(A, A) is exactly the identity', () => {
    expect(divide(A, A)).toEqual(I2);
    expect(plain(mj.divide(A, A))).toEqual(I2);
  });
  it('divide(matrix(A), matrix(A)) is a dense identity matrix', () => {
    const r = divide(matrix(A), matrix(A)) as { constructor: { name: string }; toArray(): unknown };
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
    expect(r.toArray()).toEqual(I2);
  });
  it('divide(A, [[2,0],[0,4]]) is [[0.5,0.5],[1.5,1]]', () => {
    expect(
      divide(A, [
        [2, 0],
        [0, 4],
      ])
    ).toEqual([
      [0.5, 0.5],
      [1.5, 1],
    ]);
    expect(
      plain(
        mj.divide(A, [
          [2, 0],
          [0, 4],
        ])
      )
    ).toEqual([
      [0.5, 0.5],
      [1.5, 1],
    ]);
  });
  it('divide(sparse(A), sparse(A)) is a CSC identity with the mathjs structure', () => {
    const r = divide(sparse(A), sparse(A)) as {
      constructor: { name: string };
      _index: number[];
      _ptr: number[];
    };
    const live = mj.divide(mathjs.sparse(A), mathjs.sparse(A)) as unknown as {
      _index: number[];
      _ptr: number[];
    };
    expect(r.constructor.name).toBe('MathJSSparseMatrix');
    expect(round(plain(r))).toEqual(I2);
    expect(r._index).toEqual(live._index);
    expect(r._ptr).toEqual(live._ptr);
  });
  it('mixed Array / dense / sparse calls give the identity values (their class is #993)', () => {
    expect(round(plain(divide(matrix(A), A)))).toEqual(I2);
    expect(round(plain(divide(A, sparse(A))))).toEqual(I2);
    expect(round(plain(divide(sparse(A), matrix(A))))).toEqual(I2);
  });
  it('evaluate("[[1,2],[3,4]] / [[1,2],[3,4]]") is the identity, in functions and in compat', () => {
    const expr = '[[1,2],[3,4]] / [[1,2],[3,4]]';
    expect(round(plain((math.evaluate as unknown as Fn)(expr)))).toEqual(I2);
    const c = compat.create(compat.all) as unknown as { evaluate: Fn };
    expect(round(plain(c.evaluate(expr)))).toEqual(I2);
  });
});

describe('#975 divide errors are the errors of inv', () => {
  it('a non-square divisor: RangeError "Matrix must be square (size: [1, 3])"', () => {
    const run = () => divide(A, [[1, 2, 3]]);
    expect(run).toThrow(RangeError);
    expect(run).toThrow('Matrix must be square (size: [1, 3])');
    expect(() => mj.divide(A, [[1, 2, 3]])).toThrow('Matrix must be square (size: [1, 3])');
  });
  it('a vector divisor of length 2: RangeError "Matrix must be square (size: [2])"', () => {
    const run = () => divide([1, 2], [3, 4]);
    expect(run).toThrow(RangeError);
    expect(run).toThrow('Matrix must be square (size: [2])');
  });
  it('a singular divisor throws; it never gives Infinity or NaN entries', () => {
    const run = () =>
      divide(A, [
        [1, 2],
        [2, 4],
      ]);
    expect(run).toThrow(Error);
    expect(run).toThrow('Cannot calculate inverse, determinant is zero');
    expect(() =>
      mj.divide(A, [
        [1, 2],
        [2, 4],
      ])
    ).toThrow('Cannot calculate inverse, determinant is zero');
  });
});

describe('#975 divide with a divisor of size 1', () => {
  it('divide([[2]], [4]) is [0.5]', () => {
    expect(divide([[2]], [4])).toEqual([0.5]);
    expect(plain(mj.divide([[2]], [4]))).toEqual([0.5]);
  });
  it('divide([2], [4]) is 0.5', () => {
    expect(divide([2], [4])).toBe(0.5);
    expect(mj.divide([2], [4])).toBe(0.5);
  });
});

describe('scalar rows keep their values', () => {
  it('divide(A, 2) and divide(2, A)', () => {
    expect(divide(A, 2)).toEqual([
      [0.5, 1],
      [1.5, 2],
    ]);
    expect(round(plain(divide(2, A)))).toEqual(round(plain(mj.divide(2, A))));
  });
});
