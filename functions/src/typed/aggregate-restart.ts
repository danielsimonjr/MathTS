/**
 * Element-wise mean and population std across centrality restart vectors.
 * @internal — not re-exported from the package barrel.
 */

export type RestartAggregation = 'mean' | 'all';

/**
 * Mean (and, when `aggregation` is `'all'`, population std) of restart vectors.
 * Empty `vectors[0]` throws, matching the pre-merge helpers.
 */
export function aggregateRestartVectors(
  vectors: Float64Array[],
  aggregation: RestartAggregation
): { mean: Float64Array; std?: Float64Array } {
  const n = vectors[0].length;
  const count = vectors.length;

  const mean = new Float64Array(n);
  for (const v of vectors) {
    for (let i = 0; i < n; i++) mean[i] += v[i];
  }
  for (let i = 0; i < n; i++) mean[i] /= count;

  if (aggregation === 'mean') {
    return { mean };
  }

  const std = new Float64Array(n);
  for (const v of vectors) {
    for (let i = 0; i < n; i++) {
      const d = v[i] - mean[i];
      std[i] += d * d;
    }
  }
  for (let i = 0; i < n; i++) std[i] = Math.sqrt(std[i] / count);

  return { mean, std };
}
