/**
 * #1007 item 1 (and item 2 as a pin): `multiply` takes 1-D operands like mathjs.
 *
 * `multiply([1, 2], [3, 4])` threw "requires two 2-D matrices; use dot()". mathjs gives 11. The
 * rules are the mathjs ones: vector x vector is the scalar product of `dot` (it conjugates a
 * Complex entry of the left vector), matrix x vector is a vector and vector x matrix is a vector
 * (neither of these conjugates). The oracle is the mathjs devDependency
 * (15.2.0); each value and error text below was read from it.
 *
 * The result class of a MIXED Array / matrix call (`multiply(matrix(A), [1, 1])`) is #993 (M2):
 * typed-function converts the matrix to an Array, so MathTS returns an Array where mathjs returns
 * a matrix. These tests pin the VALUES of the mixed calls, and the class only for the matrix
 * pairs.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';
import * as compat from '../../compat/src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Mat = { toArray(): unknown; size(): number[]; constructor: { name: string } };
const multiply = math.multiply as unknown as Fn;
const matrix = math.matrix as unknown as (d: unknown) => Mat;
const sparse = math.sparse as unknown as (d: unknown) => Mat;
const bigint = (math as unknown as Record<string, Fn>).bigint;
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

/** A nested value with every level flattened, to compare a [2] result with a [2,1] result. */
function flat(x: unknown): unknown[] {
  return (Array.isArray(x) ? x.flat(Infinity) : [x]) as unknown[];
}

describe('#1007 vector x vector', () => {
  it('multiply([1,2],[3,4]) is 11', () => {
    expect(multiply([1, 2], [3, 4])).toBe(11);
    expect(mj.multiply([1, 2], [3, 4])).toBe(11);
  });
  it('two matrices of one axis give the scalar too', () => {
    expect(multiply(matrix([1, 2]), matrix([3, 4]))).toBe(11);
  });
  it('a Complex vector pair conjugates the left vector (mathjs calls dot): 3+0i', () => {
    const i = math.complex(0, 1);
    const r = multiply([i, 1], [i, 2]) as { re: number; im: number };
    const live = mj.multiply([mathjs.complex(0, 1), 1], [mathjs.complex(0, 1), 2]) as {
      re: number;
      im: number;
    };
    expect([r.re, r.im]).toEqual([live.re, live.im]);
    expect([r.re, r.im]).toEqual([3, 0]);
  });
  it('matrix x vector with Complex entries has no conjugate: [[i,1]] x [i,2] is [1]', () => {
    const i = math.complex(0, 1);
    const r = multiply([[i, 1]], [i, 2]) as Array<{ re: number; im: number }>;
    const live = plain(
      mj.multiply([[mathjs.complex(0, 1), 1]], [mathjs.complex(0, 1), 2])
    ) as Array<{ re: number; im: number }>;
    expect([r[0].re, r[0].im]).toEqual([1, 0]);
    expect([live[0].re, live[0].im]).toEqual([1, 0]);
  });
  it('evaluate("[1,2]*[3,4]") is 11, in functions and in compat', () => {
    expect((math.evaluate as unknown as Fn)('[1,2]*[3,4]')).toBe(11);
    const c = compat.create(compat.all) as unknown as { evaluate: Fn };
    expect(c.evaluate('[1,2]*[3,4]')).toBe(11);
  });
});

describe('#1007 matrix x vector and vector x matrix', () => {
  it('multiply(A, [1,1]) is [3,7]', () => {
    expect(multiply(A, [1, 1])).toEqual([3, 7]);
    expect(plain(mj.multiply(A, [1, 1]))).toEqual([3, 7]);
  });
  it('multiply([1,1], A) is [4,6]', () => {
    expect(multiply([1, 1], A)).toEqual([4, 6]);
    expect(plain(mj.multiply([1, 1], A))).toEqual([4, 6]);
  });
  it('[1,2] x [[1],[2]] is [5]', () => {
    expect(multiply([1, 2], [[1], [2]])).toEqual([5]);
    expect(plain(mj.multiply([1, 2], [[1], [2]]))).toEqual([5]);
  });
  it('[[1,2]] x [1,2] is [5]', () => {
    expect(multiply([[1, 2]], [1, 2])).toEqual([5]);
    expect(plain(mj.multiply([[1, 2]], [1, 2]))).toEqual([5]);
  });
  it('matrix(A) x matrix([1,1]) is a dense matrix of size [2] with [3,7]', () => {
    const r = multiply(matrix(A), matrix([1, 1])) as Mat;
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
    expect(r.size()).toEqual([2]);
    expect(r.toArray()).toEqual([3, 7]);
  });
  it('matrix([1,1]) x matrix(A) is a dense matrix of size [2] with [4,6]', () => {
    const r = multiply(matrix([1, 1]), matrix(A)) as Mat;
    expect(r.size()).toEqual([2]);
    expect(r.toArray()).toEqual([4, 6]);
  });
  it('mixed Array / matrix calls have the mathjs values (their class is #993)', () => {
    expect(plain(multiply(matrix(A), [1, 1]))).toEqual([3, 7]);
    expect(plain(multiply([1, 1], matrix(A)))).toEqual([4, 6]);
    expect(flat(plain(multiply(sparse(A), [1, 1])))).toEqual([3, 7]);
    expect(flat(plain(mj.multiply(mathjs.sparse(A), [1, 1])))).toEqual([3, 7]);
  });
  it('a sparse matrix x a 1-D dense matrix is a sparse column of size [2,1]', () => {
    const r = multiply(sparse(A), matrix([1, 1])) as Mat;
    expect(r.size()).toEqual([2, 1]);
    expect(r.toArray()).toEqual([[3], [7]]);
    expect(r.constructor.name).toBe('MathJSSparseMatrix');
  });
  it('evaluate("[[1,2],[3,4]] * [1,1]") has the value [3,7], in functions and in compat', () => {
    expect(flat(plain((math.evaluate as unknown as Fn)('[[1,2],[3,4]] * [1,1]')))).toEqual([3, 7]);
    const c = compat.create(compat.all) as unknown as { evaluate: Fn };
    expect(flat(plain(c.evaluate('[[1,2],[3,4]] * [1,1]')))).toEqual([3, 7]);
  });
});

describe('#1007 errors carry the mathjs text', () => {
  it('[1,2] x [1,2,3]: RangeError, vectors must have the same length', () => {
    const run = () => multiply([1, 2], [1, 2, 3]);
    expect(run).toThrow(RangeError);
    expect(run).toThrow('Dimension mismatch in multiplication. Vectors must have the same length');
  });
  it('[1,2] x [[1,2,3]]: RangeError, vector length must match matrix rows', () => {
    const run = () => multiply([1, 2], [[1, 2, 3]]);
    expect(run).toThrow(RangeError);
    expect(run).toThrow(
      'Dimension mismatch in multiplication. Vector length (2) must match Matrix rows (1)'
    );
  });
  it('[[1],[2]] x [3,4]: RangeError, matrix columns must match vector length', () => {
    const run = () => multiply([[1], [2]], [3, 4]);
    expect(run).toThrow(RangeError);
    expect(run).toThrow(
      'Dimension mismatch in multiplication. Matrix columns (1) must match Vector length (2)'
    );
  });
  it('[[1,2,3]] x [1,2]: RangeError, matrix columns must match vector length', () => {
    expect(() => multiply([[1, 2, 3]], [1, 2])).toThrow(
      'Dimension mismatch in multiplication. Matrix columns (3) must match Vector length (2)'
    );
  });
  it('[] x []: Error, cannot multiply two empty vectors', () => {
    expect(() => multiply([], [])).toThrow('Cannot multiply two empty vectors');
  });
  it('a 3-D operand: Error, can only multiply a 1 or 2 dimensional matrix', () => {
    expect(() => multiply([[[1]]], [1])).toThrow(
      'Can only multiply a 1 or 2 dimensional matrix (Matrix A has 3 dimensions)'
    );
    expect(() => multiply([1], [[[1]]])).toThrow(
      'Can only multiply a 1 or 2 dimensional matrix (Matrix B has 3 dimensions)'
    );
  });
  it('the old text "requires two 2-D matrices" is gone', () => {
    let message = '';
    try {
      multiply([1, 2], [3, 4, 5]);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toMatch(/requires two 2-D|use dot\(\)/);
  });
  it('a 2-D x 2-D mismatch keeps its text', () => {
    expect(() =>
      multiply(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        A
      )
    ).toThrow('Cannot multiply 2×3 matrix with 2×2 matrix');
  });
});

describe('#1007 item 2: bigint(2.5) (a pin, green at base)', () => {
  it('rounds to 3n as mathjs does', () => {
    expect(bigint(2.5)).toBe(3n);
  });
});
