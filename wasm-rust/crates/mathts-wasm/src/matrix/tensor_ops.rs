//! Rank-N tensor operations.
//!
//! Gap B: the crate's `matrix/` module only transposed rank-2 matrices.
//! `tensorTranspose` permutes the axes of an arbitrary-rank dense tensor.
//! Allocation-free; rank is capped at 16 (fixed-size stack scratch).

const MAX_RANK: usize = 16;

/// Permute the axes of a row-major dense tensor.
///
/// `data` is the flat tensor (length = product of `shape`); `shape` and
/// `perm` are `rank`-length `i32` arrays. Writes the permuted tensor into
/// `out` and returns the element count, or `-1` for invalid input
/// (`rank <= 0`, `rank > 16`, or an out-of-range permutation entry).
///
/// # Safety
/// `data_ptr`/`out_ptr` reference `prod(shape)` `f64`s; `shape_ptr` and
/// `perm_ptr` reference `rank` `i32`s.
#[no_mangle]
pub unsafe extern "C" fn tensorTranspose(
    data_ptr: *const f64,
    shape_ptr: *const i32,
    rank: i32,
    perm_ptr: *const i32,
    out_ptr: *mut f64,
) -> i32 {
    if rank <= 0 || rank as usize > MAX_RANK {
        return -1;
    }
    let rank = rank as usize;
    let shape_in = core::slice::from_raw_parts(shape_ptr, rank);
    let perm_in = core::slice::from_raw_parts(perm_ptr, rank);

    let mut shape = [0usize; MAX_RANK];
    let mut perm = [0usize; MAX_RANK];
    for k in 0..rank {
        if shape_in[k] <= 0 || perm_in[k] < 0 || perm_in[k] as usize >= rank {
            return -1;
        }
        shape[k] = shape_in[k] as usize;
        perm[k] = perm_in[k] as usize;
    }

    let mut total = 1usize;
    for &s in shape.iter().take(rank) {
        total *= s;
    }

    // Output shape and the row-major strides of both layouts.
    let mut out_shape = [0usize; MAX_RANK];
    for k in 0..rank {
        out_shape[k] = shape[perm[k]];
    }
    let mut in_strides = [0usize; MAX_RANK];
    let mut out_strides = [0usize; MAX_RANK];
    let mut acc = 1usize;
    let mut k = rank;
    while k > 0 {
        k -= 1;
        in_strides[k] = acc;
        acc *= shape[k];
    }
    acc = 1;
    k = rank;
    while k > 0 {
        k -= 1;
        out_strides[k] = acc;
        acc *= out_shape[k];
    }

    let data = core::slice::from_raw_parts(data_ptr, total);
    let mut idx = [0usize; MAX_RANK]; // current index into the output

    for _ in 0..total {
        let mut out_flat = 0usize;
        let mut in_flat = 0usize;
        for k in 0..rank {
            out_flat += idx[k] * out_strides[k];
            // inIdx[perm[k]] = outIdx[k]
            in_flat += idx[k] * in_strides[perm[k]];
        }
        *out_ptr.add(out_flat) = data[in_flat];

        // Row-major increment over the output shape.
        let mut kk = rank;
        while kk > 0 {
            kk -= 1;
            idx[kk] += 1;
            if idx[kk] < out_shape[kk] {
                break;
            }
            idx[kk] = 0;
        }
    }
    total as i32
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    fn transpose(data: &[f64], shape: &[i32], perm: &[i32]) -> alloc::vec::Vec<f64> {
        let mut out = vec![0.0f64; data.len()];
        let n = unsafe {
            tensorTranspose(
                data.as_ptr(),
                shape.as_ptr(),
                shape.len() as i32,
                perm.as_ptr(),
                out.as_mut_ptr(),
            )
        };
        assert_eq!(n as usize, data.len());
        out
    }

    #[test]
    fn transpose_2x3() {
        // [[1,2,3],[4,5,6]] with perm [1,0] -> [[1,4],[2,5],[3,6]]
        let data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        assert_eq!(
            transpose(&data, &[2, 3], &[1, 0]),
            vec![1.0, 4.0, 2.0, 5.0, 3.0, 6.0]
        );
    }

    #[test]
    fn transpose_identity_perm() {
        let data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        assert_eq!(transpose(&data, &[2, 3], &[0, 1]), data.to_vec());
    }

    #[test]
    fn transpose_rank3() {
        // shape [2,2,2], reverse perm [2,1,0]
        let data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        // element (i,j,k) -> (k,j,i): out[k,j,i] = in[i,j,k]
        let out = transpose(&data, &[2, 2, 2], &[2, 1, 0]);
        // in flat index i*4+j*2+k ; out flat index k*4+j*2+i
        for i in 0..2 {
            for j in 0..2 {
                for k in 0..2 {
                    assert_eq!(out[k * 4 + j * 2 + i], data[i * 4 + j * 2 + k]);
                }
            }
        }
    }

    #[test]
    fn transpose_rejects_bad_input() {
        let data = [1.0, 2.0];
        let mut out = [0.0f64; 2];
        // perm entry out of range
        let r = unsafe {
            tensorTranspose(
                data.as_ptr(),
                [2i32].as_ptr(),
                1,
                [5i32].as_ptr(),
                out.as_mut_ptr(),
            )
        };
        assert_eq!(r, -1);
    }
}
