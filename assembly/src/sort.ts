/**
 * Sort hot-loop kernels — AssemblyScript parity port (Slice 5.7a).
 *
 * Mirrors the algorithms in:
 *   wasm-rust/crates/mathts-wasm/src/sort.rs
 *
 * Three exported functions:
 *   - `sort_f64`    — in-place ascending sort (NaN-last, typed-array ABI).
 *   - `argsort_f64` — return Int32Array of permutation indices (NaN-last).
 *   - `rank_f64`    — return Int32Array of ranks (0-indexed, NaN-last).
 *
 * AssemblyScript does not expose a built-in generic sort with a custom
 * comparator that works on value types at compile-time; the simplest
 * portable approach is an insertion sort (O(n²)) for small arrays and a
 * recursive quicksort for larger ones.  Since these kernels are only called
 * above a 16 K threshold via the bridge, the n²-degenerate case on
 * already-sorted input is avoided by a median-of-three pivot.
 *
 * NaN ordering: NaN sorts after all finite values (NaN-last), matching the
 * Rust kernel and JS `Array.prototype.sort`.
 */

// ---------------------------------------------------------------------------
// Comparator helper (NaN-last total order)
// ---------------------------------------------------------------------------

/** Returns negative if a < b, 0 if a == b, positive if a > b. NaN > finite. */
@inline
function cmpNanLast(a: f64, b: f64): i32 {
  // Both finite / equal?
  if (a < b) return -1;
  if (a > b) return 1;
  if (a == b) return 0;
  // At least one is NaN.
  if (isNaN(a) && isNaN(b)) return 0;
  if (isNaN(a)) return 1;   // a is NaN → a > b (NaN-last)
  return -1;                 // b is NaN → a < b
}

// ---------------------------------------------------------------------------
// Quicksort helpers (operate on Float64Array in place)
// ---------------------------------------------------------------------------

function _medianOfThree(arr: Float64Array, lo: i32, hi: i32): i32 {
  const mid: i32 = lo + ((hi - lo) >> 1);
  // Sort lo, mid, hi and return the median index.
  if (cmpNanLast(arr[lo], arr[mid]) > 0) {
    const t = arr[lo]; arr[lo] = arr[mid]; arr[mid] = t;
  }
  if (cmpNanLast(arr[lo], arr[hi]) > 0) {
    const t = arr[lo]; arr[lo] = arr[hi]; arr[hi] = t;
  }
  if (cmpNanLast(arr[mid], arr[hi]) > 0) {
    const t = arr[mid]; arr[mid] = arr[hi]; arr[hi] = t;
  }
  return mid;
}

/** In-place quicksort on arr[lo..hi] (inclusive). */
function _qsort(arr: Float64Array, lo: i32, hi: i32): void {
  if (hi - lo < 16) {
    // Insertion sort for small ranges.
    for (let i: i32 = lo + 1; i <= hi; i++) {
      const key: f64 = arr[i];
      let j: i32 = i - 1;
      while (j >= lo && cmpNanLast(arr[j], key) > 0) {
        arr[j + 1] = arr[j];
        j--;
      }
      arr[j + 1] = key;
    }
    return;
  }
  // Median-of-three pivot — swap to hi.
  const pivIdx: i32 = _medianOfThree(arr, lo, hi);
  const pivot: f64 = arr[pivIdx];
  const t = arr[pivIdx]; arr[pivIdx] = arr[hi]; arr[hi] = t;

  let i: i32 = lo - 1;
  for (let j: i32 = lo; j < hi; j++) {
    if (cmpNanLast(arr[j], pivot) <= 0) {
      i++;
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }
  const pivFinal: i32 = i + 1;
  const tmp2 = arr[pivFinal]; arr[pivFinal] = arr[hi]; arr[hi] = tmp2;

  _qsort(arr, lo, pivFinal - 1);
  _qsort(arr, pivFinal + 1, hi);
}

// ---------------------------------------------------------------------------
// Quicksort on Int32Array by Float64Array key (for argsort)
// ---------------------------------------------------------------------------

function _medianOfThreeIdx(data: Float64Array, idx: Int32Array, lo: i32, hi: i32): i32 {
  const mid: i32 = lo + ((hi - lo) >> 1);
  if (cmpNanLast(data[idx[lo]], data[idx[mid]]) > 0) {
    const t = idx[lo]; idx[lo] = idx[mid]; idx[mid] = t;
  }
  if (cmpNanLast(data[idx[lo]], data[idx[hi]]) > 0) {
    const t = idx[lo]; idx[lo] = idx[hi]; idx[hi] = t;
  }
  if (cmpNanLast(data[idx[mid]], data[idx[hi]]) > 0) {
    const t = idx[mid]; idx[mid] = idx[hi]; idx[hi] = t;
  }
  return mid;
}

/** Sort idx[lo..hi] by data[idx[i]] (ascending, NaN-last). */
function _qsortIdx(data: Float64Array, idx: Int32Array, lo: i32, hi: i32): void {
  if (hi - lo < 16) {
    for (let i: i32 = lo + 1; i <= hi; i++) {
      const key: i32 = idx[i];
      const keyVal: f64 = data[key];
      let j: i32 = i - 1;
      while (j >= lo && cmpNanLast(data[idx[j]], keyVal) > 0) {
        idx[j + 1] = idx[j];
        j--;
      }
      idx[j + 1] = key;
    }
    return;
  }
  const pivIdx: i32 = _medianOfThreeIdx(data, idx, lo, hi);
  const pivVal: f64 = data[idx[pivIdx]];
  const t = idx[pivIdx]; idx[pivIdx] = idx[hi]; idx[hi] = t;

  let i: i32 = lo - 1;
  for (let j: i32 = lo; j < hi; j++) {
    if (cmpNanLast(data[idx[j]], pivVal) <= 0) {
      i++;
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
  }
  const pivFinal: i32 = i + 1;
  const tmp2 = idx[pivFinal]; idx[pivFinal] = idx[hi]; idx[hi] = tmp2;

  _qsortIdx(data, idx, lo, pivFinal - 1);
  _qsortIdx(data, idx, pivFinal + 1, hi);
}

// ---------------------------------------------------------------------------
// Public exports (typed-array ABI)
// ---------------------------------------------------------------------------

/**
 * Sort `data` in place, ascending, NaN-last.
 * Returns the same `data` array for convenience.
 */
export function sort_f64(data: Float64Array): Float64Array {
  const n: i32 = data.length;
  if (n > 1) _qsort(data, 0, n - 1);
  return data;
}

/**
 * Return an Int32Array of permutation indices (argsort).
 * After the call, `data[result[0]] ≤ data[result[1]] ≤ …` (NaN-last).
 */
export function argsort_f64(data: Float64Array): Int32Array {
  const n: i32 = data.length;
  const idx = new Int32Array(n);
  for (let i: i32 = 0; i < n; i++) idx[i] = i;
  if (n > 1) _qsortIdx(data, idx, 0, n - 1);
  return idx;
}

/**
 * Return an Int32Array where `result[i]` = rank (0-indexed position in sorted
 * order) of `data[i]` (NaN-last).  Equivalent to inverting the argsort.
 */
export function rank_f64(data: Float64Array): Int32Array {
  const n: i32 = data.length;
  const idx = argsort_f64(data);
  const out = new Int32Array(n);
  for (let k: i32 = 0; k < n; k++) {
    out[idx[k]] = k;
  }
  return out;
}
