/**
 * Shared argument helper for the signal and curve-fit functions.
 */

/**
 * Return `signal` as a Float64Array.
 *
 * A Float64Array passes through. An array or another number typed array is copied.
 * Any other value throws a TypeError: a number (which `new Float64Array(5)` would turn
 * into five zeros), a Matrix, a BigInt64Array, a BigUint64Array, a Set or an array-like
 * object.
 *
 * @throws TypeError if signal is not an array or a typed array
 */
export function toSamples(fn: string, signal: unknown, arg = 'signal'): Float64Array {
  if (signal instanceof Float64Array) return signal;
  if (
    Array.isArray(signal) ||
    (ArrayBuffer.isView(signal) &&
      !(signal instanceof DataView) &&
      !(signal instanceof BigInt64Array) &&
      !(signal instanceof BigUint64Array))
  ) {
    return new Float64Array(signal as ArrayLike<number>);
  }
  throw new TypeError(`${fn}: ${arg} must be an array or a typed array`);
}
