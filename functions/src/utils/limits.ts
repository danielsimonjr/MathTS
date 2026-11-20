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
 * It also bounds the total of one array call: `besselJ(n, xs)` and `legendreP(n, xs)` run
 * one recurrence per element, so an array whose elements need more than this many steps in
 * all throws a RangeError (`assertArrayWork`).
 */
export const MAX_RECURRENCE_ORDER = 2_500_000_000;

// Each family below has its own limit, near the order that returns in about 20 s. The times
// are on this build at 41% machine load. A step of these recurrences costs more than one of
// the plain recurrences.

/** Maximum order for `jacobiP` (n = 1e9 took 20.7 s). */
export const MAX_JACOBI_ORDER = 1_000_000_000;

/** Maximum order for `gegenbauerC` (n = 1e9 took 15.7 s). */
export const MAX_GEGENBAUER_ORDER = 1_000_000_000;

/** Maximum degree and order for `ferrersP` (n = 1e9 took 14.0 s). */
export const MAX_FERRERS_ORDER = 1_000_000_000;

/** Maximum order for `expn` with `0 < x <= 1` (n = 1.2e9 took 14.1 s). */
export const MAX_EXPN_ORDER = 1_200_000_000;

/**
 * Maximum order for `laguerreL` (n = 1e9 took 13.1 s). The scalar is serialized
 * into worker kernels, so `laguerreLScalar` repeats this value as a literal.
 */
export const MAX_LAGUERRE_ORDER = 1_000_000_000;

/**
 * Maximum `n` and `max(n, |x|)` for the spherical Bessel functions. The old build ran
 * `sphericalBesselY(1.5e9, 2e9)` in 15.9 s at 31% load, so 1.8e9 is near its 20 s point.
 */
export const MAX_SPHERICAL_BESSEL_ORDER = 1_800_000_000;

/**
 * Maximum start order of the `besselJ` downward sweep (x just below n). The old build ran
 * `besselJ(5e8, 5e8 - 1)` in 6.0 s; the new build runs `besselJ(1.19e9, 1.19e9 - 1)` in
 * 13.7 s, so 1.2e9 is below the 20 s point. The scalar is
 * serialized into worker kernels, so `besselJScalar` repeats this value as a literal.
 */
export const MAX_BESSEL_J_SWEEP = 1_200_000_000;

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
 * Throw a RangeError when one array call needs more recurrence steps than `max`.
 *
 * A scalar limit bounds one element. An array call runs one recurrence per element, so a
 * long array at a large order ran for hours (`besselY(2.4e9, 1024 elements)`). The caller
 * computes `steps`, the total of the steps of all elements in units of one upward step.
 *
 * @param fn - Function name for the message
 * @param n - Order, for the message
 * @param count - Number of elements, for the message
 * @param steps - Total recurrence steps of the call
 * @param max - Largest total that one call accepts
 * @throws RangeError if steps is greater than max
 */
export function assertArrayWork(
  fn: string,
  n: number,
  count: number,
  steps: number,
  max: number
): void {
  if (steps > max) {
    throw new RangeError(
      `${fn}: order ${n} over ${count} elements needs about ${steps} recurrence steps, above the supported maximum of ${max} per call`
    );
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
