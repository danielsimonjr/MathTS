/**
 * Median of a flat numeric vector by quickselect (O(n) average), on one `Float64Array`
 * work buffer. Nothing here sorts.
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
  let upper = work[mid + 1];
  for (let i = mid + 2; i < n; i++) {
    const v = work[i];
    if (v < upper) upper = v;
  }
  return middleOf(lower, upper);
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

function quickSelectInPlace(a: Float64Array, lo: number, hi: number, k: number): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (a[mid] < a[lo]) swap(a, lo, mid);
    if (a[hi] < a[lo]) swap(a, lo, hi);
    if (a[mid] < a[hi]) swap(a, mid, hi);
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

function swap(a: Float64Array, i: number, j: number): void {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
}
