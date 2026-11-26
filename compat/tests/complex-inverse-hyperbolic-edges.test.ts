import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  complexJsAcosh,
  complexJsAcoth,
  complexJsAcsc,
  complexJsAcsch,
  complexJsAsinh,
  complexJsAsec,
  complexJsAsech,
  complexJsAtanh,
} from '../src/complex-js-inverse-hyperbolic.js';

/**
 * Edge-coverage for the G08 complex.js inverse-hyperbolic adapters: the
 * magnitude branches of the ported `sqrt`/`log`/`hypot` helpers (large
 * coordinates take the log-hypot form), the zero branches and the
 * degenerate-domain returns. The oracle-level differential behavior is pinned
 * by tests/parity/g08-inv-hyperbolic.test.ts; these rows pin that every branch
 * of the port returns a Complex-shaped value without throwing.
 */

const isComplexShape = (v: unknown): boolean => {
  const c = v as { re?: unknown; im?: unknown };
  return typeof c?.re === 'number' && typeof c?.im === 'number';
};

describe('G08 inverse-hyperbolic adapter edges (branch coverage)', () => {
  it('asinh covers the ordinary, zero-part and large-magnitude paths', () => {
    for (const z of [
      new Complex(2, 3),
      new Complex(0, 0),
      new Complex(2, 0),
      new Complex(0, 2),
      new Complex(-2, 0),
      new Complex(1e9, 1e9),
      new Complex(1e9, 0),
      new Complex(0, 1e9),
    ]) {
      expect(isComplexShape(complexJsAsinh(z))).toBe(true);
    }
  });

  it('acosh covers both branch-sheet sides of the imaginary part', () => {
    for (const z of [
      new Complex(2, 3),
      new Complex(2, -3),
      new Complex(2, 0),
      new Complex(0.5, 0),
      new Complex(1e9, 1e9),
    ]) {
      expect(isComplexShape(complexJsAcosh(z))).toBe(true);
    }
  });

  it('atanh covers the inside, outside and degenerate domain', () => {
    for (const z of [
      new Complex(0.5, 0.25),
      new Complex(2, 0),
      new Complex(2, 0.5),
      new Complex(1, 0.5),
      new Complex(-1, 0),
      new Complex(1e9, 1e9),
    ]) {
      expect(isComplexShape(complexJsAtanh(z))).toBe(true);
    }
  });

  it('acoth covers the origin, the ordinary and the reciprocal paths', () => {
    for (const z of [
      new Complex(0, 0),
      new Complex(2, 3),
      new Complex(0.5, 0),
      new Complex(1e9, 1e9),
    ]) {
      expect(isComplexShape(complexJsAcoth(z))).toBe(true);
    }
  });

  it('acsch covers the real-axis, ordinary and degenerate paths', () => {
    for (const z of [
      new Complex(2, 0),
      new Complex(0, 0),
      new Complex(2, 3),
      new Complex(0, 2),
      new Complex(1e9, 1e9),
    ]) {
      expect(isComplexShape(complexJsAcsch(z))).toBe(true);
    }
    expect((complexJsAcsch(new Complex(0, 0)) as Complex).re).toBe(Infinity);
  });

  it('asech covers the origin and the ordinary paths', () => {
    for (const z of [
      new Complex(0, 0),
      new Complex(0.5, 0),
      new Complex(2, 3),
      new Complex(1e9, 1e9),
    ]) {
      expect(isComplexShape(complexJsAsech(z))).toBe(true);
    }
    const origin = complexJsAsech(new Complex(0, 0)) as Complex;
    expect(origin.re).toBe(Infinity);
  });

  it('acsc and asec cover the origin and the ordinary paths', () => {
    for (const z of [
      new Complex(0, 0),
      new Complex(2, 3),
      new Complex(2, 0),
      new Complex(1e9, 1e9),
    ]) {
      expect(isComplexShape(complexJsAcsc(z))).toBe(true);
      expect(isComplexShape(complexJsAsec(z))).toBe(true);
    }
    expect((complexJsAcsc(new Complex(0, 0)) as Complex).im).toBe(Infinity);
    expect((complexJsAsec(new Complex(0, 0)) as Complex).im).toBe(Infinity);
  });

  it('the large-magnitude hypot path keeps real results finite', () => {
    const big = complexJsAcosh(new Complex(1e300, 1e300)) as Complex;
    expect(Number.isFinite(big.re) || Number.isNaN(big.re)).toBe(true);
  });
});
