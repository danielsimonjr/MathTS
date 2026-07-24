/**
 * Tests for matrix luSolve — solving A·x = b from a precomputed LU factorisation.
 *
 * Oracle: numpy.linalg.solve on the same systems (values pinned inline).
 *
 * Coverage:
 *  1.  2×2 system against numpy.
 *  2.  3×3 system (with pivoting) against numpy.
 *  3.  5×5 system against numpy.
 *  4.  Factor once, solve many RHS (the stiff-ODE reuse pattern) — identity RHS
 *      recovers the inverse; A·inv ≈ I.
 *  5.  1×1 trivial system.
 *  6.  Right-hand side length mismatch throws.
 *  7.  Accepts a Float64Array RHS as well as number[].
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { lu } from '../../src/operations/lu.js';
import { luSolve } from '../../src/operations/lu.js';

function fromNested(rows: number[][]): DenseMatrix {
  return DenseMatrix.fromArray(rows);
}

describe('luSolve (matrix primitive)', () => {
  it('2×2 system matches numpy', () => {
    const A = fromNested([
      [2, 1],
      [4, 3],
    ]);
    const x = luSolve(lu(A), [5, 6]);
    expect(x[0]).toBeCloseTo(4.5, 12);
    expect(x[1]).toBeCloseTo(-4.0, 12);
  });

  it('3×3 system (with pivoting) matches numpy', () => {
    const A = fromNested([
      [2, -1, 3],
      [4, 5, -2],
      [-1, 2, 7],
    ]);
    const x = luSolve(lu(A), [1, 2, 3]);
    expect(x[0]).toBeCloseTo(0.18181818181818182, 12);
    expect(x[1]).toBeCloseTo(0.3916083916083916, 12);
    expect(x[2]).toBeCloseTo(0.34265734265734266, 12);
  });

  it('5×5 system matches numpy', () => {
    const A = fromNested([
      [4, 3, 2, 1, 5],
      [2, 6, 3, 7, 1],
      [1, 2, 9, 3, 4],
      [5, 1, 4, 8, 2],
      [3, 7, 1, 2, 6],
    ]);
    const x = luSolve(lu(A), [1, 2, 3, 4, 5]);
    const expected = [
      -2.4846552411319234, -1.1271422877640487, -1.1028298126743716, 2.019928258270226,
      2.9011558389796717,
    ];
    for (let i = 0; i < 5; i++) expect(x[i]).toBeCloseTo(expected[i], 10);
  });

  it('factor once, solve many RHS → recovers the inverse (A·inv ≈ I)', () => {
    const Araw = [
      [2, -1, 3],
      [4, 5, -2],
      [-1, 2, 7],
    ];
    const A = fromNested(Araw);
    const fac = lu(A);
    const n = 3;
    // Solve A·xⱼ = eⱼ for each column → inverse.
    const inv: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let j = 0; j < n; j++) {
      const e = new Array<number>(n).fill(0);
      e[j] = 1;
      const x = luSolve(fac, e);
      for (let i = 0; i < n; i++) inv[i][j] = x[i];
    }
    // Verify A·inv ≈ I.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += Araw[i][k] * inv[k][j];
        expect(s).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
  });

  it('1×1 trivial system', () => {
    const A = new DenseMatrix(1, 1, [4]);
    const x = luSolve(lu(A), [8]);
    expect(x[0]).toBeCloseTo(2, 12);
  });

  it('throws on right-hand side length mismatch', () => {
    const A = fromNested([
      [1, 2],
      [3, 4],
    ]);
    expect(() => luSolve(lu(A), [1, 2, 3])).toThrow(/length|dimension/i);
  });

  it('accepts a Float64Array right-hand side', () => {
    const A = fromNested([
      [2, 1],
      [4, 3],
    ]);
    const x = luSolve(lu(A), new Float64Array([5, 6]));
    expect(x[0]).toBeCloseTo(4.5, 12);
    expect(x[1]).toBeCloseTo(-4.0, 12);
  });
});
