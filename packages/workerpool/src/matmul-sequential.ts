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
 * Multiplies the row-major matrix A (aRows x aCols) by B (aCols x bCols).
 * The result is a new array. The inputs do not change.
 * The worker kernel `matmulRows` uses the same loop order, so the results are equal bit for bit.
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
  const result = new Float64Array(aRows * bCols);
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i * aCols + k] * b[k * bCols + j];
      }
      result[i * bCols + j] = sum;
    }
  }
  return result;
}
