import { describe, it, expect } from 'vitest';
import { expIntegralE1, expn, sinhIntegral, coshIntegral } from '../src/special/exp-integrals.js';

const relErr = (a: number, b: number): number => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));

describe('expIntegralE1', () => {
  it('matches known values', () => {
    expect(relErr(expIntegralE1(1), 0.21938393439552029)).toBeLessThan(1e-12);
    expect(relErr(expIntegralE1(10), 4.156968929685324e-6)).toBeLessThan(1e-10);
  });
  it('handles edges', () => {
    expect(expIntegralE1(0)).toBe(Infinity);
    expect(Number.isNaN(expIntegralE1(-1))).toBe(true);
  });
});

describe('expn', () => {
  it('matches known values', () => {
    expect(relErr(expn(2, 1), 0.14849550677592205)).toBeLessThan(1e-10);
    expect(expn(3, 0)).toBe(0.5);
    expect(expn(0, 0)).toBe(Infinity);
  });
  it('satisfies the recurrence n E_{n+1} = e^{-x} - x E_n on both branches', () => {
    for (const x of [0.5, 3]) {
      for (const n of [1, 2, 4]) {
        const lhs = n * expn(n + 1, x);
        const rhs = Math.exp(-x) - x * expn(n, x);
        expect(Math.abs(lhs - rhs)).toBeLessThan(1e-12);
      }
    }
  });
});

describe('sinhIntegral', () => {
  it('matches known values', () => {
    expect(relErr(sinhIntegral(1), 1.057250875375728)).toBeLessThan(1e-10);
    expect(sinhIntegral(0)).toBe(0);
    expect(sinhIntegral(-1)).toBeCloseTo(-1.057250875375728, 10);
  });
});

describe('coshIntegral', () => {
  it('matches known values', () => {
    expect(relErr(coshIntegral(1), 0.8378669409802082)).toBeLessThan(1e-10);
    expect(coshIntegral(0)).toBe(-Infinity);
    expect(Number.isNaN(coshIntegral(-1))).toBe(true);
  });
});

describe('Shi/Chi at large finite arguments (Copilot review)', () => {
  it('do not overflow before the series terms are divided', () => {
    // Shi(x) ~ Chi(x) ~ e^x / (2x) for large x: e^710/1420 ≈ 1.5755e305.
    expect(sinhIntegral(710)).toBeCloseTo(1.5754578441031017e305, -291);
    expect(coshIntegral(710)).toBeCloseTo(1.5754578441030993e305, -291);
    expect(Number.isFinite(sinhIntegral(710))).toBe(true);
    expect(Number.isFinite(coshIntegral(710))).toBe(true);
  });
});
