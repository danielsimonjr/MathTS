/**
 * Coverage tests for functions/src/typed/trigonometry.ts.
 *
 * Targets the Complex and BigNumber scalar branches plus the sequential
 * Float64Array fallback (small arrays below the parallel threshold) that the
 * existing parallel-trig-unary suite does not exercise.
 */

import { describe, it, expect } from 'vitest';
import { Complex, BigNumber } from '@danielsimonjr/mathts-core';
import {
  sin,
  cos,
  tan,
  csc,
  sec,
  cot,
  asin,
  acos,
  atan,
  atan2,
  acsc,
  asec,
  acot,
  asinh,
  acosh,
  atanh,
  toRadians,
  toDegrees,
  hypot,
} from '../src/typed/trigonometry.js';

const C = (re: number, im: number) => new Complex(re, im);
const B = (n: number) => BigNumber.fromNumber(n);

describe('trigonometry — Complex scalar branches', () => {
  it('sin/cos/tan on Complex', () => {
    expect((sin(C(1, 2)) as Complex).re).toBeCloseTo(new Complex(1, 2).sin().re, 10);
    expect((cos(C(1, 2)) as Complex).re).toBeCloseTo(new Complex(1, 2).cos().re, 10);
    expect((tan(C(0.5, 0.5)) as Complex).re).toBeCloseTo(new Complex(0.5, 0.5).tan().re, 10);
  });

  it('csc/sec/cot on Complex (reciprocal identities)', () => {
    const z = C(1, 1);
    const cscz = csc(z) as Complex;
    const sinz = (sin(z) as Complex).inverse();
    expect(cscz.re).toBeCloseTo(sinz.re, 10);
    expect(cscz.im).toBeCloseTo(sinz.im, 10);

    const secz = sec(z) as Complex;
    const cosz = (cos(z) as Complex).inverse();
    expect(secz.re).toBeCloseTo(cosz.re, 10);

    const cotz = cot(z) as Complex;
    const tanz = (tan(z) as Complex).inverse();
    expect(cotz.re).toBeCloseTo(tanz.re, 10);
  });

  it('asin/acos/atan on Complex', () => {
    expect((asin(C(0.5, 0.5)) as Complex).re).toBeCloseTo(new Complex(0.5, 0.5).asin().re, 10);
    expect((acos(C(0.5, 0.5)) as Complex).re).toBeCloseTo(new Complex(0.5, 0.5).acos().re, 10);
    expect((atan(C(0.5, 0.5)) as Complex).re).toBeCloseTo(new Complex(0.5, 0.5).atan().re, 10);
  });

  it('acsc/asec/acot on Complex', () => {
    const z = C(2, 1);
    expect((acsc(z) as Complex).re).toBeCloseTo(z.inverse().asin().re, 10);
    expect((asec(z) as Complex).re).toBeCloseTo(z.inverse().acos().re, 10);
    expect((acot(z) as Complex).re).toBeCloseTo(z.inverse().atan().re, 10);
  });

  it('asinh/acosh/atanh on Complex', () => {
    expect((asinh(C(0.5, 0.5)) as Complex).re).toBeCloseTo(new Complex(0.5, 0.5).asinh().re, 10);
    expect((acosh(C(2, 0.5)) as Complex).re).toBeCloseTo(new Complex(2, 0.5).acosh().re, 10);
    expect((atanh(C(0.5, 0.5)) as Complex).re).toBeCloseTo(new Complex(0.5, 0.5).atanh().re, 10);
  });
});

describe('trigonometry — BigNumber scalar branches', () => {
  it('sin/cos/tan on BigNumber', () => {
    expect((sin(B(1)) as BigNumber).toNumber()).toBeCloseTo(Math.sin(1), 8);
    expect((cos(B(1)) as BigNumber).toNumber()).toBeCloseTo(Math.cos(1), 8);
    expect((tan(B(1)) as BigNumber).toNumber()).toBeCloseTo(Math.tan(1), 8);
  });

  it('csc/sec/cot on BigNumber', () => {
    expect((csc(B(1)) as BigNumber).toNumber()).toBeCloseTo(1 / Math.sin(1), 8);
    expect((sec(B(1)) as BigNumber).toNumber()).toBeCloseTo(1 / Math.cos(1), 8);
    expect((cot(B(1)) as BigNumber).toNumber()).toBeCloseTo(1 / Math.tan(1), 8);
  });

  it('asin/acos/atan on BigNumber', () => {
    expect((asin(B(0.5)) as BigNumber).toNumber()).toBeCloseTo(Math.asin(0.5), 8);
    expect((acos(B(0.5)) as BigNumber).toNumber()).toBeCloseTo(Math.acos(0.5), 8);
    expect((atan(B(0.5)) as BigNumber).toNumber()).toBeCloseTo(Math.atan(0.5), 8);
  });

  it('asinh/acosh/atanh on BigNumber', () => {
    expect((asinh(B(0.5)) as BigNumber).toNumber()).toBeCloseTo(Math.asinh(0.5), 8);
    expect((acosh(B(2)) as BigNumber).toNumber()).toBeCloseTo(Math.acosh(2), 8);
    expect((atanh(B(0.5)) as BigNumber).toNumber()).toBeCloseTo(Math.atanh(0.5), 8);
  });
});

describe('trigonometry — number scalar branches', () => {
  it('basic + reciprocal on number', () => {
    expect(sin(0)).toBeCloseTo(0, 12);
    expect(cos(0)).toBeCloseTo(1, 12);
    expect(tan(0)).toBeCloseTo(0, 12);
    expect(csc(1)).toBeCloseTo(1 / Math.sin(1), 12);
    expect(sec(1)).toBeCloseTo(1 / Math.cos(1), 12);
    expect(cot(1)).toBeCloseTo(1 / Math.tan(1), 12);
  });

  it('asin/acos return Complex for |x| > 1', () => {
    const a = asin(2);
    expect(a).toBeInstanceOf(Complex);
    const b = acos(2);
    expect(b).toBeInstanceOf(Complex);
    // within domain stays real
    expect(asin(0.5)).toBeCloseTo(Math.asin(0.5), 12);
    expect(acos(0.5)).toBeCloseTo(Math.acos(0.5), 12);
  });

  it('inverse + hyperbolic on number', () => {
    expect(atan(1)).toBeCloseTo(Math.atan(1), 12);
    expect(acsc(2)).toBeCloseTo(Math.asin(0.5), 12);
    expect(asec(2)).toBeCloseTo(Math.acos(0.5), 12);
    expect(acot(2)).toBeCloseTo(Math.atan(0.5), 12);
    expect(asinh(1)).toBeCloseTo(Math.asinh(1), 12);
    expect(acosh(2)).toBeCloseTo(Math.acosh(2), 12);
    expect(atanh(0.5)).toBeCloseTo(Math.atanh(0.5), 12);
  });

  it('atan2 / utilities', () => {
    expect(atan2(1, 1)).toBeCloseTo(Math.PI / 4, 12);
    expect(toRadians(180)).toBeCloseTo(Math.PI, 12);
    expect(toDegrees(Math.PI)).toBeCloseTo(180, 12);
    expect(hypot(-3)).toBe(3);
    expect(hypot(3, 4)).toBe(5);
    expect(hypot(1, 2, 2)).toBe(3);
    expect(hypot([3, 4])).toBe(5);
  });
});

describe('trigonometry — Float64Array sequential fallback (below parallel threshold)', () => {
  // Small arrays stay under the default thresholdElements (50000), so the
  // sequential for-loop branch runs instead of the worker path.
  const small = Float64Array.from([0.1, 0.3, 0.7, 1.1]);

  it('csc/sec/cot sequential', async () => {
    const c = await (csc(small) as Promise<Float64Array>);
    const s = await (sec(small) as Promise<Float64Array>);
    const t = await (cot(small) as Promise<Float64Array>);
    for (let i = 0; i < small.length; i++) {
      expect(c[i]).toBeCloseTo(1 / Math.sin(small[i]), 10);
      expect(s[i]).toBeCloseTo(1 / Math.cos(small[i]), 10);
      expect(t[i]).toBeCloseTo(1 / Math.tan(small[i]), 10);
    }
  });

  it('asin/acos/atan sequential', async () => {
    const xs = Float64Array.from([-0.9, -0.2, 0.3, 0.8]);
    const a = await (asin(xs) as Promise<Float64Array>);
    const b = await (acos(xs) as Promise<Float64Array>);
    const c = await (atan(xs) as Promise<Float64Array>);
    for (let i = 0; i < xs.length; i++) {
      expect(a[i]).toBeCloseTo(Math.asin(xs[i]), 10);
      expect(b[i]).toBeCloseTo(Math.acos(xs[i]), 10);
      expect(c[i]).toBeCloseTo(Math.atan(xs[i]), 10);
    }
  });

  it('asinh/acosh/atanh sequential', async () => {
    const a = await (asinh(Float64Array.from([0.1, 0.5, 1, 2])) as Promise<Float64Array>);
    const b = await (acosh(Float64Array.from([1, 1.5, 2, 3])) as Promise<Float64Array>);
    const c = await (atanh(Float64Array.from([-0.5, 0, 0.3, 0.6])) as Promise<Float64Array>);
    expect(a[1]).toBeCloseTo(Math.asinh(0.5), 10);
    expect(b[2]).toBeCloseTo(Math.acosh(2), 10);
    expect(c[3]).toBeCloseTo(Math.atanh(0.6), 10);
  });
});
