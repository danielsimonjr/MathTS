import { factory } from '../utils/factory.js';
import { format } from '../utils/string.js';
import { createComplexEigs } from './eigs/complexEigs.js';
import { createRealSymmetric } from './eigs/realSymmetric.js';
import { realScale, squaresLeaveRange } from '../utils/real-scale.js';
import { typeOf, isNumber, isBigNumber, isComplex, isFraction } from '../utils/is.js';

// Type definitions
import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';

/** Scalar types supported by eigs */
type Scalar = number | BigNumber | Complex;

/** Nested array of scalar values */
type NestedArray<T = Scalar> = T | NestedArray<T>[];

/** Matrix data can be nested arrays of scalars */
type MatrixData = NestedArray<Scalar>;

/** Supported data types for eigenvalue computation */
type DataType = 'number' | 'BigNumber' | 'Complex';

/** Typed function interface for math.js functions */
interface TypedFunction<R = Scalar> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  // It returns `unknown`, like every typed function, not `R`: `R` is the scalar
  // result of the dependencies typed here, while this function returns an `{ values, eigenvectors }` result.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => unknown;
  (...args: unknown[]): R;
  find(func: TypedFunction, signature: string[]): TypedFunction<R>;
}

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

/** Matrix constructor function */
interface MatrixConstructor {
  (data: Scalar[] | Scalar[][], storage?: 'dense' | 'sparse'): Matrix;
}

/** Configuration object */
interface Config {
  relTol: number | BigNumber;
}

/** Result for a single eigenvector with its corresponding eigenvalue */
interface EigenvectorResult {
  value: Scalar;
  vector: Scalar[] | Matrix;
}

/** Result of the eigs function */
interface EigenResult {
  values: Scalar[] | Matrix;
  eigenvectors?: EigenvectorResult[];
  vectors?: never;
}

/** Options for the eigs function */
interface EigenOptions {
  precision?: number | BigNumber;
  eigenvectors?: boolean;
  matricize?: boolean;
}

/** Dependencies for eigs factory */
interface Dependencies {
  config: Config;
  typed: TypedFunction;
  matrix: MatrixConstructor;
  addScalar: TypedFunction<Scalar>;
  subtract: TypedFunction<Scalar>;
  abs: TypedFunction<number | BigNumber>;
  atan: TypedFunction<Scalar>;
  cos: TypedFunction<Scalar>;
  sin: TypedFunction<Scalar>;
  multiplyScalar: TypedFunction<Scalar>;
  divideScalar: TypedFunction<Scalar>;
  inv: TypedFunction<Scalar[][] | Matrix>;
  bignumber: TypedFunction<BigNumber>;
  multiply: TypedFunction<Scalar | Scalar[][] | Matrix>;
  add: TypedFunction<Scalar>;
  column: TypedFunction<Scalar[]>;
  flatten: TypedFunction<Scalar[]>;
  number: TypedFunction<number>;
  complex: TypedFunction<Complex>;
  sqrt: TypedFunction<Scalar>;
  diag: TypedFunction<Scalar[][]>;
  size: TypedFunction<number[]>;
  reshape: TypedFunction<Scalar[]>;
  qr: TypedFunction<{ Q: Scalar[][]; R: Scalar[][] }>;
  usolve: TypedFunction<Scalar[]>;
  im: TypedFunction<number | BigNumber>;
  re: TypedFunction<number | BigNumber>;
  matrixFromColumns: TypedFunction<Scalar[][]>;
  dot: TypedFunction<Scalar>;
}

const name = 'eigs';

/**
 * Add the property `vectors` to an eigs result: it throws, because the name was replaced by
 * `eigenvectors`. The property is not enumerable, so the eigenvectors can still be converted to
 * a string.
 */
export function defineRemovedVectorsGetter(result: object): void {
  Object.defineProperty(result, 'vectors', {
    enumerable: false,
    get: () => {
      throw new Error('eigs(M).vectors replaced with eigs(M).eigenvectors');
    },
  });
}

// The absolute state of math.js's dependency system:
const dependencies = [
  'config',
  'typed',
  'matrix',
  'addScalar',
  'subtract',
  'abs',
  'atan',
  'cos',
  'sin',
  'multiplyScalar',
  'divideScalar',
  'inv',
  'bignumber',
  'multiply',
  'add',
  'column',
  'flatten',
  'number',
  'complex',
  'sqrt',
  'diag',
  'size',
  'reshape',
  'qr',
  'usolve',
  'im',
  're',
  'matrixFromColumns',
  'dot',
];

export const createEigs = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    config,
    typed,
    matrix,
    addScalar,
    subtract,
    abs,
    atan,
    cos,
    sin,
    multiplyScalar,
    divideScalar,
    inv,
    bignumber,
    multiply,
    add,
    column: _column,
    flatten,
    number,
    complex,
    sqrt,
    diag,
    size,
    reshape,
    qr,
    usolve,
    im,
    re,
    matrixFromColumns,
    dot,
  }: Dependencies) => {
    const doRealSymmetric = createRealSymmetric({
      config,
      addScalar,
      subtract,
      abs,
      atan,
      cos,
      sin,
      multiplyScalar,
      inv,
      bignumber,
      complex,
      multiply,
      add,
    } as unknown as Parameters<typeof createRealSymmetric>[0]);
    const doComplexEigs = createComplexEigs({
      addScalar,
      subtract,
      multiply,
      multiplyScalar,
      flatten,
      divideScalar,
      sqrt,
      abs,
      bignumber,
      diag,
      size,
      reshape,
      qr,
      inv,
      usolve,
      complex,
      matrixFromColumns,
      dot,
    } as unknown as Parameters<typeof createComplexEigs>[0]);

    /**
     * Compute eigenvalues and optionally eigenvectors of a square matrix.
     * The eigenvalues are sorted by their absolute value, ascending, and
     * returned as a vector in the `values` property of the returned project.
     * An eigenvalue with algebraic multiplicity k will be listed k times, so
     * that the returned `values` vector always has length equal to the size
     * of the input matrix.
     *
     * The `eigenvectors` property of the return value provides the eigenvectors.
     * It is an array of plain objects: the `value` property of each gives the
     * associated eigenvalue, and the `vector` property gives the eigenvector
     * itself. Note that the same `value` property will occur as many times in
     * the list provided by `eigenvectors` as the geometric multiplicity of
     * that value.
     *
     * If the algorithm fails to converge, it will throw an error –
     * in that case, however, you may still find useful information
     * in `err.values` and `err.vectors`.
     *
     * Note that the 'precision' option does not directly specify the _accuracy_
     * of the returned eigenvalues. Rather, it determines how small an entry
     * of the iterative approximations to an upper triangular matrix must be
     * in order to be considered zero. The actual accuracy of the returned
     * eigenvalues may be greater or less than the precision, depending on the
     * conditioning of the matrix and how far apart or close the actual
     * eigenvalues are. Note that currently, relatively simple, "traditional"
     * methods of eigenvalue computation are being used; this is not a modern,
     * high-precision eigenvalue computation. That said, it should typically
     * produce fairly reasonable results.
     *
     * Syntax:
     *
     *     math.eigs(x, [prec])
     *     math.eigs(x, {options})
     *
     * Examples:
     *
     *     const { eigs, multiply, column, transpose, matrixFromColumns } = math
     *     const H = [[5, 2.3], [2.3, 1]]
     *     const ans = eigs(H) // returns {values: [E1,E2...sorted], eigenvectors: [{value: E1, vector: v2}, {value: e, vector: v2}, ...]
     *     const E = ans.values
     *     const V = ans.eigenvectors
     *     multiply(H, V[0].vector)) // returns multiply(E[0], V[0].vector))
     *     const U = matrixFromColumns(...V.map(obj => obj.vector))
     *     const UTxHxU = multiply(transpose(U), H, U) // diagonalizes H if possible
     *     E[0] == UTxHxU[0][0]  // returns true always
     *
     *     // Compute only approximate eigenvalues:
     *     const {values} = eigs(H, {eigenvectors: false, precision: 1e-6})
     *
     * See also:
     *
     *     inv
     *
     * @param {Array | Matrix} x  Matrix to be diagonalized
     *
     * @param {number | BigNumber | EigenOptions} [opts] Object with keys `precision`, defaulting to config.relTol, and `eigenvectors`, defaulting to true and specifying whether to compute eigenvectors. If just a number, specifies precision.
     * @return {{values: Array|Matrix, eigenvectors?: Array<EigenvectorResult>}} Object containing an array of eigenvalues and an array of {value: number|BigNumber, vector: Array|Matrix} objects. The eigenvectors property is undefined if eigenvectors were not requested.
     *
     */
    return typed('eigs', {
      // The conversion to matrix in the first two implementations,
      // just to convert back to an array right away in
      // computeValuesAndVectors, is unfortunate, and should perhaps be
      // streamlined. It is done because the Matrix object carries some
      // type information about its entries, and so constructing the matrix
      // is a roundabout way of doing type detection.
      Array: function (x: Scalar[][]): EigenResult {
        return doEigs(matrix(x));
      },
      'Array, number|BigNumber': function (x: Scalar[][], prec: number | BigNumber): EigenResult {
        return doEigs(matrix(x), { precision: prec });
      },
      'Array, Object'(x: Scalar[][], opts: EigenOptions): EigenResult {
        return doEigs(matrix(x), opts);
      },
      Matrix: function (mat: Matrix): EigenResult {
        return doEigs(mat, { matricize: true });
      },
      'Matrix, number|BigNumber': function (mat: Matrix, prec: number | BigNumber): EigenResult {
        return doEigs(mat, { precision: prec, matricize: true });
      },
      'Matrix, Object': function (mat: Matrix, opts: EigenOptions): EigenResult {
        const useOpts: EigenOptions = { matricize: true };
        Object.assign(useOpts, opts);
        return doEigs(mat, useOpts);
      },
    });

    function doEigs(mat: Matrix, opts: EigenOptions = {}): EigenResult {
      const computeVectors = 'eigenvectors' in opts ? opts.eigenvectors : true;
      const prec = opts.precision ?? config.relTol;
      const result = computeValuesAndVectors(mat, prec, computeVectors!);
      if (opts.matricize) {
        result.values = matrix(result.values as Scalar[]);
        if (computeVectors) {
          result.eigenvectors = result.eigenvectors!.map(({ value, vector }) => ({
            value,
            vector: matrix(vector as Scalar[]),
          }));
        }
      }
      if (computeVectors) {
        defineRemovedVectorsGetter(result);
      }
      return result;
    }

    /** finite test of a number, a BigNumber or a Complex; a Fraction is always finite */
    function isFiniteEntry(x: unknown): boolean {
      if (typeof x === 'number') return Number.isFinite(x);
      if (isComplex(x)) {
        const { re, im } = x as { re: number; im: number };
        return Number.isFinite(re) && Number.isFinite(im);
      }
      const f = (x as { isFinite?: () => boolean } | null)?.isFinite;
      return typeof f === 'function' ? f.call(x) : true;
    }

    function computeValuesAndVectors(
      mat: Matrix,
      prec: number | BigNumber,
      computeVectors: boolean
    ): EigenResult {
      const arr = mat.toArray() as Scalar[][]; // NOTE: arr is guaranteed to be unaliased
      // and so safe to modify in place
      const asize = mat.size();

      if (asize.length !== 2 || asize[0] !== asize[1]) {
        throw new RangeError(`Matrix must be square (size: ${format(asize, {})})`);
      }

      const N = asize[0];

      // NaN or Infinity entries make every rotation and test meaningless
      for (const row of arr) {
        for (const x of row) {
          if (!isFiniteEntry(x)) {
            throw new RangeError(`eigs: matrix entries must be finite (got ${String(x)})`);
          }
        }
      }

      // both tests below are relative to the entries they compare, so a small
      // block beside a huge entry keeps its asymmetry and its imaginary parts,
      // and a matrix with tiny entries is not read as real symmetric (#1202)
      const precBig = bignumber(prec as number);
      if (isReal(arr, N, precBig)) {
        coerceReal(arr, N); // modifies arr by side effect

        if (isSymmetric(arr, N, precBig)) {
          const type = coerceTypes(mat, arr, N); // modifies arr by side effect
          return doRealSymmetric(
            arr as unknown as (number | BigNumber)[][],
            N,
            prec,
            type as 'number' | 'BigNumber',
            computeVectors
          );
        }
      }

      const type = coerceTypes(mat, arr, N); // modifies arr by side effect
      return doScaledComplexEigs(arr, N, prec, type, computeVectors);
    }

    /**
     * The general solver squares and multiplies entries, so a BigNumber matrix with entries near
     * the exponent bounds gives NaN (#1257). When the squares of the largest entry can leave the
     * bounds, the entries are divided by an exact power of 10 and each eigenvalue is multiplied
     * back. The eigenvectors do not change. A Complex eigenvalue is multiplied back as a number.
     */
    function doScaledComplexEigs(
      arr: Scalar[][],
      N: number,
      prec: number | BigNumber,
      type: DataType,
      computeVectors: boolean
    ): EigenResult {
      const scale = type === 'BigNumber' ? realScale(arr.flat()) : undefined;
      if (scale === undefined || !scale.big || !squaresLeaveRange(scale.order, N)) {
        return doComplexEigs(arr, N, prec, type, computeVectors);
      }
      const scaled = arr.map((row) =>
        row.map((v) => scale.down(v as unknown as number) as unknown as Scalar)
      );
      const result = doComplexEigs(scaled, N, prec, type, computeVectors);
      // A BigNumber eigenvalue is scaled exactly. A Complex eigenvalue holds numbers, so it is
      // multiplied by 10^order as a number. When that factor is 0 or infinite, the eigenvalue is
      // not representable as a number, and the result is that of the entries without a scale.
      const factor = Number(`1e${scale.order}`);
      const up = (v: unknown): unknown =>
        isBigNumber(v)
          ? scale.up(v as unknown as number)
          : typeof v === 'object' &&
              v !== null &&
              typeof (v as { mul?: unknown }).mul === 'function'
            ? (v as { mul(n: number): unknown }).mul(factor)
            : v;
      const values = result.values as unknown[];
      const complexValue = values.some((v) => !isBigNumber(v));
      if (complexValue && (factor === 0 || !Number.isFinite(factor))) {
        return doComplexEigs(arr, N, prec, type, computeVectors);
      }
      result.values = values.map(up) as typeof result.values;
      for (const pair of result.eigenvectors ?? []) {
        pair.value = up(pair.value) as typeof pair.value;
      }
      return result;
    }

    /**
     * Check if matrix is symmetric: every pair satisfies
     * |a_ij - a_ji| <= prec * max(|a_ij|, |a_ji|). A pair of zeros is equal.
     */
    function isSymmetric(arr: Scalar[][], N: number, prec: BigNumber): boolean {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const diff = bignumber(abs(subtract(arr[i][j], arr[j][i])));
          const aij = bignumber(abs(arr[i][j]));
          const aji = bignumber(abs(arr[j][i]));
          const size = aij.gt(aji) ? aij : aji;
          if (diff.gt(prec.times(size))) {
            return false;
          }
        }
      }

      return true;
    }

    /** Check if every entry is real: |im(a_ij)| <= prec * |a_ij| */
    function isReal(arr: Scalar[][], N: number, prec: BigNumber): boolean {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const imag = bignumber(abs(im(arr[i][j])));
          if (imag.gt(prec.times(bignumber(abs(arr[i][j]))))) {
            return false;
          }
        }
      }

      return true;
    }

    /** Coerce all elements to their real parts */
    function coerceReal(arr: Scalar[][], N: number): void {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          arr[i][j] = re(arr[i][j]) as Scalar;
        }
      }
    }

    /** Detect and coerce matrix elements to a consistent type */
    function coerceTypes(mat: Matrix, arr: Scalar[][], N: number): DataType {
      const type = mat.datatype();

      if (type === 'number' || type === 'BigNumber' || type === 'Complex') {
        return type as DataType;
      }

      let hasNumber = false;
      let hasBig = false;
      let hasComplex = false;

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const el = arr[i][j];

          if (isNumber(el) || isFraction(el)) {
            hasNumber = true;
          } else if (isBigNumber(el)) {
            hasBig = true;
          } else if (isComplex(el)) {
            hasComplex = true;
          } else {
            throw TypeError('Unsupported type in Matrix: ' + typeOf(el));
          }
        }
      }

      if (hasBig && hasComplex) {
        console.warn('Complex BigNumbers not supported, this operation will lose precission.');
      }

      if (hasComplex) {
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            arr[i][j] = complex(arr[i][j]);
          }
        }

        return 'Complex';
      }

      if (hasBig) {
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            arr[i][j] = bignumber(arr[i][j]);
          }
        }

        return 'BigNumber';
      }

      if (hasNumber) {
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            arr[i][j] = number(arr[i][j]);
          }
        }

        return 'number';
      } else {
        throw TypeError('Matrix contains unsupported types only.');
      }
    }
  }
);
