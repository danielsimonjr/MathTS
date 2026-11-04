import { describe, it, expect } from 'vitest';
import {
  sphericalBesselJ,
  sphericalBesselY,
  sphericalBesselI,
  sphericalBesselK,
  hankelH1,
  hankelH2,
  besselJZeros,
} from '../src/special/spherical-bessel.js';

const relErr = (a: number, b: number): number => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));

describe('sphericalBesselJ / Y', () => {
  it('matches closed forms at low order', () => {
    expect(relErr(sphericalBesselJ(0, 1), 0.8414709848078965)).toBeLessThan(1e-12);
    expect(relErr(sphericalBesselJ(1, 1), 0.30116867893975674)).toBeLessThan(1e-12);
    expect(relErr(sphericalBesselY(0, 1), -0.5403023058681398)).toBeLessThan(1e-12);
    expect(relErr(sphericalBesselY(1, 1), -1.3817732906760363)).toBeLessThan(1e-12);
    expect(sphericalBesselJ(0, 0)).toBe(1);
    expect(sphericalBesselJ(3, 0)).toBe(0);
    expect(sphericalBesselY(2, 0)).toBe(-Infinity);
  });
  it('Miller branch (x < n) satisfies the recurrence and the Wronskian', () => {
    const x = 2;
    const n = 6;
    // j_{k+1} = (2k+1)/x · j_k − j_{k−1} at k = 5, with every value from the Miller branch
    const lhs = sphericalBesselJ(n, x);
    const rhs = ((2 * 5 + 1) / x) * sphericalBesselJ(5, x) - sphericalBesselJ(4, x);
    expect(relErr(lhs, rhs)).toBeLessThan(1e-9);
    // j_n y_{n-1} − j_{n-1} y_n = 1/x²
    const w =
      sphericalBesselJ(n, x) * sphericalBesselY(n - 1, x) -
      sphericalBesselJ(n - 1, x) * sphericalBesselY(n, x);
    expect(relErr(w, 1 / (x * x))).toBeLessThan(1e-9);
  });
  it('rejects negative or non-integer order', () => {
    expect(() => sphericalBesselJ(-1, 1)).toThrow(RangeError);
    expect(() => sphericalBesselY(1.5, 1)).toThrow(RangeError);
  });
});

describe('sphericalBesselI / K', () => {
  it('matches closed forms at order 0 and 1', () => {
    expect(relErr(sphericalBesselI(0, 1), Math.sinh(1))).toBeLessThan(1e-12);
    expect(relErr(sphericalBesselK(0, 1), (Math.PI / 2) * Math.exp(-1))).toBeLessThan(1e-12);
    const i1 = Math.cosh(1) - Math.sinh(1);
    expect(relErr(sphericalBesselI(1, 1), i1)).toBeLessThan(1e-12);
    const k1 = (Math.PI / 2) * Math.exp(-1) * (1 + 1);
    expect(relErr(sphericalBesselK(1, 1), k1)).toBeLessThan(1e-12);
  });
});

describe('hankelH1 / hankelH2', () => {
  it('equals J ± iY at order 0', () => {
    const h1 = hankelH1(0, 1);
    expect(relErr(h1.re, 0.7651976865579666)).toBeLessThan(1e-10);
    expect(relErr(h1.im, 0.08825696421567696)).toBeLessThan(1e-10);
    const h2 = hankelH2(0, 1);
    expect(relErr(h2.re, 0.7651976865579666)).toBeLessThan(1e-10);
    expect(relErr(h2.im, -0.08825696421567696)).toBeLessThan(1e-10);
  });
});

describe('besselJZeros', () => {
  it('matches the first zeros of J0 and J1', () => {
    const z = besselJZeros(0, 2);
    expect(relErr(z[0], 2.404825557695773)).toBeLessThan(1e-10);
    expect(relErr(z[1], 5.520078110286311)).toBeLessThan(1e-10);
    expect(relErr(besselJZeros(1, 1)[0], 3.8317059702075125)).toBeLessThan(1e-10);
  });
  it('rejects k < 1', () => {
    expect(() => besselJZeros(0, 0)).toThrow(RangeError);
  });
});
