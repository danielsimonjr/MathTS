/**
 * Input of the matrix functions `matrixExpm`, `matrixLogm` and `matrixSqrtm`.
 *
 * Each of the three functions reads its argument as a `DenseMatrix`. This module turns every
 * input that the decompositions accept into one, so the three functions take the same inputs.
 */

import { isEmpty2DSize, matrixSize } from '@danielsimonjr/mathts-core/internal';
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
 * package is read through `toArray`, and the nested result is checked like any nested array. The
 * nested result of a matrix with a zero axis does not show its size (`toArray()` of a 0 x 3
 * matrix is `[]`), so such a matrix takes its size from the core reader `matrixSize`. The size
 * `[0]` (`matrix([])`) is the 0 x 0 matrix. Every other input goes to
 * `decompositionInputToDenseMatrix`.
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
      const size = matrixSize(A);
      if (size !== undefined && isEmpty2DSize(size)) {
        return new DenseMatrix(size[0], size[1], new Float64Array(0));
      }
      return decompositionInputToDenseMatrix((A as { toArray(): number[][] }).toArray());
    }
  }
  return decompositionInputToDenseMatrix(A as DecompositionMatrixInput);
}
