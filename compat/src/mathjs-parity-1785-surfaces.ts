/**
 * mathjs 15.3.0 matrix/statistics surface adapters for #1785 (compat-only).
 */

import { isBigNumber, isFraction } from '@danielsimonjr/mathts-core';
import { isMathjsFraction } from './mathjs-fraction-class.js';
import { deepMap } from '@danielsimonjr/mathts-core/internal';
import {
  inheritMatrixDatatype,
  promoteToCompatMatrix,
  type CompatMatrixCtors,
} from './compat-matrix-model.js';
import { mathjsFractionClass } from './mathjs-fraction-class.js';

type MatrixLike = {
  isMatrix?: boolean;
  storage?: () => string;
  toArray: () => unknown;
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
    const callArgs = args.map((a, i) => (i === 0 ? normalizeInput(a) : a));
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
      const wins = preferMax ? order(args[i], best) : order(best, args[i]);
      if (wins) best = args[i];
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
          throw new Error(`Cannot calculate sum, unexpected type of argument (${msg})`);
        }
      }
      throw err;
    }
  };
}
