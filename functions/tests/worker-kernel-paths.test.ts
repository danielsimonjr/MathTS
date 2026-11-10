/**
 * The typed Float64Array signatures of special, distributions, fft2d and spectrogram are
 * synchronous. Callers who want worker threads use a public, documented path. These tests
 * prove, for each family, that the path reaches the workers (`parallelized === true`) and
 * gives the synchronous result bit for bit (Object.is on every element).
 *
 * The pool must be ready: the tests fail, and do not skip, when it is not.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import * as fns from '../src/index.js';
import { workerKernel } from '../src/index.js';

const N = 65536; // above the 50 000-element worker threshold

/** A deterministic array in [lo, hi). */
function data(lo: number, hi: number, int = false): Float64Array {
  const a = new Float64Array(N);
  let s = 12345;
  for (let i = 0; i < N; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const v = lo + ((hi - lo) * s) / 2147483648;
    a[i] = int ? Math.floor(v) : v;
  }
  return a;
}

/** Count the elements where Object.is fails. 0 means bit for bit equal. */
function mismatches(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return -1;
  let bad = 0;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) bad++;
  return bad;
}

type Call = (x: Float64Array) => unknown;
const fn = (name: string) => (fns as unknown as Record<string, (...a: unknown[]) => unknown>)[name];

// name -> [kernel parameters, sync call, data]
const PLAIN = (name: string, x: Float64Array): [number[], Call, Float64Array] => [
  [],
  (v) => fn(name)(v),
  x,
];
const LEAD = (name: string, p: number[], x: Float64Array): [number[], Call, Float64Array] => [
  p,
  (v) => fn(name)(...p, v),
  x,
];
const TRAIL = (name: string, p: number[], x: Float64Array): [number[], Call, Float64Array] => [
  p,
  (v) => fn(name)(v, ...p),
  x,
];

const pos = data(0.1, 5);
const unit = data(-1, 1);
const m = data(0, 0.99);
const p01 = data(0.01, 0.99);
const k = data(0, 20, true);
const k01 = data(0, 2, true);

const SPECIAL: Record<string, [number[], Call, Float64Array]> = {
  erfc: PLAIN('erfc', data(-4, 4)),
  erfi: PLAIN('erfi', data(-2, 2)),
  lgamma: PLAIN('lgamma', pos),
  beta: TRAIL('beta', [2.5], pos),
  gammainc: LEAD('gammainc', [2.5], pos),
  gammaincp: LEAD('gammaincp', [2.5], pos),
  betainc: LEAD('betainc', [2, 3], p01),
  digamma: PLAIN('digamma', pos),
  besselJ0: PLAIN('besselJ0', data(0, 30)),
  besselJ1: PLAIN('besselJ1', data(0, 30)),
  besselY0: PLAIN('besselY0', pos),
  besselY1: PLAIN('besselY1', pos),
  besselJ: LEAD('besselJ', [2.5], pos),
  besselY: LEAD('besselY', [2.5], pos),
  besselI: LEAD('besselI', [2], pos),
  besselK: LEAD('besselK', [1], pos),
  ellipticK: PLAIN('ellipticK', m),
  ellipticE: PLAIN('ellipticE', m),
  chebyshevT: LEAD('chebyshevT', [5], unit),
  hermiteH: LEAD('hermiteH', [5], unit),
  laguerreL: LEAD('laguerreL', [5], pos),
  legendreP: LEAD('legendreP', [5], unit),
  lambertW: PLAIN('lambertW', pos),
  cosIntegral: PLAIN('cosIntegral', pos),
  sinIntegral: PLAIN('sinIntegral', pos),
  logIntegral: PLAIN('logIntegral', data(1.5, 10)),
  expIntegralEi: PLAIN('expIntegralEi', pos),
  fresnelC: PLAIN('fresnelC', pos),
  fresnelS: PLAIN('fresnelS', pos),
  airyAi: PLAIN('airyAi', data(-5, 5)),
  airyBi: PLAIN('airyBi', data(-5, 5)),
};

const DISTRIBUTIONS: Record<string, [number[], Call, Float64Array]> = {
  normalPDF: TRAIL('normalPDF', [1, 2], data(-5, 5)),
  normalCDF: TRAIL('normalCDF', [1, 2], data(-5, 5)),
  exponentialPDF: TRAIL('exponentialPDF', [1.5], pos),
  exponentialCDF: TRAIL('exponentialCDF', [1.5], pos),
  poissonPMF: TRAIL('poissonPMF', [3], k),
  binomialPMF: TRAIL('binomialPMF', [20, 0.3], k),
  geometricPMF: TRAIL('geometricPMF', [0.3], k),
  bernoulliPMF: TRAIL('bernoulliPMF', [0.3], k01),
};

beforeAll(async () => {
  await computePool.initialize();
  // Fail, do not skip: without a ready pool these tests prove nothing.
  expect(computePool.isReady()).toBe(true);
});

afterAll(async () => {
  await computePool.terminate();
});

async function viaWorkers(name: string, params: number[], x: Float64Array) {
  return computePool.applyKernel(x, workerKernel(name, ...params));
}

describe('special: computePool.applyKernel(x, workerKernel(name, ...params))', () => {
  for (const [name, [params, sync, x]] of Object.entries(SPECIAL)) {
    it(`${name} reaches the workers and equals the sync result`, async () => {
      const r = await viaWorkers(name, params, x);
      expect(r.parallelized).toBe(true);
      expect(mismatches(r.result, sync(x) as Float64Array)).toBe(0);
    });
  }
});

describe('distributions: computePool.applyKernel(x, workerKernel(name, ...params))', () => {
  for (const [name, [params, sync, x]] of Object.entries(DISTRIBUTIONS)) {
    it(`${name} reaches the workers and equals the sync result`, async () => {
      const r = await viaWorkers(name, params, x);
      expect(r.parallelized).toBe(true);
      expect(mismatches(r.result, sync(x) as Float64Array)).toBe(0);
    });
  }

  it('normalCDF with no parameters uses mu = 0, sigma = 1', async () => {
    const x = data(-5, 5);
    const r = await computePool.applyKernel(x, workerKernel('normalCDF'));
    expect(r.parallelized).toBe(true);
    expect(mismatches(r.result, fns.normalCDF(x) as Float64Array)).toBe(0);
  });
});

describe('workerKernel', () => {
  it('names every element-wise special and distribution kernel', () => {
    for (const name of [...Object.keys(SPECIAL), ...Object.keys(DISTRIBUTIONS)]) {
      expect(typeof workerKernel(name, ...(SPECIAL[name] ?? DISTRIBUTIONS[name])[0])).toBe(
        'string'
      );
    }
  });

  it('refuses an unknown name, too many parameters and a non-number parameter', () => {
    expect(() => workerKernel('nope')).toThrow(/unknown kernel "nope"/);
    expect(() => workerKernel('erfc', 1)).toThrow(/takes 0 parameters, got 1/);
    expect(() => workerKernel('besselK', '1); evil(' as unknown as number)).toThrow(TypeError);
  });

  it('refuses too few parameters', () => {
    expect(() => workerKernel('besselK')).toThrow(/"besselK" takes 1 parameters, got 0/);
    expect(() => workerKernel('betainc', 2)).toThrow(/"betainc" takes 2 parameters, got 1/);
    expect(() => workerKernel('normalCDF', 0, 1, 2)).toThrow(/takes 0 to 2 parameters, got 3/);
  });

  it('passes NaN and Infinity parameters to the workers as the sync call does', async () => {
    const x = data(0.1, 5);
    for (const n of [NaN, Infinity, -Infinity]) {
      const r = await computePool.applyKernel(x, workerKernel('besselK', n));
      expect(r.parallelized).toBe(true);
      expect(mismatches(r.result, fns.besselK(n, x) as Float64Array)).toBe(0);
    }
    const r = await computePool.applyKernel(x, workerKernel('normalCDF', NaN, Infinity));
    expect(mismatches(r.result, fns.normalCDF(x, NaN, Infinity) as Float64Array)).toBe(0);
  });

  it('keeps the sign of a -0 parameter', () => {
    expect(workerKernel('besselK', -0)).toContain('besselKScalar(-0, x)');
  });
});

describe('fft2d and spectrogram: computePool.fftBatch', () => {
  it('fft2d equals two fftBatch passes (rows, then columns) bit for bit', async () => {
    const R = 256;
    const C = 256;
    const flat = data(-1, 1);
    const x = Array.from({ length: R }, (_, r) => Array.from(flat.subarray(r * C, (r + 1) * C)));
    const sync = fns.fft2d(x);

    const rows = await computePool.fftBatch(Float64Array.from(flat), new Float64Array(R * C), R, C);
    expect(rows.parallelized).toBe(true);
    const cr = new Float64Array(R * C);
    const ci = new Float64Array(R * C);
    for (let c = 0; c < C; c++) {
      for (let r = 0; r < R; r++) {
        cr[c * R + r] = rows.result.real[r * C + c];
        ci[c * R + r] = rows.result.imag[r * C + c];
      }
    }
    const cols = await computePool.fftBatch(cr, ci, C, R);
    expect(cols.parallelized).toBe(true);

    let bad = 0;
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        if (!Object.is(sync.real[r][c], cols.result.real[c * R + r])) bad++;
        if (!Object.is(sync.imag[r][c], cols.result.imag[c * R + r])) bad++;
      }
    }
    expect(bad).toBe(0);
  });

  it('spectrogram equals windowed frames through fftBatch bit for bit', async () => {
    const W = 256;
    const signal = Array.from(data(-1, 1));
    const sync = fns.spectrogram(signal, { windowSize: W, hopSize: W });
    const frames = sync.magnitude.length;
    const win = fns.windowFunction(W, 'hann');

    const re = new Float64Array(frames * W);
    for (let f = 0; f < frames; f++) {
      for (let i = 0; i < W; i++) re[f * W + i] = signal[f * W + i] * win[i];
    }
    const r = await computePool.fftBatch(re, new Float64Array(frames * W), frames, W);
    expect(r.parallelized).toBe(true);

    let bad = 0;
    for (let f = 0; f < frames; f++) {
      for (let i = 0; i <= W / 2; i++) {
        const a = r.result.real[f * W + i];
        const b = r.result.imag[f * W + i];
        if (!Object.is(sync.magnitude[f][i], Math.sqrt(a ** 2 + b ** 2))) bad++;
      }
    }
    expect(bad).toBe(0);
  });
});
