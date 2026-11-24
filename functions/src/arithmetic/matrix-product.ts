type ScalarOperation = (a: unknown, b: unknown) => unknown;

/** Multiply rectangular arrays using the scalar operations supplied by the caller. */
export function multiplyMatrixEntries(
  a: unknown[][],
  b: unknown[][],
  rows: number,
  inner: number,
  columns: number,
  add: ScalarOperation,
  multiply: ScalarOperation
): unknown[][] {
  const result: unknown[][] = [];
  for (let row = 0; row < rows; row++) {
    const entries: unknown[] = [];
    for (let column = 0; column < columns; column++) {
      let value: unknown = inner === 0 ? 0 : multiply(a[row][0], b[0][column]);
      for (let k = 1; k < inner; k++) {
        value = add(value, multiply(a[row][k], b[k][column]));
      }
      entries.push(value);
    }
    result.push(entries);
  }
  return result;
}
