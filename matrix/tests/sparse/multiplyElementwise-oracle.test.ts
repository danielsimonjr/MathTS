/**
 * Oracle for sparse Hadamard: independent loop over stored entries of the left operand.
 * M8 (delegate to mapNonZeros) was reverted — the public method keeps the inlined CSR walk.
 */
import { describe, it, expect } from 'vitest';
import { SparseMatrix } from '../../src/types/SparseMatrix.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import type { Matrix } from '../../src/types/Matrix.js';

type CooEntry = { row: number; col: number; value: number };

/** Pre-refactor Hadamard: only nonzeros of `left` can appear in the result. */
function hadamardStoredOracle(left: SparseMatrix, other: Matrix<number>): CooEntry[] {
  const entries: CooEntry[] = [];
  for (const { row, col, value } of left.entries()) {
    const product = value * other.get(row, col);
    if (product !== 0) {
      entries.push({ row, col, value: product });
    }
  }
  return entries;
}

function expectSameStoredStructure(result: SparseMatrix, expectedEntries: CooEntry[]): void {
  const expected = SparseMatrix.fromCOO(result.rows, result.cols, expectedEntries);
  const r = result.getCSR();
  const e = expected.getCSR();
  expect(Array.from(r.values)).toEqual(Array.from(e.values));
  expect(Array.from(r.colIndices)).toEqual(Array.from(e.colIndices));
  expect(Array.from(r.rowPointers)).toEqual(Array.from(e.rowPointers));
}

describe('SparseMatrix.multiplyElementwise oracle (M8)', () => {
  it('matches stored-nonzero oracle for disjoint sparsity', () => {
    const a = SparseMatrix.fromCOO(3, 3, [
      { row: 0, col: 1, value: 2 },
      { row: 2, col: 2, value: -3 },
    ]);
    const b = SparseMatrix.fromCOO(3, 3, [
      { row: 0, col: 0, value: 7 },
      { row: 1, col: 1, value: 4 },
      { row: 2, col: 2, value: 5 },
    ]);
    const oracle = hadamardStoredOracle(a, b);
    expectSameStoredStructure(a.multiplyElementwise(b), oracle);
  });

  it('drops explicit zero product (structural nonzero × implicit zero)', () => {
    const a = SparseMatrix.fromCOO(2, 2, [{ row: 0, col: 1, value: 3 }]);
    const b = SparseMatrix.fromCOO(2, 2, [{ row: 0, col: 0, value: 9 }]);
    const result = a.multiplyElementwise(b);
    expect(result.nnz).toBe(0);
    expect(hadamardStoredOracle(a, b)).toEqual([]);
  });

  it('keeps NaN × 0 and Infinity × 0 per IEEE (left stored, right implicit zero)', () => {
    const a = SparseMatrix.fromCOO(1, 2, [
      { row: 0, col: 0, value: NaN },
      { row: 0, col: 1, value: Infinity },
    ]);
    const b = SparseMatrix.zeros(1, 2);
    const oracle = hadamardStoredOracle(a, b);
    expect(oracle).toHaveLength(2);
    expect(Number.isNaN(oracle[0].value)).toBe(true);
    expect(oracle[1].value).toBeNaN();
    expectSameStoredStructure(a.multiplyElementwise(b), oracle);
  });

  it('handles dense right operand', () => {
    const a = SparseMatrix.fromCOO(2, 2, [
      { row: 0, col: 0, value: 2 },
      { row: 1, col: 1, value: -1 },
    ]);
    const b = new DenseMatrix(2, 2, [
      [3, 0],
      [0, 4],
    ]);
    expectSameStoredStructure(a.multiplyElementwise(b), hadamardStoredOracle(a, b));
  });

  it('empty matrix yields empty structure', () => {
    const a = SparseMatrix.zeros(0, 0);
    const b = SparseMatrix.zeros(0, 0);
    expectSameStoredStructure(a.multiplyElementwise(b), []);
    expect(a.multiplyElementwise(b).nnz).toBe(0);
  });

  it('throws on dimension mismatch', () => {
    const a = SparseMatrix.zeros(2, 3);
    const b = SparseMatrix.zeros(3, 2);
    expect(() => a.multiplyElementwise(b)).toThrow();
  });

  it('preserves -0 as dropped (product is -0)', () => {
    const a = SparseMatrix.fromCOO(1, 1, [{ row: 0, col: 0, value: -0 }]);
    const b = SparseMatrix.fromCOO(1, 1, [{ row: 0, col: 0, value: 1 }]);
    const result = a.multiplyElementwise(b);
    expect(result.nnz).toBe(0);
  });
});
