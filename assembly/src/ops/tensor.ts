/**
 * Rank-N tensor operations — AssemblyScript fallback mirroring the original
 * Rust `matrix/tensor_ops.rs` implementation.
 */

/**
 * Permute the axes of a row-major dense tensor.
 *
 * `data` is the flat tensor; `shape` and `perm` are same-length arrays
 * (passed as `Float64Array`, interpreted as integers). Returns the
 * permuted tensor, or an empty array for invalid input.
 */
export function tensorTranspose(
  data: Float64Array,
  shape: Float64Array,
  perm: Float64Array
): Float64Array {
  const rank: i32 = shape.length;
  if (rank <= 0 || rank > 16 || perm.length != rank) {
    return new Float64Array(0);
  }
  const sh = new Int32Array(rank);
  const pm = new Int32Array(rank);
  for (let k = 0; k < rank; k++) {
    sh[k] = <i32>shape[k];
    pm[k] = <i32>perm[k];
    if (sh[k] <= 0 || pm[k] < 0 || pm[k] >= rank) {
      return new Float64Array(0);
    }
  }

  let total: i32 = 1;
  for (let k = 0; k < rank; k++) total *= sh[k];

  const outShape = new Int32Array(rank);
  for (let k = 0; k < rank; k++) outShape[k] = sh[pm[k]];

  const inStrides = new Int32Array(rank);
  const outStrides = new Int32Array(rank);
  let acc: i32 = 1;
  for (let k = rank - 1; k >= 0; k--) {
    inStrides[k] = acc;
    acc *= sh[k];
  }
  acc = 1;
  for (let k = rank - 1; k >= 0; k--) {
    outStrides[k] = acc;
    acc *= outShape[k];
  }

  const out = new Float64Array(total);
  const idx = new Int32Array(rank);
  for (let n = 0; n < total; n++) {
    let outFlat: i32 = 0;
    let inFlat: i32 = 0;
    for (let k = 0; k < rank; k++) {
      outFlat += idx[k] * outStrides[k];
      inFlat += idx[k] * inStrides[pm[k]];
    }
    out[outFlat] = data[inFlat];

    let kk: i32 = rank;
    while (kk > 0) {
      kk--;
      idx[kk]++;
      if (idx[kk] < outShape[kk]) break;
      idx[kk] = 0;
    }
  }
  return out;
}
