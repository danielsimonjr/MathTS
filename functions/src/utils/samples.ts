/**
 * Shared argument helper for the signal and curve-fit functions.
 */

import { typeOf } from './is.js';

/**
 * Copy an array into a Float64Array. A number entry is copied as it is (a NaN stays a NaN).
 * Another entry is read as the engine reads it when it writes into a Float64Array, so a
 * BigNumber, a Fraction and a numeric string keep their numeric reading (#1042). An entry that
 * has no numeric reading throws: an Array or a typed array (the engine reads `[[1]]` as 1 and
 * `[[1, 2]]` as NaN; so a column `[[1], [3], [5]]` throws), an object or a string that reads as NaN,
 * and `undefined`. An empty string, a blank string, `true` and `null` keep the engine reading
 * (0, 0, 1 and 0), as mathjs `number()` does.
 */
function arrayToSamples(fn: string, signal: readonly unknown[]): Float64Array {
  const n = signal.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = signal[i];
    out[i] = v as number;
    if (typeof v === 'number') continue;
    if (out[i] !== out[i] || Array.isArray(v) || ArrayBuffer.isView(v)) {
      throw new TypeError(`${fn}: expects number data, got a ${typeOf(v)} at index ${i}`);
    }
  }
  return out;
}

/**
 * Return `signal` as a Float64Array.
 *
 * A Float64Array passes through. An array or another number typed array is copied.
 * Any other value throws a TypeError: a number (which `new Float64Array(5)` would turn
 * into five zeros), a Matrix, a BigInt64Array, a BigUint64Array, a Set or an array-like
 * object. An array entry that has no numeric reading (a nested array, an object, a string
 * that is no number) throws a TypeError, because the copy would turn it into NaN or read
 * `[[1]]` as 1.
 *
 * @throws TypeError if signal is not an array or a typed array, or an array entry is no number
 */
export function toSamples(fn: string, signal: unknown, arg = 'signal'): Float64Array {
  if (signal instanceof Float64Array) return signal;
  if (Array.isArray(signal)) return arrayToSamples(fn, signal);
  if (
    ArrayBuffer.isView(signal) &&
    !(signal instanceof DataView) &&
    !(signal instanceof BigInt64Array) &&
    !(signal instanceof BigUint64Array)
  ) {
    return new Float64Array(signal as unknown as ArrayLike<number>);
  }
  throw new TypeError(`${fn}: ${arg} must be an array or a typed array`);
}
