/**
 * Spectral signal WASM kernel benchmark — Slice 5.6.
 *
 * Compares the pure-JS fallback against the WASM-dispatched path for:
 *   - applyWindow (Hann)
 *   - goertzel
 *   - welchPSD
 *   - bartlettPSD
 *   - chirpZTransform
 *
 * Run with:
 *   npx ts-node --esm tools/benchmark/wasm/signal.bench.ts
 *   (requires the Rust WASM artifact at lib/wasm/mathts.wasm)
 *
 * Expected result: WASM wins above WASM_SIGNAL_THRESHOLD (4096 samples)
 * due to tight inner loops; JS may win for small inputs due to
 * pointer-marshal overhead.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  WASM_SIGNAL_THRESHOLD,
  applyWindowJS,
  goertzelJS,
  welchPSDJS,
  bartlettPSDJS,
  chirpZTransformJS,
  goertzelDispatch,
  welchPSDDispatch,
  bartlettPSDDispatch,
  chirpZTransformDispatch,
} from '../../../functions/src/wasm/signal/wasm-bridge.js';
import { wasmLoader } from '../../../functions/src/wasm/WasmLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

const RUNS = 20;

function sinusoid(n: number, freq = 100, fs = 1000): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / fs);
  return out;
}

function bench(label: string, fn: () => void, runs = RUNS): number {
  for (let i = 0; i < 3; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const elapsed = (performance.now() - t0) / runs;
  console.log(`  ${label.padEnd(50)} ${elapsed.toFixed(3)} ms/call`);
  return elapsed;
}

async function main(): Promise<void> {
  console.log('Signal spectral WASM kernel benchmark (Slice 5.6)\n');
  console.log(`Threshold: ${WASM_SIGNAL_THRESHOLD} elements\n`);

  if (WASM_PATH) {
    console.log(`Loading WASM from: ${WASM_PATH}`);
    await wasmLoader.load(WASM_PATH);
    const mod = wasmLoader.getModule();
    const hasRust =
      mod && typeof (mod as unknown as Record<string, unknown>)['goertzel_f64'] === 'function';
    console.log(`WASM loaded; Rust goertzel_f64 available: ${hasRust}\n`);
  } else {
    console.log('WASM artifact not found — JS-only benchmark\n');
  }

  for (const n of [512, 2048, 4096, 16384]) {
    const signal = sinusoid(n);
    const frameLen = 512;
    const overlap = 256;
    const m = 512;
    const argW = (-2 * Math.PI) / n;

    console.log(`--- n = ${n} ---`);

    const jsGoertzel = bench(`goertzel  JS   n=${n}`, () => goertzelJS(signal, 100, 1000));
    const waGoertzel = bench(`goertzel  WASM n=${n}`, () => goertzelDispatch(signal, 100, 1000));

    const jsWindow = bench(`window(Hann) JS   n=${n}`, () => {
      const copy = new Float64Array(signal);
      applyWindowJS(copy, 0);
    });
    void jsWindow;

    if (n >= frameLen) {
      const jsWelch = bench(`welchPSD  JS   n=${n}`, () =>
        welchPSDJS(signal, frameLen, overlap, 0)
      );
      const waWelch = bench(`welchPSD  WASM n=${n}`, () =>
        welchPSDDispatch(signal, frameLen, overlap, 'hann')
      );

      const jsBart = bench(`bartlett  JS   n=${n}`, () => bartlettPSDJS(signal, frameLen));
      const waBart = bench(`bartlett  WASM n=${n}`, () => bartlettPSDDispatch(signal, frameLen));

      const jsCzt = bench(`czt       JS   n=${n}`, () =>
        chirpZTransformJS(signal, m, 1, 0, Math.cos(argW), Math.sin(argW))
      );
      const waCzt = bench(`czt       WASM n=${n}`, () =>
        chirpZTransformDispatch(signal, m, 1, 0, Math.cos(argW), Math.sin(argW))
      );

      const threshLabel =
        n < WASM_SIGNAL_THRESHOLD ? 'below threshold — JS fallback expected' : 'above threshold';
      console.log(
        `  Goertzel WASM speedup:  ${(jsGoertzel / waGoertzel).toFixed(2)}x (${threshLabel})`
      );
      console.log(`  Welch    WASM speedup:  ${(jsWelch / waWelch).toFixed(2)}x`);
      console.log(`  Bartlett WASM speedup:  ${(jsBart / waBart).toFixed(2)}x`);
      console.log(`  CZT      WASM speedup:  ${(jsCzt / waCzt).toFixed(2)}x`);
    }
    console.log('');
  }
}

main().catch(console.error);
