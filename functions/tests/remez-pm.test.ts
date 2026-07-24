import { describe, it, expect } from 'vitest';
import { remez } from '../src/index.js';

// Oracle values from scipy.signal.remez (scipy 1.17.1). remez convention:
// band edges in [0, 0.5] (fs = 1, 0.5 = Nyquist); desired/weight one per band.
// The MathTS port is the same Parks-McClellan algorithm/grid as scipy, so taps
// match to machine precision — pinned here to 9 decimals.
const closeArr = (got: readonly number[], want: readonly number[], d = 9) => {
  expect(got).toHaveLength(want.length);
  want.forEach((v, i) => expect(got[i]).toBeCloseTo(v, d));
};

describe('remez — exact Parks-McClellan (scipy.signal.remez oracle)', () => {
  it('lowpass, numtaps=25 (Type I)', () => {
    const h = remez(25, [0, 0.2, 0.3, 0.5], [1, 0]);
    closeArr(
      h,
      [
        -3.542906235729504e-6, -0.007210505601037385, 4.633806275555763e-6, 0.013609942021924431,
        -6.907395110853365e-6, -0.026290426559711203, 9.171629409396864e-6, 0.04860054780976009,
        -7.810741260914078e-6, -0.09647113251596645, 9.930488328646625e-6, 0.3149944977511649,
        0.4999890502371873, 0.3149944977511649, 9.930488328646625e-6, -0.09647113251596645,
        -7.810741260914078e-6, 0.04860054780976009, 9.171629409396864e-6, -0.026290426559711203,
        -6.907395110853365e-6, 0.013609942021924431, 4.633806275555763e-6, -0.007210505601037385,
        -3.542906235729504e-6,
      ]
    );
  });

  it('highpass, numtaps=25 (Type I)', () => {
    const h = remez(25, [0, 0.2, 0.3, 0.5], [0, 1]);
    expect(h).toHaveLength(25);
    expect(h[12]).toBeCloseTo(0.5000109497628125, 9);
    expect(h[11]).toBeCloseTo(-0.3149944977511649, 9);
    h.forEach((v, i) => expect(v).toBeCloseTo(h[24 - i], 12)); // symmetric
  });

  it('bandpass, numtaps=31 (Type I)', () => {
    const h = remez(31, [0, 0.15, 0.2, 0.3, 0.35, 0.5], [0, 1, 0]);
    closeArr(
      h,
      [
        -9.147406062599435e-7, -0.013281574513542652, 4.508157943249271e-6, -0.022739190199763927,
        5.805675434863137e-6, 0.04476490682340339, 1.5322527371724655e-6, -0.038071561694244735,
        1.485055180727589e-6, -0.027086993123358546, 2.7170811218858413e-6, 0.1419324834959354,
        -4.879305426202447e-6, -0.25437641418362894, -1.0254176385552084e-5, 0.30129281950254994,
        -1.0254176385552084e-5, -0.25437641418362894, -4.879305426202447e-6, 0.1419324834959354,
        2.7170811218858413e-6, -0.027086993123358546, 1.485055180727589e-6, -0.038071561694244735,
        1.5322527371724655e-6, 0.04476490682340339, 5.805675434863137e-6, -0.022739190199763927,
        4.508157943249271e-6, -0.013281574513542652, -9.147406062599435e-7,
      ]
    );
  });

  it('multiband with per-band weights, numtaps=41 (Type I)', () => {
    const h = remez(41, [0, 0.1, 0.15, 0.25, 0.3, 0.4, 0.45, 0.5], [1, 0, 1, 0], [1, 2, 3, 4]);
    expect(h).toHaveLength(41);
    expect(h[20]).toBeCloseTo(0.5449103289307684, 9);
    expect(h[17]).toBeCloseTo(0.27154067623894035, 9);
    expect(h[0]).toBeCloseTo(0.005883805791953638, 9);
    h.forEach((v, i) => expect(v).toBeCloseTo(h[40 - i], 12)); // symmetric
  });

  it('lowpass with weighted stopband, numtaps=21', () => {
    const h = remez(21, [0, 0.2, 0.28, 0.5], [1, 0], [1, 5]);
    expect(h[10]).toBeCloseTo(0.4680321547450786, 9);
    expect(h[9]).toBeCloseTo(0.3131258611877612, 9);
  });

  it('even-length lowpass, numtaps=24 (Type II)', () => {
    const h = remez(24, [0, 0.2, 0.3, 0.5], [1, 0]);
    closeArr(
      h,
      [
        -0.0031978576704380186, -0.006365512788399281, 0.008609520980861207, 0.010853152592560705,
        -0.015911909508960216, -0.021302071362495994, 0.029651626563841873, 0.03979049776108792,
        -0.0567252283318537, -0.08385276767700063, 0.14689311445506656, 0.4485796421438776,
        0.4485796421438776, 0.14689311445506656, -0.08385276767700063, -0.0567252283318537,
        0.03979049776108792, 0.029651626563841873, -0.021302071362495994, -0.015911909508960216,
        0.010853152592560705, 0.008609520980861207, -0.006365512788399281, -0.0031978576704380186,
      ]
    );
  });

  it('hilbert transformer, numtaps=31 (Type III, antisymmetric)', () => {
    const h = remez(31, [0.05, 0.45], [1], undefined, 'hilbert');
    expect(h).toHaveLength(31);
    expect(h[14]).toBeCloseTo(0.6313536408821954, 9);
    expect(h[16]).toBeCloseTo(-0.6313536408821954, 9);
    h.forEach((v, i) => expect(v).toBeCloseTo(-h[30 - i], 10)); // antisymmetric
  });

  it('differentiator, numtaps=21 (Type III)', () => {
    const h = remez(21, [0, 0.5], [1], undefined, 'differentiator');
    expect(h[9]).toBeCloseTo(0.15949365337774726, 9);
    expect(h[0]).toBeCloseTo(-0.07363641989870447, 9);
    h.forEach((v, i) => expect(v).toBeCloseTo(-h[20 - i], 10)); // antisymmetric
  });

  it('rejects out-of-range band edges and mismatched desired length', () => {
    expect(() => remez(25, [0, 0.2, 0.3, 1], [1, 0])).toThrow(); // 1 > 0.5
    expect(() => remez(25, [0, 0.2, 0.3, 0.5], [1, 1, 0, 0])).toThrow(); // desired must be per-band
  });
});
