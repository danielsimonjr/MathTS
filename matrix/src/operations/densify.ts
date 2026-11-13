/**
 * One entry point that turns a matrix-package sparse matrix into a dense one for
 * the dense solvers. Every solver that accepts a `SparseMatrix` calls it, so the
 * size limit and the type test live in one place.
 */

import type { DenseMatrix } from '../types/DenseMatrix.js';

/**
 * Default cap on `rows * cols` for a densified solver input: 4096 x 4096 doubles,
 * about 134 MB. A larger sparse input throws instead of exhausting memory.
 */
export const DEFAULT_SOLVER_MAX_ELEMENTS = 4096 * 4096;

/** Options for {@link densifyForSolver}. */
export interface DensifyOptions {
  /** Largest `rows * cols` to densify. Defaults to {@link DEFAULT_SOLVER_MAX_ELEMENTS}. */
  maxElements?: number;
}

interface SparseLike {
  rows: number;
  cols: number;
  nnz: number;
  toDense(): DenseMatrix;
}

/**
 * Structural test for a matrix-package `SparseMatrix`. It does not use `instanceof`,
 * so it still works when two copies of the package are loaded.
 */
function isSparseLike(value: unknown): value is SparseLike {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.toDense === 'function' &&
    typeof v.rows === 'number' &&
    typeof v.cols === 'number' &&
    typeof v.nnz === 'number'
  );
}

/**
 * Densifies a matrix-package sparse matrix for a dense solver.
 *
 * @param input - Any value. Only a sparse matrix from this package is converted.
 * @param options - `maxElements` limit on `rows * cols`.
 * @returns The dense matrix, or `undefined` when `input` is not a sparse matrix of this package.
 * @throws {RangeError} if `rows * cols` exceeds `maxElements`.
 */
export function densifyForSolver(
  input: unknown,
  options: DensifyOptions = {}
): DenseMatrix | undefined {
  if (!isSparseLike(input)) return undefined;
  const { maxElements = DEFAULT_SOLVER_MAX_ELEMENTS } = options;
  const size = input.rows * input.cols;
  if (size > maxElements) {
    throw new RangeError(
      `Sparse matrix ${input.rows}x${input.cols} is too large to densify for a dense solver ` +
        `(${size} elements, limit ${maxElements}); pass a larger maxElements or use a sparse method`
    );
  }
  return input.toDense();
}
