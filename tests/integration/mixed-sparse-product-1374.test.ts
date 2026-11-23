import { describe, expect, it } from 'vitest';
import * as mathjs from 'mathjs';
import { divide, matrix, multiply, sparse } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';

const left = [
  [1, 0],
  [2, 3],
];
const right = [
  [2, 0],
  [0, 4],
];
type Product = (a: unknown, b: unknown) => { toArray(): unknown; storage?(): string };

describe('mixed sparse matrix products and quotients (#1346, #1374)', () => {
  it.each(['multiply', 'divide'] as const)('keeps sparse storage in both orders for %s', (name) => {
    const operation = (name === 'multiply' ? multiply : divide) as Product;
    const reference = mathjs[name] as Product;
    const csr = (rows: number[][]): SparseMatrix =>
      SparseMatrix.fromDense(DenseMatrix.fromArray(rows));
    for (const isLeftSparse of [true, false]) {
      const oracle = reference(
        isLeftSparse ? mathjs.sparse(left) : mathjs.matrix(left),
        isLeftSparse ? mathjs.matrix(right) : mathjs.sparse(right)
      );
      const boxed = operation(
        isLeftSparse ? sparse(left) : matrix(left),
        isLeftSparse ? matrix(right) : sparse(right)
      );
      const native = operation(
        isLeftSparse ? csr(left) : DenseMatrix.fromArray(left),
        isLeftSparse ? DenseMatrix.fromArray(right) : csr(right)
      );
      expect(oracle.storage?.()).toBe('sparse');
      expect(boxed.storage?.()).toBe('sparse');
      expect(native).toBeInstanceOf(SparseMatrix);
      expect(boxed.toArray()).toEqual(oracle.toArray());
      expect(native.toArray()).toEqual(oracle.toArray());
    }
  });
});
