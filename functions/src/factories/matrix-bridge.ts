/**
 * Matrix Compatibility Bridge
 *
 * Wraps the native MathTS DenseMatrix (Float64Array-backed) with the interface
 * that synced mathjs factory functions expect:
 *   ._data, ._size, .storage(), .datatype(), .valueOf(), .size(),
 *   .get(), .set(), .map(), .forEach(), .clone(), .subset(), .create()
 *
 * This enables ~89 dormant factory functions to operate on matrices without
 * rewriting each one.
 */

import { DenseMatrix } from '@mathts/matrix';

/**
 * mathjs-compatible dense matrix adapter.
 *
 * Stores data as nested number[][] (what mathjs factories expect) while
 * providing conversion to/from the native Float64Array-backed DenseMatrix.
 */
export class MathJSDenseMatrix {
  _data: number[][];
  _size: number[];
  _datatype: string | undefined;

  constructor(data?: number[][] | { data: number[][]; size: number[] }) {
    if (!data) {
      this._data = [];
      this._size = [0, 0];
    } else if (Array.isArray(data)) {
      this._data = data;
      this._size = inferSize(data);
    } else {
      this._data = data.data;
      this._size = data.size;
    }
  }

  /**
   * Row count — required by @mathts/core isMatrix duck-type check.
   */
  get rows(): number {
    return this._size[0] ?? 0;
  }

  /**
   * Column count — required by @mathts/core isMatrix duck-type check.
   */
  get cols(): number {
    return this._size[1] ?? 0;
  }

  storage(): string {
    return 'dense';
  }

  datatype(): string | undefined {
    return this._datatype;
  }

  valueOf(): number[][] {
    return this._data;
  }

  size(): number[] {
    return [...this._size];
  }

  toArray(): number[][] {
    return this._data.map((row) => [...row]);
  }

  toJSON(): { mathjs: string; data: number[][]; size: number[] } {
    return {
      mathjs: 'DenseMatrix',
      data: this._data,
      size: this._size,
    };
  }

  /**
   * Create a new matrix of the same type from nested array data.
   * Used internally by mathjs factories (e.g. transpose calls x.create(...)).
   */
  create(data: number[][], datatype?: string): MathJSDenseMatrix {
    const m = new MathJSDenseMatrix(data);
    m._datatype = datatype;
    return m;
  }

  /**
   * Same as create() but named createDenseMatrix for factories that call it
   * on the matrix instance (e.g. transpose).
   */
  createDenseMatrix(opts: {
    data: number[][];
    size: number[];
    datatype?: string;
  }): MathJSDenseMatrix {
    const m = new MathJSDenseMatrix(opts.data);
    m._size = opts.size;
    m._datatype = opts.datatype;
    return m;
  }

  /**
   * Map over all elements, producing a new matrix.
   */
  map(
    callback: (
      value: number,
      index: number[],
      matrix: MathJSDenseMatrix
    ) => number
  ): MathJSDenseMatrix {
    const result = this._data.map((row, i) =>
      row.map((val, j) => callback(val, [i, j], this))
    );
    return new MathJSDenseMatrix(result);
  }

  /**
   * Iterate over all elements.
   */
  forEach(
    callback: (
      value: number,
      index: number[],
      matrix: MathJSDenseMatrix
    ) => void
  ): void {
    this._data.forEach((row, i) => {
      row.forEach((val, j) => callback(val, [i, j], this));
    });
  }

  /**
   * Get element at [row, col].
   */
  get(index: number[]): number {
    if (this._size.length === 1) {
      return this._data[index[0]] as unknown as number;
    }
    return this._data[index[0]][index[1]];
  }

  /**
   * Set element at [row, col]. Mutates in place and returns this.
   */
  set(index: number[], value: number, _defaultValue?: number): MathJSDenseMatrix {
    if (this._size.length === 1) {
      (this._data as unknown as number[])[index[0]] = value;
    } else {
      this._data[index[0]][index[1]] = value;
    }
    return this;
  }

  /**
   * Basic subset access (simplified for common patterns).
   */
  subset(index: any, replacement?: any, defaultValue?: any): any {
    if (replacement === undefined) {
      return this.get(index);
    }
    return this.set(index, replacement, defaultValue);
  }

  /**
   * Deep clone.
   */
  clone(): MathJSDenseMatrix {
    const m = new MathJSDenseMatrix(this._data.map((row) => [...row]));
    m._datatype = this._datatype;
    return m;
  }

  /**
   * Resize the matrix to the given size. Mutates in place and returns this.
   * (mathjs factory code does `m.resize(size)` and continues using `m`)
   */
  resize(newSize: number[], defaultValue?: number): MathJSDenseMatrix {
    const fill = defaultValue ?? 0;

    if (newSize.length === 1) {
      // 1D resize
      const len = newSize[0];
      const flat: number[] = [];
      const oldData = this._data as unknown as number[];
      for (let i = 0; i < len; i++) {
        flat.push(i < (this._size[0] ?? 0) ? oldData[i] ?? fill : fill);
      }
      this._data = flat as unknown as number[][];
      this._size = [len];
      return this;
    }

    // 2D resize
    const [rows, cols] = newSize;
    const data: number[][] = [];
    const oldRows = this._size[0] ?? 0;
    const oldCols = this._size[1] ?? 0;
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        row.push(
          i < oldRows && j < oldCols && this._data[i]
            ? this._data[i][j] ?? fill
            : fill
        );
      }
      data.push(row);
    }
    this._data = data;
    this._size = [rows, cols];
    return this;
  }

  /**
   * Reshape the matrix.
   */
  reshape(newSize: number[]): MathJSDenseMatrix {
    const flat: number[] = [];
    for (const row of this._data) {
      for (const val of row) {
        flat.push(val);
      }
    }
    const [rows, cols] = newSize;
    const data: number[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        row.push(flat[i * cols + j] ?? 0);
      }
      data.push(row);
    }
    return new MathJSDenseMatrix({ data, size: [rows, cols] });
  }

  /**
   * Extract the k-th diagonal as a new column vector matrix.
   * k=0 is main diagonal, k>0 is above, k<0 is below.
   */
  diagonal(k: number = 0): MathJSDenseMatrix {
    const [rows, cols] = this._size;
    const kRow = k < 0 ? -k : 0;
    const kCol = k > 0 ? k : 0;
    const diagLen = Math.min(rows - kRow, cols - kCol);
    const values: number[] = [];
    for (let i = 0; i < diagLen; i++) {
      values.push(this._data[kRow + i][kCol + i]);
    }
    // Return as a 1D matrix (column vector)
    const m = new MathJSDenseMatrix();
    m._data = values as unknown as number[][];
    m._size = [diagLen];
    return m;
  }

  /**
   * Get the data type of elements (used by getMatrixDataType).
   */
  getDataType(): string {
    return this._datatype ?? 'number';
  }

  // ---------------------------------------------------------------------------
  // Native DenseMatrix interop
  // ---------------------------------------------------------------------------

  /** Convert to native Float64Array-backed DenseMatrix. */
  toNative(): DenseMatrix {
    return DenseMatrix.fromArray(this._data);
  }

  /** Create from native DenseMatrix. */
  static fromNative(dm: DenseMatrix): MathJSDenseMatrix {
    return new MathJSDenseMatrix(dm.toArray());
  }

  /**
   * Create a diagonal matrix. Used by identity(), diag(), and other factories.
   *
   * @param size - [rows, cols]
   * @param value - scalar value to place on the diagonal
   * @param k - diagonal offset (0 = main, >0 = above, <0 = below)
   * @param defaultValue - fill value for non-diagonal elements
   */
  static diagonal(
    size: number[],
    value: number | number[],
    k: number = 0,
    defaultValue: number = 0
  ): MathJSDenseMatrix {
    const [rows, cols] = size;
    const data: number[][] = Array.from({ length: rows }, () =>
      new Array(cols).fill(defaultValue)
    );
    // Determine diagonal length
    const kRow = k < 0 ? -k : 0;
    const kCol = k > 0 ? k : 0;
    const diagLen = Math.min(rows - kRow, cols - kCol);
    for (let i = 0; i < diagLen; i++) {
      const val = Array.isArray(value) ? value[i] : value;
      data[kRow + i][kCol + i] = val;
    }
    return new MathJSDenseMatrix({ data, size: [rows, cols] });
  }
}

// Duck-typing markers that mathjs uses to identify matrix types
Object.defineProperty(MathJSDenseMatrix.prototype, 'isDenseMatrix', {
  value: true,
  writable: false,
  enumerable: false,
});
Object.defineProperty(MathJSDenseMatrix.prototype, 'isMatrix', {
  value: true,
  writable: false,
  enumerable: false,
});
Object.defineProperty(MathJSDenseMatrix.prototype, 'type', {
  value: 'DenseMatrix',
  writable: true,
  configurable: true,
  enumerable: false,
});

// ---------------------------------------------------------------------------
// SparseMatrix stub — uses dense storage but presents sparse interface
// ---------------------------------------------------------------------------

/**
 * Minimal sparse matrix stub. Uses the same nested-array storage as
 * MathJSDenseMatrix but advertises 'sparse' storage. This lets factories
 * that branch on storage() work while we build a real sparse bridge.
 */
export class MathJSSparseMatrix extends MathJSDenseMatrix {
  override storage(): string {
    return 'sparse';
  }

  override create(data: number[][], datatype?: string): MathJSSparseMatrix {
    const m = new MathJSSparseMatrix(data);
    m._datatype = datatype;
    return m;
  }

  createSparseMatrix(opts: {
    values?: number[];
    index?: number[];
    ptr?: number[];
    data?: number[][];
    size: number[];
    datatype?: string;
  }): MathJSSparseMatrix {
    // Accept either CSC format or plain data
    if (opts.data) {
      const m = new MathJSSparseMatrix(opts.data);
      m._size = opts.size;
      m._datatype = opts.datatype;
      return m;
    }
    // For CSC format, convert to dense for now
    const [rows, cols] = opts.size;
    const data: number[][] = Array.from({ length: rows }, () =>
      new Array(cols).fill(0)
    );
    if (opts.values && opts.index && opts.ptr) {
      for (let j = 0; j < cols; j++) {
        for (let k = opts.ptr[j]; k < opts.ptr[j + 1]; k++) {
          data[opts.index[k]][j] = opts.values[k];
        }
      }
    }
    const m = new MathJSSparseMatrix(data);
    m._size = opts.size;
    m._datatype = opts.datatype;
    return m;
  }

  override clone(): MathJSSparseMatrix {
    const m = new MathJSSparseMatrix(this._data.map((row) => [...row]));
    m._datatype = this._datatype;
    return m;
  }
}

Object.defineProperty(MathJSSparseMatrix.prototype, 'isDenseMatrix', {
  value: false,
  writable: false,
  enumerable: false,
});
Object.defineProperty(MathJSSparseMatrix.prototype, 'isSparseMatrix', {
  value: true,
  writable: false,
  enumerable: false,
});
Object.defineProperty(MathJSSparseMatrix.prototype, 'type', {
  value: 'SparseMatrix',
  writable: false,
  enumerable: false,
});

// ---------------------------------------------------------------------------
// matrix() factory function — creates matrices from data
// ---------------------------------------------------------------------------

/**
 * Creates the `matrix` factory function that mathjs factories call as:
 *   matrix()           — empty dense matrix
 *   matrix(data)       — dense matrix from nested array
 *   matrix('sparse')   — empty sparse matrix (format-only arg)
 *   matrix('default')  — empty dense matrix (format-only arg)
 *   matrix(data, 'sparse') — sparse matrix from data
 */
export function createMatrixBridge() {
  return function matrix(
    data?: number[][] | MathJSDenseMatrix | string,
    storageType?: string
  ): MathJSDenseMatrix {
    // matrix('sparse') or matrix('dense') or matrix('default')
    if (typeof data === 'string') {
      const isSparse = data === 'sparse';
      return isSparse ? new MathJSSparseMatrix() : new MathJSDenseMatrix();
    }
    if (!data) {
      return storageType === 'sparse'
        ? new MathJSSparseMatrix()
        : new MathJSDenseMatrix();
    }
    if (data instanceof MathJSDenseMatrix) {
      if (storageType === 'sparse' && !(data instanceof MathJSSparseMatrix)) {
        return new MathJSSparseMatrix(data._data);
      }
      return data;
    }
    return storageType === 'sparse'
      ? new MathJSSparseMatrix(data)
      : new MathJSDenseMatrix(data);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Infer size from nested array. Handles 1D and 2D. */
function inferSize(data: any[]): number[] {
  if (data.length === 0) return [0];
  if (Array.isArray(data[0])) {
    return [data.length, (data[0] as any[]).length];
  }
  return [data.length];
}
