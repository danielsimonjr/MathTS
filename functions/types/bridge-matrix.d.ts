/**
 * The matrix values that `matrix()` and `sparse()` return, and that the statistics functions
 * read. The runtime classes (`MathJSDenseMatrix`, `MathJSSparseMatrix`) are not public, and they
 * are not the matrix-package `DenseMatrix` and `SparseMatrix`: a size is a method here, and a
 * property there. These two interfaces name the members that both bridge classes have.
 */

/** Any matrix object: the two members every matrix has. */
export interface MatrixValue {
  readonly isMatrix: boolean;
  toArray(): unknown;
}

/** The matrix that `matrix()` and `sparse()` return, dense or sparse. */
export interface BridgeMatrix extends MatrixValue {
  readonly rows: number;
  readonly cols: number;
  /** The size of each dimension, `[rows, cols]` for a 2-D matrix. */
  size(): number[];
  /** One entry, by an index array or by a row and a column. */
  get(indexOrRow: number[] | number, col?: number): unknown;
  valueOf(): unknown;
  clone(): BridgeMatrix;
  storage(): string;
  toString(): string;
}
