/**
 * Oracle tests for clone-consolidation PR 7 (M7 PSD shell, Newton/Halley loop,
 * band quadratic root map). Values pinned before shared helpers land.
 */
import { describe, it, expect } from 'vitest';
import { welchPSD, bartlettPSD, newton, halley, butter } from '../src/index.js';

const arrCloseTo = (a: number[], b: number[], d = 10) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));
};

describe('M7 — welchPSD / bartlettPSD result shell', () => {
  it('welchPSD defaults: overlap half frame, Hann window', () => {
    const frameLength = 64;
    const signal = Float64Array.from({ length: 128 }, (_, i) => Math.sin((2 * Math.PI * i) / 32));
    const r = welchPSD(signal, { frameLength });
    expect(r.frameLength).toBe(frameLength);
    expect(r.psd.length).toBe(frameLength / 2 + 1);
    expect(r.frequencies.length).toBe(r.psd.length);
    for (let i = 0; i < r.frequencies.length; i++) {
      expect(r.frequencies[i]).toBe(i / frameLength);
    }
    const rectWelch = welchPSD(signal, {
      frameLength,
      overlap: 0,
      window: 'rect',
    });
    const bart = bartlettPSD(signal, { frameLength });
    expect(bart.psd.length).toBe(rectWelch.psd.length);
    for (let i = 0; i < bart.psd.length; i++) {
      expect(bart.psd[i]).toBeCloseTo(rectWelch.psd[i], 10);
    }
  });

  it('bartlettPSD result has psd, frequencies, frameLength only', () => {
    const r = bartlettPSD([1, 0, -1, 0], { frameLength: 4 });
    expect(Object.keys(r).sort()).toEqual(['frameLength', 'frequencies', 'psd']);
    expect(r.frameLength).toBe(4);
  });

  it('empty signal yields zero-length PSD with frequency grid', () => {
    const w = welchPSD([], { frameLength: 8 });
    const b = bartlettPSD([], { frameLength: 8 });
    expect(w.psd).toEqual([]);
    expect(w.frequencies).toEqual([]);
    expect(b.psd).toEqual([]);
    expect(b.frequencies).toEqual([]);
  });

  it('frameLength larger than signal (current dispatch behavior)', () => {
    const signal = [1, 2, 3];
    const frameLength = 16;
    const w = welchPSD(signal, { frameLength });
    expect(w.psd).toEqual([]);
    expect(w.frequencies).toEqual([]);
    expect(w.frameLength).toBe(frameLength);
  });

  it('number[] and Float64Array inputs match', () => {
    const arr = [0.5, -0.5, 0.25, -0.25, 0.125];
    const typed = Float64Array.from(arr);
    const fromArr = welchPSD(arr, { frameLength: 8, overlap: 0, window: 'rect' });
    const fromTyped = welchPSD(typed, { frameLength: 8, overlap: 0, window: 'rect' });
    arrCloseTo(fromArr.psd, fromTyped.psd);
    arrCloseTo(fromArr.frequencies, fromTyped.frequencies);
  });

  it('NaN samples propagate into PSD output', () => {
    const signal = [1, NaN, 1, 0];
    const { psd } = welchPSD(signal, { frameLength: 4, overlap: 0, window: 'rect' });
    expect(psd.some((v) => Number.isNaN(v))).toBe(true);
  });
});

describe('Newton / Halley iterateRoot oracle', () => {
  it('newton(x => x**2 - 2, 1) matches file example (~sqrt(2))', () => {
    expect(newton((x) => x ** 2 - 2, 1)).toBeCloseTo(1.4142135623730951, 12);
  });

  it('halley(x => x**3 - 2, 1) matches file example (~cbrt(2))', () => {
    expect(halley((x) => x ** 3 - 2, 1)).toBeCloseTo(1.2599210498948732, 12);
  });

  it('returns x0 when |f(x0)| < tol', () => {
    expect(newton(() => 1e-14, 3.5, { tol: 1e-12 })).toBe(3.5);
    expect(halley(() => 1e-14, -2, { tol: 1e-12 })).toBe(-2);
  });

  it('zero derivative throws the function-specific message', () => {
    expect(() => newton((x) => x - 2, 0, { fprime: () => 0 })).toThrow(
      'newton: derivative near zero — cannot continue'
    );
    expect(() => halley((x) => x + 1, 0, { fprime: () => 1, fprime2: () => 2 })).toThrow(
      'halley: denominator near zero — cannot continue'
    );
  });

  it('non-convergence throws with method name and maxIter', () => {
    expect(() => newton((x) => x ** 2 + 1, 2, { maxIter: 7 })).toThrow(
      'newton: failed to converge within 7 iterations'
    );
    expect(() => halley((x) => x ** 2 + 1, 2, { maxIter: 9 })).toThrow(
      'halley: failed to converge within 9 iterations'
    );
  });

  it('NaN from f is not swallowed', () => {
    expect(() => newton(() => NaN, 1, { maxIter: 5 })).toThrow();
    expect(() => halley(() => NaN, 1, { maxIter: 5 })).toThrow();
  });
});

/** Bandpass/bandstop butter(1, …) coefficients pinned from pre-refactor implementation. */
describe('band quadratic root map (via butter bandpass/bandstop)', () => {
  it('butter(1,[0.25,0.35],bandpass) matches scipy-era oracle', () => {
    const { b, a } = butter(1, [0.25, 0.35], 'bandpass');
    arrCloseTo(b, [0.13672873599731955, 0, -0.13672873599731955]);
    arrCloseTo(a, [1, -1.0274862967460152, 0.7265425280053606]);
  });

  it('butter(1,[0.25,0.35],bandstop) matches scipy-era oracle', () => {
    const { b, a } = butter(1, [0.25, 0.35], 'bandstop');
    arrCloseTo(b, [0.8632712640026804, -1.0274862967460152, 0.8632712640026802]);
    arrCloseTo(a, [1, -1.0274862967460152, 0.7265425280053606]);
  });

  it('bandpass and bandstop share the same denominator for equal Wn', () => {
    const bp = butter(2, [0.2, 0.4], 'bandpass');
    const bs = butter(2, [0.2, 0.4], 'bandstop');
    arrCloseTo(bp.a, bs.a, 12);
  });
});
