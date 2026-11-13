/**
 * Sequential matrix multiplication: the one kernel for the inline branch of
 * `MathWorkerPool.matmul` and for the synchronous `matmul` of
 * `@danielsimonjr/mathts-functions` (through `@danielsimonjr/mathts-parallel`).
 * Imports nothing, so `dist/worker.js` stays free of external package imports.
 */

/**
 * Checks that `a` holds aRows x aCols elements and `b` holds aCols x bCols elements.
 * Both `matmulSequential` and the worker branch of `MathWorkerPool.matmul` call this check.
 *
 * @throws Error when `a` or `b` does not hold the elements that its shape gives
 */
export function assertMatmulBuffers(
  aLength: number,
  aRows: number,
  aCols: number,
  bLength: number,
  bCols: number
): void {
  if (aLength !== aRows * aCols) {
    throw new Error(`matmul: a has ${aLength} elements, expected ${aRows}x${aCols}`);
  }
  if (bLength !== aCols * bCols) {
    throw new Error(
      `matmul: inner dimensions must match (b has ${bLength} elements, expected aCols*bCols = ${aCols}*${bCols})`
    );
  }
}

/**
 * Multiplies rows `[rowStart, rowEnd)` of the row-major matrix A (`aCols` columns) by B
 * (`aCols` x `bCols`). The result holds `rowEnd - rowStart` rows.
 *
 * This is the one GEMM kernel of the package: `matmulSequential` runs it over all rows and
 * the worker task `matmulRows` runs it over a block. The rows of A and two columns of B are
 * copied into plain arrays, and each element pair of the result is a contiguous dot product.
 * The packed columns are read with stride 1, where the plain triple loop reads B with a
 * stride of `bCols` elements, and the per-element sum keeps the order k = 0, 1, ...,
 * aCols - 1, so every result is equal bit for bit to the plain triple loop.
 *
 * The copies are plain `number[]` and not `Float64Array` on purpose. With `Float64Array`
 * copies the same loops measured 1.5x slower at 256 x 256 on Node 26 (19.5 ms against
 * 13.7 ms, median of 15 interleaved repetitions in one process); the plain-array form is the
 * one `DenseMatrix.multiply` runs, and it measured the same speed (13.0 ms).
 */
export function matmulRowBlock(
  a: Float64Array,
  aCols: number,
  b: Float64Array,
  bCols: number,
  rowStart: number,
  rowEnd: number
): Float64Array {
  const rows = rowEnd - rowStart;
  const out = new Float64Array(rows * bCols);
  const aRows = new Array<number[]>(rows);
  for (let i = 0; i < rows; i++) {
    const ai = (rowStart + i) * aCols;
    const row = new Array<number>(aCols);
    for (let k = 0; k < aCols; k++) row[k] = a[ai + k];
    aRows[i] = row;
  }
  const b0 = new Array<number>(aCols);
  const b1 = new Array<number>(aCols);
  let j = 0;
  for (; j + 1 < bCols; j += 2) {
    for (let k = 0; k < aCols; k++) {
      const bk = k * bCols + j;
      b0[k] = b[bk];
      b1[k] = b[bk + 1];
    }
    for (let i = 0; i < rows; i++) {
      const row = aRows[i];
      let s0 = 0;
      let s1 = 0;
      for (let k = 0; k < aCols; k++) {
        const x = row[k];
        s0 += x * b0[k];
        s1 += x * b1[k];
      }
      const oi = i * bCols + j;
      out[oi] = s0;
      out[oi + 1] = s1;
    }
  }
  if (j < bCols) {
    for (let k = 0; k < aCols; k++) b0[k] = b[k * bCols + j];
    for (let i = 0; i < rows; i++) {
      const row = aRows[i];
      let s = 0;
      for (let k = 0; k < aCols; k++) s += row[k] * b0[k];
      out[i * bCols + j] = s;
    }
  }
  return out;
}

/**
 * Multiplies the row-major matrix A (aRows x aCols) by B (aCols x bCols).
 * The result is a new array. The inputs do not change.
 * The worker kernel `matmulRows` runs the same kernel (`matmulRowBlock`). The results are
 * equal bit for bit, and equal to the plain triple loop `sum += a[i][k] * b[k][j]`.
 *
 * @throws Error when `a` or `b` does not hold the elements that its shape gives
 */
export function matmulSequential(
  a: Float64Array,
  aRows: number,
  aCols: number,
  b: Float64Array,
  bCols: number
): Float64Array {
  assertMatmulBuffers(a.length, aRows, aCols, b.length, bCols);
  return matmulRowBlock(a, aCols, b, bCols, 0, aRows);
}
