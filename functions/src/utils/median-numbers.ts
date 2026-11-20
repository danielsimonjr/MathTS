/**
 * Median of a flat numeric vector by quickselect (O(n) average), on one `Float64Array`
 * work buffer. Nothing here sorts, except as the bounded fallback of {@link quickSelectInPlace}.
 *
 * The caller owns the NaN rule: quickselect has no defined result when a value is NaN, so a
 * caller that can see NaN checks first. The copy that fills the work buffer is the only copy
 * of the input.
 */

/**
 * Median of `arr`. Empty gives NaN. The caller's array is not changed.
 *
 * @example
 * ```ts
 * medianNumbers([3, 1, 2]); // 2
 * medianNumbers(Float64Array.of(1, 2, 3, 4)); // 2.5
 * ```
 */
export function medianNumbers(arr: ArrayLike<number>): number {
  const n = arr.length;
  if (n === 0) return NaN;
  if (n === 1) return arr[0];
  const work = new Float64Array(n);
  for (let i = 0; i < n; i++) work[i] = arr[i];
  return medianInPlace(work);
}

/**
 * Median of the values in `work`, which this function reorders. Empty gives NaN.
 * `work` must hold no NaN.
 *
 * @example
 * ```ts
 * medianInPlace(Float64Array.of(5, 1, 4, 2, 3)); // 3
 * ```
 */
export function medianInPlace(work: Float64Array): number {
  const n = work.length;
  if (n === 0) return NaN;
  if (n === 1) return work[0];
  const mid = (n - 1) >>> 1;
  const lower = quickSelectInPlace(work, 0, n - 1, mid);
  if (n % 2 === 1) return lower;
  // After the select at `mid`, every value right of it is >= work[mid]: the next order
  // statistic is the smallest of them.
  return middleOf(lower, minFrom(work, mid + 1));
}

/**
 * The smallest value of `a` from index `start` to the end. `start` must be below `a.length`.
 * After a select at `k`, `minFrom(a, k + 1)` is the next order statistic.
 */
export function minFrom(a: Float64Array, start: number): number {
  let m = a[start];
  for (let i = start + 1; i < a.length; i++) {
    const v = a[i];
    if (v < m) m = v;
  }
  return m;
}

/**
 * The value halfway between `lower` and `upper` (`lower <= upper`), without overflow.
 * Equal values return that value, so `-0` stays `-0`. Values on both sides of zero cannot
 * overflow in the sum. Values on one side use `lower + (upper - lower) / 2`, whose
 * difference cannot overflow.
 */
function middleOf(lower: number, upper: number): number {
  if (lower === upper) return lower;
  if (lower <= 0 && upper >= 0) return (lower + upper) / 2;
  return lower + (upper - lower) / 2;
}

/**
 * Quickselect: reorder `a[lo..hi]` so that `a[k]` is its k-th smallest value, every value left of
 * `k` is not above it and every value right of `k` is not below it. Returns `a[k]`. `a` must hold
 * no NaN.
 *
 * A range of more than {@link FIXED_SAMPLE_SPAN} values takes its pivot as the median of three
 * pseudo-random positions, so a sorted, reversed, rotated or patterned input does not give a bad
 * split on every pass (a fixed first, middle and last sample gave O(n^2) on a rotated sorted
 * array). After `maxPasses` passes on such ranges, the rest of the range is sorted, which bounds
 * the cost at O(n log n) on any input (introselect). The default budget is twice the depth of a
 * balanced split plus 8, about 1.5 times the longest run measured on random data, so random data
 * does not reach the fallback. The positions come from a fixed seed (the length of the range),
 * so equal input always gives the same passes.
 *
 * A smaller range keeps the fixed sample and has no budget: its cost has a constant bound, and
 * the pseudo-random sample made a selection from 3 to 33 values 1.7 to 2.9 times slower.
 */
export function quickSelectInPlace(
  a: Float64Array,
  lo: number,
  hi: number,
  k: number,
  // 32 - clz32(n) is ceil(log2(n + 1)).
  maxPasses: number = 2 * (32 - Math.clz32(hi - lo + 1)) + 8
): number {
  // The xorshift32 state is never 0, so it never sticks.
  let state = (hi - lo + 1) | 1;
  for (let passes = maxPasses; lo < hi; passes--) {
    const span = hi - lo + 1;
    // Move the pivot to `a[hi]`.
    if (span <= FIXED_SAMPLE_SPAN) {
      const mid = (lo + hi) >>> 1;
      if (a[mid] < a[lo]) swap(a, lo, mid);
      if (a[hi] < a[lo]) swap(a, lo, hi);
      if (a[mid] < a[hi]) swap(a, mid, hi);
    } else {
      if (passes <= 0) {
        a.subarray(lo, hi + 1).sort();
        return a[k];
      }
      const x = lo + (((state = xorshift32(state)) >>> 0) % span);
      const y = lo + (((state = xorshift32(state)) >>> 0) % span);
      const z = lo + (((state = xorshift32(state)) >>> 0) % span);
      swap(a, medianOfThree(a, x, y, z), hi);
    }
    const pivot = a[hi];

    let i = lo;
    let j = hi - 1;
    while (true) {
      while (a[i] < pivot) i++;
      while (j > lo && a[j] > pivot) j--;
      if (i >= j) break;
      swap(a, i, j);
      i++;
      j--;
    }
    swap(a, i, hi);

    if (k === i) return a[i];
    if (k < i) hi = i - 1;
    else lo = i + 1;
  }
  return a[lo];
}

/**
 * The largest range that takes its pivot from the first, middle and last value. Measured: the
 * selection from 3, 9 and 33 values costs the same as before with 64, and 1.7 times more at 33
 * values with 16.
 */
const FIXED_SAMPLE_SPAN = 64;

/** The next state of a 32-bit xorshift generator. A state that is not 0 never becomes 0. */
function xorshift32(state: number): number {
  state ^= state << 13;
  state ^= state >>> 17;
  return state ^ (state << 5);
}

/** The index (of `x`, `y` and `z`) of the median of `a[x]`, `a[y]` and `a[z]`. */
function medianOfThree(a: Float64Array, x: number, y: number, z: number): number {
  if (a[x] < a[y]) return a[y] < a[z] ? y : a[x] < a[z] ? z : x;
  return a[x] < a[z] ? x : a[y] < a[z] ? z : y;
}

function swap(a: Float64Array, i: number, j: number): void {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
}
