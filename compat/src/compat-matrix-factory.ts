/**
 * mathjs 15.3.0 `matrix` / `sparse` factory arity and overload routing (#1785).
 */

import { isUnit } from '@danielsimonjr/mathts-core';
import { clone } from '@danielsimonjr/mathts-core/internal';
import {
  SparseMatrix as NativeSparseMatrix,
  isDenseMatrix,
  isSparseMatrix,
  type DenseMatrix as NativeDenseInstance,
  type SparseMatrix as NativeSparseInstance,
} from '@danielsimonjr/mathts-matrix';
import { tooManyArgumentsError } from './mathjs-parity-g02.js';
import {
  isCompatWrappedMatrix,
  promoteToCompatMatrix,
  readMatrixDatatype,
  stampMatrixDatatype,
  type CompatMatrixCtors,
} from './compat-matrix-model.js';

function promoteMatrix(value: unknown, ctors: CompatMatrixCtors, datatype?: string): unknown {
  const out = promoteToCompatMatrix(value, ctors);
  const dt = datatype ?? readMatrixDatatype(value);
  if (dt !== undefined) stampMatrixDatatype(out, dt);
  return out;
}

type MatrixFn = (...args: unknown[]) => unknown;
type SparseFn = (...args: unknown[]) => unknown;

function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'Array';
  return (value as { constructor?: { name?: string } }).constructor?.name ?? typeof value;
}

function isCompatMatrixValue(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if ((value as { isMatrix?: boolean }).isMatrix === true) return true;
  return isDenseMatrix(value) || isSparseMatrix(value);
}

function isNativeMathtsMatrix(value: unknown): boolean {
  return (isDenseMatrix(value) || isSparseMatrix(value)) && !isCompatWrappedMatrix(value);
}

function convertNativeMatrixFormat(
  data: unknown,
  parsed: 'sparse' | 'dense' | undefined,
  ctors: CompatMatrixCtors
): unknown {
  if (isSparseMatrix(data)) {
    if (parsed === undefined || parsed === 'sparse') return data;
    return (data as NativeSparseInstance).toDense();
  }
  if (isDenseMatrix(data)) {
    if (parsed === undefined || parsed === 'dense') return data;
    if (parsed === 'sparse') {
      return promoteMatrix(NativeSparseMatrix.fromDense(data as NativeDenseInstance), ctors);
    }
  }
  return data;
}

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

function rejectInvalidMatrixArg(fn: 'matrix' | 'sparse', value: unknown): void {
  if (value instanceof Date || isUnit(value)) {
    throw new TypeError(
      `Unexpected type of argument in function ${fn} (expected: Array or Matrix, actual: ${value === null ? 'null' : ((value as { constructor?: { name?: string } }).constructor?.name ?? typeof value)}, index: 0)`
    );
  }
}

/**
 * Route `matrix()` calls like mathjs typed dispatch (empty / format-only / data / clone).
 */
export function createCompatMatrixFactory(
  factoryMatrix: MatrixFn,
  ctors: CompatMatrixCtors
): MatrixFn {
  const { DenseMatrix, SparseMatrix } = ctors;
  const wrapped: MatrixFn = function compatMatrix(...args: unknown[]): unknown {
    const data = args[0];
    const format = args[1];
    const datatype = typeof args[2] === 'string' ? args[2] : undefined;
    if (args.length > 3) {
      throw tooManyArgumentsError('matrix', 3, args.length);
    }
    if (args.length === 0) {
      return promoteMatrix(new DenseMatrix([]), ctors);
    }
    if (
      args.length === 1 &&
      typeof data === 'string' &&
      (data === 'dense' || data === 'sparse' || data === 'default')
    ) {
      const fmt = data === 'sparse' ? 'sparse' : 'dense';
      return promoteMatrix(fmt === 'sparse' ? new SparseMatrix([]) : new DenseMatrix([]), ctors);
    }
    if (
      args.length === 2 &&
      typeof data === 'string' &&
      typeof format === 'string' &&
      (data === 'dense' || data === 'sparse' || data === 'default')
    ) {
      const fmt = data === 'sparse' ? 'sparse' : 'dense';
      return promoteMatrix(
        fmt === 'sparse' ? new SparseMatrix([], format) : new DenseMatrix([], format),
        ctors,
        format
      );
    }
    if (args.length === 1 && isCompatMatrixValue(data)) {
      if (isCompatWrappedMatrix(data) || isNativeMathtsMatrix(data)) {
        return data;
      }
    }
    if (args.length === 1) {
      rejectInvalidMatrixArg('matrix', data);
    }
    if (isCompatMatrixValue(data) && args.length === 2) {
      if (format === undefined && (isCompatWrappedMatrix(data) || isNativeMathtsMatrix(data))) {
        return data;
      }
      const parsed = matrixFormat(format);
      if (isNativeMathtsMatrix(data)) {
        return convertNativeMatrixFormat(data, parsed, ctors);
      }
      const storage = (data as { storage?: () => string }).storage?.();
      const srcDatatype = (data as { _datatype?: string; datatype?: () => string })._datatype;
      const dt =
        datatype ??
        srcDatatype ??
        (typeof (data as { datatype?: () => string }).datatype === 'function'
          ? (data as { datatype: () => string }).datatype()
          : undefined);
      const arr = clone((data as { toArray(): unknown }).toArray() as never);
      const size = clone((data as { size(): number[] }).size());
      if (parsed === 'sparse' || (parsed === undefined && storage === 'sparse')) {
        const copied = new SparseMatrix({ data: arr, size }, dt);
        return promoteMatrix(copied, ctors, dt);
      }
      const copied = new DenseMatrix({ data: arr, size }, dt);
      return promoteMatrix(copied, ctors, dt);
    }
    if (datatype !== undefined) {
      return promoteMatrix(factoryMatrix(data, format, datatype), ctors, datatype);
    }
    return promoteMatrix(factoryMatrix(data, format), ctors);
  };
  return wrapped;
}

/**
 * Route `sparse()` calls like mathjs typed dispatch.
 */
export function createCompatSparseFactory(
  factorySparse: SparseFn,
  ctors: CompatMatrixCtors
): SparseFn {
  const { SparseMatrix } = ctors;
  const wrapped: SparseFn = function compatSparse(...args: unknown[]): unknown {
    const data = args[0];
    const datatype = typeof args[1] === 'string' ? args[1] : undefined;
    if (args.length > 2) {
      throw tooManyArgumentsError('sparse', 2, args.length);
    }
    if (args.length === 0) {
      return promoteMatrix(new SparseMatrix([]), ctors);
    }
    if (args.length === 1 && typeof data === 'string') {
      return promoteMatrix(new SparseMatrix([], data), ctors, data);
    }
    if (args.length === 1 && isCompatMatrixValue(data)) {
      if (isCompatWrappedMatrix(data) || isNativeMathtsMatrix(data)) {
        return data;
      }
    }
    if (args.length === 1) {
      rejectInvalidMatrixArg('sparse', data);
    }
    if (isCompatMatrixValue(data)) {
      const srcDatatype = (data as { _datatype?: string })._datatype;
      const dt = datatype ?? srcDatatype;
      const clone = new SparseMatrix((data as { toArray(): unknown }).toArray(), dt);
      return promoteMatrix(clone, ctors, dt);
    }
    if (datatype !== undefined) {
      return promoteMatrix(factorySparse(data, datatype), ctors, datatype);
    }
    return promoteMatrix(factorySparse(data), ctors);
  };
  return wrapped;
}
