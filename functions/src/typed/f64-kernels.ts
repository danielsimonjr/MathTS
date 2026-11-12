/**
 * Shared element-wise kernel for the synchronous typed Float64Array signatures.
 *
 * This module is internal: `typed/index.ts` does not re-export it.
 *
 * @packageDocumentation
 */

import {
  elementwiseUnaryDispatch,
  type WasmElementwiseOp,
} from '../wasm/elementwise/wasm-bridge.js';

/** Apply `f` to each element of a Float64Array. The result is a new array; the input does not change. */
export function f64Unary(a: Float64Array, f: (x: number) => number): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = f(a[i]);
  return out;
}

/**
 * Require a flat `number[]` vector for synchronous element-wise unary ops.
 * Nested arrays get the mathjs-style matrix hint; non-numbers get a short TypeError.
 */
export function assertFlatNumberVector(value: unknown[], fnName: string): number[] {
  for (let i = 0; i < value.length; i++) {
    const el = value[i];
    if (Array.isArray(el)) {
      throw new TypeError(
        `Function '${fnName}' doesn't apply to matrices. To call it ` +
          `elementwise on a matrix 'M', try 'map(M, ${fnName})'.`
      );
    }
    if (typeof el !== 'number') {
      throw new TypeError(
        `Function '${fnName}' expects a flat array of numbers (index ${i}: ${typeof el})`
      );
    }
  }
  return value as number[];
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

/**
 * Element-wise unary on a flat `number[]`; returns a new `number[]` with the same
 * values as the `Float64Array` path (`new Float64Array` copy in, never `TypedArray.from`).
 */
export function numberArrayUnary(
  value: unknown[],
  fnName: string,
  wasmKernel: WasmElementwiseOp | undefined,
  f: (x: number) => number
): number[] {
  const flat = assertFlatNumberVector(value, fnName);
  const f64 = new Float64Array(flat);
  const out = f64UnaryDispatched(f64, wasmKernel, f);
  const result = new Array<number>(out.length);
  for (let i = 0; i < out.length; i++) result[i] = out[i];
  return result;
}
