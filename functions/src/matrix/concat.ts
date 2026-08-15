import { isBigNumber, isMatrix, isNumber } from '../utils/is.js';
import { clone } from '../utils/object.js';
import { arraySize, concat as _concat } from '../utils/array.js';
import { DimensionError } from '../error/DimensionError.js';
import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { Matrix } from '../types.js';

interface ConcatDependencies {
  typed: TypedFunction;
  matrix: (data: unknown) => Matrix;
  isInteger: (x: unknown) => boolean;
}

const name = 'concat';
const dependencies = ['typed', 'matrix', 'isInteger'];

export const createConcat = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, isInteger }: ConcatDependencies) => {
    /**
     * Concatenate two or more matrices.
     *
     * Syntax:
     *
     *     math.concat(A, B, C, ...)
     *     math.concat(A, B, C, ..., dim)
     *
     * Where:
     *
     * - `dim: number` is a zero-based dimension over which to concatenate the matrices.
     *   By default the last dimension of the matrices.
     *
     * Examples:
     *
     *    const A = [[1, 2], [5, 6]]
     *    const B = [[3, 4], [7, 8]]
     *
     *    math.concat(A, B)                  // returns [[1, 2, 3, 4], [5, 6, 7, 8]]
     *    math.concat(A, B, 0)               // returns [[1, 2], [5, 6], [3, 4], [7, 8]]
     *    math.concat('hello', ' ', 'world') // returns 'hello world'
     *
     * See also:
     *
     *    size, squeeze, subset, transpose
     *
     * @param {... Array | Matrix} args     Two or more matrices
     * @return {Array | Matrix} Concatenated matrix
     */
    return typed(name, {
      '...Array | Matrix | number | BigNumber': function (args: unknown[]): unknown {
        const len = args.length;
        if (len === 0) {
          throw new SyntaxError('At least one matrix expected');
        }

        const lastArg = args[len - 1];
        const hasDim = isNumber(lastArg) || isBigNumber(lastArg);
        const dimIndex = hasDim ? len - 1 : len;

        let dim = -1; // zero-based dimension
        if (hasDim) {
          dim = (lastArg as { valueOf(): number }).valueOf(); // change BigNumber to number
          if (!isInteger(dim)) {
            throw new TypeError('Integer number expected for dimension');
          }
        }

        let asMatrix = false;
        let prevDim = -1;
        const matrices: unknown[][] = []; // contains multi dimensional arrays

        for (let i = 0; i < dimIndex; i++) {
          const arg = args[i];

          if (isNumber(arg) || isBigNumber(arg)) {
            throw new Error('Dimension must be specified as last argument');
          }

          // test whether we need to return a Matrix (if not we return an Array)
          if (isMatrix(arg)) {
            asMatrix = true;
          }

          // this is a matrix or array
          const m = (clone(arg) as { valueOf(): unknown }).valueOf() as unknown[];
          const size = arraySize(m);
          matrices.push(m);

          const currentDim = size.length - 1;

          // verify whether each of the matrices has the same number of dimensions
          if (i === 0) {
            prevDim = currentDim;
          } else if (currentDim !== prevDim) {
            throw new DimensionError(prevDim + 1, currentDim + 1);
          }
        }

        if (matrices.length === 0) {
          throw new SyntaxError('At least one matrix expected');
        }

        if (hasDim) {
          if (dim < 0 || dim > prevDim) {
            throw new DimensionError(dim, dim < 0 ? 0 : prevDim, dim < 0 ? '<' : '>');
          }
        } else {
          dim = prevDim;
        }

        let res = matrices.shift();
        while (matrices.length) {
          res = _concat(res, matrices.shift(), dim);
        }

        return asMatrix ? matrix(res) : res;
      },

      '...string': function (args: string[]): string {
        return args.join('');
      },
    });
  }
);
