/**
 * mathjs 15.3.0 `det` factory port for compat (#1791).
 *
 * The native accelerated `det` uses row scaling that changes the last bits of
 * floating determinants; mathjs uses Bareiss without that step. Empty and
 * non-square empty shapes follow mathjs definitions.
 */
import { notSquareError } from '@danielsimonjr/mathts-core/internal';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { isDenseMatrix } from '@danielsimonjr/mathts-matrix';

type Scalar = unknown;
type MatrixLike = {
  size: () => number[];
  valueOf: () => unknown;
  clone: () => MatrixLike;
};
type AnyFn = (...args: unknown[]) => unknown;

const {
  clone,
  format,
  isMatrix,
  matrix,
  subtractScalar,
  multiply,
  divideScalar,
  isZero,
  unaryMinus,
} = mathFunctions as unknown as {
  clone: (x: unknown) => unknown;
  format: (size: number[], options?: Record<string, unknown>) => string;
  isMatrix: (x: unknown) => boolean;
  matrix: (data: unknown) => MatrixLike;
  subtractScalar: (a: unknown, b: unknown) => unknown;
  multiply: (a: unknown, b: unknown) => unknown;
  divideScalar: (a: unknown, b: unknown) => unknown;
  isZero: (x: unknown) => boolean;
  unaryMinus: (x: unknown) => unknown;
};

function bareissDet(matrixData: Scalar[][], rows: number): Scalar {
  if (rows === 1) {
    return clone(matrixData[0]![0]!);
  }
  if (rows === 2) {
    return subtractScalar(
      multiply(matrixData[0]![0]!, matrixData[1]![1]!),
      multiply(matrixData[1]![0]!, matrixData[0]![1]!)
    );
  }
  const data = matrixData.map((row) => row.slice());
  let negated = false;
  const rowIndices = Array.from({ length: rows }, (_, i) => i);
  for (let k = 0; k < rows; k++) {
    let kIndex = rowIndices[k]!;
    if (isZero(data[kIndex]![k]!)) {
      let swapIndex: number = rows;
      for (let candidate = k + 1; candidate < rows; candidate++) {
        if (!isZero(data[rowIndices[candidate]!]![k]!)) {
          kIndex = rowIndices[candidate]!;
          const tmp = rowIndices[candidate]!;
          rowIndices[candidate] = rowIndices[k]!;
          rowIndices[k] = tmp;
          negated = !negated;
          swapIndex = candidate;
          break;
        }
      }
      if (swapIndex === rows) {
        return data[kIndex]![k]!;
      }
    }
    const piv = data[kIndex]![k]!;
    const pivPrev = k === 0 ? 1 : data[rowIndices[k - 1]!]![k - 1]!;
    for (let i = k + 1; i < rows; i++) {
      const iIndex = rowIndices[i]!;
      for (let j = k + 1; j < rows; j++) {
        data[iIndex]![j] = divideScalar(
          subtractScalar(
            multiply(data[iIndex]![j]!, piv),
            multiply(data[iIndex]![k]!, data[kIndex]![j]!)
          ),
          pivPrev
        );
      }
    }
  }
  const det = data[rowIndices[rows - 1]!]![rows - 1]!;
  return negated ? unaryMinus(det) : det;
}

/**
 * Determinant with mathjs 15.3.0 semantics (Bareiss, empty shapes, sparse).
 */
export function createCompatMathjsDet(native: AnyFn): AnyFn {
  return (...args: unknown[]): unknown => {
    if (args.length !== 1) {
      return native(...args);
    }
    const x = args[0];
    if (x === undefined) {
      return native(...args);
    }
    if (
      typeof x === 'object' &&
      x !== null &&
      (x as { isSparseMatrix?: boolean }).isSparseMatrix === true
    ) {
      return native(x);
    }

    let size: number[];
    let matrixValue: MatrixLike | undefined;
    if (isDenseMatrix(x)) {
      const native = x as unknown as {
        rows: number;
        cols: number;
        clone(): MatrixLike;
        toArray(): unknown;
      };
      const boxed: MatrixLike = {
        clone: () => native.clone(),
        valueOf: () => native.toArray(),
        size: () => [native.rows, native.cols],
      };
      matrixValue = boxed;
      size = boxed.size();
    } else if (isMatrix(x)) {
      matrixValue = x as MatrixLike;
      size = matrixValue.size();
    } else if (Array.isArray(x)) {
      matrixValue = matrix(x);
      size = matrixValue.size();
    } else {
      return clone(x);
    }

    switch (size.length) {
      case 0:
        return clone(x);
      case 1:
        if (size[0] === 1) {
          return clone((matrixValue!.valueOf() as Scalar[])[0]);
        }
        if (size[0] === 0) {
          return 1;
        }
        throw notSquareError('Determinant requires a square matrix');
      case 2: {
        const rows = size[0]!;
        const cols = size[1]!;
        if (rows === cols) {
          const raw = matrixValue!.clone().valueOf() as Scalar[][];
          return bareissDet(raw, rows);
        }
        if (cols === 0) {
          return 1;
        }
        throw notSquareError('Determinant requires a square matrix');
      }
      default:
        throw new RangeError(`Matrix must be two dimensional (size: ${format(size)})`);
    }
  };
}
