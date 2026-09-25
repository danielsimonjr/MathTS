import { isMatrix } from '../utils/is.js';
import { arraySize } from '../utils/array.js';
import { factory } from '../utils/factory.js';
import { format } from '../utils/string.js';

// Type definitions
import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';

/** Scalar types supported by inv */
type Scalar = number | BigNumber | Complex;

/** Nested array of scalar values */
type NestedArray<T = Scalar> = T | NestedArray<T>[];

/** Matrix data can be nested arrays of scalars */
type MatrixData = NestedArray<Scalar>;

/** Matrix interface */
interface Matrix {
  type: string;
  storage(): string;
  datatype(): string | undefined;
  size(): number[];
  clone(): Matrix;
  toArray(): MatrixData;
  valueOf(): MatrixData;
  _data?: MatrixData;
  _size?: number[];
  _datatype?: string;
}

/** Typed function interface for math.js functions */
interface TypedFunction<R = Scalar> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => R;
  (...args: unknown[]): R;
  find(func: TypedFunction, signature: string[]): TypedFunction<R>;
}

/** Matrix constructor function */
interface MatrixConstructor {
  (data: Scalar[] | Scalar[][], storage?: 'dense' | 'sparse'): Matrix;
}

/** Identity matrix function */
interface IdentityFunction {
  (size: number | number[]): Matrix;
}

/** Dependencies for inv factory */
interface Dependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
  divideScalar: TypedFunction<Scalar>;
  addScalar: TypedFunction<Scalar>;
  multiply: TypedFunction<Scalar>;
  unaryMinus: TypedFunction<Scalar>;
  det: TypedFunction<Scalar>;
  identity: IdentityFunction;
  abs: TypedFunction<number | BigNumber>;
}

const name = 'inv';
const dependencies = [
  'typed',
  'matrix',
  'divideScalar',
  'addScalar',
  'multiply',
  'unaryMinus',
  'det',
  'identity',
  'abs',
];

export const createInv = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    matrix,
    divideScalar,
    addScalar,
    multiply,
    unaryMinus,
    det,
    identity,
    abs,
  }: Dependencies) => {
    /**
     * Calculate the inverse of a square matrix.
     *
     * Syntax:
     *
     *     math.inv(x)
     *
     * Examples:
     *
     *     math.inv([[1, 2], [3, 4]])  // returns [[-2, 1], [1.5, -0.5]]
     *     math.inv(4)                 // returns 0.25
     *     1 / 4                       // returns 0.25
     *
     * See also:
     *
     *     det, transpose
     *
     * @param {number | Complex | Array | Matrix} x     Matrix to be inversed
     * @return {number | Complex | Array | Matrix} The inverse of `x`.
     */
    return typed(name, {
      'Array | Matrix': function (x: Scalar[] | Matrix): Scalar[] | Matrix {
        const size = isMatrix(x) ? (x as Matrix).size() : arraySize(x as Scalar[]);
        switch (size.length) {
          case 1:
            // vector
            if (size[0] === 1) {
              if (isMatrix(x)) {
                const matX = x as Matrix;
                return matrix([divideScalar(1, (matX.valueOf() as Scalar[])[0])]);
              } else {
                return [divideScalar(1, (x as Scalar[])[0])];
              }
            } else {
              throw new RangeError('Matrix must be square ' + '(size: ' + format(size, {}) + ')');
            }

          case 2: {
            // two dimensional array
            const rows = size[0];
            const cols = size[1];
            if (rows === cols) {
              if (isMatrix(x)) {
                const matX = x as Matrix;
                const storage = matX.storage() as 'dense' | 'sparse';
                return matrix(_inv(matX.valueOf() as Scalar[][], rows, cols), storage);
              } else {
                // return an Array
                return _inv(x as Scalar[][], rows, cols) as unknown as Scalar[];
              }
            } else {
              throw new RangeError('Matrix must be square ' + '(size: ' + format(size, {}) + ')');
            }
          }

          default:
            // multi dimensional array
            throw new RangeError(
              'Matrix must be two dimensional ' + '(size: ' + format(size, {}) + ')'
            );
        }
      },

      any: function (x: Scalar): Scalar {
        // scalar
        return divideScalar(1, x); // FIXME: create a BigNumber one when configured for bignumbers
      },
    });

    /**
     * Calculate the inverse of a square matrix
     * @param mat     A square matrix
     * @param rows    Number of rows
     * @param cols    Number of columns, must equal rows
     * @return inv    Inverse matrix
     * @private
     */
    function _inv(mat: Scalar[][], rows: number, cols: number): Scalar[][] {
      let r: number, s: number, f: Scalar, value: Scalar, temp: Scalar[];

      if (rows === 1) {
        // this is a 1 x 1 matrix
        value = mat[0][0];
        if (value === 0) {
          throw Error('Cannot calculate inverse, determinant is zero');
        }
        return [[divideScalar(1, value)]];
      } else if (rows === 2) {
        // this is a 2 x 2 matrix
        const d = det(mat);
        if (d === 0) {
          throw Error('Cannot calculate inverse, determinant is zero');
        }
        return [
          [divideScalar(mat[1][1], d), divideScalar(unaryMinus(mat[0][1]), d)],
          [divideScalar(unaryMinus(mat[1][0]), d), divideScalar(mat[0][0], d)],
        ];
      } else {
        // this is a matrix of 3 x 3 or larger
        // calculate inverse using gauss-jordan elimination
        //      https://en.wikipedia.org/wiki/Gaussian_elimination
        //      http://mathworld.wolfram.com/MatrixInverse.html
        //      http://math.uww.edu/~mcfarlat/inverse.htm

        // make a copy of the matrix (only the arrays, not of the elements)
        const A = mat.concat();
        for (r = 0; r < rows; r++) {
          A[r] = A[r].concat();
        }

        // create an identity matrix which in the end will contain the
        // matrix inverse
        const B = identity(rows).valueOf() as Scalar[][];

        // loop over all columns, and perform row reductions
        for (let c = 0; c < cols; c++) {
          // Pivoting: Swap row c with row r, where row r contains the largest element A[r][c]
          let ABig = abs(A[c][c]);
          let rBig = c;
          r = c + 1;
          while (r < rows) {
            if (abs(A[r][c]) > ABig) {
              ABig = abs(A[r][c]);
              rBig = r;
            }
            r++;
          }
          if (ABig === 0) {
            throw Error('Cannot calculate inverse, determinant is zero');
          }
          r = rBig;
          if (r !== c) {
            temp = A[c];
            A[c] = A[r];
            A[r] = temp;
            temp = B[c];
            B[c] = B[r];
            B[r] = temp;
          }

          // eliminate non-zero values on the other rows at column c
          const Ac = A[c];
          const Bc = B[c];
          for (r = 0; r < rows; r++) {
            const Ar = A[r];
            const Br = B[r];
            if (r !== c) {
              // eliminate value at column c and row r
              if (Ar[c] !== 0) {
                f = divideScalar(unaryMinus(Ar[c]), Ac[c]);

                // add (f * row c) to row r to eliminate the value
                // at column c
                for (s = c; s < cols; s++) {
                  Ar[s] = addScalar(Ar[s], multiply(f, Ac[s]));
                }
                for (s = 0; s < cols; s++) {
                  Br[s] = addScalar(Br[s], multiply(f, Bc[s]));
                }
              }
            } else {
              // normalize value at Acc to 1,
              // divide each value on row r with the value at Acc
              f = Ac[c];
              for (s = c; s < cols; s++) {
                Ar[s] = divideScalar(Ar[s], f);
              }
              for (s = 0; s < cols; s++) {
                Br[s] = divideScalar(Br[s], f);
              }
            }
          }
        }
        return B;
      }
    }
  }
);
