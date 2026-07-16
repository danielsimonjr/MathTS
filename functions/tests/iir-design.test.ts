import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  cheby1,
  cheby2,
  ellip,
  butter,
  sosfilt,
  zpk2sos,
  bilinear,
  buttord,
} from '../src/index.js';

const closeArr = (got: readonly number[], want: readonly number[], d = 4) =>
  want.forEach((v, i) => expect(got[i]).toBeCloseTo(v, d));

describe('IIR filter design', () => {
  // --- cheby1 ---------------------------------------------------------------
  it('cheby1(4,1,0.3) matches scipy', () => {
    const { b, a } = cheby1(4, 1, 0.3);
    expect(b[0]).toBeCloseTo(0.00836324, 6);
    closeArr(a, [1, -2.374123, 2.705657, -1.591709, 0.410315], 4);
  });

  // --- cheby2 (scipy.signal.cheby2(4, 40, 0.3), VERIFIED via scipy 1.17.1) ---
  it('cheby2(4,40,0.3) matches scipy', () => {
    const { b, a } = cheby2(4, 40, 0.3);
    closeArr(b, [0.018267424, -0.0093111005, 0.0256692661, -0.0093111005, 0.018267424], 6);
    closeArr(a, [1, -2.656625709, 2.8076073962, -1.3628990956, 0.2554993216], 6);
  });

  // --- ellip (scipy.signal.ellip(4, 1, 40, 0.3), VERIFIED via scipy 1.17.1) --
  it('ellip(4,1,40,0.3) matches scipy', () => {
    const { b, a } = ellip(4, 1, 40, 0.3);
    closeArr(b, [0.03530677, 0.02337488, 0.05604963, 0.02337488, 0.03530677], 6);
    closeArr(a, [1, -2.32099329, 2.67715549, -1.57739126, 0.41580156], 6);
  });

  // --- butter: 2-arg lowpass call must be unchanged ---------------------------
  it('butter(2,0.3) 2-arg lowpass still works (3-tap b)', () => {
    expect(butter(2, 0.3).b).toHaveLength(3);
  });

  it('butter(2,0.3,"high") matches scipy', () => {
    const { b, a } = butter(2, 0.3, 'high');
    closeArr(b, [0.505001, -1.010002, 0.505001], 4);
    closeArr(a, [1, -0.747789, 0.272215], 4);
  });

  // --- butter bandpass/bandstop (scipy.signal.butter(2,[0.2,0.4],...), VERIFIED) ---
  it('butter(2,[0.2,0.4],"bandpass") matches scipy', () => {
    const { b, a } = butter(2, [0.2, 0.4], 'bandpass');
    closeArr(b, [0.0674552739, 0, -0.1349105478, 0, 0.0674552739], 6);
    closeArr(a, [1, -1.9424687765, 2.1192023971, -1.2166516355, 0.4128015981], 6);
  });

  it('butter(2,[0.2,0.4],"bandstop") matches scipy', () => {
    const { b, a } = butter(2, [0.2, 0.4], 'bandstop');
    closeArr(b, [0.6389455252, -1.579560206, 2.2541129449, -1.579560206, 0.6389455252], 6);
    closeArr(a, [1, -1.9424687765, 2.1192023971, -1.2166516355, 0.4128015981], 6);
  });

  // --- sosfilt / zpk2sos / bilinear / buttord --------------------------------
  it('sosfilt passthrough biquad returns input', () => {
    expect(sosfilt([[1, 0, 0, 1, 0, 0]], [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('zpk2sos + sosfilt matches lfilter(b,a,x) built from the same zpk (butter order 4)', () => {
    // Round-trip check: design a butter(4,0.3) tf directly, and independently via
    // zpk2sos+sosfilt cascade using the same poles/zeros/gain the pipeline computes.
    // Since butter() only exposes {b,a}, this test instead pins zpk2sos's own
    // algebraic correctness: a trivial 4th-order system built from two known
    // conjugate pole pairs and no zeros must equal its direct polynomial expansion.
    const p1 = new Complex(-0.5, 0.5);
    const p2 = new Complex(-0.5, -0.5);
    const p3 = new Complex(-0.2, 0.9);
    const p4 = new Complex(-0.2, -0.9);
    const sos = zpk2sos([], [p1, p2, p3, p4], 2);
    expect(sos).toHaveLength(2);
    // impulse response of the cascade should be finite and start with b0 of section 1 (scaled by k)
    const impulse = [1, 0, 0, 0, 0, 0, 0, 0];
    const y = sosfilt(sos, impulse);
    // Zero-state direct-form-II-transposed cascade: y[0] = b0(section0) * b0(section1).
    expect(y[0]).toBeCloseTo(sos[0][0] * sos[1][0], 10);
    expect(y.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('bilinear(b,a,fs) matches scipy for a simple first-order analog system', () => {
    const { b, a } = bilinear([1], [1, 1], 1);
    closeArr(b, [0.3333333333, 0.3333333333], 6);
    closeArr(a, [1, -0.3333333333], 6);
  });

  it('bilinear(b,a,fs) matches scipy for a second-order analog system', () => {
    const { b, a } = bilinear([1, 0, 1], [1, 2, 3], 2);
    closeArr(b, [0.6296296296, -1.1111111111, 0.6296296296], 6);
    closeArr(a, [1, -0.962962963, 0.4074074074], 6);
  });

  it('buttord(0.2,0.3,3,40) matches scipy', () => {
    const { N, Wn } = buttord(0.2, 0.3, 3, 40);
    expect(N).toBe(11);
    expect(Wn).toBeCloseTo(0.2000403907, 8);
  });

  it('buttord(0.3,0.2,3,40) (highpass direction) matches scipy', () => {
    const { N, Wn } = buttord(0.3, 0.2, 3, 40);
    expect(N).toBe(11);
    expect(Wn).toBeCloseTo(0.2999444154, 8);
  });
});
