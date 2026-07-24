import { describe, it, expect } from 'vitest';
import { eigsh } from '../src/index.js';

const T = [
  [2, 1, 0],
  [1, 2, 1],
  [0, 1, 2],
];

describe('eigsh (Lanczos, k eigenpairs)', () => {
  it('largest eigenvalue = 2+sqrt(2)', () => {
    expect(eigsh(T, 1, { which: 'LM' }).eigenvalues[0]).toBeCloseTo(2 + Math.SQRT2, 6);
  });
  it('smallest eigenvalue = 2-sqrt(2)', () => {
    expect(eigsh(T, 1, { which: 'SM' }).eigenvalues[0]).toBeCloseTo(2 - Math.SQRT2, 6);
  });
  it('k=2 largest returns [2+sqrt2, 2]', () => {
    const r = eigsh(T, 2, { which: 'LM' });
    expect(r.eigenvalues[0]).toBeCloseTo(2 + Math.SQRT2, 6);
    expect(r.eigenvalues[1]).toBeCloseTo(2, 6);
  });
  it('eigenpair satisfies A v = lambda v (column convention)', () => {
    const r = eigsh(T, 1, { which: 'LM' });
    const v = r.eigenvectors.map((row) => row[0]); // column 0
    const Av = T.map((rw) => rw.reduce((s, a, j) => s + a * v[j], 0));
    Av.forEach((val, i) => expect(Math.abs(val)).toBeCloseTo(Math.abs(r.eigenvalues[0] * v[i]), 5));
  });
  it('accepts a matvec with explicit n', () => {
    const mv = (x: number[]) => [2 * x[0] + x[1], x[0] + 2 * x[1] + x[2], x[1] + 2 * x[2]];
    expect(eigsh(mv, 1, { which: 'LM', n: 3 }).eigenvalues[0]).toBeCloseTo(2 + Math.SQRT2, 5);
  });
});
