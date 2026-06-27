/**
 * tensorKron — Kronecker product for rank-N tensors.
 *
 * Computes the Kronecker product of tensors `a` and `b`. For rank-2 matrices
 * this is the classical Kronecker product:
 *
 *   kron(A, B)[i0, j0] = A[i0 / B.rows, j0 / B.cols] * B[i0 % B.rows, j0 % B.cols]
 *
 * For higher-rank tensors, the same rule is applied axis-by-axis:
 *
 *   result.shape[k] = a.shape[k] * b.shape[k]
 *   result[...i] = a[i[0]/b.shape[0], ..., i[r-1]/b.shape[r-1]]
 *                * b[i[0]%b.shape[0], ..., i[r-1]%b.shape[r-1]]
 *
 * Rank alignment: if the tensors have different ranks, the smaller one is
 * broadcast-aligned to the right by prepending size-1 dimensions (numpy-style).
 *
 * Axis labels: when both tensors carry `axisLabels`, the output axis labels
 * are formed by concatenating each pair as `"<aName>_X_<bName>"` to avoid
 * collisions. When only one tensor has labels, the output carries no labels.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

export interface TensorKronOpts {
  /**
   * Separator string inserted between a's and b's axis-label names when
   * building the output axisLabels. Default: "_X_".
   */
  separator?: string;
}

/**
 * Compute the Kronecker product of tensors `a` and `b`.
 *
 * @param a    - Left operand tensor.
 * @param b    - Right operand tensor.
 * @param opts - Optional separator for axis-label naming.
 */
export function tensorKron(a: Tensor, b: Tensor, opts?: TensorKronOpts): Tensor {
  const separator = opts?.separator ?? '_X_';

  // --- Rank alignment: pad the smaller rank with leading 1s ---
  let aShape = [...a.shape];
  let bShape = [...b.shape];
  let aLabels = a.axisLabels ? [...a.axisLabels] : undefined;
  let bLabels = b.axisLabels ? [...b.axisLabels] : undefined;

  const rankA = aShape.length;
  const rankB = bShape.length;
  const outRank = Math.max(rankA, rankB);

  if (rankA < outRank) {
    const pad = outRank - rankA;
    aShape = [...new Array(pad).fill(1), ...aShape];
    if (aLabels !== undefined) {
      const padLabels = Array.from(
        { length: pad },
        (_, i) => new Index(1, { name: `kron_pad_a_${i}` })
      );
      aLabels = [...padLabels, ...aLabels];
    }
  }
  if (rankB < outRank) {
    const pad = outRank - rankB;
    bShape = [...new Array(pad).fill(1), ...bShape];
    if (bLabels !== undefined) {
      const padLabels = Array.from(
        { length: pad },
        (_, i) => new Index(1, { name: `kron_pad_b_${i}` })
      );
      bLabels = [...padLabels, ...bLabels];
    }
  }

  // --- Output shape ---
  const outShape = aShape.map((d, k) => d * bShape[k]);
  const outSize = outShape.reduce((acc, d) => acc * d, 1);

  // Pre-compute strides for the output (row-major).
  const outStrides = Tensor.rowMajorStrides(outShape);

  // --- Build padded a and b data arrays (with leading 1-dim padding) ---
  // If we padded the shape, we need to "view" the original data as if leading
  // dimensions are size-1. Since padding is size-1, the underlying data is
  // the same — we just use the original data with the original strides, then
  // reconstruct. Instead, we create "effective" data references pointing at
  // the original tensors' data but use the padded shapes/strides.
  const aData = a.data;
  const bData = b.data;
  // Strides for the original tensors (the padded shapes have leading 1s, so
  // the strides are the same as the originals for the non-padded dimensions).
  const aOrigStrides = Tensor.rowMajorStrides(aShape.slice(outRank - rankA));
  const bOrigStrides = Tensor.rowMajorStrides(bShape.slice(outRank - rankB));

  // Build the result.
  const result = new Float64Array(outSize);

  // Iterate over all output indices using a multi-index counter.
  const outIdx = new Array<number>(outRank).fill(0);

  for (let flatOut = 0; flatOut < outSize; flatOut++) {
    // Decode flatOut into outIdx.
    {
      let rem = flatOut;
      for (let k = 0; k < outRank; k++) {
        outIdx[k] = Math.floor(rem / outStrides[k]);
        rem -= outIdx[k] * outStrides[k];
      }
    }

    // Compute a and b flat indices.
    // a's multi-index: outIdx[k] / bShape[k]  (integer division)
    // b's multi-index: outIdx[k] % bShape[k]
    let flatA = 0;
    let flatB = 0;
    for (let k = 0; k < outRank; k++) {
      const aIdx = Math.floor(outIdx[k] / bShape[k]);
      const bIdx = outIdx[k] % bShape[k];
      // Map into the (possibly padded) a and b shapes.
      // For the padded leading dimensions, the index is always 0.
      const aPadded = outRank - rankA;
      const bPadded = outRank - rankB;
      if (k >= aPadded) {
        flatA += aIdx * aOrigStrides[k - aPadded];
      }
      if (k >= bPadded) {
        flatB += bIdx * bOrigStrides[k - bPadded];
      }
    }

    result[flatOut] = aData[flatA] * bData[flatB];
  }

  // --- Axis labels ---
  let outLabels: ReadonlyArray<Index> | undefined;
  if (aLabels !== undefined && bLabels !== undefined) {
    outLabels = aLabels.map((al, k) => {
      const bl = bLabels![k];
      const aName = al.name ?? `a${k}`;
      const bName = bl.name ?? `b${k}`;
      const outDim = outShape[k];
      return new Index(outDim, { name: `${aName}${separator}${bName}` });
    });
  }

  return new Tensor(outShape, result, outLabels);
}
