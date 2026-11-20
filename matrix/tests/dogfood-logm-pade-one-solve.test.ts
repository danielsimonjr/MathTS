/**
 * `matrixLogm` — the Padé quadrature solves all columns in one elimination.
 *
 * `logPade` solved `(I + t·X) y = x` once per column and per node: n eliminations of O(n³) each
 * for each of 16 nodes. A matrix of size 100 took 4.9 s and one of size 200 took 79 s. It now
 * eliminates the augmented matrix `[I + t·X | X]` once per node. The pivots depend on the left
 * block only, so every result is bit-for-bit the one of the column solves (400 random matrices
 * of size 2 to 10 compared). This test pins the result of the rewritten loop: `expm(logm(A))`
 * must give back `A`. It does not time the call, because a wall-clock bound is not stable. The
 * second test counts the eliminations of `logPade`: 16, one per node, each of an n x 2n matrix.
 * The column form makes 16·n eliminations of an n x (n+1) matrix, and fails the count.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, matrixExpm, matrixLogm } from '../src/index.js';
import { logPade } from '../src/operations/logm.js';
import { gaussJordanContinue } from '../src/operations/common.js';

describe('matrixLogm of a matrix of size 40 (complex eigenvalues, one Padé solve per node)', () => {
  it('expm(logm(A)) gives back A', () => {
    let seed = 91;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647 - 0.5;
    };
    const n = 40;
    const A = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => rnd() * 0.5 + (i === j ? 2 : 0))
    );
    const L = matrixLogm(DenseMatrix.fromArray(A));
    const back = matrixExpm(L).toArray() as number[][];
    const err = Math.max(...back.flat().map((v, i) => Math.abs(v - A.flat()[i])));
    expect(err).toBeLessThan(1e-10);
  });
});

describe('logPade solves all columns of a quadrature node in one elimination', () => {
  const n = 6;
  const X = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => 0.03 * Math.sin(1 + 3 * i + 7 * j))
  );

  it('makes 16 eliminations, each of an n x 2n augmented matrix', () => {
    const widths: number[] = [];
    const counted: typeof gaussJordanContinue = (aug, size, pivotTol) => {
      widths.push(aug[0].length);
      gaussJordanContinue(aug, size, pivotTol);
    };
    const got = logPade(X, counted);
    expect(widths).toEqual(new Array<number>(16).fill(2 * n));
    expect(got).toEqual(logPade(X));
  });

  it('gives the series log(I + X) = X - X²/2 + X³/3 - ...', () => {
    const mul = (A: number[][], B: number[][]): number[][] =>
      A.map((row) => B[0].map((_, j) => row.reduce((acc, v, k) => acc + v * B[k][j], 0)));
    const want = X.map((row) => row.map(() => 0));
    let power = X;
    for (let k = 1; k <= 40; k++) {
      const sign = k % 2 === 1 ? 1 : -1;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) want[i][j] += (sign * power[i][j]) / k;
      power = mul(power, X);
    }
    const got = logPade(X);
    let err = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) err = Math.max(err, Math.abs(got[i][j] - want[i][j]));
    expect(err).toBeLessThan(1e-15);
  });
});
