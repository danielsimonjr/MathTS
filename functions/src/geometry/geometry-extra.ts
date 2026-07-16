/**
 * Geometry & sets extras (Phase 8 Task 3): quaternion slerp/inverse/Euler,
 * axis-aligned bounding box, orthogonal Procrustes alignment, brute-force
 * kd-tree kNN/radius queries, and multiset superset/equal/disjoint tests.
 *
 * Quaternions follow the repo-wide convention (see `../geometry-extra.ts`):
 * `[w, x, y, z]` (scalar-first / Hamilton order).
 *
 * @packageDocumentation
 */
import { svd } from '@danielsimonjr/mathts-matrix';
import { quaternionConjugate } from '../geometry-extra.js';
import { setIsSubset, setMultiplicity } from '../typed/set.js';

type Quat = readonly [number, number, number, number] | readonly number[];

function dot4(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

// =============================================================================
// Quaternion inverse / slerp / Euler
// =============================================================================

/**
 * Multiplicative inverse of a quaternion: `conj(q) / |q|²`. For unit
 * quaternions this equals the conjugate.
 *
 * @example
 * quaternionInverse([0, 1, 0, 0])  // [0, -1, 0, 0]
 */
export function quaternionInverse(q: Quat): number[] {
  const magSq = dot4(q as number[], q as number[]);
  if (magSq === 0) throw new Error('quaternionInverse: zero-magnitude quaternion');
  return (quaternionConjugate(q) as number[]).map((v) => v / magSq);
}

/**
 * Spherical linear interpolation between two (unit) quaternions, `t ∈ [0,1]`.
 * Chooses the shortest arc (negating `q2` when the dot product is negative)
 * and falls back to normalized linear interpolation (nlerp) when the inputs
 * are nearly parallel, where the slerp coefficients become numerically
 * unstable.
 *
 * @example
 * quaternionSlerp([1,0,0,0], [0,1,0,0], 0)    // [1,0,0,0]
 * quaternionSlerp([1,0,0,0], [0,1,0,0], 1)    // [0,1,0,0]
 */
export function quaternionSlerp(q1: Quat, q2: Quat, t: number): number[] {
  const a = q1 as number[];
  let b = q2 as number[];
  let d = dot4(a, b);
  if (d < 0) {
    d = -d;
    b = b.map((v) => -v);
  }
  const DOT_THRESHOLD = 0.9995;
  if (d > DOT_THRESHOLD) {
    // Nearly parallel: linear interpolation, then re-normalize.
    const lerp = a.map((v, i) => v + t * (b[i] - v));
    const m = Math.sqrt(dot4(lerp, lerp)) || 1;
    return lerp.map((v) => v / m);
  }
  const clamped = d > 1 ? 1 : d < -1 ? -1 : d;
  const theta0 = Math.acos(clamped);
  const theta = theta0 * t;
  const sinTheta0 = Math.sin(theta0);
  const sinTheta = Math.sin(theta);
  const s0 = Math.cos(theta) - (d * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return a.map((v, i) => s0 * v + s1 * b[i]);
}

/**
 * Convert a (unit) quaternion `[w, x, y, z]` to ZYX intrinsic Euler angles
 * `[roll, pitch, yaw]` in radians (the standard aerospace yaw-pitch-roll
 * sequence). Pitch is clamped at the ±90° gimbal-lock singularity.
 *
 * @example
 * quaternionToEuler([1, 0, 0, 0])  // [0, 0, 0]
 */
export function quaternionToEuler(q: Quat): [number, number, number] {
  const [w, x, y, z] = q;
  const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const sinp = 2 * (w * y - z * x);
  const pitch = Math.asin(sinp > 1 ? 1 : sinp < -1 ? -1 : sinp);
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  return [roll, pitch, yaw];
}

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

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const inner = B.length;
  const cols = B[0]?.length ?? 0;
  const C: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      const a = A[i][k];
      if (a === 0) continue;
      for (let j = 0; j < cols; j++) C[i][j] += a * B[k][j];
    }
  }
  return C;
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
  const ranked = points.map((p, i) => ({ i, d: euclideanDist(p, query) }));
  ranked.sort((a, b) => a.d - b.d);
  return ranked.slice(0, Math.max(0, Math.min(k, ranked.length))).map((e) => e.i);
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

function flatten(arr: unknown[]): unknown[] {
  const result: unknown[] = [];
  const stack = [...arr];
  while (stack.length > 0) {
    const item = stack.shift();
    if (Array.isArray(item)) {
      stack.unshift(...item);
    } else {
      result.push(item);
    }
  }
  return result;
}

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
