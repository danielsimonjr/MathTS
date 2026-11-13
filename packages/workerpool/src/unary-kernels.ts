/**
 * Element-wise unary kernels for `Float64Array` data, one tight loop per function.
 *
 * The in-process path of `MathWorkerPool.unary` and the worker task `unaryChunk` both call
 * these kernels, so the loop that runs on the caller's thread is the loop that runs in a
 * worker. Each kernel is its own loop. A single loop with a `switch (fn)` inside tests the
 * function name once per element; measured on Node 26 at n = 1e6 for `sin`, that loop took
 * 19.8 ms and the hoisted loop 15.3 ms (`tools/benchmarks/ws-r-compute-pool.mjs`, section
 * `path`, records the pool against `functions.sin`).
 *
 * @packageDocumentation
 */

/** The function names `MathWorkerPool.unary` accepts. */
export type UnaryFn = 'abs' | 'sqrt' | 'exp' | 'log' | 'sin' | 'cos' | 'tan' | 'negate' | 'square';

/**
 * Apply one function to `length` elements of `data` that start at `start`.
 * Returns a new array of `length` elements. The input is not changed.
 */
export type UnaryKernel = (data: Float64Array, start: number, length: number) => Float64Array;

/**
 * The kernels by function name.
 *
 * The object is mutable on purpose: a test can wrap an entry to count the calls. Code in
 * this package reads an entry at call time, never at import time.
 *
 * @internal
 */
export const UNARY_KERNELS: Record<UnaryFn, UnaryKernel> = {
  /** Absolute value of each element. */
  abs(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = Math.abs(data[start + i]);
    return out;
  },
  /** Square root of each element. */
  sqrt(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = Math.sqrt(data[start + i]);
    return out;
  },
  /** `Math.exp` of each element. */
  exp(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = Math.exp(data[start + i]);
    return out;
  },
  /** Natural logarithm of each element. */
  log(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = Math.log(data[start + i]);
    return out;
  },
  /** Sine of each element. */
  sin(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = Math.sin(data[start + i]);
    return out;
  },
  /** Cosine of each element. */
  cos(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = Math.cos(data[start + i]);
    return out;
  },
  /** Tangent of each element. */
  tan(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = Math.tan(data[start + i]);
    return out;
  },
  /** Negation of each element. */
  negate(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = -data[start + i];
    return out;
  },
  /** Square of each element. */
  square(data, start, length) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) {
      const v = data[start + i];
      out[i] = v * v;
    }
    return out;
  },
};

/**
 * Apply the named function to every element of `data`.
 *
 * @internal
 * @param fn - Function name.
 * @param data - Input values. The array is not changed.
 * @returns A new array with the results.
 * @example
 * ```ts
 * applyUnary('square', Float64Array.of(1, 2, 3)); // Float64Array [1, 4, 9]
 * ```
 */
export function applyUnary(fn: UnaryFn, data: Float64Array): Float64Array {
  return UNARY_KERNELS[fn](data, 0, data.length);
}
