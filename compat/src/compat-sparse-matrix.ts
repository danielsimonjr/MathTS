/**
 * Compat sparse matrix wrappers (#1582, #1785): mathjs 15.3.0 SparseMatrix model on
 * `MathJSSparseMatrix` without mutating the functions implementation.
 */

import { DimensionError } from '@danielsimonjr/mathts-core';
import { clone, validateIndex } from '@danielsimonjr/mathts-core/internal';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { compatDecimalResult } from './bignumber.js';
import { COMPAT_MATRIX_WRAPPER } from './compat-matrix-model.js';
import { NEW_OPERATOR_MESSAGE, newOperatorGuard } from './constructors-without-new.js';
import { mathjsFractionClass } from './mathjs-fraction-class.js';
import { sanitizeDenseSparseInput } from './sparse-structural-zero.js';

/** Pass-through; native CSC sparse already matches mathjs 15.3.0 storage (#1582). */
export function ensureCompatSparse(m: unknown): unknown {
  return m;
}

/** Sanitize nested sparse input before `_factorySparse` (valueless Unit throw). */
export function sanitizeSparseNestedInput(data: unknown[][]): unknown[][] {
  return sanitizeDenseSparseInput(data);
}

type SparseInstance = {
  _datatype?: string;
  _values: unknown[] | null;
  _index: number[];
  _ptr: number[];
  _size: number[];
  zero: unknown;
  isZero: (value: unknown) => boolean;
  valueOf(): unknown[][];
  toArray(): unknown[][];
  get(index: unknown): unknown;
  set(index: number[], value: unknown, defaultValue?: unknown): SparseInstance;
  map(callback: unknown): unknown;
  forEach(callback: unknown): void;
  clone(): SparseInstance;
  subset(index: unknown, replacement?: unknown, defaultValue?: unknown): unknown;
};

type SparseHelpers = {
  bignumber: (value: unknown) => unknown;
  fraction: (value: unknown) => unknown;
};

type SparseConstructable = new (...args: unknown[]) => SparseInstance & {
  storage(): string;
  type?: string;
};

const typed = factory_mathjsCompat.createCompatTyped();

function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

function isMatrixInput(data: unknown): data is { isMatrix?: boolean; _datatype?: string } {
  return (
    typeof data === 'object' && data !== null && (data as { isMatrix?: boolean }).isMatrix === true
  );
}

function convertSparseValue(value: unknown, datatype: string | undefined): unknown {
  if (!datatype) return value;
  if (datatype === 'Fraction') return new mathjsFractionClass(value as number);
  if (datatype === 'BigNumber') return compatDecimalResult(value);
  if (datatype === 'bigint') return typeof value === 'bigint' ? value : BigInt(value as number);
  try {
    return (typed as { convert(value: unknown, type: string): unknown }).convert(value, datatype);
  } catch {
    return value;
  }
}

function decorateSparseInstance(inst: SparseInstance, wrapperProto: object): void {
  Object.setPrototypeOf(inst, wrapperProto);
}

function defineSparseTypeFlags(proto: Record<string, unknown>): void {
  Object.defineProperty(proto, COMPAT_MATRIX_WRAPPER, {
    value: 'sparse',
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(proto, 'type', {
    value: 'SparseMatrix',
    enumerable: true,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(proto, 'isSparseMatrix', {
    value: true,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(proto, 'isMatrix', {
    value: true,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function patchSparseValueOf(sparse: SparseInstance): void {
  const native = sparse.valueOf.bind(sparse);
  sparse.valueOf = function () {
    const arr = native();
    const zero = sparse.zero;
    return arr.map((row) =>
      row.map((cell) => {
        if (cell === 0 || (typeof cell === 'number' && Object.is(cell, -0))) {
          return compatDecimalResult(zero);
        }
        return compatDecimalResult(cell);
      })
    );
  };
}

function applySparseDatatype(inst: SparseInstance, datatype: string, helpers: SparseHelpers): void {
  void helpers;
  inst._datatype = datatype;
  if (inst._values) {
    inst._values = inst._values.map((entry) => convertSparseValue(entry, datatype));
  }
  inst.zero = convertSparseValue(0, datatype) as typeof inst.zero;
  if (datatype === 'BigNumber') patchSparseValueOf(inst);
}

function sparseResizeForSet(
  matrix: SparseInstance,
  rows: number,
  columns: number,
  defaultValue: unknown
): void {
  const values = matrix._values;
  if (!values) return;
  let value: unknown = defaultValue || 0;
  if (typeof matrix._datatype === 'string') {
    value = convertSparseValue(value, matrix._datatype);
  }
  const ins = !matrix.isZero(value);
  const r = matrix._size[0];
  let c = matrix._size[1];
  if (columns > c) {
    for (let j = c; j < columns; j++) {
      matrix._ptr[j] = values.length;
      if (ins) {
        for (let i = 0; i < r; i++) {
          values.push(value);
          matrix._index.push(i);
        }
      }
    }
    matrix._ptr[columns] = values.length;
  } else if (columns < c) {
    matrix._ptr.splice(columns + 1, c - columns);
    values.splice(matrix._ptr[columns], values.length);
    matrix._index.splice(matrix._ptr[columns], matrix._index.length);
  }
  c = columns;
  if (rows > r) {
    if (ins) {
      let n = 0;
      for (let j = 0; j < c; j++) {
        matrix._ptr[j] = matrix._ptr[j] + n;
        const k = matrix._ptr[j + 1] + n;
        let p = 0;
        for (let i = r; i < rows; i++, p++) {
          values.splice(k + p, 0, value);
          matrix._index.splice(k + p, 0, i);
          n++;
        }
      }
      matrix._ptr[c] = values.length;
    }
  } else if (rows < r) {
    let d = 0;
    for (let j = 0; j < c; j++) {
      matrix._ptr[j] = matrix._ptr[j] - d;
      const k0 = matrix._ptr[j];
      const k1 = matrix._ptr[j + 1] - d;
      for (let k = k0; k < k1; k++) {
        const i = matrix._index[k];
        if (i > rows - 1) {
          values.splice(k, 1);
          matrix._index.splice(k, 1);
          d++;
        }
      }
    }
    matrix._ptr[c] = values.length;
  }
  matrix._size = [rows, columns];
}

function patchCompatSparseMatrixPrototype(
  NativeSparse: SparseConstructable,
  WrappedCtor: SparseConstructable
): object {
  const wrapperProto = Object.create(NativeSparse.prototype) as Record<string, unknown>;
  defineSparseTypeFlags(wrapperProto);
  const nativeProto = NativeSparse.prototype as Record<string, unknown>;

  const nativeGet = nativeProto.get as (index: unknown) => unknown;
  wrapperProto.get = function getWrapped(this: SparseInstance, index: unknown): unknown {
    if (!isArray(index)) {
      throw new TypeError('Array expected');
    }
    if (index.length !== this._size.length) {
      throw new DimensionError(index.length, this._size.length);
    }
    if (!this._values) {
      throw new Error('Cannot invoke get on a Pattern only matrix');
    }
    const [i, j] = index as [number, number];
    validateIndex(i, this._size[0]);
    validateIndex(j, this._size[1]);
    return nativeGet.call(this, index);
  };

  const nativeSet = nativeProto.set as (
    index: number[],
    value: unknown,
    defaultValue?: unknown
  ) => SparseInstance;
  wrapperProto.set = function setWrapped(
    this: SparseInstance,
    index: number[],
    value?: unknown,
    defaultValue?: unknown
  ): SparseInstance {
    if (!isArray(index)) {
      throw new TypeError('Array expected');
    }
    if (index.length !== this._size.length) {
      throw new DimensionError(index.length, this._size.length);
    }
    if (!this._values) {
      throw new Error('Cannot invoke set on a Pattern only matrix');
    }
    const [i, j] = index;
    const rows = this._size[0];
    const columns = this._size[1];
    if (i > rows - 1 || j > columns - 1) {
      sparseResizeForSet(this, Math.max(i + 1, rows), Math.max(j + 1, columns), defaultValue);
    }
    if (typeof this._datatype === 'string' && arguments.length >= 2) {
      value = convertSparseValue(value, this._datatype);
    }
    validateIndex(i, this._size[0]);
    validateIndex(j, this._size[1]);
    return nativeSet.call(this, index, value, defaultValue);
  };

  const nativeToJSON = nativeProto.toJSON as () => Record<string, unknown>;
  wrapperProto.toJSON = function toJSONWrapped(this: SparseInstance): Record<string, unknown> {
    const json = nativeToJSON.call(this) as Record<string, unknown>;
    json.datatype = this._datatype;
    return json;
  };

  const nativeMap = nativeProto.map as (callback: unknown) => unknown;
  wrapperProto.map = function mapWrapped(this: SparseInstance, callback: unknown): unknown {
    if (!this._values) {
      throw new Error('Cannot invoke map on a Pattern only matrix');
    }
    return nativeMap.call(this, callback);
  };

  const nativeForEach = nativeProto.forEach as (callback: unknown) => void;
  wrapperProto.forEach = function forEachWrapped(this: SparseInstance, callback: unknown): void {
    if (!this._values) {
      throw new Error('Cannot invoke forEach on a Pattern only matrix');
    }
    nativeForEach.call(this, callback);
  };

  const nativeClone = nativeProto.clone as () => SparseInstance;
  wrapperProto.clone = function cloneWrapped(this: SparseInstance): SparseInstance {
    const c = nativeClone.call(this);
    if (c._values) c._values = c._values.map((entry) => clone(entry as never));
    decorateSparseInstance(c, wrapperProto);
    return c;
  };

  const nativeSubset = nativeProto.subset as (
    index: unknown,
    replacement?: unknown,
    defaultValue?: unknown
  ) => unknown;
  wrapperProto.subset = function subsetWrapped(
    this: SparseInstance,
    index: unknown,
    replacement?: unknown,
    defaultValue?: unknown
  ): unknown {
    if (!this._values && arguments.length >= 2) {
      throw new Error('Cannot invoke set subset on a Pattern only matrix');
    }
    return nativeSubset.call(this, index, replacement, defaultValue);
  };

  Object.defineProperty(wrapperProto, Symbol.iterator, {
    value: function* sparseIterator(
      this: SparseInstance
    ): Generator<{ value: unknown; index: number[] }, void, undefined> {
      if (!this._values) {
        throw new Error('Cannot iterate a Pattern only matrix');
      }
      const columns = this._size[1];
      for (let j = 0; j < columns; j++) {
        const k0 = this._ptr[j];
        const k1 = this._ptr[j + 1];
        for (let k = k0; k < k1; k++) {
          const i = this._index[k];
          yield { value: this._values[k], index: [i, j] };
        }
      }
    },
    writable: true,
    configurable: true,
  });

  (wrapperProto as { create?: unknown }).create = function createWrapped(
    this: SparseInstance,
    data: unknown,
    datatype?: string
  ): SparseInstance {
    return new WrappedCtor(data, datatype) as SparseInstance;
  };

  return wrapperProto;
}

/**
 * mathjs accepts `new SparseMatrix(matrix, 'BigNumber')` and exposes `zero` /
 * `valueOf()` with BigNumber entries (#1780). Prototype patches match mathjs 15.3.0 (#1785).
 */
export function wrapCompatSparseMatrixClass(
  NativeSparse: SparseConstructable,
  bignumber: (value: unknown) => unknown
): SparseConstructable {
  const helpers: SparseHelpers = {
    bignumber,
    fraction: (value) => new mathjsFractionClass(value as number),
  };
  const Guarded = newOperatorGuard(NativeSparse) as SparseConstructable;
  let wrapperProto!: object;
  const Wrapped = new Proxy(Guarded, {
    construct(target, argArray: unknown[], newTarget) {
      const [data, datatype] = argArray;
      if (datatype !== undefined && typeof datatype !== 'string') {
        throw new Error(`Invalid datatype: ${String(datatype)}`);
      }
      const inst = Reflect.construct(
        target,
        typeof datatype === 'string' ? [data] : argArray,
        newTarget
      ) as SparseInstance;
      if (typeof datatype === 'string') {
        applySparseDatatype(inst, datatype, helpers);
      } else if (isMatrixInput(data)) {
        const source = data as { _datatype?: string; datatype?: () => string };
        const sourceDatatype =
          source._datatype ??
          (typeof source.datatype === 'function' ? source.datatype() : undefined);
        if (sourceDatatype) {
          applySparseDatatype(inst, sourceDatatype, helpers);
        } else if (inst._datatype === 'BigNumber') {
          applySparseDatatype(inst, 'BigNumber', helpers);
        }
      }
      decorateSparseInstance(inst, wrapperProto);
      return inst;
    },
    apply() {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    },
  }) as SparseConstructable;

  wrapperProto = patchCompatSparseMatrixPrototype(NativeSparse, Wrapped);

  const nativeFromJSON = (
    NativeSparse as unknown as { fromJSON?: (json: unknown) => SparseInstance }
  ).fromJSON;
  if (typeof nativeFromJSON === 'function') {
    (Wrapped as unknown as { fromJSON: (json: unknown) => SparseInstance }).fromJSON = (
      json: unknown
    ) => {
      const m = nativeFromJSON(json);
      decorateSparseInstance(m, wrapperProto);
      return m;
    };
  } else {
    (Wrapped as unknown as { fromJSON: (json: unknown) => SparseInstance }).fromJSON = (
      json: unknown
    ) => new Wrapped(json) as SparseInstance;
  }

  const nativeDiagonal = (
    NativeSparse as unknown as {
      diagonal?: (...args: unknown[]) => SparseInstance;
    }
  ).diagonal;
  if (typeof nativeDiagonal === 'function') {
    (Wrapped as unknown as { diagonal: (...args: unknown[]) => SparseInstance }).diagonal = (
      ...args: unknown[]
    ) => {
      const m = nativeDiagonal.apply(NativeSparse, args);
      const datatype = args[4];
      if (typeof datatype === 'string') {
        applySparseDatatype(m, datatype, helpers);
      }
      decorateSparseInstance(m, wrapperProto);
      return m;
    };
  }

  return Wrapped;
}
