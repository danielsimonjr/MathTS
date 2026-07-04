import { describe, it, expect } from 'vitest';
import { hessenbergForm, polarDecomposition, qz } from '@danielsimonjr/mathts-functions';
import { lowRankApprox, pinv } from '@danielsimonjr/mathts-matrix';

/**
 * WS-1 P2 — factor/eigenvalue oracle pins for the matrix decompositions the
 * oracle-coverage matrix listed as SELF-REF (verified only by reconstruction
 * `A ≈ Q·H·Qᵀ` etc., which — as the `matrixSchur` incident showed — a systematically
 * wrong decomposition can pass). Each case below pins the ACTUAL factors or the
 * decomposition's mathematical invariants, computed independently.
 * See [[feedback-oracle-tests-implementation-independent]].
 */

const near = (a: number, b: number, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

describe('polarDecomposition — pinned factors', () => {
  it('A = 2·R (R a 90° rotation) → U = R, P = 2·I', async () => {
    // [[0,-2],[2,0]] = rotation(90°) scaled by 2; polar factors are exact.
    const { U, P } = await polarDecomposition([
      [0, -2],
      [2, 0],
    ]);
    expect(U).toEqual([
      [0, -1],
      [1, 0],
    ]);
    expect(P[0][0]).toBeCloseTo(2, 10);
    expect(P[1][1]).toBeCloseTo(2, 10);
    expect(P[0][1]).toBeCloseTo(0, 10);
  });
});

describe('hessenbergForm — Householder invariants', () => {
  const A = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 10],
  ];
  const { H } = hessenbergForm(A);
  it('subdiagonal-below entry is exactly zeroed (H[2][0] = 0)', () =>
    expect(Math.abs(H[2][0])).toBeCloseTo(0, 12));
  it('|H[1][0]| = ‖[A₁₀, A₂₀]‖ = √(4²+7²) = √65 (Householder reflection)', () =>
    expect(Math.abs(H[1][0])).toBeCloseTo(Math.sqrt(65), 10));
  it('trace preserved (eigenvalue sum): tr(H) = tr(A) = 16', () =>
    expect(H[0][0] + H[1][1] + H[2][2]).toBeCloseTo(16, 9));
});

describe('qz — generalized eigenvalues', () => {
  it('qz(diag(2,3), I): AA = diag(2,3), BB = I → gen-eigenvalues 2, 3', () => {
    const { AA, BB } = qz(
      [
        [2, 0],
        [0, 3],
      ],
      [
        [1, 0],
        [0, 1],
      ]
    );
    // generalized eigenvalues λ_i = AA_ii / BB_ii
    expect(near(AA[0][0] / BB[0][0], 2)).toBe(true);
    expect(near(AA[1][1] / BB[1][1], 3)).toBe(true);
  });
});

describe('lowRankApprox — exact truncation', () => {
  it('rank-1 approx of diag(3,1) drops the smaller singular value → [[3,0],[0,0]]', () => {
    expect(
      lowRankApprox(
        [
          [3, 0],
          [0, 1],
        ],
        1
      )
    ).toEqual([
      [3, 0],
      [0, 0],
    ]);
  });
});

describe('pinv — Moore-Penrose of a diagonal', () => {
  it('pinv(diag(2,4)) = diag(½, ¼)', () => {
    expect(
      pinv([
        [2, 0],
        [0, 4],
      ])
    ).toEqual([
      [0.5, 0],
      [0, 0.25],
    ]);
  });
});
