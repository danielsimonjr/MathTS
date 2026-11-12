/**
 * Median of a flat finite `number[]` via quickselect (O(n) average).
 * Empty → NaN; does not mutate the caller's array.
 */
export function medianNumbers(arr: ArrayLike<number>): number {
  const n = arr.length;
  if (n === 0) return NaN;
  if (n === 1) return arr[0];
  const work = new Array<number>(n);
  for (let i = 0; i < n; i++) work[i] = arr[i];
  const mid = (n - 1) >>> 1;
  if (n % 2 === 1) {
    return quickSelectInPlace(work, 0, n - 1, mid);
  }
  const lower = quickSelectInPlace(work, 0, n - 1, mid);
  const upper = quickSelectInPlace(work, 0, n - 1, mid + 1);
  return (lower + upper) / 2;
}

function quickSelectInPlace(a: number[], lo: number, hi: number, k: number): number {
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

function swap(a: number[], i: number, j: number): void {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
}
