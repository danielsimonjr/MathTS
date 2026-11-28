/**
 * mathjs 15.3.0 matrix/statistics surface adapters for #1785 (compat-only).
 */

import { BigNumber as NativeBigNumber, isBigNumber, isFraction } from '@danielsimonjr/mathts-core';
import { deepMap, isIndex } from '@danielsimonjr/mathts-core/internal';
import { isMathjsFraction, mathjsFractionClass } from './mathjs-fraction-class.js';
import {
  inheritMatrixDatatype,
  promoteToCompatMatrix,
  type CompatMatrixCtors,
} from './compat-matrix-model.js';

type MatrixLike = {
  isMatrix?: boolean;
  storage?: () => string;
  toArray: () => unknown;
  size?: () => number[];
};

function isMatrixValue(value: unknown): value is MatrixLike {
  return typeof value === 'object' && value !== null && (value as MatrixLike).isMatrix === true;
}

function jaggedArrayHasEmptyLeaf(array: unknown[]): boolean {
  for (const row of array) {
    if (Array.isArray(row) && row.length === 0) return true;
  }
  return false;
}

/** Jagged empty inner arrays and map callback error text (#1785 map tests). */
export function createCompatMap(
  nativeMap: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  const wrapped = (...args: unknown[]): unknown => {
    try {
      if (
        args.length === 2 &&
        Array.isArray(args[0]) &&
        typeof args[1] === 'function' &&
        jaggedArrayHasEmptyLeaf(args[0])
      ) {
        const cb = args[1] as (value: unknown) => unknown;
        return deepMap(args[0], (value: unknown) => cb(value), true);
      }
      return nativeMap(...args);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('AnyFunction map')) {
        throw new TypeError(err.message.replaceAll('AnyFunction map', 'Function map'));
      }
      throw err;
    }
  };
  return wrapped;
}

function densifyMatrixFromResult(
  result: unknown,
  matrixFn: (...args: unknown[]) => unknown,
  ctors: CompatMatrixCtors
): unknown {
  if (!isMatrixValue(result)) return result;
  if (result.storage?.() === 'sparse') {
    const dense = matrixFn(result.toArray(), 'dense');
    return promoteToCompatMatrix(dense, ctors);
  }
  return promoteToCompatMatrix(result, ctors);
}

/** Sparse row/column builders return dense matrices in mathjs 15.3.0 (#1785). */
export function createCompatMatrixFromRows(
  native: (...args: unknown[]) => unknown,
  matrixFn: (...args: unknown[]) => unknown,
  ctors: CompatMatrixCtors
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    const result = native(...args);
    if (Array.isArray(result)) return result;
    return densifyMatrixFromResult(result, matrixFn, ctors);
  };
}

/** Promote `matrixFromFunction` results so iterators match mathjs DenseMatrix (#1785). */
export function createCompatMatrixFromFunction(
  native: (...args: unknown[]) => unknown,
  ctors: CompatMatrixCtors
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    const result = native(...args);
    return promoteToCompatMatrix(inheritMatrixDatatype(result, args), ctors);
  };
}

function stripTinySparseZeros(arr: unknown[][]): unknown[][] {
  return arr.map((row) =>
    row.map((cell) => {
      if (typeof cell === 'number' && Math.abs(cell) < 1e-14) return 0;
      return cell;
    })
  );
}

/** Rebuild sparse rotation matrices without IEEE dust in CSC storage (#1785). */
export function normalizeCompatRotationMatrix(
  value: unknown,
  matrixFn: (...args: unknown[]) => unknown,
  promote: (v: unknown) => unknown
): unknown {
  if (!isMatrixValue(value) || value.storage?.() !== 'sparse') {
    return promote(value);
  }
  const data = stripTinySparseZeros(value.toArray() as unknown[][]);
  return promote(matrixFn(data, 'sparse'));
}

const ABSTRACT_MATRIX_RESHAPE =
  'Cannot invoke reshape on a Matrix interface. Reshape a specific matrix implementation like DenseMatrix instead.';

/** mathjs reshape errors and BigNumber array promotion (#1785). */
export function createCompatReshape(
  native: (...args: unknown[]) => unknown,
  BigNumberClass: new (value: string | number) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (
      args.length >= 1 &&
      typeof args[0] === 'object' &&
      args[0] !== null &&
      (args[0] as { isMatrix?: boolean; constructor?: { name?: string } }).isMatrix === true &&
      (args[0] as { constructor?: { name?: string } }).constructor?.name === 'Matrix'
    ) {
      throw new TypeError(ABSTRACT_MATRIX_RESHAPE);
    }
    const normalizeInput = (x: unknown): unknown => {
      if (!Array.isArray(x)) return x;
      let hasBn = false;
      const walk = (entry: unknown): void => {
        if (Array.isArray(entry)) entry.forEach(walk);
        else if (isBigNumber(entry)) hasBn = true;
      };
      walk(x);
      if (!hasBn) return x;
      const mapBn = (entry: unknown): unknown =>
        Array.isArray(entry)
          ? entry.map(mapBn)
          : isBigNumber(entry)
            ? new BigNumberClass((entry as { toString(): string }).toString())
            : typeof entry === 'number'
              ? new BigNumberClass(entry)
              : entry;
      return mapBn(x);
    };
    const normalizeSizes = (sizes: unknown): unknown => {
      if (Array.isArray(sizes)) {
        return sizes.map((dim) => {
          if (isBigNumber(dim)) return Number((dim as { toString(): string }).toString());
          if (dim && typeof dim === 'object' && 'isBigNumber' in (dim as object)) {
            return Number((dim as { toString(): string }).toString());
          }
          return dim;
        });
      }
      if (
        typeof sizes === 'object' &&
        sizes !== null &&
        (sizes as { isMatrix?: boolean }).isMatrix === true &&
        typeof (sizes as { toArray?: () => unknown }).toArray === 'function'
      ) {
        const arr = (sizes as { toArray(): unknown[] }).toArray();
        return normalizeSizes(arr);
      }
      return sizes;
    };
    const callArgs = args.map((a, i) => {
      if (i === 0) return normalizeInput(a);
      if (i === 1) return normalizeSizes(a);
      return a;
    });
    try {
      return native(...callArgs);
    } catch (err) {
      if (err instanceof TypeError) {
        const msg = err.message;
        if (msg.includes('Invalid size for dimension')) {
          if (msg.includes('no number') || callArgs.some((a) => a === null || a === undefined)) {
            throw new TypeError('Cannot convert "undefined" to a number');
          }
        }
        if (msg.startsWith('Unexpected type of argument in function reshape')) {
          throw new TypeError(ABSTRACT_MATRIX_RESHAPE);
        }
      }
      throw err;
    }
  };
}

type InstanceBigNumberCtor = new (value: string | number) => unknown;

function isInstanceBigNumber(
  value: unknown,
  BigNumberClass: InstanceBigNumberCtor
): value is InstanceType<InstanceBigNumberCtor> {
  return typeof value === 'object' && value !== null && value instanceof BigNumberClass;
}

function isBigNumberLike(
  value: unknown,
  BigNumberClass: InstanceBigNumberCtor
): value is InstanceType<InstanceBigNumberCtor> | NativeBigNumber {
  return (
    value instanceof NativeBigNumber ||
    isInstanceBigNumber(value, BigNumberClass) ||
    isBigNumber(value)
  );
}

function toNativeBigNumber(
  value: unknown,
  BigNumberClass: InstanceBigNumberCtor
): NativeBigNumber | unknown {
  if (value instanceof NativeBigNumber) return value;
  if (isBigNumberLike(value, BigNumberClass)) {
    return new NativeBigNumber((value as { toString(): string }).toString());
  }
  return value;
}

/**
 * Instance BigNumber is not always typed as `BigNumber`; fix boolean `includeEnd`
 * arity and promote number/ Fraction endpoints for mathjs `range` (#1785).
 */
function coerceRangeEndpoint(
  value: unknown,
  BigNumberClass: InstanceBigNumberCtor,
  toFraction: (value: unknown) => unknown
): unknown {
  if (isInstanceBigNumber(value, BigNumberClass)) {
    return new NativeBigNumber((value as { toString(): string }).toString());
  }
  if (typeof value === 'number') return toFraction(value);
  if (isMathjsFraction(value) || isFraction(value)) return value;
  return value;
}

/** Typed-function dispatch for `range` with BigNumber endpoints and `includeEnd` (#1785). */
export function createCompatRangeDispatch(
  native: (...args: unknown[]) => unknown,
  BigNumberClass: InstanceBigNumberCtor,
  toFraction: (value: unknown) => unknown,
  loopDeps?: RangeLoopDeps
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    const coerced = args.map((entry) => {
      if (typeof entry === 'boolean') return entry;
      if (isInstanceBigNumber(entry, BigNumberClass)) {
        return new NativeBigNumber((entry as { toString(): string }).toString());
      }
      return entry;
    });
    const last = coerced[coerced.length - 1];
    if (typeof last === 'boolean') {
      const includeEnd = last;
      const head = coerced.slice(0, -1).map((entry) => toNativeBigNumber(entry, BigNumberClass));
      if (head.length >= 2 && head.every((x) => isBigNumberLike(x, BigNumberClass))) {
        const nativeHead = head.map((x) => toNativeBigNumber(x, BigNumberClass));
        if (head.length === 2) {
          const result = native(nativeHead[0], nativeHead[1], new NativeBigNumber(1), includeEnd);
          if (includeEnd && loopDeps) {
            const toArr = (value: unknown): unknown[] => {
              if (typeof value === 'object' && value !== null) {
                const boxed = value as { isMatrix?: boolean; toArray?: () => unknown[] };
                if (boxed.isMatrix && typeof boxed.toArray === 'function') {
                  return boxed.toArray();
                }
              }
              return Array.isArray(value) ? value : [];
            };
            const arr = toArr(result);
            const endText = String(nativeHead[1]);
            const lastText = arr.length > 0 ? String(arr[arr.length - 1]) : '';
            if (lastText !== endText) {
              return loopDeps.matrixOut([...arr, nativeHead[1]]);
            }
          }
          return result;
        }
        return native(...nativeHead, includeEnd);
      }
    }
    const hasFraction = (entry: unknown): boolean => isMathjsFraction(entry) || isFraction(entry);
    if (coerced.some(hasFraction)) {
      let params: unknown[] = coerced.filter((entry) => typeof entry !== 'boolean');
      let includeEnd = false;
      if (typeof coerced[coerced.length - 1] === 'boolean') {
        includeEnd = coerced[coerced.length - 1] as boolean;
        params = coerced.slice(0, -1).filter((entry) => typeof entry !== 'boolean');
      }
      const promoted = params.map((entry) =>
        coerceRangeEndpoint(entry, BigNumberClass, toFraction)
      );
      if (promoted.length === 2) {
        promoted.push(new mathjsFractionClass(1));
      }
      if (loopDeps) {
        return buildCompatMathjsRangeArray(promoted, includeEnd, loopDeps);
      }
      return includeEnd ? native(...promoted, includeEnd) : native(...promoted);
    }
    return native(...coerced);
  };
}

/** `concat` accepts a BigNumber axis index like mathjs 15.3.0 (#1785). */
export function createCompatConcat(
  native: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length === 0) return native(...args);
    const last = args[args.length - 1];
    if (
      isBigNumber(last) ||
      (typeof last === 'object' &&
        last !== null &&
        ((last as { isBigNumber?: boolean; type?: string }).isBigNumber === true ||
          (last as { type?: string }).type === 'BigNumber'))
    ) {
      const dim = Number((last as { toString(): string }).toString());
      return native(...args.slice(0, -1), dim);
    }
    return native(...args);
  };
}

/** When `defaultValue` is omitted, do not forward `undefined` to `subset` (#1785). */
export function forwardSubsetArgs(
  subset: (...args: unknown[]) => unknown,
  ...callArgs: unknown[]
): unknown {
  switch (callArgs.length) {
    case 1:
      return subset(callArgs[0]);
    case 2:
      return subset(callArgs[0], callArgs[1]);
    case 3:
      return subset(callArgs[0], callArgs[1], callArgs[2]);
    case 4:
      return subset(callArgs[0], callArgs[1], callArgs[2], callArgs[3]);
    default:
      return subset(...callArgs);
  }
}

type LegacySubsetIndex = { isScalar(): boolean; size(): number[] };

/** Adjusts subset GET results for legacy vs modern matrix scalar promotion (#1785). */
export function applyCompatLegacySubsetGet(
  result: unknown,
  index: unknown,
  legacySubset: boolean,
  matrixFromScalar: (value: unknown) => unknown
): unknown {
  if (!legacySubset && isIndex(index)) {
    const idx = index as unknown as LegacySubsetIndex;
    if (!idx.isScalar()) {
      const scalar = result === null || typeof result !== 'object';
      const matrixScalar =
        scalar &&
        (typeof result === 'number' ||
          typeof result === 'bigint' ||
          isBigNumber(result) ||
          (typeof result === 'object' && result !== null && 'isBigNumber' in (result as object)));
      if (matrixScalar) {
        return matrixFromScalar(result);
      }
    }
  }
  if (legacySubset && isIndex(index)) {
    const idx = index as unknown as LegacySubsetIndex;
    if (idx.size().every((n) => n === 1)) {
      if (
        typeof result === 'object' &&
        result !== null &&
        (result as { isMatrix?: boolean }).isMatrix === true
      ) {
        const data = (result as { toArray(): unknown }).toArray();
        if (Array.isArray(data)) {
          if (data.length === 1 && Array.isArray(data[0]) && data[0].length === 1) {
            return data[0][0];
          }
          if (data.length === 1 && !Array.isArray(data[0])) {
            return data[0];
          }
        }
      }
    }
  }
  return result;
}

function isScalarIndexDimension(dim: unknown): boolean {
  return typeof dim === 'number' || typeof dim === 'bigint';
}

function toFlatVectorData(data: unknown): unknown[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  if (!Array.isArray(data[0])) return data;
  if (data.length === 1 && Array.isArray(data[0])) return data[0] as unknown[];
  if (data.every((row) => Array.isArray(row) && row.length === 1)) {
    return data.map((row) => (row as unknown[])[0]);
  }
  return null;
}

/** Match mathjs 15.3.0 `subset` GET matrix shapes for legacy vs modern (#1785). */
export function applySubsetGetMatrixShape(
  result: unknown,
  index: unknown,
  legacy: boolean,
  matrix: (data: unknown) => unknown
): unknown {
  if (!isIndex(index)) return result;
  const sizes = (index as unknown as LegacySubsetIndex).size();
  if (
    typeof result === 'object' &&
    result !== null &&
    (result as MatrixLike).isMatrix === true &&
    typeof (result as MatrixLike).size === 'function'
  ) {
    const resultSize = ((result as MatrixLike).size as () => number[]).call(result);
    if (
      resultSize.length === sizes.length &&
      resultSize.every((dim: number, i: number) => dim === sizes[i])
    ) {
      return result;
    }
  }
  const dims = (index as { _dimensions?: unknown[] })._dimensions;
  const raw =
    typeof result === 'object' && result !== null && (result as MatrixLike).isMatrix
      ? (result as MatrixLike).toArray()
      : result;
  const flat = toFlatVectorData(raw);
  if (!flat || sizes.length !== 2 || !Array.isArray(dims)) {
    return result;
  }
  if (legacy) {
    if (sizes[0] === 1 && sizes[1] > 1 && isScalarIndexDimension(dims[0])) {
      return matrix([flat]);
    }
    if (sizes[0] > 1 && sizes[1] === 1 && isScalarIndexDimension(dims[1])) {
      return matrix(flat.map((value) => [value]));
    }
    return result;
  }
  if (sizes[0] === 1 && sizes[1] > 1 && isScalarIndexDimension(dims[0])) {
    return matrix(flat);
  }
  if (sizes[0] > 1 && sizes[1] === 1 && isScalarIndexDimension(dims[1])) {
    return matrix(flat);
  }
  return result;
}

type RangeLoopDeps = {
  add: (a: unknown, b: unknown) => unknown;
  smaller: (a: unknown, b: unknown) => boolean;
  smallerEq: (a: unknown, b: unknown) => boolean;
  larger: (a: unknown, b: unknown) => boolean;
  largerEq: (a: unknown, b: unknown) => boolean;
  isPositive: (x: unknown) => boolean;
  isZero: (x: unknown) => boolean;
  matrixOut: (values: unknown[]) => unknown;
};

function buildCompatMathjsRangeArray(
  params: unknown[],
  includeEnd: boolean,
  deps: RangeLoopDeps
): unknown {
  const head = params.slice();
  while (head.length < 3) {
    head.push(1);
  }
  const [start, end, step] = head;
  const stepZero =
    isMathjsFraction(step) || isFraction(step)
      ? Number((step as { valueOf(): number }).valueOf()) === 0
      : deps.isZero(step);
  if (stepZero) {
    throw new Error('Step must be non-zero');
  }
  const stepPositive =
    isMathjsFraction(step) || isFraction(step)
      ? Number((step as { valueOf(): number }).valueOf()) > 0
      : deps.isPositive(step);
  const ongoing = stepPositive
    ? includeEnd
      ? (x: unknown, y: unknown) => deps.smallerEq(x, y)
      : (x: unknown, y: unknown) => deps.smaller(x, y)
    : includeEnd
      ? (x: unknown, y: unknown) => deps.largerEq(x, y)
      : (x: unknown, y: unknown) => deps.larger(x, y);
  const array: unknown[] = [];
  let value = start;
  while (ongoing(value, end)) {
    array.push(value);
    value = deps.add(value, step);
  }
  return deps.matrixOut(array);
}

/** Throw mathjs's range error when a BigNumber step is zero (#1785). */
export function guardCompatRangeZeroStep(
  native: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length >= 3 && isBigNumber(args[2])) {
      const step = args[2] as { isZero(): boolean };
      if (step.isZero()) {
        throw new Error('Step must be non-zero');
      }
    }
    return native(...args);
  };
}

function isStatisticsScalarOperand(value: unknown): boolean {
  if (Array.isArray(value)) return false;
  return !(typeof value === 'object' && value !== null && (value as MatrixLike).isMatrix === true);
}

function needsMixedTypeVariadicReducer(args: unknown[]): boolean {
  if (args.length < 2 || !args.every(isStatisticsScalarOperand)) return false;
  let hasBigint = false;
  let hasNumeric = false;
  for (const arg of args) {
    if (typeof arg === 'bigint') hasBigint = true;
    else if (
      typeof arg === 'number' ||
      isBigNumber(arg) ||
      isFraction(arg) ||
      isMathjsFraction(arg)
    ) {
      hasNumeric = true;
    } else {
      return false;
    }
  }
  return hasBigint && hasNumeric;
}

/** Route heterogeneous scalar lists to the functions-layer reducer (#1785). */
export function withMixedTypeVariadicMaxMin(
  fn: (...args: unknown[]) => unknown,
  nativeScalar: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (needsMixedTypeVariadicReducer(args)) {
      return nativeScalar(...args);
    }
    return fn(...args);
  };
}

/** Variadic max/min with bigint / number / BigNumber / Fraction (#1785). */
/** bigint-config max/min over numeric strings (#1785). */
export function createCompatBigintStatisticsReducer(
  preferMax: boolean,
  getNumberMode: () => string
): (...args: unknown[]) => unknown {
  const pick = createCompatMixedTypeReducer(
    preferMax ? (a, b) => compareMixedTypes(a, b) > 0 : (a, b) => compareMixedTypes(a, b) < 0,
    preferMax
  );
  return (...args: unknown[]): unknown => {
    if (getNumberMode() !== 'bigint') {
      return args.length === 1 ? args[0] : pick(...args);
    }
    const parsed = args.map((arg) => {
      if (typeof arg === 'string' && arg.trim() !== '') {
        const n = Number(arg);
        if (Number.isNaN(n)) return arg;
        if (Number.isInteger(n)) return BigInt(n);
        return n;
      }
      return arg;
    });
    if (parsed.length === 1) return parsed[0];
    return pick(...parsed);
  };
}

/** mathjs-ordered compare for heterogeneous numeric-ish arguments (#1785). */
export function compareMixedTypes(a: unknown, b: unknown): number {
  const asNum = (x: unknown): number | null => {
    if (typeof x === 'number') return x;
    if (typeof x === 'bigint') return Number(x);
    if (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x))) return Number(x);
    if (isBigNumber(x) || (typeof x === 'object' && x !== null && 'isBigNumber' in (x as object))) {
      return Number((x as { toString(): string }).toString());
    }
    if (isFraction(x) || isMathjsFraction(x)) {
      return Number((x as { valueOf(): number }).valueOf());
    }
    return null;
  };
  const aa = asNum(a);
  const bb = asNum(b);
  if (aa !== null && bb !== null) {
    if (aa === bb) return 0;
    return aa > bb ? 1 : -1;
  }
  throw new Error('Invalid argument');
}

/** Builds variadic `max`/`min`-style reducers over mixed numeric types (#1785). */
export function createCompatMixedTypeReducer(
  order: (a: unknown, b: unknown) => boolean,
  preferMax: boolean
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length === 0) {
      return preferMax ? -Infinity : Infinity;
    }
    if (args.length === 1) return args[0];
    let best = args[0];
    for (let i = 1; i < args.length; i++) {
      if (order(args[i], best)) best = args[i];
    }
    return best;
  };
}

/** `sum([])` is zero in the active number type (#1785). */
export function createCompatEmptySum(
  native: (...args: unknown[]) => unknown,
  getNumberMode: () => string,
  BigNumberClass: new (value: string | number) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length === 1 && Array.isArray(args[0]) && args[0].length === 0) {
      const mode = getNumberMode();
      if (mode === 'BigNumber') return new BigNumberClass(0);
      if (mode === 'Fraction') return new mathjsFractionClass(0);
      return 0;
    }
    return native(...args);
  };
}

/** Rewrite typed “unexpected type” errors for `sum` invalid args (#1785). */
export function createCompatSum(
  native: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    try {
      return native(...args);
    } catch (err) {
      if (err instanceof TypeError) {
        const msg = err.message;
        if (msg.includes('Unexpected type of argument')) {
          throw new TypeError('Cannot calculate sum, unexpected type of argument');
        }
      }
      throw err;
    }
  };
}
