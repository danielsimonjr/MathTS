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
import { formatGeneric, getArrayDataType } from '@danielsimonjr/mathts-core/internal';
import { typeOf } from '../utils/is.js';
import {
  arraySize,
  validate,
  validateIndex,
  resize as resizeArray,
  reshape as reshapeArray,
  processSizesWildcard,
  unsqueeze,
  broadcastTo,
} from '../utils/array.js';
import { DimensionError } from '../error/DimensionError.js';
import { assertAllocSize } from '../utils/limits.js';
import { DenseMatrix, backendManager } from '@danielsimonjr/mathts-matrix';

// Do not call `backendManager.initialize()` at import time. That compiles and
// instantiates the AssemblyScript module on every process that loads the
// factory graph, including each `bun test --isolate` worker. On Bun 1.4.2 the
// instantiate callback races the test runner (`JSWebAssemblyInstance::finalizeCreation`
// null unwrap, SIGSEGV, reported as exit 137) while peak RSS stays ~0.37 GB.
// `multiply` / `transpose` stay on the synchronous JS backend until a caller
// initializes the manager explicitly.

/** The subset of the mathjs `Index` API the bridge matrices consume. */
interface MatrixIndexLike {
  isScalar(): boolean;
  size(): number[];
  dimension(dim: number): unknown;
}

/** The indices that one dimension of a mathjs `Index` selects. */
interface IndexSelector {
  /** The selected indices, in order. */
  sel: number[];
  /** True when the Index gave this dimension as a number: the result has no axis for it. */
  scalar: boolean;
}

/**
 * Resolve a mathjs `Index` object to the list of selected indices per dimension.
 * Each dimension selector is a scalar number → `[n]` (marked `scalar`), or a Range /
 * ImmutableDenseMatrix (has `.toArray()`) → its index list.
 */
function matrixIndexSelectors(index: MatrixIndexLike): IndexSelector[] {
  const nDims = index.size().length;
  const out: IndexSelector[] = [];
  for (let d = 0; d < nDims; d++) {
    const sel = index.dimension(d);
    if (typeof sel === 'number') {
      out.push({ sel: [sel], scalar: true });
    } else if (sel && typeof (sel as { toArray?: () => number[] }).toArray === 'function') {
      out.push({ sel: (sel as { toArray(): number[] }).toArray(), scalar: false });
    } else {
      out.push({ sel: [Number(sel)], scalar: true });
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

/**
 * The diagonal index `k` as an integer number, as in mathjs. A BigNumber becomes a number.
 * @throws TypeError when `k` is not an integer
 */
function diagonalIndex(k: unknown): number {
  const n = typeof k === 'number' ? k : Number((k as { valueOf(): unknown }).valueOf());
  if (!Number.isInteger(n)) throw new TypeError('The parameter k must be an integer number');
  return n;
}

/**
 * Dense matrix of numbers with the mathjs `DenseMatrix` interface that the activated
 * factory functions expect.
 *
 * The matrix keeps its data as a nested array in `_data`. Use `toNative` and `fromNative`
 * to convert to and from the MathTS `DenseMatrix`.
 */
export class MathJSDenseMatrix {
  _data: number[][];
  _size: number[];
  _datatype: string | undefined;

  constructor(data?: number[][] | { data: number[][]; size: number[] }) {
    if (!data) {
      // An empty dense matrix has one axis of length 0, as in mathjs.
      this._data = [];
      this._size = [0];
    } else if (Array.isArray(data)) {
      // Untrusted nested data: every row must match the size of the first one (mathjs `validate`).
      // A producer that knows the size passes `{ data, size }`, which is not validated or copied.
      // As in mathjs, the matrix holds a copy, so a write to the matrix does not change `data`.
      this._size = inferSize(data);
      validate(data, this._size);
      this._data = copyAxes(data, this._size.length) as number[][];
    } else if (
      typeof data !== 'object' ||
      !Array.isArray((data as { data?: unknown }).data) ||
      !Array.isArray((data as { size?: unknown }).size)
    ) {
      // A scalar or a storage object without Array data and size is not matrix data.
      throw new TypeError('Unsupported type of data (' + typeName(data) + ')');
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
    // A copy of every axis: a 1-D matrix (e.g. cbrt(x, true) returning the 3 cube roots)
    // stores a flat _data array, and a 3-D matrix has one more level than its rows.
    return copyAxes(this._data, this._size.length) as number[][] | number[];
  }

  toJSON(): { mathjs: string; data: number[][]; size: number[] } {
    return {
      mathjs: 'DenseMatrix',
      data: this._data,
      size: this._size,
    };
  }

  toString(): string {
    return formatGeneric(this._data);
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
    const m = new MathJSDenseMatrix({ data: opts.data, size: opts.size });
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
    // The result keeps the size of this matrix, as in mathjs. Inferring the size from the
    // result would add an axis when the callback returns an array, and would re-shape a
    // vector of arrays as a matrix.
    return new MathJSDenseMatrix({
      data: walkAxes(this._data, this._size.length, [], (val, index) =>
        cb(val, index, this)
      ) as number[][],
      size: [...this._size],
    });
  }

  /**
   * Iterate over all elements (callback invoked arity-appropriately; see map).
   */
  forEach(callback: (value: number, index: number[], matrix: MathJSDenseMatrix) => void): void {
    const cb = _adaptCallbackArity(callback as (...args: unknown[]) => unknown);
    eachAxes(this._data, this._size.length, [], (val, index) => cb(val, index, this));
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
    // As the mathjs `get`: one index per axis, each an integer inside its axis.
    const index = Array.isArray(indexOrRow)
      ? indexOrRow
      : col === undefined
        ? [indexOrRow]
        : [indexOrRow, col];
    if (index.length !== this._size.length) {
      throw new DimensionError(index.length, this._size.length);
    }
    for (let k = 0; k < index.length; k++) validateIndex(index[k], this._size[k]);
    if (Array.isArray(indexOrRow) && this._size.length > 2) {
      // One index per axis.
      let level: unknown = this._data;
      for (const i of indexOrRow) level = (level as unknown[])[i];
      return level as number;
    }
    const row = Array.isArray(indexOrRow) ? indexOrRow[0] : indexOrRow;
    if (this._size.length === 1) {
      return this._data[row] as unknown as number;
    }
    const j = Array.isArray(indexOrRow) ? indexOrRow[1] : (col as number);
    return this._data[row][j];
  }

  /**
   * Set the entry at `index` (one index per axis) in place and return this, as the mathjs
   * `DenseMatrix.set`. An index at or after the end of its axis grows the matrix; each new entry
   * gets `defaultValue` (0 when it is not given).
   * @throws DimensionError when `index` has fewer entries than the matrix has axes
   * @throws TypeError or IndexError when an index is not a non-negative integer
   */
  set(index: number[], value: number, defaultValue?: number): MathJSDenseMatrix {
    if (!Array.isArray(index)) throw new TypeError('Array expected');
    if (index.length < this._size.length) {
      throw new DimensionError(index.length, this._size.length, '<');
    }
    let grow = index.length > this._size.length;
    for (let k = 0; k < index.length; k++) {
      validateIndex(index[k]);
      if (index[k] >= this._size[k]) grow = true;
    }
    if (grow) {
      this._fit(
        index.map((i) => i + 1),
        defaultValue
      );
    }
    if (this._size.length === 1) {
      (this._data as unknown as number[])[index[0]] = value;
    } else if (this._size.length === 2) {
      this._data[index[0]][index[1]] = value;
    } else {
      // One index per axis.
      let level: unknown[] = this._data;
      for (let k = 0; k < index.length - 1; k++) level = level[index[k]] as unknown[];
      level[index[index.length - 1]] = value;
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
      : this._setSubset(index, dims, replacement, defaultValue);
  }

  /**
   * Read a scalar (Index.isScalar) or a sub-matrix from selected indices, one selector per axis.
   * A dimension that the Index gives as a number adds no axis to the result, as in mathjs.
   */
  private _getSubset(index: MatrixIndexLike, dims: IndexSelector[]): number | MathJSDenseMatrix {
    if (dims.length !== this._size.length) {
      throw new DimensionError(dims.length, this._size.length);
    }
    // As the mathjs `_get`: check the smallest and then the largest index of each axis, so an
    // error names the same index as mathjs.
    for (let d = 0; d < dims.length; d++) {
      const { sel } = dims[d];
      if (sel.length === 0) continue;
      let min = sel[0];
      let max = sel[0];
      for (const i of sel) {
        validateIndex(i);
        if (i < min) min = i;
        if (i > max) max = i;
      }
      validateIndex(min, this._size[d]);
      validateIndex(max, this._size[d]);
    }
    if (index.isScalar()) return this.get(dims.map((d) => d.sel[0]));
    const last = dims.length - 1;
    const read = (data: unknown, depth: number): unknown => {
      const { sel, scalar } = dims[depth];
      const pick = (i: number): unknown =>
        depth === last ? (data as unknown[])[i] : read((data as unknown[])[i], depth + 1);
      return scalar ? pick(sel[0]) : sel.map(pick);
    };
    const result = new MathJSDenseMatrix({
      data: read(this._data, 0) as number[][],
      size: dims.filter((d) => !d.scalar).map((d) => d.sel.length),
    });
    result._datatype = this._datatype;
    return result;
  }

  /**
   * Write a scalar or a sub-matrix at the selected indices; returns this.
   * The replacement is one value, or an Array / matrix that gets the size of the selection by
   * the rule of the mathjs `_set`: it broadcasts to the selection, or it has fewer axes and
   * gets axes of length 1. One selected entry takes one value only.
   * @throws TypeError when the index selects one entry and the replacement is an Array or matrix
   * @throws DimensionError when the replacement does not get the size of the selection
   */
  private _setSubset(
    index: MatrixIndexLike,
    dims: IndexSelector[],
    replacement: unknown,
    defaultValue?: number
  ): MathJSDenseMatrix {
    if (dims.length < this._size.length) {
      throw new DimensionError(dims.length, this._size.length, '<');
    }
    let rep: unknown = (replacement as { toArray?: () => unknown } | null)?.toArray
      ? (replacement as { toArray(): unknown }).toArray()
      : replacement;
    if (index.isScalar()) {
      // One entry: the replacement is one value, never an Array or a matrix.
      if (Array.isArray(rep)) throw new TypeError('Scalar expected');
      return this.set(
        dims.map((d) => d.sel[0]),
        rep as number,
        defaultValue
      );
    }
    const selection = dims.map((d) => d.sel.length);
    const sameSize = (size: number[]): boolean =>
      size.length === selection.length && size.every((n, k) => n === selection[k]);
    if (Array.isArray(rep)) {
      // The rule of the mathjs `_set`. Step 1: broadcast the replacement to the selection (a
      // failure is not an error yet). Step 2: when the replacement has fewer axes, add axes of
      // length 1: one outer axis for each leading axis of length 1 that only the selection has,
      // and the others as inner axes. Step 3: compare the sizes.
      let repSize = arraySize(rep as unknown[]);
      if (!sameSize(repSize)) {
        try {
          rep = broadcastTo(rep, selection);
          repSize = arraySize(rep as unknown[]);
        } catch {
          // The size check below reports the mismatch.
        }
      }
      if (repSize.length < selection.length) {
        let k = 0;
        while (selection[k] === 1 && repSize[k] === 1) k++;
        let outer = 0;
        for (; selection[k] === 1; k++) outer++;
        rep = unsqueeze(rep as unknown[], selection.length, outer, repSize);
        repSize = arraySize(rep as unknown[]);
      }
      if (!sameSize(repSize)) throw new DimensionError(selection, repSize, '>');
    }
    // Grow the matrix when a selected index is at or after the end of its axis (mathjs `_fit`).
    const fit = dims.map(({ sel }) => {
      let max = -1;
      for (const i of sel) {
        validateIndex(i);
        if (i > max) max = i;
      }
      return max + 1;
    });
    this._fit(fit, defaultValue);
    // Write one axis at a time. An Array replacement has the size of the selection here; any
    // other replacement is one value for every selected entry.
    const nested = Array.isArray(rep);
    const last = dims.length - 1;
    const write = (target: unknown[], source: unknown, depth: number): void => {
      const { sel } = dims[depth];
      for (let i = 0; i < sel.length; i++) {
        const value = nested ? (source as unknown[])[i] : source;
        if (depth === last) target[sel[i]] = value;
        else write(target[sel[i]] as unknown[], value, depth + 1);
      }
    };
    write(this._data, rep, 0);
    return this;
  }

  /**
   * Grow the matrix in place to at least `size` (mathjs `_fit`): add axes, and lengthen each axis
   * that is shorter than `size`. A new entry gets `defaultValue` (0 when it is not given).
   * Nothing changes when the matrix is large enough.
   */
  private _fit(size: number[], defaultValue?: number): void {
    const newSize = [...this._size];
    let changed = false;
    while (newSize.length < size.length) {
      newSize.push(0);
      changed = true;
    }
    for (let k = 0; k < size.length; k++) {
      if (size[k] > newSize[k]) {
        newSize[k] = size[k];
        changed = true;
      }
    }
    if (changed) this.resize(newSize, defaultValue);
  }

  /**
   * Deep clone.
   */
  clone(): MathJSDenseMatrix {
    const m = new MathJSDenseMatrix({
      data: copyAxes(this._data, this._size.length) as number[][],
      size: [...this._size],
    });
    m._datatype = this._datatype;
    return m;
  }

  /**
   * Resize the matrix to the given size, keeping every axis (mathjs `DenseMatrix.resize`).
   * A new entry gets `defaultValue` (0 when it is not given). With `copy` the matrix is not
   * changed and the result is a new matrix; without `copy` the matrix is changed and returned
   * (mathjs factory code does `m.resize(size)` and continues using `m`). The size is an Array or
   * a matrix. An empty size gives the first entry of the matrix (not a matrix), as in mathjs.
   */
  resize(sizeArg: [], defaultValue?: number, copy?: boolean): number;
  resize(
    sizeArg: number[] | { valueOf(): unknown },
    defaultValue?: number,
    copy?: boolean
  ): MathJSDenseMatrix;
  resize(
    sizeArg: number[] | { valueOf(): unknown },
    defaultValue?: number,
    copy?: boolean
  ): MathJSDenseMatrix | number {
    const newSize = sizeList(sizeArg);
    if (newSize.length === 0) {
      // An empty size gives the first entry, as in mathjs.
      let v: unknown = this._data;
      while (Array.isArray(v)) v = v[0];
      return v as number;
    }
    assertAllocSize('resize', newSize);
    // Resize a copy of the nested data: the arrays of this matrix, and the arrays that the
    // caller passed to `matrix(data)`, are never changed in place.
    const data = resizeArray(
      copyAxes(this._data, this._size.length) as number[][],
      newSize,
      defaultValue ?? 0
    ) as number[][];
    if (copy) {
      const m = new MathJSDenseMatrix({ data, size: [...newSize] });
      m._datatype = this._datatype;
      return m;
    }
    this._data = data;
    this._size = [...newSize];
    return this;
  }

  /**
   * Reshape the matrix to the given size, which can hold one -1 for a length that follows from
   * the others (mathjs `DenseMatrix.reshape`). Without `copy` this matrix is changed and
   * returned; with `copy` the result is a new matrix and this matrix is not changed.
   * @throws DimensionError when the new size has another number of entries
   */
  reshape(newSize: number[], copy?: boolean): MathJSDenseMatrix {
    const count = this._size.reduce((p, n) => p * n, 1);
    const size = processSizesWildcard(newSize, count);
    const data = reshapeArray(this._data as number[][], newSize) as number[][];
    const m = copy ? this.clone() : this;
    m._data = data;
    m._size = size;
    return m;
  }

  /**
   * Extract the k-th diagonal as a new column vector matrix.
   * k=0 is main diagonal, k>0 is above, k<0 is below.
   */
  diagonal(kArg: number = 0): MathJSDenseMatrix {
    const k = diagonalIndex(kArg);
    const [rows, cols] = this._size;
    const kRow = k < 0 ? -k : 0;
    const kCol = k > 0 ? k : 0;
    const diagLen = Math.max(0, Math.min(rows - kRow, cols - kCol));
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
    // Like mathjs, the type comes from the elements: 'Complex' for a matrix of Complex values,
    // 'mixed' for more than one type. A declared `_datatype` wins.
    return this._datatype ?? (getArrayDataType(this._data, typeOf) as string);
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
    return new MathJSDenseMatrix({ data: dm.toArray(), size: [dm.rows, dm.cols] });
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
    // A matrix of diagonal values gives its entries, as in mathjs.
    if (isBridgeMatrix(value)) value = value.valueOf() as unknown as number[];
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
 * True when a map result is a zero that a sparse matrix does not store.
 * Follows mathjs `equalScalar(value, 0)` for number, boolean, bigint, string, BigNumber, Complex
 * and Fraction values, with an exact zero test (mathjs also drops values below absTol).
 */
function isZeroScalar(value: unknown): boolean {
  if (typeof value === 'number') return value === 0;
  if (typeof value === 'boolean') return value === false;
  if (typeof value === 'bigint') return value === 0n;
  if (typeof value === 'string') return Number(value) === 0;
  if (value !== null && typeof value === 'object') {
    const v = value as { isZero?: () => boolean; n?: unknown; d?: unknown };
    if (typeof v.isZero === 'function') return v.isZero();
    if ('n' in v && 'd' in v) return Number(v.n) === 0;
  }
  return false;
}

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
    // A string is a datatype in mathjs (`sparse('number')`): it builds the empty matrix
    if (data === undefined || data === null || typeof (data as unknown) === 'string') {
      // Empty matrix
      this._values = [];
      this._index = [];
      this._ptr = [0];
      this._size = [0, 0];
      return;
    }

    // A dense matrix is built from its nested data, as an Array is. A non-object input has no axis.
    if (typeof data !== 'object') {
      throw new RangeError('Matrix must be two dimensional (size: [])');
    }
    if (data instanceof MathJSSparseMatrix) {
      // A sparse matrix is copied: its `size` is a method, not a field
      this._values = data._values ? [...data._values] : null;
      this._index = [...data._index];
      this._ptr = [...data._ptr];
      this._size = [...data._size];
      this._datatype = data._datatype;
      return;
    }
    if (data instanceof MathJSDenseMatrix) {
      this._values = [];
      this._index = [];
      this._ptr = [];
      this._size = [];
      this._fromDenseArray(data._data);
      this._datatype = data._datatype;
      return;
    }
    if ('_data' in data) {
      // A plain object that copies the dense fields is not a matrix, as in mathjs
      throw new TypeError('Unsupported type of data (Object)');
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
   * Convert a dense 2D array to CSC format. A 1-D array becomes a column vector
   * of size [n, 1], as in mathjs. A ragged array has as many columns as its longest
   * row, and a short row is read as zero after its last entry.
   */
  private _fromDenseArray(input: unknown[][] | unknown[]): void {
    // A sparse matrix has two axes. A value that is not an Array has no axis.
    if (!Array.isArray(input)) {
      throw new RangeError('Matrix must be two dimensional (size: [])');
    }
    // A 1-D array is a column, so only 3 or more axes are refused.
    const inputSize = arraySize(input);
    if (inputSize.length > 2) {
      throw new RangeError('Matrix must be two dimensional (size: ' + formatSize(inputSize) + ')');
    }
    // As in mathjs, the column count is the length of the longest row, a value that is not an
    // Array is a row of one entry, and a short row is read as zero after its last entry.
    const rows = input.length;
    let cols = 0;
    for (let i = 0; i < rows; i++) {
      const row = input[i];
      const length = Array.isArray(row) ? row.length : 1;
      if (length > cols) cols = length;
    }
    // Fill fresh local arrays, then store them, so the loop does not read fields
    const values: unknown[] = [];
    const index: number[] = [];
    const ptr: number[] = [0];
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < rows; i++) {
        const row = input[i];
        const v = Array.isArray(row) ? row[j] : j === 0 ? row : undefined;
        // A number is the common case; only a non-number entry can be a deeper level
        if (typeof v !== 'number' && Array.isArray(v)) {
          // A deeper level below the first element: the input has 3 or more axes
          throw new RangeError(
            'Matrix must be two dimensional (size: ' +
              formatSize([rows, cols, ...arraySize(v)]) +
              ')'
          );
        }
        if (v !== 0 && v != null) {
          values.push(v);
          index.push(i);
        }
      }
      ptr.push(values.length);
    }
    this._values = values;
    this._index = index;
    this._ptr = ptr;
    this._size = [rows, cols];
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

  /**
   * The k-th diagonal as a sparse column of size [n, 1], as in mathjs. k=0 is the main diagonal.
   * k>0 is above the main diagonal. k<0 is below the main diagonal. The column holds the stored entries of
   * the diagonal; a pattern matrix gives a pattern column.
   */
  diagonal(kArg: number = 0): MathJSSparseMatrix {
    const k = diagonalIndex(kArg);
    const [rows, cols] = this._size;
    const kRow = k < 0 ? -k : 0;
    const kCol = k > 0 ? k : 0;
    const n = Math.max(0, Math.min(rows - kRow, cols - kCol));
    const values: unknown[] = [];
    const index: number[] = [];
    for (let t = 0; t < n; t++) {
      const c = kCol + t;
      for (let p = this._ptr[c]; p < this._ptr[c + 1]; p++) {
        if (this._index[p] === kRow + t) {
          if (this._values !== null) values.push(this._values[p]);
          index.push(t);
          break;
        }
      }
    }
    return new MathJSSparseMatrix({
      values: this._values === null ? null : values,
      index,
      ptr: [0, index.length],
      size: [n, 1],
      datatype: this._datatype,
    });
  }

  /** Share of stored entries: stored count divided by rows times columns (0 for an empty matrix). */
  density(): number {
    const cells = this._size[0] * this._size[1];
    return cells === 0 ? 0 : this._ptr[this._ptr.length - 1] / cells;
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
  get(indexOrRow: number[] | number, col?: number): unknown {
    // `get` accepts `get([i, j])` and `get(i, j)`, as the dense matrix does. The core Matrix to
    // Array conversion can read a matrix with `get(i, j)`.
    const [i, j] = Array.isArray(indexOrRow) ? indexOrRow : [indexOrRow, col as number];
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
   * The data type of the stored values (see the dense `getDataType`).
   */
  getDataType(): string {
    return this._datatype ?? (getArrayDataType(this._values ?? [], typeOf) as string);
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
   * Create a new sparse matrix from the callback results, as mathjs `SparseMatrix.map` does.
   * With `skipZeros` false (the default), the callback runs for every element, column by column.
   * An unstored element goes to the callback as 0.
   * With `skipZeros` true, the callback runs for the stored entries only.
   * A result that equals zero is not stored.
   * Callback signature: (value, index, matrix) => newValue
   */
  map(
    callback: (value: unknown, index: number[], matrix: MathJSSparseMatrix) => unknown,
    skipZeros = false
  ): MathJSSparseMatrix {
    const [rows, cols] = this._size;
    const newValues: unknown[] = [];
    const newIndex: number[] = [];
    const newPtr: number[] = [0];
    const store = (result: unknown, i: number): void => {
      if (!isZeroScalar(result)) {
        newValues.push(result);
        newIndex.push(i);
      }
    };

    for (let j = 0; j < cols; j++) {
      if (skipZeros) {
        for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
          const i = this._index[k];
          store(callback(this._values ? this._values[k] : 1, [i, j], this), i);
        }
      } else {
        // Row indexes can be unordered, so index the stored entries, then visit every row.
        const stored = new Map<number, unknown>();
        for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
          stored.set(this._index[k], this._values ? this._values[k] : 1);
        }
        for (let i = 0; i < rows; i++) {
          store(callback(stored.has(i) ? stored.get(i) : 0, [i, j], this), i);
        }
      }
      newPtr.push(newValues.length);
    }

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
   * Iterate column by column, as mathjs `SparseMatrix.forEach` does.
   * With `skipZeros` false (the default) every element is visited, and an unstored element
   * is passed as 0. With `skipZeros` true only the stored entries are visited.
   * Callback signature: (value, index, matrix) => void
   */
  forEach(
    callback: (value: unknown, index: number[], matrix: MathJSSparseMatrix) => void,
    skipZeros = false
  ): void {
    const [rows, cols] = this._size;
    for (let j = 0; j < cols; j++) {
      if (skipZeros) {
        for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
          const i = this._index[k];
          const v = this._values ? this._values[k] : 1;
          callback(v, [i, j], this);
        }
        continue;
      }
      // Index the stored entries of this column. Row indexes may be unordered, so visit every row.
      const stored = new Map<number, unknown>();
      for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
        stored.set(this._index[k], this._values ? this._values[k] : 1);
      }
      for (let i = 0; i < rows; i++) {
        callback(stored.has(i) ? stored.get(i) : 0, [i, j], this);
      }
    }
  }

  /**
   * Resize the matrix to two dimensions (mathjs `SparseMatrix.resize`). A new entry gets
   * `defaultValue` (0 when it is not given or falsy, which stores nothing). With `copy` the
   * matrix is not changed and the result is a new matrix; without `copy` the matrix is changed
   * and returned. The size is an Array or a matrix.
   * @throws Error when the size does not have two dimensions
   */
  resize(
    sizeArg: number[] | { valueOf(): unknown },
    defaultValue?: unknown,
    copy?: boolean
  ): MathJSSparseMatrix {
    const newSize = sizeList(sizeArg);
    if (newSize.length !== 2) throw new Error('Only two dimensions matrix are supported');
    if (newSize.some((n) => !Number.isInteger(n) || n < 0)) {
      throw new TypeError(
        `Invalid size, must contain positive integers (size: [${newSize.join(', ')}])`
      );
    }
    const [rows, cols] = newSize;
    const [oldRows, oldCols] = this._size;
    const value = defaultValue || 0;
    const fill = value !== 0;
    if (fill) assertAllocSize('resize', newSize);
    // A pattern matrix (no values) gets values when a nonzero entry is added: its entries are 1.
    const hasValues = this._values !== null || fill;
    const values: unknown[] = [];
    const index: number[] = [];
    const ptr: number[] = [0];
    const keepCols = Math.min(cols, oldCols);
    for (let j = 0; j < cols; j++) {
      if (j < keepCols) {
        for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
          if (this._index[k] >= rows) continue;
          index.push(this._index[k]);
          if (hasValues) values.push(this._values ? this._values[k] : 1);
        }
        // The new rows of a kept column come after its stored rows, which are below oldRows.
        if (fill) {
          for (let i = oldRows; i < rows; i++) {
            index.push(i);
            values.push(value);
          }
        }
      } else if (fill) {
        for (let i = 0; i < rows; i++) {
          index.push(i);
          values.push(value);
        }
      }
      ptr.push(index.length);
    }
    if (copy) {
      const m = new MathJSSparseMatrix({
        values: hasValues ? values : null,
        index,
        ptr,
        size: [rows, cols],
      });
      m._datatype = this._datatype;
      return m;
    }
    this._values = hasValues ? values : null;
    this._index = index;
    this._ptr = ptr;
    this._size = [rows, cols];
    return this;
  }

  /**
   * Reshape the matrix to two dimensions in row-major order (mathjs `SparseMatrix.reshape`). The
   * size can hold one -1 for a length that follows from the other. Without `copy` this matrix is
   * changed and returned; with `copy` the result is a new matrix.
   * @throws TypeError when the size is not an Array of positive integers or -1
   * @throws Error when the size does not have two dimensions or has another number of entries
   */
  reshape(sizes: number[], copy?: boolean): MathJSSparseMatrix {
    if (!Array.isArray(sizes)) throw new TypeError('Array expected');
    if (sizes.length !== 2) {
      throw new Error('Sparse matrices can only be reshaped in two dimensions');
    }
    for (const n of sizes) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n <= -2 || n === 0) {
        throw new TypeError(
          'Invalid size, must contain positive integers or -1 (size: ' + formatSize(sizes) + ')'
        );
      }
    }
    const count = this._size[0] * this._size[1];
    const [rows, cols] = processSizesWildcard(sizes, count);
    if (rows * cols !== count) {
      throw new Error('Reshaping sparse matrix will result in the wrong number of elements');
    }
    const m = copy ? this.clone() : this;
    if (rows === this._size[0] && cols === this._size[1]) return m;
    // Move each stored entry to its row-major position in the new size, then store the entries
    // column by column, each column in row order.
    const oldCols = this._size[1];
    const entries: Array<[number, number, unknown]> = [];
    for (let j = 0; j < oldCols; j++) {
      for (let k = this._ptr[j]; k < this._ptr[j + 1]; k++) {
        const flat = this._index[k] * oldCols + j;
        entries.push([Math.floor(flat / cols), flat % cols, this._values ? this._values[k] : 1]);
      }
    }
    entries.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const ptr: number[] = new Array(cols + 1).fill(0);
    for (const e of entries) ptr[e[1] + 1]++;
    for (let j = 0; j < cols; j++) ptr[j + 1] += ptr[j];
    m._index = entries.map((e) => e[0]);
    m._values = this._values ? entries.map((e) => e[2]) : null;
    m._ptr = ptr;
    m._size = [rows, cols];
    return m;
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

  /** mathjs prints a sparse matrix as its nested-array form. */
  toString(): string {
    return formatGeneric(this.toArray());
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
    // A matrix of diagonal values gives its entries, as in mathjs.
    if (isBridgeMatrix(value)) value = value.valueOf();
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
   * Walk CSC column `j`, invoking `callback(row, value)`.
   * The mathjs name is `_forEachRow`; `lup` uses it as a column scan
   * (`callback` is `(row, value)`). A row-wise scan makes sparse LU drop
   * the elimination and hide a singular pivot.
   */
  static _forEachRow(
    j: number,
    values: unknown[],
    index: number[],
    ptr: number[],
    callback: (row: number, value: unknown) => void
  ): void {
    const first = ptr[j];
    const last = ptr[j + 1];
    for (let k = first; k < last; k++) {
      callback(index[k], values ? values[k] : 1);
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
 * The storage format of a `matrix(data, format)` call: `'sparse'`, `'dense'` (for `'dense'` and
 * `'default'`) or `undefined` (no format). As in mathjs, a boolean is converted to a string and
 * any string except the three formats throws.
 * @throws TypeError for an unknown format, or for a format that is not a string or a boolean
 */
function matrixFormat(format: unknown): 'sparse' | 'dense' | undefined {
  if (format === undefined) return undefined;
  if (typeof format !== 'string' && typeof format !== 'boolean') {
    throw new TypeError(
      'Unexpected type of argument in function matrix (expected: string or boolean, actual: ' +
        typeName(format) +
        ', index: 1)'
    );
  }
  const name = String(format);
  if (name === 'sparse') return 'sparse';
  if (name === 'dense' || name === 'default') return 'dense';
  throw new TypeError('Unknown matrix type ' + JSON.stringify(name) + '.');
}

/**
 * Creates the `matrix` factory function that mathjs factories call as:
 *   matrix()           — empty dense matrix
 *   matrix(data)       — dense matrix from nested array
 *   matrix('sparse')   — empty sparse matrix (format-only arg)
 *   matrix('default')  — empty dense matrix (format-only arg)
 *   matrix(data, 'sparse') — sparse matrix from data
 *   matrix(sparse, 'dense') — dense matrix with the entries of a sparse matrix
 * The format is 'dense', 'default' or 'sparse'; any other value throws (see `matrixFormat`).
 * A matrix argument is copied, as in mathjs: the result never shares data with it. An explicit `undefined` data
 * argument throws a TypeError, as in mathjs; a call with no argument is an empty matrix.
 */
export function createMatrixBridge() {
  return function matrix(
    data?: unknown[][] | MathJSDenseMatrix | MathJSSparseMatrix | string,
    storageType?: string
  ): MathJSDenseMatrix | MathJSSparseMatrix {
    // matrix('sparse'), matrix('dense') or matrix('default'): the format alone. As in mathjs, a
    // boolean is converted to a format string, and any other format string throws. The second
    // argument of this form is a datatype, which is not checked. The parameter type does not
    // list boolean, because a boolean never gives a matrix.
    if (typeof data === 'string' || typeof (data as unknown) === 'boolean') {
      const format = String(data);
      if (format === 'sparse') return new MathJSSparseMatrix();
      if (format === 'dense' || format === 'default') return new MathJSDenseMatrix();
      throw new TypeError('Unknown matrix type ' + JSON.stringify(format) + '.');
    }
    const isMatrix = data instanceof MathJSSparseMatrix || data instanceof MathJSDenseMatrix;
    // An explicit undefined data argument is not 'no argument': only a call with no argument
    // gives an empty matrix.
    const hasData = data !== undefined || arguments.length > 0;
    if (hasData && !Array.isArray(data) && !isMatrix && !isPlainObject(data)) {
      // as in mathjs, only an Array, a Matrix, a format string or no argument is accepted
      throw new TypeError(
        'Unexpected type of argument in function matrix (expected: string or Array or Matrix or boolean, actual: ' +
          typeName(data) +
          ', index: 0)'
      );
    }
    const format = matrixFormat(storageType);
    const sparse = format === 'sparse';
    if (data === undefined) return sparse ? new MathJSSparseMatrix() : new MathJSDenseMatrix();
    if (Array.isArray(data))
      return sparse ? new MathJSSparseMatrix(data) : new MathJSDenseMatrix(data as number[][]);
    if (data instanceof MathJSSparseMatrix) {
      return format === 'dense'
        ? new MathJSDenseMatrix({ data: data.toArray() as number[][], size: data.size() })
        : data.clone();
    }
    if (data instanceof MathJSDenseMatrix)
      return sparse ? new MathJSSparseMatrix(data._data) : data.clone();
    // A storage object from a caller: the constructor trusts { data, size } (internal producers
    // pass it), so check here that the data has the size, as mathjs does.
    if (!sparse) {
      const o = data as { data?: unknown; size?: unknown };
      if (Array.isArray(o.data) && Array.isArray(o.size)) validate(o.data, o.size as number[]);
      return new MathJSDenseMatrix(data as never);
    }
    if (!isStorageObject(data)) {
      throw new TypeError(
        'Unsupported type of data: expected Array data and size, or CSC values, index, ptr and size'
      );
    }
    return new MathJSSparseMatrix(data);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** CSC and { data, size } storage objects are internal matrix data; BigNumber and Complex are not. */
function isPlainObject(x: unknown): boolean {
  return typeof x === 'object' && x !== null && Object.getPrototypeOf(x) === Object.prototype;
}

/**
 * True for a storage object that the sparse constructor reads: `{ data, size }` with Array data
 * and size, or CSC `{ values, index, ptr, size }` with Array index, ptr and size (the values may
 * be null for a pattern matrix).
 */
function isStorageObject(x: object): boolean {
  const o = x as Record<string, unknown>;
  if (Array.isArray(o.data) && Array.isArray(o.size)) return true;
  return (
    Array.isArray(o.index ?? o._index) &&
    Array.isArray(o.ptr ?? o._ptr) &&
    Array.isArray(o.size ?? o._size)
  );
}

/** A short type name for an error message: null, number, BigNumber, Complex, ... */
function typeName(x: unknown): string {
  if (x === null) return 'null';
  if (typeof x === 'object') return (x as object).constructor?.name ?? 'Object';
  return typeof x;
}

/**
 * A copy of nested data that has `axes` axes. The values are not copied. A level that is
 * not an array (ragged data) is kept as a value.
 */
function copyAxes(data: unknown, axes: number): unknown {
  if (!Array.isArray(data)) return data;
  return axes <= 1 ? data.slice() : data.map((sub) => copyAxes(sub, axes - 1));
}

/**
 * Call `fn(value, index)` for every value of nested data that has `axes` axes, in row-major
 * order, and return the results in the same nested shape. `index` has one entry per axis.
 * A level that is not an array (ragged data) is passed to `fn` as a value.
 */
function walkAxes(
  data: unknown[],
  axes: number,
  index: number[],
  fn: (value: unknown, index: number[]) => unknown
): unknown[] {
  if (axes > 1) {
    return data.map((sub, i) =>
      Array.isArray(sub) ? walkAxes(sub, axes - 1, [...index, i], fn) : fn(sub, [...index, i])
    );
  }
  // The last axis. A literal index for 1 and 2 axes keeps the cost per value low.
  if (index.length === 0) return data.map((value, i) => fn(value, [i]));
  if (index.length === 1) {
    const row = index[0];
    return data.map((value, j) => fn(value, [row, j]));
  }
  return data.map((value, i) => fn(value, [...index, i]));
}

/** As `walkAxes`, but it keeps no results. */
function eachAxes(
  data: unknown[],
  axes: number,
  index: number[],
  fn: (value: unknown, index: number[]) => void
): void {
  for (let i = 0; i < data.length; i++) {
    const sub = data[i];
    if (axes > 1 && Array.isArray(sub)) eachAxes(sub, axes - 1, [...index, i], fn);
    else if (index.length === 0) fn(sub, [i]);
    else if (index.length === 1) fn(sub, [index[0], i]);
    else fn(sub, [...index, i]);
  }
}

/** True for a dense or sparse bridge matrix. */
function isBridgeMatrix(x: unknown): x is MathJSDenseMatrix | MathJSSparseMatrix {
  return x instanceof MathJSDenseMatrix || x instanceof MathJSSparseMatrix;
}

/**
 * A size argument as a list of numbers, as the mathjs `resize` methods read it: an Array, or a
 * matrix of lengths (a one-column matrix gives one length per row).
 * @throws TypeError when the size is not an Array or a matrix
 */
function sizeList(size: unknown): number[] {
  const list = isBridgeMatrix(size) ? (size.valueOf() as unknown[]) : size;
  if (!Array.isArray(list)) throw new TypeError('Array or Matrix expected');
  return list.map((v) => (Array.isArray(v) && v.length === 1 ? v[0] : v)) as number[];
}

/** A size as mathjs prints it in an error: `[2, 2, 1]`. */
function formatSize(size: number[]): string {
  return '[' + size.join(', ') + ']';
}

/** The size of a nested array, one entry per axis. */
function inferSize(data: unknown[]): number[] {
  // `[[[]], [[]]]` is 2x1x0, as in mathjs.
  return arraySize(data);
}
