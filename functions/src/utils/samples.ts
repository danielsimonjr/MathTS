/**
 * Shared argument helper for the signal and curve-fit functions.
 */

/**
 * Return `signal` as a Float64Array.
 *
 * A Float64Array passes through. An array is copied. Any other value (for example a
 * number, which `new Float64Array(5)` would turn into five zeros) throws a TypeError.
 *
 * @throws TypeError if signal is not an array or a Float64Array
 */
export function toSamples(fn: string, signal: unknown, arg = 'signal'): Float64Array {
  if (signal instanceof Float64Array) return signal;
  if (Array.isArray(signal)) return new Float64Array(signal as number[]);
  throw new TypeError(`${fn}: ${arg} must be an array or a Float64Array`);
}
