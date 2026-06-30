import { describe, it, expect } from 'vitest';
import {
  hessian,
  laplacianMatrix,
  slerp,
  quaternionFromAxisAngle,
  quaternionMultiply,
  quaternionConjugate,
  quaternionNormalize,
  quaternionRotate,
  quaternionToRotationMatrix,
} from '@danielsimonjr/mathts-functions';

/**
 * Wave C (part 2) — calculus/graph/geometry connectors. hessian vs the analytic
 * Hessian; laplacianMatrix vs D−A; quaternion ops vs known 90°-about-z rotation
 * (cross-checked against scipy.spatial.transform.Rotation during development).
 */
const matClose = (a: number[][], b: number[][], d = 6) => {
  expect(a).toHaveLength(b.length);
  a.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(b[i][j], d)));
};
const vecClose = (a: number[], b: number[], d = 9) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));
};

describe('gap Wave C — hessian (bridge C3)', () => {
  it('matches the analytic Hessian of f = x²y + y³', () => {
    // ∇²f = [[2y, 2x], [2x, 6y]]; at (2,3) → [[6,4],[4,18]]
    matClose(
      hessian((v) => v[0] * v[0] * v[1] + v[1] ** 3, [2, 3]),
      [
        [6, 4],
        [4, 18],
      ],
      3
    );
  });

  it('is symmetric and handles a 3-variable quadratic exactly', () => {
    // f = ½ xᵀAx with symmetric A → Hessian = A
    const A = [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2],
    ];
    const f = (v: number[]) => {
      let s = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += 0.5 * A[i][j] * v[i] * v[j];
      return s;
    };
    matClose(hessian(f, [1, 2, 3]), A, 3);
  });
});

describe('gap Wave C — graph Laplacian (bridge C6)', () => {
  const triangle = [
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ];
  it('combinatorial L = D − A', () => {
    matClose(laplacianMatrix(triangle), [
      [2, -1, -1],
      [-1, 2, -1],
      [-1, -1, 2],
    ]);
  });
  it('symmetric normalized L = I − D^(−1/2) A D^(−1/2)', () => {
    matClose(laplacianMatrix(triangle, { normalized: true }), [
      [1, -0.5, -0.5],
      [-0.5, 1, -0.5],
      [-0.5, -0.5, 1],
    ]);
  });
});

describe('gap Wave C — slerp + quaternions (bridge C7)', () => {
  it('slerp halfway along a 90° arc', () => {
    vecClose(slerp([1, 0, 0], [0, 1, 0], 0.5), [Math.SQRT1_2, Math.SQRT1_2, 0]);
    vecClose(slerp([1, 0, 0], [0, 1, 0], 0), [1, 0, 0]);
    vecClose(slerp([1, 0, 0], [0, 1, 0], 1), [0, 1, 0]);
  });

  it('90°-about-z quaternion rotates x → y and yields the z-rotation matrix', () => {
    const q = quaternionFromAxisAngle([0, 0, 1], Math.PI / 2);
    vecClose(quaternionRotate(q, [1, 0, 0]), [0, 1, 0]);
    matClose(quaternionToRotationMatrix(q), [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ]);
  });

  it('q · q* = identity quaternion; normalize gives unit norm', () => {
    const q = quaternionFromAxisAngle([1, 2, 3], 1.1);
    vecClose(quaternionMultiply(q, quaternionConjugate(q)), [1, 0, 0, 0]);
    const u = quaternionNormalize([1, 2, 3, 4]);
    expect(Math.hypot(...u)).toBeCloseTo(1, 12);
  });
});
