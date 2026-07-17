/**
 * Matrix Compatibility Bridge
 *
 * Wraps the native MathTS DenseMatrix (Float64Array-backed) with the interface
 * that the activated mathjs-derived factory functions expect:
 *   ._data, ._size, .storage(), .datatype(), .valueOf(), .size(),
 *   .get(), .set(), .map(), .forEach(), .clone(), .subset(), .create()
 *
 * This enables ~89 dormant factory functions to operate on matrices without
 * rewriting each one.
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { DenseMatrix, backendManager } from '@danielsimonjr/mathts-matrix';

// Pre-initialise the shared backend manager so the accelerated `multiply` /
// `transpose` instance methods can reach WASM/GPU once init resolves. Until
// then they route to the synchronous JS backend — correct, just not yet
// accelerated. Fire-and-forget: failures fall back to JS silently.
void backendManager.initialize().catch(() => {
  /* JS backend remains available */
});

/** The subset of the mathjs `Index` API the bridge matrices consume. */
interface MatrixIndexLike {
  isScalar(): boolean;
  size(): number[];
  dimension(dim: number): unknown;
}

/**
 * Resolve a mathjs `Index` object to the list of selected indices per dimension.
 * Each dimension selector is a scalar number → `[n]`, or a Range /
 * ImmutableDenseMatrix (has `.toArray()`) → its index list.
 */
function matrixIndexSelectors(index: MatrixIndexLike): number[][] {
  const nDims = index.size().length;
  const out: number[][] = [];
  for (let d = 0; d < nDims; d++) {
    const sel = index.dimension(d);
    if (typeof sel === 'number') {
      out.push([sel]);
    } else if (sel && typeof (sel as { toArray?: () => number[] }).toArray === 'function') {
      out.push((sel as { toArray(): number[] }).toArray());
    } else {
      out.push([Number(sel)]);
    }
  }
  return out;
}

/**
 * mathjs-compatible dense matrix adapter.
 *
 * Stores data as nested number[][] (what mathjs factories expect) while
 * providing conversion to/from the native Float64Array-backed DenseMatrix.
 */
/**
 * Adapt a callback so it is invoked with as many arguments as it can accept —
 * the mathjs callback contract. Typed functions (e.g. compiled expression
 * lambdas, signature 'any,any') reject surplus arguments, so probe the widest
 * arity they resolve; plain functions use their declared length (rest-args
 * closures, length 0, receive everything).
 */
function _adaptCallbackArity(
  callback: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  const t = mathTyped as unknown as {
    isTypedFunction(fn: unknown): boolean;
    resolve(fn: unknown, args: unknown[]): unknown;
  };
  if (t.isTypedFunction(callback)) {
    let arity: number | undefined;
    return (...args: unknown[]) => {
      if (arity === undefined) {
        for (let k = args.length; k >= 1; k--) {
          if (t.resolve(callback, args.slice(0, k))) {
            arity = k;
            break;
          }
        }
        if (arity === undefined) arity = args.length; // let typed report the real mismatch
      }
      return callback(...args.slice(0, arity));
    };
  }
  const declared = callback.length;
  if (declared >= 1 && declared < 3) {
    return (...args: unknown[]) => callback(...args.slice(0, declared));
  }
  return callback;
}

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
   * Row count — required by @danielsimonjr/mathts-core isMatrix duck-type check.
   */
  get rows(): number {
    return this._size[0] ?? 0;
  }

  /**
   * Column count — required by @danielsimonjr/mathts-core isMatrix duck-type check.
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

  toArray(): number[][] | number[] {
    // 1-D matrices (e.g. cbrt(x, true) returning the 3 cube roots) store a
    // flat _data array; spreading each element would throw "not iterable".
    if (this._size.length === 1) {
      return [...(this._data as unknown as number[])];
    }
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
   *
   * Callbacks are invoked ARITY-APPROPRIATELY (mathjs contract): a typed or
   * fixed-arity callback declared as `(value)` or `(value, index)` must not be
   * force-fed 3 arguments — a typed 2-arg expression lambda (`f(x, i) = …`)
   * previously threw "Too many arguments" out of the expression language.
   */
  map(
    callback: (value: number, index: number[], matrix: MathJSDenseMatrix) => number
  ): MathJSDenseMatrix {
    const cb = _adaptCallbackArity(callback as (...args: unknown[]) => unknown);
    if (this._size.length === 1) {
      const flat = (this._data as unknown as number[]).map(
        (val, i) => cb(val, [i], this) as number
      );
      // Keep the 1-D layout: constructing from the flat array would let
      // inferSize re-shape it as an n×1 column (nested rows), which breaks
      // toArray()/valueOf() for vectors.
      const m = new MathJSDenseMatrix({
        data: flat as unknown as number[][],
        size: [...this._size],
      });
      return m;
    }
    const result = this._data.map((row, i) => row.map((val, j) => cb(val, [i, j], this) as number));
    return new MathJSDenseMatrix(result);
  }

  /**
   * Iterate over all elements (callback invoked arity-appropriately; see map).
   */
  forEach(callback: (value: number, index: number[], matrix: MathJSDenseMatrix) => void): void {
    const cb = _adaptCallbackArity(callback as (...args: unknown[]) => unknown);
    if (this._size.length === 1) {
      (this._data as unknown as number[]).forEach((val, i) => cb(val, [i], this));
      return;
    }
    this._data.forEach((row, i) => {
      row.forEach((val, j) => cb(val, [i, j], this));
    });
  }

  /**
   * Get element at [row, col].
   *
   * Accepts BOTH index conventions in the monorepo: the mathjs factory form
   * `get([row, col])` (single array arg) and the `@danielsimonjr/mathts-core`
   * form `get(row, col)` (two scalar args) used by core's `Matrix~>Array`
   * typed-function conversion. Supporting only the array form silently broke
   * that conversion — e.g. `multiply(R, Q)` inside the `schur` factory, where
   * the two DenseMatrix operands have no direct `Matrix,Matrix` signature and
   * fall back to Array conversion (core calls `matrix.get(i, j)`).
   */
  get(indexOrRow: number[] | number, col?: number): number {
    const row = Array.isArray(indexOrRow) ? indexOrRow[0] : indexOrRow;
    if (this._size.length === 1) {
      return this._data[row] as unknown as number;
    }
    const j = Array.isArray(indexOrRow) ? indexOrRow[1] : (col as number);
    return this._data[row][j];
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
   * Subset access. Accepts either a plain coordinate `number[]` (internal
   * callers) or a mathjs `Index` object (what the factory `subset(value, index)`
   * passes — `value.subset(index)`). Index support was missing, so scalar
   * extraction like `subset(M, index(k, k))` — used throughout `sylvester` /
   * `lyap` — passed the whole Index object to `get`, reading `_data[Index]` =
   * undefined.
   */
  subset(
    index: number[] | MatrixIndexLike,
    replacement?: unknown,
    defaultValue?: number
  ): number | MathJSDenseMatrix {
    if (Array.isArray(index)) {
      return replacement === undefined
        ? this.get(index)
        : this.set(index, replacement as number, defaultValue);
    }
    const dims = matrixIndexSelectors(index);
    return replacement === undefined
      ? this._getSubset(index, dims)
      : this._setSubset(index, dims, replacement);
  }

  /** Read a scalar (Index.isScalar) or a sub-matrix from selected indices. */
  private _getSubset(index: MatrixIndexLike, dims: number[][]): number | MathJSDenseMatrix {
    if (index.isScalar()) {
      return dims.length === 1
        ? (this._data[dims[0][0]] as unknown as number)
        : this._data[dims[0][0]][dims[1][0]];
    }
    if (dims.length === 1) {
      const picked = dims[0].map((i) => (this._data as unknown as number[])[i]);
      const m = new MathJSDenseMatrix(picked as unknown as number[][]);
      m._size = [dims[0].length];
      return m;
    }
    const [rowSel, colSel] = dims;
    return new MathJSDenseMatrix(rowSel.map((i) => colSel.map((j) => this._data[i][j])));
  }

  /** Write a scalar or a sub-matrix at the selected indices; returns this. */
  private _setSubset(
    index: MatrixIndexLike,
    dims: number[][],
    replacement: unknown
  ): MathJSDenseMatrix {
    if (index.isScalar()) {
      if (dims.length === 1)
        (this._data as unknown as number[])[dims[0][0]] = replacement as number;
      else this._data[dims[0][0]][dims[1][0]] = replacement as number;
      return this;
    }
    const rep = (replacement as { toArray?: () => unknown }).toArray
      ? (replacement as { toArray(): unknown[] }).toArray()
      : (replacement as unknown[]);
    const [rowSel, colSel] = dims.length === 2 ? dims : [dims[0], [0]];
    for (let ri = 0; ri < rowSel.length; ri++) {
      for (let ci = 0; ci < colSel.length; ci++) {
        const row = rep[ri];
        const v = Array.isArray(row) ? row[ci] : row;
        this._data[rowSel[ri]][colSel[ci]] = v as number;
      }
    }
    return this;
  }

  /**
   * Deep clone.
   */
  clone(): MathJSDenseMatrix {
    const copy =
      this._size.length === 1
        ? [...(this._data as unknown as number[])]
        : this._data.map((row) => [...row]);
    const m = new MathJSDenseMatrix(copy as unknown as number[][]);
    m._size = [...this._size];
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
        flat.push(i < (this._size[0] ?? 0) ? (oldData[i] ?? fill) : fill);
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
        row.push(i < oldRows && j < oldCols && this._data[i] ? (this._data[i][j] ?? fill) : fill);
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
  // Accelerated operations — routed through the native matrix BackendManager
  // (JS / WASM / GPU selected by size). Additive: the activated factory
  // `multiply`/`transpose` functions are unaffected.
  // ---------------------------------------------------------------------------

  /**
   * Matrix product `this · other` via the native backend.
   */
  multiply(other: MathJSDenseMatrix): MathJSDenseMatrix {
    const result = backendManager.multiply(this.toNative(), other.toNative());
    return MathJSDenseMatrix.fromNative(result);
  }

  /**
   * Matrix transpose via the native backend.
   */
  transpose(): MathJSDenseMatrix {
    const result = backendManager.transpose(this.toNative());
    return MathJSDenseMatrix.fromNative(result);
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
   * Swap rows i and j (by reference) in a raw 2-D data array. Required by the
   * dense `lup` factory's partial-pivoting step (`DenseMatrix._swapRows(j, pi,
   * data)`); its absence made any LU decomposition that needed a pivot swap
   * throw `_swapRows is not a function`. Mirrors mathjs's static of the same
   * name and the sibling `MathJSSparseMatrix._swapRows`.
   */
  static _swapRows(i: number, j: number, data: unknown[][]): void {
    const vi = data[i];
    data[i] = data[j];
    data[j] = vi;
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
    const data: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(defaultValue));
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
// SparseMatrix — real CSC (Compressed Sparse Column) implementation
// ---------------------------------------------------------------------------

/**
 * mathjs-compatible sparse matrix using CSC format.
 *
 * Internal storage:
 *   _values: non-zero values (or null for pattern-only matrices)
 *   _index:  row indices for each non-zero
 *   _ptr:    column pointers (length = cols + 1)
 *   _size:   [rows, cols]
 *
 * This enables the algebra/sparse factories (csChol, csLu, slu, csPermute,
 * etc.) to operate directly on CSC data without conversion.
 */
export class MathJSSparseMatrix {
  _values: unknown[] | null;
  _index: number[];
  _ptr: number[];
  _size: number[];
  _datatype: string | undefined;

  constructor(
    data?:
      | unknown[][]
      | {
          values?: unknown[] | null;
          index?: number[];
          ptr?: number[];
          _values?: unknown[] | null;
          _index?: number[];
          _ptr?: number[];
          size?: number[];
          _size?: number[];
          data?: unknown[][];
          datatype?: string;
          _datatype?: string;
        }
  ) {
    if (!data) {
      // Empty matrix
      this._values = [];
      this._index = [];
      this._ptr = [0];
      this._size = [0, 0];
      return;
    }

    if (Array.isArray(data)) {
      // Dense array input — convert to CSC
      this._values = [];
      this._index = [];
      this._ptr = [];
      this._size = [];
      this._fromDenseArray(data as unknown[][]);
      return;
    }

    // Object input — CSC fields or dense data
    if (data.data) {
      // { data: number[][], size: [...] }
      this._values = [];
      this._index = [];
      this._ptr = [];
      this._size = [];
      this._fromDenseArray(data.data);
      this._datatype = data.datatype ?? data._datatype;
      return;
    }

    // CSC format: { values, index, ptr, size } or { _values, _index, _ptr, _size }
    const values = data.values !== undefined ? data.values : data._values;
    const index = data.index ?? data._index;
    const ptr = data.ptr ?? data._ptr;
    const size = data.size ?? data._size;

    // Store the CSC arrays BY REFERENCE (mathjs SparseMatrix semantics), not a
    // defensive copy. The CSparse algebra ports (csLu / csSqr / …) construct an
    // L/U SparseMatrix wrapping arrays they keep mutating and reading back
    // through the wrapper mid-build (csSpsolve reads `L._values`/`L._ptr`); a
    // copy freezes an empty snapshot, so those reads return `undefined`
    // (`divideScalar(x, undefined)`). Callers building a dense matrix go through
    // `_fromDenseArray` above, which allocates fresh arrays.
    this._values = values != null ? (values as unknown[]) : null;
    this._index = index ?? [];
    this._ptr = ptr ?? [0];
    this._size = size ?? [0, 0];
    this._datatype = data.datatype ?? data._datatype;
  }

  /**
   * Convert a dense 2D array to CSC format.
   */
  private _fromDenseArray(data: unknown[][]): void {
    const rows = data.length;
    const cols = rows > 0 && Array.isArray(data[0]) ? data[0].length : 0;
    this._values = [];
    this._index = [];
    this._ptr = [0];
    this._size = [rows, cols];

    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < rows; i++) {
        const v = data[i][j];
        if (v !== 0 && v != null) {
          this._values.push(v);
          this._index.push(i);
        }
      }
      this._ptr.push(this._values.length);
    }
  }

  // ---- Required duck-type properties for @danielsimonjr/mathts-core isMatrix check ----

  get rows(): number {
    return this._size[0] ?? 0;
  }

  get cols(): number {
    return this._size[1] ?? 0;
  }

  // ---- Interface methods used by mathjs factories ----

  storage(): string {
    return 'sparse';
  }

  datatype(): string | undefined {
    return this._datatype;
  }

  size(): number[] {
    return [...this._size];
  }

  /**
   * Get element at [row, col]. Returns 0 for structural zeros.
   */
  get(index: number[]): unknown {
    const [i, j] = index;
    if (j < 0 || j >= this._size[1] || i < 0 || i >= this._size[0]) {
      throw new RangeError(`Index out of range (${i}, ${j}) for matrix of size [${this._size}]`);
    }
    for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
      if (this._index[k] === i) {
        return this._values ? this._values[k] : 1; // pattern matrix returns 1
      }
    }
    return 0;
  }

  /**
   * Set element at [row, col]. Inserts, updates, or removes entries as needed.
   * Returns this for chaining (mathjs convention).
   */
  set(index: number[], value: unknown, _defaultValue?: unknown): MathJSSparseMatrix {
    const [i, j] = index;

    // Expand matrix dimensions if needed
    if (i >= this._size[0]) this._size[0] = i + 1;
    if (j >= this._size[1]) {
      // Extend _ptr for new columns
      while (this._ptr.length <= j + 1) {
        this._ptr.push(this._ptr[this._ptr.length - 1]);
      }
      this._size[1] = j + 1;
    }

    const start = this._ptr[j];
    const end = this._ptr[j + 1];

    // Find insertion point (keep row indices sorted within each column)
    let pos = start;
    while (pos < end && this._index[pos] < i) {
      pos++;
    }

    if (pos < end && this._index[pos] === i) {
      // Entry exists at this position
      if (value === 0) {
        // Remove the entry
        this._index.splice(pos, 1);
        if (this._values) this._values.splice(pos, 1);
        // Decrement all subsequent column pointers
        for (let c = j + 1; c < this._ptr.length; c++) {
          this._ptr[c]--;
        }
      } else {
        // Update value
        if (this._values) this._values[pos] = value;
      }
    } else if (value !== 0) {
      // Insert new entry
      this._index.splice(pos, 0, i);
      if (this._values) this._values.splice(pos, 0, value);
      // Increment all subsequent column pointers
      for (let c = j + 1; c < this._ptr.length; c++) {
        this._ptr[c]++;
      }
    }

    return this;
  }

  /**
   * Convert to dense nested array.
   */
  valueOf(): unknown[][] {
    const [rows, cols] = this._size;
    const result: unknown[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (let j = 0; j < cols; j++) {
      for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
        result[this._index[k]][j] = this._values ? this._values[k] : 1;
      }
    }
    return result;
  }

  toArray(): unknown[][] {
    return this.valueOf();
  }

  /**
   * Deep clone.
   */
  clone(): MathJSSparseMatrix {
    const m = new MathJSSparseMatrix({
      values: this._values ? [...this._values] : null,
      index: [...this._index],
      ptr: [...this._ptr],
      size: [...this._size],
    });
    m._datatype = this._datatype;
    return m;
  }

  /**
   * Create a new matrix of the same type from nested array data.
   * Used internally by mathjs factories (e.g., transpose calls x.create(...)).
   */
  create(data: unknown[][], datatype?: string): MathJSSparseMatrix {
    const m = new MathJSSparseMatrix(data);
    m._datatype = datatype;
    return m;
  }

  /**
   * Instance-level createSparseMatrix — used by csPermute and other sparse
   * algebra factories that call a.createSparseMatrix({...}).
   */
  createSparseMatrix(opts: {
    values?: unknown[] | null;
    index?: number[];
    ptr?: number[];
    size: number[];
    datatype?: string;
  }): MathJSSparseMatrix {
    return new MathJSSparseMatrix(opts);
  }

  /**
   * Map over non-zero elements, producing a new sparse matrix.
   * Callback signature: (value, index, matrix) => newValue
   */
  map(
    callback: (value: unknown, index: number[], matrix: MathJSSparseMatrix) => unknown
  ): MathJSSparseMatrix {
    const [rows, cols] = this._size;
    const newValues: unknown[] = [];
    const newIndex: number[] = [];
    const newPtr: number[] = [0];

    for (let j = 0; j < cols; j++) {
      for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
        const i = this._index[k];
        const v = this._values ? this._values[k] : 1;
        const result = callback(v, [i, j], this);
        if (result !== 0) {
          newValues.push(result);
          newIndex.push(i);
        }
      }
      newPtr.push(newValues.length);
    }

    // Also call callback for zero entries if the caller expects full iteration
    // (mathjs map iterates all entries for sparse matrices in some contexts)
    // For now, only iterate non-zeros — this matches the common sparse usage.

    const m = new MathJSSparseMatrix({
      values: newValues,
      index: newIndex,
      ptr: newPtr,
      size: [rows, cols],
    });
    m._datatype = this._datatype;
    return m;
  }

  /**
   * Iterate over non-zero elements.
   * Callback signature: (value, index, matrix) => void
   */
  forEach(callback: (value: unknown, index: number[], matrix: MathJSSparseMatrix) => void): void {
    const cols = this._size[1];
    for (let j = 0; j < cols; j++) {
      for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
        const i = this._index[k];
        const v = this._values ? this._values[k] : 1;
        callback(v, [i, j], this);
      }
    }
  }

  /**
   * Resize the matrix. Truncates or extends as needed.
   */
  resize(newSize: number[], _defaultValue?: unknown): MathJSSparseMatrix {
    const [newRows, newCols] = newSize;
    const oldCols = this._size[1];

    // Truncate columns if shrinking
    if (newCols < oldCols) {
      const nnzKeep = this._ptr[newCols];
      this._values = this._values ? this._values.slice(0, nnzKeep) : null;
      this._index = this._index.slice(0, nnzKeep);
      this._ptr = this._ptr.slice(0, newCols + 1);
    } else if (newCols > oldCols) {
      // Extend columns
      const lastNnz = this._ptr[this._ptr.length - 1];
      while (this._ptr.length <= newCols) {
        this._ptr.push(lastNnz);
      }
    }

    // Truncate rows if shrinking
    if (newRows < this._size[0]) {
      // Remove entries with row index >= newRows
      const vals: unknown[] = [];
      const idx: number[] = [];
      const ptr: number[] = [0];
      const cols = Math.min(newCols, this._ptr.length - 1);
      for (let j = 0; j < cols; j++) {
        for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
          if (this._index[k] < newRows) {
            if (this._values) vals.push(this._values[k]);
            idx.push(this._index[k]);
          }
        }
        ptr.push(idx.length);
      }
      this._values = this._values ? vals : null;
      this._index = idx;
      this._ptr = ptr;
    }

    this._size = [newRows, newCols];
    return this;
  }

  toJSON(): {
    mathjs: string;
    values: unknown[] | null;
    index: number[];
    ptr: number[];
    size: number[];
  } {
    return {
      mathjs: 'SparseMatrix',
      values: this._values,
      index: this._index,
      ptr: this._ptr,
      size: this._size,
    };
  }

  toString(): string {
    const lines: string[] = [];
    const cols = this._size[1];
    for (let j = 0; j < cols; j++) {
      for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
        const v = this._values ? this._values[k] : 1;
        lines.push(`    (${this._index[k]}, ${j}) ==> ${v}`);
      }
    }
    return (
      `Sparse Matrix [${this._size[0]} x ${this._size[1]}] (${this._index.length} non-zero)\n` +
      lines.join('\n')
    );
  }

  /**
   * Static diagonal constructor — creates a sparse diagonal matrix.
   */
  static diagonal(
    size: number[],
    value: unknown | unknown[],
    k: number = 0,
    defaultValue: number = 0,
    _datatype?: string
  ): MathJSSparseMatrix {
    const [rows, cols] = size;
    const kRow = k < 0 ? -k : 0;
    const kCol = k > 0 ? k : 0;
    const diagLen = Math.min(rows - kRow, cols - kCol);
    const values: unknown[] = [];
    const index: number[] = [];
    const ptr: number[] = [0];

    for (let j = 0; j < cols; j++) {
      const diagIdx = j - kCol;
      if (diagIdx >= 0 && diagIdx < diagLen) {
        const v = Array.isArray(value) ? value[diagIdx] : value;
        if (v !== 0 && v !== defaultValue) {
          values.push(v);
          index.push(kRow + diagIdx);
        }
      }
      ptr.push(values.length);
    }

    return new MathJSSparseMatrix({
      values,
      index,
      ptr,
      size: [rows, cols],
    });
  }

  // ---- Static methods required by algebra/decomposition factories ----

  /**
   * Swap rows j and pi in CSC arrays. Used by LUP decomposition.
   */
  static _swapRows(
    j: number,
    pi: number,
    n: number,
    values: unknown[],
    index: number[],
    ptr: number[]
  ): void {
    // Iterate over all columns
    for (let c = 0; c < n; c++) {
      let jPos = -1;
      let piPos = -1;
      // Find positions of rows j and pi in this column
      for (let k = ptr[c]; k < ptr[c + 1]; k++) {
        if (index[k] === j) jPos = k;
        if (index[k] === pi) piPos = k;
      }
      if (jPos !== -1 && piPos !== -1) {
        // Both rows have entries — swap values
        if (values) {
          const tmp = values[jPos];
          values[jPos] = values[piPos];
          values[piPos] = tmp;
        }
        // Row indices stay the same since both exist
      } else if (jPos !== -1) {
        const vj = values ? values[jPos] : undefined;
        // Remove old entry first
        index.splice(jPos, 1);
        if (values) values.splice(jPos, 1);
        // Insert at sorted position for row pi
        let insertPos = ptr[c];
        const endPos = ptr[c + 1] - 1; // adjusted after removal
        while (insertPos <= endPos && index[insertPos] < pi) insertPos++;
        index.splice(insertPos, 0, pi);
        if (values) values.splice(insertPos, 0, vj!);
      } else if (piPos !== -1) {
        const vpi = values ? values[piPos] : undefined;
        index.splice(piPos, 1);
        if (values) values.splice(piPos, 1);
        let insertPos = ptr[c];
        const endPos = ptr[c + 1] - 1;
        while (insertPos <= endPos && index[insertPos] < j) insertPos++;
        index.splice(insertPos, 0, j);
        if (values) values.splice(insertPos, 0, vpi!);
      }
      // Neither row has entry — nothing to do
    }
  }

  /**
   * Iterate over entries in row j across all columns. Used by LUP decomposition.
   */
  static _forEachRow(
    j: number,
    values: unknown[],
    index: number[],
    ptr: number[],
    callback: (col: number, value: unknown) => void
  ): void {
    const n = ptr.length - 1; // number of columns
    for (let c = 0; c < n; c++) {
      for (let k = ptr[c]; k < ptr[c + 1]; k++) {
        if (index[k] === j) {
          callback(c, values ? values[k] : 1);
        }
      }
    }
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
Object.defineProperty(MathJSSparseMatrix.prototype, 'isMatrix', {
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
    data?: unknown[][] | MathJSDenseMatrix | MathJSSparseMatrix | string,
    storageType?: string
  ): MathJSDenseMatrix | MathJSSparseMatrix {
    // matrix('sparse') or matrix('dense') or matrix('default')
    if (typeof data === 'string') {
      const isSparse = data === 'sparse';
      return isSparse ? new MathJSSparseMatrix() : new MathJSDenseMatrix();
    }
    if (!data) {
      return storageType === 'sparse' ? new MathJSSparseMatrix() : new MathJSDenseMatrix();
    }
    if (data instanceof MathJSSparseMatrix) {
      return data;
    }
    if (data instanceof MathJSDenseMatrix) {
      if (storageType === 'sparse') {
        return new MathJSSparseMatrix(data._data);
      }
      return data;
    }
    return storageType === 'sparse'
      ? new MathJSSparseMatrix(data)
      : new MathJSDenseMatrix(data as number[][]);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Infer size from nested array. Handles 1D and 2D. */
function inferSize(data: unknown[]): number[] {
  if (data.length === 0) return [0];
  if (Array.isArray(data[0])) {
    return [data.length, (data[0] as unknown[]).length];
  }
  return [data.length];
}
