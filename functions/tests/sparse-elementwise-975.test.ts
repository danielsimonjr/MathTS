/**
 * #975 items 3, 3b (comment) and 5: element-wise functions of a sparse or a dense factory matrix.
 *
 * - `sqrt`, `square` and `exp` of a CSC matrix return a `MathJSSparseMatrix` (pins, green at
 *   base).
 * - `sqrt` of a matrix with a negative entry gave a plain Array of Complex. The cause is
 *   `unaryOnMatrix` (`typed/f64-kernels.ts`), shared by every function of `unaryCollection`
 *   (`log`, `asin`, ...): a leaf that leaves the real domain returned the nested array for EVERY
 *   matrix class. A factory matrix now keeps its class with the Complex entries. A matrix of the
 *   matrix package (Float64 storage) keeps the nested array, which its published overload
 *   declares. mathjs throws for all three; the factory result is a documented extension.
 * - `sqrt(matrix([4, -1]))` (a matrix of size [2]) gave `[2, NaN]`: the real-domain scan read
 *   `rows x cols` entries only, and a 1-D matrix has `cols` 0.
 * - `dotDivide(sparse zeros, Array)` is a deliberate mathjs parity (item 5).
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { isComplex } from '@danielsimonjr/mathts-core';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Csc = {
  _values: unknown[];
  _index: number[];
  _ptr: number[];
  toArray(): unknown[][];
  size(): number[];
  constructor: { name: string };
};
const sqrt = math.sqrt as unknown as Fn;
const square = math.square as unknown as Fn;
const exp = math.exp as unknown as Fn;
const log = math.log as unknown as Fn;
const dotDivide = math.dotDivide as unknown as Fn;
const sparse = math.sparse as unknown as (d: unknown) => Csc;
const matrix = math.matrix as unknown as (d: unknown) => Csc;
const mj = mathjs as unknown as Record<string, Fn>;

describe('#975 item 3 (pins): sqrt, square and exp of a CSC matrix are CSC matrices', () => {
  const m = [
    [4, 0],
    [0, 9],
  ];
  it('sqrt', () => {
    const r = sqrt(sparse(m)) as Csc;
    expect(r.constructor.name).toBe('MathJSSparseMatrix');
    expect(r.toArray()).toEqual([
      [2, 0],
      [0, 3],
    ]);
  });
  it('square', () => {
    const r = square(sparse(m)) as Csc;
    expect(r.constructor.name).toBe('MathJSSparseMatrix');
    expect(r.toArray()).toEqual([
      [16, 0],
      [0, 81],
    ]);
  });
  it('exp', () => {
    expect((exp(sparse(m)) as Csc).constructor.name).toBe('MathJSSparseMatrix');
  });
});

describe('#975 item 3b: a leaf outside the real domain keeps the class of a factory matrix', () => {
  it('sqrt of a CSC matrix with a negative entry is a CSC matrix with Complex i at (1,1)', () => {
    const r = sqrt(
      sparse([
        [4, 0],
        [0, -1],
      ])
    ) as Csc;
    expect(r.constructor.name).toBe('MathJSSparseMatrix');
    expect(r._index).toEqual([0, 1]);
    expect(r._ptr).toEqual([0, 1, 2]);
    const out = r.toArray();
    expect(out[0][0]).toBe(2);
    expect(isComplex(out[1][1])).toBe(true);
    const c = out[1][1] as { re: number; im: number };
    expect([c.re, c.im]).toEqual([0, 1]);
  });
  it('sqrt of a factory dense matrix with a negative entry is a dense factory matrix', () => {
    const r = sqrt(
      matrix([
        [4, 0],
        [0, -1],
      ])
    ) as Csc;
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
    expect(isComplex(r.toArray()[1][1])).toBe(true);
  });
  it('log of a factory dense matrix with a negative entry is a dense factory matrix', () => {
    const r = log(matrix([[1, -1]])) as Csc;
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
    expect(isComplex(r.toArray()[0][1])).toBe(true);
  });
  it('sqrt of a public CSR matrix with a negative entry stays a nested Array (declared type)', () => {
    const csr = SparseMatrix.fromDense(
      DenseMatrix.fromArray([
        [4, 0],
        [0, -1],
      ])
    );
    const r = sqrt(csr);
    expect(Array.isArray(r)).toBe(true);
    expect(isComplex((r as unknown[][])[1][1])).toBe(true);
  });
  it('sqrt of a public DenseMatrix with a negative entry stays a nested Array (declared type)', () => {
    const r = sqrt(
      DenseMatrix.fromArray([
        [4, 0],
        [0, -1],
      ])
    );
    expect(Array.isArray(r)).toBe(true);
    expect(isComplex((r as unknown[][])[1][1])).toBe(true);
  });
  it('an all-real matrix keeps its class and its values', () => {
    const r = sqrt(matrix([[4, 9]])) as Csc;
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
    expect(r.toArray()).toEqual([[2, 3]]);
  });
});

describe('#975 sqrt of a 1-D factory matrix (a matrix of size [n])', () => {
  it('sqrt(matrix([4,-1])) is a dense matrix of size [2] with 2 and Complex i', () => {
    const r = sqrt(matrix([4, -1])) as unknown as Csc;
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
    expect(r.size()).toEqual([2]);
    const out = r.toArray() as unknown[];
    expect(out[0]).toBe(2);
    expect(isComplex(out[1])).toBe(true);
    const c = out[1] as { re: number; im: number };
    expect([c.re, c.im]).toEqual([0, 1]);
  });
  it('sqrt([4,-1]) (an Array) is the same values', () => {
    const out = sqrt([4, -1]) as unknown[];
    expect(out[0]).toBe(2);
    expect(isComplex(out[1])).toBe(true);
  });
  it('an all-real 1-D matrix keeps its values', () => {
    const r = sqrt(matrix([4, 9])) as unknown as Csc;
    expect(r.toArray()).toEqual([2, 3]);
  });
});

describe('#975 item 5 (deliberate parity): dotDivide of a sparse zero matrix by an Array', () => {
  it('gives a sparse zero matrix, as mathjs 15.2.0 does; the dense call gives NaN', () => {
    const zeros = [
      [0, 0],
      [0, 0],
    ];
    const divisor = [
      [0, 1],
      [1, 1],
    ];
    const sp = dotDivide(sparse(zeros), divisor) as Csc;
    expect(sp.toArray()).toEqual(zeros);
    expect((mj.dotDivide(mathjs.sparse(zeros), divisor) as unknown as Csc).toArray()).toEqual(
      zeros
    );
    const dense = dotDivide(zeros, divisor) as number[][];
    expect(dense[0][0]).toBeNaN();
    expect(dense[0][1]).toBe(0);
  });
});
