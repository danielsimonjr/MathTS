import { describe, it, expect } from 'vitest';
import { inv, multiply } from '@danielsimonjr/mathts-functions';

/**
 * Matrix-factory acceleration — `inv` routes large numeric square matrices
 * through native Float64Array LU-solve (forward/back substitution per column),
 * falling back to the factory for small / non-numeric / singular inputs. The
 * defining property A·inv(A) = I is verified independently of the factory.
 */
const eye = (n: number) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

function maxAbsDiff(A: number[][], B: number[][]): number {
  let m = 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < A[i].length; j++) m = Math.max(m, Math.abs(A[i][j] - B[i][j]));
  return m;
}

describe('inv: native-accelerated path', () => {
  it('small matrix keeps the exact factory inverse (below threshold)', () => {
    expect(inv([[1, 2], [3, 4]])).toEqual([[-2, 1], [1.5, -0.5]]);
  });

  it('A·inv(A) = I for a large well-conditioned matrix (native path)', () => {
    const n = 12;
    const A = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => Math.sin(i * 5 + j * 2) + (i === j ? 2 * n : 0))
    );
    const Ainv = inv(A) as number[][];
    const prod = multiply(A, Ainv) as number[][];
    expect(maxAbsDiff(prod, eye(n))).toBeLessThan(1e-9);
  });

  it('inverse of a tridiagonal SPD matrix reconstructs to I', () => {
    const n = 16;
    const A = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0))
    );
    const prod = multiply(A, inv(A) as number[][]) as number[][];
    expect(maxAbsDiff(prod, eye(n))).toBeLessThan(1e-9);
  });

  it('singular large matrix delegates to the factory (throws)', () => {
    const n = 10;
    const A = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i * 3 + j * 7 + (i === j ? n : 0))
    );
    A[n - 1] = A[0].slice(); // duplicate row → singular
    expect(() => inv(A)).toThrow();
  });
});
