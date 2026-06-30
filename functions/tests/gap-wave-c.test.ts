import { describe, it, expect } from 'vitest';
import {
  tril,
  triu,
  vander,
  toeplitz,
  circulant,
  companion,
  logdet,
  haversine,
  eigs,
} from '@danielsimonjr/mathts-functions';

/**
 * Wave C — structured-matrix constructors + logdet (bridges C2/C5) and geodesy
 * (C7). Verified against NumPy/SciPy (numpy.tril/triu/vander/slogdet,
 * scipy.linalg.toeplitz/circulant/companion). logdet reuses the matrix package's
 * LU; companion's eigenvalues are the polynomial roots (cross-checked via eigs).
 */
describe('gap Wave C — structured matrices', () => {
  const A = [
    [4, 2, 1],
    [2, 5, 3],
    [1, 3, 6],
  ];

  it('tril / triu', () => {
    expect(tril(A)).toEqual([
      [4, 0, 0],
      [2, 5, 0],
      [1, 3, 6],
    ]);
    expect(triu(A, 1)).toEqual([
      [0, 2, 1],
      [0, 0, 3],
      [0, 0, 0],
    ]);
  });

  it('vander — decreasing (NumPy default) and increasing', () => {
    expect(vander([1, 2, 3], 4)).toEqual([
      [1, 1, 1, 1],
      [8, 4, 2, 1],
      [27, 9, 3, 1],
    ]);
    expect(vander([1, 2, 3], 3, true)).toEqual([
      [1, 1, 1],
      [1, 2, 4],
      [1, 3, 9],
    ]);
  });

  it('toeplitz / circulant', () => {
    expect(toeplitz([1, 2, 3, 4])).toEqual([
      [1, 2, 3, 4],
      [2, 1, 2, 3],
      [3, 2, 1, 2],
      [4, 3, 2, 1],
    ]);
    expect(circulant([1, 2, 3, 4])).toEqual([
      [1, 4, 3, 2],
      [2, 1, 4, 3],
      [3, 2, 1, 4],
      [4, 3, 2, 1],
    ]);
  });

  it('companion — matches scipy and its eigenvalues are the roots', () => {
    // x³ − 6x² + 11x − 6 = (x−1)(x−2)(x−3)
    expect(companion([1, -6, 11, -6])).toEqual([
      [6, -11, 6],
      [1, 0, 0],
      [0, 1, 0],
    ]);
    const roots = (eigs(companion([1, -6, 11, -6])) as { values: number[] }).values
      .map((v) => Math.round(v))
      .sort((a, b) => a - b);
    expect(roots).toEqual([1, 2, 3]);
  });

  it('logdet — matches numpy.linalg.slogdet (det = 67)', () => {
    const r = logdet(A);
    expect(r.sign).toBe(1);
    expect(r.value).toBeCloseTo(4.204692619390966, 10);
    expect(Math.exp(r.value)).toBeCloseTo(67, 8);
  });
});

describe('gap Wave C — geodesy', () => {
  it('haversine — NYC ↔ London ≈ 5570 km', () => {
    expect(haversine(40.7128, -74.006, 51.5074, -0.1278)).toBeCloseTo(5570.229873656523, 6);
  });
  it('haversine — identical points = 0', () => {
    expect(haversine(10, 20, 10, 20)).toBe(0);
  });
});
