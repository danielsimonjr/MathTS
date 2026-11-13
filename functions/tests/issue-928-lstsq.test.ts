import { describe, it, expect } from 'vitest';
// Issue #928: lstsq (QR least squares) must be exported, and the rectangular
// lsolve error must name it. Imported by package name (built dist).
import { lsolve, pinv, lstsq } from '@danielsimonjr/mathts-functions';

function applyRows(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0));
}

function maxAbsDiff(a: number[], b: number[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

describe('issue #928: lstsq is exported and lsolve names it for rectangular systems', () => {
  it('exports lstsq as a function', () => {
    expect(typeof lstsq).toBe('function');
  });

  it('solves the issue system to the pinv(A)*b result', () => {
    const A = [
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    const b = [1, 2, 2];
    const viaPinv = (pinv(A) as number[][]).map((row) => row.reduce((s, a, j) => s + a * b[j], 0));
    const x = lstsq(A, b) as number[];
    expect(maxAbsDiff(x, viaPinv)).toBeLessThan(1e-10);
    expect(maxAbsDiff(x, [2 / 3, 0.5])).toBeLessThan(1e-12);
  });

  it('matches pinv(A)*b on a Vandermonde system (m=20, n=5) within 1e-10', () => {
    const m = 20;
    const n = 5;
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < m; i++) {
      const t = i / (m - 1);
      const row: number[] = [];
      for (let j = 0; j < n; j++) row.push(Math.pow(t, j));
      A.push(row);
      b.push(Math.sin(3 * t) + 0.5 * t * t);
    }
    const viaPinv = (pinv(A) as number[][]).map((row) => row.reduce((s, a, j) => s + a * b[j], 0));
    const x = lstsq(A, b) as number[];
    expect(x).toHaveLength(n);
    expect(maxAbsDiff(x, viaPinv)).toBeLessThan(1e-10);
    // The residual of a least-squares solution is orthogonal to the columns of A.
    const r = applyRows(A, x).map((v, i) => b[i] - v);
    for (let j = 0; j < n; j++) {
      const dot = r.reduce((s, ri, i) => s + ri * A[i][j], 0);
      expect(Math.abs(dot)).toBeLessThan(1e-10);
    }
  });

  it('rectangular lsolve error names lstsq and keeps the square message', () => {
    const A = [
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    expect(() => lsolve(A, [1, 2, 2])).toThrow(/Matrix must be square/);
    expect(() => lsolve(A, [1, 2, 2])).toThrow(/lstsq/);
  });
});
