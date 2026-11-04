import { describe, it, expect } from 'vitest';
import {
  hurwitzZeta,
  dirichletEta,
  bernoulliPolynomial,
  eulerPolynomial,
} from '../src/special/zeta-extra.js';

const relErr = (a: number, b: number): number => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));

describe('hurwitzZeta', () => {
  it('matches known values', () => {
    expect(relErr(hurwitzZeta(2, 1), 1.6449340668482264)).toBeLessThan(1e-12);
    expect(relErr(hurwitzZeta(2, 0.5), 4.934802200544679)).toBeLessThan(1e-10);
  });
  it('reduces to shift identity ζ(s,a) = a^{-s} + ζ(s,a+1)', () => {
    const lhs = hurwitzZeta(3, 0.7);
    const rhs = Math.pow(0.7, -3) + hurwitzZeta(3, 1.7);
    expect(relErr(lhs, rhs)).toBeLessThan(1e-12);
  });
  it('returns NaN outside the domain', () => {
    expect(Number.isNaN(hurwitzZeta(1, 1))).toBe(true);
    expect(Number.isNaN(hurwitzZeta(2, 0))).toBe(true);
  });
});

describe('dirichletEta', () => {
  it('matches known values', () => {
    expect(relErr(dirichletEta(1), 0.6931471805599453)).toBeLessThan(1e-12);
    expect(relErr(dirichletEta(2), 0.8224670334241132)).toBeLessThan(1e-12);
  });
  it('agrees with (1 − 2^{1−s}) ζ(s) for s > 1', () => {
    const s = 3;
    const expected = (1 - Math.pow(2, 1 - s)) * hurwitzZeta(s, 1);
    expect(relErr(dirichletEta(s), expected)).toBeLessThan(1e-10);
  });
});

describe('bernoulliPolynomial', () => {
  it('matches known values', () => {
    expect(bernoulliPolynomial(2, 0.5)).toBeCloseTo(-0.08333333333333333, 14);
    expect(bernoulliPolynomial(1, 0)).toBe(-0.5);
    expect(bernoulliPolynomial(0, 3)).toBe(1);
  });
  it('rejects negative order', () => {
    expect(() => bernoulliPolynomial(-1, 0.5)).toThrow(RangeError);
  });
});

describe('eulerPolynomial', () => {
  it('matches known values', () => {
    expect(eulerPolynomial(2, 0.5)).toBeCloseTo(-0.25, 14);
    expect(eulerPolynomial(1, 0)).toBeCloseTo(-0.5, 14);
    expect(eulerPolynomial(0, 2.3)).toBeCloseTo(1, 14);
  });
});
