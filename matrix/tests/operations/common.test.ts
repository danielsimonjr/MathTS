/**
 * Tests for the shared decomposition helpers in operations/common.ts.
 *
 * These guard the behavior-preserving extraction (Clusters F + G of the
 * duplication audit). The most important invariant is the parameterized
 * `householder` degenerate-branch beta: eig/svd default to -2, schur passes 2.
 */

import { describe, it, expect } from 'vitest';
import {
  eye,
  cloneMatrix,
  transpose,
  isSymmetric,
  matMul,
  matAdd,
  matSub,
  matScale,
  normInf,
  norm1,
  householder,
  applyHouseholderLeft,
  applyHouseholderRight,
} from '../../src/operations/common.js';

describe('operations/common — structural helpers', () => {
  it('eye builds an identity matrix', () => {
    expect(eye(3)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(eye(0)).toEqual([]);
  });

  it('cloneMatrix deep-copies rows', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const B = cloneMatrix(A);
    expect(B).toEqual(A);
    B[0][0] = 99;
    expect(A[0][0]).toBe(1); // original untouched
  });

  it('transpose flips rows and columns (non-square)', () => {
    expect(
      transpose([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('isSymmetric: empty true, non-square false, tolerance respected', () => {
    expect(isSymmetric([])).toBe(true);
    expect(isSymmetric([[1, 2, 3]])).toBe(false);
    expect(
      isSymmetric([
        [1, 2],
        [2, 1],
      ])
    ).toBe(true);
    expect(
      isSymmetric([
        [1, 2],
        [2.5, 1],
      ])
    ).toBe(false);
    // within tolerance
    expect(
      isSymmetric(
        [
          [1, 2],
          [2 + 1e-12, 1],
        ],
        1e-10
      )
    ).toBe(true);
  });
});

describe('operations/common — dense algebra', () => {
  const A = [
    [1, 2],
    [3, 4],
  ];
  const B = [
    [5, 6],
    [7, 8],
  ];

  it('matMul multiplies (and handles non-square)', () => {
    expect(matMul(A, B)).toEqual([
      [19, 22],
      [43, 50],
    ]);
    expect(
      matMul(
        [[1, 2, 3]],
        [[1], [2], [3]]
      )
    ).toEqual([[14]]);
  });

  it('matAdd / matSub / matScale', () => {
    expect(matAdd(A, B)).toEqual([
      [6, 8],
      [10, 12],
    ]);
    expect(matSub(B, A)).toEqual([
      [4, 4],
      [4, 4],
    ]);
    expect(matScale(A, 2)).toEqual([
      [2, 4],
      [6, 8],
    ]);
  });

  it('norm1 is max absolute column sum; normInf is max absolute entry', () => {
    const M = [
      [1, -7],
      [-3, 4],
    ];
    expect(norm1(M)).toBe(11); // column 1: |−7|+|4| = 11
    expect(normInf(M)).toBe(7);
  });
});

describe('operations/common — householder', () => {
  it('returns beta 0 when x is already a positive multiple of e_1', () => {
    expect(householder([5, 0, 0]).beta).toBe(0);
  });

  it('degenerate negative-x0 branch uses parameterized beta (default -2, schur 2)', () => {
    const xNeg = [-5, 0, 0];
    // Default (eig/svd): beta = -2
    expect(householder(xNeg).beta).toBe(-2);
    // Schur divergence: beta = 2
    expect(householder(xNeg, 2).beta).toBe(2);
    // Same reflection vector in both cases
    expect(householder(xNeg).v).toEqual(householder(xNeg, 2).v);
    expect(householder(xNeg).v).toEqual([1, 0, 0]);
  });

  it('general branch: H = I - beta*v*v^T zeros the tail of x', () => {
    const x = [3, 4];
    const { v, beta } = householder(x);
    // Apply H to x via the left reflector and confirm the tail is annihilated.
    const A = [[3], [4]];
    applyHouseholderLeft(A, v, beta, 0, 0);
    expect(Math.abs(A[1][0])).toBeLessThan(1e-12);
    // norm preserved: |Hx[0]| == ||x|| = 5
    expect(Math.abs(A[0][0])).toBeCloseTo(5, 10);
  });

  it('applyHouseholderRight applies A*(I - beta*v*v^T) consistently', () => {
    const x = [3, 4];
    const { v, beta } = householder(x);
    // Row vector form: applying from the right to x^T should annihilate tail col.
    const A = [[3, 4]];
    applyHouseholderRight(A, v, beta, 0, 0);
    expect(Math.abs(A[0][1])).toBeLessThan(1e-12);
    expect(Math.abs(A[0][0])).toBeCloseTo(5, 10);
  });
});
