interface CscEntry {
  row: number;
  col: number;
  value: unknown;
}

interface MatrixCtor {
  (
    data: { values: unknown[]; index: number[]; ptr: number[]; size: number[] },
    storage: 'sparse'
  ): unknown;
}

/**
 * Sort CSC entries and build `ptr`, row `index`, and `values` (shared by
 * `matrixFromColumns` / `matrixFromRows` sparse assembly).
 * @internal
 */
export function buildSparseCscFromEntries(
  entries: CscEntry[],
  numCols: number,
  size: [number, number],
  matrix: MatrixCtor
): unknown {
  entries.sort((a, b) => {
    if (a.col !== b.col) return a.col - b.col;
    return a.row - b.row;
  });

  const values: unknown[] = [];
  const index: number[] = [];
  const ptr: number[] = new Array(numCols + 1).fill(0);

  for (let i = 0; i < entries.length; i++) {
    ptr[entries[i].col + 1]++;
  }
  for (let j = 1; j <= numCols; j++) {
    ptr[j] += ptr[j - 1];
  }
  for (let i = 0; i < entries.length; i++) {
    values.push(entries[i].value);
    index.push(entries[i].row);
  }

  return matrix({ values, index, ptr, size }, 'sparse');
}
