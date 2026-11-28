import { describe, expect, it } from 'vitest';
import { Complex, isComplex } from '@danielsimonjr/mathts-core';
import { acoth, acsc, asec, acsch } from '../src/index.js';
import { create, all } from '@danielsimonjr/mathts-compat';

describe('G08 native zero and Complex inverse hyperbolic fixes', () => {
  it('acoth(0) is π/2·i (C99 atanh(+∞)), not NaN', () => {
    const z = acoth(0);
    expect(isComplex(z)).toBe(true);
    const c = z as Complex;
    expect(c.re).toBe(0);
    expect(c.im).toBeCloseTo(Math.PI / 2, 12);
  });

  it('acoth(-0) keeps the signed real zero from atanh(-∞)', () => {
    const z = acoth(-0);
    expect(isComplex(z)).toBe(true);
    const c = z as Complex;
    expect(Object.is(c.re, -0)).toBe(true);
    expect(c.im).toBeCloseTo(Math.PI / 2, 12);
  });

  it('acsc(0) is π/2 + i∞ (casin(+∞)), not mathjs 0+i∞', () => {
    const z = acsc(0);
    expect(isComplex(z)).toBe(true);
    const c = z as Complex;
    expect(c.re).toBeCloseTo(Math.PI / 2, 12);
    expect(c.im).toBe(Infinity);
  });

  it('asec(0) is −i∞ (cacos(+∞)), not mathjs +i∞', () => {
    const z = asec(0);
    expect(isComplex(z)).toBe(true);
    const c = z as Complex;
    expect(c.re).toBe(0);
    expect(c.im).toBe(-Infinity);
  });

  it('acsch(complex) uses asinh(1/z) without calling a missing Complex.acsch', () => {
    const z = new Complex(1, 2);
    const r = acsch(z);
    expect(isComplex(r)).toBe(true);
    expect((r as Complex).isNaN()).toBe(false);
    const inv = z.inverse().asinh();
    expect((r as Complex).re).toBeCloseTo(inv.re, 12);
    expect((r as Complex).im).toBeCloseTo(inv.im, 12);
  });

  it('create(all) does not change native functions results', () => {
    const before = {
      acsc: acsc(0) as Complex,
      asec: asec(0) as Complex,
      acoth: acoth(0) as Complex,
    };
    const math = create(all);
    const after = {
      acsc: acsc(0) as Complex,
      asec: asec(0) as Complex,
      acoth: acoth(0) as Complex,
    };
    expect(after.acsc.re).toBe(before.acsc.re);
    expect(after.acsc.im).toBe(before.acsc.im);
    expect(after.asec.re).toBe(before.asec.re);
    expect(after.asec.im).toBe(before.asec.im);
    expect(after.acoth.re).toBe(before.acoth.re);
    expect(after.acoth.im).toBe(before.acoth.im);
    // mathjs 15.3.0 matches native MathTS: π/2 + i∞ (see #1789).
    const compatAcsc = math.acsc(0) as Complex;
    expect(compatAcsc.re).toBeCloseTo(Math.PI / 2, 12);
    expect(compatAcsc.im).toBe(Infinity);
  });
});
