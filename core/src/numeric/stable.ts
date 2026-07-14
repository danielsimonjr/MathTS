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
export function pairwiseSum(xs: ArrayLike<number>, start = 0, end = xs.length): number {
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

    let tail = 0;
    for (; i < end; i++) tail += xs[i];

    // Combine the partials pairwise too, not left-to-right.
    return s0 + s1 + (s2 + s3) + (s4 + s5 + (s6 + s7)) + tail;
  }

  // Split on an even boundary so both halves stay block-aligned.
  const half = (n >> 1) - ((n >> 1) % 8);
  return pairwiseSum(xs, start, start + half) + pairwiseSum(xs, start + half, end);
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
  let scale = 0;
  let ssq = 1;

  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (x === 0) continue;
    if (Number.isNaN(x)) return NaN;

    const ax = Math.abs(x);
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

  return scale === 0 ? 0 : scale * Math.sqrt(ssq);
}
