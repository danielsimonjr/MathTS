/**
 * Batched matrix multiply for row-major contiguous Float64Array payloads.
 * Trailing two axes are (m × k) @ (k × n); leading axes are identical batch dims.
 */

export function batchedMatmul(
  aData: Float64Array,
  bData: Float64Array,
  aShape: ReadonlyArray<number>,
  bShape: ReadonlyArray<number>
): Float64Array {
  const rank = aShape.length;
  const batchRank = rank - 2;
  const m = aShape[rank - 2]!;
  const k = aShape[rank - 1]!;
  const n = bShape[rank - 1]!;

  let batchSize = 1;
  for (let b = 0; b < batchRank; b++) batchSize *= aShape[b]!;

  const yData = new Float64Array(batchSize * m * n);

  for (let batch = 0; batch < batchSize; batch++) {
    const aOff = batch * m * k;
    const bOff = batch * k * n;
    const yOff = batch * m * n;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let q = 0; q < k; q++) {
          sum += aData[aOff + i * k + q]! * bData[bOff + q * n + j]!;
        }
        yData[yOff + i * n + j] = sum;
      }
    }
  }

  return yData;
}
