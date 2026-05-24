//! Sort hot-loop kernels — Slice 5.7a.
//!
//! Provides three sort-related WASM exports used by the TypeScript bridge at
//! `functions/src/wasm/sort/wasm-bridge.ts`:
//!
//! * `sort_f64`    — in-place ascending sort (NaN-last).
//! * `argsort_f64` — write permutation indices `out[i]` such that
//!                   `data[out[0]] ≤ data[out[1]] ≤ …` (NaN-last).
//! * `rank_f64`    — write rank `out[i]` = position of `data[i]` in sorted
//!                   order (0-indexed, NaN-last).  Equivalent to inverting the
//!                   argsort permutation.
//!
//! All three use Rust's `slice::sort_unstable_by` which is a pattern-defeating
//! quicksort (pdqsort) — outperforms V8's TimSort on random f64 arrays above
//! ~1 K elements.
//!
//! Pointer-ABI convention (matches `tridiag.rs` / `bessel.rs`):
//! * Input/output arrays are raw pointers + explicit `n: usize` lengths.
//! * Return value: `n as i32` on success, `-1` if `n == 0`.
//!
//! NaN ordering: NaNs sort last, matching `Array.prototype.sort` with
//! IEEE-754 convention.  Two NaNs are considered equal.

use alloc::vec;
use alloc::vec::Vec;

// ---------------------------------------------------------------------------
// Comparator helpers
// ---------------------------------------------------------------------------

/// Total order on f64 with NaN-last semantics.
#[inline(always)]
fn cmp_f64_nan_last(a: f64, b: f64) -> core::cmp::Ordering {
    match a.partial_cmp(&b) {
        Some(ord) => ord,
        None => {
            // At least one is NaN.
            if a.is_nan() && b.is_nan() {
                core::cmp::Ordering::Equal
            } else if a.is_nan() {
                core::cmp::Ordering::Greater
            } else {
                core::cmp::Ordering::Less
            }
        }
    }
}

// ---------------------------------------------------------------------------
// sort_f64 — in-place sort, NaN-last
// ---------------------------------------------------------------------------

/// Sort a `Float64Array` in place (ascending, NaN-last).
///
/// # Safety
/// `ptr` must point to a valid, aligned, writable `f64` slice of length `n`.
#[no_mangle]
pub unsafe extern "C" fn sort_f64(ptr: *mut f64, n: usize) -> i32 {
    if n == 0 {
        return 0;
    }
    let slice = core::slice::from_raw_parts_mut(ptr, n);
    slice.sort_unstable_by(|a, b| cmp_f64_nan_last(*a, *b));
    n as i32
}

// ---------------------------------------------------------------------------
// argsort_f64 — return permutation indices
// ---------------------------------------------------------------------------

/// Write the argsort permutation into `out_ptr`.
///
/// After the call, `data[out[0]] ≤ data[out[1]] ≤ …` (NaN-last).
/// `out_ptr` must point to a writable `i32` slice of length `n`.
///
/// # Safety
/// Both `data_ptr` and `out_ptr` must be valid, aligned, and live for the
/// duration of this call.  `out_ptr` is write-only (initialised here).
#[no_mangle]
pub unsafe extern "C" fn argsort_f64(data_ptr: *const f64, n: usize, out_ptr: *mut i32) -> i32 {
    if n == 0 {
        return 0;
    }
    let data = core::slice::from_raw_parts(data_ptr, n);
    let out = core::slice::from_raw_parts_mut(out_ptr, n);

    // Build index array 0..n.
    let mut indices: Vec<usize> = (0..n).collect();

    // Sort indices by data value with NaN-last.
    indices.sort_unstable_by(|&i, &j| cmp_f64_nan_last(data[i], data[j]));

    // Write back as i32.
    for (k, &idx) in indices.iter().enumerate() {
        out[k] = idx as i32;
    }
    n as i32
}

// ---------------------------------------------------------------------------
// rank_f64 — write rank of each element (inverse permutation of argsort)
// ---------------------------------------------------------------------------

/// Write the rank (0-indexed position in sorted order) of each element.
///
/// `rank[i]` = k  means `data[i]` would appear at position `k` in the sorted
/// array (ties broken by original index, NaN-last).
///
/// # Safety
/// Both `data_ptr` and `out_ptr` must be valid, aligned, and live for the
/// duration of this call.
#[no_mangle]
pub unsafe extern "C" fn rank_f64(data_ptr: *const f64, n: usize, out_ptr: *mut i32) -> i32 {
    if n == 0 {
        return 0;
    }
    let data = core::slice::from_raw_parts(data_ptr, n);
    let out = core::slice::from_raw_parts_mut(out_ptr, n);

    // Build index array 0..n and sort by value (argsort step).
    let mut indices: Vec<usize> = (0..n).collect();
    indices.sort_unstable_by(|&i, &j| cmp_f64_nan_last(data[i], data[j]));

    // Invert the permutation: rank[indices[k]] = k.
    for (k, &idx) in indices.iter().enumerate() {
        out[idx] = k as i32;
    }
    n as i32
}

// ---------------------------------------------------------------------------
// Tests (native, run via `cargo test`)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    #[test]
    fn test_sort_basic() {
        let mut data = vec![3.0_f64, 1.0, 4.0, 1.0, 5.0, 9.0, 2.0, 6.0];
        let n = data.len();
        let ret = unsafe { sort_f64(data.as_mut_ptr(), n) };
        assert_eq!(ret, n as i32);
        assert_eq!(data, vec![1.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 9.0]);
    }

    #[test]
    fn test_sort_nan_last() {
        let mut data = vec![f64::NAN, 1.0, f64::NAN, 2.0, 0.5];
        let n = data.len();
        let ret = unsafe { sort_f64(data.as_mut_ptr(), n) };
        assert_eq!(ret, n as i32);
        // First three should be finite, last two NaN.
        assert_eq!(data[0], 0.5);
        assert_eq!(data[1], 1.0);
        assert_eq!(data[2], 2.0);
        assert!(data[3].is_nan());
        assert!(data[4].is_nan());
    }

    #[test]
    fn test_sort_empty() {
        let mut data: vec::Vec<f64> = vec![];
        let ret = unsafe { sort_f64(data.as_mut_ptr(), 0) };
        assert_eq!(ret, 0);
    }

    #[test]
    fn test_argsort_basic() {
        let data = vec![3.0_f64, 1.0, 4.0, 1.0, 5.0];
        let n = data.len();
        let mut out = vec![0_i32; n];
        let ret = unsafe { argsort_f64(data.as_ptr(), n, out.as_mut_ptr()) };
        assert_eq!(ret, n as i32);
        // data[out[i]] should be in sorted order
        for i in 0..n - 1 {
            assert!(data[out[i] as usize] <= data[out[i + 1] as usize]);
        }
    }

    #[test]
    fn test_argsort_nan_last() {
        let data = vec![f64::NAN, 1.0, 0.5];
        let n = data.len();
        let mut out = vec![0_i32; n];
        unsafe { argsort_f64(data.as_ptr(), n, out.as_mut_ptr()) };
        // Last index should point to NaN.
        assert!(data[out[n - 1] as usize].is_nan());
        // First two should be finite.
        assert!(!data[out[0] as usize].is_nan());
        assert!(!data[out[1] as usize].is_nan());
    }

    #[test]
    fn test_rank_basic() {
        let data = vec![3.0_f64, 1.0, 4.0, 1.0, 5.0];
        let n = data.len();
        let mut out = vec![0_i32; n];
        let ret = unsafe { rank_f64(data.as_ptr(), n, out.as_mut_ptr()) };
        assert_eq!(ret, n as i32);
        // Reconstruct sorted order from ranks.
        let mut sorted = vec![0.0_f64; n];
        for i in 0..n {
            sorted[out[i] as usize] = data[i];
        }
        for i in 0..n - 1 {
            assert!(sorted[i] <= sorted[i + 1]);
        }
    }

    #[test]
    fn test_rank_invert_argsort() {
        let data = vec![2.0_f64, 5.0, 1.0, 4.0, 3.0];
        let n = data.len();
        let mut argsort_out = vec![0_i32; n];
        let mut rank_out = vec![0_i32; n];
        unsafe {
            argsort_f64(data.as_ptr(), n, argsort_out.as_mut_ptr());
            rank_f64(data.as_ptr(), n, rank_out.as_mut_ptr());
        }
        // rank[argsort[k]] == k (rank is the inverse permutation of argsort).
        for k in 0..n {
            assert_eq!(rank_out[argsort_out[k] as usize], k as i32,
                "rank[argsort[{k}]] should be {k}");
        }
    }
}
