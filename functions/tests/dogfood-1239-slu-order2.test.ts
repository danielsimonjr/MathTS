/**
 * Dogfood #1239 - slu with order 2 (A'*A ordering) on a matrix with a dense row.
 *
 * csAmd drops the dense columns of A' (the dense rows of A) in place. A column is
 * dense when it has more than min(n - 2, max(16, 10 * sqrt(n))) entries. For a
 * matrix of up to four columns the limit removes some or all columns. For a larger
 * matrix it removes each row that is full or almost full. The compaction must leave
 * A' consistent, so that the next transpose and the product A' * A work. slu
 * returns a valid ordering, and P A Q = L U, for every order from 0 to 3.
 */
import { describe, it, expect } from 'vitest';
import { slu as sluFn, sparse } from '../src/factories/index.js';

type Mat = { toArray(): number[][] };
type R = { L: Mat; U: Mat; p: number[]; q: number[] | null };
const slu = sluFn as (a: unknown, order: number, threshold: number) => R;

const isPerm = (v: number[], n: number) =>
  v.length === n && [...v].sort((a, b) => a - b).every((x, i) => x === i);

/** Check that (P A Q) = L U with (P A Q)[p[i]][j] = A[i][q[j]]. */
function expectFactorization(a: number[][], r: R) {
  const n = a.length;
  expect(isPerm(r.p, n)).toBe(true);
  const q = r.q ?? Array.from({ length: n }, (_, j) => j);
  expect(isPerm(q, n)).toBe(true);
  const lm = r.L.toArray();
  const um = r.U.toArray();
  // tolerance relative to the scale of A: n entries of size max|a| meet in each sum
  const tol = 1e-14 * n * Math.max(1, ...a.flat().map(Math.abs));
  const lu = lm.map((row) => um[0].map((_, j) => row.reduce((s, x, k) => s + x * um[k][j], 0)));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      expect(Math.abs(lu[r.p[i]][j] - a[i][q[j]])).toBeLessThanOrEqual(tol);
    }
  }
}

const tri = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 4 : Math.abs(i - j) === 1 ? 1 : 0))
  );
const identity = (n: number) =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

const CASES: [string, number[][]][] = [
  ['1x1', [[4]]],
  [
    '2x2',
    [
      [4, 3],
      [6, 3],
    ],
  ],
  ['2x2 identity', identity(2)],
  [
    '3x3',
    [
      [2, 1, 0],
      [1, 3, 1],
      [0, 1, 4],
    ],
  ],
  ['3x3 identity', identity(3)],
  ['4x4 tridiagonal', tri(4)],
  ['5x5 tridiagonal', tri(5)],
  ['6x6 tridiagonal', tri(6)],
  ['6x6 diagonal', identity(6).map((r, i) => r.map((x) => x * (i + 2)))],
  [
    '6x6 full',
    Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => (i === j ? 20 : 1 + ((i * 7 + j * 3) % 5)))
    ),
  ],
];

// Shapes for the grid of sizes 1 to 5. Each matrix is nonsingular.
const SHAPES: [string, (n: number) => number[][]][] = [
  ['tridiagonal', tri],
  ['identity', identity],
  [
    'full',
    (n) =>
      Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 20 : 1 + ((i * 7 + j * 3) % 5)))
      ),
  ],
  [
    'dense column',
    (n) =>
      Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 5 : j === 0 ? 1 : 0))
      ),
  ],
  ['dense row', (n) => denseRow(n, 0)],
  [
    'antidiagonal',
    (n) =>
      Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i + j === n - 1 ? 3 : 0))
      ),
  ],
];

/** A diagonal matrix with one full row: csAmd drops that row at order 2. */
function denseRow(n: number, row: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? n + 1 : i === row ? 1 : 0))
  );
}

describe('#1239 slu order 2 on square sparse matrices with a dense row', () => {
  it.each(CASES)('%s factorizes at order 2', (_name, a) => {
    expectFactorization(a, slu(sparse(a), 2, 0.001));
  });

  it.each([0, 1, 2, 3])('every case factorizes at order %i', (order) => {
    for (const [, a] of CASES) expectFactorization(a, slu(sparse(a), order, 1));
  });

  // a zero diagonal with threshold 0 gives a zero pivot at every order (#1277)
  it.each(SHAPES)('%s of size 1 to 5 factorizes at each order and threshold', (name, make) => {
    for (let n = 1; n <= 5; n++) {
      const a = make(n);
      for (const order of [0, 1, 2, 3]) {
        for (const threshold of [0, 0.001, 1]) {
          if (name === 'antidiagonal' && threshold === 0) continue;
          expectFactorization(a, slu(sparse(a), order, threshold));
        }
      }
    }
  });

  // the dense limit is n - 2 up to n = 18 and max(16, 10 * sqrt(n)) above: a full row is dense
  it.each([5, 8, 18, 19, 20, 50, 200])('a matrix of size %i with a full row factorizes', (n) => {
    for (const row of [0, n >> 1, n - 1]) {
      const a = denseRow(n, row);
      for (const order of [0, 1, 2, 3]) expectFactorization(a, slu(sparse(a), order, 1));
    }
  });

  it('50 random sparse matrices of size 1-30 factorize at orders 0-3', () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let t = 0; t < 50; t++) {
      const n = 1 + Math.floor(rnd() * 30);
      const density = 0.1 + rnd() * 0.9;
      const a = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) =>
          i === j ? n + 1 : rnd() < density ? Math.round(rnd() * 8 - 4) : 0
        )
      );
      for (const order of [0, 1, 2, 3]) expectFactorization(a, slu(sparse(a), order, 1));
    }
  });
});
