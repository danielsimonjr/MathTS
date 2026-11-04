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

describe('real-order Bessel: Temme/Steed regime coverage (Copilot review)', () => {
  const sq = (x: number) => Math.sqrt(2 / (Math.PI * x));
  it('no cancellation for large x below ν² (J_{10.5}(80))', () => {
    expect(besselJ(10.5, 80) as number).toBeCloseTo(0.0750484455895156, 13);
  });
  it('small x at large order matches the ascending series (J_{20.3}(5))', () => {
    // Independent reference: Σ (−1)^k (x/2)^{2k+ν} / (k! Γ(k+ν+1)) in double precision.
    expect(besselJ(20.3, 5) as number).toBeCloseTo(1.4766695817810275e-11, 24);
  });
  it('stable near integer orders (Y_ν → Y_n as ν → n, with the ∂Y/∂ν correction)', () => {
    // Y_0(1) = 0.08825696421567696 and ∂Y_ν/∂ν|_{ν=0} = (π/2) J_0(x) ≈ 1.2019,
    // so Y_{1e-12}(1) − Y_0(1) ≈ 1.2e-12: the value must sit within 2e-12 of Y_0(1).
    expect(Math.abs((besselY(1e-12, 1) as number) - 0.08825696421567696)).toBeLessThan(2e-12);
    expect(Math.abs((besselJ(1 + 1e-12, 1) as number) - 0.4400505857449335)).toBeLessThan(2e-12);
    expect(Math.abs((besselY(2 - 1e-11, 3) as number) - -0.16040039348492374)).toBeLessThan(2e-11);
  });
  it('half-integer closed forms across x (series, CF2 and Hankel regimes)', () => {
    expect(besselJ(0.5, 0.01) as number).toBeCloseTo(sq(0.01) * Math.sin(0.01), 15);
    expect(besselY(0.5, 0.5) as number).toBeCloseTo(-sq(0.5) * Math.cos(0.5), 15);
    expect(besselJ(1.5, 50) as number).toBeCloseTo(sq(50) * (Math.sin(50) / 50 - Math.cos(50)), 14);
    expect(besselJ(-0.5, 1) as number).toBeCloseTo(sq(1) * Math.cos(1), 15);
    expect(besselY(-0.5, 2) as number).toBeCloseTo(sq(2) * Math.sin(2), 15);
    expect(besselJ(0.5, 2e5) as number).toBeCloseTo(sq(2e5) * Math.sin(2e5), 12);
  });
});
