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
import {
  NEW_OPERATOR_MESSAGE,
  newOperatorGuard,
  type CompatClass,
} from './constructors-without-new.js';
import { installG09BridgeMatrixSubsetPatch } from './mathjs-parity-g09.js';
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
    return originalSubset.call(this, index, replacement, defaultValue);
  };

  const originalGet = nativeProto.get as (index: unknown, col?: unknown) => unknown;
  wrapperProto.get = function getWrapped(this: MatrixLike, index: unknown): unknown {
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
    return target;
  };

  const originalToJSON = nativeProto.toJSON as () => Record<string, unknown>;
  wrapperProto.toJSON = function toJSONWrapped(this: MatrixLike): Record<string, unknown> {
    const json = originalToJSON.call(this) as Record<string, unknown>;
    json.datatype = this._datatype;
    return json;
  };

  const originalClone = nativeProto.clone as () => DenseInstance;
  wrapperProto.clone = function cloneWrapped(this: MatrixLike): MatrixLike {
    const c = originalClone.call(this);
    decorateDenseInstance(c, wrapperProto);
    return c;
  };

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
    return [{ data: block.data, size: block.size }];
  }
  if (isArray(data)) {
    const processed = preprocessMatrixData(data, helpers.checks);
    const size = arraySize(processed as never);
    validate(processed as never, size);
    return [{ data: processed, size, datatype }];
  }
  throw new TypeError(`Unsupported type of data (${helpers.typeOf(data)})`);
}

export function wrapCompatDenseMatrixClass(
  NativeDense: MatrixCtor,
  helpers: DenseHelpers
): MatrixCtor {
  const Guarded = newOperatorGuard(NativeDense as unknown as CompatClass) as MatrixCtor;
  let Wrapped!: MatrixCtor;

  const wrapperProto = patchCompatDenseMatrixPrototype(NativeDense);

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

  (wrapperProto as Record<string, unknown>).create = function createWrapped(
    this: MatrixLike,
    data: unknown,
    datatype?: string
  ): MatrixLike {
    return new Wrapped(data, datatype) as MatrixLike;
  };
  if (
    typeof (NativeDense.prototype as { createDenseMatrix?: unknown }).createDenseMatrix ===
    'function'
  ) {
    (wrapperProto as Record<string, unknown>).createDenseMatrix = function createDenseMatrixWrapped(
      this: MatrixLike,
      opts: { data: unknown; size: number[]; datatype?: string }
    ): MatrixLike {
      return new Wrapped({ data: opts.data, size: opts.size }, opts.datatype) as MatrixLike;
    };
  }

  if (!Reflect.get(Wrapped, Symbol.for('compat.dense.patched'))) {
    Object.defineProperty(Wrapped, Symbol.for('compat.dense.patched'), { value: true });
    installG09BridgeMatrixSubsetPatch(new Wrapped());
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

export function wrapCompatFibonacciHeapClass(NativeFibonacci: MatrixCtor): MatrixCtor {
  return newOperatorGuard(NativeFibonacci as unknown as CompatClass) as MatrixCtor;
}

export function wrapCompatImmutableDenseMatrixClass(
  NativeImmutable: MatrixCtor,
  WrappedDense: MatrixCtor
): MatrixCtor {
  const Guarded = newOperatorGuard(NativeImmutable as unknown as CompatClass) as MatrixCtor;
  void WrappedDense;
  return new Proxy(Guarded, {
    construct(target, argArray: unknown[], newTarget) {
      const inst = Reflect.construct(target, argArray, newTarget) as MatrixLike &
        Record<string, unknown> & { isImmutableDenseMatrix?: boolean };
      if (inst.isImmutableDenseMatrix !== true) {
        inst.isImmutableDenseMatrix = true;
      }
      if (inst.type !== 'ImmutableDenseMatrix') {
        inst.type = 'ImmutableDenseMatrix';
      }
      inst.isMatrix = true;
      return inst;
    },
    apply() {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    },
  }) as MatrixCtor;
}

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
  const DenseMatrix = wrapCompatDenseMatrixClass(constructors.DenseMatrix as MatrixCtor, helpers);
  const SparseMatrix = wrapCompatSparseMatrixClass(
    constructors.SparseMatrix as Parameters<typeof wrapCompatSparseMatrixClass>[0],
    bignumber
  ) as unknown as MatrixCtor;
  const ImmutableDenseMatrix = wrapCompatImmutableDenseMatrixClass(
    constructors.ImmutableDenseMatrix as MatrixCtor,
    DenseMatrix
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
