import { describe, it, expect } from 'vitest';
import { eig } from '../src/index.js';

/** mpmath @60 digits: 4.999999999999995 among the spectrum of this 1e15 diagonal block. */
describe('eig symmetric Rayleigh refinement (#1561)', () => {
  it('keeps the small eigenvalue at a 1e15 diagonal scale (eigenvectors: false)', () => {
    const A = [
      [1e15, 3, 1],
      [3, 1e15, 2],
      [1, 2, 5],
    ];
    const vals = eig(A, { computeVectors: false })
      .values.map((v) => v.re)
      .sort((a, b) => a - b);
    expect(vals[0]).toBeCloseTo(5, 6);
  });
});
