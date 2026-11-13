/**
 * Sparse shape adapter for the mathjs-derived factory functions.
 *
 * Two classes carry the typed name `SparseMatrix`:
 *  - `SparseMatrix` of `@danielsimonjr/mathts-matrix` (public, CSR, `Float64Array` storage);
 *  - `MathJSSparseMatrix` (CSC with `size()`, `_index`, `_ptr`, `_values`, `density()`), the
 *    form that the factory sparse algorithms read.
 *
 * The factory functions work on the CSC form only. This module converts at the factory
 * boundary: a public CSR argument becomes CSC on entry, and a CSC result becomes CSR on exit
 * when a CSR argument was present (sparse in, sparse out). Nothing inside a factory sees CSR.
 */

import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { MathJSDenseMatrix, MathJSSparseMatrix } from './matrix-bridge.js';

/** True for the public CSR `SparseMatrix` (typed name `SparseMatrix`, no `size()` method). */
export function isCsrSparse(x: unknown): x is SparseMatrix {
  return x instanceof SparseMatrix;
}

/** Convert the public CSR `SparseMatrix` to the CSC form. Exact zeros are dropped. */
export function csrToCsc(m: SparseMatrix): MathJSSparseMatrix {
  const { rows, cols } = m;
  const { values, colIndices, rowPointers } = m.getCSR();
  const count = new Array<number>(cols + 1).fill(0);
  for (let k = 0; k < values.length; k++) {
    if (values[k] !== 0) count[colIndices[k] + 1]++;
  }
  for (let j = 0; j < cols; j++) count[j + 1] += count[j];
  const ptr = count.slice();
  const nnz = ptr[cols];
  const outValues = new Array<number>(nnz);
  const outIndex = new Array<number>(nnz);
  const next = ptr.slice(0, cols);
  for (let i = 0; i < rows; i++) {
    for (let k = rowPointers[i]; k < rowPointers[i + 1]; k++) {
      if (values[k] === 0) continue;
      const dest = next[colIndices[k]]++;
      outValues[dest] = values[k];
      outIndex[dest] = i;
    }
  }
  return new MathJSSparseMatrix({ values: outValues, index: outIndex, ptr, size: [rows, cols] });
}

/**
 * Convert a CSC result to the public CSR `SparseMatrix`. Returns `undefined` when the CSC
 * matrix holds a value that `Float64Array` cannot store (boolean, Complex, BigNumber,
 * Fraction) or is a pattern matrix; the caller then keeps the CSC result.
 */
export function cscToCsr(m: MathJSSparseMatrix): SparseMatrix | undefined {
  const values = m._values;
  if (values === null) return undefined;
  for (let k = 0; k < values.length; k++) {
    if (typeof values[k] !== 'number') return undefined;
  }
  const [rows, cols] = m._size;
  const count = new Array<number>(rows + 1).fill(0);
  for (let k = 0; k < values.length; k++) {
    if (values[k] !== 0) count[m._index[k] + 1]++;
  }
  for (let i = 0; i < rows; i++) count[i + 1] += count[i];
  const nnz = count[rows];
  const outValues = new Array<number>(nnz);
  const outCols = new Array<number>(nnz);
  const next = count.slice(0, rows);
  for (let j = 0; j < cols; j++) {
    for (let k = m._ptr[j]; k < m._ptr[j + 1]; k++) {
      if (values[k] === 0) continue;
      const dest = next[m._index[k]]++;
      outValues[dest] = values[k] as number;
      outCols[dest] = j;
    }
  }
  return new SparseMatrix(rows, cols, outValues, outCols, count);
}

function toCsrDeep(x: unknown): unknown {
  if (x instanceof MathJSSparseMatrix) return cscToCsr(x) ?? x;
  if (Array.isArray(x)) {
    let changed = false;
    const out = x.map((e) => {
      const r = toCsrDeep(e);
      if (r !== e) changed = true;
      return r;
    });
    return changed ? out : x;
  }
  if (x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
    const src = x as Record<string, unknown>;
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      out[key] = toCsrDeep(src[key]);
      if (out[key] !== src[key]) changed = true;
    }
    return changed ? out : x;
  }
  return x;
}

const WRONG_TYPE = /^Unexpected type of argument|^SparseMatrix is not supported by function/;

/**
 * Wrap a typed function so that it accepts the public CSR `SparseMatrix`.
 * Arguments without a CSR matrix pass through untouched.
 */
export function adaptSparse<F extends (...args: never[]) => unknown>(fn: F, name: string): F {
  return new Proxy(fn, {
    apply(target, thisArg, args: unknown[]) {
      let adapted: unknown[] | undefined;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a !== null && typeof a === 'object' && isCsrSparse(a)) {
          adapted ??= args.slice();
          adapted[i] = csrToCsc(a);
        }
      }
      if (adapted === undefined) return Reflect.apply(target, thisArg, args);
      // A call that mixes the public sparse and dense classes needs both in the factory form.
      for (let i = 0; i < adapted.length; i++) {
        const a = adapted[i];
        if (a instanceof DenseMatrix) adapted[i] = MathJSDenseMatrix.fromNative(a);
      }
      let result: unknown;
      try {
        result = Reflect.apply(target, thisArg, adapted);
      } catch (e) {
        if (e instanceof Error && WRONG_TYPE.test(e.message)) {
          throw new TypeError(
            `${name} does not accept a SparseMatrix (CSR) for this signature: ${e.message} ` +
              `Convert the argument with toDense() first, for example ${name}(m.toDense(), ...).`,
            { cause: e }
          );
        }
        throw e;
      }
      return toCsrDeep(result);
    },
  });
}

/** True when a typed function declares a matrix type in any signature. */
export function acceptsMatrix(fn: unknown): boolean {
  const sigs = (fn as { signatures?: Record<string, unknown> }).signatures;
  if (!sigs) return false;
  for (const key of Object.keys(sigs)) {
    if (key.includes('Matrix')) return true;
  }
  return false;
}
