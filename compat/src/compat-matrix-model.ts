/**
 * mathjs 15.3.0 matrix model parity (#1785): compat-only wrappers around
 * `factory_mathjsCompat` matrix constructors (no native package prototype mutation).
 */

import { isMatrix as coreIsMatrix } from '@danielsimonjr/mathts-core';
import {
  arraySize,
  clone,
  isIndex,
  resize as resizeArray,
  validate,
} from '@danielsimonjr/mathts-core/internal';
import { config as mathtsConfig } from '@danielsimonjr/mathts-functions';
import { isDenseMatrix, isSparseMatrix } from '@danielsimonjr/mathts-matrix';
import {
  NEW_OPERATOR_MESSAGE,
  newOperatorGuard,
  type CompatClass,
} from './constructors-without-new.js';
import {
  G09_MATRIX_SUBSET_PATCHED,
  installG09BridgeMatrixSubsetPatch,
} from './mathjs-parity-g09.js';
import {
  applyCompatLegacySubsetGet,
  forwardSubsetArgs,
  applySubsetGetMatrixShape,
} from './mathjs-parity-1785-surfaces.js';
import { wrapCompatSparseMatrixClass } from './compat-sparse-matrix.js';

type SparseBignumberFn = (value: unknown) => unknown;

type MatrixChecks = {
  isMatrix(value: unknown): boolean;
  isDenseMatrix(value: unknown): boolean;
  isSparseMatrix(value: unknown): boolean;
};

type MatrixLike = {
  type?: string;
  isMatrix?: boolean;
  _data: unknown;
  _size: number[];
  _datatype?: string;
  toArray(): unknown;
  size(): number[];
  valueOf(): unknown;
};

/** Constructor shape for a native matrix class wired through compat (#1785). */
export type MatrixCtorForCompat = new (...args: unknown[]) => unknown;
type MatrixCtor = MatrixCtorForCompat;

type DenseInstance = MatrixLike &
  Record<string, unknown> & {
    get(index: unknown, col?: unknown): unknown;
    set(index: unknown, value?: unknown, defaultValue?: unknown): unknown;
    subset(index: unknown, replacement?: unknown, defaultValue?: unknown): unknown;
    map(callback: unknown, skipZeros?: unknown, isUnary?: unknown): MatrixLike;
    forEach(callback: unknown): void;
    clone(): DenseInstance;
    resize(size: unknown, defaultValue?: unknown, copy?: boolean): MatrixLike | number;
    toJSON(): Record<string, unknown>;
    create(data: unknown, datatype?: string): MatrixLike;
    createDenseMatrix?(opts: { data: unknown; size: number[]; datatype?: string }): MatrixLike;
  };

type DenseHelpers = {
  checks: MatrixChecks;
  typeOf(value: unknown): string;
};

/** Marker on compat-wrapped matrix prototypes (#1785). */
export const COMPAT_MATRIX_WRAPPER = Symbol.for('compat.matrix.wrapper');

/** Reports whether `value` was built by a compat matrix wrapper prototype (#1785). */
export function isCompatWrappedMatrix(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as Record<symbol, unknown> | null;
  return proto != null && proto[COMPAT_MATRIX_WRAPPER] != null;
}

/** Read mathjs-style `_datatype` / `datatype()` from a matrix instance (#1785). */
export function readMatrixDatatype(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const m = value as { _datatype?: string; datatype?: () => string };
  if (typeof m._datatype === 'string') return m._datatype;
  if (typeof m.datatype === 'function') {
    const dt = m.datatype();
    if (typeof dt === 'string') return dt;
  }
  return undefined;
}

/** Set `_datatype` on a compat or bridge matrix (#1785). */
export function stampMatrixDatatype(value: unknown, datatype: string | undefined): void {
  if (datatype === undefined || typeof value !== 'object' || value === null) return;
  (value as { _datatype?: string })._datatype = datatype;
}

/** Copy `_datatype` from operands onto a matrix result when present (#1785). */
export function inheritMatrixDatatype(result: unknown, sources: readonly unknown[]): unknown {
  if (typeof result !== 'object' || result === null) return result;
  if ((result as { isMatrix?: boolean }).isMatrix !== true) return result;
  for (const source of sources) {
    const dt = readMatrixDatatype(source);
    if (dt !== undefined) {
      stampMatrixDatatype(result, dt);
      return result;
    }
  }
  return result;
}

/** Compat-wrapped matrix constructors surfaced on `create(all)` (#1785). */
export type CompatMatrixCtors = {
  DenseMatrix: MatrixCtor;
  SparseMatrix: MatrixCtor;
  ImmutableDenseMatrix: MatrixCtor;
};

let compatMatrixCtors: CompatMatrixCtors | null = null;

/** Wire compat matrix constructors for bridge→wrapper promotion (#1785). */
export function bindCompatMatrixPromotion(ctors: CompatMatrixCtors): void {
  compatMatrixCtors = ctors;
}

function readPromoteMatrixSize(m: {
  size?: (() => number[]) | { rows: number; cols: number };
  _size?: number[];
  rows?: number;
  cols?: number;
}): number[] | undefined {
  if (typeof m.size === 'function') return m.size();
  if (Array.isArray(m._size)) return m._size;
  if (typeof m.size === 'object' && m.size !== null && 'rows' in m.size && 'cols' in m.size) {
    const block = m.size as { rows: number; cols: number };
    return [block.rows, block.cols];
  }
  if (typeof m.rows === 'number' && typeof m.cols === 'number') return [m.rows, m.cols];
  return undefined;
}

/** Re-wrap bridge matrix instances with compat prototypes (#1785). */
export function promoteToCompatMatrix(value: unknown, ctors?: CompatMatrixCtors): unknown {
  const resolved = ctors ?? compatMatrixCtors;
  if (resolved == null) return value;
  if (value == null || typeof value !== 'object') return value;
  if (isCompatWrappedMatrix(value)) return value;
  const m = value as MatrixLike & {
    storage?: () => string;
    type?: string;
    isImmutableDenseMatrix?: boolean;
    isSparseMatrix?: boolean;
    toArray(): unknown;
    _datatype?: string;
    isMatrix?: boolean;
  };
  if (m.isMatrix !== true && !isDenseMatrix(value) && !isSparseMatrix(value)) return value;
  const datatype = readMatrixDatatype(m);
  if (m.isImmutableDenseMatrix === true || m.type === 'ImmutableDenseMatrix') {
    return Reflect.construct(resolved.ImmutableDenseMatrix, [m.toArray(), datatype]);
  }
  if (
    isSparseMatrix(value) ||
    m.isSparseMatrix === true ||
    m.type === 'SparseMatrix' ||
    m.storage?.() === 'sparse'
  ) {
    const sparseSize = readPromoteMatrixSize(m);
    const sparseData = m.toArray();
    if (sparseSize === undefined) {
      return Reflect.construct(resolved.SparseMatrix, [sparseData, datatype]);
    }
    const sparseArg =
      sparseSize.length >= 2 &&
      (sparseSize.some((d) => d === 0) ||
        (Array.isArray(sparseData) && sparseData.length === 0 && sparseSize.length > 1))
        ? { data: sparseData, size: sparseSize }
        : sparseData;
    return Reflect.construct(resolved.SparseMatrix, [sparseArg, datatype]);
  }
  const size = readPromoteMatrixSize(m);
  const data = m.toArray();
  if (size === undefined) {
    return Reflect.construct(resolved.DenseMatrix, [data, datatype]);
  }
  const denseArg =
    size.length >= 2 &&
    (size.some((d) => d === 0) || (Array.isArray(data) && data.length === 0 && size.length > 1))
      ? { data, size }
      : data;
  return Reflect.construct(resolved.DenseMatrix, [denseArg, datatype]);
}

const MATRIX_INTERFACE_METHODS = [
  'storage',
  'datatype',
  'create',
  'subset',
  'get',
  'set',
  'resize',
  'reshape',
  'clone',
  'size',
  'map',
  'forEach',
  Symbol.iterator,
  'toArray',
  'valueOf',
  'format',
  'toString',
] as const;

function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

function isCompatMatrix(value: unknown, checks: MatrixChecks): value is MatrixLike {
  if (typeof value !== 'object' || value === null) return false;
  return (
    checks.isMatrix(value) ||
    coreIsMatrix(value) ||
    (value as { isMatrix?: boolean }).isMatrix === true
  );
}

function preprocessMatrixData(data: unknown, checks: MatrixChecks): unknown {
  if (isCompatMatrix(data, checks)) {
    return preprocessMatrixData(data.valueOf(), checks);
  }
  if (isArray(data)) {
    return data.map((entry) => preprocessMatrixData(entry, checks));
  }
  return data;
}

function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'Array';
  return (value as { constructor?: { name?: string } }).constructor?.name ?? typeof value;
}

function decorateDenseInstance(
  inst: MatrixLike & Record<string, unknown>,
  wrapperProto: object
): void {
  Object.setPrototypeOf(inst, wrapperProto);
}

function defineEnumerableMatrixFlags(proto: Record<string, unknown>): void {
  Object.defineProperty(proto, COMPAT_MATRIX_WRAPPER, {
    value: 'dense',
    enumerable: false,
    configurable: true,
  });
  for (const [key, value] of [
    ['isMatrix', true],
    ['isDenseMatrix', true],
    ['type', 'DenseMatrix'],
  ] as const) {
    Object.defineProperty(proto, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}

function mapCallbackTypeError(err: unknown, callback: unknown, args: unknown[]): TypeError {
  const callbackName =
    typeof callback === 'function' && callback.name ? callback.name : String(callback);
  const describe = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'Array';
    return typeName(value);
  };
  const parts = [`value: ${describe(args[0])}`];
  if (args.length >= 2) parts.push(`index: ${describe(args[1])}`);
  if (args.length >= 3) parts.push(`array: ${describe(args[2])}`);
  void err;
  return new TypeError(
    `Function map cannot apply callback arguments ${callbackName}(${parts.join(', ')}) at index ${JSON.stringify(args[1])}`
  );
}

function wrapDenseMap(
  nativeMap: (callback: unknown, skipZeros?: unknown, isUnary?: unknown) => MatrixLike
): (callback: unknown, skipZeros?: unknown, isUnary?: unknown) => MatrixLike {
  return function mapWrapped(
    this: MatrixLike,
    callback: unknown,
    skipZeros?: unknown,
    isUnary?: unknown
  ): MatrixLike {
    try {
      return nativeMap.call(this, callback, skipZeros, isUnary);
    } catch (err) {
      const sampleIndex = this._size.map(() => 0);
      let sampleValue: unknown = undefined;
      try {
        sampleValue = (this as unknown as DenseInstance).get(sampleIndex);
      } catch {
        /* empty matrix — still format like mathjs */
      }
      throw mapCallbackTypeError(err, callback, [sampleValue, sampleIndex, this]);
    }
  };
}

function denseIterator(
  this: MatrixLike & { _data: unknown[]; _size: number[] }
): Generator<{ value: unknown; index: number[] }, void, undefined> {
  const maxDepth = this._size.length - 1;
  if (maxDepth < 0) {
    return (function* empty() {})();
  }
  if (maxDepth === 0) {
    const data = this._data as unknown[];
    return (function* oneD() {
      for (let i = 0; i < data.length; i++) {
        yield { value: data[i], index: [i] };
      }
    })();
  }
  const dataRoot = this._data;
  const size = this._size;
  return (function* multiD() {
    const index = Array(maxDepth + 1).fill(0);
    const total = size.reduce((a: number, b: number) => a * b, 1);
    for (let count = 0; count < total; count++) {
      let current: unknown = dataRoot;
      for (let d = 0; d < maxDepth; d++) {
        current = (current as unknown[])[index[d]];
      }
      yield {
        value: (current as unknown[])[index[maxDepth]],
        index: index.slice(),
      };
      for (let d = maxDepth; d >= 0; d--) {
        index[d]++;
        if (index[d] < size[d]) break;
        index[d] = 0;
      }
    }
  })();
}

/** mathjs `Matrix` interface class with guard + `Symbol.hasInstance` parity. */
export function createCompatMatrixClass(checks: MatrixChecks): new () => {
  type: string;
  isMatrix: boolean;
} {
  function Matrix(this: { type: string; isMatrix: boolean }): void {
    if (!(this instanceof Matrix)) {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    }
  }
  Matrix.prototype.type = 'Matrix';
  Matrix.prototype.isMatrix = true;
  for (const name of MATRIX_INTERFACE_METHODS) {
    (Matrix.prototype as Record<string | symbol, unknown>)[name] = function matrixInterfaceStub() {
      if (name === Symbol.iterator) {
        throw new Error('Cannot iterate a Matrix interface');
      }
      throw new Error(`Cannot invoke ${String(name)} on a Matrix interface`);
    };
  }
  const Guarded = newOperatorGuard(Matrix as unknown as CompatClass);
  const Wrapped = new Proxy(Guarded, {
    apply() {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    },
  }) as new () => { type: string; isMatrix: boolean };
  Object.defineProperty(Wrapped, Symbol.hasInstance, {
    configurable: true,
    value(value: unknown): boolean {
      return (
        Function.prototype[Symbol.hasInstance].call(this, value) ||
        coreIsMatrix(value) ||
        checks.isMatrix(value)
      );
    },
  });
  return Wrapped;
}

/** Patches a native dense matrix prototype with mathjs 15.3.0 compat behavior (#1785). */
export function patchCompatDenseMatrixPrototype(Native: MatrixCtor): object {
  const wrapperProto = Object.create(Native.prototype) as Record<string, unknown>;
  defineEnumerableMatrixFlags(wrapperProto);
  const nativeProto = Native.prototype as Record<string, unknown>;

  const originalSubset = nativeProto.subset as (
    index: unknown,
    replacement?: unknown,
    defaultValue?: unknown
  ) => unknown;
  wrapperProto.subset = function subsetWrapped(
    this: MatrixLike,
    index: unknown,
    replacement?: unknown,
    defaultValue?: unknown
  ): unknown {
    switch (arguments.length) {
      case 1:
        if (!isIndex(index)) {
          throw new TypeError('Invalid index');
        }
        break;
      case 2:
      case 3:
        if (
          typeof index !== 'object' ||
          index === null ||
          (index as { isIndex?: boolean }).isIndex !== true
        ) {
          throw new TypeError('Invalid index');
        }
        break;
      default:
        throw new SyntaxError('Wrong number of arguments');
    }
    const legacy = () => (mathtsConfig() as { legacySubset?: boolean }).legacySubset === true;
    const matrixFromScalar = (value: unknown): unknown =>
      Reflect.construct(Native, [[value]]) as MatrixLike;
    const invoke = (i: unknown, r?: unknown, d?: unknown) => originalSubset.call(this, i, r, d);
    if (arguments.length === 1) {
      const result = forwardSubsetArgs(invoke, index);
      const legacyOn = legacy();
      const adjusted = applyCompatLegacySubsetGet(result, index, legacyOn, matrixFromScalar);
      return applySubsetGetMatrixShape(
        adjusted,
        index,
        legacyOn,
        (data) => Reflect.construct(Native, [data]) as MatrixLike
      );
    }
    if (arguments.length === 2) {
      return forwardSubsetArgs(invoke, index, replacement);
    }
    return forwardSubsetArgs(invoke, index, replacement, defaultValue);
  };

  const originalGet = nativeProto.get as (index: unknown, col?: unknown) => unknown;
  wrapperProto.get = function getWrapped(this: MatrixLike, index: unknown, col?: unknown): unknown {
    if (arguments.length === 2 && typeof index === 'number' && typeof col === 'number') {
      return originalGet.call(this, index, col);
    }
    if (arguments.length === 2) {
      throw new TypeError('Array expected');
    }
    if (!isArray(index)) {
      throw new TypeError('Array expected for index');
    }
    return originalGet.call(this, index);
  };

  const boundMap = nativeProto.map as (
    callback: unknown,
    skipZeros?: unknown,
    isUnary?: unknown
  ) => MatrixLike;
  wrapperProto.map = wrapDenseMap(function mapNative(
    this: MatrixLike,
    callback: unknown,
    skipZeros?: unknown,
    isUnary?: unknown
  ) {
    return boundMap.call(this, callback, skipZeros, isUnary);
  });

  Object.defineProperty(wrapperProto, Symbol.iterator, {
    value: denseIterator,
    writable: true,
    configurable: true,
  });

  const originalResize = nativeProto.resize as (
    size: unknown,
    defaultValue?: unknown,
    copy?: boolean
  ) => MatrixLike | number;
  wrapperProto.resize = function resizeWrapped(
    this: MatrixLike & { _data: unknown; _size: number[]; clone(): DenseInstance },
    size: unknown,
    defaultValue?: unknown,
    copy?: boolean
  ): MatrixLike | number {
    if (defaultValue !== null) {
      return originalResize.call(this, size, defaultValue, copy);
    }
    const target = (copy ? this.clone() : this) as MatrixLike & {
      _data: unknown;
      _size: number[];
    };
    const sizeList = (size as { valueOf(): unknown }).valueOf();
    const dims = (Array.isArray(sizeList) ? sizeList : [sizeList]).map((v) => {
      if (Array.isArray(v) && v.length === 1) return v[0] as number;
      return v as number;
    });
    if (dims.length === 0) {
      let v: unknown = target._data;
      while (Array.isArray(v)) v = v[0];
      return v as number;
    }
    target._size = dims.slice();
    const base = copy ? clone(target._data as never) : (target._data as never);
    target._data = resizeArray(base, dims, null as never) as typeof target._data;
    if (copy) {
      target._data = clone(target._data as never);
    }
    return target;
  };

  wrapperProto.datatype = function datatypeWrapped(this: MatrixLike): string | undefined {
    return this._datatype;
  };

  const originalToJSON = nativeProto.toJSON as () => Record<string, unknown>;
  wrapperProto.toJSON = function toJSONWrapped(this: MatrixLike): Record<string, unknown> {
    const json = originalToJSON.call(this) as Record<string, unknown>;
    json.datatype = this._datatype;
    return json;
  };

  const originalClone = nativeProto.clone as () => DenseInstance;
  wrapperProto.clone = function cloneWrapped(this: MatrixLike): MatrixLike {
    const c = originalClone.call(this) as MatrixLike & { _data: unknown; _size: number[] };
    c._data = clone(c._data as never);
    c._datatype = this._datatype;
    decorateDenseInstance(c, wrapperProto);
    return c;
  };

  const originalTranspose = nativeProto.transpose as (() => MatrixLike) | undefined;
  if (typeof originalTranspose === 'function') {
    wrapperProto.transpose = function transposeWrapped(this: MatrixLike): MatrixLike {
      const t = originalTranspose.call(this) as MatrixLike & { _datatype?: string };
      t._datatype = this._datatype;
      decorateDenseInstance(t, wrapperProto);
      return t;
    };
  }

  return wrapperProto;
}

function buildDenseConstructorArgs(argArray: unknown[], helpers: DenseHelpers): unknown[] {
  const [data, datatype] = argArray;
  if (datatype !== undefined && !isString(datatype)) {
    throw new Error(`Invalid datatype: ${datatype}`);
  }
  if (argArray.length === 0 || data === undefined) {
    return [];
  }
  if (isCompatMatrix(data, helpers.checks)) {
    const source = data as MatrixLike;
    if (source.type === 'DenseMatrix' || helpers.checks.isDenseMatrix(source)) {
      return [
        {
          data: clone(source._data as never),
          size: clone(source._size),
        },
      ];
    }
    return [
      {
        data: source.toArray(),
        size: source.size(),
      },
    ];
  }
  if (
    typeof data === 'object' &&
    data !== null &&
    isArray((data as { data?: unknown }).data) &&
    isArray((data as { size?: unknown }).size)
  ) {
    const block = data as { data: unknown[]; size: number[]; datatype?: string };
    validate(block.data as never, block.size);
    return block.datatype !== undefined
      ? [{ data: block.data, size: block.size, datatype: block.datatype }]
      : [{ data: block.data, size: block.size }];
  }
  if (isArray(data)) {
    const processed = preprocessMatrixData(data, helpers.checks);
    const size = arraySize(processed as never);
    validate(processed as never, size);
    return [{ data: processed, size, datatype }];
  }
  throw new TypeError(`Unsupported type of data (${helpers.typeOf(data)})`);
}

/** Wraps the factory dense matrix constructor with compat guards and promotion (#1785). */
export function wrapCompatDenseMatrixClass(
  NativeDense: MatrixCtor,
  helpers: DenseHelpers,
  wrapperProto = patchCompatDenseMatrixPrototype(NativeDense)
): MatrixCtor {
  const Guarded = newOperatorGuard(NativeDense as unknown as CompatClass) as MatrixCtor;
  let Wrapped!: MatrixCtor;

  Wrapped = new Proxy(Guarded, {
    construct(_target, argArray: unknown[], newTarget) {
      const nativeArgs = buildDenseConstructorArgs(argArray, helpers);
      const inst = Reflect.construct(
        NativeDense,
        nativeArgs.length ? nativeArgs : [],
        newTarget
      ) as MatrixLike & Record<string, unknown>;
      const [rawData, rawDatatype] = argArray;
      if (typeof rawDatatype === 'string') {
        inst._datatype = rawDatatype;
      } else if (isCompatMatrix(rawData, helpers.checks)) {
        inst._datatype = (rawData as MatrixLike)._datatype;
      } else if (
        typeof rawData === 'object' &&
        rawData !== null &&
        typeof (rawData as { datatype?: string }).datatype === 'string'
      ) {
        inst._datatype = (rawData as { datatype: string }).datatype;
      }
      decorateDenseInstance(inst, wrapperProto);
      return inst;
    },
    apply() {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    },
  }) as MatrixCtor;

  const nativeCreate = (NativeDense.prototype as { create: unknown }).create as (
    this: MatrixLike,
    data: unknown,
    datatype?: string
  ) => MatrixLike;
  (wrapperProto as Record<string, unknown>).create = function createWrapped(
    this: MatrixLike,
    data: unknown,
    datatype?: string
  ): unknown {
    // mathjs `reduce` skips `create` when the reduced value is a scalar (#1785).
    if (data !== null && data !== undefined && !Array.isArray(data) && typeof data !== 'object') {
      return data;
    }
    const result =
      data === undefined
        ? (new Wrapped(undefined, datatype) as MatrixLike)
        : isCompatMatrix(data, helpers.checks) ||
            (typeof data === 'object' &&
              data !== null &&
              isArray((data as { data?: unknown }).data) &&
              isArray((data as { size?: unknown }).size))
          ? (new Wrapped(data, datatype) as MatrixLike)
          : (nativeCreate.call(this, data, datatype) as MatrixLike);
    decorateDenseInstance(result as MatrixLike & Record<string, unknown>, wrapperProto);
    return result;
  };
  if (
    typeof (NativeDense.prototype as { createDenseMatrix?: unknown }).createDenseMatrix ===
    'function'
  ) {
    const nativeCreateDenseMatrix = (
      NativeDense.prototype as {
        createDenseMatrix: (opts: {
          data: unknown;
          size: number[];
          datatype?: string;
        }) => MatrixLike;
      }
    ).createDenseMatrix;
    (wrapperProto as Record<string, unknown>).createDenseMatrix = function createDenseMatrixWrapped(
      this: MatrixLike,
      opts: { data: unknown; size: number[]; datatype?: string }
    ): MatrixLike {
      const result = nativeCreateDenseMatrix.call(this, opts);
      decorateDenseInstance(result as MatrixLike & Record<string, unknown>, wrapperProto);
      return result;
    };
  }

  if (!Reflect.get(wrapperProto, G09_MATRIX_SUBSET_PATCHED)) {
    const g09Sample = Reflect.construct(NativeDense, [[]]) as MatrixLike & Record<string, unknown>;
    decorateDenseInstance(g09Sample, wrapperProto);
    installG09BridgeMatrixSubsetPatch(g09Sample);
    Object.defineProperty(wrapperProto, G09_MATRIX_SUBSET_PATCHED, { value: true });
  }

  (Wrapped as { fromJSON?: unknown }).fromJSON = function fromJSON(json: {
    data: unknown;
    size: number[];
    datatype?: string;
  }): MatrixLike {
    return new Wrapped(json, json.datatype) as MatrixLike;
  };

  return Wrapped;
}

/** Wraps the mathjs FibonacciHeap constructor for compat type/layout parity (#1785). */
export function wrapCompatFibonacciHeapClass(NativeFibonacci: MatrixCtor): MatrixCtor {
  return newOperatorGuard(NativeFibonacci as unknown as CompatClass) as MatrixCtor;
}

const IMMUTABLE_METHODS_ON_DENSE = [
  'subset',
  'toJSON',
  'resize',
  'reshape',
  'set',
  'swapRows',
  'min',
  'max',
] as const;

function patchCompatImmutableDensePrototype(
  NativeImmutable: MatrixCtor,
  denseWrapperProto: object,
  ImmutableCtor: MatrixCtor
): object {
  const nativeProto = NativeImmutable.prototype as Record<string, unknown>;
  const denseProto = denseWrapperProto as Record<string, unknown>;
  const immutableProto = Object.create(nativeProto) as Record<string, unknown>;
  if (typeof denseProto.get === 'function') {
    immutableProto.get = denseProto.get;
  }
  for (const key of IMMUTABLE_METHODS_ON_DENSE) {
    if (key === 'subset') continue;
    const method = nativeProto[key];
    if (typeof method === 'function') {
      immutableProto[key] = method;
    }
  }
  const denseSubset = denseProto.subset as (
    index: unknown,
    replacement?: unknown,
    defaultValue?: unknown
  ) => unknown;
  immutableProto.subset = function subsetImmutableWrapped(
    this: MatrixLike,
    index: unknown,
    replacement?: unknown,
    defaultValue?: unknown
  ): unknown {
    switch (arguments.length) {
      case 1:
        break;
      case 2:
      case 3:
        if (arguments.length >= 2 && replacement !== undefined) {
          throw new Error('Cannot invoke set subset on an Immutable Matrix instance');
        }
        break;
      default:
        throw new SyntaxError('Wrong number of arguments');
    }
    const result = denseSubset.call(this, index, replacement, defaultValue);
    if (result && typeof result === 'object' && (result as { isMatrix?: boolean }).isMatrix) {
      const m = result as MatrixLike;
      const imm = Reflect.construct(ImmutableCtor, [m.toArray(), m._datatype]) as MatrixLike &
        Record<string, unknown>;
      decorateDenseInstance(imm, immutableProto);
      return imm;
    }
    return result;
  };
  Object.defineProperty(immutableProto, 'type', {
    value: 'ImmutableDenseMatrix',
    enumerable: true,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(immutableProto, 'isImmutableDenseMatrix', {
    value: true,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return immutableProto;
}

function immutableConstructorArgs(argArray: unknown[]): unknown[] {
  const [data, datatype] = argArray;
  if (
    data &&
    typeof data === 'object' &&
    (data as { isMatrix?: boolean }).isMatrix === true &&
    !Array.isArray(data) &&
    !('data' in (data as object) && 'size' in (data as object))
  ) {
    const source = data as MatrixLike & { toArray(): unknown; size(): number[] };
    const next: unknown[] = [source.toArray()];
    if (datatype !== undefined) next.push(datatype);
    else if (source._datatype !== undefined) next.push(source._datatype);
    return next;
  }
  return argArray;
}

/** Wraps immutable dense matrices with compat subset and iterator rules (#1785). */
export function wrapCompatImmutableDenseMatrixClass(
  NativeImmutable: MatrixCtor,
  denseWrapperProto: object
): MatrixCtor {
  const Guarded = newOperatorGuard(NativeImmutable as unknown as CompatClass) as MatrixCtor;
  const immutableProto = patchCompatImmutableDensePrototype(
    NativeImmutable,
    denseWrapperProto,
    Guarded
  );
  Object.defineProperty(immutableProto, COMPAT_MATRIX_WRAPPER, {
    value: 'immutable',
    enumerable: false,
    configurable: true,
  });
  return new Proxy(Guarded, {
    construct(target, argArray: unknown[], newTarget) {
      const inst = Reflect.construct(
        target,
        immutableConstructorArgs(argArray),
        newTarget
      ) as MatrixLike & Record<string, unknown>;
      const [, rawDatatype] = argArray;
      if (typeof rawDatatype === 'string') {
        inst._datatype = rawDatatype;
      }
      decorateDenseInstance(inst, immutableProto);
      return inst;
    },
    apply() {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    },
  }) as MatrixCtor;
}

/** Index object accepted by compat matrix subset/resize helpers (#1785). */
export type CompatMatrixIndexLike = {
  _dimensions: unknown[];
  clone(): CompatMatrixIndexLike;
};

function isBareImmutableIndexDimension(d: unknown): boolean {
  if (typeof d !== 'object' || d === null) return false;
  if (isCompatWrappedMatrix(d)) return false;
  const m = d as {
    isMatrix?: boolean;
    type?: string;
    isImmutableDenseMatrix?: boolean;
    _size?: number[];
  };
  if (m.isMatrix !== true) return false;
  if (m.type === 'ImmutableDenseMatrix' || m.isImmutableDenseMatrix === true) return true;
  return Array.isArray(m._size) && m._size.length === 1;
}

function rewrapIndexDimensions(index: CompatMatrixIndexLike, ImmutableCtor: MatrixCtor): void {
  index._dimensions = index._dimensions.map((dim) => {
    if (!isBareImmutableIndexDimension(dim)) return dim;
    const src = dim as { toArray(): unknown[]; _datatype?: string };
    return Reflect.construct(ImmutableCtor, [src.toArray(), src._datatype]);
  });
}

/**
 * Index stores {@link ImmutableDenseMatrix} dimensions from the factory closure;
 * re-wrap them with the compat instance constructors (#1785).
 */
export function wrapCompatIndexClass(
  NativeIndex: CompatClass & (new (...args: unknown[]) => CompatMatrixIndexLike),
  ImmutableDenseMatrix: MatrixCtor
): typeof NativeIndex {
  const Guarded = newOperatorGuard(NativeIndex) as typeof NativeIndex;
  const Wrapped = new Proxy(Guarded, {
    construct(_target, argArray: unknown[], newTarget) {
      const inst = Reflect.construct(NativeIndex, argArray, newTarget) as CompatMatrixIndexLike;
      rewrapIndexDimensions(inst, ImmutableDenseMatrix);
      return inst;
    },
    apply() {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    },
  }) as typeof NativeIndex;

  const nativeCreate = (
    NativeIndex as unknown as { create?: (dims: unknown[]) => CompatMatrixIndexLike }
  ).create;
  if (typeof nativeCreate === 'function') {
    (Wrapped as unknown as { create: (dims: unknown[]) => CompatMatrixIndexLike }).create = (
      dims: unknown[]
    ) => {
      const inst = nativeCreate(dims);
      rewrapIndexDimensions(inst, ImmutableDenseMatrix);
      return inst;
    };
  }

  const nativeFromJSON = (
    NativeIndex as unknown as { fromJSON?: (json: unknown) => CompatMatrixIndexLike }
  ).fromJSON;
  if (typeof nativeFromJSON === 'function') {
    (Wrapped as unknown as { fromJSON: (json: unknown) => CompatMatrixIndexLike }).fromJSON = (
      json: unknown
    ) => {
      const inst = nativeFromJSON(json);
      rewrapIndexDimensions(inst, ImmutableDenseMatrix);
      return inst;
    };
  }

  const nativeClone = NativeIndex.prototype.clone as (
    this: CompatMatrixIndexLike
  ) => CompatMatrixIndexLike;
  Wrapped.prototype.clone = function cloneIndexWrapped(
    this: CompatMatrixIndexLike
  ): CompatMatrixIndexLike {
    const copy = nativeClone.call(this);
    rewrapIndexDimensions(copy, ImmutableDenseMatrix);
    return copy;
  };

  return Wrapped;
}

/** Builds wrapped matrix constructors for `create(all)` export wiring (#1785). */
export function buildCompatMatrixWrappers<T extends Record<string, MatrixCtor>>(
  checks: MatrixChecks,
  constructors: T,
  bignumber: SparseBignumberFn
): {
  Matrix: ReturnType<typeof createCompatMatrixClass>;
  DenseMatrix: MatrixCtor;
  SparseMatrix: MatrixCtor;
  ImmutableDenseMatrix: MatrixCtor;
  FibonacciHeap: MatrixCtor;
} {
  const Matrix = createCompatMatrixClass(checks);
  const helpers: DenseHelpers = {
    checks,
    typeOf: typeName,
  };
  const denseWrapperProto = patchCompatDenseMatrixPrototype(constructors.DenseMatrix as MatrixCtor);
  const DenseMatrix = wrapCompatDenseMatrixClass(
    constructors.DenseMatrix as MatrixCtor,
    helpers,
    denseWrapperProto
  );
  const SparseMatrix = wrapCompatSparseMatrixClass(
    constructors.SparseMatrix as Parameters<typeof wrapCompatSparseMatrixClass>[0],
    bignumber
  ) as unknown as MatrixCtor;
  const ImmutableDenseMatrix = wrapCompatImmutableDenseMatrixClass(
    constructors.ImmutableDenseMatrix as MatrixCtor,
    denseWrapperProto
  );
  const FibonacciHeap = wrapCompatFibonacciHeapClass(constructors.FibonacciHeap as MatrixCtor);
  return {
    Matrix,
    DenseMatrix,
    SparseMatrix,
    ImmutableDenseMatrix,
    FibonacciHeap,
  };
}
