/**
 * Input of the matrix functions `matrixExpm`, `matrixLogm` and `matrixSqrtm`.
 *
 * Each of the three functions reads its argument as a `DenseMatrix`. This module turns every
 * input that the decompositions accept into one, so the three functions take the same inputs.
 */

import { DenseMatrix, isDenseMatrix } from '../types/DenseMatrix.js';
import { isNativeMatrix } from '../types/Matrix.js';
import { decompositionInputToDenseMatrix, type DecompositionMatrixInput } from './as-packed.js';

/**
 * Argument of a matrix function: any {@link DecompositionMatrixInput}, or an object with a
 * `toArray` method that returns a nested array (the MathJS matrix; this package cannot import it).
 */
export type SquareFunctionInput = DecompositionMatrixInput | { toArray(): number[][] };

/**
 * Resolve the argument of a matrix function to a `DenseMatrix`.
 *
 * A `DenseMatrix` is returned as it is (no copy). A matrix of this package that is not dense
 * (`SparseMatrix`) is densified. An object with a `toArray` method that is not a matrix of this
 * package is read through `toArray`, and the nested result is checked like any nested array. An
 * empty result keeps the `rows` and `cols` that the object reports (see `keepReportedShape`).
 * Every other input goes to `decompositionInputToDenseMatrix`.
 *
 * @param A - The argument of the matrix function.
 * @returns The `DenseMatrix` that holds the entries of `A`.
 * @throws {TypeError} if `A` is not an accepted input, or the `toArray` result is not a nested array.
 */
export function squareFunctionInput(A: SquareFunctionInput): DenseMatrix {
  if (isDenseMatrix(A)) return A;
  if (typeof A === 'object' && A !== null && !isNativeMatrix(A)) {
    const duck = A as { toArray?: unknown };
    if (typeof duck.toArray === 'function') {
      const dense = decompositionInputToDenseMatrix((A as { toArray(): number[][] }).toArray());
      return keepReportedShape(A, dense);
    }
  }
  return decompositionInputToDenseMatrix(A as DecompositionMatrixInput);
}

/**
 * `toArray` of an empty matrix loses the shape: a 0 x 3 matrix gives `[]`, which reads as 0 x 0,
 * and 0 x 0 is square. An empty result takes the `rows` and `cols` of the source when it reports
 * them, so the matrix function throws its square error for a 0 x 3 matrix (#1233).
 */
function keepReportedShape(source: object, dense: DenseMatrix): DenseMatrix {
  if (dense.rows * dense.cols !== 0) return dense;
  const { rows, cols } = source as { rows?: unknown; cols?: unknown };
  if (
    typeof rows === 'number' &&
    typeof cols === 'number' &&
    Number.isInteger(rows) &&
    Number.isInteger(cols) &&
    rows >= 0 &&
    cols >= 0 &&
    rows * cols === 0 &&
    (rows !== dense.rows || cols !== dense.cols)
  ) {
    return new DenseMatrix(rows, cols, new Float64Array(0));
  }
  return dense;
}
