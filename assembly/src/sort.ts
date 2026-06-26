/**
 * Sort hot-loop kernels — AssemblyScript parity port (Slice 5.7a).
 *
 * Mirrors the algorithms in:
 *   wasm-rust/crates/mathts-wasm/src/sort.rs
 *
 * Three exported functions:
 *   - `sort_f64`    — in-place ascending sort (NaN-last, typed-array ABI).
 *   - `argsort_f64` — return Int32Array of permutation indices (NaN-last, STABLE).
 *   - `rank_f64`    — return Int32Array of ranks (0-indexed, NaN-last, STABLE).
 *
 * Algorithm (Rust→AS migration Phase 6):
 *   - `sort_f64` uses INTROSORT — a 3-way (Dutch-national-flag) quicksort with
 *     a median-of-three pivot, an insertion-sort cutoff for small ranges, and a
 *     heapsort fallback once the recursion depth exceeds 2·⌊log2 n⌋. The 3-way
 *     partition keeps duplicate-heavy input at O(n log n) (the old Lomuto
 *     quicksort degraded to O(n²)); the depth-limited heapsort guarantees
 *     O(n log n) worst case on any adversarial arrangement.
 *   - `argsort_f64` sorts the index array with a STABLE total-order comparator
 *     that breaks value ties by original index. This makes the permutation
 *     exactly match the JS stable reference (`Array.prototype.sort` is stable
 *     per ES2019) on tie-heavy input. Because the (value, index) key is a total
 *     order with no real ties, every comparison-based sort yields the identical
 *     permutation — so the median-of-three quicksort/heapsort here is stable by
 *     construction. The all-duplicates case maps to a strictly index-ordered
 *     (already-sorted) key sequence, which median-of-three handles in O(n log n).
 *
 * NaN ordering: NaN sorts after all finite values (NaN-last), matching the
 * Rust kernel and JS `Array.prototype.sort`.
 */

// ---------------------------------------------------------------------------
// Comparators (NaN-last total order)
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

/**
 * Stable index comparator: compares the values `data[ia]` / `data[ib]`
 * (NaN-last) and breaks ties by the ORIGINAL index, so equal values keep their
 * input order — matching the JS stable reference. `ia`/`ib` are original element
 * indices (the contents of the permutation array), which are unique, so this is
 * a strict total order (it never returns 0 for distinct elements).
 */
@inline
function cmpIdxStable(data: Float64Array, ia: i32, ib: i32): i32 {
  const c: i32 = cmpNanLast(data[ia], data[ib]);
  if (c != 0) return c;
  return ia < ib ? -1 : (ia > ib ? 1 : 0);
}

/** ⌊log2 n⌋ for the introsort depth limit (n ≥ 1). */
@inline
function ilog2(n: i32): i32 {
  let v: i32 = n;
  let r: i32 = 0;
  while (v > 1) {
    v >>= 1;
    r++;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Value introsort (operates on Float64Array in place)
// ---------------------------------------------------------------------------

/** Median (by NaN-last order) of three f64 values — the 3-way pivot. */
@inline
function _median3(a: f64, b: f64, c: f64): f64 {
  if (cmpNanLast(a, b) < 0) {
    if (cmpNanLast(b, c) < 0) return b;
    return cmpNanLast(a, c) < 0 ? c : a;
  }
  if (cmpNanLast(a, c) < 0) return a;
  return cmpNanLast(b, c) < 0 ? c : b;
}

function _insertionSort(arr: Float64Array, lo: i32, hi: i32): void {
  for (let i: i32 = lo + 1; i <= hi; i++) {
    const key: f64 = arr[i];
    let j: i32 = i - 1;
    while (j >= lo && cmpNanLast(arr[j], key) > 0) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
}

/** Max-heap sift-down over arr[lo .. lo+n-1], rooted at relative index `start`. */
function _siftDown(arr: Float64Array, lo: i32, start: i32, n: i32): void {
  let root: i32 = start;
  while (true) {
    let child: i32 = 2 * root + 1;
    if (child >= n) break;
    if (child + 1 < n && cmpNanLast(arr[lo + child], arr[lo + child + 1]) < 0) child++;
    if (cmpNanLast(arr[lo + root], arr[lo + child]) < 0) {
      const t: f64 = arr[lo + root];
      arr[lo + root] = arr[lo + child];
      arr[lo + child] = t;
      root = child;
    } else {
      break;
    }
  }
}

/** Heapsort arr[lo..hi] ascending (NaN-last) — the introsort depth-limit fallback. */
function _heapsort(arr: Float64Array, lo: i32, hi: i32): void {
  const n: i32 = hi - lo + 1;
  for (let start: i32 = (n >> 1) - 1; start >= 0; start--) {
    _siftDown(arr, lo, start, n);
  }
  for (let end: i32 = n - 1; end > 0; end--) {
    const t: f64 = arr[lo];
    arr[lo] = arr[lo + end];
    arr[lo + end] = t;
    _siftDown(arr, lo, 0, end);
  }
}

/** Introsort: 3-way quicksort + median-of-3 + insertion cutoff + heapsort fallback. */
function _introsort(arr: Float64Array, lo: i32, hi: i32, depth: i32): void {
  let l: i32 = lo;
  let h: i32 = hi;
  let d: i32 = depth;
  while (h - l > 16) {
    if (d == 0) {
      _heapsort(arr, l, h);
      return;
    }
    d--;
    const mid: i32 = l + ((h - l) >> 1);
    const pivot: f64 = _median3(arr[l], arr[mid], arr[h]);
    // Dutch-national-flag 3-way partition: [l,lt) < pivot, [lt,i) == pivot, (gt,h] > pivot.
    let lt: i32 = l;
    let gt: i32 = h;
    let i: i32 = l;
    while (i <= gt) {
      const c: i32 = cmpNanLast(arr[i], pivot);
      if (c < 0) {
        const t: f64 = arr[lt]; arr[lt] = arr[i]; arr[i] = t;
        lt++;
        i++;
      } else if (c > 0) {
        const t: f64 = arr[i]; arr[i] = arr[gt]; arr[gt] = t;
        gt--;
      } else {
        i++;
      }
    }
    // Recurse into the smaller side, loop on the larger (bounded stack depth).
    if (lt - l < h - gt) {
      _introsort(arr, l, lt - 1, d);
      l = gt + 1;
    } else {
      _introsort(arr, gt + 1, h, d);
      h = lt - 1;
    }
  }
  _insertionSort(arr, l, h);
}

// ---------------------------------------------------------------------------
// Index introsort (stable: sorts Int32Array by Float64Array key + index tiebreak)
// ---------------------------------------------------------------------------

/** Median index (by the stable comparator) of three positions — returns the pivot key. */
@inline
function _median3Idx(data: Float64Array, idx: Int32Array, a: i32, b: i32, c: i32): i32 {
  const ia: i32 = idx[a];
  const ib: i32 = idx[b];
  const ic: i32 = idx[c];
  if (cmpIdxStable(data, ia, ib) < 0) {
    if (cmpIdxStable(data, ib, ic) < 0) return ib;
    return cmpIdxStable(data, ia, ic) < 0 ? ic : ia;
  }
  if (cmpIdxStable(data, ia, ic) < 0) return ia;
  return cmpIdxStable(data, ib, ic) < 0 ? ic : ib;
}

function _insertionSortIdx(data: Float64Array, idx: Int32Array, lo: i32, hi: i32): void {
  for (let i: i32 = lo + 1; i <= hi; i++) {
    const key: i32 = idx[i];
    let j: i32 = i - 1;
    while (j >= lo && cmpIdxStable(data, idx[j], key) > 0) {
      idx[j + 1] = idx[j];
      j--;
    }
    idx[j + 1] = key;
  }
}

function _siftDownIdx(data: Float64Array, idx: Int32Array, lo: i32, start: i32, n: i32): void {
  let root: i32 = start;
  while (true) {
    let child: i32 = 2 * root + 1;
    if (child >= n) break;
    if (child + 1 < n && cmpIdxStable(data, idx[lo + child], idx[lo + child + 1]) < 0) child++;
    if (cmpIdxStable(data, idx[lo + root], idx[lo + child]) < 0) {
      const t: i32 = idx[lo + root];
      idx[lo + root] = idx[lo + child];
      idx[lo + child] = t;
      root = child;
    } else {
      break;
    }
  }
}

function _heapsortIdx(data: Float64Array, idx: Int32Array, lo: i32, hi: i32): void {
  const n: i32 = hi - lo + 1;
  for (let start: i32 = (n >> 1) - 1; start >= 0; start--) {
    _siftDownIdx(data, idx, lo, start, n);
  }
  for (let end: i32 = n - 1; end > 0; end--) {
    const t: i32 = idx[lo];
    idx[lo] = idx[lo + end];
    idx[lo + end] = t;
    _siftDownIdx(data, idx, lo, 0, end);
  }
}

/**
 * Stable index introsort. The (value, original-index) key is a total order, so
 * the result is the unique stable permutation regardless of the algorithm; the
 * 3-way partition + heapsort fallback only guarantee O(n log n) timing.
 */
function _introsortIdx(data: Float64Array, idx: Int32Array, lo: i32, hi: i32, depth: i32): void {
  let l: i32 = lo;
  let h: i32 = hi;
  let dep: i32 = depth;
  while (h - l > 16) {
    if (dep == 0) {
      _heapsortIdx(data, idx, l, h);
      return;
    }
    dep--;
    const mid: i32 = l + ((h - l) >> 1);
    const pivotKey: i32 = _median3Idx(data, idx, l, mid, h);
    let lt: i32 = l;
    let gt: i32 = h;
    let i: i32 = l;
    while (i <= gt) {
      const c: i32 = cmpIdxStable(data, idx[i], pivotKey);
      if (c < 0) {
        const t: i32 = idx[lt]; idx[lt] = idx[i]; idx[i] = t;
        lt++;
        i++;
      } else if (c > 0) {
        const t: i32 = idx[i]; idx[i] = idx[gt]; idx[gt] = t;
        gt--;
      } else {
        i++;
      }
    }
    if (lt - l < h - gt) {
      _introsortIdx(data, idx, l, lt - 1, dep);
      l = gt + 1;
    } else {
      _introsortIdx(data, idx, gt + 1, h, dep);
      h = lt - 1;
    }
  }
  _insertionSortIdx(data, idx, l, h);
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
  if (n > 1) _introsort(data, 0, n - 1, 2 * ilog2(n));
  return data;
}

/**
 * Return an Int32Array of permutation indices (argsort), STABLE.
 * After the call, `data[result[0]] ≤ data[result[1]] ≤ …` (NaN-last); equal
 * values keep their original input order, matching the JS stable reference.
 */
export function argsort_f64(data: Float64Array): Int32Array {
  const n: i32 = data.length;
  const idx = new Int32Array(n);
  for (let i: i32 = 0; i < n; i++) idx[i] = i;
  if (n > 1) _introsortIdx(data, idx, 0, n - 1, 2 * ilog2(n));
  return idx;
}

/**
 * Return an Int32Array where `result[i]` = rank (0-indexed position in sorted
 * order) of `data[i]` (NaN-last).  Equivalent to inverting the stable argsort.
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
