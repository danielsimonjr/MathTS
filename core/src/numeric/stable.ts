/**
 * Numerically stable reduction primitives.
 *
 * Floating-point addition is not associative, so *how* you accumulate decides how much error you
 * carry. These are the algorithms the established numerical stack uses, and the reason it is
 * trusted.
 *
 * Measured on this repo's own reductions before these existed — 1e6 copies of `0.1`, exact answer
 * 100000:
 *
 * | accumulation                    | relative error |
 * | ------------------------------- | -------------- |
 * | naive `s += x`                  | **1.3e-11**    |
 * | pairwise (this, = NumPy's algo) | **2.9e-16**    |
 * | Neumaier compensated (`fsum`)   | **0** (exact)  |
 *
 * NumPy 2.3.4 reports 2.9e-16 on the same input — we are now at parity. Before this, we were
 * ~46,000× worse than NumPy on a bog-standard `sum`, and `mean`, `std`, `var` and every statistic
 * inherit that error.
 *
 * @packageDocumentation
 */

/**
 * Block size for {@link pairwiseSum}.
 *
 * Below this, sum straight through — recursion on tiny blocks costs more than the error it saves,
 * and a short run accumulates almost nothing. NumPy uses 128 for exactly this trade; matching it
 * keeps our accuracy directly comparable to theirs.
 */
const PAIRWISE_BLOCK = 128;

/** The type name of a value, for an error message. */
function typeNameOf(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return typeof value;
  return (value as { constructor?: { name?: string } }).constructor?.name || 'object';
}

/**
 * Checks that `xs` is array-like: an object whose `length` is a non-negative integer.
 * A number has no `length`, and a `length` of NaN or Infinity is not a count. A loop or a
 * range split that reads such a `length` does not end or reads an empty range (#1011).
 * A string is not number data: `+` joins its characters.
 *
 * @param name - The name of the caller, for the message.
 * @param xs - The value to check.
 * @throws A `TypeError` that names the caller when `xs` is not array-like.
 */
function assertArrayLike(name: string, xs: unknown): void {
  if (
    xs === null ||
    typeof xs !== 'object' ||
    !Number.isInteger((xs as { length?: unknown }).length) ||
    (xs as { length: number }).length < 0
  ) {
    throw new TypeError(`${name}: expects an array of numbers, got a ${typeNameOf(xs)}`);
  }
}

/**
 * Sum with **pairwise (cascade) summation** — the algorithm behind `np.sum`.
 *
 * Naive accumulation lets the running total grow large while the addends stay small, so each
 * addition rounds off a little more of the total: error grows as **O(n)·ε**. Pairwise summation
 * adds numbers of *comparable magnitude* by recursively halving the range, so error grows as
 * **O(log n)·ε** — for n = 10⁶ that is the difference between ~1e-11 and ~1e-16.
 *
 * It costs the same number of additions as the naive loop. There is no speed/accuracy trade here;
 * the naive version is simply worse.
 *
 * Not exact: for that, use {@link neumaierSum}. Pairwise is the right default because it is free.
 */
export function pairwiseSum(xs: ArrayLike<number>, start = 0, end?: number, shift = 0): number {
  assertArrayLike('pairwiseSum', xs);
  return pairwiseSumRange(xs, start, end ?? xs.length, shift);
}

function pairwiseSumRange(
  xs: ArrayLike<number>,
  start: number,
  end: number,
  shift: number
): number {
  const n = end - start;

  if (n <= PAIRWISE_BLOCK) {
    // Unrolled by 8: this is the leaf of the recursion and where all the time goes. Eight
    // independent accumulators also break the serial dependency chain, which lets the CPU keep
    // several additions in flight.
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let s5 = 0;
    let s6 = 0;
    let s7 = 0;

    let i = start;
    const limit = start + (n - (n % 8));
    if (shift === 0) {
      for (; i < limit; i += 8) {
        s0 += xs[i];
        s1 += xs[i + 1];
        s2 += xs[i + 2];
        s3 += xs[i + 3];
        s4 += xs[i + 4];
        s5 += xs[i + 5];
        s6 += xs[i + 6];
        s7 += xs[i + 7];
      }
    } else {
      for (; i < limit; i += 8) {
        s0 += xs[i] - shift;
        s1 += xs[i + 1] - shift;
        s2 += xs[i + 2] - shift;
        s3 += xs[i + 3] - shift;
        s4 += xs[i + 4] - shift;
        s5 += xs[i + 5] - shift;
        s6 += xs[i + 6] - shift;
        s7 += xs[i + 7] - shift;
      }
    }

    let tail = 0;
    for (; i < end; i++) tail += shift === 0 ? xs[i] : xs[i] - shift;

    // Combine the partials pairwise too, not left-to-right.
    return s0 + s1 + (s2 + s3) + (s4 + s5 + (s6 + s7)) + tail;
  }

  // Split on an even boundary so both halves stay block-aligned.
  const half = (n >> 1) - ((n >> 1) % 8);
  return (
    pairwiseSumRange(xs, start, start + half, shift) +
    pairwiseSumRange(xs, start + half, end, shift)
  );
}

/**
 * {@link pairwiseSum} with shift 0 that returns `undefined` when an element is not a number.
 *
 * The check runs in the loop that adds each element, so no second pass is needed. An array hole
 * reads as `undefined` and also gives `undefined`. For number input the bits equal `pairwiseSum`.
 */
export function pairwiseSumChecked(xs: ArrayLike<unknown>): number | undefined {
  assertArrayLike('pairwiseSumChecked', xs);
  return pairwiseSumCheckedRange(xs, 0, xs.length);
}

function pairwiseSumCheckedRange(
  xs: ArrayLike<unknown>,
  start: number,
  end: number
): number | undefined {
  const n = end - start;

  if (n <= PAIRWISE_BLOCK) {
    // Same accumulators, order and combine as pairwiseSum (shift 0).
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let s5 = 0;
    let s6 = 0;
    let s7 = 0;

    let i = start;
    const limit = start + (n - (n % 8));
    for (; i < limit; i += 8) {
      const v0 = xs[i];
      const v1 = xs[i + 1];
      const v2 = xs[i + 2];
      const v3 = xs[i + 3];
      const v4 = xs[i + 4];
      const v5 = xs[i + 5];
      const v6 = xs[i + 6];
      const v7 = xs[i + 7];
      if (
        typeof v0 !== 'number' ||
        typeof v1 !== 'number' ||
        typeof v2 !== 'number' ||
        typeof v3 !== 'number' ||
        typeof v4 !== 'number' ||
        typeof v5 !== 'number' ||
        typeof v6 !== 'number' ||
        typeof v7 !== 'number'
      ) {
        return undefined;
      }
      s0 += v0;
      s1 += v1;
      s2 += v2;
      s3 += v3;
      s4 += v4;
      s5 += v5;
      s6 += v6;
      s7 += v7;
    }

    let tail = 0;
    for (; i < end; i++) {
      const v = xs[i];
      if (typeof v !== 'number') return undefined;
      tail += v;
    }

    return s0 + s1 + (s2 + s3) + (s4 + s5 + (s6 + s7)) + tail;
  }

  const half = (n >> 1) - ((n >> 1) % 8);
  const left = pairwiseSumCheckedRange(xs, start, start + half);
  if (left === undefined) return undefined;
  const right = pairwiseSumCheckedRange(xs, start + half, end);
  if (right === undefined) return undefined;
  return left + right;
}

/**
 * Sum with **Neumaier compensation** — correctly rounded for practical purposes, the equivalent
 * of Python's `math.fsum`.
 *
 * Tracks the low-order bits that each addition throws away and folds them back in at the end. It
 * recovers information that pairwise summation cannot: `[1e16, 1, -1e16]` sums to **1** here,
 * while both naive and pairwise (and `np.sum`) give **0**, because the `1` is annihilated the
 * moment it meets `1e16`.
 *
 * ~2-4× slower than {@link pairwiseSum}, so it is opt-in rather than the default. Reach for it
 * when catastrophic cancellation is possible: near-zero results from large terms, long-running
 * accumulators, conservation checks.
 *
 * (Neumaier's variant, not classic Kahan: Kahan loses the compensation when the *addend* is
 * larger than the running sum, which is precisely the `1e16` case.)
 */
export function neumaierSum(xs: ArrayLike<number>): number {
  assertArrayLike('neumaierSum', xs);
  let sum = 0;
  let c = 0; // running compensation for the lost low-order bits

  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const t = sum + x;
    // Whichever operand is larger keeps its bits; the smaller one is what got rounded off.
    c += Math.abs(sum) >= Math.abs(x) ? sum - t + x : x - t + sum;
    sum = t;
  }

  return sum + c;
}

/**
 * Euclidean (2-)norm that does **not** overflow or underflow — BLAS's `dnrm2` scaling.
 *
 * The obvious `sqrt(Σxᵢ²)` squares before it adds, so it dies well inside the representable
 * range: `‖[1e200, 1e200, 1e200, 1e200]‖` overflows to `Infinity` (the true answer, 2e200, is
 * perfectly representable), and `‖[1e-200] × 4‖` **flushes to 0** — a silent wrong answer, which
 * is worse.
 *
 * NumPy has this bug too: `np.linalg.norm([1e200]*4)` returns `inf` with an overflow warning.
 * LAPACK does not, and neither do we.
 *
 * The fix is to carry a running scale: keep the largest magnitude seen out of the sum of squares,
 * so the accumulator only ever holds ratios in [0, 1].
 */
export function norm2(xs: ArrayLike<number>): number {
  assertArrayLike('norm2', xs);
  let scale = 0;
  let ssq = 1;
  let nan = false;

  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (x === 0) continue;
    // An infinite value gives Infinity, also with a NaN; else a NaN gives NaN (IEEE 754 hypot,
    // #1259). A NaN is remembered so that a later infinite value still wins.
    if (Number.isNaN(x)) {
      nan = true;
      continue;
    }
    const ax = Math.abs(x);
    if (ax === Infinity) return Infinity;
    if (scale < ax) {
      // A new largest element: rescale the accumulated sum of squares down to the new unit.
      const r = scale / ax;
      ssq = 1 + ssq * r * r;
      scale = ax;
    } else {
      const r = ax / scale;
      ssq += r * r;
    }
  }

  if (nan) return NaN;
  return scale === 0 ? 0 : scale * Math.sqrt(ssq);
}

/**
 * Dot product `Σ aᵢ·bᵢ` with **pairwise (cascade) summation** of the products — the accuracy of
 * {@link pairwiseSum} applied to a dot without materialising the product array.
 *
 * A naive `s += a[i]*b[i]` loop carries the same **O(n)·ε** error as a naive sum; measured against
 * an exact reference on an ill-conditioned dot (large mean × small factor, n = 10⁶) it is ~18×
 * worse than `np.dot`, which sums pairwise. This closes that gap — and, like {@link pairwiseSum},
 * costs the same number of flops as the naive loop.
 *
 * The two ranges are assumed the same length; callers guard that. Reads only `[start, end)`.
 */
export function pairwiseDot(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  start = 0,
  end?: number
): number {
  assertArrayLike('pairwiseDot', a);
  assertArrayLike('pairwiseDot', b);
  return pairwiseDotRange(a, b, start, end ?? a.length);
}

function pairwiseDotRange(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  start: number,
  end: number
): number {
  const n = end - start;

  if (n <= PAIRWISE_BLOCK) {
    // Eight independent accumulators, exactly as in pairwiseSum, so the multiply-adds stay in
    // flight instead of serialising on one running total.
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let s5 = 0;
    let s6 = 0;
    let s7 = 0;

    let i = start;
    const limit = start + (n - (n % 8));
    for (; i < limit; i += 8) {
      s0 += a[i] * b[i];
      s1 += a[i + 1] * b[i + 1];
      s2 += a[i + 2] * b[i + 2];
      s3 += a[i + 3] * b[i + 3];
      s4 += a[i + 4] * b[i + 4];
      s5 += a[i + 5] * b[i + 5];
      s6 += a[i + 6] * b[i + 6];
      s7 += a[i + 7] * b[i + 7];
    }

    let tail = 0;
    for (; i < end; i++) tail += a[i] * b[i];

    return s0 + s1 + (s2 + s3) + (s4 + s5 + (s6 + s7)) + tail;
  }

  const half = (n >> 1) - ((n >> 1) % 8);
  return pairwiseDotRange(a, b, start, start + half) + pairwiseDotRange(a, b, start + half, end);
}

/**
 * {@link pairwiseDot} that returns `undefined` when an element that it reads is not a number.
 *
 * The check runs in the loop of the multiply-adds, so no second pass is needed. The function
 * assumes the two arrays have the same length. Callers guard the length. For number input the
 * bits equal `pairwiseDot`.
 */
export function pairwiseDotChecked(
  a: ArrayLike<unknown>,
  b: ArrayLike<unknown>
): number | undefined {
  assertArrayLike('pairwiseDotChecked', a);
  assertArrayLike('pairwiseDotChecked', b);
  return pairwiseDotCheckedRange(a, b, 0, a.length);
}

function pairwiseDotCheckedRange(
  a: ArrayLike<unknown>,
  b: ArrayLike<unknown>,
  start: number,
  end: number
): number | undefined {
  const n = end - start;
  if (n <= PAIRWISE_BLOCK) {
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let s5 = 0;
    let s6 = 0;
    let s7 = 0;
    let i = start;
    const limit = start + (n - (n % 8));
    for (; i < limit; i += 8) {
      const a0 = a[i];
      const a1 = a[i + 1];
      const a2 = a[i + 2];
      const a3 = a[i + 3];
      const a4 = a[i + 4];
      const a5 = a[i + 5];
      const a6 = a[i + 6];
      const a7 = a[i + 7];
      const b0 = b[i];
      const b1 = b[i + 1];
      const b2 = b[i + 2];
      const b3 = b[i + 3];
      const b4 = b[i + 4];
      const b5 = b[i + 5];
      const b6 = b[i + 6];
      const b7 = b[i + 7];
      if (
        typeof a0 !== 'number' ||
        typeof a1 !== 'number' ||
        typeof a2 !== 'number' ||
        typeof a3 !== 'number' ||
        typeof a4 !== 'number' ||
        typeof a5 !== 'number' ||
        typeof a6 !== 'number' ||
        typeof a7 !== 'number' ||
        typeof b0 !== 'number' ||
        typeof b1 !== 'number' ||
        typeof b2 !== 'number' ||
        typeof b3 !== 'number' ||
        typeof b4 !== 'number' ||
        typeof b5 !== 'number' ||
        typeof b6 !== 'number' ||
        typeof b7 !== 'number'
      ) {
        return undefined;
      }
      s0 += a0 * b0;
      s1 += a1 * b1;
      s2 += a2 * b2;
      s3 += a3 * b3;
      s4 += a4 * b4;
      s5 += a5 * b5;
      s6 += a6 * b6;
      s7 += a7 * b7;
    }
    let tail = 0;
    for (; i < end; i++) {
      const x = a[i];
      const y = b[i];
      if (typeof x !== 'number' || typeof y !== 'number') return undefined;
      tail += x * y;
    }
    return s0 + s1 + (s2 + s3) + (s4 + s5 + (s6 + s7)) + tail;
  }
  // Split on an 8-aligned boundary, as pairwiseDot does, so both halves stay block-aligned.
  const half = (n >> 1) - ((n >> 1) % 8);
  const left = pairwiseDotCheckedRange(a, b, start, start + half);
  if (left === undefined) return undefined;
  const right = pairwiseDotCheckedRange(a, b, start + half, end);
  if (right === undefined) return undefined;
  return left + right;
}

/**
 * Euclidean distance `‖a − b‖₂` that does **not** overflow or underflow — {@link norm2}'s BLAS
 * `dnrm2` scaling applied to the elementwise difference.
 *
 * `distance` is just a 2-norm, so the obvious `sqrt(Σ(aᵢ−bᵢ)²)` inherits norm's pathology: it
 * squares before it adds, overflowing to `Infinity` and — the dangerous case — **flushing to a
 * silent 0** for small differences well inside the representable range. NumPy's `linalg.norm` has
 * the same bug; scaling on the largest *difference* seen avoids both. The scale tracks the residual
 * `a − b`, not the inputs, so it stays accurate even when `a` and `b` are individually huge.
 *
 * The two ranges are assumed the same length; callers guard that.
 */
export function scaledDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  assertArrayLike('scaledDistance', a);
  assertArrayLike('scaledDistance', b);
  let scale = 0;
  let ssq = 1;
  let nan = false;

  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    if (d === 0) continue;
    // An infinite value gives Infinity, also with a NaN; else a NaN gives NaN (IEEE 754 hypot,
    // #1259). A NaN is remembered so that a later infinite value still wins.
    if (Number.isNaN(d)) {
      nan = true;
      continue;
    }
    const ad = Math.abs(d);
    if (ad === Infinity) return Infinity;
    if (scale < ad) {
      const r = scale / ad;
      ssq = 1 + ssq * r * r;
      scale = ad;
    } else {
      const r = ad / scale;
      ssq += r * r;
    }
  }

  if (nan) return NaN;
  return scale === 0 ? 0 : scale * Math.sqrt(ssq);
}

/**
 * Sum of squared deviations from the mean, `Σ(xᵢ − x̄)²` — the **corrected two-pass** form, the
 * numerator of a numerically stable variance.
 *
 * Variance is where large means bite: the deviations `xᵢ − x̄` can be O(1) while the values sit on
 * a huge pedestal, so any error in `x̄` rides straight into every deviation. Two things fix it:
 *   1. compute the mean with {@link pairwiseSum}, not a naive running total; and
 *   2. subtract the residual mean-bias term `(Σd)²/n` — `Σd` is zero in exact arithmetic but not in
 *      floating point, and that leftover is exactly the systematic error a plain `Σd²` carries.
 *
 * Measured on 1e9-pedestal data: the plain naive two-pass (what shipped) lands ~1e-7 relative error;
 * this lands ~1e-16 — better than `np.var`, which uses the uncorrected two-pass (~1e-13).
 *
 * The deviation vector is never materialised: both pairwise sums walk `xs` in
 * registers, so variance/std no longer pay an extra n-long allocation.
 *
 * When every value is finite the sums run on `xᵢ − x₀`. Variance is shift-invariant, and
 * subtracting the first sample keeps a mean near `1e308` from overflowing to `Infinity`
 * before the deviations are formed (`[1e308, 1e308, 1e308]` is exactly 0; a finite spread
 * such as `1e150` on that pedestal stays finite). Non-finite values keep the unshifted
 * path so `NaN` and `Infinity` still propagate.
 *
 * Divide the result by `n` (uncorrected), `n − 1` (unbiased/sample), or `n + 1` (biased) for the
 * corresponding variance. Returns 0 for fewer than two elements.
 */
export function sumSquaredDeviations(xs: ArrayLike<number>): number {
  assertArrayLike('sumSquaredDeviations', xs);
  const n = xs.length;
  if (n < 2) return 0;

  let allFinite = Number.isFinite(xs[0]);
  if (allFinite) {
    for (let i = 1; i < n; i++) {
      if (!Number.isFinite(xs[i])) {
        allFinite = false;
        break;
      }
    }
  }
  return squaredDeviationsFrom(xs, allFinite);
}

/**
 * {@link sumSquaredDeviations} that returns `undefined` when an element is not a number.
 *
 * The type test sits in the loop that checks each element for finiteness, so no second pass is
 * needed. Returns 0 for fewer than two numbers. For number input the bits equal
 * `sumSquaredDeviations`.
 */
export function sumSquaredDeviationsChecked(xs: ArrayLike<unknown>): number | undefined {
  assertArrayLike('sumSquaredDeviationsChecked', xs);
  const n = xs.length;
  if (n < 2) return n === 0 || typeof xs[0] === 'number' ? 0 : undefined;

  let allFinite = true;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    if (typeof x !== 'number') return undefined;
    if (!Number.isFinite(x)) allFinite = false;
  }
  return squaredDeviationsFrom(xs as ArrayLike<number>, allFinite);
}

/**
 * The smallest finite sum of squares that keeps all its digits: 2^-800 (#1104, #1280).
 *
 * A square below 2^-1022 is a subnormal double, which is rounded to a multiple of 2^-1074: an
 * absolute error of at most 2^-1075. A sum S of n squares with S >= 2^-800 therefore has a
 * relative error of at most n * 2^-275 from that rounding (n < 2^53). A sum below this value can
 * have lost digits, and a sum of 0 can stand for squares that underflowed.
 *
 * Code that squares a list of numbers compares the sum with this value, and computes again for
 * the data divided by an exact power of 2 when the sum is smaller (or not finite). Two other
 * thresholds hold their own derivation: `P_NORM_SUM_MIN` in `functions/src/utils/bignumber-hypot.ts`
 * (p-th powers) and `SUM_SQ_MIN` in `functions/src/geometry/quaternion.ts` (kernels with a
 * `Math.hypot` fallback).
 */
export const SQUARES_SAFE_MIN = 2 ** -800;

/**
 * The smallest number whose square is still at least {@link SQUARES_SAFE_MIN}: 2^-400.
 *
 * - A root `r = sqrt(S / d)` with `d >= 1` and `r >= ROOT_SAFE_MIN` implies `S >= SQUARES_SAFE_MIN`.
 *   So a root below this value is the root of a sum that can have lost digits. A divisor above 1
 *   only makes the test fire more often, which costs one exact pass and changes no digit.
 * - A (population) variance `v` of n values in `[ROOT_SAFE_MIN, 1 / ROOT_SAFE_MIN]` keeps the
 *   sum of the fourth powers of the deviations in range. By the power-mean inequality that sum is
 *   at least `n * v * v` (so at least 2^-800), and it is at most `n^3 * v * v` (so below 2^1023
 *   for n below 2^74). So no power of the deviations up to the fourth loses a digit or overflows.
 */
export const ROOT_SAFE_MIN = Math.sqrt(SQUARES_SAFE_MIN);

/** The smallest normal double, 2^-1022: a smaller product has lost digits. */
const MIN_NORMAL = 2 ** -1022;

/**
 * Whether two sums of squares give a correlation with every digit: each sum is at least
 * {@link SQUARES_SAFE_MIN} (no square lost digits), and their product is a normal finite double
 * (the square root of the product neither underflowed nor overflowed). When the result is false,
 * the caller divides each variable by its own exact power of 2 and forms the sums again (#1280).
 *
 * @param saa - The sum of the squared deviations of the first variable.
 * @param sbb - The sum of the squared deviations of the second variable.
 * @returns True when `saa * sbb` can be used as it is.
 */
export function squareSumsKeepDigits(saa: number, sbb: number): boolean {
  const product = saa * sbb;
  return (
    saa >= SQUARES_SAFE_MIN &&
    sbb >= SQUARES_SAFE_MIN &&
    product >= MIN_NORMAL &&
    product <= Number.MAX_VALUE
  );
}

/**
 * The power of 2 `p` with `p <= max < 2 * p`.
 *
 * `Math.log2` can round up to the next integer (for a value just below a power of 2, and to 1024
 * for the largest doubles), so the exponent is corrected. The result is exact, also for the
 * powers of 2 in the subnormal range, so a division by it changes only the exponent of a value.
 *
 * @param max - A finite number above 0.
 * @returns The power of 2 that is at most `max` and above `max / 2`.
 */
export function powerOfTwoBelow(max: number): number {
  let k = Math.floor(Math.log2(max));
  if (2 ** k > max) k--;
  else if (2 ** (k + 1) <= max) k++;
  return 2 ** k;
}

/**
 * The exact scale of data: the power of 2 below the largest absolute value of all `arrays`, so
 * that the data divided by it has its largest value in `[1, 2)`.
 *
 * Returns 1 when a value is not finite (a NaN or an infinite value has no scale and keeps its
 * plain result) or when every value is 0.
 *
 * After the division, two different values differ by at least 2^-53, so a sum of squared
 * deviations is 0 (equal values) or at least about 2^-108, and below 16 per value: it cannot leave
 * the range for any length of data.
 *
 * @param arrays - One or more number arrays. The statistics of one unit share one scale.
 * @returns The scale, a power of 2, or 1.
 */
export function powerOfTwoScaleOf(...arrays: ArrayLike<number>[]): number {
  let max = 0;
  for (const xs of arrays) {
    assertArrayLike('powerOfTwoScaleOf', xs);
    for (let i = 0; i < xs.length; i++) {
      const v = xs[i];
      if (!Number.isFinite(v)) return 1;
      const a = v < 0 ? -v : v;
      if (a > max) max = a;
    }
  }
  return max === 0 ? 1 : powerOfTwoBelow(max);
}

/**
 * The scale for a statistic that squares its variance (a test statistic with a variance in a
 * denominator, a standardized moment): 1 when `variance` is in `[ROOT_SAFE_MIN, 1 / ROOT_SAFE_MIN]`
 * (the plain path loses no digit), else {@link powerOfTwoScaleOf} of `arrays`.
 *
 * A variance of 0 is outside the window: it can stand for squares that underflowed, so the data
 * gets its scale. For constant data the scaled variance is 0 again, and the result is the same.
 * A NaN or an infinite variance is outside the window, so the data of a variance that overflowed
 * gets its scale.
 *
 * @param variance - The variance (or the mean square) that the caller computed on the plain data.
 * @param arrays - The data that the variance came from.
 * @returns The scale, a power of 2, or 1 when the plain path is exact or no scale applies.
 */
export function scaleForVariance(variance: number, ...arrays: ArrayLike<number>[]): number {
  if (variance >= ROOT_SAFE_MIN && variance <= 1 / ROOT_SAFE_MIN) return 1;
  return powerOfTwoScaleOf(...arrays);
}

/**
 * A new array with each element of `xs` divided by `scale`.
 *
 * @param xs - A number array or a typed array.
 * @param scale - A power of 2 from {@link powerOfTwoScaleOf}. The division is exact.
 * @returns The scaled values as a plain array. `xs` is not changed.
 */
export function divideByScale(xs: ArrayLike<number>, scale: number): number[] {
  assertArrayLike('divideByScale', xs);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = xs[i] / scale;
  return out;
}

/**
 * The root of a sum of squared deviations divided by `divisor`: `sqrt(m2 / divisor)` with every
 * digit kept (#1280).
 *
 * The plain root is returned (same bits) when `m2`, the sum that the caller already has from
 * {@link sumSquaredDeviations}, is finite and at least {@link SQUARES_SAFE_MIN}. Else the root
 * is computed again for the data divided by an exact power of 2 and multiplied back. That covers
 * squares that were subnormal (lost digits), a sum that underflowed to 0 and a sum that
 * overflowed. Constant data gives an exact 0. A NaN or an infinite value in `xs` has no scale and
 * gives the plain result.
 *
 * @param xs - The data.
 * @param m2 - `sumSquaredDeviations(xs)`.
 * @param divisor - `n` (uncorrected), `n - 1` (unbiased) or `n + 1` (biased).
 * @returns The root.
 */
export function stdFromSquaredDeviations(
  xs: ArrayLike<number>,
  m2: number,
  divisor: number
): number {
  if (m2 >= SQUARES_SAFE_MIN && m2 < Infinity) return Math.sqrt(m2 / divisor);
  const scale = powerOfTwoScaleOf(xs);
  if (scale === 1) return Math.sqrt(m2 / divisor);
  return scale * Math.sqrt(sumSquaredDeviations(divideByScale(xs, scale)) / divisor);
}

/** The shifted two-pass sum of squared deviations of `xs`, which has at least two numbers. */
function squaredDeviationsFrom(xs: ArrayLike<number>, allFinite: boolean): number {
  const n = xs.length;
  const shift = allFinite ? xs[0] : 0;

  const mean = pairwiseSum(xs, 0, n, shift) / n;
  // Same pairwise tree as `pairwiseSum(d)` + `pairwiseDot(d, d)`, but the
  // deviations are formed in registers — no n-long scratch array.
  const { sumD, sumDD } = pairwiseDeviationSums(xs, mean, 0, n, shift);

  // The (Σd)²/n correction is a rounding residual. When Σd² has already overflowed,
  // that residual overflows too and Inf−Inf becomes NaN. Finite inputs then have an
  // infinite variance, which is Infinity.
  let corrected = sumDD - (sumD * sumD) / n;
  if (allFinite && !Number.isFinite(corrected)) corrected = Infinity;
  // Clamp only genuine negatives (tiny round-off on near-constant input) to 0. Written as
  // `corrected < 0` — NOT `corrected > 0 ? … : 0` — so NaN/±Infinity propagate (both comparisons
  // are false for NaN): variance of data containing NaN must stay NaN, matching NumPy and the
  // generic fallback, not collapse to 0.
  return corrected < 0 ? 0 : corrected;
}

/**
 * Pairwise Σ(xᵢ − μ) and Σ(xᵢ − μ)² over `[start, end)` — the two sums
 * {@link sumSquaredDeviations} needs, without materialising the deviation vector.
 */
function pairwiseDeviationSums(
  xs: ArrayLike<number>,
  mean: number,
  start: number,
  end: number,
  shift = 0
): { sumD: number; sumDD: number } {
  const n = end - start;

  if (n <= PAIRWISE_BLOCK) {
    let d0 = 0,
      d1 = 0,
      d2 = 0,
      d3 = 0,
      d4 = 0,
      d5 = 0,
      d6 = 0,
      d7 = 0;
    let q0 = 0,
      q1 = 0,
      q2 = 0,
      q3 = 0,
      q4 = 0,
      q5 = 0,
      q6 = 0,
      q7 = 0;

    let i = start;
    const limit = start + (n - (n % 8));
    for (; i < limit; i += 8) {
      const a0 = xs[i] - shift - mean;
      const a1 = xs[i + 1] - shift - mean;
      const a2 = xs[i + 2] - shift - mean;
      const a3 = xs[i + 3] - shift - mean;
      const a4 = xs[i + 4] - shift - mean;
      const a5 = xs[i + 5] - shift - mean;
      const a6 = xs[i + 6] - shift - mean;
      const a7 = xs[i + 7] - shift - mean;
      d0 += a0;
      q0 += a0 * a0;
      d1 += a1;
      q1 += a1 * a1;
      d2 += a2;
      q2 += a2 * a2;
      d3 += a3;
      q3 += a3 * a3;
      d4 += a4;
      q4 += a4 * a4;
      d5 += a5;
      q5 += a5 * a5;
      d6 += a6;
      q6 += a6 * a6;
      d7 += a7;
      q7 += a7 * a7;
    }

    let tailD = 0;
    let tailDD = 0;
    for (; i < end; i++) {
      const a = xs[i] - shift - mean;
      tailD += a;
      tailDD += a * a;
    }

    return {
      sumD: d0 + d1 + (d2 + d3) + (d4 + d5 + (d6 + d7)) + tailD,
      sumDD: q0 + q1 + (q2 + q3) + (q4 + q5 + (q6 + q7)) + tailDD,
    };
  }

  const half = (n >> 1) - ((n >> 1) % 8);
  const left = pairwiseDeviationSums(xs, mean, start, start + half, shift);
  const right = pairwiseDeviationSums(xs, mean, start + half, end, shift);
  return { sumD: left.sumD + right.sumD, sumDD: left.sumDD + right.sumDD };
}

/**
 * Cumulative sum with **Neumaier compensation** — each prefix total is written to `out[i]` carrying
 * the low-order bits a naive running sum throws away.
 *
 * A cumulative sum is an inherently sequential prefix scan, so pairwise summation does not apply:
 * you need every intermediate total, not just the final one. `np.cumsum` therefore accumulates
 * naively and its tail drifts by **O(n)·ε** (relErr ~1.3e-11 over 10⁶ terms). Carrying a running
 * compensation costs a few extra flops per element, no extra memory, and makes every prefix exact
 * for practical purposes — a strict improvement over NumPy where accumulated drift matters (e.g.
 * integrating a signal).
 *
 * Writes `out[i]` for `i` in `[0, xs.length)`; `out` may be a `number[]` or a `Float64Array`.
 */
export function neumaierCumsum(xs: ArrayLike<number>, out: { [index: number]: number }): void {
  assertArrayLike('neumaierCumsum', xs);
  let sum = 0;
  let c = 0; // running compensation for the lost low-order bits

  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const t = sum + x;
    c += Math.abs(sum) >= Math.abs(x) ? sum - t + x : x - t + sum;
    sum = t;
    out[i] = sum + c;
  }
}

/** The minimum and the maximum of a range, with the index of each. */
export interface Extrema {
  min: number;
  max: number;
  minIdx: number;
  maxIdx: number;
}

/**
 * The minimum and the maximum of `xs[start..end)`, with their indexes.
 *
 * NaN propagates, as in mathjs and NumPy (`np.min`). When the range holds a NaN, `min` and `max`
 * are NaN, and both indexes are the index of the first NaN. An equal later value does not
 * replace the first one. An empty range gives `Infinity`, `-Infinity` and index -1.
 *
 * The workers of `@danielsimonjr/mathts-workerpool` cannot import core, so they keep a copy
 * (`_workerExtrema`). The parity test of that package compares core `extrema` and `_workerExtrema`.
 */
export function extrema(xs: ArrayLike<number>, start = 0, end?: number): Extrema {
  assertArrayLike('extrema', xs);
  end ??= xs.length;
  let min = Infinity;
  let max = -Infinity;
  let minIdx = -1;
  let maxIdx = -1;
  for (let i = start; i < end; i++) {
    const x = xs[i];
    if (x !== x) return { min: NaN, max: NaN, minIdx: i, maxIdx: i };
    if (x < min || minIdx < 0) {
      min = x;
      minIdx = i;
    }
    if (x > max || maxIdx < 0) {
      max = x;
      maxIdx = i;
    }
  }
  return { min, max, minIdx, maxIdx };
}
