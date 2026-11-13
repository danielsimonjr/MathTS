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
