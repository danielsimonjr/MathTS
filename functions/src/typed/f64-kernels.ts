/**
 * Shared element-wise kernel for the synchronous typed Float64Array signatures.
 *
 * This module is internal: `typed/index.ts` does not re-export it.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
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

/**
 * Element-wise unary on a Matrix. A numeric result is `matrix.map`, so the
 * container class is unchanged. A leaf that leaves the real domain cannot live
 * in the Float64Array storage, so that case returns a nested array of the same
 * shape whose entries are the typed scalar results.
 */
function unaryOnMatrix(matrix: NumericMatrix, apply: Apply, spec: UnaryRealSpec): unknown {
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
  return out;
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
