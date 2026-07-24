/**
 * Density-based clustering (DBSCAN) + k-nearest-neighbour classifier/regressor
 * (Phase 3 Task 4 — ML primitives).
 *
 * All three functions share brute-force Euclidean-distance neighbour search.
 * The library's exported `kdTree` (`typed/geometry.ts`) has no radius-query
 * method, so DBSCAN's ε-neighborhoods are computed O(n²) brute-force here —
 * correct, just not the asymptotically fastest option. A kd-tree range-search
 * (and a kd-tree-backed k-NN search) is future work if this becomes a hot path.
 */

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Indices of all points within `eps` of `points[i]` (brute-force, includes `i` itself). */
function regionQuery(points: number[][], i: number, eps: number): number[] {
  const neighbors: number[] = [];
  for (let j = 0; j < points.length; j++) {
    if (euclidean(points[i], points[j]) <= eps) neighbors.push(j);
  }
  return neighbors;
}

/**
 * DBSCAN density-based clustering. A point is a **core point** if its
 * ε-neighborhood (including itself) has at least `minPts` members; clusters
 * are grown by expanding outward from core points through their neighbors
 * (density-reachability). Points reached only from a core point's
 * neighborhood but that are not themselves core are labeled as border points
 * of that cluster; points never reached are **noise** (`-1`).
 *
 * @param points - Row-vectors (n × d)
 * @param eps - Neighborhood radius (Euclidean)
 * @param minPts - Minimum neighborhood size (including the point itself) for a core point
 * @returns 0-based cluster label per point; `-1` marks noise
 *
 * @example
 * dbscan([[0, 0], [0.1, 0.1], [10, 10], [50, 50]], 1.0, 2)
 * // => [0, 0, -1, -1]  (one 2-point cluster, two noise points)
 */
export function dbscan(points: number[][], eps: number, minPts: number): number[] {
  const n = points.length;
  const labels = new Array<number>(n).fill(-2); // -2 = unvisited, -1 = noise, >= 0 = cluster id
  let clusterId = -1;

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue; // already visited

    const neighbors = regionQuery(points, i, eps);
    if (neighbors.length < minPts) {
      labels[i] = -1; // provisional noise; may be claimed as a border point later
      continue;
    }

    clusterId++;
    labels[i] = clusterId;

    const seeds = neighbors.filter((j) => j !== i);
    for (let s = 0; s < seeds.length; s++) {
      const j = seeds[s];
      if (labels[j] === -1) {
        labels[j] = clusterId; // was noise -> now a border point of this cluster
      }
      if (labels[j] !== -2) continue; // already assigned to some cluster
      labels[j] = clusterId;

      const jNeighbors = regionQuery(points, j, eps);
      if (jNeighbors.length >= minPts) {
        for (const k of jNeighbors) {
          if (labels[k] === -2 || labels[k] === -1) seeds.push(k);
        }
      }
    }
  }

  return labels;
}

/** Indices of the `k` nearest rows in `train` to `q`, sorted nearest-first. */
function kNearestIndices(train: number[][], q: number[], k: number): number[] {
  const dists = train.map((row, i) => ({ i, d: euclidean(row, q) }));
  dists.sort((a, b) => a.d - b.d);
  return dists.slice(0, Math.min(k, dists.length)).map((e) => e.i);
}

/**
 * k-nearest-neighbour classifier: majority vote of the `k` closest training
 * points (Euclidean distance). Ties are broken by the label of the single
 * nearest point among the tied labels.
 *
 * @param train - Training row-vectors (n × d)
 * @param labels - Training labels (length n)
 * @param query - Query row-vectors (m × d)
 * @param k - Number of neighbors
 * @returns Predicted label per query row
 */
export function knnClassify(
  train: number[][],
  labels: (number | string)[],
  query: number[][],
  k: number
): (number | string)[] {
  return query.map((q) => {
    const idx = kNearestIndices(train, q, k);
    const counts = new Map<number | string, number>();
    for (const i of idx) {
      const lbl = labels[i];
      counts.set(lbl, (counts.get(lbl) ?? 0) + 1);
    }
    let bestLabel = labels[idx[0]];
    let bestCount = -1;
    for (const [lbl, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestLabel = lbl;
      }
    }
    // Break ties by nearest-point label: if the nearest point's label is among
    // those tied for the top vote count, prefer it.
    const nearestLabel = labels[idx[0]];
    if (counts.get(nearestLabel) === bestCount) {
      bestLabel = nearestLabel;
    }
    return bestLabel;
  });
}

/**
 * k-nearest-neighbour regressor: mean of the `k` closest training targets
 * (Euclidean distance).
 *
 * @param train - Training row-vectors (n × d)
 * @param targets - Training targets (length n)
 * @param query - Query row-vectors (m × d)
 * @param k - Number of neighbors
 * @returns Predicted (mean) target per query row
 */
export function knnRegress(
  train: number[][],
  targets: number[],
  query: number[][],
  k: number
): number[] {
  return query.map((q) => {
    const idx = kNearestIndices(train, q, k);
    const sum = idx.reduce((acc, i) => acc + targets[i], 0);
    return sum / idx.length;
  });
}
