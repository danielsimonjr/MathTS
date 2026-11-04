import { describe, it, expect } from 'vitest';
import {
  impulseResponse,
  stepResponse,
  tf2ss,
  ss2tf,
  cont2discrete,
  iirNotch,
  iirPeak,
  tf2zpk,
  sos2tf,
} from '../src/signal/system-response.js';

describe('system responses', () => {
  it('impulse and step responses of a first-order IIR', () => {
    expect(impulseResponse([1], [1, -0.5], 4)).toEqual([1, 0.5, 0.25, 0.125]);
    const s = stepResponse([1], [1, -0.5], 3);
    [1, 1.5, 1.75].forEach((v, i) => expect(s[i]).toBeCloseTo(v, 12));
  });
});

describe('state space conversions', () => {
  it('tf2ss gives the controllable canonical form', () => {
    const ss = tf2ss([1], [1, 3, 2]);
    expect(ss.A).toEqual([
      [-3, -2],
      [1, 0],
    ]);
    expect(ss.B).toEqual([[1], [0]]);
    expect(ss.C).toEqual([[0, 1]]);
    expect(ss.D).toEqual([[0]]);
  });

  it('ss2tf inverts tf2ss', () => {
    const ss = tf2ss([1], [1, 3, 2]);
    const { num, den } = ss2tf(ss.A, ss.B, ss.C, ss.D);
    expect(num).toEqual([1]);
    den.forEach((v, i) => expect(v).toBeCloseTo([1, 3, 2][i], 12));
  });

  it('cont2discrete zoh of a scalar integrator-lag', () => {
    const d = cont2discrete({ A: [[-1]], B: [[1]], C: [[1]], D: [[0]] }, 1, 'zoh');
    expect(d.A[0][0]).toBeCloseTo(0.36787944117144233, 12);
    expect(d.B[0][0]).toBeCloseTo(0.6321205588285577, 12);
  });

  it('cont2discrete euler and bilinear agree with the first-order expansion for small dt', () => {
    const sys = { A: [[-2]], B: [[1]], C: [[1]], D: [[0]] };
    const dt = 1e-4;
    const e = cont2discrete(sys, dt, 'euler');
    const bl = cont2discrete(sys, dt, 'bilinear');
    expect(e.A[0][0]).toBeCloseTo(1 - 2 * dt, 12);
    expect(bl.A[0][0]).toBeCloseTo(1 - 2 * dt, 6);
  });
});

describe('notch, peak, zpk and sos', () => {
  it('iirNotch has a zero at w0 and unity gain at DC', () => {
    const { b, a } = iirNotch(0.3, 30);
    const dc = (b[0] + b[1] + b[2]) / (a[0] + a[1] + a[2]);
    expect(dc).toBeCloseTo(1, 10);
    const w = 0.3 * Math.PI;
    const re = b[0] + b[1] * Math.cos(-w) + b[2] * Math.cos(-2 * w);
    const im = b[1] * Math.sin(-w) + b[2] * Math.sin(-2 * w);
    expect(Math.hypot(re, im)).toBeLessThan(1e-10);
  });

  it('iirPeak has unit gain at w0 and zero gain at DC', () => {
    const { b, a } = iirPeak(0.25, 10);
    const dc = (b[0] + b[1] + b[2]) / (a[0] + a[1] + a[2]);
    expect(Math.abs(dc)).toBeLessThan(1e-12);
    const w = 0.25 * Math.PI;
    const num = {
      re: b[0] + b[1] * Math.cos(-w) + b[2] * Math.cos(-2 * w),
      im: b[1] * Math.sin(-w) + b[2] * Math.sin(-2 * w),
    };
    const den = {
      re: a[0] + a[1] * Math.cos(-w) + a[2] * Math.cos(-2 * w),
      im: a[1] * Math.sin(-w) + a[2] * Math.sin(-2 * w),
    };
    expect(Math.hypot(num.re, num.im) / Math.hypot(den.re, den.im)).toBeCloseTo(1, 10);
  });

  it('tf2zpk finds the zeros of (z-1)(z-2)', () => {
    const { z, k } = tf2zpk([1, -3, 2], [1]);
    expect(z.map((c) => c.re).sort((x, y) => x - y)).toHaveLength(2);
    const sorted = z.map((c) => c.re).sort((x, y) => x - y);
    expect(sorted[0]).toBeCloseTo(1, 12);
    expect(sorted[1]).toBeCloseTo(2, 12);
    expect(k).toBe(1);
  });

  it('sos2tf multiplies the section polynomials', () => {
    const { b, a } = sos2tf([[1, 2, 1, 1, 0, 0]]);
    expect(b).toEqual([1, 2, 1]);
    expect(a).toEqual([1, 0, 0]);
  });
});
