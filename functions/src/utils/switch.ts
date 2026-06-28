/**
 * Transpose a matrix
 * @param {Array} mat
 * @returns {Array} ret
 * @private
 */
export function _switch(mat: unknown[]): unknown[] {
  const rows = mat as unknown[][];
  const I = rows.length;
  const J = rows[0].length;
  let i, j;
  const ret: unknown[][] = [];
  for (j = 0; j < J; j++) {
    const tmp: unknown[] = [];
    for (i = 0; i < I; i++) {
      tmp.push(rows[i][j]);
    }
    ret.push(tmp);
  }
  return ret;
}
