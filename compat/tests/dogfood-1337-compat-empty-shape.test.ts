/**
 * The compat arithmetic shims read the size of an operand from its nested data. A matrix with a
 * zero axis has the nested form `[]`, which gives no second axis, so:
 *  - a public CSR matrix of size 0 x 3 threw "DenseMatrix nested array must be a non-empty
 *    rectangular array of numbers" (the original #1278 message), and
 *  - a result of size 0 x 3 left the shim as the Array `[]`, which reads as a 0 x 0 matrix.
 * The size of an operand comes from `rows` and `cols` (public classes) or `size()` (bridge
 * classes), and a result with a zero axis stays a matrix, because an Array cannot hold it.
 */
import { describe, expect, it } from 'vitest';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const m = create(all) as unknown as Record<string, Fn>;

const sizeOf = (r: unknown): unknown[] => {
  if (Array.isArray(r)) return ['Array', JSON.stringify(r)];
  const x = r as { size?: unknown; rows: number; cols: number };
  return typeof x.size === 'function' ? (x.size as () => number[])() : [x.rows, x.cols];
};
const dense = (r: number, c: number) => DenseMatrix.zeros(r, c);
const csr = (r: number, c: number) => SparseMatrix.fromDense(DenseMatrix.zeros(r, c));

describe('compat add, subtract and multiply keep the size of an empty matrix', () => {
  it.each([
    [0, 3],
    [3, 0],
    [0, 0],
  ])(
    'add and subtract of two public CSR %i x %i matrices do not throw and keep the size',
    (r, c) => {
      expect(sizeOf(m.add(csr(r, c), csr(r, c)))).toEqual([r, c]);
      expect(sizeOf(m.subtract(csr(r, c), csr(r, c)))).toEqual([r, c]);
    }
  );

  it.each([
    [0, 3],
    [3, 0],
  ])('add and subtract of two native dense %i x %i matrices give a matrix of that size', (r, c) => {
    expect(sizeOf(m.add(dense(r, c), dense(r, c)))).toEqual([r, c]);
    expect(sizeOf(m.subtract(dense(r, c), dense(r, c)))).toEqual([r, c]);
  });

  it('add of a 0 x 3 matrix and a scalar keeps the size', () => {
    expect(sizeOf(m.add(dense(0, 3), 1))).toEqual([0, 3]);
    expect(sizeOf(m.add(1, dense(0, 3)))).toEqual([0, 3]);
  });

  it('add of two bridge 0 x 3 matrices keeps the size', () => {
    expect(sizeOf(m.add(m.zeros(0, 3), m.zeros(0, 3)))).toEqual([0, 3]);
  });

  it('multiply of 0 x 2 and 2 x 0 is 0 x 0, and of 0 x 3 and 3 x 2 is 0 x 2', () => {
    expect(sizeOf(m.multiply(dense(0, 2), dense(2, 0)))).toEqual([0, 0]);
    expect(sizeOf(m.multiply(dense(0, 3), dense(3, 2)))).toEqual([0, 2]);
  });

  it('a non-empty result is unchanged: Array for public operands, as before', () => {
    const d22 = () =>
      DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
    expect(m.add(d22(), d22())).toEqual([
      [2, 4],
      [6, 8],
    ]);
    expect(m.add([[1]], [[2]])).toEqual([[3]]);
  });

  it('the Array [] is still the 0 x 0 matrix', () => {
    expect(m.add([], [])).toEqual([]);
  });
});
