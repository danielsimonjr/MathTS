import { describe, it, expect } from 'vitest';
import { eig, eigvals } from '../src/index.js';

// eig throws when the QR iteration does not converge, where it looped for ever (#989).
const big = (m: number): number[][] => [
  [1, m, 0],
  [m, 4, m],
  [0, m, 9],
];

describe('eig iteration limit (#989)', () => {
  it('throws RangeError for the 1e154 matrix', () => {
    expect(() => eig(big(1e154))).toThrow(RangeError);
    expect(() => eig(big(1e154))).toThrow('eig: QR iteration did not converge');
  });
  it('eigvals throws the same error', () => {
    expect(() => eigvals(big(1e154))).toThrow('eig: QR iteration did not converge');
  });
  it('keeps the three eigenvalues of the 1e150 matrix', () => {
    // The roots are +-sqrt(2) * 1e150 and a value that is small against them.
    // numpy.linalg.eigvals agrees with this at 1e100 and loses scale above 1e138.
    const want = [-Math.SQRT2 * 1e150, 0, Math.SQRT2 * 1e150];
    const got = eigvals(big(1e150))
      .map((v) => v.re)
      .sort((a, b) => a - b);
    expect(got.length).toBe(3);
    expect(Math.abs(got[0] / want[0] - 1)).toBeLessThan(1e-10);
    expect(Math.abs(got[2] / want[2] - 1)).toBeLessThan(1e-10);
    expect(Math.abs(got[1])).toBeLessThan(1e-10 * 1e150);
  });
  it('still solves a convergent matrix', () => {
    const got = eigvals([
      [2, 1],
      [1, 2],
    ])
      .map((v) => v.re)
      .sort((a, b) => a - b);
    expect(got[0]).toBeCloseTo(1, 12);
    expect(got[1]).toBeCloseTo(3, 12);
  });
});
