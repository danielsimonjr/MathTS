/**
 * Clustering (Wave D / remaining). `kmeans` (Lloyd) + `spectralClustering`, the
 * latter reusing the `laplacianMatrix` connector and the corrected `eigs`. k-means
 * uses a deterministic maximin (Gonzalez) seeding so results are reproducible.
 */
import { eigs as _eigsRaw } from './factories/index.js';
import { laplacianMatrix } from './linalg-extra.js';

const _eigs = _eigsRaw as unknown as (m: number[][]) => {
  values: Array<number | { re: number; im: number }>;
  eigenvectors: Array<{ value: number | { re: number; im: number }; vector: number[] }>;
};

const dist2 = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((s, v, i) => s + (v - b[i]) * (v - b[i]), 0);

export interface KMeansResult {
  labels: number[];
  centroids: number[][];
  inertia: number;
  /** Number of Lloyd iterations actually run. */
  iterations: number;
  /** True if the assignment stabilized before `maxIter` (false = hit the cap). */
  converged: boolean;
}

/**
 * k-means clustering (Lloyd's algorithm) of row-vectors `data` into `k` clusters.
 * Deterministic maximin seeding (farthest-point), so repeated runs agree. Returns
 * cluster `labels`, `centroids`, and the total within-cluster sum of squares (`inertia`).
 */
export function kmeans(
  data: readonly number[][],
  k: number,
  opts: { maxIter?: number } = {}
): KMeansResult {
  const { maxIter = 100 } = opts;
  const n = data.length;
  if (n === 0) throw new Error('kmeans: data is empty');
  if (!Number.isInteger(k) || k < 1) throw new Error('kmeans: k must be a positive integer');
  const d = data[0].length;
  if (k > n) throw new Error('kmeans: k exceeds number of points');
  // maximin seeding: first centroid = point nearest the mean, then farthest-from-chosen
  const mean = new Array<number>(d).fill(0);
  for (const p of data) for (let j = 0; j < d; j++) mean[j] += p[j] / n;
  let first = 0;
  for (let i = 1; i < n; i++) if (dist2(data[i], mean) < dist2(data[first], mean)) first = i;
  const centroids: number[][] = [data[first].slice()];
  while (centroids.length < k) {
    let best = -1;
    let bestD = -1;
    for (let i = 0; i < n; i++) {
      const dmin = Math.min(...centroids.map((c) => dist2(data[i], c)));
      if (dmin > bestD) {
        bestD = dmin;
        best = i;
      }
    }
    centroids.push(data[best].slice());
  }
  const labels = new Array<number>(n).fill(0);
  let iterations = 0;
  let converged = false;
  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = dist2(data[i], centroids[c]);
        if (dd < bestD) {
          bestD = dd;
          best = c;
        }
      }
      if (labels[i] !== best) {
        labels[i] = best;
        changed = true;
      }
    }
    for (let c = 0; c < k; c++) {
      const members = data.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue;
      for (let j = 0; j < d; j++)
        centroids[c][j] = members.reduce((s, p) => s + p[j], 0) / members.length;
    }
    if (!changed) {
      converged = true;
      break;
    }
  }
  const inertia = data.reduce((s, p, i) => s + dist2(p, centroids[labels[i]]), 0);
  return { labels, centroids, inertia, iterations, converged };
}

/**
 * Spectral clustering of a weighted graph given by its adjacency matrix into `k`
 * clusters. Embeds nodes via the `k` smallest eigenvectors of the symmetric
 * normalized Laplacian (reusing `laplacianMatrix` + `eigs`), then k-means on the
 * embedding. Returns a label per node.
 */
export function spectralClustering(
  adjacency: readonly number[][],
  k: number,
  opts: { maxIter?: number } = {}
): number[] {
  const L = laplacianMatrix(adjacency, { normalized: true });
  const { eigenvectors } = _eigs(L); // ascending by eigenvalue
  const n = adjacency.length;
  // embedding: rows are nodes, columns are the k smallest eigenvectors
  const embed: number[][] = Array.from({ length: n }, (_, i) =>
    eigenvectors.slice(0, k).map((e) => e.vector[i])
  );
  return kmeans(embed, k, opts).labels;
}
