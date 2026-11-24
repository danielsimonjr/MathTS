import type { TypedFunction } from '../core/function/typed.js';
import { factory } from '../utils/factory.js';
import {
  createMatrixBridge,
  type MathJSDenseMatrix,
  type MathJSSparseMatrix,
} from './matrix-bridge.js';

interface SelectedMatrixDependencies {
  DenseMatrix: typeof MathJSDenseMatrix;
  SparseMatrix: typeof MathJSSparseMatrix;
  typed: TypedFunction;
}

type MatrixData = Parameters<ReturnType<typeof createMatrixBridge>>[0];

/** Build a MathJS matrix function using the constructors of the selected instance. */
export const createSelectedMatrix = /* #__PURE__ */ factory(
  'matrix',
  ['DenseMatrix', 'Matrix', 'SparseMatrix', 'typed'],
  ({ DenseMatrix, SparseMatrix, typed }: SelectedMatrixDependencies) => {
    const build = createMatrixBridge(DenseMatrix, SparseMatrix);
    function fromData(data: MatrixData, format?: string, datatype?: string) {
      const matrix = build(data, format);
      if (datatype !== undefined) matrix._datatype = datatype;
      return matrix;
    }
    return typed('matrix', {
      '': () => build(),
      string: (format: string) => build(format),
      'string, string': (format: string, datatype: string) => {
        const matrix = build(format);
        matrix._datatype = datatype;
        return matrix;
      },
      'Array | Matrix': fromData,
      'Array | Matrix, string': fromData,
      'Array | Matrix, string, string': fromData,
    });
  }
);

/** Build sparse matrices with the selected instance's constructor. */
export const createSelectedSparse = /* #__PURE__ */ factory(
  'sparse',
  ['typed', 'SparseMatrix'],
  ({ typed, SparseMatrix }: Pick<SelectedMatrixDependencies, 'typed' | 'SparseMatrix'>) => {
    function fromData(
      data: ConstructorParameters<typeof MathJSSparseMatrix>[0],
      datatype?: string
    ) {
      const matrix = new SparseMatrix(data);
      if (datatype !== undefined) matrix._datatype = datatype;
      return matrix;
    }
    return typed('sparse', {
      '': () => fromData([]),
      string: (datatype: string) => fromData([], datatype),
      'Array | Matrix': fromData,
      'Array | Matrix, string': fromData,
    });
  }
);
