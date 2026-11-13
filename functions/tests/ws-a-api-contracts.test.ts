import { describe, it, expect } from 'vitest';
import { mod, lcm, evaluate, bignumber, fraction, solveODE } from '@danielsimonjr/mathts-functions';
import { mod as arithmeticMod } from '@danielsimonjr/mathts-arithmetic';
import { create, all } from '@danielsimonjr/mathts-compat';
import {
  cov,
  corrcoef,
  welchPSD,
  bartlettPSD,
  stft,
  istft,
  spectrogram,
  windowFunction,
  normalDist,
  betaDist,
  binomialDist,
  chiSquaredDist,
  exponentialDist,
  fDist,
  gammaDist,
  logNormalDist,
  poissonDist,
  tDist,
  uniformDist,
  weibullDist,
  hypergeometricDist,
  negativeBinomialDist,
  paretoDist,
  rayleighDist,
  triangularDist,
  discreteUniformDist,
  gumbelDist,
  invGaussDist,
} from '@danielsimonjr/mathts-functions';

/**
 * WS-A API contracts (issues #896, #897, #899, #900, #923 and the ODE message items).
 * Reference values come from NumPy / SciPy and are pinned here so CI needs no Python.
 */

const arrClose = (a: number[], b: number[], digits = 12): void => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
};

describe('#896 — cov / corrcoef rowvar option', () => {
  it('corrcoef default layout is observations as rows (rowvar=false), unchanged', () => {
    // 3 observations x 2 variables: columns are variables.
    const obs = [
      [1, 2],
      [2, 4],
      [3, 6],
    ];
    const r = corrcoef(obs);
    expect(r.length).toBe(2);
    expect(r[0].length).toBe(2);
    arrClose(r[0], [1, 1]);
    arrClose(r[1], [1, 1]);
  });

  it('corrcoef({ rowvar: true }) takes variables as rows (np.corrcoef([[1,2,3],[4,5,6]]))', () => {
    // NumPy: np.corrcoef([[1,2,3],[4,5,6]]) -> [[1,1],[1,1]], shape 2x2.
    const r = corrcoef(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      { rowvar: true }
    );
    expect(r.length).toBe(2);
    expect(r[0].length).toBe(2);
    arrClose(r[0], [1, 1]);
    arrClose(r[1], [1, 1]);
  });

  it('corrcoef({ rowvar: true }) matches the transpose of the default layout on 3 variables', () => {
    // Variables as rows: a, b, c. NumPy np.corrcoef(rows) gives the 3x3 Pearson matrix.
    const rows = [
      [1, 2, 3, 4, 5],
      [2, 1, 4, 3, 5],
      [5, 4, 3, 2, 1],
    ];
    const cols = rows[0].map((_, j) => rows.map((r) => r[j]));
    const byRows = corrcoef(rows, { rowvar: true });
    const byCols = corrcoef(cols);
    expect(byRows.length).toBe(3);
    for (let i = 0; i < 3; i++) arrClose(byRows[i], byCols[i]);
    expect(byRows[0][1]).toBeCloseTo(0.8, 12); // r = 8/10 for x=1..5, y=[2,1,4,3,5]
  });

  it('cov({ rowvar: true }) matches np.cov on variables as rows', () => {
    // np.cov([[1,2,3],[4,5,6]]) -> [[1,1],[1,1]] (ddof=1).
    const c = cov(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      undefined,
      1,
      { rowvar: true }
    ) as number[][];
    arrClose(c[0], [1, 1]);
    arrClose(c[1], [1, 1]);
  });

  it('cov default layout is unchanged (rowvar=false)', () => {
    const c = cov([
      [1, 2],
      [2, 4],
      [3, 6],
    ]) as number[][];
    arrClose(c[0], [1, 2]);
    arrClose(c[1], [2, 4]);
  });

  it('rowvar with the two-vector form throws (no silent ignore)', () => {
    expect(() => cov([1, 2, 3], [4, 5, 6], 1, { rowvar: true })).toThrow(/rowvar/);
  });

  it('rowvar: false is the default layout, so it is accepted with two vectors', () => {
    expect(cov([1, 2, 3], [4, 5, 6], 1, { rowvar: false })).toBeCloseTo(1, 12);
    expect(cov([1, 2, 3], [4, 5, 6], 1, {})).toBeCloseTo(1, 12);
  });

  it('ragged rows throw a RangeError that names the rows, in both layouts (no NaN)', () => {
    const ragged = [
      [1, 2, 3],
      [4, 5],
    ];
    expect(() => cov(ragged)).toThrow(RangeError);
    expect(() => cov(ragged)).toThrow(/row 1 has 2 values.*row 0 has 3/);
    expect(() => cov(ragged, undefined, 1, { rowvar: true })).toThrow(RangeError);
    expect(() => corrcoef(ragged)).toThrow(RangeError);
    expect(() => corrcoef(ragged, { rowvar: true })).toThrow(/row 1 has 2 values/);
    // A longer later row is ragged too (the old code read only row 0).
    expect(() =>
      cov([
        [1, 2],
        [3, 4, 5],
      ])
    ).toThrow(RangeError);
  });
});

describe('#899 — Distribution.sample(n)', () => {
  it('sample() with no argument returns one number (unchanged)', () => {
    const x = normalDist(0, 1).sample();
    expect(typeof x).toBe('number');
  });

  it('sample(5) returns a Float64Array of length 5 (not one number)', () => {
    const out = normalDist(0, 1).sample(5) as unknown as Float64Array;
    expect(out).toBeInstanceOf(Float64Array);
    expect(out.length).toBe(5);
  });

  it('sample(1) returns a length-1 Float64Array, so the shape never depends on n', () => {
    const out = normalDist(0, 1).sample(1) as unknown as Float64Array;
    expect(out).toBeInstanceOf(Float64Array);
    expect(out.length).toBe(1);
  });

  it('sample(0) returns an empty Float64Array', () => {
    const out = normalDist(0, 1).sample(0) as unknown as Float64Array;
    expect(out.length).toBe(0);
  });

  it('rejects a negative, fractional or non-finite count with RangeError', () => {
    const d = normalDist(0, 1);
    expect(() => d.sample(-1)).toThrow(RangeError);
    expect(() => d.sample(1.5)).toThrow(RangeError);
    expect(() => d.sample(Number.NaN)).toThrow(RangeError);
  });

  it('a count above 2**26 throws RangeError before any allocation (no hang), on every factory', () => {
    // 2**26 values is a 512 MiB Float64Array. Only the first count above the limit is tried:
    // a count at the limit would allocate it. Before the limit, sample(2**31) never returned.
    const tooMany = 2 ** 26 + 1;
    const d = normalDist(0, 1);
    expect(() => d.sample(tooMany)).toThrow(RangeError);
    expect(() => d.sample(tooMany)).toThrow(/2\*\*26 \(67108864\)/);
    expect(() => d.sample(tooMany)).toThrow(/sampleN/);
    expect(() => d.sample(2 ** 31)).toThrow(RangeError);
    expect(() => d.sample(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    for (const dist of [
      betaDist(2, 3),
      binomialDist(10, 0.5),
      poissonDist(3),
      discreteUniformDist(1, 6),
      invGaussDist(1, 2),
    ]) {
      expect(() => dist.sample(tooMany)).toThrow(RangeError);
    }
  });

  it('a second argument throws TypeError instead of being ignored', () => {
    const d = normalDist(0, 1) as unknown as { sample: (n?: number, o?: unknown) => unknown };
    expect(() => d.sample(5, { seed: 1 })).toThrow(TypeError);
    expect(() => d.sample(5, { seed: 1 })).toThrow(/sampleN/);
  });

  it('every distribution factory returns n values from sample(n)', () => {
    const factories: Array<[string, { sample: (n: number) => unknown }]> = [
      ['normalDist', normalDist(0, 1)],
      ['betaDist', betaDist(2, 3)],
      ['binomialDist', binomialDist(10, 0.5)],
      ['chiSquaredDist', chiSquaredDist(3)],
      ['exponentialDist', exponentialDist(1)],
      ['fDist', fDist(3, 4)],
      ['gammaDist', gammaDist(2, 1)],
      ['logNormalDist', logNormalDist(0, 1)],
      ['poissonDist', poissonDist(3)],
      ['tDist', tDist(5)],
      ['uniformDist', uniformDist(0, 1)],
      ['weibullDist', weibullDist(2, 1)],
      ['hypergeometricDist', hypergeometricDist(50, 5, 10)],
      ['negativeBinomialDist', negativeBinomialDist(3, 0.5)],
      ['paretoDist', paretoDist(1, 2)],
      ['rayleighDist', rayleighDist(1)],
      ['triangularDist', triangularDist(0, 0.5, 1)],
      ['discreteUniformDist', discreteUniformDist(1, 6)],
      ['gumbelDist', gumbelDist(0, 1)],
      ['invGaussDist', invGaussDist(1, 2)],
    ];
    for (const [name, d] of factories) {
      const out = d.sample(3) as Float64Array;
      expect(out.length, name).toBe(3);
      expect(typeof d.sample(), name).toBe('number');
    }
  });

  it('gamma: positional second argument is rate; { scale } is the scale form (characterization)', () => {
    // shape 2, rate 2 -> mean 1 ; shape 2, scale 2 -> mean 4.
    expect(gammaDist(2, 2).mean).toBeCloseTo(1, 12);
    expect(gammaDist(2, { scale: 2 }).mean).toBeCloseTo(4, 12);
    expect(gammaDist({ shape: 2, scale: 2 }).mean).toBeCloseTo(4, 12);
  });
});

describe('#897 — PSD and STFT frame length clamps to n when defaulted', () => {
  const tone = (n: number, bin: number): number[] =>
    Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * bin * i) / n));

  const peakIndex = (a: number[]): number => a.reduce((m, v, i, arr) => (v > arr[m] ? i : m), 0);

  it('welchPSD with a 64-sample signal and no frameLength returns a spectrum (not a throw)', () => {
    const r = welchPSD(tone(64, 4));
    expect(r.frameLength).toBe(64);
    expect(r.psd.length).toBe(33); // 64/2 + 1, the SciPy nperseg=64 bin count
    expect(r.frequencies.length).toBe(33);
  });

  it('defaulted welchPSD equals the explicit clamp frameLength: n', () => {
    const x = tone(64, 4);
    expect(welchPSD(x).psd).toEqual(welchPSD(x, { frameLength: 64 }).psd);
  });

  it('bartlettPSD with a 64-sample signal and no frameLength clamps to 64', () => {
    const r = bartlettPSD(tone(64, 4));
    expect(r.frameLength).toBe(64);
    expect(r.psd.length).toBe(33);
  });

  it('a non-power-of-two clamped frame puts the tone at the right frequency (n = 100)', () => {
    const r = welchPSD(tone(100, 4));
    expect(r.frameLength).toBe(100);
    expect(r.frequencies[peakIndex(r.psd)]).toBeCloseTo(4 / 100, 12);
  });

  it('an explicit frameLength greater than n still throws RangeError', () => {
    expect(() => welchPSD(tone(64, 4), { frameLength: 256 })).toThrow(RangeError);
    expect(() => bartlettPSD(tone(64, 4), { frameLength: 256 })).toThrow(RangeError);
  });

  it('an explicit overlap >= the clamped frame throws instead of returning []', () => {
    expect(() => welchPSD(tone(64, 4), { overlap: 64 })).toThrow(RangeError);
  });

  it('stft with a short signal and no nperseg clamps; an explicit nperseg > n throws', () => {
    const x = tone(64, 4);
    const s = stft(x);
    expect(s.re.length).toBeGreaterThan(0);
    expect(s.re[0].length).toBe(64); // stft keeps every bin of the frame
    expect(() => stft(x, { nperseg: 256 })).toThrow(RangeError);
  });

  it('istft inverts a defaulted stft of a short signal', () => {
    const x = tone(64, 4);
    const y = istft(stft(x));
    expect(y.length).toBe(x.length);
    for (let i = 8; i < 56; i++) expect(y[i]).toBeCloseTo(x[i], 9);
  });
});

describe('#897 — STFT and spectrogram frames of any length', () => {
  const tone = (n: number, bin: number, period = n): number[] =>
    Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * bin * i) / period));

  /** The DFT of one windowed frame, from the definition: the reference for the exact-length path. */
  const referenceFrame = (
    x: number[],
    start: number,
    nperseg: number
  ): { re: number[]; im: number[] } => {
    const win = windowFunction(nperseg, 'hann');
    const re: number[] = [];
    const im: number[] = [];
    for (let k = 0; k < nperseg; k++) {
      let a = 0;
      let b = 0;
      for (let i = 0; i < nperseg; i++) {
        const v = x[start + i] * win[i];
        a += v * Math.cos((2 * Math.PI * k * i) / nperseg);
        b -= v * Math.sin((2 * Math.PI * k * i) / nperseg);
      }
      re.push(a);
      im.push(b);
    }
    return { re, im };
  };

  it('stft and istft of an empty signal are empty (no nperseg check on no data)', () => {
    expect(stft([])).toEqual({ re: [], im: [] });
    expect(stft([], { nperseg: 16 })).toEqual({ re: [], im: [] });
    expect(istft({ re: [], im: [] })).toEqual([]);
  });

  it('a non-power-of-two nperseg gives nperseg bins per frame, equal to the DFT of the frame', () => {
    const x = tone(400, 4, 100);
    const S = stft(x, { nperseg: 100 });
    expect(S.re.length).toBe(7); // starts 0, 50, ..., 300
    for (let f = 0; f < S.re.length; f++) {
      expect(S.re[f].length).toBe(100);
      expect(S.im[f].length).toBe(100);
    }
    const ref = referenceFrame(x, 100, 100);
    arrClose(S.re[2], ref.re, 9);
    arrClose(S.im[2], ref.im, 9);
    const mag = S.re[2].map((r, k) => Math.hypot(r, S.im[2][k])).slice(0, 51);
    expect(mag.indexOf(Math.max(...mag))).toBe(4); // bin k is at k / 100, not k / 128
  });

  it('a large odd frame keeps the DFT accurate (the chirp phase is reduced before it is evaluated)', () => {
    const n = 4093; // prime: Bluestein length 8192, chirp angle up to pi * n
    const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.37) + Math.cos(i * i * 1e-3));
    const S = stft(x, { nperseg: n });
    const win = windowFunction(n, 'hann');
    for (const k of [0, 1, 7, 1000, 2046, 2047, 4092]) {
      let a = 0;
      let b = 0;
      for (let i = 0; i < n; i++) {
        const ang = (2 * Math.PI * ((k * i) % n)) / n;
        a += x[i] * win[i] * Math.cos(ang);
        b -= x[i] * win[i] * Math.sin(ang);
      }
      expect(Math.abs(S.re[0][k] - a)).toBeLessThan(6e-12);
      expect(Math.abs(S.im[0][k] - b)).toBeLessThan(6e-12);
    }
  });

  it('the default istft(stft(x)) reconstructs a signal whose default frame is not a power of two', () => {
    const x = tone(200, 3).map((v, i) => v + 0.01 * i); // nperseg defaults to 200
    const S = stft(x);
    expect(S.re[0].length).toBe(200);
    const y = istft(S);
    expect(y.length).toBe(200);
    for (let i = 5; i < 195; i++) expect(Math.abs(y[i] - x[i])).toBeLessThan(1e-9);
  });

  it('istft reads the frame width, so an explicit odd nperseg round-trips with a default call', () => {
    const x = tone(300, 5, 70).map((v, i) => v + Math.cos(i / 9));
    const S = stft(x, { nperseg: 7, noverlap: 4 });
    expect(S.re[0].length).toBe(7);
    const y = istft(S, { noverlap: 4 });
    expect(y.length).toBeGreaterThanOrEqual(298);
    for (let i = 8; i < 290; i++) expect(Math.abs(y[i] - x[i])).toBeLessThan(1e-9);
  });

  it('istft throws when its frame width disagrees with an explicit nperseg', () => {
    const S = stft(tone(64, 4), { nperseg: 16 });
    expect(() => istft(S, { nperseg: 32 })).toThrow(RangeError);
  });

  it('spectrogram clamps a defaulted windowSize to the signal and finds the tone', () => {
    const r = spectrogram(tone(100, 4));
    expect(r.magnitude.length).toBe(1);
    expect(r.times).toEqual([50]);
    expect(r.frequencies.length).toBe(65); // nfft 128: the window is zero-padded, bins are i / 128
    const row = r.magnitude[0];
    expect(Math.abs(r.frequencies[row.indexOf(Math.max(...row))] - 0.04)).toBeLessThan(1 / 128);
  });

  it('spectrogram with an explicit windowSize above n stays empty (pinned behavior)', () => {
    expect(spectrogram([1, 2, 3], { windowSize: 8 }).magnitude).toEqual([]);
  });

  it('spectrogram of an empty signal is empty; tiny signals and windows terminate', () => {
    expect(spectrogram([]).magnitude).toEqual([]);
    expect(spectrogram([1]).magnitude.length).toBe(1);
    // The default hop of a 1-sample window is floor(1 / 2) = 0, which never advanced.
    expect(spectrogram([1, 2, 3], { windowSize: 1 }).magnitude.length).toBe(3);
  });

  it('spectrogram rejects a hopSize or windowSize below 1 instead of looping forever', () => {
    expect(() => spectrogram([1, 2, 3, 4], { windowSize: 2, hopSize: 0 })).toThrow(RangeError);
    expect(() => spectrogram([1, 2, 3, 4], { windowSize: 2, hopSize: 1.5 })).toThrow(RangeError);
    expect(() => spectrogram([1, 2, 3, 4], { windowSize: 0 })).toThrow(RangeError);
  });

  it('empty and one-sample signals do not hang stft, welchPSD or bartlettPSD', () => {
    expect(welchPSD([]).psd).toEqual([]);
    expect(bartlettPSD([]).psd).toEqual([]);
    expect(stft([1]).re).toEqual([[1]]);
    expect(() => welchPSD([1])).toThrow(RangeError);
  });
});

describe('#923 — mod(x, 0) returns x (mathjs rule), on every path', () => {
  it('public mod on numbers returns the dividend', () => {
    expect(mod(10, 0)).toBe(10);
    expect(mod(-7, 0)).toBe(-7);
  });

  it('public mod on bigint returns the dividend (typed path threw "Division by zero")', () => {
    expect(mod(10n, 0n)).toBe(10n);
  });

  it('evaluate("mod(10,0)") and the % operator return 10', () => {
    expect(evaluate('mod(10,0)')).toBe(10);
    expect(evaluate('10 % 0')).toBe(10);
  });

  it('lcm with a zero argument is 0 (typed path returned NaN / threw), matching factory lcm', () => {
    expect(lcm(0, 0)).toBe(0);
    expect(lcm(0n, 0n)).toBe(0n);
    expect(lcm(4, 0)).toBe(0);
  });

  it('the arithmetic package re-exports the same rule', () => {
    expect(arithmeticMod(10, 0)).toBe(10);
  });

  it('compat create(all).mod returns the dividend', () => {
    const math = create(all);
    expect(math.mod(10, 0)).toBe(10);
  });

  it('BigNumber and Fraction zero divisor return the dividend', () => {
    expect(mod(bignumber(10), bignumber(0)).toString()).toBe('10');
    expect(mod(fraction(10), fraction(0)).toString()).toBe('10');
  });
});

describe('ODE maxIter message names the stiff drivers neutrally (WS-A)', () => {
  it('RK45 maxIter exhaustion on a stiff run names BDF, Radau, Rosenbrock and RODAS as options', () => {
    // Robertson-type kinetics: explicit RK rejects steps and stops short of tFinal.
    const robertson = (_t: number, y: number[]): number[] => [
      -0.04 * y[0] + 1e4 * y[1] * y[2],
      0.04 * y[0] - 1e4 * y[1] * y[2] - 3e7 * y[1] * y[1],
      3e7 * y[1] * y[1],
    ];
    let message = '';
    try {
      solveODE(robertson, [0, 40], [1, 0, 0], { method: 'RK45', maxIter: 5 });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/solveODE RK45: exceeded maxIter=5 /);
    for (const name of ['BDF', 'Radau', 'Rosenbrock', 'RODAS']) expect(message).toContain(name);
    expect(message).not.toMatch(/often indicates a stiff system/);
    expect(message).toMatch(/If the system is stiff/);
  });
});

describe('solveODE sol.y layout (WS-A documentation)', () => {
  it('sol.y[i] is the state vector (length of y0) at sol.t[i]', () => {
    const sol = solveODE((_t: number, y: number[]) => [y[1], -y[0]], [0, 1], [1, 0], { tol: 1e-8 });
    expect(sol.y.length).toBe(sol.t.length);
    for (const row of sol.y) expect(row.length).toBe(2);
    // y0 = [1, 0] is the state at t[0]; the first oscillator state is cos(t).
    expect(sol.t[0]).toBe(0);
    expect(sol.y[0]).toEqual([1, 0]);
    const last = sol.t.length - 1;
    expect(sol.y[last][0]).toBeCloseTo(Math.cos(sol.t[last]), 6);
  });
});
