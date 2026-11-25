import { factory } from '../../../utils/factory.js';
import { findTypedImpl } from '../../../utils/typed-impl.js';
import type { DataType, MatrixCallback, TypedFunction, MatrixValue } from '../types.js';

/**
 * DenseMatrix interface for algorithm operations.
 */
interface DenseMatrix {
  _data: unknown;
  _size: number[];
  _datatype?: DataType;
  map(callback: (value: MatrixValue, index: number[], matrix: unknown) => MatrixValue): DenseMatrix;
}

const name = 'matAlgo14xDs';
const dependencies = ['typed'];

/**
 * Dependencies for matAlgo14xDs factory
 */
interface MatAlgo14xDsDependencies {
  typed: TypedFunction;
}

export const createMatAlgo14xDs = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed }: MatAlgo14xDsDependencies) => {
    /**
     * Iterates over DenseMatrix items and invokes the callback function f(Aij..z, b).
     * Callback function invoked MxN times.
     *
     * C(i,j,...z) = f(Aij..z, b)
     *
     * @param {DenseMatrix}   a                 The DenseMatrix instance (A)
     * @param {MatrixValue}   b                 The Scalar value
     * @param {MatrixCallback} callback          The f(Aij..z,b) operation to invoke
     * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Aij..z)
     *
     * @return {DenseMatrix}                    DenseMatrix (C)
     *
     * https://github.com/josdejong/mathjs/pull/346#issuecomment-97659042
     */
    return function matAlgo14xDs(
      a: DenseMatrix,
      b: MatrixValue,
      callback: MatrixCallback,
      inverse: boolean
    ): DenseMatrix {
      const adt: DataType = a._datatype;

      // callback signature to use
      let cf: MatrixCallback = callback;

      // process data types
      if (typeof adt === 'string') {
        const impl = findTypedImpl(
          typed as unknown as Parameters<typeof findTypedImpl>[0],
          callback,
          [adt, adt]
        );
        if (impl) {
          try {
            b = typed.convert(b, adt) as MatrixValue;
            cf = impl;
          } catch {
            cf = callback;
          }
        }
      }

      // map over the matrix elements, as in mathjs 15.3.0 (the matrix keeps its size)
      return inverse ? a.map((v) => cf(b, v)) : a.map((v) => cf(v, b));
    };
  }
);
