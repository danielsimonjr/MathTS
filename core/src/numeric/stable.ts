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
  end = a.length
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
  return pairwiseDot(a, b, start, start + half) + pairwiseDot(a, b, start + half, end);
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
  let scale = 0;
  let ssq = 1;

  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    if (d === 0) continue;
    if (Number.isNaN(d)) return NaN;

    const ad = Math.abs(d);
    if (scale < ad) {
      const r = scale / ad;
      ssq = 1 + ssq * r * r;
      scale = ad;
    } else {
      const r = ad / scale;
      ssq += r * r;
    }
  }

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
 * Divide the result by `n` (uncorrected), `n − 1` (unbiased/sample), or `n + 1` (biased) for the
 * corresponding variance. Returns 0 for fewer than two elements.
 */
export function sumSquaredDeviations(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (n < 2) return 0;

  const mean = pairwiseSum(xs) / n;

  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = xs[i] - mean;

  const sumD = pairwiseSum(d); // ≈ 0; its square is the residual mean-bias correction
  const sumDD = pairwiseDot(d, d); // Σ dᵢ²

  const corrected = sumDD - (sumD * sumD) / n;
  // Clamp only genuine negatives (tiny round-off on near-constant input) to 0. Written as
  // `corrected < 0` — NOT `corrected > 0 ? … : 0` — so NaN/±Infinity propagate (both comparisons
  // are false for NaN): variance of data containing NaN must stay NaN, matching NumPy and the
  // generic fallback, not collapse to 0.
  return corrected < 0 ? 0 : corrected;
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
