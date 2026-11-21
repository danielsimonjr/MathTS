/**
 * Sparse x sparse matrix product that reads the stored entries only (#1271).
 *
 * The old path converted both operands to dense nested arrays, multiplied them and sparsified
 * the result: O(n^3) time and O(n^2) memory. This module multiplies column by column in the
 * CSC form of the factory layer (Gustavson's algorithm, as `_multiplySparseMatrixSparseMatrix`
 * of mathjs). A public matrix-package pair (CSR) uses the row product of that class, and a
 * mixed pair converts the CSR operand to CSC once (O(nnz)).
 *
 * The scalar `add` and `multiply` of the typed layer come in as parameters. This module
 * cannot import `typed/arithmetic.ts` (it imports this module).
 *
 * @packageDocumentation
 */

import { SparseMatrix, isSparseMatrix } from '@danielsimonjr/mathts-matrix';
import { MathJSDenseMatrix, MathJSSparseMatrix, denseOfSize } from '../factories/matrix-bridge.js';
import { csrToCsc, cscToPublic } from '../factories/sparse-adapter.js';

/** A binary operation on two scalars of any type. */
export type SparseScalarOp = (a: unknown, b: unknown) => unknown;

/** The result of a sparse x sparse product. */
export type SparseProduct = MathJSSparseMatrix | SparseMatrix | MathJSDenseMatrix;

/** The size of a sparse operand of either class: the CSC `_size`, or `rows` and `cols`. */
function sparseSize(m: unknown): [number, number] {
  if (m instanceof MathJSSparseMatrix) return [m._size[0], m._size[1]];
  const p = m as { rows: number; cols: number };
  return [p.rows, p.cols];
}

/**
 * Throw the dimension error of a matrix product.
 *
 * @param a - Size `[rows, cols]` of the left operand.
 * @param b - Size `[rows, cols]` of the right operand.
 * @throws Error when the column count of `a` is not the row count of `b`.
 */
export function assertInnerDimensions(a: readonly number[], b: readonly number[]): void {
  if (a[1] !== b[0]) {
    throw new Error(`Cannot multiply ${a[0]}×${a[1]} matrix with ${b[0]}×${b[1]} matrix`);
  }
}

/** True when the first `count` entries of `values` are numbers. */
function allNumbers(values: readonly unknown[], count: number): boolean {
  for (let i = 0; i < count; i++) {
    if (typeof values[i] !== 'number') return false;
  }
  return true;
}

/** Sort `rows[0..count)` in place, ascending. */
function sortRows(rows: Int32Array, count: number): void {
  if (count > 24) {
    rows.subarray(0, count).sort();
    return;
  }
  for (let i = 1; i < count; i++) {
    const v = rows[i];
    let j = i - 1;
    while (j >= 0 && rows[j] > v) {
      rows[j + 1] = rows[j];
      j--;
    }
    rows[j + 1] = v;
  }
}

/**
 * The distinct rows that a CSC operand stores, in ascending order, and for each stored entry the
 * position of its row in that list. A product of a tall matrix (many rows, few entries) works in
 * this compact row space, so its workspace has one slot per stored row, not per row of the matrix.
 * The order of the compact ids is the order of the rows, so sorting ids sorts rows.
 */
function compactRows(
  index: ArrayLike<number>,
  count: number
): { ids: Int32Array; rows: Int32Array } {
  const sorted = new Int32Array(count);
  for (let q = 0; q < count; q++) sorted[q] = index[q];
  sorted.sort();
  let distinct = 0;
  for (let q = 0; q < count; q++) {
    if (q === 0 || sorted[q] !== sorted[q - 1]) sorted[distinct++] = sorted[q];
  }
  const rows = sorted.slice(0, distinct);
  const ids = new Int32Array(count);
  for (let q = 0; q < count; q++) {
    let lo = 0;
    let hi = distinct - 1;
    const row = index[q];
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (rows[mid] < row) lo = mid + 1;
      else hi = mid;
    }
    ids[q] = lo;
  }
  return { ids, rows };
}

/** A matrix with more rows than this multiple of its stored entries and columns is tall. */
const TALL_ROW_FACTOR = 4;
/** A matrix below this row count never takes the compact row space. */
const TALL_ROW_FLOOR = 1 << 16;

/**
 * The product of two CSC matrices, as mathjs stores it: every structural product entry is
 * kept, also a sum that cancels to zero (csAmd and the CSparse factories read the pattern).
 * The row indices of each column are sorted. A matrix with no stored values (`_values` null)
 * is a pattern: the product is a pattern too.
 *
 * Each column is read through `_ptr` only. The index and value arrays may be longer than
 * `_ptr[cols]` (csAmd compacts them in place), and the kernel does not depend on their length.
 *
 * Cost: O(rows + cols + flops + nnz(C) log m), where m is the largest column count of the
 * result. Memory: O(rows + nnz(C)). A column workspace of `rows` entries is allocated once.
 * A tall left operand (`rows` above 4 x (stored entries + columns) and above 65536) works in the
 * compact row space of its stored rows instead: O(nnz(a) log nnz(a)) more time, and a workspace
 * of one slot per stored row, so 5e7 rows with 3 entries need no 200 MB.
 *
 * @param a - Left operand (`rows x inner`).
 * @param b - Right operand (`inner x cols`).
 * @param add - Scalar sum (used when an entry is not a number).
 * @param mul - Scalar product (used when an entry is not a number).
 * @returns The product, as a new CSC matrix.
 * @throws Error when the inner dimensions differ.
 */
export function cscProduct(
  a: MathJSSparseMatrix,
  b: MathJSSparseMatrix,
  add: SparseScalarOp,
  mul: SparseScalarOp
): MathJSSparseMatrix {
  assertInnerDimensions(a._size, b._size);
  const rows = a._size[0];
  const inner = a._size[1];
  const cols = b._size[1];
  const aPtr = a._ptr;
  const aIndex = a._index;
  const aValues = a._values;
  const bPtr = b._ptr;
  const bIndex = b._index;
  const bValues = b._values;
  const pattern = aValues === null || bValues === null;
  const numeric = !pattern && allNumbers(aValues, aPtr[inner]) && allNumbers(bValues, bPtr[cols]);

  const storedA = aPtr[inner];
  const tall = rows > TALL_ROW_FLOOR && rows > TALL_ROW_FACTOR * (storedA + cols);
  const compact = tall ? compactRows(aIndex, storedA) : null;
  const aRow = compact !== null ? compact.ids : aIndex;
  const slots = compact !== null ? compact.rows.length : rows;
  const mark = new Int32Array(slots).fill(-1);
  const columnRows = new Int32Array(slots);
  const accNumber = numeric ? new Float64Array(slots) : null;
  const accAny: unknown[] | null = numeric || pattern ? null : new Array<unknown>(slots);
  const index: number[] = [];
  const values: unknown[] | null = pattern ? null : [];
  const ptr = new Array<number>(cols + 1);
  ptr[0] = 0;

  for (let j = 0; j < cols; j++) {
    let count = 0;
    for (let p = bPtr[j]; p < bPtr[j + 1]; p++) {
      const k = bIndex[p];
      for (let q = aPtr[k]; q < aPtr[k + 1]; q++) {
        const r = aRow[q];
        const fresh = mark[r] !== j;
        if (fresh) {
          mark[r] = j;
          columnRows[count++] = r;
        }
        if (accNumber !== null) {
          const t = (aValues![q] as number) * (bValues![p] as number);
          accNumber[r] = fresh ? t : accNumber[r] + t;
        } else if (accAny !== null) {
          const t = mul(aValues![q], bValues![p]);
          accAny[r] = fresh ? t : add(accAny[r], t);
        }
      }
    }
    sortRows(columnRows, count);
    for (let c = 0; c < count; c++) {
      const r = columnRows[c];
      index.push(compact !== null ? compact.rows[r] : r);
      if (values !== null) values.push(accNumber !== null ? accNumber[r] : accAny![r]);
    }
    ptr[j + 1] = index.length;
  }

  return new MathJSSparseMatrix({
    values,
    index,
    ptr,
    size: [rows, cols],
    datatype: a._datatype === b._datatype ? a._datatype : undefined,
  });
}

/**
 * The product of two sparse matrices of any storage.
 *
 * - Two CSC matrices (`MathJSSparseMatrix`) give a CSC matrix, as mathjs does.
 * - Two public CSR matrices (`SparseMatrix`) use the row product of that class. It stores no
 *   zero, so a sum that cancels is dropped.
 * - A mixed pair converts the CSR operand to CSC, then gives the public `SparseMatrix` when
 *   every entry is a number (as before) and a dense matrix otherwise (the public class
 *   stores numbers only).
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @param add - Scalar sum for entries that are not numbers.
 * @param mul - Scalar product for entries that are not numbers.
 * @returns The product.
 * @throws Error when the inner dimensions differ (before any work).
 */
export function sparseProduct(
  a: unknown,
  b: unknown,
  add: SparseScalarOp,
  mul: SparseScalarOp
): SparseProduct {
  assertInnerDimensions(sparseSize(a), sparseSize(b));
  const publicA = isSparseMatrix(a);
  const publicB = isSparseMatrix(b);
  if (publicA && publicB) return (a as SparseMatrix).multiply(b as SparseMatrix);
  if (!publicA && !publicB) {
    return cscProduct(a as MathJSSparseMatrix, b as MathJSSparseMatrix, add, mul);
  }
  const product = cscProduct(
    publicA ? csrToCsc(a as SparseMatrix) : (a as MathJSSparseMatrix),
    publicB ? csrToCsc(b as SparseMatrix) : (b as MathJSSparseMatrix),
    add,
    mul
  );
  const out = cscToPublic(product);
  if (out instanceof SparseMatrix) return out;
  return denseOfSize(product.toArray() as number[][], product.size());
}
