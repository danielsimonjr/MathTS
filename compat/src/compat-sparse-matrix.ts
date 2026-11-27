/**
 * Compat sparse helpers (#1582): valueless-Unit constructor guard only.
 * Structural-zero storage lives in native `MathJSSparseMatrix` (`functions`).
 */

import { compatDecimalResult } from './bignumber.js';
import { NEW_OPERATOR_MESSAGE, newOperatorGuard } from './constructors-without-new.js';
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
  valueOf(): unknown[][];
};

function isMatrixInput(data: unknown): data is { isMatrix?: boolean } {
  return typeof data === 'object' && data !== null && (data as { isMatrix?: boolean }).isMatrix === true;
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

type SparseConstructable = abstract new (...args: unknown[]) => SparseInstance;

/**
 * mathjs accepts `new SparseMatrix(matrix, 'BigNumber')` and exposes `zero` /
 * `valueOf()` with BigNumber entries (#1780).
 */
export function wrapCompatSparseMatrixClass(
  NativeSparse: SparseConstructable,
  bignumber: (value: unknown) => unknown
): SparseConstructable {
  const Guarded = newOperatorGuard(NativeSparse) as SparseConstructable;
  return new Proxy(Guarded, {
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
        inst._datatype = datatype;
        if (datatype === 'BigNumber') {
          if (inst._values) {
            inst._values = inst._values.map((entry) => bignumber(entry));
          }
          inst.zero = bignumber(0);
          patchSparseValueOf(inst);
        }
      } else if (isMatrixInput(data) && data) {
        const source = data as { _datatype?: string };
        if (source._datatype === 'BigNumber' || inst._datatype === 'BigNumber') {
          inst._datatype = 'BigNumber';
          if (inst._values) {
            inst._values = inst._values.map((entry) => bignumber(entry));
          }
          inst.zero = bignumber(0);
          patchSparseValueOf(inst);
        }
      }
      return inst;
    },
    apply() {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    },
  }) as SparseConstructable;
}
