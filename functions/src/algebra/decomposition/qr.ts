import { factory } from '../../utils/factory.js';
import { format } from '../../utils/string.js';
import { isExactZero } from '../../utils/isExactZero.js';
import { findTypedImpl } from '../../utils/typed-impl.js';
import type { TypedFunction } from '../../core/function/typed.js';
import { isBigNumber, isComplex, isFraction } from '../../utils/is.js';
import { realScale, squaresLeaveRange } from '../../utils/real-scale.js';
import {
  UNIT_FLOOR_LO,
  SQUARED,
  entryRange,
  ldexp,
  withPow2Scale,
} from '@danielsimonjr/mathts-core/internal';

// Type definitions
interface MatrixConstructor {
  (data: unknown[] | unknown[][], storage?: 'dense' | 'sparse'): DenseMatrix | SparseMatrix;
}

interface DenseMatrix {
  type: 'DenseMatrix';
  isDenseMatrix: true;
  _data: unknown[][] | unknown[];
  _size: number[];
  _datatype?: string;
  storage(): 'dense';
  size(): number[];
  valueOf(): unknown[][] | unknown[];
  clone(): DenseMatrix;
}

interface SparseMatrix {
  type: 'SparseMatrix';
  isSparseMatrix: true;
  _values?: unknown[];
  _index?: number[];
  _ptr?: number[];
  _size: number[];
  _datatype?: string;
  _data?: unknown;
  storage(): 'sparse';
  size(): number[];
  valueOf(): unknown[][];
}

interface ZerosFunction {
  (size: number[], format?: string): DenseMatrix;
}

interface IdentityFunction {
  (size: number[], format?: string): DenseMatrix;
}

interface ComplexFunction {
  (re: number, im?: number): unknown;
}

interface QRResult {
  Q: DenseMatrix | SparseMatrix;
  R: DenseMatrix | SparseMatrix;
  toString(): string;
}

interface QRArrayResult {
  Q: unknown[][];
  R: unknown[][];
}

interface Dependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
  zeros: ZerosFunction;
  identity: IdentityFunction;
  isZero: TypedFunction;
  equal: TypedFunction;
  sign: TypedFunction;
  sqrt: TypedFunction;
  conj: TypedFunction;
  unaryMinus: TypedFunction;
  addScalar: TypedFunction;
  divideScalar: TypedFunction;
  multiplyScalar: TypedFunction;
  subtractScalar: TypedFunction;
  complex: ComplexFunction;
}

/** Below this square of a column norm a double has lost its relative precision (2^-1022 * 2^53). */
const DOUBLE_NORM_FLOOR = 2 ** -969;

const name = 'qr';
const dependencies = [
  'typed',
  'matrix',
  'zeros',
  'identity',
  'isZero',
  'equal',
  'sign',
  'sqrt',
  'conj',
  'unaryMinus',
  'addScalar',
  'divideScalar',
  'multiplyScalar',
  'subtractScalar',
  'complex',
];

export const createQr = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    matrix,
    zeros,
    identity,
    isZero,
    equal,
    sign,
    sqrt,
    conj,
    unaryMinus,
    addScalar,
    divideScalar,
    multiplyScalar,
    subtractScalar,
    complex,
  }: Dependencies) => {
    type QRNumberOp = (a: number, b: number) => number;
    type QRNumberConj = (a: number) => number;
    type QRNumberOps = {
      add: QRNumberOp;
      mul: QRNumberOp;
      sub: QRNumberOp;
      div: QRNumberOp;
      conj: QRNumberConj;
    };

    /** Cached once per factory; `undefined` = uninitialized, `null` = find failed. */
    let cachedQrNumberOps: QRNumberOps | null | undefined;

    function getQrNumberOps(): QRNumberOps | null {
      if (cachedQrNumberOps === undefined) {
        const nn = ['number', 'number'];
        const add = findTypedImpl<[number, number], number>(typed, addScalar, nn);
        const mul = findTypedImpl<[number, number], number>(typed, multiplyScalar, nn);
        const sub = findTypedImpl<[number, number], number>(typed, subtractScalar, nn);
        const div = findTypedImpl<[number, number], number>(typed, divideScalar, nn);
        const conjNum = findTypedImpl<[number], number>(typed, conj, ['number']);
        cachedQrNumberOps =
          add && mul && sub && div && conjNum ? { add, mul, sub, div, conj: conjNum } : null;
      }
      return cachedQrNumberOps;
    }

    function matrixAllNumbers(data: unknown[][]): boolean {
      for (let r = 0; r < data.length; r++) {
        const row = data[r];
        for (let c = 0; c < row.length; c++) {
          if (typeof row[c] !== 'number') return false;
        }
      }
      return true;
    }

    /**
     * Tells if the column norm of a Householder step is too small to reflect. Householder only
     * needs a nonzero norm to avoid a division by zero. A plain number matrix is scaled to
     * amax >= 1 first (#1168), so the absolute tolerance of `isZero` is a test relative to
     * amax and keeps its behavior. For any other storage the tolerance dropped a nearly dependent
     * column (#1188), so only an exact zero counts. A norm held in doubles also counts as zero
     * when its square is below `DOUBLE_NORM_FLOOR`: the square then has lost its relative
     * precision and a reflection built from it is not orthogonal.
     */
    function zeroPivot(pivot: unknown, plain: boolean): boolean {
      return plain ? (equal(pivot, 0) as boolean) : isExactZero(pivot);
    }

    function negligibleNorm(alpha: unknown, alphaSquared: unknown, plain: boolean): boolean {
      if (plain) return isZero(alpha) as boolean;
      if (isExactZero(alpha)) return true;
      const sq =
        typeof alphaSquared === 'number'
          ? alphaSquared
          : (alphaSquared as { re?: unknown } | null)?.re;
      return typeof sq === 'number' && sq < DOUBLE_NORM_FLOOR;
    }

    /**
     * Householder step loop for plain number storage. Scalar work per step uses the
     * same typed calls as `_denseQRimpl`; inner R/Q updates use cached number ops.
     * Returns the first step index to finish on the generic path (may be `limit`).
     */
    function _denseQRNumber(
      Rdata: number[][],
      Qdata: number[][],
      w: unknown[],
      rows: number,
      cols: number,
      kStart: number,
      ops: QRNumberOps
    ): number {
      const limit = Math.min(cols, rows);
      let i: number;
      let j: number;

      for (let k = kStart; k < limit; ++k) {
        const pivot = Rdata[k][k];
        const sgn = unaryMinus(equal(pivot, 0) ? 1 : sign(pivot));
        const conjSgn = conj(sgn);

        let alphaSquared: unknown = 0;

        for (i = k; i < rows; i++) {
          alphaSquared = addScalar(alphaSquared, multiplyScalar(Rdata[i][k], conj(Rdata[i][k])));
        }

        const alpha = multiplyScalar(sgn, sqrt(alphaSquared));

        if (!isZero(alpha)) {
          const u1 = subtractScalar(pivot, alpha);

          w[k] = 1;

          for (i = k + 1; i < rows; i++) {
            w[i] = divideScalar(Rdata[i][k], u1);
          }

          const tau = unaryMinus(conj(divideScalar(u1, alpha)));

          if (typeof tau !== 'number' || typeof conjSgn !== 'number' || typeof u1 !== 'number') {
            return k;
          }

          let s: number;

          for (j = k; j < cols; j++) {
            s = 0.0;

            for (i = k; i < rows; i++) {
              s = ops.add(s, ops.mul(ops.conj(w[i] as number), Rdata[i][j]));
            }

            s = ops.mul(s, tau);

            for (i = k; i < rows; i++) {
              Rdata[i][j] = ops.mul(ops.sub(Rdata[i][j], ops.mul(w[i] as number, s)), conjSgn);
            }
          }

          for (i = 0; i < rows; i++) {
            s = 0.0;

            for (j = k; j < rows; j++) {
              s = ops.add(s, ops.mul(Qdata[i][j], w[j] as number));
            }

            s = ops.mul(s, tau);

            for (j = k; j < rows; ++j) {
              Qdata[i][j] = ops.div(
                ops.sub(Qdata[i][j], ops.mul(s, ops.conj(w[j] as number))),
                conjSgn
              );
            }
          }
        }
      }

      return limit;
    }

    /**
     * Calculate the Matrix QR decomposition. Matrix `A` is decomposed in
     * two matrices (`Q`, `R`) where `Q` is an
     * orthogonal matrix and `R` is an upper triangular matrix.
     *
     * Syntax:
     *
     *    math.qr(A)
     *
     * Example:
     *
     *    const m = [
     *      [1, -1,  4],
     *      [1,  4, -2],
     *      [1,  4,  2],
     *      [1,  -1, 0]
     *    ]
     *    const result = math.qr(m)
     *    // r = {
     *    //   Q: [
     *    //     [0.5, -0.5,   0.5],
     *    //     [0.5,  0.5,  -0.5],
     *    //     [0.5,  0.5,   0.5],
     *    //     [0.5, -0.5,  -0.5],
     *    //   ],
     *    //   R: [
     *    //     [2, 3,  2],
     *    //     [0, 5, -2],
     *    //     [0, 0,  4],
     *    //     [0, 0,  0]
     *    //   ]
     *    // }
     *
     * See also:
     *
     *    lup, lusolve
     *
     * @param {Matrix | Array} A    A two dimensional matrix or array
     * for which to get the QR decomposition.
     *
     * @return {{Q: Array | Matrix, R: Array | Matrix}} Q: the orthogonal
     * matrix and R: the upper triangular matrix
     */
    const qrTyped = typed(name, {
      DenseMatrix: function (m: DenseMatrix): QRResult {
        return _denseQR(m);
      },

      SparseMatrix: function (m: SparseMatrix): QRResult {
        return _sparseQR(m);
      },

      Array: function (a: unknown[][]): QRArrayResult {
        // create dense matrix from array
        const m = matrix(a) as DenseMatrix;
        // lup, use matrix implementation
        const r = _denseQR(m);
        // result
        return {
          Q: r.Q.valueOf() as unknown[][],
          R: r.R.valueOf() as unknown[][],
        };
      },
    });

    // Attach _denseQRimpl to the typed function
    (qrTyped as unknown as { _denseQRimpl: typeof _denseQRimpl })._denseQRimpl = _denseQRimpl;

    return qrTyped;

    /**
     * Householder needs square roots, so Fraction cells cannot stay in ℚ.
     * Promote them to IEEE numbers (valueOf) and keep the existing number path.
     */
    function promoteFractionEntries(data: unknown[][]): void {
      for (let r = 0; r < data.length; r++) {
        const row = data[r];
        for (let c = 0; c < row.length; c++) {
          const v = row[c];
          if (isFraction(v)) {
            row[c] = Number((v as { valueOf(): unknown }).valueOf());
          }
        }
      }
    }

    interface EntryKind {
      zero: () => unknown;
      one: () => unknown;
      convert: (v: unknown) => unknown;
    }

    /**
     * The entry type of a matrix (#1206). It is Complex when an entry is Complex and every other
     * entry is a number, a BigNumber or a Complex; a BigNumber entry becomes a Complex (as `det`).
     * It is BigNumber when an entry is BigNumber and every other entry is a number or BigNumber.
     * Else it is null (a plain number matrix, or a type with no promotion rule), and the entries
     * stay as they are.
     */
    function entryKind(data: unknown[][]): EntryKind | null {
      let cplx = false;
      let big: { constructor: new (v: number) => unknown } | null = null;
      let other = false;
      for (const row of data) {
        for (const v of row) {
          if (isComplex(v)) cplx = true;
          else if (isBigNumber(v))
            big = v as unknown as { constructor: new (v: number) => unknown };
          else if (typeof v !== 'number') other = true;
        }
      }
      if (other) return null;
      if (cplx) {
        return {
          zero: () => complex(0),
          one: () => complex(1),
          convert: (v) => (isComplex(v) ? v : complex(Number(v))),
        };
      }
      if (big) {
        const Big = big.constructor;
        return {
          zero: () => new Big(0),
          one: () => new Big(1),
          convert: (v) => (typeof v === 'number' ? new Big(v) : v),
        };
      }
      return null;
    }

    /**
     * The scale of the entries k..rows-1 of column k when they are all numbers or BigNumbers, at
     * least one is a BigNumber and their squares can leave the configured exponent bounds, else
     * `undefined`. A column whose squares stay in range keeps the unscaled norm, so its result
     * does not change.
     */
    function bigColumnScale(Rdata: unknown[][], k: number, rows: number) {
      const column: unknown[] = [];
      for (let i = k; i < rows; i++) column.push(Rdata[i][k]);
      const scale = realScale(column);
      return scale && scale.big && squaresLeaveRange(scale.order, rows - k) ? scale : undefined;
    }

    function _denseQRimpl(m: DenseMatrix, plain: boolean): QRResult {
      // rows & columns (m x n)
      const rows = m._size[0]; // m
      const cols = m._size[1]; // n

      const Q = identity([rows], 'dense');
      const Qdata = Q._data as unknown[][];

      const R = m.clone();
      const Rdata = R._data as unknown[][];

      // Q and R hold the entry type of the input, also where a skipped step writes nothing (#1206).
      const kind = entryKind(Rdata);
      if (kind) {
        for (const row of Rdata) for (let c = 0; c < row.length; c++) row[c] = kind.convert(row[c]);
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < rows; c++) Qdata[r][c] = r === c ? kind.one() : kind.zero();
      }

      // vars
      let i: number, j: number, k: number;

      const w = zeros([rows], '') as unknown as unknown[];

      let kStart = 0;
      const numberOps = getQrNumberOps();
      if (numberOps && plain && matrixAllNumbers(Qdata)) {
        kStart = _denseQRNumber(
          Rdata as number[][],
          Qdata as number[][],
          w,
          rows,
          cols,
          0,
          numberOps
        );
      }

      for (k = kStart; k < Math.min(cols, rows); ++k) {
        /*
         * **k-th Household matrix**
         *
         * The matrix I - 2*v*transpose(v)
         * x     = first column of A
         * x1    = first element of x
         * alpha = x1 / |x1| * |x|
         * e1    = tranpose([1, 0, 0, ...])
         * u     = x - alpha * e1
         * v     = u / |u|
         *
         * Household matrix = I - 2 * v * tranpose(v)
         *
         *  * Initially Q = I and R = A.
         *  * Household matrix is a reflection in a plane normal to v which
         *    will zero out all but the top right element in R.
         *  * Appplying reflection to both Q and R will not change product.
         *  * Repeat this process on the (1,1) minor to get R as an upper
         *    triangular matrix.
         *  * Reflections leave the magnitude of the columns of Q unchanged
         *    so Q remains othoganal.
         *
         */

        const pivot = Rdata[k][k];
        const sgn = unaryMinus(zeroPivot(pivot, plain) ? 1 : sign(pivot));
        const conjSgn = conj(sgn);

        let alphaSquared: unknown = 0;
        // The squares of a BigNumber column can leave the exponent bounds when its norm is in
        // range (#1257). Then the column is divided by an exact power of 10 first.
        const colScale = plain ? undefined : bigColumnScale(Rdata, k, rows);

        for (i = k; i < rows; i++) {
          const x = colScale ? colScale.down(Rdata[i][k] as number) : Rdata[i][k];
          alphaSquared = addScalar(alphaSquared, multiplyScalar(x, conj(x)));
        }

        const root = sqrt(alphaSquared);
        const alpha = multiplyScalar(sgn, colScale ? colScale.up(root as number) : root);

        if (!negligibleNorm(alpha, alphaSquared, plain)) {
          // first element in vector u
          const u1 = subtractScalar(pivot, alpha);

          // w = v * u1 / |u|    (only elements k to (rows-1) are used)
          w[k] = 1;

          for (i = k + 1; i < rows; i++) {
            w[i] = divideScalar(Rdata[i][k], u1);
          }

          // tau = - conj(u1 / alpha)
          const tau = unaryMinus(conj(divideScalar(u1, alpha)));

          let s: unknown;

          /*
           * tau and w have been choosen so that
           *
           * 2 * v * tranpose(v) = tau * w * tranpose(w)
           */

          /*
           * -- calculate R = R - tau * w * tranpose(w) * R --
           * Only do calculation with rows k to (rows-1)
           * Additionally columns 0 to (k-1) will not be changed by this
           *   multiplication so do not bother recalculating them
           */
          for (j = k; j < cols; j++) {
            s = 0.0;

            // calculate jth element of [tranpose(w) * R]
            for (i = k; i < rows; i++) {
              s = addScalar(s, multiplyScalar(conj(w[i]), Rdata[i][j]));
            }

            // calculate the jth element of [tau * transpose(w) * R]
            s = multiplyScalar(s, tau);

            for (i = k; i < rows; i++) {
              Rdata[i][j] = multiplyScalar(
                subtractScalar(Rdata[i][j], multiplyScalar(w[i], s)),
                conjSgn
              );
            }
          }
          /*
           * -- calculate Q = Q - tau * Q * w * transpose(w) --
           * Q is a square matrix (rows x rows)
           * Only do calculation with columns k to (rows-1)
           * Additionally rows 0 to (k-1) will not be changed by this
           *   multiplication so do not bother recalculating them
           */
          for (i = 0; i < rows; i++) {
            s = 0.0;

            // calculate ith element of [Q * w]
            for (j = k; j < rows; j++) {
              s = addScalar(s, multiplyScalar(Qdata[i][j], w[j]));
            }

            // calculate the ith element of [tau * Q * w]
            s = multiplyScalar(s, tau);

            for (j = k; j < rows; ++j) {
              Qdata[i][j] = divideScalar(
                subtractScalar(Qdata[i][j], multiplyScalar(s, conj(w[j]))),
                conjSgn
              );
            }
          }
        }
      }

      // return matrices
      return {
        Q,
        R,
        toString: function () {
          return 'Q: ' + this.Q.toString() + '\nR: ' + this.R.toString();
        },
      };
    }

    /**
     * The real and imaginary parts of every entry when each entry is a number or a Complex,
     * else `null`. The scale window of a Complex matrix uses them.
     */
    function complexParts(data: unknown[][]): number[] | null {
      const parts: number[] = [];
      for (const row of data) {
        for (const v of row) {
          if (typeof v === 'number') parts.push(v);
          else if (isComplex(v) && typeof v.re === 'number' && typeof v.im === 'number')
            parts.push(v.re, v.im);
          else return null;
        }
      }
      return parts;
    }

    /** Scale every number or Complex entry by 2^e in place. The scale is exact. */
    function ldexpEntries(data: unknown[][], e: number): void {
      for (const row of data) {
        for (let j = 0; j < row.length; j++) {
          const v = row[j];
          if (typeof v === 'number') row[j] = ldexp(v, e);
          else {
            const z = v as { re: number; im: number };
            row[j] = complex(ldexp(z.re, e), ldexp(z.im, e));
          }
        }
      }
    }

    /**
     * Householder QR, scaled by an exact power of 2 when the largest entry (the largest real
     * or imaginary part for Complex) is outside [2^0, 2^400]. Above the window the squares of
     * the Householder step overflow. Below the window the squares of the column norm lose
     * precision, and the absolute `isZero` test of a number matrix drops a small residual
     * column (#1122, #1168). Q is unitary, so only R is scaled back (#1122). A Fraction entry is
     * converted to a number first, so a number or Fraction matrix takes the number path. A
     * number or Complex matrix with a Complex entry is scaled the same way and its Householder
     * step tests the column norm for an exact zero (#1188). Any other matrix (for example
     * BigNumber) is not scaled and also tests for an exact zero (#1188).
     */
    function _denseQRScaled(m: DenseMatrix): QRResult {
      let src = m;
      if ((m._data as unknown[][]).some((row) => row.some(isFraction))) {
        src = m.clone();
        promoteFractionEntries(src._data as unknown[][]);
      }
      const data = src._data as unknown[][];
      if (data.length === 0) return _denseQRimpl(src, true);
      const real = matrixAllNumbers(data);
      const parts = real ? (data as number[][]) : complexParts(data);
      if (parts === null) return _denseQRimpl(src, false);
      return withPow2Scale(entryRange(parts), UNIT_FLOOR_LO, SQUARED, (e) => {
        if (e === 0) return _denseQRimpl(src, real);
        const scaled = src.clone();
        ldexpEntries(scaled._data as unknown[][], e);
        const ret = _denseQRimpl(scaled, real);
        ldexpEntries(ret.R._data as unknown[][], -e);
        return ret;
      });
    }

    function _denseQR(m: DenseMatrix): QRResult {
      // qr factors a two dimensional matrix; the size check runs before the empty-input branch so
      // that a size such as [1, 1, 0] is not read as a 1 x 0 matrix. The empty vector (size [0])
      // is the one non-2-D input that passes: it keeps the empty result.
      const size = m._size;
      if (size.length !== 2 && !(size.length === 1 && size[0] === 0)) {
        throw new RangeError('Matrix must be two dimensional (size: ' + format(size, {}) + ')');
      }
      // Empty input: no Householder step runs. Q is the complete m x m identity (m = 0 gives a
      // 0 x 0 Q) and R is a copy of the input (m x n with m = 0 or n = 0), as NumPy mode='complete'.
      if (size.some((d) => d === 0)) {
        const rows = size[0];
        return {
          Q: rows > 0 ? identity([rows], 'dense') : zeros([0, 0], 'dense'),
          R: m.clone(),
        } as QRResult;
      }
      const ret = _denseQRScaled(m);
      const Rdata = ret.R._data as unknown[][];
      if ((m._data as unknown[][]).length > 0) {
        const kind = entryKind(Rdata);
        // With no promotion rule (kind is null), the zero follows R[0][0].
        const zero = isComplex(Rdata[0][0]) ? complex(0) : 0;

        for (let i = 0; i < Rdata.length; ++i) {
          for (let j = 0; j < i && j < (Rdata[0] || []).length; ++j) {
            Rdata[i][j] = kind ? kind.zero() : zero;
          }
        }
      }

      return ret;
    }

    // QR of a sparse matrix: there is no sparse Householder kernel, so densify, factor, and return
    // dense Q and R (both are generally dense even when the input is sparse).
    // `valueOf` of a matrix with no rows is `[]`, which loses the column count, so an empty
    // input is rebuilt from its size.
    function _sparseQR(m: SparseMatrix): QRResult {
      if (m._size.some((d) => d === 0)) return _denseQR(zeros(m._size, 'dense'));
      return _denseQR(matrix(m.valueOf(), 'dense') as DenseMatrix);
    }
  }
);
