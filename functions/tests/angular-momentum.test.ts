import { describe, it, expect } from 'vitest';
import {
  wigner3j,
  clebschGordan,
  wigner6j,
  sphericalHarmonic,
} from '../src/special/angular-momentum.js';

const relErr = (a: number, b: number): number => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));

describe('clebschGordan', () => {
  it('matches known coefficients', () => {
    expect(relErr(clebschGordan(0.5, 0.5, 0.5, -0.5, 0, 0), 0.7071067811865476)).toBeLessThan(
      1e-12
    );
    expect(relErr(clebschGordan(1, 0, 1, 0, 2, 0), 0.816496580927726)).toBeLessThan(1e-12);
  });
});

describe('wigner3j', () => {
  it('matches known symbols and selection rules', () => {
    expect(relErr(wigner3j(1, 1, 0, 0, 0, 0), -0.5773502691896258)).toBeLessThan(1e-12);
    expect(relErr(wigner3j(1, 1, 2, 0, 0, 0), 0.3651483716701107)).toBeLessThan(1e-12);
    expect(wigner3j(1, 1, 1, 0, 0, 0)).toBe(0);
    expect(wigner3j(1, 1, 3, 0, 0, 0)).toBe(0);
    expect(wigner3j(1, 1, 0, 1, 0, 0)).toBe(0);
  });
  it('rejects non-half-integer input', () => {
    expect(() => wigner3j(0.3, 1, 1, 0, 0, 0)).toThrow(RangeError);
  });
});

describe('wigner6j', () => {
  it('matches known symbols', () => {
    expect(relErr(wigner6j(1, 1, 1, 1, 1, 1), 1 / 6)).toBeLessThan(1e-12);
    // {a b c; 0 c b} = (−1)^{a+b+c} / √((2b+1)(2c+1))
    expect(relErr(wigner6j(1, 1, 1, 0, 1, 1), -1 / 3)).toBeLessThan(1e-12);
    expect(relErr(wigner6j(2, 1, 1, 0, 1, 1), 1 / 3)).toBeLessThan(1e-12);
  });
});

describe('sphericalHarmonic', () => {
  it('matches known values', () => {
    const y00 = sphericalHarmonic(0, 0, 0.3, 1.2);
    expect(relErr(y00.re, 0.28209479177387814)).toBeLessThan(1e-12);
    expect(y00.im).toBe(0);
    expect(relErr(sphericalHarmonic(1, 0, 0, 0).re, 0.4886025119029199)).toBeLessThan(1e-12);
    const y11 = sphericalHarmonic(1, 1, Math.PI / 2, 0);
    expect(Math.abs(y11.re - -0.3454941494713355)).toBeLessThan(1e-12);
    expect(Math.abs(y11.im)).toBeLessThan(1e-15);
  });
  it('satisfies Y_l^{-m} = (−1)^m conj(Y_l^m) and zero for |m| > l', () => {
    const a = sphericalHarmonic(2, 1, 0.7, 0.4);
    const b = sphericalHarmonic(2, -1, 0.7, 0.4);
    expect(Math.abs(b.re + a.re)).toBeLessThan(1e-14);
    expect(Math.abs(b.im - a.im)).toBeLessThan(1e-14);
    expect(sphericalHarmonic(1, 2, 0.5, 0.5).re).toBe(0);
  });
});
