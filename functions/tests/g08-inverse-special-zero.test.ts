import { describe, expect, it } from 'vitest';
import { Complex, isComplex } from '@danielsimonjr/mathts-core';
import { acoth, acsc, asec, acsch } from '../src/index.js';

describe('G08 native zero and Complex inverse hyperbolic fixes', () => {
  it('acoth(0) is π/2·i, not NaN', () => {
    const z = acoth(0);
    expect(isComplex(z)).toBe(true);
    const c = z as Complex;
    expect(c.re).toBe(0);
    expect(c.im).toBeCloseTo(Math.PI / 2, 12);
  });

  it('acsc(0) is ∞·i on the principal branch', () => {
    const z = acsc(0);
    expect(isComplex(z)).toBe(true);
    const c = z as Complex;
    expect(c.re).toBe(0);
    expect(c.im).toBe(Infinity);
  });

  it('asec(0) is ∞·i on the principal branch', () => {
    const z = asec(0);
    expect(isComplex(z)).toBe(true);
    const c = z as Complex;
    expect(c.re).toBe(0);
    expect(c.im).toBe(Infinity);
  });

  it('acsch(complex) uses asinh(1/z) without calling a missing Complex.acsch', () => {
    const z = new Complex(1, 2);
    const r = acsch(z);
    expect(isComplex(r)).toBe(true);
    expect((r as Complex).isNaN()).toBe(false);
  });
});
