/**
 * Rust→AS migration Phase 3b — spectral signal bridge on the AS binary.
 *
 * Proves apply_window / welch / bartlett / goertzel / chirp-Z execute on the AS
 * managed kernels (call-counter > 0) and match the JS reference.
 *
 * RED before the fix (AS default): the bridge probed the Rust pointer name and
 * called the AS managed kernel with pointer args — apply_window was a silent
 * no-op and goertzel returned garbage.
 *
 * Skipped when no AS artifact is present.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import {
  WASM_SIGNAL_THRESHOLD,
  applyWindowDispatch,
  applyWindowJS,
  welchPSDDispatch,
  welchPSDJS,
  bartlettPSDDispatch,
  bartlettPSDJS,
  goertzelDispatch,
  goertzelJS,
  chirpZTransformDispatch,
  chirpZTransformJS,
} from '../src/wasm/signal/wasm-bridge.js';
import { AS_WASM_PATH, countExportCalls, maxAbsDiff } from './helpers/wasm-spy.js';

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;
const N = WASM_SIGNAL_THRESHOLD; // 4096

function signal(): Float64Array {
  const s = new Float64Array(N);
  for (let i = 0; i < N; i++) s[i] = Math.sin(i * 0.05) + 0.3 * Math.cos(i * 0.013);
  return s;
}

describeIfAS('signal bridge — AssemblyScript managed dispatch (Phase 3b)', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  it('applyWindowDispatch executes the AS kernel and matches JS (in-place)', () => {
    const sig = signal();
    const got = Float64Array.from(sig);
    const { counts } = countExportCalls(['apply_window_f64'], () =>
      applyWindowDispatch(got, 'hann')
    );
    expect(counts.apply_window_f64).toBeGreaterThan(0);
    const ref = Float64Array.from(sig);
    applyWindowJS(ref, 0);
    expect(maxAbsDiff(got, ref)).toBeLessThan(1e-12);
    // Regression: corrupt path was a silent no-op (window not applied).
    expect(maxAbsDiff(got, sig)).toBeGreaterThan(0);
  });

  it('welch / bartlett PSD execute the AS kernel and match JS', () => {
    const sig = signal();
    const w = countExportCalls(['welch_psd_f64'], () => welchPSDDispatch(sig, 256, 128, 'hann'));
    expect(w.counts.welch_psd_f64).toBeGreaterThan(0);
    expect(maxAbsDiff(w.result, welchPSDJS(sig, 256, 128, 0))).toBeLessThan(1e-12);

    const b = countExportCalls(['bartlett_psd_f64'], () => bartlettPSDDispatch(sig, 256));
    expect(b.counts.bartlett_psd_f64).toBeGreaterThan(0);
    expect(maxAbsDiff(b.result, bartlettPSDJS(sig, 256))).toBeLessThan(1e-12);
  });

  it('goertzelDispatch executes the AS kernel and matches JS', () => {
    const sig = signal();
    const { result, counts } = countExportCalls(['goertzel_f64'], () =>
      goertzelDispatch(sig, 50, 1000)
    );
    expect(counts.goertzel_f64).toBeGreaterThan(0);
    const ref = goertzelJS(sig, 50, 1000);
    expect(Math.abs(result - ref) / Math.abs(ref)).toBeLessThan(1e-12);
  });

  it('chirpZTransformDispatch executes the AS kernel and matches JS', () => {
    const sig = signal();
    const m = 64;
    const pr = Math.cos((-2 * Math.PI) / N);
    const pi = Math.sin((-2 * Math.PI) / N);
    const { result, counts } = countExportCalls(['chirp_z_transform_f64'], () =>
      chirpZTransformDispatch(sig, m, 1, 0, pr, pi)
    );
    expect(counts.chirp_z_transform_f64).toBeGreaterThan(0);
    const ref = chirpZTransformJS(sig, m, 1, 0, pr, pi);
    expect(maxAbsDiff(result.re, ref.re)).toBeLessThan(1e-9);
    expect(maxAbsDiff(result.im, ref.im)).toBeLessThan(1e-9);
  });
});
