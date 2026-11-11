/**
 * Extra probes for G01 complex promotion: bases, predictable branches,
 * inverse secant/cosecant, and the real vector path.
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  acos,
  acosh,
  acsc,
  asec,
  asin,
  atanh,
  log,
  log10,
  log1p,
  log2,
  nthRoot,
  pow,
  runWithConfig,
  sqrt,
} from '../src/index.js';

function expectComplex(actual: unknown, re: number, im: number, digits = 12): void {
  const z = actual as Complex;
  expect(z.re).toBeCloseTo(re, digits);
  expect(z.im).toBeCloseTo(im, digits);
}

describe('G01 edge probes', () => {
  it('log(0) and log of a positive stay real', () => {
    expect(log(0)).toBe(-Infinity);
    expect(log(1)).toBe(0);
    expect(log(Math.E)).toBe(1);
  });

  it('log with a negative base is the quotient of principal logs', () => {
    const denom = new Complex(Math.log(2), Math.PI);
    const pos = new Complex(Math.log(8), 0).divide(denom);
    expectComplex(log(8, -2), pos.re, pos.im);
    const neg = new Complex(Math.log(8), Math.PI).divide(denom);
    expectComplex(log(-8, -2), neg.re, neg.im);
  });

  it('log(-8, 2) is the complex natural log over log(2)', () => {
    expectComplex(log(-8, 2), Math.log(8) / Math.log(2), Math.PI / Math.log(2));
  });

  it('pow predictable odd-denominator roots stay real; even roots are NaN', () => {
    runWithConfig({ predictable: true }, () => {
      expect(pow(-8, 1 / 3)).toBeCloseTo(-2, 12);
      expect(pow(-8, 2 / 3)).toBeCloseTo(4, 12);
      expect(pow(-8, 0.5)).toBeNaN();
      expect(pow(-2, Infinity)).toBeNaN();
      expect(pow(-0.5, -Infinity)).toBeNaN();
    });
  });

  it('pow(-0.5, Infinity) is real 0, not a complex zero', () => {
    expect(pow(-0.5, Infinity)).toBe(0);
    expect(pow(-2, -Infinity)).toBe(0);
  });

  it('integer powers of a negative base stay real', () => {
    expect(pow(-8, 2)).toBe(64);
    expect(pow(-8, -1)).toBe(-0.125);
    expect(pow(-8, 0)).toBe(1);
  });

  it('nthRoot rejects an even root of a negative and keeps the odd root', () => {
    expect(nthRoot(-8, 3)).toBe(-2);
    expect(nthRoot(-8, -3)).toBe(-0.5);
    expect(nthRoot(4)).toBe(2);
    expect(() => nthRoot(-8, 2)).toThrow(/odd/i);
  });

  it('acosh and atanh cover both sides of the cut', () => {
    expectComplex(acosh(-2), Math.log(Math.sqrt(3) + 2), Math.PI);
    const above = new Complex(2, 0).atanh();
    const below = new Complex(-2, 0).atanh();
    expectComplex(atanh(2), above.re, above.im);
    expectComplex(atanh(-2), below.re, below.im);
    expect(above.im).toBeCloseTo(-Math.PI / 2, 12);
    expect(below.im).toBeCloseTo(Math.PI / 2, 12);
    expect(atanh(1)).toBe(Infinity);
    expect(atanh(-1)).toBe(-Infinity);
  });

  it('asin and acos of both sides of [-1, 1]', () => {
    expectComplex(asin(-2), -Math.PI / 2, Math.acosh(2));
    expectComplex(acos(-2), Math.PI, -Math.acosh(2));
    expect(asin(1)).toBeCloseTo(Math.PI / 2, 12);
    expect(acos(1)).toBe(0);
  });

  it('log10, log2, log1p, and sqrt follow the same domain split', () => {
    expectComplex(log10(-1), 0, Math.PI / Math.LN10);
    expectComplex(log2(-1), 0, Math.PI / Math.LN2);
    expect(log1p(-1)).toBe(-Infinity);
    expectComplex(log1p(-2), 0, Math.PI);
    expect(sqrt(-1)).toEqual(new Complex(0, 1));
    runWithConfig({ predictable: true }, () => {
      expect(log10(-1)).toBeNaN();
      expect(log2(-1)).toBeNaN();
      expect(log1p(-2)).toBeNaN();
      expect(sqrt(-1)).toBeNaN();
      expect(sqrt(4)).toBe(2);
    });
  });

  it('acsc and asec promote inside (-1, 1) only when predictable is false', () => {
    const z = acsc(0.5) as Complex;
    expect(z.im).not.toBe(0);
    expect(Number.isFinite(z.re)).toBe(true);
    expect((asec(0.5) as Complex).im).not.toBe(0);
    expect(acsc(2)).toBeCloseTo(Math.asin(0.5), 12);
    expect(asec(2)).toBeCloseTo(Math.acos(0.5), 12);
    runWithConfig({ predictable: true }, () => {
      expect(acsc(0.5)).toBeNaN();
      expect(asec(0.5)).toBeNaN();
    });
  });

  it('Float64Array log and sqrt stay on the real kernel', () => {
    const x = new Float64Array([-1, 1, Math.E]);
    const logged = log(x) as Float64Array;
    expect(logged).toBeInstanceOf(Float64Array);
    expect(Object.is(logged[0], NaN)).toBe(true);
    expect(logged[1]).toBe(0);
    expect(logged[2]).toBeCloseTo(1, 12);
    const rooted = sqrt(new Float64Array([-4, 4])) as Float64Array;
    expect(Object.is(rooted[0], NaN)).toBe(true);
    expect(rooted[1]).toBe(2);
  });

  it('matrix integer power is unchanged', () => {
    const m = pow(
      [
        [2, 0],
        [0, 3],
      ],
      2
    ) as number[][];
    expect(m).toEqual([
      [4, 0],
      [0, 9],
    ]);
  });
});
