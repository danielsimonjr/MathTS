/**
 * Dogfood #1191: `eig(A).isSymmetric` is relative and exact up to the rounding of the input.
 */

import { describe, it, expect } from 'vitest';
import { eig } from '../src/index.js';

const scale = (A: number[][], f: number): number[][] => A.map((r) => r.map((x) => x * f));

describe('#1191 eig isSymmetric', () => {
  it.each([
    [
      '[[1,1e-12],[0,1]]',
      [
        [1, 1e-12],
        [0, 1],
      ],
    ],
    [
      '[[1e-150,1e-150],[0,2e-150]]',
      [
        [1e-150, 1e-150],
        [0, 2e-150],
      ],
    ],
    [
      '[[1e-9,0],[1e-11,2e-9]]',
      [
        [1e-9, 0],
        [1e-11, 2e-9],
      ],
    ],
    [
      '[[1,1e-9],[0,1]]',
      [
        [1, 1e-9],
        [0, 1],
      ],
    ],
    [
      '[[1,1e-14],[0,1]]',
      [
        [1, 1e-14],
        [0, 1],
      ],
    ],
    [
      '[[1e150,1e140],[0,2e150]]',
      [
        [1e150, 1e140],
        [0, 2e150],
      ],
    ],
  ])('reports %s as non-symmetric', (_name, A) => {
    expect(eig(A).isSymmetric).toBe(false);
  });

  it('reports symmetric matrices as symmetric at every scale', () => {
    const S = [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2],
    ];
    for (const f of [1, 1e-150, 1e150, 1e-300, 1e300]) {
      expect(eig(scale(S, f)).isSymmetric).toBe(true);
    }
    expect(
      eig([
        [0, 0],
        [0, 0],
      ]).isSymmetric
    ).toBe(true);
    expect(eig([[5]]).isSymmetric).toBe(true);
  });

  it('treats an asymmetry of input rounding as symmetric', () => {
    const a = 0.1 + 0.2; // 0.30000000000000004
    expect(
      eig([
        [1, a],
        [0.3, 1],
      ]).isSymmetric
    ).toBe(true);
  });

  it('keeps the flag consistent across a power-of-2 scaling', () => {
    const A = [
      [1, 1e-12],
      [0, 1],
    ];
    expect(eig(scale(A, 2 ** -400)).isSymmetric).toBe(eig(A).isSymmetric);
  });
});
