/**
 * Halfspace intersection / vertex enumeration (2-D & 3-D) — completes the
 * computational-geometry engine.
 *
 * Given a set of halfspaces `A·x + b ≤ 0` (SciPy's convention — see below) and
 * a strictly **interior** point `x₀`, `halfspaceIntersection` returns the
 * **vertices** of the bounded polytope `{x : A·x + b ≤ 0}`.
 *
 * ## Convention (matches `scipy.spatial.HalfspaceIntersection`)
 *
 * Each halfspace is a row `[a_1, …, a_d, b]` of length `d + 1` denoting the
 * inequality
 *
 * ```text
 *   a·x + b ≤ 0            (i.e. a·x ≤ −b)
 * ```
 *
 * This is exactly SciPy's stacked `[A | b]` form (`Ax + b ≤ 0`). To feed a
 * constraint written `a·x ≤ c`, pass the row `[a_1, …, a_d, −c]`.
 *
 * ## Method — the dual-hull route (SciPy's approach)
 *
 * With a strictly interior point `x₀` (every `aᵢ·x₀ + bᵢ < 0`), map each
 * halfspace to a **dual point**
 *
 * ```text
 *   yᵢ = aᵢ / dᵢ ,   dᵢ = −(aᵢ·x₀ + bᵢ) > 0.
 * ```
 *
 * The convex hull of `{yᵢ}` is the polar dual of the (recentred) polytope:
 * **each facet of the dual hull corresponds to a vertex of the primal
 * polytope**, and the primal vertex is the point where the `d` halfspaces
 * spanning that facet meet — the solution of the `d × d` linear system
 * `aᵢ·x = −bᵢ` over those `d` halfspaces. Redundant (non-hull) halfspaces map to
 * interior dual points and contribute no vertex, exactly as SciPy discards them.
 *
 * **Boundedness.** The primal polytope is bounded iff the dual-space **origin**
 * lies strictly inside `conv{yᵢ}` (equivalently, the halfspace normals `aᵢ`
 * positively span `ℝᵈ`). This is checked against the oriented dual-hull facets;
 * an unbounded polytope throws — mirroring SciPy's `QhullError`.
 *
 * ## Dimensions
 *
 * Implemented for **2-D and 3-D** by reusing the package's `convexHull`
 * (monotone-chain / QuickHull). For `d > 3` a clear error is thrown: the
 * general n-D case needs an n-D convex hull (QuickHull-n) or the
 * **double-description method** (Motzkin — incrementally intersect halfspaces,
 * maintaining the V-representation with an LP/adjacency feasibility step), which
 * MathTS's hull does not yet provide. Not half-shipped.
 *
 * Pinned against `scipy.spatial.HalfspaceIntersection(halfspaces,
 * interior_point).intersections` (the vertex set, order-independent to ~1e-9) in
 * `functions/tests/geometry-halfspace-oracle.test.ts`.
 *
 * @packageDocumentation
 */

import { convexHull } from './hull.js';

/** Structured halfspace-intersection result (mirrors SciPy's vertex output). */
export interface HalfspaceIntersectionResult {
  /**
   * Vertices of the bounded polytope `{x : A·x + b ≤ 0}` as coordinate arrays.
   * In 2-D they are ordered counter-clockwise (a polygon traversal); in 3-D the
   * order is unspecified (deduplicated).
   */
  vertices: number[][];
  /**
   * Vertex–facet incidence: `incidences[k]` lists the indices (into the input
   * `halfspaces`) of every halfspace that is **tight** (`a·v + b = 0`) at
   * `vertices[k]`. A true polytope vertex is tight on at least `d` halfspaces.
   */
  incidences: number[][];
}

/**
 * Tolerances. **All of these are RELATIVE**, applied to quantities that have
 * first been normalised to a scale-free form. This matters: a halfspace row
 * `[a, b]` may be multiplied by any positive constant without changing the
 * inequality `a·x + b ≤ 0`, and polytope coordinates carry units — so an
 * absolute threshold on a raw determinant, cross product, or residual is
 * meaningless, and silently mis-classifies ordinary inputs (a cube of side
 * 2000, or halfspace rows scaled by 1e-8).
 */
/** Relative floor for "the interior point is strictly interior". */
const STRICT_INTERIOR_REL = 1e-12;
/** Relative floor for "the origin is strictly inside the (unit-scaled) dual hull". */
const BOUNDED_REL = 1e-9;
/** Relative floor for "this halfspace is tight at this vertex". */
const TIGHT_REL = 1e-9;
/** Significant digits used to key vertex dedup (applied relative to coordinate scale). */
const DEDUP_SIG = 9;
/** Relative floor for a singular `d × d` facet system (vs the Hadamard bound). */
const SINGULAR_REL = 1e-12;

/** Largest absolute value in a set of coordinate vectors (0 if all-zero/empty). */
function maxAbs(points: number[][]): number {
  let m = 0;
  for (const p of points) {
    for (const x of p) {
      const a = Math.abs(x);
      if (a > m) m = a;
    }
  }
  return m;
}

/** Euclidean norm of a row. */
function rowNorm(row: number[]): number {
  let s = 0;
  for (const x of row) s += x * x;
  return Math.sqrt(s);
}

/**
 * Is `det` negligible for this system? Compared against the **Hadamard bound**
 * (the product of the row norms) — the natural scale of a `d × d` determinant —
 * so the test is invariant to rescaling any halfspace row.
 */
function isSingular(det: number, a: number[][]): boolean {
  let bound = 1;
  for (const row of a) bound *= rowNorm(row);
  return bound === 0 || Math.abs(det) <= SINGULAR_REL * bound;
}

/** Solve `A·x = c` for a 2×2 system via Cramer's rule. `null` if singular. */
function solve2(a: number[][], c: number[]): number[] | null {
  const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
  if (isSingular(det, a)) return null;
  return [(c[0] * a[1][1] - c[1] * a[0][1]) / det, (a[0][0] * c[1] - a[1][0] * c[0]) / det];
}

/** Solve `A·x = c` for a 3×3 system via Cramer's rule. `null` if singular. */
function solve3(a: number[][], c: number[]): number[] | null {
  const det =
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  if (isSingular(det, a)) return null;
  const detFor = (col: number): number => {
    const m = a.map((row, i) => row.map((v, j) => (j === col ? c[i] : v)));
    return (
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
  };
  return [detFor(0) / det, detFor(1) / det, detFor(2) / det];
}

/**
 * Verify the dual-space origin lies strictly inside `conv{dual}` (⇒ bounded).
 *
 * `dual` must already be normalised to unit scale (see {@link halfspaceIntersection}),
 * so a relative tolerance is meaningful here.
 *
 * Each facet's raw cross/dot product is divided by the facet's own edge length
 * (2-D) or normal magnitude (3-D), turning it into the **signed geometric
 * distance from the origin to that facet's supporting line/plane**. Without
 * that division a merely *thin* facet — a legitimate near-degenerate vertex —
 * yields a tiny raw product and is misread as "the origin is on the boundary",
 * i.e. a false `unbounded`. Distance is the scale-free quantity; the raw
 * product is not.
 */
function originStrictlyInside(
  dual: number[][],
  hull: { simplices: number[][] },
  dim: number
): boolean {
  for (const simplex of hull.simplices) {
    const p0 = dual[simplex[0]];
    if (dim === 2) {
      const p1 = dual[simplex[1]];
      // 2-D hull vertices are CCW; interior is strictly left of each directed edge.
      const ex = p1[0] - p0[0];
      const ey = p1[1] - p0[1];
      const edgeLen = Math.hypot(ex, ey);
      if (edgeLen === 0) continue; // coincident dual points — no constraint
      // cross(edge, origin - p0) / |edge| = distance, > 0 when the origin is left.
      const dist = (ex * (0 - p0[1]) - ey * (0 - p0[0])) / edgeLen;
      if (dist <= BOUNDED_REL) return false;
    } else {
      const p1 = dual[simplex[1]];
      const p2 = dual[simplex[2]];
      // 3-D faces are CCW as seen from outside → outward normal (p1-p0)×(p2-p0).
      const ux = p1[0] - p0[0];
      const uy = p1[1] - p0[1];
      const uz = p1[2] - p0[2];
      const vx = p2[0] - p0[0];
      const vy = p2[1] - p0[1];
      const vz = p2[2] - p0[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const nLen = Math.hypot(nx, ny, nz);
      if (nLen === 0) continue; // degenerate facet — no constraint
      // (origin - p0)·n / |n| = signed distance; must be < 0 (inner side).
      const dist = -(p0[0] * nx + p0[1] * ny + p0[2] * nz) / nLen;
      if (dist >= -BOUNDED_REL) return false;
    }
  }
  return true;
}

/**
 * Enumerate the vertices of the bounded polytope defined by a set of halfspaces.
 *
 * @param halfspaces - Rows `[a_1, …, a_d, b]` denoting `a·x + b ≤ 0`
 *   (SciPy's `Ax + b ≤ 0` convention). All rows must have length `d + 1`.
 * @param interiorPoint - A point `x₀` of length `d` that is **strictly interior**
 *   to the polytope (every `aᵢ·x₀ + bᵢ < 0`).
 * @returns A {@link HalfspaceIntersectionResult} (vertices + vertex-facet incidence).
 * @throws When `d ∉ {2, 3}`; when a halfspace row is malformed; when
 *   `interiorPoint` is not strictly interior; or when the polytope is unbounded.
 *
 * @example
 * // Unit square [0,1]² from its four edge halfspaces.
 * halfspaceIntersection(
 *   [[-1, 0, 0], [1, 0, -1], [0, -1, 0], [0, 1, -1]],
 *   [0.5, 0.5]
 * ).vertices; // the four corners (CCW)
 */
export function halfspaceIntersection(
  halfspaces: number[][],
  interiorPoint: number[]
): HalfspaceIntersectionResult {
  if (!Array.isArray(halfspaces) || halfspaces.length === 0) {
    throw new Error('halfspaceIntersection: requires a non-empty array of halfspaces');
  }
  if (!Array.isArray(interiorPoint)) {
    throw new Error('halfspaceIntersection: interiorPoint must be a coordinate array');
  }
  const dim = interiorPoint.length;
  if (dim !== 2 && dim !== 3) {
    throw new Error(
      `halfspaceIntersection: only 2-D and 3-D polytopes are supported (got dimension ${dim}). ` +
        'The general n-D case requires an n-D convex hull or the double-description method, ' +
        'which is not yet implemented.'
    );
  }
  for (const hs of halfspaces) {
    if (!Array.isArray(hs) || hs.length !== dim + 1) {
      throw new Error(
        `halfspaceIntersection: each halfspace must be a row [a_1..a_${dim}, b] of length ${dim + 1}`
      );
    }
  }
  if (halfspaces.length < dim + 1) {
    throw new Error(
      `halfspaceIntersection: the polytope is unbounded — a bounded ${dim}-D polytope needs at ` +
        `least ${dim + 1} halfspaces (got ${halfspaces.length}); fewer cannot enclose a bounded region`
    );
  }

  // Signed value a·x₀ + b of each halfspace at the interior point, alongside the
  // natural magnitude of that sum (|b| + Σ|aⱼ·x₀ⱼ|) so that "strictly negative"
  // is judged against the row's own scale rather than an absolute floor.
  const offsets: number[] = [];
  const offsetScales: number[] = [];
  for (const hs of halfspaces) {
    let s = hs[dim]; // b
    let mag = Math.abs(hs[dim]);
    for (let j = 0; j < dim; j++) {
      const term = hs[j] * interiorPoint[j];
      s += term;
      mag += Math.abs(term);
    }
    offsets.push(s);
    offsetScales.push(mag);
  }
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] >= -STRICT_INTERIOR_REL * offsetScales[i]) {
      throw new Error(
        `halfspaceIntersection: interiorPoint is not strictly interior — halfspace ${i} ` +
          `gives a·x₀ + b = ${offsets[i]} (must be < 0)`
      );
    }
  }

  // Dual transform: yᵢ = aᵢ / dᵢ, dᵢ = −(aᵢ·x₀ + bᵢ) > 0.
  const dual = halfspaces.map((hs, i) => {
    const d = -offsets[i];
    const y = new Array<number>(dim);
    for (let j = 0; j < dim; j++) y[j] = hs[j] / d;
    return y;
  });

  // Normalise the dual cloud to unit scale. Multiplying every dual point by one
  // positive constant leaves both the hull's combinatorics and the origin's
  // inside/outside status unchanged, but keeps the hull solver and the
  // boundedness test out of the under/overflow regimes that a very large or
  // very small primal polytope would otherwise drive them into (a cube of side
  // 1e6 previously collapsed the dual points enough that the hull itself
  // reported "all points co-planar").
  const dualScale = maxAbs(dual);
  const dualN =
    dualScale > 0 && Number.isFinite(dualScale)
      ? dual.map((y) => y.map((x) => x / dualScale))
      : dual;

  const hull = convexHull(dualN);

  if (!originStrictlyInside(dualN, hull, dim)) {
    throw new Error(
      'halfspaceIntersection: the polytope is unbounded (the halfspace normals do not ' +
        'positively span the space); vertex enumeration requires a bounded polytope'
    );
  }

  // Each dual-hull facet (d halfspace indices) → one primal vertex, the point
  // where those d supporting hyperplanes aᵢ·x = −bᵢ meet.
  const candidates: number[][] = [];
  for (const simplex of hull.simplices) {
    const aRows = simplex.map((idx) => halfspaces[idx].slice(0, dim));
    const cVals = simplex.map((idx) => -halfspaces[idx][dim]);
    const v = dim === 2 ? solve2(aRows, cVals) : solve3(aRows, cVals);
    if (v === null) continue; // degenerate facet (parallel normals) — no vertex
    if (!v.every((x) => Number.isFinite(x))) continue;
    candidates.push(v);
  }

  // Deduplicate relative to the coordinate scale. A fixed number of DECIMAL
  // places would collapse every vertex of a 1e-9-scale polytope onto one key,
  // and would fail to merge numerically-identical vertices of a 1e9-scale one.
  const vertScale = maxAbs(candidates);
  const quantum = vertScale > 0 ? vertScale * Math.pow(10, -DEDUP_SIG) : 0;
  const vertices: number[][] = [];
  const seen = new Set<string>();
  for (const v of candidates) {
    const key = quantum > 0 ? v.map((x) => Math.round(x / quantum)).join(',') : v.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    vertices.push(v);
  }

  // 2-D: order vertices CCW around their centroid (polygon traversal).
  if (dim === 2 && vertices.length > 2) {
    const cx = vertices.reduce((s, v) => s + v[0], 0) / vertices.length;
    const cy = vertices.reduce((s, v) => s + v[1], 0) / vertices.length;
    vertices.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
  }

  // Vertex–facet incidence: which halfspaces are tight at each vertex.
  const incidences = vertices.map((v) => {
    const tight: number[] = [];
    for (let i = 0; i < halfspaces.length; i++) {
      // Judge tightness relative to the magnitude of the terms being summed, so
      // the answer is invariant to rescaling the row or the coordinate system.
      let s = halfspaces[i][dim];
      let mag = Math.abs(halfspaces[i][dim]);
      for (let j = 0; j < dim; j++) {
        const term = halfspaces[i][j] * v[j];
        s += term;
        mag += Math.abs(term);
      }
      if (Math.abs(s) <= TIGHT_REL * mag) tight.push(i);
    }
    return tight;
  });

  return { vertices, incidences };
}
