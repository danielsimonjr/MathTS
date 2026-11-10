/**
 * Geometry and set extras: axis-aligned bounding box, orthogonal Procrustes
 * alignment, brute-force kNN and radius queries, and multiset
 * superset/equal/disjoint tests.
 *
 * @packageDocumentation
 */
import { matMul, svd } from '@danielsimonjr/mathts-matrix';
import { setIsSubset, setMultiplicity } from '../typed/set.js';
import { flatten } from '../utils/array.js';
import { rankNearest } from '../ml/dbscan-knn.js';

// =============================================================================
// Bounding box
// =============================================================================

/**
 * Axis-aligned bounding box (per-dimension min/max) of a set of nD points.
 *
 * @example
 * boundingBox([[1,2],[3,0],[2,5]])  // { min: [1,0], max: [3,5] }
 */
export function boundingBox(points: number[][]): { min: number[]; max: number[] } {
  if (points.length === 0) throw new Error('boundingBox: requires at least one point');
  const dims = points[0].length;
  const min = points[0].slice();
  const max = points[0].slice();
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    for (let d = 0; d < dims; d++) {
      if (p[d] < min[d]) min[d] = p[d];
      if (p[d] > max[d]) max[d] = p[d];
    }
  }
  return { min, max };
}

// =============================================================================
// Orthogonal Procrustes alignment
// =============================================================================

/** Result of {@link procrustes}: best-fit rotation, uniform scale, and residual. */
export interface ProcrustesResult {
  /** Orthogonal `d x d` rotation (or reflection) matrix. */
  R: number[][];
  /** Optimal uniform scale factor. */
  scale: number;
  /** Residual sum of squares after alignment (centered + unit-normalized inputs). */
  disparity: number;
}

function columnMean(A: number[][]): number[] {
  const n = A.length;
  const d = A[0]?.length ?? 0;
  const mean = new Array<number>(d).fill(0);
  for (const row of A) {
    for (let j = 0; j < d; j++) mean[j] += row[j] / n;
  }
  return mean;
}

function center(A: number[][], mean: number[]): number[][] {
  return A.map((row) => row.map((v, j) => v - mean[j]));
}

function frobeniusNorm(A: number[][]): number {
  let sum = 0;
  for (const row of A) for (const v of row) sum += v * v;
  return Math.sqrt(sum);
}

function matTranspose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0]?.length ?? 0;
  const T: number[][] = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) T[j][i] = A[i][j];
  return T;
}

/**
 * Orthogonal Procrustes alignment: find the rotation `R`, uniform scale
 * `scale`, and residual `disparity` that best map `B` onto `A` after both are
 * centered on their centroid and normalized to unit Frobenius norm.
 *
 * Algorithm: `A0`, `B0` = centered + unit-normalized `A`, `B`;
 * `M = A0ᵀ B0 = U Σ Vᵀ` (SVD); `R = V Uᵀ` (minimizes `‖B0 R − A0‖`);
 * `scale = Σ Σᵢ` (sum of singular values); `disparity = ‖A0 − scale·B0·R‖²`.
 * Pinned against `scipy.spatial.procrustes` (disparity matches to float
 * precision for both exact-rotation and unrelated-point-set inputs).
 *
 * @example
 * procrustes([[0,0],[1,0],[0,1]], [[0,0],[0,1],[-1,0]])
 * // R ~ 90° rotation, disparity ~ 0
 */
export function procrustes(A: number[][], B: number[][]): ProcrustesResult {
  if (A.length !== B.length || A.length === 0) {
    throw new Error('procrustes: A and B must have the same non-zero number of rows');
  }
  const A0raw = center(A, columnMean(A));
  const B0raw = center(B, columnMean(B));
  const nA = frobeniusNorm(A0raw) || 1;
  const nB = frobeniusNorm(B0raw) || 1;
  const A0 = A0raw.map((row) => row.map((v) => v / nA));
  const B0 = B0raw.map((row) => row.map((v) => v / nB));

  const M = matMul(matTranspose(A0), B0); // d x d
  const { U, S, V } = svd(M);
  const R = matMul(V, matTranspose(U)); // R = V * U^T : maps B0 -> A0
  const scale = S.reduce((s, v) => s + v, 0);

  const transformed = matMul(B0, R).map((row) => row.map((v) => v * scale));
  let disparity = 0;
  for (let i = 0; i < A0.length; i++) {
    for (let j = 0; j < A0[i].length; j++) {
      const diff = A0[i][j] - transformed[i][j];
      disparity += diff * diff;
    }
  }
  return { R, scale, disparity };
}

// =============================================================================
// kd-tree kNN / radius queries (brute force)
// =============================================================================

function euclideanDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Indices of the `k` nearest points to `query` (Euclidean distance,
 * nearest-first). Brute-force — see `../ml/dbscan-knn.ts` for the same
 * strategy used by the k-NN classifier/regressor.
 *
 * @example
 * kdTreeKNN([[0,0],[1,0],[5,5]], [0,0], 2)  // [0, 1]
 */
export function kdTreeKNN(points: number[][], query: number[], k: number): number[] {
  return rankNearest(points, query, Math.max(0, k), euclideanDist);
}

/**
 * Indices of all points within Euclidean radius `r` of `query` (brute force).
 *
 * @example
 * kdTreeRadius([[0,0],[1,0],[5,5]], [0,0], 2)  // [0, 1]
 */
export function kdTreeRadius(points: number[][], query: number[], r: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (euclideanDist(points[i], query) <= r) result.push(i);
  }
  return result;
}

// =============================================================================
// Multiset comparisons (complement `setIsSubset`/`setMultiplicity`)
// =============================================================================

/**
 * True when every element of `b` (with multiplicity) appears in `a` — i.e.
 * `a` is a (multiset) superset of `b`. Complement of `setIsSubset`.
 *
 * @example
 * setIsSuperset([1, 2, 3], [1, 2])  // true
 * setIsSuperset([1, 2], [1, 2, 3])  // false
 */
export function setIsSuperset(a: unknown[], b: unknown[]): boolean {
  return setIsSubset(b, a) as boolean;
}

/**
 * True when `a` and `b` are equal as multisets (same elements, same
 * multiplicities, order-independent).
 *
 * @example
 * setEqual([1, 2, 2], [2, 1, 2])  // true
 * setEqual([1, 2], [1, 2, 2])     // false
 */
export function setEqual(a: unknown[], b: unknown[]): boolean {
  return (setIsSubset(a, b) as boolean) && (setIsSubset(b, a) as boolean);
}

/**
 * True when `a` and `b` share no elements (multiset intersection is empty).
 *
 * @example
 * setDisjoint([1, 2], [3, 4])  // true
 * setDisjoint([1, 2], [2, 3])  // false
 */
export function setDisjoint(a: unknown[], b: unknown[]): boolean {
  const flatA = flatten(a);
  for (const elem of flatA) {
    if ((setMultiplicity(elem, b) as number) > 0) return false;
  }
  return true;
}
