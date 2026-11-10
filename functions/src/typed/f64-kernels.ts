/**
 * Shared element-wise kernel for the synchronous typed Float64Array signatures.
 *
 * This module is internal: `typed/index.ts` does not re-export it.
 *
 * @packageDocumentation
 */

/** Apply `f` to each element of a Float64Array. The result is a new array; the input does not change. */
export function f64Unary(a: Float64Array, f: (x: number) => number): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = f(a[i]);
  return out;
}
