import type { TypedFunction } from '../core/function/typed.js';
import { MathJSDenseMatrix, MathJSSparseMatrix } from '../factories/matrix-bridge.js';
import { cscProduct } from '../typed/sparse-product.js';
import { createMatAlgo11xS0s } from '../type/matrix/utils/matAlgo11xS0s.js';
import { createMatAlgo14xDs } from '../type/matrix/utils/matAlgo14xDs.js';
import { factory } from '../utils/factory.js';
import { isMatrix } from '../utils/is.js';
import { multiplyMatrixEntries } from './matrix-product.js';

type Matrix = MathJSDenseMatrix | MathJSSparseMatrix;

interface SelectedMultiplyDependencies {
  typed: TypedFunction;
  matrix: TypedFunction;
  addScalar: TypedFunction;
  multiplyScalar: TypedFunction;
  equalScalar: TypedFunction;
  dot: TypedFunction;
}

function validateProductSize(a: number[], b: number[]): void {
  if (a.length < 1 || a.length > 2) {
    throw new Error(
      `Can only multiply a 1 or 2 dimensional matrix (Matrix A has ${a.length} dimensions)`
    );
  }
  if (b.length < 1 || b.length > 2) {
    throw new Error(
      `Can only multiply a 1 or 2 dimensional matrix (Matrix B has ${b.length} dimensions)`
    );
  }
  if (a[a.length - 1] === b[0]) return;
  if (a.length === 1 && b.length === 1) {
    throw new RangeError('Dimension mismatch in multiplication. Vectors must have the same length');
  }
  const left =
    a.length === 1
      ? `Vector length (${a[0]})`
      : `Matrix${b.length === 1 ? '' : ' A'} columns (${a[1]})`;
  const right =
    b.length === 1
      ? `Vector length (${b[0]})`
      : `Matrix${a.length === 1 ? '' : ' B'} rows (${b[0]})`;
  throw new RangeError(`Dimension mismatch in multiplication. ${left} must match ${right}`);
}

export const createSelectedMultiply = /* #__PURE__ */ factory(
  'multiply',
  ['typed', 'matrix', 'addScalar', 'multiplyScalar', 'equalScalar', 'dot'],
  ({
    typed,
    matrix,
    addScalar,
    multiplyScalar,
    equalScalar,
    dot,
  }: SelectedMultiplyDependencies) => {
    const scaleSparse = createMatAlgo11xS0s({ typed, equalScalar } as Parameters<
      typeof createMatAlgo11xS0s
    >[0]);
    const scaleDense = createMatAlgo14xDs({ typed } as Parameters<typeof createMatAlgo14xDs>[0]);
    const toMatrix = (value: unknown[], storage?: string) =>
      matrix(value, ...(storage === undefined ? [] : [storage])) as Matrix;
    const scalarForSparse = multiplyScalar as Parameters<typeof scaleSparse>[2];
    const scalarForDense = multiplyScalar as Parameters<typeof scaleDense>[2];

    function mixedProduct(
      dense: MathJSDenseMatrix,
      sparse: MathJSSparseMatrix,
      sparseOnLeft: boolean
    ): MathJSSparseMatrix {
      const sparseValues = sparse._values;
      if (!sparseValues) {
        throw new Error(
          sparseOnLeft
            ? 'Cannot multiply Pattern only Matrix times Dense Matrix'
            : 'Cannot multiply Dense Matrix times Pattern only Matrix'
        );
      }
      const [denseRows, denseColumns] = dense.size();
      const rows = sparseOnLeft ? sparse.size()[0] : denseRows;
      const columns = sparseOnLeft ? (denseColumns ?? 1) : sparse.size()[1];
      const datatype = dense.datatype() === sparse.datatype() ? dense.datatype() : undefined;
      const values: unknown[] = [];
      const index: number[] = [];
      const ptr = [0];
      const denseData = dense.valueOf();
      for (let col = 0; col < columns; col++) {
        // The sparse operand contributes only its stored entries.
        if (sparseOnLeft) {
          const accumulators = new Map<number, unknown>();
          for (let k = 0; k < denseRows; k++) {
            const cell = denseColumns === undefined ? denseData[k] : denseData[k][col];
            if (equalScalar(cell, 0)) continue;
            for (let p = sparse._ptr[k]; p < sparse._ptr[k + 1]; p++) {
              const row = sparse._index[p];
              const term = multiplyScalar(cell, sparseValues[p]);
              const sum = accumulators.has(row) ? addScalar(accumulators.get(row), term) : term;
              accumulators.set(row, sum);
            }
          }
          for (const [row, value] of accumulators) {
            index.push(row);
            values.push(value);
          }
        } else {
          const first = sparse._ptr[col];
          const end = sparse._ptr[col + 1];
          for (let row = 0; row < rows && first < end; row++) {
            let sum = multiplyScalar(denseData[row][sparse._index[first]], sparseValues[first]);
            for (let p = first + 1; p < end; p++) {
              sum = addScalar(
                sum,
                multiplyScalar(denseData[row][sparse._index[p]], sparseValues[p])
              );
            }
            if (!equalScalar(sum, 0)) {
              index.push(row);
              values.push(sum);
            }
          }
        }
        ptr.push(index.length);
      }
      return sparse.createSparseMatrix({ values, index, ptr, size: [rows, columns], datatype });
    }

    function product(a: Matrix, b: Matrix): unknown {
      const sizeA = a.size();
      const sizeB = b.size();
      validateProductSize(sizeA, sizeB);
      const vectorA = sizeA.length === 1;
      const vectorB = sizeB.length === 1;
      const sparseA = a.storage() === 'sparse';
      const sparseB = b.storage() === 'sparse';
      if (vectorA && vectorB) {
        if (sizeA[0] === 0) throw new Error('Cannot multiply two empty vectors');
        return dot(a, b);
      }
      if (vectorA && sparseB) throw new Error('Support for SparseMatrix not implemented');
      if (sparseA && sparseB) {
        return cscProduct(
          a as MathJSSparseMatrix,
          b as MathJSSparseMatrix,
          addScalar,
          multiplyScalar,
          false
        );
      }
      if (sparseA) return mixedProduct(b as MathJSDenseMatrix, a as MathJSSparseMatrix, true);
      if (sparseB) return mixedProduct(a as MathJSDenseMatrix, b as MathJSSparseMatrix, false);
      const rows = vectorA ? 1 : sizeA[0];
      const inner = vectorA ? sizeA[0] : sizeA[1];
      const columns = vectorB ? 1 : sizeB[1];
      if (vectorB && inner === 0)
        throw new TypeError('Cannot multiply a matrix with an empty vector');
      const left = vectorA ? [a.valueOf()] : a.valueOf();
      const right = vectorB ? b.valueOf().map((value) => [value]) : b.valueOf();
      const entries = multiplyMatrixEntries(
        left,
        right,
        rows,
        inner,
        columns,
        addScalar,
        multiplyScalar
      );

      const data = vectorA ? entries[0] : vectorB ? entries.map((row) => row[0]) : entries;
      const size = vectorA ? [columns] : vectorB ? [rows] : [rows, columns];
      const datatype = a.datatype() === b.datatype() ? a.datatype() : undefined;
      return (a as MathJSDenseMatrix).createDenseMatrix({
        data: data as number[][],
        size,
        datatype,
      });
    }

    return typed('multiply', multiplyScalar, {
      'Array, Array': (a: unknown[], b: unknown[]) => {
        const result = product(toMatrix(a), toMatrix(b));
        return isMatrix(result) ? result.valueOf() : result;
      },
      'Matrix, Matrix': product,
      'Matrix, Array': (a: Matrix, b: unknown[]) => product(a, toMatrix(b)),
      'Array, Matrix': (a: unknown[], b: Matrix) => product(toMatrix(a, b.storage()), b),
      'SparseMatrix, any': (
        a: Parameters<typeof scaleSparse>[0],
        b: Parameters<typeof scaleSparse>[1]
      ) => scaleSparse(a, b, scalarForSparse, false),
      'any, SparseMatrix': (
        a: Parameters<typeof scaleSparse>[1],
        b: Parameters<typeof scaleSparse>[0]
      ) => scaleSparse(b, a, scalarForSparse, true),
      'DenseMatrix, any': (
        a: Parameters<typeof scaleDense>[0],
        b: Parameters<typeof scaleDense>[1]
      ) => scaleDense(a, b, scalarForDense, false),
      'any, DenseMatrix': (
        a: Parameters<typeof scaleDense>[1],
        b: Parameters<typeof scaleDense>[0]
      ) => scaleDense(b, a, scalarForDense, true),
      'Array, any': (a: unknown[], b: Parameters<typeof scaleDense>[1]) =>
        (
          scaleDense(
            toMatrix(a) as Parameters<typeof scaleDense>[0],
            b,
            scalarForDense,
            false
          ) as MathJSDenseMatrix
        ).valueOf(),
      'any, Array': (a: Parameters<typeof scaleDense>[1], b: unknown[]) =>
        (
          scaleDense(
            toMatrix(b) as Parameters<typeof scaleDense>[0],
            a,
            scalarForDense,
            true
          ) as MathJSDenseMatrix
        ).valueOf(),
      'any, any': multiplyScalar,
      'any, any, ...any': typed.referToSelf(
        (self) => (first: unknown, second: unknown, rest: unknown[]) =>
          rest.reduce((value, operand) => self(value, operand), self(first, second))
      ),
    });
  }
);
