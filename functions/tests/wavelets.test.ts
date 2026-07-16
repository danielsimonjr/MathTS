import { describe, it, expect } from 'vitest';
import { dwt, idwt, wavedec, waverec, cwt } from '../src/index.js';

describe('wavelets', () => {
  it('idwt inverts dwt (haar)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const { approx, detail } = dwt(x, 'haar');
    const back = idwt(approx, detail, 'haar');
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });

  it('waverec perfectly reconstructs wavedec (haar, 2 levels)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const coeffs = wavedec(x, 'haar', 2);
    const back = waverec(coeffs, 'haar');
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });

  it('wavedec returns level+1 coefficient arrays', () => {
    expect(wavedec([1, 2, 3, 4, 5, 6, 7, 8], 'haar', 2)).toHaveLength(3);
  });

  it('cwt returns a scales x n matrix of finite values', () => {
    const out = cwt([0, 1, 0, -1, 0, 1, 0, -1], [1, 2, 3], 'ricker');
    expect(out).toHaveLength(3);
    expect(out[0]).toHaveLength(8);
    expect(out.flat().every(Number.isFinite)).toBe(true);
  });

  it('idwt rejects unsupported wavelet', () => {
    expect(() => idwt([1, 2], [0, 0], 'db2')).toThrow();
  });

  it('cwt supports morlet wavelet', () => {
    const out = cwt([0, 1, 0, -1, 0, 1, 0, -1], [1, 2], 'morlet');
    expect(out).toHaveLength(2);
    expect(out.flat().every(Number.isFinite)).toBe(true);
  });
});
