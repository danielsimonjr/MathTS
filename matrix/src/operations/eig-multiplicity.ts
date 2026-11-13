/**
 * Repeated-eigenvalue report for `eig`: which computed eigenvalues are copies of one
 * repeated eigenvalue, and how many independent eigenvectors that eigenvalue has.
 *
 * A Jordan block of size `k` splits under rounding into `k` eigenvalues on a ring of
 * radius about `eps^(1/k)` times the matrix scale. Distinct eigenvalues can be closer
 * than that. Distance alone cannot tell the two cases apart, so the report works in
 * three steps:
 *
 * 1. Single linkage builds a tree of clusters. A cluster of `m` eigenvalues is a
 *    candidate when it links at or below `2 * eps^(1/m) * ||A||_F`.
 * 2. A second-moment screen drops the candidates that no repeated eigenvalue can give.
 * 3. An orthogonal staircase on `A - mean * I` counts the multiplicity of the cluster
 *    mean. The candidate is accepted when that count reaches `m`. A cluster whose
 *    members all lie within the rank tolerance of the mean needs the first stage only.
 *
 * The largest accepted cluster wins. A rejected cluster hands its sub-clusters to the
 * same test. The result does not depend on the order of the eigenvalues.
 *
 * "Repeated" is a statement to working precision: a change of about
 * `sqrt(eps) * ||A||_F` in `A` makes the group one exact eigenvalue with the reported
 * structure. Distinct eigenvalues with almost parallel eigenvectors are reported as a
 * defective eigenvalue for that reason. A Jordan block larger than
 * `MAX_TRACKED_BLOCK`, or one whose ring reaches an unrelated eigenvalue, may be missed.
 *
 * Cost: one column-pivoted QR of `A - mean * I` for each group (about `4/3 n^3` flops),
 * and two more factorizations of that size for each further stage of a wide cluster.
 */

import { columnPivotedQr } from './pivoted-qr.js';

/**
 * A repeated eigenvalue (algebraic multiplicity 2 or more) and its eigenvectors.
 */
export interface RepeatedEigenvalue {
  /** The repeated eigenvalue: the mean of the computed copies in the group. */
  value: { re: number; im: number };
  /** Number of computed eigenvalues in the group (algebraic multiplicity). */
  algebraicMultiplicity: number;
  /**
   * Number of linearly independent eigenvectors for this value: the nullity of
   * `A - value * I`, at most `algebraicMultiplicity`.
   */
  independentEigenvectors: number;
  /** True when `independentEigenvectors < algebraicMultiplicity` (a Jordan block). */
  defective: boolean;
}

/** Machine epsilon for double precision. */
const EIG_EPS = 2.220446049250313e-16;

/**
 * Largest Jordan block size that the link tolerance follows. A block of size `k`
 * splits by about `eps^(1/k)`: 1.5e-8 for 2, 6e-6 for 3, 1.2e-4 for 4, 2.5e-3 for 6.
 * A larger block splits so wide that its ring reaches unrelated eigenvalues, so the
 * tolerance stops growing here.
 */
const MAX_TRACKED_BLOCK = 6;

/**
 * The screen accepts a cluster whose centred second moment is at most
 * `(SCREEN_FACTOR * sqrt(eps) * ||A||_F)^2` per member. The copies of a repeated
 * eigenvalue have a second moment of order `eps * cond * ||A||^2`, because the ring of
 * a Jordan block cancels in the sum. Distinct eigenvalues spread over a radius `r`
 * give about `r^2`. The factor leaves room for an eigenvector condition number of
 * about 4000.
 */
const SCREEN_FACTOR = 64;

/** Link tolerance for a cluster of `m` eigenvalues of a matrix with Frobenius norm `normF`. */
function linkTolerance(m: number, normF: number): number {
  return 2 * Math.pow(EIG_EPS, 1 / Math.min(m, MAX_TRACKED_BLOCK)) * normF;
}

/** One node of the single-linkage tree. */
interface Cluster {
  /** Indices of the eigenvalues in the cluster, in ascending order. */
  members: number[];
  /** Smallest distance at which the members form one cluster. */
  height: number;
  /** The clusters that merged at `height`. Single eigenvalues are not listed. */
  children: Cluster[];
}

/**
 * Builds the single-linkage tree of the eigenvalues, with links no longer than
 * `maxHeight`. Links of equal length merge in one step, so the tree depends only on
 * the set of eigenvalues and not on their order.
 *
 * @returns The top clusters (each has two or more members).
 */
function linkageTree(values: Array<{ re: number; im: number }>, maxHeight: number): Cluster[] {
  const n = values.length;
  const from: number[] = [];
  const to: number[] = [];
  const dist: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(values[j].re - values[i].re, values[j].im - values[i].im);
      if (d <= maxHeight) {
        from.push(i);
        to.push(j);
        dist.push(d);
      }
    }
  }
  const order = Array.from(dist, (_, e) => e).sort((a, b) => dist[a] - dist[b]);

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  // Cluster of each root. A root with no entry is a single eigenvalue.
  const clusterOf = new Map<number, Cluster>();

  let e = 0;
  while (e < order.length) {
    const height = dist[order[e]];
    // Roots that this step joins, read before any union of the step.
    const joined: Array<[number, number]> = [];
    for (; e < order.length && dist[order[e]] === height; e++) {
      const a = find(from[order[e]]);
      const b = find(to[order[e]]);
      if (a !== b) joined.push([a, b]);
    }
    const oldRoots = new Set<number>();
    for (const [a, b] of joined) {
      oldRoots.add(a);
      oldRoots.add(b);
      parent[find(a)] = find(b);
    }
    const merged = new Map<number, number[]>();
    for (const r of oldRoots) {
      const root = find(r);
      const list = merged.get(root);
      if (list) list.push(r);
      else merged.set(root, [r]);
    }
    for (const [root, parts] of merged) {
      const members: number[] = [];
      const children: Cluster[] = [];
      for (const r of parts) {
        const child = clusterOf.get(r);
        if (child) {
          children.push(child);
          members.push(...child.members);
          clusterOf.delete(r);
        } else {
          members.push(r);
        }
      }
      members.sort((x, y) => x - y);
      clusterOf.set(root, { members, height, children });
    }
  }
  return [...clusterOf.values()];
}

/**
 * Multiplicity of the eigenvalue `lambda` of `A` by an orthogonal staircase.
 *
 * Each stage factors `B` (first `A - lambda I`) by column-pivoted QR and counts the
 * diagonal entries of R at or below `thr`: the nullity of the stage. The next `B` is
 * `Q1^T B Q1`, where `Q1` spans the range of `B`. The stages stop when a stage has
 * nullity 0 or the nullities sum to `target`. The first nullity is the number of
 * independent eigenvectors, and the sum is the algebraic multiplicity.
 *
 * A complex `lambda` uses the real `2n x 2n` matrix `[[Re, -Im], [Im, Re]]`, in which
 * every count is doubled.
 */
function staircase(
  A: number[][],
  lambda: { re: number; im: number },
  target: number,
  thr: number
): { nullity: number; multiplicity: number } {
  const n = A.length;
  const real = lambda.im === 0;
  const fold = real ? 1 : 2;
  let k = fold * n;
  let B = new Float64Array(k * k);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const re = A[i][j] - (i === j ? lambda.re : 0);
      B[i * k + j] = re;
      if (!real) B[(i + n) * k + j + n] = re;
    }
    if (!real) {
      B[i * k + i + n] = lambda.im;
      B[(i + n) * k + i] = -lambda.im;
    }
  }

  let first = -1;
  let total = 0;
  while (k > 0 && total < fold * target) {
    const reflectors: Array<{ c: number; v: Float64Array; vv: number }> = [];
    const perm = columnPivotedQr(B, k, k, (c, v, vv) => reflectors.push({ c, v, vv }));
    let rank = 0;
    while (rank < k && Math.abs(B[rank * k + rank]) > thr) rank++;
    const nullity = k - rank;
    if (first < 0) first = nullity;
    total += nullity;
    if (nullity === 0 || rank === 0 || total >= fold * target) break;

    // W = the first `rank` rows of Q^T B Q. Q^T B is R P^T; then apply Q on the right.
    const W = new Float64Array(rank * k);
    for (let i = 0; i < rank; i++) {
      for (let j = i; j < k; j++) W[i * k + perm[j]] = B[i * k + j];
    }
    for (const { c, v, vv } of reflectors) {
      if (c >= rank) break; // acts on columns c.. only, outside the block that is kept
      for (let i = 0; i < rank; i++) {
        let s = 0;
        for (let t = 0; t < v.length; t++) s += W[i * k + c + t] * v[t];
        const f = (2 * s) / vv;
        if (f === 0) continue;
        for (let t = 0; t < v.length; t++) W[i * k + c + t] -= f * v[t];
      }
    }
    const next = new Float64Array(rank * rank);
    for (let i = 0; i < rank; i++) {
      for (let j = 0; j < rank; j++) next[i * rank + j] = W[i * k + j];
    }
    B = next;
    k = rank;
  }
  return { nullity: Math.round(Math.max(first, 0) / fold), multiplicity: Math.round(total / fold) };
}

/**
 * Groups the computed eigenvalues of `A` into repeated values and counts the
 * independent eigenvectors of each group.
 *
 * @param A - The square matrix.
 * @param values - The computed eigenvalues of `A`.
 * @param symmetric - True when `A` is symmetric. A symmetric matrix has no Jordan
 *   block: its groups use the tolerance of a double eigenvalue for every size and have
 *   as many independent eigenvectors as members, with no factorization.
 * @returns One entry per repeated eigenvalue, ordered by its first member in `values`.
 */
export function repeatedEigenvalueReport(
  A: number[][],
  values: Array<{ re: number; im: number }>,
  symmetric: boolean
): RepeatedEigenvalue[] {
  let normF = 0;
  for (const row of A) for (const v of row) normF = Math.hypot(normF, v);
  const baseTol = linkTolerance(2, normF);
  const rankTol = Math.sqrt(EIG_EPS) * normF;
  const screenLimit = (SCREEN_FACTOR * rankTol) ** 2;
  const maxHeight = symmetric ? baseTol : linkTolerance(MAX_TRACKED_BLOCK, normF);

  const found: Array<{ first: number; entry: RepeatedEigenvalue }> = [];
  const pending = linkageTree(values, maxHeight);
  while (pending.length > 0) {
    const cluster = pending.pop() as Cluster;
    const m = cluster.members.length;
    let re = 0;
    let im = 0;
    for (const i of cluster.members) {
      re += values[i].re;
      im += values[i].im;
    }
    re /= m;
    im /= m;
    // A cluster that holds both members of each conjugate pair has a real mean.
    if (Math.abs(im) <= baseTol) im = 0;

    let independent = -1;
    if (symmetric) {
      independent = m;
    } else if (cluster.height <= linkTolerance(m, normF)) {
      // Centred second moment, a complex number: sum of (lambda_i - mean)^2.
      let sRe = 0;
      let sIm = 0;
      let radius = 0;
      for (const i of cluster.members) {
        const dr = values[i].re - re;
        const di = values[i].im - im;
        radius = Math.max(radius, Math.hypot(dr, di));
        sRe += dr * dr - di * di;
        sIm += 2 * dr * di;
      }
      if (Math.hypot(sRe, sIm) <= m * screenLimit) {
        // A member at distance d from the mean gives `A - mean * I` a singular value of
        // at most d. When every member is within the rank tolerance, the grouping is the
        // proof of the multiplicity, and one stage counts the eigenvectors. A wider
        // cluster must reach its multiplicity in the staircase.
        const need = radius <= rankTol ? 1 : m;
        const { nullity, multiplicity } = staircase(A, { re, im }, need, rankTol);
        if (multiplicity >= need) independent = Math.min(nullity, m);
      }
    }
    if (independent < 0) {
      pending.push(...cluster.children);
      continue;
    }
    found.push({
      first: cluster.members[0],
      entry: {
        value: { re, im },
        algebraicMultiplicity: m,
        independentEigenvectors: independent,
        defective: independent < m,
      },
    });
  }
  return found.sort((a, b) => a.first - b.first).map((f) => f.entry);
}
