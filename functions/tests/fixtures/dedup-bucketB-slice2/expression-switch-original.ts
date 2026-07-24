/**
 * Transpose a matrix
 * @param {Array} mat
 * @returns {Array} ret
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
