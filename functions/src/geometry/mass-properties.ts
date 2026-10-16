/**
 * Mass properties of solids and plane figures: volume (area in 2-D), mass,
 * centroid and inertia tensor about the centroid.
 *
 * Every shape kind is one row of {@link MASS_PROPERTY_SHAPES}: its dimension,
 * its parameter names and the formula that returns the unit-density volume,
 * centroid and second moments. `massProperties` validates a shape against its
 * row and scales by `density`, so adding a kind means adding a row.
 *
 * Conventions:
 * - Lengths are in any consistent unit; `density` is mass per unit volume
 *   (per unit area in 2-D). Default density is 1.
 * - Primitives are centred on the origin. A capsule's axis is local +Y; its
 *   `halfHeight` is half the length of the straight (cylindrical) section.
 * - 3-D `inertia` is the 3x3 tensor about the centroid, in the shape frame.
 *   2-D `inertia` is the polar moment about the centroid (the z-axis term).
 * - A convex polyhedron is given by `vertices` and optional `faces` (index
 *   polygons). Without `faces` the convex hull of `vertices` is used. Face
 *   winding may be either way; the result's sign is normalised.
 * - A polygon is a simple polygon given by `vertices` in either winding.
 *
 * Polyhedra use the covariance (Tonon / Blow-Binstock) method: each face is
 * fanned into triangles, each triangle with the origin forms a tetrahedron, and
 * the exact second moments of the tetrahedra are summed. Polygons use the exact
 * shoelace sums. Both are exact for the given geometry, not approximations.
 *
 * @packageDocumentation
 */

import { convexHull } from './hull.js';

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

/** A shape accepted by {@link massProperties}. */
export type MassPropertyShape =
  | { type: 'sphere'; radius: number }
  | { type: 'box'; halfExtents: readonly [number, number, number] | readonly number[] }
  | { type: 'capsule'; radius: number; halfHeight: number }
  | {
      type: 'convexPolyhedron';
      vertices: readonly (readonly number[])[];
      faces?: readonly (readonly number[])[];
    }
  | { type: 'circle'; radius: number }
  | { type: 'rectangle'; halfExtents: readonly [number, number] | readonly number[] }
  | { type: 'capsule2d'; radius: number; halfHeight: number }
  | { type: 'polygon'; vertices: readonly (readonly number[])[] };

/** Result for a 3-D shape. */
export interface MassProperties3D {
  dims: 3;
  /** Volume. */
  volume: number;
  /** `density * volume`. */
  mass: number;
  centroid: [number, number, number];
  /** Inertia tensor about the centroid (mass-weighted). */
  inertia: [[number, number, number], [number, number, number], [number, number, number]];
}

/** Result for a 2-D shape. */
export interface MassProperties2D {
  dims: 2;
  /** Area (named `volume` so 2-D and 3-D results share one shape). */
  volume: number;
  /** `density * area`. */
  mass: number;
  centroid: [number, number];
  /** Polar moment about the centroid (mass-weighted). */
  inertia: number;
}

/** Unit-density result a row's formula returns. */
interface UnitMoments {
  volume: number;
  centroid: number[];
  /** 3-D: inertia tensor about the centroid; 2-D: `[[Izz]]`. */
  inertia: number[][];
}

/** One shape kind. */
export interface MassPropertyShapeRecord {
  readonly type: string;
  readonly dims: 2 | 3;
  /** Positive scalar parameters. */
  readonly scalars: readonly string[];
  /** Positive vector parameters with their length. */
  readonly vectors: Readonly<Record<string, number>>;
  /** Point-list parameter (polygon / polyhedron vertices), with point length. */
  readonly points?: { readonly name: string; readonly length: number };
  readonly unit: (shape: Record<string, unknown>) => UnitMoments;
}

const diag3 = (x: number, y: number, z: number): number[][] => [
  [x, 0, 0],
  [0, y, 0],
  [0, 0, z],
];

/** Every shape kind, as data. */
export const MASS_PROPERTY_SHAPES: readonly MassPropertyShapeRecord[] = Object.freeze([
  {
    type: 'sphere',
    dims: 3,
    scalars: ['radius'],
    vectors: {},
    unit: (s) => {
      const r = s.radius as number;
      const v = (4 / 3) * Math.PI * r ** 3;
      const i = 0.4 * v * r * r;
      return { volume: v, centroid: [0, 0, 0], inertia: diag3(i, i, i) };
    },
  },
  {
    type: 'box',
    dims: 3,
    scalars: [],
    vectors: { halfExtents: 3 },
    unit: (s) => {
      const [a, b, c] = s.halfExtents as number[];
      const v = 8 * a! * b! * c!;
      return {
        volume: v,
        centroid: [0, 0, 0],
        inertia: diag3(
          (v * (b! * b! + c! * c!)) / 3,
          (v * (a! * a! + c! * c!)) / 3,
          (v * (a! * a! + b! * b!)) / 3
        ),
      };
    },
  },
  {
    type: 'capsule',
    dims: 3,
    scalars: ['radius', 'halfHeight'],
    vectors: {},
    unit: (s) => {
      const r = s.radius as number;
      const h = s.halfHeight as number;
      const cyl = Math.PI * r * r * 2 * h;
      const caps = (4 / 3) * Math.PI * r ** 3;
      // Cylinder of length 2h plus two hemispheres shifted by the parallel-axis theorem.
      const axial = (cyl * (r * r)) / 2 + caps * 0.4 * r * r;
      const transverse =
        cyl * ((r * r) / 4 + (h * h) / 3) + caps * (0.4 * r * r + h * h + 0.75 * h * r);
      return {
        volume: cyl + caps,
        centroid: [0, 0, 0],
        inertia: diag3(transverse, axial, transverse),
      };
    },
  },
  {
    type: 'convexPolyhedron',
    dims: 3,
    scalars: [],
    vectors: {},
    points: { name: 'vertices', length: 3 },
    unit: (s) => polyhedronMoments(s.vertices as number[][], s.faces as number[][] | undefined),
  },
  {
    type: 'circle',
    dims: 2,
    scalars: ['radius'],
    vectors: {},
    unit: (s) => {
      const r = s.radius as number;
      const a = Math.PI * r * r;
      return { volume: a, centroid: [0, 0], inertia: [[(a * r * r) / 2]] };
    },
  },
  {
    type: 'rectangle',
    dims: 2,
    scalars: [],
    vectors: { halfExtents: 2 },
    unit: (s) => {
      const [a, b] = s.halfExtents as number[];
      const area = 4 * a! * b!;
      return { volume: area, centroid: [0, 0], inertia: [[(area * (a! * a! + b! * b!)) / 3]] };
    },
  },
  {
    type: 'capsule2d',
    dims: 2,
    scalars: ['radius', 'halfHeight'],
    vectors: {},
    unit: (s) => {
      const r = s.radius as number;
      const h = s.halfHeight as number;
      const rect = 4 * r * h;
      const disc = Math.PI * r * r;
      // Rectangle 2r x 2h plus two half-discs shifted by the parallel-axis theorem.
      const izz =
        (rect * (r * r + h * h)) / 3 + disc * ((r * r) / 2 + h * h + (8 * h * r) / (3 * Math.PI));
      return { volume: rect + disc, centroid: [0, 0], inertia: [[izz]] };
    },
  },
  {
    type: 'polygon',
    dims: 2,
    scalars: [],
    vectors: {},
    points: { name: 'vertices', length: 2 },
    unit: (s) => polygonMoments(s.vertices as number[][]),
  },
]);

const BY_TYPE = new Map(MASS_PROPERTY_SHAPES.map((row) => [row.type, row]));

function positive(name: string, x: unknown): void {
  if (typeof x !== 'number' || !Number.isFinite(x) || x <= 0) {
    throw new RangeError(
      `massProperties: ${name} must be a finite positive number; got ${String(x)}`
    );
  }
}

function finitePoints(name: string, pts: unknown, length: number, min: number): void {
  if (!Array.isArray(pts) || pts.length < min) {
    throw new RangeError(`massProperties: ${name} must list at least ${min} points`);
  }
  for (const p of pts) {
    if (
      !Array.isArray(p) ||
      p.length !== length ||
      !p.every((x) => typeof x === 'number' && Number.isFinite(x))
    ) {
      throw new RangeError(`massProperties: every ${name} entry must be ${length} finite numbers`);
    }
  }
}

/**
 * Mass properties of `shape` at uniform `density` (default 1).
 *
 * @example
 * massProperties({ type: 'box', halfExtents: [1, 2, 3] }, 1000)
 * // { dims: 3, volume: 48, mass: 48000, centroid: [0,0,0], inertia: [[208000,0,0], ...] }
 */
export function massProperties(
  shape: MassPropertyShape & { type: 'sphere' | 'box' | 'capsule' | 'convexPolyhedron' },
  density?: number
): MassProperties3D;
export function massProperties(
  shape: MassPropertyShape & { type: 'circle' | 'rectangle' | 'capsule2d' | 'polygon' },
  density?: number
): MassProperties2D;
export function massProperties(
  shape: MassPropertyShape,
  density?: number
): MassProperties3D | MassProperties2D;
export function massProperties(
  shape: MassPropertyShape,
  density = 1
): MassProperties3D | MassProperties2D {
  const row = BY_TYPE.get((shape as { type?: unknown })?.type as string);
  if (row === undefined) {
    throw new RangeError(
      `massProperties: shape type must be one of ${MASS_PROPERTY_SHAPES.map((r) => r.type).join(', ')}; got ${String((shape as { type?: unknown })?.type)}`
    );
  }
  positive('density', density);
  const s = shape as unknown as Record<string, unknown>;
  for (const name of row.scalars) positive(`${row.type}.${name}`, s[name]);
  for (const [name, n] of Object.entries(row.vectors)) {
    const v = s[name];
    if (!Array.isArray(v) || v.length !== n)
      throw new RangeError(`massProperties: ${row.type}.${name} must have ${n} components`);
    v.forEach((x, i) => positive(`${row.type}.${name}[${i}]`, x));
  }
  if (row.points)
    finitePoints(
      `${row.type}.${row.points.name}`,
      s[row.points.name],
      row.points.length,
      row.dims + 1
    );

  const u = row.unit(s);
  if (!(u.volume > 0))
    throw new RangeError(
      `massProperties: ${row.type} is degenerate (zero ${row.dims === 2 ? 'area' : 'volume'})`
    );
  const mass = density * u.volume;
  if (row.dims === 2) {
    return {
      dims: 2,
      volume: u.volume,
      mass,
      centroid: [u.centroid[0]!, u.centroid[1]!],
      inertia: density * u.inertia[0]![0]!,
    };
  }
  return {
    dims: 3,
    volume: u.volume,
    mass,
    centroid: [u.centroid[0]!, u.centroid[1]!, u.centroid[2]!],
    inertia: u.inertia.map((r) => r.map((x) => density * x)) as Mat3,
  };
}

/** Exact area, centroid and polar moment of a simple polygon (shoelace sums). */
function polygonMoments(v: number[][]): UnitMoments {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  let j0 = 0; // ∫(x²+y²) dA about the origin, times 12
  for (let i = 0; i < v.length; i++) {
    const [x0, y0] = v[i]!;
    const [x1, y1] = v[(i + 1) % v.length]!;
    const c = x0! * y1! - x1! * y0!;
    a2 += c;
    cx += (x0! + x1!) * c;
    cy += (y0! + y1!) * c;
    j0 += c * (x0! * x0! + x0! * x1! + x1! * x1! + y0! * y0! + y0! * y1! + y1! * y1!);
  }
  const sign = Math.sign(a2);
  const area = Math.abs(a2) / 2;
  const centroid = [cx / (3 * a2), cy / (3 * a2)];
  const jOrigin = (sign * j0) / 12;
  const jc = jOrigin - area * (centroid[0]! ** 2 + centroid[1]! ** 2);
  return { volume: area, centroid, inertia: [[jc]] };
}

/** Exact volume, centroid and inertia of a closed polyhedron (covariance method). */
function polyhedronMoments(vertices: number[][], faces?: number[][]): UnitMoments {
  const polys = faces ?? convexHull(vertices).simplices;
  let vol6 = 0;
  const first: Vec3 = [0, 0, 0];
  const cov: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const face of polys) {
    if (face.length < 3)
      throw new RangeError('massProperties: every polyhedron face needs at least 3 vertices');
    const a = vertices[face[0]!];
    if (a === undefined) throw new RangeError(`massProperties: face index ${face[0]} out of range`);
    for (let k = 1; k + 1 < face.length; k++) {
      const b = vertices[face[k]!];
      const c = vertices[face[k + 1]!];
      if (b === undefined || c === undefined)
        throw new RangeError('massProperties: face index out of range');
      // det [a b c] = 6 * signed volume of tetrahedron (0, a, b, c).
      const d =
        a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) -
        a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) +
        a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!);
      vol6 += d;
      for (let p = 0; p < 3; p++) {
        const sp = a[p]! + b[p]! + c[p]!;
        first[p] += (d * sp) / 24;
        for (let q = 0; q < 3; q++) {
          const sq = a[q]! + b[q]! + c[q]!;
          // ∫ x_p x_q dV over the tetrahedron = det/120 (Σ v_p v_q + s_p s_q).
          cov[p][q] += (d * (a[p]! * a[q]! + b[p]! * b[q]! + c[p]! * c[q]! + sp * sq)) / 120;
        }
      }
    }
  }
  const sign = Math.sign(vol6);
  const volume = Math.abs(vol6) / 6;
  const centroid = first.map((x) => (sign * x) / volume);
  // Second moments about the centroid, then I = tr(C) E - C.
  const c = cov.map((row, p) => row.map((x, q) => sign * x - volume * centroid[p]! * centroid[q]!));
  const tr = c[0]![0]! + c[1]![1]! + c[2]![2]!;
  const inertia = c.map((row, p) => row.map((x, q) => (p === q ? tr : 0) - x));
  return { volume, centroid, inertia };
}
