/**
 * Symmetric 3x3 eigen-decomposition and inertia-tensor operations (issue 377):
 * eigSym3 against eigs and constructed spectra, rotateTensor and parallelAxis
 * against row-array oracles and exact hand cases. Also offsets, aliasing,
 * scale invariance and degenerate inputs. The zero-allocation check is in
 * tools/test/kernels-alloc.test.mjs.
 */
import { describe, expect, it } from 'vitest';
import * as F from '../../src/index.js';

type Arr = number[];
type Rows = number[][];
const K = F as unknown as Record<string, (...args: unknown[]) => unknown>;

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0x377);
const u = (): number => (rng() - 0.5) * 20;

/** A symmetric number[][] from the upper triangle of a column-major 9-array. */
function rowsFromUpper(m: ArrayLike<number>): Rows {
  const e = (r: number, c: number): number => (r <= c ? m[c * 3 + r]! : m[r * 3 + c]!);
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => e(r, c)));
}
function cmFromRows(M: Rows): Arr {
  const out: Arr = [];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out.push(M[r]![c]!);
  return out;
}
function rowsFromCm(m: ArrayLike<number>): Rows {
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => m[c * 3 + r]!));
}
const transposeRows = (M: Rows): Rows => [0, 1, 2].map((r) => [0, 1, 2].map((c) => M[c]![r]!));
const mul = (A: Rows, B: Rows): Rows => F.multiply(A, B) as Rows;
const diagRows = (d: Arr): Rows =>
  [0, 1, 2].map((r) => [0, 1, 2].map((c) => (r === c ? d[r]! : 0)));

function randomSym(): Arr {
  const m: Arr = new Array<number>(9).fill(0);
  for (let c = 0; c < 3; c++)
    for (let r = 0; r <= c; r++) {
      const x = u();
      m[c * 3 + r] = x;
      m[r * 3 + c] = x;
    }
  return m;
}

function randomRotationRows(): Rows {
  const q = [u(), u(), u(), u()];
  const n = Math.sqrt(q[0]! ** 2 + q[1]! ** 2 + q[2]! ** 2 + q[3]! ** 2);
  return F.quaternionToRotationMatrix(q.map((x) => x / n) as [number, number, number, number]);
}

/** R diag(d) Rᵀ as a column-major 9-array, built without the functions under test. */
function withSpectrum(R: Rows, d: Arr): Arr {
  return cmFromRows(mul(mul(R, diagRows(d)), transposeRows(R)));
}

function eigsValues(rows: Rows): { values: Arr; vectors: Arr[] } {
  const r = F.eigs(rows) as {
    values: unknown[];
    eigenvectors: { value: unknown; vector: unknown[] }[];
  };
  const re = (x: unknown): number => (typeof x === 'number' ? x : (x as { re: number }).re);
  const im = (x: unknown): number => (typeof x === 'number' ? 0 : (x as { im: number }).im);
  const values = r.values.map(re);
  const scale = Math.max(1, ...values.map(Math.abs));
  for (const x of r.values) expect(Math.abs(im(x))).toBeLessThanOrEqual(1e-12 * scale);
  const vectors = r.eigenvectors.map((e) => {
    const v = e.vector.map(re);
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  });
  return { values, vectors };
}

function run(m: ArrayLike<number>): { values: Arr; vectors: Arr } {
  const values: Arr = [9, 9, 9];
  const vectors: Arr = new Array<number>(9).fill(9);
  const ret = K.eigSym3!(values, vectors, m);
  expect(ret).toBeUndefined();
  return { values, vectors };
}

const col = (V: ArrayLike<number>, k: number): Arr => [V[3 * k]!, V[3 * k + 1]!, V[3 * k + 2]!];
const dot = (a: Arr, b: Arr): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
function det(V: ArrayLike<number>): number {
  const [a, b, c] = [col(V, 0), col(V, 1), col(V, 2)];
  return dot(a, [
    b[1]! * c[2]! - b[2]! * c[1]!,
    b[2]! * c[0]! - b[0]! * c[2]!,
    b[0]! * c[1]! - b[1]! * c[0]!,
  ]);
}
const normInf = (M: Rows): number =>
  Math.max(...M.map((row) => row.reduce((s, x) => s + Math.abs(x), 0)));

function expectBasis(V: Arr, tol = 1e-12): void {
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(dot(col(V, i), col(V, i)) - 1)).toBeLessThanOrEqual(tol);
    for (let j = i + 1; j < 3; j++)
      expect(Math.abs(dot(col(V, i), col(V, j)))).toBeLessThanOrEqual(tol);
  }
  expect(Math.abs(det(V) - 1)).toBeLessThanOrEqual(tol);
}

function expectReconstruct(m: ArrayLike<number>, values: Arr, V: Arr, tol = 1e-12): void {
  const Vr = rowsFromCm(V);
  const back = mul(mul(Vr, diagRows(values)), transposeRows(Vr));
  const want = rowsFromUpper(m);
  const bound = tol * Math.max(1, normInf(want));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      expect(Math.abs(back[r]![c]! - want[r]![c]!)).toBeLessThanOrEqual(bound);
}

function expectAscending(values: Arr): void {
  expect(values[0]!).toBeLessThanOrEqual(values[1]!);
  expect(values[1]!).toBeLessThanOrEqual(values[2]!);
}

function sameBits(a: ArrayLike<number>, b: ArrayLike<number>): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < b.length; i++)
    expect(Object.is(a[i], b[i]), `cell ${i}: ${a[i]} vs ${b[i]}`).toBe(true);
}

describe('eigSym3', () => {
  it('random symmetric matrices agree with eigs (10,000 draws)', () => {
    for (let k = 0; k < 10_000; k++) {
      const m = randomSym();
      const { values, vectors } = run(m);
      const ref = eigsValues(rowsFromUpper(m));
      const scale = Math.max(1, ...ref.values.map(Math.abs));
      for (let i = 0; i < 3; i++)
        expect(Math.abs(values[i]! - ref.values[i]!)).toBeLessThanOrEqual(1e-12 * scale);
      expectAscending(values);
      expectBasis(vectors);
      expectReconstruct(m, values, vectors);
      for (let i = 0; i < 3; i++) {
        const gap = Math.min(
          ...[0, 1, 2].filter((j) => j !== i).map((j) => Math.abs(values[i]! - values[j]!))
        );
        if (gap > 1e-6 * scale) {
          expect(Math.abs(dot(col(vectors, i), ref.vectors[i]!))).toBeGreaterThanOrEqual(1 - 1e-10);
        }
      }
    }
  });

  it('every permutation of diag(1, 2, 3) gives exact values and a signed-axis basis with det +1', () => {
    const perms = [
      [1, 2, 3],
      [1, 3, 2],
      [2, 1, 3],
      [2, 3, 1],
      [3, 1, 2],
      [3, 2, 1],
    ];
    for (const p of perms) {
      const m = cmFromRows(diagRows(p));
      const { values, vectors } = run(m);
      expect(values[0]).toBe(1);
      expect(values[1]).toBe(2);
      expect(values[2]).toBe(3);
      for (const x of vectors)
        expect(
          [0, 1, -1].some((y) => Object.is(x, y)),
          `entry ${x}`
        ).toBe(true);
      expect(det(vectors)).toBe(1);
    }
  });

  it('repeated eigenvalues give an orthonormal right-handed basis', () => {
    for (const d of [
      [4, 4, 4],
      [2, 2, 5],
    ]) {
      const { values, vectors } = run(cmFromRows(diagRows(d)));
      for (let i = 0; i < 3; i++)
        expect(Math.abs(values[i]! - d[i]!)).toBeLessThanOrEqual(1e-12 * 5);
      expectBasis(vectors);
    }
    for (let k = 0; k < 200; k++) {
      const R = randomRotationRows();
      const m = withSpectrum(R, [2, 2, 5]);
      const { values, vectors } = run(m);
      for (const [i, x] of [2, 2, 5].entries())
        expect(Math.abs(values[i]! - x)).toBeLessThanOrEqual(5e-12);
      expectBasis(vectors);
      expectReconstruct(m, values, vectors);
      const r2 = [R[0]![2]!, R[1]![2]!, R[2]![2]!];
      expect(Math.abs(dot(col(vectors, 2), r2))).toBeGreaterThanOrEqual(1 - 1e-10);
      expect(Math.abs(dot(col(vectors, 0), r2))).toBeLessThanOrEqual(1e-10);
      expect(Math.abs(dot(col(vectors, 1), r2))).toBeLessThanOrEqual(1e-10);
    }
  });

  it('a near-degenerate spectrum gives the constructed values', () => {
    for (let k = 0; k < 200; k++) {
      const d = [1, 1 + 1e-10, 3];
      const m = withSpectrum(randomRotationRows(), d);
      const { values, vectors } = run(m);
      for (let i = 0; i < 3; i++) expect(Math.abs(values[i]! - d[i]!)).toBeLessThanOrEqual(3e-12);
      expectBasis(vectors);
      expectReconstruct(m, values, vectors);
    }
  });

  it('equal diagonal entries with a nonzero off-diagonal rotate by 45 degrees in each pair', () => {
    const cases: [Rows, Arr][] = [
      [
        [
          [1, 0.5, 0],
          [0.5, 1, 0],
          [0, 0, 3],
        ],
        [0.5, 1.5, 3],
      ],
      [
        [
          [1, 0, 0.5],
          [0, 3, 0],
          [0.5, 0, 1],
        ],
        [0.5, 1.5, 3],
      ],
      [
        [
          [3, 0, 0],
          [0, 1, 0.5],
          [0, 0.5, 1],
        ],
        [0.5, 1.5, 3],
      ],
      [
        [
          [2, 1, 1],
          [1, 2, 1],
          [1, 1, 2],
        ],
        [1, 1, 4],
      ],
      [
        [
          [0, 1, 0],
          [1, 0, 0],
          [0, 0, 0],
        ],
        [-1, 0, 1],
      ],
    ];
    for (const [rows, want] of cases) {
      const m = cmFromRows(rows);
      const { values, vectors } = run(m);
      for (let i = 0; i < 3; i++)
        expect(Math.abs(values[i]! - want[i]!)).toBeLessThanOrEqual(1e-15 * 4);
      expectBasis(vectors);
      expectReconstruct(m, values, vectors);
    }
  });

  it('reads the upper triangle only', () => {
    for (let k = 0; k < 100; k++) {
      const m = randomSym();
      const ref = run(m);
      const junk = m.slice();
      junk[1] = u();
      junk[2] = Number.NaN;
      junk[5] = 1e300;
      const got = run(junk);
      sameBits(got.values, ref.values);
      sameBits(got.vectors, ref.vectors);
    }
  });

  it('offsets on Float64Array and number[] give the same bits, and outputs may alias m', () => {
    for (let k = 0; k < 100; k++) {
      const m = randomSym();
      const ref = run(m);
      const src = new Float64Array(9 + 5);
      src.set(m, 2);
      for (const make of [
        (n: number) => new Float64Array(n),
        (n: number) => new Array<number>(n).fill(0),
      ]) {
        const values = make(3 + 4);
        const vectors = make(9 + 3);
        K.eigSym3!(values, vectors, src, 4, 3, 2);
        sameBits(Array.from(values).slice(4, 7), ref.values);
        sameBits(Array.from(vectors).slice(3, 12), ref.vectors);
      }
      const a = m.slice();
      K.eigSym3!(new Array<number>(3).fill(0), a, a);
      sameBits(a, ref.vectors);
      const b = m.slice();
      K.eigSym3!(b, new Array<number>(9).fill(0), b);
      sameBits(b.slice(0, 3), ref.values);
      const shared = new Array<number>(12).fill(0);
      K.eigSym3!(shared, shared, m, 9, 0);
      sameBits(shared.slice(9, 12), ref.values);
      sameBits(shared.slice(0, 9), ref.vectors);
    }
  });

  it('a non-finite upper entry gives NaN in all 12 outputs and does not throw', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      for (const idx of [0, 3, 6, 4, 7, 8]) {
        const m = randomSym();
        m[idx] = bad;
        const { values, vectors } = run(m);
        expect([...values, ...vectors].every(Number.isNaN)).toBe(true);
      }
    }
  });

  it('the zero matrix gives zero values and the identity', () => {
    const { values, vectors } = run(new Array<number>(9).fill(0));
    for (const x of values) expect(Object.is(x, 0)).toBe(true);
    const id = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let i = 0; i < 9; i++) expect(Object.is(vectors[i], id[i])).toBe(true);
  });

  it('is exact under power-of-two scaling and finite near overflow and underflow', () => {
    for (let k = 0; k < 100; k++) {
      const m = randomSym();
      const ref = run(m);
      for (const p of [-1000, -500, -100, 100, 500, 1000]) {
        const s = 2 ** p;
        const scaled = run(m.map((x) => x * s));
        sameBits(
          scaled.values,
          ref.values.map((x) => x * s)
        );
        sameBits(scaled.vectors, ref.vectors);
      }
    }
    for (let k = 0; k < 100; k++) {
      const m = randomSym().map((x) => x * 1e306);
      const { values, vectors } = run(m);
      expect([...values, ...vectors].every(Number.isFinite)).toBe(true);
      expectBasis(vectors);
      expectReconstruct(m, values, vectors);
    }
    const tiny = randomSym().map((x) => x * 5e-324);
    const { values, vectors } = run(tiny);
    expect([...values, ...vectors].every(Number.isFinite)).toBe(true);
    expectBasis(vectors, 1e-12);
  });
});

describe('rotateTensor', () => {
  it('equals R I Rᵀ from row arrays, and is symmetric for a symmetric I', () => {
    for (let k = 0; k < 2_000; k++) {
      const Rr = randomRotationRows();
      const I = randomSym();
      const out: Arr = new Array<number>(9).fill(0);
      expect(K.rotateTensor!(out, cmFromRows(Rr), I)).toBe(out);
      const want = mul(mul(Rr, rowsFromCm(I)), transposeRows(Rr));
      const bound = 1e-15 * Math.max(1, normInf(want)) * 4;
      const got = rowsFromCm(out);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          expect(Math.abs(got[r]![c]! - want[r]![c]!)).toBeLessThanOrEqual(bound);
          expect(Math.abs(got[r]![c]! - got[c]![r]!)).toBeLessThanOrEqual(bound);
        }
    }
  });

  it('the identity rotation returns I bit for bit, and eigSym3 output reconstructs m', () => {
    const E = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let k = 0; k < 200; k++) {
      const I = randomSym();
      const out: Arr = new Array<number>(9).fill(0);
      K.rotateTensor!(out, E, I);
      sameBits(out, I);
      const { values, vectors } = run(I);
      K.rotateTensor!(out, vectors, cmFromRows(diagRows(values)));
      const bound = 1e-12 * Math.max(1, normInf(rowsFromCm(I)));
      for (let i = 0; i < 9; i++) expect(Math.abs(out[i]! - I[i]!)).toBeLessThanOrEqual(bound);
    }
  });

  it('is alias-safe for out === R and out === I', () => {
    for (let k = 0; k < 200; k++) {
      const R = cmFromRows(randomRotationRows());
      const I = randomSym();
      const fresh: Arr = new Array<number>(9).fill(0);
      K.rotateTensor!(fresh, R, I);
      const r = R.slice();
      K.rotateTensor!(r, r, I);
      sameBits(r, fresh);
      const i = I.slice();
      K.rotateTensor!(i, R, i);
      sameBits(i, fresh);
    }
  });

  it('honours offsets', () => {
    const R = cmFromRows(randomRotationRows());
    const I = randomSym();
    const fresh: Arr = new Array<number>(9).fill(0);
    K.rotateTensor!(fresh, R, I);
    const rb = new Float64Array(12);
    rb.set(R, 3);
    const ib = new Float64Array(11);
    ib.set(I, 2);
    const out = new Float64Array(14);
    K.rotateTensor!(out, rb, ib, 5, 3, 2);
    sameBits(Array.from(out).slice(5, 14), fresh);
  });
});

describe('parallelAxis', () => {
  it('gives the exact hand-computed results', () => {
    const out: Arr = new Array<number>(9).fill(7);
    expect(K.parallelAxis!(out, new Array<number>(9).fill(0), 2, [1, 0, 0])).toBe(out);
    const a = [0, 0, 0, 0, 2, 0, 0, 0, 2];
    for (let i = 0; i < 9; i++) expect(Object.is(out[i], a[i]), `a cell ${i}`).toBe(true);
    K.parallelAxis!(out, cmFromRows(diagRows([1, 2, 3])), 3, [1, 2, 3]);
    const b = cmFromRows([
      [40, -6, -9],
      [-6, 32, -18],
      [-9, -18, 18],
    ]);
    for (let i = 0; i < 9; i++) expect(out[i], `b cell ${i}`).toBe(b[i]);
    // A dominant component must not cancel the small squares on the diagonal.
    K.parallelAxis!(out, new Array<number>(9).fill(0), 1, [1e8, 3, 4]);
    expect(out[0]).toBe(25);
    K.parallelAxis!(out, new Array<number>(9).fill(0), 1, [1e8, 1, 1]);
    expect(out[0]).toBe(2);
  });

  it('is even in the offset, adds 2 m |d|² to the trace, and matches a row-array oracle', () => {
    const E3: Rows = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    for (let k = 0; k < 2_000; k++) {
      const I = randomSym();
      const mass = Math.abs(u());
      const d = [u(), u(), u()];
      const out: Arr = new Array<number>(9).fill(0);
      K.parallelAxis!(out, I, mass, d);
      const neg: Arr = new Array<number>(9).fill(0);
      K.parallelAxis!(
        neg,
        I,
        mass,
        d.map((x) => -x)
      );
      sameBits(neg, out);
      const dd = dot(d, d);
      const tr = out[0]! + out[4]! + out[8]!;
      const want = I[0]! + I[4]! + I[8]! + 2 * mass * dd;
      expect(Math.abs(tr - want)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(want)));
      const oracle = F.add(
        rowsFromCm(I),
        F.multiply(
          mass,
          F.subtract(
            F.multiply(dd, E3),
            F.multiply(
              d.map((x) => [x]),
              [d]
            )
          )
        )
      ) as Rows;
      const bound = 1e-15 * Math.max(1, normInf(oracle)) * 4;
      const got = rowsFromCm(out);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          expect(Math.abs(got[r]![c]! - oracle[r]![c]!)).toBeLessThanOrEqual(bound);
          expect(Object.is(got[r]![c]!, got[c]![r]!)).toBe(true);
        }
    }
  });

  it('is alias-safe for out === I and honours offsets', () => {
    for (let k = 0; k < 200; k++) {
      const I = randomSym();
      const d = [u(), u(), u()];
      const fresh: Arr = new Array<number>(9).fill(0);
      K.parallelAxis!(fresh, I, 1.5, d);
      const i = I.slice();
      K.parallelAxis!(i, i, 1.5, d);
      sameBits(i, fresh);
      const ib = new Float64Array(12);
      ib.set(I, 3);
      const db = new Float64Array(5);
      db.set(d, 1);
      const out = new Float64Array(11);
      K.parallelAxis!(out, ib, 1.5, db, 2, 3, 1);
      sameBits(Array.from(out).slice(2, 11), fresh);
    }
  });
});
