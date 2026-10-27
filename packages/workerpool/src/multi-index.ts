/**
 * Multi-dimensional index iteration (no imports — safe for the worker bundle).
 */

/**
 * Iterate over all multi-indices for `sizes`, calling `cb(idx)`.
 *
 * @internal
 */
export function forEachMultiIndex(sizes: readonly number[], cb: (idx: number[]) => void): void {
  const rank = sizes.length;
  if (rank === 0) {
    cb([]);
    return;
  }
  const idx = new Array<number>(rank).fill(0);
  const total = sizes.reduce((a: number, b: number) => a * b, 1);
  for (let n = 0; n < total; n++) {
    cb(idx.slice());
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      if (idx[d] < sizes[d]) break;
      idx[d] = 0;
    }
  }
}
