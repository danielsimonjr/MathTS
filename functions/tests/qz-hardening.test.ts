import { describe, it, expect } from 'vitest';
import { qz, generalizedEig } from '../src/index.js';

type Cpx = number | { re: number; im: number };
const re = (z: Cpx) => (typeof z === 'number' ? z : z.re);
const im = (z: Cpx) => (typeof z === 'number' ? 0 : z.im);

const mul = (X: number[][], Y: number[][]) =>
  X.map((row) => Y[0].map((_, j) => row.reduce((s, v, k) => s + v * Y[k][j], 0)));
const tr = (X: number[][]) => X[0].map((_, j) => X.map((r) => r[j]));

/** det of a small real matrix via cofactor expansion (n ≤ 4). */
function det(A: number[][]): number {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
  let d = 0;
  for (let j = 0; j < n; j++) {
    const minor = A.slice(1).map((row) => row.filter((_, c) => c !== j));
    d += (j % 2 === 0 ? 1 : -1) * A[0][j] * det(minor);
  }
  return d;
}

/** Sort real-eigenvalue lists ascending; assert they match to `digits`. */
function expectRealSpectrumClose(got: Cpx[], expected: number[], digits: number): void {
  const g = got.map(re).sort((a, b) => a - b);
  const e = expected.slice().sort((a, b) => a - b);
  expect(g).toHaveLength(e.length);
  for (let i = 0; i < e.length; i++) expect(g[i]).toBeCloseTo(e[i], digits);
}

describe('generalizedEig — scipy-pinned across real / complex / clustered spectra', () => {
  // Oracles from scipy.linalg.eig(A, B).
  it('real diagonal pencil → [2, 5]', () => {
    const { values } = generalizedEig(
      [
        [2, 0],
        [0, 5],
      ],
      [
        [1, 0],
        [0, 1],
      ]
    );
    expectRealSpectrumClose(values, [2, 5], 9);
  });

  it('clustered spectrum [2, 2, 2.0001] resolved (not merged)', () => {
    const { values } = generalizedEig(
      [
        [2, 1, 0],
        [0, 2, 0],
        [0, 0, 2.0001],
      ],
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]
    );
    expectRealSpectrumClose(values, [2, 2, 2.0001], 9);
  });

  it('complex-conjugate pair ±i plus a real 3', () => {
    const { values } = generalizedEig(
      [
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 3],
      ],
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]
    );
    // One real eigenvalue 3, and a ±i pair.
    const reals = values.filter((z) => Math.abs(im(z)) < 1e-9).map(re);
    const imags = values.filter((z) => Math.abs(im(z)) >= 1e-9);
    expect(reals.some((v) => Math.abs(v - 3) < 1e-9)).toBe(true);
    expect(imags).toHaveLength(2);
    for (const z of imags) {
      expect(Math.abs(re(z))).toBeLessThan(1e-9);
      expect(Math.abs(Math.abs(im(z)) - 1)).toBeLessThan(1e-9);
    }
  });

  it('general nonsingular B pencil → scipy [0.758963, 1, 3.07437], with det(A − λB) ≈ 0', () => {
    const A = [
      [1, 2, 0],
      [0, 3, 1],
      [1, 0, 4],
    ];
    const B = [
      [2, 0, 0],
      [0, 1, 0],
      [0, 0, 3],
    ];
    const { values } = generalizedEig(A, B);
    expectRealSpectrumClose(values, [0.758963, 1.0, 3.07437], 4);
    // Implementation-independent oracle: each λ is a root of det(A − λB).
    for (const z of values) {
      const lam = re(z);
      const AmlB = A.map((row, i) => row.map((v, j) => v - lam * B[i][j]));
      const scale = Math.abs(det(B)) + 1;
      expect(Math.abs(det(AmlB)) / scale).toBeLessThan(1e-6);
    }
  });
});

describe('qz — hardened Schur no longer stalls; decomposition contract holds', () => {
  const A = [
    [1, 2, 0],
    [0, 3, 1],
    [1, 0, 4],
  ];
  const B = [
    [2, 0, 0],
    [0, 1, 0],
    [0, 0, 3],
  ];

  it('does not throw on the non-symmetric B⁻¹A pencil that stalled the old single-shift QR', () => {
    expect(() => qz(A, B)).not.toThrow();
  });

  it('reconstructs A = Q·AA·Zᵀ and B = Q·BB·Zᵀ with orthogonal Q, Z', () => {
    const { AA, BB, Q, Z } = qz(A, B);
    const recA = mul(mul(Q, AA), tr(Z));
    const recB = mul(mul(Q, BB), tr(Z));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(recA[i][j]).toBeCloseTo(A[i][j], 9);
        expect(recB[i][j]).toBeCloseTo(B[i][j], 9);
      }
    }
    // Orthogonality QᵀQ = I, ZᵀZ = I.
    const QtQ = mul(tr(Q), Q);
    const ZtZ = mul(tr(Z), Z);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(QtQ[i][j]).toBeCloseTo(i === j ? 1 : 0, 9);
        expect(ZtZ[i][j]).toBeCloseTo(i === j ? 1 : 0, 9);
      }
    }
  });

  it('AA is quasi-upper-triangular and BB upper-triangular (all-real spectrum → both triangular)', () => {
    const { AA, BB } = qz(A, B);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < i; j++) {
        // strictly-lower entries vanish (real spectrum ⇒ no 2×2 blocks)
        expect(Math.abs(AA[i][j])).toBeLessThan(1e-8);
        expect(Math.abs(BB[i][j])).toBeLessThan(1e-8);
      }
    }
    // Generalized eigenvalues diag(AA)/diag(BB) match scipy (all real).
    const gen = [0, 1, 2].map((i) => AA[i][i] / BB[i][i]).sort((a, b) => a - b);
    const scipy = [0.758963, 1.0, 3.07437];
    for (let i = 0; i < 3; i++) expect(gen[i]).toBeCloseTo(scipy[i], 4);
  });
});
