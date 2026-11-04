import { describe, it, expect } from 'vitest';
import { besselJ, besselY } from '../src/typed/special.js';
import { hankelH1, hankelH2, besselJZeros } from '../src/special/spherical-bessel.js';

const close = (a: unknown, b: number, tol = 1e-12): void => {
  expect(Math.abs((a as number) - b)).toBeLessThan(tol);
};

describe('real (non-integer) order Bessel', () => {
  it('besselJ pins half-integer orders', () => {
    close(besselJ(0.5, 1), 0.6713967071418031);
    close(besselJ(1.5, 1), 0.240297839123427);
    close(besselJ(2.5, 1), 0.04949681022847794);
  });
  it('besselY pins Y_1/2', () => {
    close(besselY(0.5, 1), -0.4310988680183761);
  });
  it('matches closed forms in the Hankel regime and negative order', () => {
    const x = 30;
    close(besselJ(0.5, x), Math.sqrt(2 / (Math.PI * x)) * Math.sin(x), 1e-13);
    close(besselY(0.5, x), -Math.sqrt(2 / (Math.PI * x)) * Math.cos(x), 1e-13);
    close(besselJ(-0.5, 3), Math.sqrt(2 / (Math.PI * 3)) * Math.cos(3));
  });
  it('hankelH1/H2 and besselJZeros use the real order', () => {
    const h1 = hankelH1(0.5, 2);
    close(h1.re, 0.5130161365618277);
    close(h1.im, 0.23478571040624863);
    close(hankelH2(0.5, 2).im, -0.23478571040624863);
    const z = besselJZeros(0.5, 2);
    close(z[0], Math.PI, 1e-10);
    close(z[1], 2 * Math.PI, 1e-10);
  });
  it('integer orders are unchanged', () => {
    close(besselJ(1, 1), 0.4400505857449335);
  });
});
