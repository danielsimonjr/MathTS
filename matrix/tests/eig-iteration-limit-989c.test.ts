import { describe, it, expect } from 'vitest';
import { eig, eigvals } from '../src/index.js';

// eig scales a matrix with extreme entries before the QR iteration, so the
// squares in hqr2 stay in range; it throws on a non-finite eigenvalue and on
// non-convergence (#989).
const big = (m: number): number[][] => [
  [1, m, 0],
  [m, 4, m],
  [0, m, 9],
];
const sortedRe = (vs: Array<{ re: number; im: number }>): number[] =>
  vs.map((v) => v.re).sort((a, b) => a - b);

describe('eig with extreme entries (#989)', () => {
  it('returns the eigenvalues of the 1e154 matrix', () => {
    // Outer roots are +-sqrt(2)*m + 4.5; the middle root is 5 - 8/m^2 + O(m^-4).
    const got = sortedRe(eigvals(big(1e154)));
    expect(Math.abs(got[0] / (-Math.SQRT2 * 1e154) - 1)).toBeLessThan(1e-14);
    expect(Math.abs(got[2] / (Math.SQRT2 * 1e154) - 1)).toBeLessThan(1e-14);
    expect(Math.abs(got[1] - 5)).toBeLessThan(8 * Number.EPSILON * 1e150);
  });
  it('eig returns the same values', () => {
    const got = sortedRe(eig(big(1e154)).values);
    expect(Math.abs(got[2] / (Math.SQRT2 * 1e154) - 1)).toBeLessThan(1e-14);
  });
  it('keeps the middle root of the 1e3 matrix', () => {
    // numpy.linalg.eigvalsh gives 4.999992000064326.
    expect(sortedRe(eigvals(big(1e3)))[1]).toBeCloseTo(4.999992000064326, 9);
  });
  it('returns a finite real pair for the nonsymmetric 1e154 matrix', () => {
    const got = sortedRe(
      eigvals([
        [1, 1e154, 0],
        [2e154, 4, 1e154],
        [0, 1e154, 9],
      ])
    );
    expect(Math.abs(got[0] / (-Math.sqrt(3) * 1e154) - 1)).toBeLessThan(1e-14);
    expect(Math.abs(got[2] / (Math.sqrt(3) * 1e154) - 1)).toBeLessThan(1e-14);
    expect(got[1]).toBeCloseTo(19 / 3, 12);
  });
  it('returns +-1e-200 i for a tiny rotation', () => {
    const got = eigvals([
      [0, -1e-200],
      [1e-200, 0],
    ]);
    const ims = got.map((v) => v.im).sort((a, b) => a - b);
    expect(ims).toEqual([-1e-200, 1e-200]);
    expect(got.map((v) => v.re)).toEqual([0, 0]);
  });
  it('returns sqrt(2)e-160 for a tiny tridiagonal matrix', () => {
    const got = sortedRe(
      eigvals([
        [0, 1e-160, 0],
        [1e-160, 0, 1e-160],
        [0, 1e-160, 0],
      ])
    );
    expect(Math.abs(got[2] / (Math.SQRT2 * 1e-160) - 1)).toBeLessThan(1e-14);
  });
  it('throws RangeError when an eigenvalue is not finite', () => {
    expect(() => eigvals(big(1.7e308))).toThrow('eig: an eigenvalue is not finite');
  });
});

describe('eig maxIterations (#989)', () => {
  const t = [
    [2, -1, 0],
    [-1, 2, -1],
    [0, -1, 2],
  ];
  it('throws when the limit is too small', () => {
    expect(() => eig(t, { maxIterations: 5 })).toThrow('eig: QR iteration did not converge');
    expect(() => eigvals(t, { maxIterations: 1 })).toThrow(RangeError);
  });
  it('converges with the default limit', () => {
    const got = sortedRe(eig(t).values);
    expect(got[0]).toBeCloseTo(2 - Math.SQRT2, 12);
    expect(got[1]).toBeCloseTo(2, 12);
    expect(got[2]).toBeCloseTo(2 + Math.SQRT2, 12);
  });
  it('converges with a limit of 30', () => {
    expect(sortedRe(eig(t, { maxIterations: 30 }).values)[1]).toBeCloseTo(2, 12);
  });
});
