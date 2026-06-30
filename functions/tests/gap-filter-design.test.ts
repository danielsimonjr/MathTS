import { describe, it, expect } from 'vitest';
import { firwin, butter, lfilter, lfilterZi, filtfilt } from '@danielsimonjr/mathts-functions';

/**
 * Digital filter design + application (gap analysis, remaining items). Reference
 * coefficients/outputs from scipy.signal (firwin, butter, lfilter, lfilter_zi,
 * filtfilt). butter's full zpk→bilinear→tf pipeline matches scipy to machine
 * precision; filtfilt reproduces scipy's steady-state (lfilter_zi) edge handling.
 */
const arrCloseTo = (a: number[], b: number[], d = 8) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));
};

describe('gap — filter design (vs scipy.signal)', () => {
  it('firwin — Hamming windowed-sinc lowpass, unit DC gain', () => {
    const h = firwin(11, 0.3);
    arrCloseTo(h, [
      -0.00521554, -0.00804016, 0.01335863, 0.10573869, 0.24054812, 0.30722052, 0.24054812,
      0.10573869, 0.01335863, -0.00804016, -0.00521554,
    ]);
    expect(h.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12); // unit DC gain
  });

  it('butter(4, 0.2) — coefficients match scipy exactly', () => {
    const { b, a } = butter(4, 0.2);
    arrCloseTo(b, [
      0.004824343357716229, 0.019297373430864916, 0.028946060146297373, 0.019297373430864916,
      0.004824343357716229,
    ]);
    arrCloseTo(a, [
      1, -2.369513007182038, 2.313988414415881, -1.054665405878568, 0.18737949236818502,
    ]);
  });

  it('lfilter — direct-form output matches scipy', () => {
    const x = [1, 2, 1, -1, -2, 0, 3, 1, -1, 0, 2, 1];
    arrCloseTo(lfilter([0.2, 0.2], [1, -0.5], x), [
      0.2, 0.7, 0.95, 0.475, -0.3625, -0.58125, 0.309375, 0.9546875, 0.47734375, 0.03867188,
      0.41933594, 0.80966797,
    ]);
  });

  it('lfilterZi — steady-state initial conditions match scipy.signal.lfilter_zi', () => {
    const { b, a } = butter(4, 0.2);
    arrCloseTo(lfilterZi(b, a), [
      0.9951756566422797, -1.3936347239706135, 0.8914076302989605, -0.18255514901046802,
    ]);
  });

  it('filtfilt — matches scipy.signal.filtfilt + passes a constant unchanged', () => {
    const { b, a } = butter(4, 0.2);
    // a constant input passes through unchanged (steady-state edge handling)
    filtfilt(b, a, new Array(40).fill(2.5)).forEach((v) => expect(v).toBeCloseTo(2.5, 9));
    // matches scipy on a deterministic sine (verified to ~5e-15)
    const x = Array.from({ length: 30 }, (_, i) => Math.sin(0.5 * i));
    const out = filtfilt(b, a, x);
    arrCloseTo(
      out.slice(0, 5),
      [0.0002124746, 0.4161685621, 0.7312372844, 0.8675545918, 0.7911558167],
      9
    );
  });
});
