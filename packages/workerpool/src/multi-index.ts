/**
 * Multi-dimensional index iteration (no imports — safe for the worker bundle).
 */

/**
 * Call `cb` once for every row-major multi-index of `sizes`.
 *
 * Rank 0 (`sizes` empty) calls `cb([])` once. The callback receives a copy of
 * the index, so later iterations do not mutate earlier arrays.
 *
 * This module has no imports. The worker bundle can load it without pulling
 * `core` or `parallel`.
 *
 * @internal
 * @param sizes - Extent of each axis.
 * @param cb - Visitor. Receives one index array per call.
 *
 * @example
 * ```ts
 * import { forEachMultiIndex } from '@danielsimonjr/mathts-workerpool';
 * const seen: number[][] = [];
 * forEachMultiIndex([2, 2], (idx) => seen.push(idx));
 * // [[0, 0], [0, 1], [1, 0], [1, 1]]
 * forEachMultiIndex([], (idx) => seen.push(idx)); // also pushes []
 * ```
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
