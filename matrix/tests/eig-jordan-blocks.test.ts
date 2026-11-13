import { describe, it, expect } from 'vitest';
// eig().repeatedEigenvalues on Jordan blocks of size 3 and more under a real similarity,
// and on distinct eigenvalues that lie as close as the copies of such a block.
import { eig, svd } from '@danielsimonjr/mathts-matrix';

type M = number[][];
const EPS = 2.220446049250313e-16;
const mul = (a: M, b: M): M =>
  a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const diag = (d: number[]): M => d.map((v, i) => d.map((_, j) => (i === j ? v : 0)));
const permute = (A: M, p: number[]): M => p.map((i) => p.map((j) => A[i][j]));

/** Block diagonal matrix of Jordan blocks `[lambda, size]`. */
function jordan(blocks: Array<[number, number]>): M {
  const n = blocks.reduce((s, b) => s + b[1], 0);
  const J: M = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let at = 0;
  for (const [lambda, size] of blocks) {
    for (let i = 0; i < size; i++) {
      J[at + i][at + i] = lambda;
      if (i + 1 < size) J[at + i][at + i + 1] = 1;
    }
    at += size;
  }
  return J;
}

/** Inverse of a unit triangular integer matrix by substitution: exact in integers. */
function invUnit(T: M, lower: boolean): M {
  const n = T.length;
  const X = diag(new Array<number>(n).fill(1));
  const rows = Array.from({ length: n }, (_, i) => (lower ? i : n - 1 - i));
  for (let c = 0; c < n; c++) {
    for (const i of rows) {
      let s = i === c ? 1 : 0;
      for (let k = 0; k < n; k++) if (k !== i) s -= T[i][k] * X[k][c];
      X[i][c] = s;
    }
  }
  return X;
}

/** S = L U with unit triangular integer factors, and its exact integer inverse. */
function unimodular(n: number): { S: M; Sinv: M } {
  const L: M = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : i > j ? ((i * 2 + j) % 3) - 1 : 0))
  );
  const U: M = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : i < j ? ((i + j * 2) % 3) - 1 : 0))
  );
  return { S: mul(L, U), Sinv: mul(invUnit(U, false), invUnit(L, true)) };
}

/** `S J S^-1` with integer entries, so the matrix holds the Jordan structure exactly. */
function similar(J: M): M {
  const { S, Sinv } = unimodular(J.length);
  const A = mul(mul(S, J), Sinv);
  for (const row of A) for (const v of row) expect(Number.isSafeInteger(v)).toBe(true);
  return A;
}

const normF = (A: M) => Math.hypot(...A.flat());

/** Largest distance between two computed eigenvalues within `tol` of `lambda`. */
function split(A: M, lambda: number, tol: number): number {
  const near = eig(A).values.filter((v) => Math.hypot(v.re - lambda, v.im) < tol);
  let d = 0;
  for (const a of near) for (const b of near) d = Math.max(d, Math.hypot(a.re - b.re, a.im - b.im));
  return d;
}

/** Nullity of `A - lambda I` from the singular values: the oracle for the rank test. */
function svdNullity(A: M, lambda: number): number {
  const B = A.map((r, i) => r.map((v, j) => v - (i === j ? lambda : 0)));
  const thr = Math.sqrt(EPS) * normF(A);
  return svd(B).S.filter((s) => s <= thr).length;
}

const shape = (A: M) =>
  eig(A).repeatedEigenvalues.map((g) => [g.algebraicMultiplicity, g.independentEigenvectors]);

describe('eig repeatedEigenvalues: Jordan blocks of size 3 and more', () => {
  const cases: Array<{ name: string; blocks: Array<[number, number]>; m: number; nu: number }> = [
    { name: 'J3(2)', blocks: [[2, 3]], m: 3, nu: 1 },
    { name: 'J4(2)', blocks: [[2, 4]], m: 4, nu: 1 },
    { name: 'J5(2)', blocks: [[2, 5]], m: 5, nu: 1 },
    {
      name: 'J3(2) and a simple 7',
      blocks: [
        [2, 3],
        [7, 1],
      ],
      m: 3,
      nu: 1,
    },
    {
      name: 'J3(2) and J1(2)',
      blocks: [
        [2, 3],
        [2, 1],
      ],
      m: 4,
      nu: 2,
    },
    {
      name: 'J2(2) and J2(2)',
      blocks: [
        [2, 2],
        [2, 2],
      ],
      m: 4,
      nu: 2,
    },
    {
      name: 'J3(2) and J2(2)',
      blocks: [
        [2, 3],
        [2, 2],
      ],
      m: 5,
      nu: 2,
    },
    {
      name: 'three simple copies of 2 and a simple 5',
      blocks: [
        [2, 1],
        [2, 1],
        [2, 1],
        [5, 1],
      ],
      m: 3,
      nu: 3,
    },
  ];
  for (const c of cases) {
    it(`${c.name} under an integer similarity: multiplicity ${c.m}, eigenvectors ${c.nu}`, () => {
      const A = similar(jordan(c.blocks));
      const r = eig(A).repeatedEigenvalues;
      expect(r).toHaveLength(1);
      expect(r[0].value.im).toBe(0);
      expect(r[0].value.re).toBeCloseTo(2, 6);
      expect(r[0].algebraicMultiplicity).toBe(c.m);
      expect(r[0].independentEigenvectors).toBe(c.nu);
      expect(r[0].defective).toBe(c.nu < c.m);
      // The pivoted-QR rank test agrees with the singular values.
      expect(svdNullity(A, 2)).toBe(c.nu);
    });
  }

  it('the copies of J3 and J4 split wider than the tolerance of a double eigenvalue', () => {
    // 2 * sqrt(eps) * ||A||_F links a double eigenvalue only, so that rule missed these blocks.
    for (const size of [3, 4]) {
      const A = similar(jordan([[2, size]]));
      expect(split(A, 2, 0.1)).toBeGreaterThan(2 * Math.sqrt(EPS) * normF(A));
    }
  });

  it('the result does not depend on the order of rows and columns', () => {
    const A = similar(
      jordan([
        [2, 3],
        [7, 1],
      ])
    );
    for (const p of [
      [3, 2, 1, 0],
      [1, 3, 0, 2],
      [2, 0, 3, 1],
    ]) {
      expect(shape(permute(A, p))).toEqual([[3, 1]]);
    }
  });

  it('a complex Jordan block of size 3 gives one group for each conjugate', () => {
    // Real form of J3(1 + i): 2x2 blocks [[1,-1],[1,1]] with identity coupling.
    const R = [
      [1, -1, 1, 0, 0, 0],
      [1, 1, 0, 1, 0, 0],
      [0, 0, 1, -1, 1, 0],
      [0, 0, 1, 1, 0, 1],
      [0, 0, 0, 0, 1, -1],
      [0, 0, 0, 0, 1, 1],
    ];
    const r = eig(similar(R)).repeatedEigenvalues;
    expect(r).toHaveLength(2);
    for (const g of r) {
      expect(g.algebraicMultiplicity).toBe(3);
      expect(g.independentEigenvectors).toBe(1);
      expect(g.value.re).toBeCloseTo(1, 4);
      expect(Math.abs(g.value.im)).toBeCloseTo(1, 4);
    }
  });
});

describe('eig repeatedEigenvalues: distinct eigenvalues as close as a split Jordan block', () => {
  const none = (A: M) => expect(eig(A).repeatedEigenvalues).toEqual([]);

  it('diag(1, 1 + 1e-7)', () => none(diag([1, 1 + 1e-7])));

  it('the 0.9e-6 chain in every order', () => {
    const d = [1, 1 + 0.9e-6, 1 + 1.8e-6];
    for (const p of [
      [0, 1, 2],
      [1, 0, 2],
      [2, 1, 0],
      [1, 2, 0],
      [0, 2, 1],
      [2, 0, 1],
    ]) {
      none(diag(p.map((i) => d[i])));
    }
  });

  it('the chain on the diagonal of a triangular matrix with weak coupling', () => {
    none([
      [1, 1e-6, -1e-6],
      [0, 1 + 0.9e-6, 1e-6],
      [0, 0, 1 + 1.8e-6],
    ]);
    none([
      [1 + 1.8e-6, 1e-6, -1e-6],
      [0, 1, 1e-6],
      [0, 0, 1 + 0.9e-6],
    ]);
  });

  it('the chain with strong coupling is a defective eigenvalue to working precision', () => {
    // A change of 5e-14 in one entry merges two of these eigenvalues into a Jordan block:
    // (0.9e-6 / 2)^2 / 5. The eigenvectors are parallel to 2e-7. In both orders the report
    // is one eigenvalue of multiplicity 3 with one eigenvector.
    expect(
      shape([
        [1, 5, -3],
        [0, 1 + 0.9e-6, 2],
        [0, 0, 1 + 1.8e-6],
      ])
    ).toEqual([[3, 1]]);
    expect(
      shape([
        [1 + 1.8e-6, 5, -3],
        [0, 1, 2],
        [0, 0, 1 + 0.9e-6],
      ])
    ).toEqual([[3, 1]]);
  });

  it('a normal matrix whose eigenvalues form the ring of a Jordan block', () => {
    // Eigenvalues 1, 1 + r and 1 + r exp(+-2 pi i / 3). The second moment about the mean is 0
    // and the mean is an eigenvalue, but the matrix is normal, so no eigenvalue is repeated.
    const r = 1e-6;
    const c = -0.5 * r;
    const s = (Math.sqrt(3) / 2) * r;
    const N = [
      [1, 0, 0, 0],
      [0, 1 + r, 0, 0],
      [0, 0, 1 + c, -s],
      [0, 0, s, 1 + c],
    ];
    none(N);
    for (const p of [
      [2, 0, 3, 1],
      [3, 2, 1, 0],
      [1, 2, 0, 3],
    ]) {
      none(permute(N, p));
    }
  });

  it('a normal ring inside the link tolerance but outside the rank tolerance', () => {
    // Side 5.0e-8 links the three eigenvalues (limit 5.2e-8). Each lies 2.9e-8 from the
    // mean, above the rank tolerance 2.6e-8, so `A - mean * I` has full rank: no group.
    const rho = 2.9e-8;
    const c = -0.5 * rho;
    const s = (Math.sqrt(3) / 2) * rho;
    none([
      [1 + rho, 0, 0],
      [0, 1 + c, -s],
      [0, s, 1 + c],
    ]);
  });

  it('a non-symmetric matrix with well separated eigenvalues', () => {
    none(similar(diag([1, 2, 3, 4, 5])));
  });
});
