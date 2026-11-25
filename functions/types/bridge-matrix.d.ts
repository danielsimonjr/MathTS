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
  /** One entry set in place, by an index array. Returns the same matrix. */
  set(index: number[], value: unknown, defaultValue?: unknown): BridgeMatrix;
  /** A new matrix of the callback result for each entry. */
  map(callback: (value: unknown, index: number[], matrix: BridgeMatrix) => unknown): BridgeMatrix;
  /** Call the callback for each entry. */
  forEach(callback: (value: unknown, index: number[], matrix: BridgeMatrix) => void): void;
  /** The matrix with a new size; new entries take `defaultValue`. */
  resize(size: number[], defaultValue?: unknown, copy?: boolean): BridgeMatrix;
  /** The same entries in a new shape. */
  reshape(size: number[], copy?: boolean): BridgeMatrix;
  clone(): BridgeMatrix;
  storage(): string;
  /** Swap two rows of a 2-D matrix in place. */
  swapRows(i: number, j: number): this;
  format(options?: unknown): string;
  toString(): string;
}
