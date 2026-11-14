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
 * Output rule for a call that received a public CSR `SparseMatrix`.
 *
 * A CSC result becomes the public `SparseMatrix`: sparse in, sparse out, as in mathjs. The
 * public class stores `Float64Array`, so the entries convert as follows.
 *  - A number stays a number.
 *  - A boolean becomes 1 (true) or 0 (false). A boolean result (`equal`, `larger`, ...)
 *    thus keeps its sparse shape and its pattern, but not its boolean type. This is the
 *    closest class the storage allows: a dense boolean array would lose the sparsity.
 *  - A pattern matrix (no stored values) stores 1 for each stored position.
 *  - A Complex, BigNumber or Fraction entry cannot be stored. The result is then the nested
 *    `Array` of the same values (never the CSC class), so no value is lost.
 */
export function cscToPublic(m: MathJSSparseMatrix): SparseMatrix | unknown[][] {
  const values = m._values;
  const [rows, cols] = m._size;
  const stored = m._ptr[cols];
  const entry = new Array<number>(stored);
  for (let k = 0; k < stored; k++) {
    const v = values === null ? 1 : values[k];
    if (typeof v === 'number') entry[k] = v;
    else if (typeof v === 'boolean') entry[k] = v ? 1 : 0;
    else return m.toArray() as unknown[][];
  }
  const count = new Array<number>(rows + 1).fill(0);
  for (let k = 0; k < stored; k++) {
    if (entry[k] !== 0) count[m._index[k] + 1]++;
  }
  for (let i = 0; i < rows; i++) count[i + 1] += count[i];
  const nnz = count[rows];
  const outValues = new Array<number>(nnz);
  const outCols = new Array<number>(nnz);
  const next = count.slice(0, rows);
  for (let j = 0; j < cols; j++) {
    for (let k = m._ptr[j]; k < m._ptr[j + 1]; k++) {
      if (entry[k] === 0) continue;
      const dest = next[m._index[k]]++;
      outValues[dest] = entry[k];
      outCols[dest] = j;
    }
  }
  return new SparseMatrix(rows, cols, outValues, outCols, count);
}

function toPublicDeep(x: unknown): unknown {
  if (x instanceof MathJSSparseMatrix) return cscToPublic(x);
  if (Array.isArray(x)) {
    let changed = false;
    const out = x.map((e) => {
      const r = toPublicDeep(e);
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
      out[key] = toPublicDeep(src[key]);
      if (out[key] !== src[key]) changed = true;
    }
    return changed ? out : x;
  }
  return x;
}

/** The `data` that typed-function attaches to a signature mismatch. */
interface WrongTypeData {
  category?: string;
  fn?: string;
  index?: number;
  actual?: string[];
}

/**
 * True when `e` is the dispatch error of the wrapped function itself, for an argument that
 * this module converted from the public class. An error that an implementation raises for
 * its own nested call has another `fn` or another `index`, so it passes through unchanged.
 */
function rejectsConvertedArgument(e: unknown, name: string, converted: number[]): boolean {
  const data = (e as { data?: WrongTypeData } | null)?.data;
  return (
    data?.category === 'wrongType' &&
    data.fn === name &&
    typeof data.index === 'number' &&
    converted.includes(data.index) &&
    (data.actual?.includes('SparseMatrix') ?? false)
  );
}

/**
 * Wrap a typed function so that it accepts the public CSR `SparseMatrix`.
 *
 * The wrapper is a plain function that carries the own properties of `fn` (`signatures`,
 * `find`, ...), not a `Proxy`: a `Proxy` apply trap costs about 70 ns on each call, more than
 * the 50 ns of a scalar `add`. A call without a CSR argument takes the first loop, which
 * tests each argument with `typeof`, and calls `fn` at once.
 */
export function adaptSparse<F extends (...args: never[]) => unknown>(fn: F, name: string): F {
  const target = fn as unknown as (this: unknown, ...args: unknown[]) => unknown;
  const wrapped = function (this: unknown, ...args: unknown[]): unknown {
    let adapted: unknown[] | undefined;
    let converted: number[] | undefined;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (typeof a === 'object' && a !== null && a instanceof SparseMatrix) {
        adapted ??= args.slice();
        (converted ??= []).push(i);
        adapted[i] = csrToCsc(a);
      }
    }
    if (adapted === undefined) return target.apply(this, args);
    // A call that mixes the public sparse and dense classes needs both in the factory form.
    for (let i = 0; i < adapted.length; i++) {
      const a = adapted[i];
      if (a instanceof DenseMatrix) adapted[i] = MathJSDenseMatrix.fromNative(a);
    }
    let result: unknown;
    try {
      result = target.apply(this, adapted);
    } catch (e) {
      if (rejectsConvertedArgument(e, name, converted!)) {
        throw new TypeError(
          `${name} does not accept a SparseMatrix (CSR) for this signature. ` +
            `Convert the argument with toDense() first, for example ${name}(m.toDense(), ...).`,
          { cause: e }
        );
      }
      throw e;
    }
    return toPublicDeep(result);
  };
  const own = Object.getOwnPropertyDescriptors(fn);
  delete (own as Record<string, unknown>).prototype;
  Object.defineProperties(wrapped, own);
  return wrapped as unknown as F;
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
