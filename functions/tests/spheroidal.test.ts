import { describe, it, expect } from 'vitest';
import {
  ferrersP,
  spheroidalLambda,
  spheroidalCharacteristic,
  spheroidalAngular,
  spheroidalRadial,
} from '../src/special/spheroidal.js';

describe('ferrersP (associated Legendre)', () => {
  it('P_0^0 = 1', () => {
    expect(ferrersP(0, 0, 0.3)).toBeCloseTo(1, 12);
  });
  it('P_1^0(x) = x', () => {
    expect(ferrersP(1, 0, 0.4)).toBeCloseTo(0.4, 12);
  });
  it('P_2^0(x) = (3x^2-1)/2', () => {
    const x = 0.5;
    expect(ferrersP(2, 0, x)).toBeCloseTo((3 * x * x - 1) / 2, 12);
  });
  it('P_1^1(x) = -sqrt(1-x^2)', () => {
    const x = 0.3;
    expect(ferrersP(1, 1, x)).toBeCloseTo(-Math.sqrt(1 - x * x), 12);
  });
  it('P_3^1 and P_2^2 recurrences stay finite', () => {
    expect(Number.isFinite(ferrersP(3, 1, 0.4))).toBe(true);
    expect(Number.isFinite(ferrersP(2, 2, 0.2))).toBe(true);
  });
  it('returns 0 for n < m or negative m', () => {
    expect(ferrersP(1, 2, 0.3)).toBe(0);
    expect(ferrersP(1, -1, 0.3)).toBe(0);
  });
});

describe('spheroidalLambda', () => {
  it('λ_mn(0) = n(n+1)', () => {
    expect(spheroidalLambda(0, 0, 0)).toBe(0);
    expect(spheroidalLambda(0, 1, 0)).toBe(2);
    expect(spheroidalLambda(0, 2, 0)).toBe(6);
    expect(spheroidalLambda(1, 1, 0)).toBe(2);
    expect(spheroidalLambda(1, 2, 0)).toBe(6);
  });
  it('λ_00(c) is a smooth perturbation of 0', () => {
    const l = spheroidalLambda(0, 0, 0.5);
    expect(l).toBeGreaterThan(-0.5);
    expect(l).toBeLessThan(1);
  });
  it('rejects n < m', () => {
    expect(() => spheroidalLambda(2, 1, 0)).toThrow(/n must/);
  });
  it('rejects a non-integer / negative m', () => {
    expect(() => spheroidalLambda(-1, 1, 0)).toThrow(/m must/);
    expect(() => spheroidalLambda(0.5, 1, 0)).toThrow(/m must/);
  });
  it('spheroidalCharacteristic is an alias of spheroidalLambda', () => {
    expect(spheroidalCharacteristic).toBe(spheroidalLambda);
    expect(spheroidalCharacteristic(0, 2, 0.4)).toBe(spheroidalLambda(0, 2, 0.4));
  });
  it('λ_11(c) and λ_21(c) are defined and finite', () => {
    expect(Number.isFinite(spheroidalLambda(1, 1, 0.8))).toBe(true);
    expect(Number.isFinite(spheroidalLambda(1, 2, 0.8))).toBe(true);
  });
});

describe('spheroidalAngular', () => {
  it('S_mn(0, η) = P_n^m(η)', () => {
    for (const eta of [-0.7, 0, 0.4, 0.9]) {
      expect(spheroidalAngular(0, 2, 0, eta)).toBeCloseTo(ferrersP(2, 0, eta), 12);
      expect(spheroidalAngular(1, 1, 0, eta)).toBeCloseTo(ferrersP(1, 1, eta), 12);
    }
  });
  it('S_00(c, η) stays close to 1 for small c', () => {
    expect(spheroidalAngular(0, 0, 0.2, 0.3)).toBeCloseTo(1, 2);
  });
  it('rejects eta outside [-1, 1]', () => {
    expect(() => spheroidalAngular(0, 0, 0, 1.2)).toThrow(/eta/);
  });
  it('S_11(c, η) and S_20(c, η) are finite on the cut', () => {
    expect(Number.isFinite(spheroidalAngular(1, 1, 0.5, 0.3))).toBe(true);
    expect(Number.isFinite(spheroidalAngular(0, 2, 0.6, -0.4))).toBe(true);
    expect(Number.isFinite(spheroidalAngular(1, 1, 0.4, 0))).toBe(true);
  });
});

describe('spheroidalRadial', () => {
  it('is defined for ξ ≥ 1', () => {
    const r = spheroidalRadial(0, 0, 0.3, 1.5);
    expect(Number.isFinite(r)).toBe(true);
  });
  it('rejects ξ < 1', () => {
    expect(() => spheroidalRadial(0, 0, 0, 0.5)).toThrow(/xi/);
  });
  it('c = 0 continuation of Ferrers at ξ > 1 is finite', () => {
    expect(Number.isFinite(spheroidalRadial(0, 2, 0, 1.3))).toBe(true);
    expect(Number.isFinite(spheroidalRadial(1, 1, 0, 1.4))).toBe(true);
    expect(Number.isFinite(spheroidalRadial(1, 2, 0, 1.2))).toBe(true);
  });
  it('c ≠ 0 radial series is finite', () => {
    expect(Number.isFinite(spheroidalRadial(0, 1, 0.4, 1.5))).toBe(true);
    expect(Number.isFinite(spheroidalRadial(1, 1, 0.3, 1.2))).toBe(true);
  });
});
