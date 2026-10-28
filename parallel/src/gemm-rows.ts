/**
 * Row-block dense matrix multiply (ijk inner-k product). Shared by the main
 * thread sequential path and worker row tasks; no package dependencies so the
 * worker bundle stays lean.
 */

/**
 * Multiply rows `[rowStart, rowEnd)` of `A` by `B`, writing into `out`.
 *
 * @param aData - Row-major `A` with `aCols` columns
 * @param aCols - Inner dimension (columns of `A`, rows of `B`)
 * @param bData - Row-major `B` with `bCols` columns
 * @param bCols - Columns of `B` and of the product
 * @param rowStart - First row of `A` to accumulate (inclusive)
 * @param rowEnd - Last row of `A` to accumulate (exclusive)
 * @param out - Output buffer; row `i` is stored at `(i - outRowBase) * bCols`
 * @param outRowBase - Row index in `out` corresponding to `rowStart`
 */
export function gemmRows(
  aData: ArrayLike<number>,
  aCols: number,
  bData: ArrayLike<number>,
  bCols: number,
  rowStart: number,
  rowEnd: number,
  out: Float64Array,
  outRowBase: number
): void {
  for (let i = rowStart; i < rowEnd; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += aData[i * aCols + k] * bData[k * bCols + j];
      }
      out[(i - outRowBase) * bCols + j] = sum;
    }
  }
}
