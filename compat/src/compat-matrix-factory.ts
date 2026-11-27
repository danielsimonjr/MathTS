/**
 * mathjs 15.3.0 `matrix` / `sparse` factory arity and overload routing (#1785).
 */

import { isUnit } from '@danielsimonjr/mathts-core';
import { clone } from '@danielsimonjr/mathts-core/internal';
import { tooManyArgumentsError } from './mathjs-parity-g02.js';
import { promoteToCompatMatrix, type CompatMatrixCtors } from './compat-matrix-model.js';

type MatrixFn = (...args: unknown[]) => unknown;
type SparseFn = (...args: unknown[]) => unknown;

function isCompatMatrixValue(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isMatrix?: boolean }).isMatrix === true
  );
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
    const datatype = args[2];
    if (args.length > 3) {
      throw tooManyArgumentsError('matrix', 3, args.length);
    }
    if (args.length === 0) {
      return promoteToCompatMatrix(new DenseMatrix([]), ctors);
    }
    if (
      args.length === 1 &&
      typeof data === 'string' &&
      (data === 'dense' || data === 'sparse' || data === 'default')
    ) {
      const fmt = data === 'sparse' ? 'sparse' : 'dense';
      return promoteToCompatMatrix(
        fmt === 'sparse' ? new SparseMatrix([]) : new DenseMatrix([]),
        ctors
      );
    }
    if (
      args.length === 2 &&
      typeof data === 'string' &&
      typeof format === 'string' &&
      (data === 'dense' || data === 'sparse' || data === 'default')
    ) {
      const fmt = data === 'sparse' ? 'sparse' : 'dense';
      return promoteToCompatMatrix(
        fmt === 'sparse' ? new SparseMatrix([], format) : new DenseMatrix([], format),
        ctors
      );
    }
    if (args.length === 1) {
      rejectInvalidMatrixArg('matrix', data);
    }
    if (isCompatMatrixValue(data) && typeof format === 'string') {
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
      if (format === 'sparse' || (format === undefined && storage === 'sparse')) {
        const copied = new SparseMatrix({ data: arr, size }, dt);
        return promoteToCompatMatrix(copied, ctors);
      }
      const copied = new DenseMatrix({ data: arr, size }, dt);
      return promoteToCompatMatrix(copied, ctors);
    }
    if (datatype !== undefined) {
      return promoteToCompatMatrix(factoryMatrix(data, format, datatype), ctors);
    }
    return promoteToCompatMatrix(factoryMatrix(data, format), ctors);
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
    const datatype = args[1];
    if (args.length > 2) {
      throw tooManyArgumentsError('sparse', 2, args.length);
    }
    if (args.length === 0) {
      return promoteToCompatMatrix(new SparseMatrix([]), ctors);
    }
    if (args.length === 1 && typeof data === 'string') {
      return promoteToCompatMatrix(new SparseMatrix([], data), ctors);
    }
    if (args.length === 1) {
      rejectInvalidMatrixArg('sparse', data);
    }
    if (isCompatMatrixValue(data)) {
      const srcDatatype = (data as { _datatype?: string })._datatype;
      const dt = datatype ?? srcDatatype;
      const clone = new SparseMatrix((data as { toArray(): unknown }).toArray(), dt);
      return promoteToCompatMatrix(clone, ctors);
    }
    if (datatype !== undefined) {
      return promoteToCompatMatrix(factorySparse(data, datatype), ctors);
    }
    return promoteToCompatMatrix(factorySparse(data), ctors);
  };
  return wrapped;
}
