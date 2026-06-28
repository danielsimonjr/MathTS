import { factory } from '../../../utils/factory.js';
import { extend } from '../../../utils/object.js';
import { createMatAlgo13xDD } from './matAlgo13xDD.js';
import { createMatAlgo14xDs } from './matAlgo14xDs.js';
import { broadcast } from './broadcast.js';
import type {
  TypedFunction,
  MatrixAlgorithmSuiteOptions,
  MatrixSignatures,
  MatrixInterface,
  DenseMatrixData,
} from '../types.js';

/**
 * Interface for matrix used in algorithm suite.
 */
interface Matrix extends MatrixInterface {
  _data?: DenseMatrixData;
  _size?: number[];
  _datatype?: string;
}

/**
 * Matrix constructor function type.
 */
type MatrixConstructor = (data: DenseMatrixData) => Matrix;

const name = 'matrixAlgorithmSuite';
const dependencies = ['typed', 'matrix'];

/**
 * Dependencies for matrixAlgorithmSuite factory.
 */
interface MatrixAlgorithmSuiteDependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
}

export const createMatrixAlgorithmSuite = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix }: MatrixAlgorithmSuiteDependencies) => {
    const matAlgo13xDD = createMatAlgo13xDD({ typed });
    const matAlgo14xDs = createMatAlgo14xDs({ typed });

    // The matrix algorithms below operate on duck-typed matrices that flow
    // through typed-function dispatch as `unknown`. `broadcast` and the element
    // algorithms have concrete (but mutually distinct) matrix parameter types,
    // so we bridge them with narrow local aliases rather than `any`.
    type DenseDenseArgs = [Parameters<typeof matAlgo13xDD>[0], Parameters<typeof matAlgo13xDD>[1]];
    type DenseScalarArg = Parameters<typeof matAlgo14xDs>[0];
    const bcast = broadcast as unknown as (a: unknown, b: unknown) => [unknown, unknown];

    /**
     * Return a signatures object with the usual boilerplate of
     * matrix algorithms, based on a plain options object with the
     * following properties:
     *   elop: function -- the elementwise operation to use, defaults to self
     *   SS: function -- the algorithm to apply for two sparse matrices
     *   DS: function -- the algorithm to apply for a dense and a sparse matrix
     *   SD: function -- algo for a sparse and a dense; defaults to SD flipped
     *   Ss: function -- the algorithm to apply for a sparse matrix and scalar
     *   sS: function -- algo for scalar and sparse; defaults to Ss flipped
     *   scalar: string -- typed-function type for scalars, defaults to 'any'
     *
     * If Ss is not specified, no matrix-scalar signatures are generated.
     *
     * @param {object} options
     * @return {Object<string, function>} signatures
     */
    return function matrixAlgorithmSuite(options: MatrixAlgorithmSuiteOptions): MatrixSignatures {
      const elop = options.elop;
      const SD = options.SD || options.DS;
      let matrixSignatures: MatrixSignatures;

      if (elop) {
        // First the dense ones
        matrixSignatures = {
          'DenseMatrix, DenseMatrix': (x: unknown, y: unknown) =>
            matAlgo13xDD(...(bcast(x, y) as DenseDenseArgs), elop),
          'Array, Array': (x: unknown[], y: unknown[]) =>
            matAlgo13xDD(
              ...(bcast(
                matrix(x as DenseMatrixData),
                matrix(y as DenseMatrixData)
              ) as DenseDenseArgs),
              elop
            ).valueOf(),
          'Array, DenseMatrix': (x: unknown[], y: unknown) =>
            matAlgo13xDD(...(bcast(matrix(x as DenseMatrixData), y) as DenseDenseArgs), elop),
          'DenseMatrix, Array': (x: unknown, y: unknown[]) =>
            matAlgo13xDD(...(bcast(x, matrix(y as DenseMatrixData)) as DenseDenseArgs), elop),
        };
        // Now incorporate sparse matrices
        if (options.SS) {
          matrixSignatures['SparseMatrix, SparseMatrix'] = (x: unknown, y: unknown) =>
            options.SS!(...bcast(x, y), elop, false);
        }
        if (options.DS) {
          matrixSignatures['DenseMatrix, SparseMatrix'] = (x: unknown, y: unknown) =>
            options.DS!(...bcast(x, y), elop, false);
          matrixSignatures['Array, SparseMatrix'] = (x: unknown[], y: unknown) =>
            options.DS!(...bcast(matrix(x as DenseMatrixData), y), elop, false);
        }
        if (SD) {
          matrixSignatures['SparseMatrix, DenseMatrix'] = (x: unknown, y: unknown) =>
            SD(...bcast(y, x), elop, true);
          matrixSignatures['SparseMatrix, Array'] = (x: unknown, y: unknown[]) =>
            SD(...bcast(matrix(y as DenseMatrixData), x), elop, true);
        }
      } else {
        // No elop, use this
        // First the dense ones
        matrixSignatures = {
          'DenseMatrix, DenseMatrix': typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown) => {
              return matAlgo13xDD(...(bcast(x, y) as DenseDenseArgs), self);
            }
          ),
          'Array, Array': typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown[], y: unknown[]) => {
              return matAlgo13xDD(
                ...(bcast(
                  matrix(x as DenseMatrixData),
                  matrix(y as DenseMatrixData)
                ) as DenseDenseArgs),
                self
              ).valueOf();
            }
          ),
          'Array, DenseMatrix': typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown[], y: unknown) => {
              return matAlgo13xDD(...(bcast(matrix(x as DenseMatrixData), y) as DenseDenseArgs), self);
            }
          ),
          'DenseMatrix, Array': typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown[]) => {
              return matAlgo13xDD(...(bcast(x, matrix(y as DenseMatrixData)) as DenseDenseArgs), self);
            }
          ),
        };
        // Now incorporate sparse matrices
        if (options.SS) {
          matrixSignatures['SparseMatrix, SparseMatrix'] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown) => {
              return options.SS!(...bcast(x, y), self, false);
            }
          );
        }
        if (options.DS) {
          matrixSignatures['DenseMatrix, SparseMatrix'] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown) => {
              return options.DS!(...bcast(x, y), self, false);
            }
          );
          matrixSignatures['Array, SparseMatrix'] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown[], y: unknown) => {
              return options.DS!(...bcast(matrix(x as DenseMatrixData), y), self, false);
            }
          );
        }
        if (SD) {
          matrixSignatures['SparseMatrix, DenseMatrix'] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown) => {
              return SD(...bcast(y, x), self, true);
            }
          );
          matrixSignatures['SparseMatrix, Array'] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown[]) => {
              return SD(...bcast(matrix(y as DenseMatrixData), x), self, true);
            }
          );
        }
      }

      // Now add the scalars
      const scalar = options.scalar || 'any';
      const Ds = options.Ds || options.Ss;
      if (Ds) {
        if (elop) {
          matrixSignatures['DenseMatrix,' + scalar] = (x: unknown, y: unknown) =>
            matAlgo14xDs(x as DenseScalarArg, y, elop, false);
          matrixSignatures[scalar + ', DenseMatrix'] = (x: unknown, y: unknown) =>
            matAlgo14xDs(y as DenseScalarArg, x, elop, true);
          matrixSignatures['Array,' + scalar] = (x: unknown[], y: unknown) =>
            matAlgo14xDs(matrix(x as DenseMatrixData) as unknown as DenseScalarArg, y, elop, false).valueOf();
          matrixSignatures[scalar + ', Array'] = (x: unknown, y: unknown[]) =>
            matAlgo14xDs(matrix(y as DenseMatrixData) as unknown as DenseScalarArg, x, elop, true).valueOf();
        } else {
          matrixSignatures['DenseMatrix,' + scalar] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown) => {
              return matAlgo14xDs(x as DenseScalarArg, y, self, false);
            }
          );
          matrixSignatures[scalar + ', DenseMatrix'] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown) => {
              return matAlgo14xDs(y as DenseScalarArg, x, self, true);
            }
          );
          matrixSignatures['Array,' + scalar] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown[], y: unknown) => {
              return matAlgo14xDs(
                matrix(x as DenseMatrixData) as unknown as DenseScalarArg,
                y,
                self,
                false
              ).valueOf();
            }
          );
          matrixSignatures[scalar + ', Array'] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: unknown[]) => {
              return matAlgo14xDs(
                matrix(y as DenseMatrixData) as unknown as DenseScalarArg,
                x,
                self,
                true
              ).valueOf();
            }
          );
        }
      }
      const sS = options.sS !== undefined ? options.sS : options.Ss;
      if (elop) {
        if (options.Ss) {
          matrixSignatures['SparseMatrix,' + scalar] = (x: Matrix, y: unknown) =>
            options.Ss!(x, y, elop, false);
        }
        if (sS) {
          matrixSignatures[scalar + ', SparseMatrix'] = (x: unknown, y: Matrix) =>
            sS(y, x, elop, true);
        }
      } else {
        if (options.Ss) {
          matrixSignatures['SparseMatrix,' + scalar] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: Matrix, y: unknown) => {
              return options.Ss!(x, y, self, false);
            }
          );
        }
        if (sS) {
          matrixSignatures[scalar + ', SparseMatrix'] = typed.referToSelf(
            (self: (...args: unknown[]) => unknown) => (x: unknown, y: Matrix) => {
              return sS(y, x, self, true);
            }
          );
        }
      }
      // Also pull in the scalar signatures if the operator is a typed function
      if (elop && elop.signatures) {
        extend(matrixSignatures, elop.signatures);
      }
      return matrixSignatures;
    };
  }
);
