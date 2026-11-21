/**
 * Shared element-wise kernel for the synchronous typed Float64Array signatures.
 *
 * This module is internal: `typed/index.ts` does not re-export it.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { DenseMatrix, isDenseMatrix } from '@danielsimonjr/mathts-matrix';
import { deepMap } from '../utils/collection.js';
import {
  elementwiseUnaryDispatch,
  type WasmElementwiseOp,
} from '../wasm/elementwise/wasm-bridge.js';

/** Real kernel used when every leaf is a number inside the real domain. */
export interface UnaryRealSpec {
  real: (x: number) => number;
  wasmKernel?: WasmElementwiseOp;
  /**
   * False when the scalar typed function would not return `real(x)`
   * (complex promotion). Omitted means every number stays on `real`.
   */
  inRealDomain?: (x: number) => boolean;
}

type Apply = (value: unknown) => unknown;

/** Matrix duck type registered with typed-function (`rows`/`cols`/`get`/`type`). */
interface NumericMatrix {
  rows: number;
  cols: number;
  type: string;
  get(row: number, col: number): number;
  map(fn: (value: number, row: number, col: number) => number): unknown;
}

/** Apply `f` to each element of a Float64Array. The result is a new array; the input does not change. */
export function f64Unary(a: Float64Array, f: (x: number) => number): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = f(a[i]);
  return out;
}

/** Run the Float64Array unary path (optional WASM tier, then `f64Unary`). */
export function f64UnaryDispatched(
  a: Float64Array,
  wasmKernel: WasmElementwiseOp | undefined,
  f: (x: number) => number
): Float64Array {
  if (wasmKernel) {
    return elementwiseUnaryDispatch(wasmKernel, a) ?? f64Unary(a, f);
  }
  return f64Unary(a, f);
}

function numbersStayReal(
  values: ArrayLike<number>,
  domain: UnaryRealSpec['inRealDomain']
): boolean {
  if (!domain) return true;
  for (let i = 0; i < values.length; i++) {
    if (!domain(values[i])) return false;
  }
  return true;
}

function float64ToNumberArray(out: Float64Array): number[] {
  const result = new Array<number>(out.length);
  for (let i = 0; i < out.length; i++) result[i] = out[i];
  return result;
}

/**
 * Element-wise unary on an array. Flat `number[]` inside the real domain copies
 * through `new Float64Array` (never `TypedArray.from`) and back out. Nested arrays
 * keep their shape. Any other leaf is passed back through the typed function, so
 * BigNumber, Complex, Fraction, and Unit keep their own signatures and are not
 * coerced to number.
 */
function unaryOnArray(value: unknown[], apply: Apply, spec: UnaryRealSpec): unknown[] {
  const n = value.length;
  if (n === 0) return [];

  let nested = false;
  let allNumbers = true;
  for (let i = 0; i < n; i++) {
    const el = value[i];
    if (Array.isArray(el)) {
      nested = true;
      break;
    }
    if (typeof el !== 'number') allNumbers = false;
  }

  if (nested) {
    const out = new Array<unknown>(n);
    for (let i = 0; i < n; i++) {
      const el = value[i];
      out[i] = Array.isArray(el) ? unaryOnArray(el, apply, spec) : apply(el);
    }
    return out;
  }

  if (allNumbers && numbersStayReal(value as number[], spec.inRealDomain)) {
    const mapped = f64UnaryDispatched(
      new Float64Array(value as number[]),
      spec.wasmKernel,
      spec.real
    );
    return float64ToNumberArray(mapped);
  }

  const out = new Array<unknown>(n);
  for (let i = 0; i < n; i++) out[i] = apply(value[i]);
  return out;
}

/** True when every leaf of a nested Array is a number inside the real domain of the function. */
function leavesStayReal(value: unknown, domain: UnaryRealSpec['inRealDomain']): boolean {
  if (Array.isArray(value)) return value.every((el) => leavesStayReal(el, domain));
  return typeof value === 'number' && (domain === undefined || domain(value));
}

/**
 * Element-wise unary on a Matrix. A numeric result is `matrix.map`, so the container class is
 * unchanged. A leaf that leaves the real domain gives a result that the class may not store:
 *
 * - A factory matrix (`MathJSDenseMatrix`, `MathJSSparseMatrix`) stores any value and has
 *   `create(data)`. It keeps its class, with the typed scalar results as entries. It may have
 *   one axis or three, and `rows x cols` reads two axes only (a matrix of size `[n]` has `cols`
 *   0), so a factory matrix that is not 2-D is read through `toArray()`.
 * - A matrix of the matrix package stores `Float64Array` data, and has no `create`. Its result
 *   is a nested array of the same shape, whose entries are the typed scalar results (the
 *   published overloads of `sqrt` and the other unary functions declare that type).
 */
function unaryOnMatrix(matrix: NumericMatrix, apply: Apply, spec: UnaryRealSpec): unknown {
  const factory = matrix as unknown as {
    create?: (data: unknown[]) => unknown;
    size?: () => number[];
    toArray(): unknown[];
  };
  const create = typeof factory.create === 'function' ? factory.create : undefined;
  if (create !== undefined && typeof factory.size === 'function' && factory.size().length !== 2) {
    const nested = factory.toArray();
    if (leavesStayReal(nested, spec.inRealDomain)) return matrix.map(spec.real);
    return create.call(matrix, unaryOnArray(nested, apply, spec));
  }

  const { rows, cols } = matrix;
  let numeric = true;
  for (let i = 0; i < rows && numeric; i++) {
    for (let j = 0; j < cols; j++) {
      const v = matrix.get(i, j);
      if (typeof v !== 'number' || (spec.inRealDomain !== undefined && !spec.inRealDomain(v))) {
        numeric = false;
        break;
      }
    }
  }
  if (numeric) return matrix.map(spec.real);

  const out = new Array<unknown[]>(rows);
  for (let i = 0; i < rows; i++) {
    const row = new Array<unknown>(cols);
    for (let j = 0; j < cols; j++) row[j] = apply(matrix.get(i, j));
    out[i] = row;
  }
  return create !== undefined ? create.call(matrix, out) : out;
}

/**
 * One `Array | Matrix` signature for every synchronous unary. The implementation
 * re-enters the typed function on each leaf, so there is no per-function copy loop.
 */
export function unaryCollection(spec: UnaryRealSpec) {
  return mathTyped.referToSelf((self) => (value: unknown[] | NumericMatrix) => {
    if (Array.isArray(value)) return unaryOnArray(value, self as Apply, spec);
    return unaryOnMatrix(value, self as Apply, spec);
  });
}

/** The typed function itself. It takes one leaf and the remaining arguments. */
type ApplyMany = (...args: unknown[]) => unknown;

/**
 * One `Array | Matrix` signature (optionally followed by scalar arguments) that calls the typed
 * function on each leaf. A nested array keeps its shape and a matrix keeps its class, as in
 * mathjs. Use this signature when a leaf result is not a number (`not`). Use it also when a
 * leaf must reach its own signature for its checks (`bitNot`).
 *
 * A DenseMatrix of the matrix package stores `Float64Array` data. The result for such a matrix
 * keeps the class when every entry is a number, and is a nested array otherwise, as in
 * `unaryOnMatrix`.
 */
export function mapEachLeaf(leaf: (self: ApplyMany, x: unknown, ...rest: unknown[]) => unknown) {
  return mathTyped.referToSelf(
    (self) =>
      (value: unknown, ...rest: unknown[]) =>
        mapLeaves(value, (x) => leaf(self as ApplyMany, x, ...rest))
  );
}

/**
 * The form of {@link mapEachLeaf} for a scalar first argument and a collection second argument
 * (`round(2.675, [1, 2])`): the typed function runs on the scalar with each leaf of the
 * collection. The result has the shape and the class of the collection.
 */
export function mapEachLeafOfSecond(
  leaf: (self: ApplyMany, first: unknown, x: unknown) => unknown
) {
  return mathTyped.referToSelf(
    (self) => (first: unknown, value: unknown) =>
      mapLeaves(value, (x) => leaf(self as ApplyMany, first, x))
  );
}

/** `one` on each leaf of an array or a matrix; see {@link mapEachLeaf} for the result class. */
function mapLeaves(value: unknown, one: (x: unknown) => unknown): unknown {
  if (!isDenseMatrix(value)) return deepMap(value as unknown[], one);
  const nested = (value.toArray() as unknown[][]).map((row) => row.map(one));
  return nested.every((row) => row.every((x) => typeof x === 'number'))
    ? DenseMatrix.fromArray(nested as number[][])
    : nested;
}
