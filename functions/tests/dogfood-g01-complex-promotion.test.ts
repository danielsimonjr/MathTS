/**
 * Dogfood relay G01 — complex promotion (#728, #729).
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { asin, acos, log, pow, nthRoot, acosh, evaluate, runWithConfig } from '../src/index.js';

describe('G01 #729 complex promotion (functions)', () => {
  it('log(-1) is i*pi', () => {
    const z = log(-1) as Complex;
    expect(z.re).toBeCloseTo(0, 12);
    expect(z.im).toBeCloseTo(Math.PI, 12);
  });

  it('pow(-8, 1/3) principal complex root', () => {
    const z = pow(-8, 1 / 3) as Complex;
    expect(z.re).toBeCloseTo(1, 12);
    expect(z.im).toBeCloseTo(Math.sqrt(3), 12);
  });

  it('nthRoot(-8, 3) real odd root', () => {
    expect(nthRoot(-8, 3)).toBe(-2);
  });

  it('acosh(0) is i*pi/2', () => {
    const z = acosh(0) as Complex;
    expect(z.re).toBeCloseTo(0, 12);
    expect(z.im).toBeCloseTo(Math.PI / 2, 12);
  });

  it("evaluate('log(-1)') promotes", () => {
    const z = evaluate('log(-1)') as Complex;
    expect(z.im).toBeCloseTo(Math.PI, 12);
  });

  it('predictable:true keeps real NaN for log(-1)', () => {
    runWithConfig({ predictable: true }, () => {
      expect(log(-1)).toBeNaN();
    });
  });
});

describe('G01 #728 inverse trig outside domain', () => {
  it('asin(2) returns Complex when predictable is false', () => {
    expect((asin(2) as Complex).im).not.toBeNaN();
    expect((asin(2) as Complex).re).toBeCloseTo(Math.PI / 2, 12);
  });

  it('asin(2) is NaN when predictable is true', () => {
    runWithConfig({ predictable: true }, () => {
      expect(asin(2)).toBeNaN();
    });
  });

  it('acos(2) promotes when predictable is false', () => {
    expect((acos(2) as Complex).im).toBeGreaterThan(0);
  });
});
