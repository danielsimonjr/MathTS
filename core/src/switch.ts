/**
 * Transpose a 2D array. Private helper used only by `core/src/collection.ts`'s
 * `_reduce` (Bucket B slice 2 canonical) — mirrors `expression/src/utils/switch.ts`
 * / `functions/src/utils/switch.ts`, which remain in place unchanged for now
 * (not part of this slice's named scope). Not exported from `internal.ts`.
 * @private
 */
export function _switch<T>(mat: T[][]): T[][] {
  const I = mat.length;
  const J = mat[0].length;
  let i: number, j: number;
  const ret: T[][] = [];
  for (j = 0; j < J; j++) {
    const tmp: T[] = [];
    for (i = 0; i < I; i++) {
      tmp.push(mat[i][j]);
    }
    ret.push(tmp);
  }
  return ret;
}
