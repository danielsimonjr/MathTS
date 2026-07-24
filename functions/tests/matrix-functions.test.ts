import { describe, it, expect } from 'vitest';
import { funm, cosm, sinm } from '../src/index.js';

const csqrt = (z: { re: number; im: number }) => {
  const r = Math.hypot(z.re, z.im),
    a = Math.atan2(z.im, z.re) / 2,
    m = Math.sqrt(r);
  return { re: m * Math.cos(a), im: m * Math.sin(a) };
};

describe('complex matrix functions', () => {
  it('cosm([[0,1],[-1,0]]) = diag(cosh 1)', () => {
    const C = cosm([
      [0, 1],
      [-1, 0],
    ]);
    expect(C.re[0][0]).toBeCloseTo(1.5430806348, 6);
    expect(C.re[1][1]).toBeCloseTo(1.5430806348, 6);
    expect(C.re[0][1]).toBeCloseTo(0, 6);
    expect(Math.abs(C.im[0][0])).toBeLessThan(1e-6);
  });

  it('funm(diag(-4,-9), sqrt) = diag(2i, 3i)', () => {
    const S = funm(
      [
        [-4, 0],
        [0, -9],
      ],
      csqrt
    );
    expect(S.im[0][0]).toBeCloseTo(2, 6);
    expect(S.im[1][1]).toBeCloseTo(3, 6);
    expect(Math.abs(S.re[0][0])).toBeLessThan(1e-6);
  });

  it('cosm of a diagonal real matrix = diag(cos)', () => {
    const C = cosm([
      [1, 0],
      [0, 2],
    ]);
    expect(C.re[0][0]).toBeCloseTo(Math.cos(1), 8);
    expect(C.re[1][1]).toBeCloseTo(Math.cos(2), 8);
  });

  it('sinm(zero) = zero', () => {
    const S = sinm([
      [0, 0],
      [0, 0],
    ]);
    expect(Math.abs(S.re[0][0])).toBeLessThan(1e-8);
  });
});
