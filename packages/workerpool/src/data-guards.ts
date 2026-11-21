/**
 * Entry guards for the data arguments of the pool methods.
 *
 * The pool chunks its data and transfers `chunk.buffer`. A value that is not a typed array has no
 * buffer, so the worker library threw `DataCloneError` in a later tick and the process ended. A
 * typed array of another element type sent its bytes, and the worker read them as Float64 or
 * Int32. A guard turns the argument into the array type that the method reads, or throws one
 * TypeError that names the method. The same guard runs for the inline path and the worker path,
 * so a call gives the same result on both.
 *
 * The accept and reject set is the one of `assertArrayLike` in core: an object whose `length` is a
 * non-negative integer. This package has core as a devDependency only (see `worker-numerics.ts`),
 * so the predicate is a copy. `tests/data-guards.test.ts` compares it with core `pairwiseSum`,
 * which calls `assertArrayLike`.
 *
 * @packageDocumentation
 */

/** The type name of a value, for an error message (as core `typeNameOf`). */
function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return typeof value;
  return (value as { constructor?: { name?: string } }).constructor?.name || 'object';
}

/** True when `x` is an object whose `length` is a non-negative integer (as core `assertArrayLike`). */
function isArrayLikeData(x: unknown): x is ArrayLike<number> {
  return (
    x !== null &&
    typeof x === 'object' &&
    Number.isInteger((x as { length?: unknown }).length) &&
    (x as { length: number }).length >= 0
  );
}

/**
 * Read a data argument as a Float64Array.
 *
 * A Float64Array passes through with no copy. Another array-like (a `number[]`, an `Int32Array`)
 * becomes a new Float64Array. Any other value throws.
 *
 * @param op - The name of the calling method, for the message.
 * @param x - The data argument.
 * @returns The data as a Float64Array.
 * @throws TypeError `${op}: expects an array of numbers, got a ${type}` when `x` is not array-like.
 */
export function toFloat64Data(op: string, x: unknown): Float64Array {
  if (x instanceof Float64Array) return x;
  if (!isArrayLikeData(x)) {
    throw new TypeError(`${op}: expects an array of numbers, got a ${describeType(x)}`);
  }
  return Float64Array.from(x);
}

/**
 * Read a data argument as an Int32Array. An Int32Array passes through with no copy.
 *
 * @param op - The name of the calling method, for the message.
 * @param x - The data argument.
 * @returns The data as an Int32Array.
 * @throws TypeError `${op}: expects an array of numbers, got a ${type}` when `x` is not array-like.
 */
export function toInt32Data(op: string, x: unknown): Int32Array {
  if (x instanceof Int32Array) return x;
  if (!isArrayLikeData(x)) {
    throw new TypeError(`${op}: expects an array of numbers, got a ${describeType(x)}`);
  }
  return Int32Array.from(x);
}

/**
 * Check that a data argument is array-like, with no copy. Use it when the code reads only
 * `length`, or when a later call normalizes the data.
 *
 * @param op - The name of the calling method, for the message.
 * @param x - The data argument.
 * @throws TypeError `${op}: expects an array, got a ${type}` when `x` is not array-like.
 */
export function assertArrayData(op: string, x: unknown): void {
  if (!isArrayLikeData(x)) {
    throw new TypeError(`${op}: expects an array, got a ${describeType(x)}`);
  }
}

/**
 * Read a data argument as a plain Array. An Array passes through with no copy. A typed array and
 * another array-like becomes a new Array, so `map` and `filter` give a plain Array on every path.
 *
 * @param op - The name of the calling method, for the message.
 * @param x - The data argument.
 * @returns The data as an Array.
 * @throws TypeError `${op}: expects an array, got a ${type}` when `x` is not array-like.
 */
export function toArrayData<T = unknown>(op: string, x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  assertArrayData(op, x);
  return Array.from(x as ArrayLike<T>);
}
