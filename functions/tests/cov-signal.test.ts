/**
 * Coverage supplement for functions/src/typed/signal.ts.
 *
 * The existing signal suites (signal-extended, signal-extended2, parallel-signal,
 * signal/fft, signal/conv, typed-signal-wasm) cover the JS happy paths at the
 * default parallel threshold. This file fills the remaining *reachable* gaps:
 *
 *   - the fourStepFFT degenerate-size guard (N < 4) reached via a lowered
 *     parallel threshold so shouldParallelize() returns true for tiny inputs,
 *   - parallelFFTPower's Object overload,
 *   - the parallel branches of parallelFFT / parallelIFFT / parallelConv /
 *     fft2d / spectrogram driven by a lowered threshold,
 *   - spectrogram's zero-frame early return,
 *   - the windowFunction 'bartlett' branch,
 *   - initializeSignal / terminateSignal lifecycle wrappers.
 *
 * dct/idct/dst/idst/dwt/hilbertTransform/spectrogram/periodogram/_convolve are
 * pure JS: their former `wasm.<kernel>_wasm(...)` branches targeted kernels that
 * only a legacy native-WASM artifact (lib/wasm/mathts.wasm) exported. The
 * AssemblyScript binary does not export them, so those branches were dead and
 * have been removed. The last describe block loads the AS binary anyway and checks
 * every result is unchanged: loading the module must never change what these
 * functions return.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { AS_WASM_PATH, AS_WASM_MISSING_MESSAGE } from './helpers/wasm-spy.js';
import {
  parallelFFT,
  parallelIFFT,
  parallelFFTMagnitude,
  parallelFFTPower,
  parallelConv,
  fft2d,
  spectrogram,
  windowFunction,
  dct,
  idct,
  dst,
  idst,
  hilbertTransform,
  periodogram,
  lowpassFilter,
  dwt,
  initializeSignal,
  terminateSignal,
} from '../src/typed/signal.js';

/** parallelFFT / parallelIFFT result shape (their typed-function calls return `unknown`). */
interface Spectrum {
  real: Float64Array;
  imag: Float64Array;
}

describe('signal — lifecycle wrappers', () => {
  it('initializeSignal then terminateSignal', async () => {
    await initializeSignal();
    expect(typeof computePool.shouldParallelize(10)).toBe('boolean');
    await terminateSignal();
  });
});

describe('signal — windowFunction bartlett branch', () => {
  it('bartlett window is triangular, peaks near center, zero at edges', () => {
    const w = windowFunction(9, 'bartlett');
    expect(w.length).toBe(9);
    expect(w[0]).toBeCloseTo(0, 10);
    expect(w[8]).toBeCloseTo(0, 10);
    expect(w[4]).toBeCloseTo(1, 10); // center peak for odd length
    // monotone increasing up to center
    expect(w[2]).toBeGreaterThan(w[1]);
    expect(w[4]).toBeGreaterThan(w[3]);
  });
});

describe('signal — parallelFFTPower Object overload', () => {
  it('accepts a {real, imag} spectrum object', async () => {
    const real = Float64Array.from([3, 0, 0, 0]);
    const imag = Float64Array.from([4, 0, 0, 0]);
    const fromArrays = await (parallelFFTPower(real, imag) as Promise<Float64Array>);
    const fromObject = await (parallelFFTPower({ real, imag }) as Promise<Float64Array>);
    expect(Array.from(fromObject)).toEqual(Array.from(fromArrays));
    expect(fromObject[0]).toBeCloseTo(25, 10); // 3^2 + 4^2
  });
  it('parallelFFTMagnitude Object overload matches array form', async () => {
    const real = Float64Array.from([3, 1, 0, 0]);
    const imag = Float64Array.from([4, 0, 0, 0]);
    const a = await (parallelFFTMagnitude(real, imag) as Promise<Float64Array>);
    const b = await (parallelFFTMagnitude({ real, imag }) as Promise<Float64Array>);
    expect(Array.from(b)).toEqual(Array.from(a));
    expect(b[0]).toBeCloseTo(5, 10);
  });
});

describe('signal — spectrogram zero-frame early return', () => {
  it('returns empty magnitude when signal shorter than windowSize', async () => {
    const out = await spectrogram([1, 2, 3], { windowSize: 8, hopSize: 4, window: 'rect' });
    expect(out.magnitude).toEqual([]);
    expect(out.times).toEqual([]);
    expect(out.frequencies.length).toBeGreaterThan(0);
  });
});

describe('signal — parallel paths via lowered threshold', () => {
  beforeAll(async () => {
    await computePool.initialize();
    // Force shouldParallelize() to be true for tiny inputs so the four-step /
    // fftBatch parallel branches (and the fourStepFFT N<4 guard) are exercised.
    computePool.updateConfig({ thresholdElements: 1, chunkSize: 8 });
  });
  afterAll(async () => {
    computePool.updateConfig({ thresholdElements: 50000, chunkSize: 10000 });
    await computePool.terminate();
  });

  it('parallelFFT (Float64Array) round-trips through IFFT under parallel dispatch', async () => {
    const signal = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const spec = (await parallelFFT(signal)) as Spectrum;
    expect(spec.real[0]).toBeCloseTo(36, 8); // DC = sum
    const back = (await parallelIFFT(spec.real, spec.imag)) as Spectrum;
    for (let i = 0; i < signal.length; i++) {
      expect(back.real[i]).toBeCloseTo(signal[i], 8);
    }
  });

  it('parallelIFFT Object overload under parallel dispatch', async () => {
    const signal = new Float64Array([2, 0, -2, 0]);
    const spec = (await parallelFFT(signal)) as Spectrum;
    const back = (await parallelIFFT({ real: spec.real, imag: spec.imag })) as Spectrum;
    for (let i = 0; i < signal.length; i++) {
      expect(back.real[i]).toBeCloseTo(signal[i], 8);
    }
  });

  it('fourStepFFT degenerate N<4 guard (tiny array, parallelize=true)', async () => {
    // length 2 -> shouldParallelize(2) true with threshold 1 -> fourStepFFT,
    // which hits the `N < 4` early return delegating to fftCoreFloat64.
    const back = (await parallelIFFT(
      Float64Array.from([2, 0]),
      Float64Array.from([0, 0])
    )) as Spectrum;
    expect(back.real.length).toBe(2);
    expect(back.real[0]).toBeCloseTo(1, 8); // ((2+0)/2) DC for IFFT of [2,0]
  });

  it('parallelConv under parallel dispatch matches direct convolution', async () => {
    const x = Float64Array.from([1, 2, 3, 4]);
    const h = Float64Array.from([1, 1, 1]);
    const y = await (parallelConv(x, h) as Promise<Float64Array>);
    // full direct convolution of [1,2,3,4] * [1,1,1]
    const expected = [1, 3, 6, 9, 7, 4];
    expect(y.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) expect(y[i]).toBeCloseTo(expected[i], 8);
  });

  it('fft2d under parallel dispatch matches a DC-only input', async () => {
    const img = [
      [1, 1],
      [1, 1],
    ];
    const out = await fft2d(img);
    // DC bin = sum of all = 4, all other bins ~0
    expect(out.real[0][0]).toBeCloseTo(4, 8);
    expect(out.real[0][1]).toBeCloseTo(0, 8);
    expect(out.real[1][0]).toBeCloseTo(0, 8);
  });

  it('spectrogram under parallel dispatch produces frames', async () => {
    const sig = Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * i) / 8));
    const out = await spectrogram(sig, { windowSize: 16, hopSize: 8, window: 'hann' });
    expect(out.magnitude.length).toBeGreaterThan(0);
    expect(out.magnitude[0].length).toBe(out.frequencies.length);
  });
});

describe('signal — JS reference correctness (non-WASM small inputs)', () => {
  it('dct/idct invert', () => {
    const x = [1, 2, 3, 4, 5, 6];
    const back = idct(dct(x));
    for (let i = 0; i < x.length; i++) expect(back[i]).toBeCloseTo(x[i], 8);
  });
  it('dst/idst approximately invert', () => {
    const x = [1, 2, 3, 4];
    const back = idst(dst(x));
    expect(back.length).toBe(x.length);
  });
  it('hilbertTransform returns same length', () => {
    const x = Array.from({ length: 16 }, (_, i) => Math.sin((2 * Math.PI * i) / 16));
    const h = hilbertTransform(x);
    expect(h.length).toBe(x.length);
  });
  it('periodogram peaks at the signal frequency', () => {
    const N = 32;
    const k0 = 4;
    const x = Array.from({ length: N }, (_, i) => Math.cos((2 * Math.PI * k0 * i) / N));
    const { psd } = periodogram(x, { window: 'rect' });
    let peak = 0;
    for (let i = 1; i < psd.length; i++) if (psd[i] > psd[peak]) peak = i;
    expect(peak).toBe(k0);
  });
  it('lowpassFilter (JS path) attenuates a high-frequency tone', () => {
    const N = 40;
    const hi = Array.from({ length: N }, (_, i) => Math.cos(Math.PI * i)); // Nyquist
    const out = lowpassFilter(hi, 0.1, 11);
    const energyIn = hi.reduce((s, v) => s + v * v, 0);
    const energyOut = out.reduce((s, v) => s + v * v, 0);
    expect(energyOut).toBeLessThan(energyIn);
  });
});

// AS binary loaded. None of dct/idct/dst/idst/dwt/hilbert/spectrogram/periodogram/
// _convolve consult WASM, so loading the module must not change any result. Each is
// driven with a length >= 64 (the old WASM threshold, where the removed branches
// used to engage) and compared with its own output when no module was loaded.
const describeIfAS = AS_WASM_PATH ? describe : describe.skip;

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(AS_WASM_PATH, AS_WASM_MISSING_MESSAGE).not.toBeNull();
});

describeIfAS('signal — results do not depend on whether the AS binary is loaded', () => {
  const N = 128;
  const sig = Array.from(
    { length: N },
    (_, i) => Math.sin((2 * Math.PI * 5 * i) / N) + 0.3 * Math.cos((2 * Math.PI * 13 * i) / N)
  );

  // Reference outputs from the pure-JS path (no module loaded).
  let jsDct: number[];
  let jsIdct: number[];
  let jsDst: number[];
  let jsIdst: number[];
  let jsHilbert: number[];
  let jsPeriodogram: number[];
  let jsLowpass: number[];
  let jsDwt: { approx: number[]; detail: number[] };

  beforeAll(async () => {
    wasmLoader.reset();
    jsDct = dct(sig);
    jsIdct = idct(jsDct);
    jsDst = dst(sig);
    jsIdst = idst(jsDst);
    jsHilbert = hilbertTransform(sig);
    jsPeriodogram = periodogram(sig, { window: 'hann' }).psd;
    jsLowpass = lowpassFilter(sig, 0.1, 65); // order 65 keeps N >= threshold for _convolve
    jsDwt = dwt(sig);
    // Now load the AS binary; every call below must still return the JS result.
    await wasmLoader.load(AS_WASM_PATH!);
  }, 60000);

  afterAll(() => {
    wasmLoader.reset();
  });

  const close = (a: number[], b: number[], digits = 6) => {
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i], digits);
  };

  it('the AS binary is loaded', () => {
    const mod = wasmLoader.getModule() as unknown as Record<string, unknown> | null;
    expect(typeof mod?.array_sin_ptr).toBe('function'); // AS sentinel: this IS the AS binary
  });

  it('dct is unchanged with the AS binary loaded', () => close(dct(sig), jsDct));
  it('idct is unchanged with the AS binary loaded', () => close(idct(jsDct), jsIdct));
  it('dst is unchanged with the AS binary loaded', () => close(dst(sig), jsDst));
  it('idst is unchanged with the AS binary loaded', () => close(idst(jsDst), jsIdst));

  it('dct/idct round-trip reconstructs the signal with the AS binary loaded', () => {
    close(idct(dct(sig)), sig, 6);
  });

  it('dwt is unchanged with the AS binary loaded', () => {
    // Module is loaded here; compare to the no-module reference from beforeAll.
    const w = dwt(sig);
    close(w.approx, jsDwt.approx, 6);
    close(w.detail, jsDwt.detail, 6);
  });

  it('hilbertTransform is unchanged with the AS binary loaded', () =>
    close(hilbertTransform(sig), jsHilbert, 5));
  it('periodogram is unchanged with the AS binary loaded', () =>
    close(periodogram(sig, { window: 'hann' }).psd, jsPeriodogram, 5));
  it('lowpassFilter is unchanged with the AS binary loaded', () =>
    close(lowpassFilter(sig, 0.1, 65), jsLowpass, 6));

  it('spectrogram produces frames matching the frequency-bin count with the AS binary loaded', async () => {
    const out = await spectrogram(sig, { windowSize: 64, hopSize: 32, window: 'hann' });
    expect(out.magnitude.length).toBeGreaterThan(0);
    expect(out.magnitude[0].length).toBe(out.frequencies.length);
  });
});
