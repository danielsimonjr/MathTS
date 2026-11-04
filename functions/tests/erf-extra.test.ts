import { describe, it, expect } from 'vitest';
import { erfinv, erfcinv, erfcx, dawson } from '../src/special/erf-extra.js';
import { erfcScalar } from '../src/wasm/special/scalars.js';

const relErr = (a: number, b: number): number => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));

describe('erfinv', () => {
  it('matches known values and edges', () => {
    expect(erfinv(0)).toBe(0);
    expect(Math.abs(erfinv(0.5) - 0.4769362762044699)).toBeLessThan(1e-12);
    expect(erfinv(1)).toBe(Infinity);
    expect(erfinv(-1)).toBe(-Infinity);
    expect(Number.isNaN(erfinv(1.5))).toBe(true);
    expect(erfinv(-0.3)).toBeCloseTo(-erfinv(0.3), 14);
  });
  it('inverts erf', () => {
    expect(Math.abs(erfinv(0.9) - 1.1630871536766743)).toBeLessThan(1e-10);
    // round trip in the tail: erfc(erfinv(y)) = 1 − y at y = 0.99999
    const x = erfinv(0.99999);
    expect(relErr(erfcScalar(x), 1e-5)).toBeLessThan(1e-8);
  });
});

describe('erfcinv', () => {
  it('matches edges and the erfinv identity', () => {
    expect(erfcinv(1)).toBe(0);
    expect(erfcinv(0)).toBe(Infinity);
    expect(erfcinv(2)).toBe(-Infinity);
    expect(Math.abs(erfcinv(0.5) - 0.4769362762044699)).toBeLessThan(1e-12);
    expect(Math.abs(erfcinv(1e-10) - 4.5726)).toBeLessThan(1e-3);
    expect(erfcinv(1.5)).toBeCloseTo(-erfcinv(0.5), 14);
  });
});

describe('erfcx', () => {
  it('matches known values', () => {
    expect(erfcx(0)).toBe(1);
    expect(relErr(erfcx(1), 0.42758357615580705)).toBeLessThan(1e-12);
  });
  it('uses the asymptotic expansion for large x', () => {
    const x = 30;
    const u = 1 / (2 * x * x);
    const threeTerm = (1 - u + 3 * u * u) / (x * Math.sqrt(Math.PI));
    expect(relErr(erfcx(30), threeTerm)).toBeLessThan(1e-6);
    expect(erfcx(30)).toBeCloseTo(0.018795888, 8);
  });
  it('overflow guard for very negative x', () => {
    expect(erfcx(-30)).toBe(Infinity);
  });
});

describe('dawson', () => {
  it('matches known values and is odd', () => {
    expect(dawson(0)).toBe(0);
    expect(relErr(dawson(1), 0.5380795069127684)).toBeLessThan(1e-12);
    expect(relErr(dawson(-1), -0.5380795069127684)).toBeLessThan(1e-12);
  });
  it('is continuous across the asymptotic switch', () => {
    const below = dawson(24.999999);
    const above = dawson(25.000001);
    expect(relErr(above, below)).toBeLessThan(1e-5);
  });
});
