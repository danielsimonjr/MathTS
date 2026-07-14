/**
 * GPU FFT (Stockham autosort, f32).
 *
 * Measured against `fftCoreFloat64` — the flat f64 core `parallelFFT` runs on this thread —
 * warm JIT, NVIDIA Pascal / Chrome. The published table lives in
 * `gpu-fft-bench.browser.test.ts`, which regenerates it:
 *
 *   | n         | CPU f64  | GPU f32  | speedup |
 *   | 65,536    |  16.8 ms |  14.4 ms | 1.17x   |  <- BELOW the FFT threshold, on purpose
 *   | 262,144   |  53.4 ms |  24.0 ms | 2.23x   |  <- threshold
 *   | 2,097,152 | 399.9 ms | 116.3 ms | 3.44x   |
 *
 * ~2.2-3.4x, and noisy run to run. **The FFT's threshold (262,144) is HIGHER than
 * GPU_MIN_ELEMENTS (65,536)**: at 65,536 the GPU wins by only 1.17x, which is inside the noise
 * and nowhere near enough to trade f64 for f32.
 *
 * The accuracy question was the one that could have killed this: f32 error compounds across
 * log2(n) stages, which makes an f32 FFT a much harder sell than an f32 element-wise chain.
 * It held at ~4e-7 peak-relative even at 20 stages. These tests pin that.
 *
 * (An earlier version of this header claimed 5.0-8.5x. That came from a cold-JIT CPU baseline
 * AND from comparing against a CPU path `parallelFFT` did not actually take. Both fixed.)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fftGpuDispatch } from '../src/gpu/fft-gpu.js';
import { parallelFFT } from '../src/typed/signal.js';
import { fftCoreFloat64 } from '../src/signal/fft-core-f64.js';
import { getGpuDevice, enableGpu, disableGpu } from '@danielsimonjr/mathts-gpu';
import { REAL_GPU } from './helpers/gpu-hardware.js';

const device = await getGpuDevice().catch(() => null);

beforeAll(() => enableGpu());
afterAll(() => disableGpu()); // enableGpu() is PROCESS-GLOBAL. Put it back.

/** The FFT's own threshold — HIGHER than GPU_MIN_ELEMENTS (see FFT_GPU_MIN_ELEMENTS). */
const FFT_MIN = 262_144;
const N = FFT_MIN;
const signal = (n: number): Float64Array =>
  Float64Array.from({ length: n }, (_, i) => Math.sin(i * 0.01) + 0.5 * Math.cos(i * 0.033));

/**
 * f32 bound, relative to the spectrum's PEAK magnitude.
 *
 * Per-bin relative error is the wrong metric for a spectrum: bins whose true magnitude is
 * ~0 have unbounded relative error from any rounding whatsoever, so a per-bin bound would
 * either be meaningless or fail on correct code. Peak-relative is the standard measure for
 * transform accuracy and is what the 4e-7 figure refers to.
 *
 * ADAPTER-GATED, and this is load-bearing. CI runs this suite on SwiftShader, and WGSL only
 * promises `sin`/`cos` to 2^-11 (~4.9e-4) ABSOLUTE — SwiftShader measures ~2e-4 where Pascal
 * is ~6e-8. The twiddles ARE cos/sin, so that error propagates straight into the spectrum:
 * modelled at n=2^18, a 2e-4 twiddle gives ~1.3e-4 peak-relative error, 26x over the 5e-6
 * hardware bound. A single tolerance would have turned CI red — the exact trap
 * `helpers/gpu-hardware.ts` exists to prevent, which I nearly walked into in the file that
 * imports it. The software bound comes from the SPEC, not from my GPU.
 */
const PEAK_REL_TOL = REAL_GPU ? 5e-6 : 2e-3;

const peakRelErr = (
  gotRe: Float64Array,
  gotIm: Float64Array,
  wantRe: Float64Array,
  wantIm: Float64Array
): number => {
  let peak = 0;
  for (let k = 0; k < wantRe.length; k++) peak = Math.max(peak, Math.hypot(wantRe[k], wantIm[k]));
  let err = 0;
  for (let k = 0; k < wantRe.length; k++) {
    err = Math.max(err, Math.hypot(gotRe[k] - wantRe[k], gotIm[k] - wantIm[k]) / peak);
  }
  return err;
};

describe.skipIf(!device)('GPU FFT', () => {
  it('matches the f64 core to f32 precision', async () => {
    const re = signal(N);
    const got = await fftGpuDispatch(re, new Float64Array(N));
    expect(got, 'GPU declined — the FFT tier did not engage').not.toBeNull();

    const want = fftCoreFloat64(new Float64Array(re), new Float64Array(N), false);
    const err = peakRelErr(got!.real, got!.imag, want.real, want.imag);
    console.log(`[gpufft] n=${N} peak-relative error vs f64 core: ${err.toExponential(2)}`);
    expect(err).toBeLessThan(PEAK_REL_TOL);
  }, 120_000);

  it('matches a naive DFT oracle — not just our own core', async () => {
    // An oracle INDEPENDENT of both implementations: X[k] = sum_j x[j] e^(-2pi i kj/n),
    // computed in f64 straight from the definition.
    //
    // This runs AT the FFT threshold, NOT at some small n. An earlier draft used n=1024,
    // where the dispatch declines by design — so it returned null, the test took its
    // early-out, and it asserted nothing whatsoever about the GPU. A test that cannot fail
    // is worse than no test. Only the first 32 bins are checked, so the O(n) per bin is
    // affordable.
    const n = FFT_MIN;
    const x = signal(n);
    const got = await fftGpuDispatch(x, new Float64Array(n), false);
    expect(got, 'GPU declined at the threshold — the oracle check would be vacuous').not.toBeNull();

    // The denominator must be the GLOBAL peak, not the peak of the bins we sample.
    // This signal's energy sits at bins ~417 and ~1377, so bins 0..31 are near-zero leakage —
    // normalising by THEIR peak divides by ~nothing and manufactures a huge "error". (It did:
    // 7.8e-6 against a 5e-6 bound, on a kernel that agrees with the f64 core to 4.8e-7.)
    const full = fftCoreFloat64(new Float64Array(x), new Float64Array(n), false);
    let peak = 0;
    for (let k = 0; k < n; k++) peak = Math.max(peak, Math.hypot(full.real[k], full.imag[k]));
    expect(peak, 'signal has no energy — the test would prove nothing').toBeGreaterThan(1);

    let checked = 0;
    for (let k = 0; k < 32; k++) {
      let sr = 0;
      let si = 0;
      for (let j = 0; j < n; j++) {
        const a = (-2 * Math.PI * k * j) / n;
        sr += x[j] * Math.cos(a);
        si += x[j] * Math.sin(a);
      }
      const err = Math.hypot(got!.real[k] - sr, got!.imag[k] - si) / peak;
      expect(err, `bin ${k} disagrees with the DFT definition`).toBeLessThan(PEAK_REL_TOL);
      checked++;
    }
    expect(checked).toBe(32);
  }, 120_000);

  it('round-trips: ifft(fft(x)) === x', async () => {
    const x = signal(N);
    const spec = await fftGpuDispatch(x, new Float64Array(N), false);
    expect(spec).not.toBeNull();

    const back = await fftGpuDispatch(spec!.real, spec!.imag, true);
    expect(back).not.toBeNull();

    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(x[i]));
    let err = 0;
    for (let i = 0; i < N; i++) {
      err = Math.max(err, Math.hypot(back!.real[i] - x[i], back!.imag[i]) / peak);
    }
    console.log(`[gpufft] round-trip peak-relative error: ${err.toExponential(2)}`);
    expect(err).toBeLessThan(PEAK_REL_TOL);
  }, 120_000);

  it('declines below the FFT threshold — including at GPU_MIN_ELEMENTS', async () => {
    // The FFT's bar is HIGHER than the shared GPU_MIN_ELEMENTS (65,536). At 65,536 the GPU
    // wins by only 1.17x — inside the noise, and nowhere near enough to trade f64 for f32.
    // So 65,536 must be DECLINED here even though the element-wise tier accepts it.
    for (const n of [1 << 14, 1 << 16, 1 << 17]) {
      expect(
        await fftGpuDispatch(signal(n), new Float64Array(n)),
        `n=${n} is below the FFT threshold and must be declined`
      ).toBeNull();
    }
  }, 120_000);

  it('declines non-power-of-two, mismatched lengths, and opt-out', async () => {
    const n = FFT_MIN + 1; // not a power of two -> chirp-z is the CPU's job
    expect(await fftGpuDispatch(signal(n), new Float64Array(n))).toBeNull();

    // real/imag length mismatch
    expect(await fftGpuDispatch(signal(N), new Float64Array(N - 1))).toBeNull();

    // per-call override beats the process-global flag
    expect(await fftGpuDispatch(signal(N), new Float64Array(N), false, { gpu: false })).toBeNull();

    disableGpu();
    try {
      expect(await fftGpuDispatch(signal(N), new Float64Array(N))).toBeNull();
    } finally {
      enableGpu();
    }
  }, 120_000);

  it.skipIf(!REAL_GPU)(
    'beats the f64 CPU core above the threshold',
    async () => {
      const n = 1 << 20;
      const re = signal(n);
      const zeros = new Float64Array(n);
      const REPS = 3;

      // Constructor, not `.from()` — `.from()` on a typed array is the generic per-element path
      // and would INFLATE the CPU baseline, manufacturing a fake GPU win. That bug has already
      // corrupted this project's numbers twice; do not reintroduce it in the benchmark.
      fftCoreFloat64(new Float64Array(re), new Float64Array(n), false);
      const t0 = performance.now();
      for (let r = 0; r < REPS; r++)
        fftCoreFloat64(new Float64Array(re), new Float64Array(n), false);
      const cpuMs = (performance.now() - t0) / REPS;

      expect(await fftGpuDispatch(re, zeros)).not.toBeNull();
      const t1 = performance.now();
      for (let r = 0; r < REPS; r++) {
        expect(await fftGpuDispatch(re, zeros)).not.toBeNull();
      }
      const gpuMs = (performance.now() - t1) / REPS;

      console.log(
        `[gpufft] n=${n}: cpu ${cpuMs.toFixed(1)}ms  gpu ${gpuMs.toFixed(1)}ms  (${(cpuMs / gpuMs).toFixed(2)}x)`
      );

      // Measured 2.2-3.4x (noisy). A bar at 1.8x survives thermal state and a shared GPU while
      // still failing loudly if the transform regresses to something CPU-competitive.
      expect(cpuMs / gpuMs, 'the GPU FFT no longer beats the CPU core').toBeGreaterThan(1.8);
    },
    180_000
  );

  it('parallelFFT USES the GPU when enabled, and is exact f64 when not', async () => {
    // The tier must actually switch through the PUBLIC entry point, not just in isolation.
    const x = signal(N);
    const want = fftCoreFloat64(new Float64Array(x), new Float64Array(N), false);

    let peak = 0;
    for (let k = 0; k < N; k++) peak = Math.max(peak, Math.hypot(want.real[k], want.imag[k]));

    enableGpu();
    const on = (await parallelFFT(x)) as { real: Float64Array; imag: Float64Array };
    const errOn = peakRelErr(on.real, on.imag, want.real, want.imag);

    disableGpu();
    let errOff: number;
    try {
      const off = (await parallelFFT(x)) as { real: Float64Array; imag: Float64Array };
      errOff = peakRelErr(off.real, off.imag, want.real, want.imag);
    } finally {
      enableGpu();
    }

    console.log(
      `[gpufft] parallelFFT  gpu-on err=${errOn.toExponential(2)}  gpu-off err=${errOff.toExponential(2)}`
    );

    // GPU on: correct to f32, but NOT to f64 — that gap is the proof the GPU tier ran
    // rather than the CPU silently serving the request.
    expect(errOn).toBeLessThan(PEAK_REL_TOL);
    expect(errOn, 'result was f64-exact — the GPU tier did NOT run').toBeGreaterThan(1e-12);

    // GPU off (the default): opting out must cost nothing in accuracy.
    expect(errOff, 'the CPU path is not f64-exact').toBeLessThan(1e-12);
  }, 180_000);

  // Every other size in this file has an EVEN number of stages (2^16 -> 16, 2^20 -> 20).
  // The ping-pong swaps buffers after each pass, so if the parity logic were wrong for an
  // ODD stage count we would read back the wrong buffer — and nothing else here would catch
  // it. 2^17 and 2^19 have 17 and 19 stages.
  it.each([1 << 18, 1 << 19, 1 << 20, 1 << 21])(
    'reads back the correct buffer at n=%i (odd AND even stage counts)',
    async (n) => {
      const x = signal(n);
      const got = await fftGpuDispatch(x, new Float64Array(n), false);
      expect(got, `GPU declined at n=${n}`).not.toBeNull();

      const want = fftCoreFloat64(new Float64Array(x), new Float64Array(n), false);
      const err = peakRelErr(got!.real, got!.imag, want.real, want.imag);
      const stages = Math.log2(n);
      console.log(
        `[gpufft] n=${n} stages=${stages} (${stages % 2 === 0 ? 'even' : 'ODD'}) err=${err.toExponential(2)}`
      );
      expect(err).toBeLessThan(PEAK_REL_TOL);
    },
    180_000
  );
});
