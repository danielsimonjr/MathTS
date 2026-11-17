/**
 * Shared size limits that guard allocation and loop length (DoS guard).
 *
 * A call with a huge size argument must throw a RangeError before it allocates or
 * loops, because the engine cannot interrupt a synchronous loop and an
 * out-of-memory failure ends the process.
 */
import { DENSE_MATRIX_MAX_ELEMENTS } from '@danielsimonjr/mathts-matrix';

/** Maximum number of elements that one dense result may hold (same cap as `DenseMatrix`). */
export const MAX_ALLOC_ELEMENTS: number = DENSE_MATRIX_MAX_ELEMENTS;

/** Maximum order or iteration count that a recurrence or sum loop accepts. */
export const MAX_LOOP_ORDER = 10_000_000;

/**
 * Maximum order that a cheap scalar three-term recurrence accepts.
 *
 * The limit is the order where the slowest of these recurrences ran for about 20 s before
 * the limit existed (`besselJ(2.5e9, 5e9)` took 18.3 s, `legendreP(2.5e9, 0.5)` 29.0 s).
 */
export const MAX_RECURRENCE_ORDER = 2_500_000_000;

/**
 * Throw a RangeError when the product of `dims` exceeds {@link MAX_ALLOC_ELEMENTS}.
 *
 * The test divides step by step, so the product cannot overflow. A NaN or negative
 * dimension passes through, so the existing argument validation reports it. The
 * dimensions before a zero dimension still count, because each one allocates a
 * container. The dimensions after the first zero do not count.
 *
 * @throws RangeError if the result would hold more than MAX_ALLOC_ELEMENTS elements
 */
export function assertAllocSize(fn: string, dims: readonly number[]): void {
  for (const d of dims) {
    if (Number.isNaN(d) || d < 0) return;
  }
  let room = MAX_ALLOC_ELEMENTS;
  for (const d of dims) {
    if (d > room) {
      throw new RangeError(
        `${fn}: result too large (${dims.join('×')} exceeds limit of ${MAX_ALLOC_ELEMENTS} elements)`
      );
    }
    if (d === 0) return;
    room = Math.floor(room / d);
  }
}

/**
 * Throw a RangeError when `value` exceeds `max`.
 *
 * @throws RangeError if value is greater than max
 */
export function assertLoopOrder(
  fn: string,
  arg: string,
  value: number,
  max: number = MAX_LOOP_ORDER
): void {
  if (value > max) {
    throw new RangeError(`${fn}: ${arg} = ${value} exceeds the supported maximum of ${max}`);
  }
}
