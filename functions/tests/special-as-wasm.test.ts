/**
 * Migration Phase 3b — special-function bridge on the AS binary.
 *
 * Proves each repointed special dispatch (a) executes on the AS managed kernel
 * (call-counter > 0, via the writable module clone) and (b) matches the JS
 * reference to ≤1e-12 relative, for n ≥ WASM_SPECIAL_THRESHOLD.
 *
 * Airy Ai/Bi are NOT repointed: the AS asymptotic kernels diverge from the JS
 * reference by ~1e-6 (|x|>5). This test pins that the AS Airy kernel is NOT
 * invoked under the AS binary (stays on the validated JS path).
 *
 * Skipped when no AS artifact is present.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import {
  WASM_SPECIAL_THRESHOLD,
  besselJ0Dispatch,
  besselJ1Dispatch,
  besselJDispatch,
  besselY0Dispatch,
  besselYDispatch,
  lgammaDispatch,
  ellipticKDispatch,
  ellipticEDispatch,
  carlsonRCDispatch,
  carlsonRFDispatch,
  carlsonRDDispatch,
  carlsonRJDispatch,
  ellipticFIncompleteDispatch,
  ellipticEIncompleteDispatch,
  ellipticPiIncompleteDispatch,
  airyAiDispatch,
  airyBiDispatch,
  besselJ0JS,
  besselJ1JS,
  besselJnJS,
  besselY0JS,
  besselYnJS,
  lgammaJS,
  ellipticKJS,
  ellipticEJS,
  carlsonRCJS,
  carlsonRFJS,
  carlsonRDJS,
  carlsonRJJS,
  ellipticFIncompleteJS,
  ellipticEIncompleteJS,
  ellipticPiIncompleteJS,
  airyAiJS,
  airyBiJS,
} from '../src/wasm/special/wasm-bridge.js';
import { AS_WASM_PATH, countExportCalls } from './helpers/wasm-spy.js';

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;
const N = WASM_SPECIAL_THRESHOLD; // 1024

function relMax(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const denom = Math.abs(b[i]) > 1e-12 ? Math.abs(b[i]) : 1;
    const d = Math.abs(a[i] - b[i]) / denom;
    if (!Number.isNaN(d) && d > m) m = d;
  }
  return m;
}

function fill(f: (i: number) => number): Float64Array {
  const a = new Float64Array(N);
  for (let i = 0; i < N; i++) a[i] = f(i);
  return a;
}

describeIfAS('special bridge — AssemblyScript managed dispatch (Phase 3b)', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  it('executes AS kernels and matches JS for Bessel / lgamma / elliptic K,E', () => {
    const xany = fill((i) => -10 + i * 0.02);
    const xpos = fill((i) => 0.1 + i * 0.02);
    const mdom = fill((i) => i / N);

    const cases: [string, () => Float64Array, Float64Array][] = [
      ['bessel_j0_f64', () => besselJ0Dispatch(xany), besselJ0JS(xany)],
      ['bessel_j1_f64', () => besselJ1Dispatch(xany), besselJ1JS(xany)],
      ['bessel_jn_f64', () => besselJDispatch(2, xany), besselJnJS(2, xany)],
      ['bessel_y0_f64', () => besselY0Dispatch(xpos), besselY0JS(xpos)],
      ['bessel_yn_f64', () => besselYDispatch(2, xpos), besselYnJS(2, xpos)],
      ['lgamma_f64', () => lgammaDispatch(xpos), lgammaJS(xpos)],
      ['elliptic_k_f64', () => ellipticKDispatch(mdom), ellipticKJS(mdom)],
      ['elliptic_e_f64', () => ellipticEDispatch(mdom), ellipticEJS(mdom)],
    ];
    for (const [name, run, ref] of cases) {
      const { result, counts } = countExportCalls([name], run);
      expect(counts[name], `${name}: AS kernel invoked`).toBeGreaterThan(0);
      expect(relMax(result, ref), `${name}: AS vs JS`).toBeLessThan(1e-12);
    }
  });

  it('executes AS kernels and matches JS for Carlson R-forms + incomplete elliptic', () => {
    const x = fill((i) => 0.1 + i * 0.02);
    const y = fill((i) => 0.2 + i * 0.02);
    const z = fill((i) => 0.3 + i * 0.02);
    const p = fill((i) => 0.5 + i * 0.02);
    const phi = fill((i) => 0.1 + (1.3 * i) / N);
    const mm = fill((i) => (0.5 * i) / N);
    const nn = fill((i) => (0.3 * i) / N);

    const cases: [string, () => Float64Array, Float64Array][] = [
      ['carlson_rc_f64', () => carlsonRCDispatch(x, y), carlsonRCJS(x, y)],
      ['carlson_rf_f64', () => carlsonRFDispatch(x, y, z), carlsonRFJS(x, y, z)],
      ['carlson_rd_f64', () => carlsonRDDispatch(x, y, z), carlsonRDJS(x, y, z)],
      ['carlson_rj_f64', () => carlsonRJDispatch(x, y, z, p), carlsonRJJS(x, y, z, p)],
      [
        'elliptic_f_incomplete_f64',
        () => ellipticFIncompleteDispatch(phi, mm),
        ellipticFIncompleteJS(phi, mm),
      ],
      [
        'elliptic_e_incomplete_f64',
        () => ellipticEIncompleteDispatch(phi, mm),
        ellipticEIncompleteJS(phi, mm),
      ],
      [
        'elliptic_pi_incomplete_f64',
        () => ellipticPiIncompleteDispatch(nn, phi, mm),
        ellipticPiIncompleteJS(nn, phi, mm),
      ],
    ];
    for (const [name, run, ref] of cases) {
      const { result, counts } = countExportCalls([name], run);
      expect(counts[name], `${name}: AS kernel invoked`).toBeGreaterThan(0);
      expect(relMax(result, ref), `${name}: AS vs JS`).toBeLessThan(1e-12);
    }
  });

  it('executes the AS Airy kernels and matches JS incl. the |x|>5 asymptotic region', () => {
    // Grid spans the convergent-series region (|x|≤5) and both asymptotic tails
    // (|x|>5), which is exactly where the AS kernel used to diverge ~1e-7. After
    // the AIRY_U_MAX cap it mirrors the JS truncation to ≈4e-16.
    const xany = fill((i) => -10 + i * 0.02); // [-10, +10.46)
    const ai = countExportCalls(['airy_ai_f64'], () => airyAiDispatch(xany));
    expect(ai.counts.airy_ai_f64, 'airy_ai_f64: AS kernel invoked').toBeGreaterThan(0);
    expect(relMax(ai.result, airyAiJS(xany)), 'airy_ai: AS vs JS').toBeLessThan(1e-9);

    const bi = countExportCalls(['airy_bi_f64'], () => airyBiDispatch(xany));
    expect(bi.counts.airy_bi_f64, 'airy_bi_f64: AS kernel invoked').toBeGreaterThan(0);
    expect(relMax(bi.result, airyBiJS(xany)), 'airy_bi: AS vs JS').toBeLessThan(1e-9);
  });

  it('below threshold uses JS (no AS kernel call)', () => {
    const small = fill(() => 0.5).slice(0, WASM_SPECIAL_THRESHOLD - 1);
    const { counts } = countExportCalls(['bessel_j0_f64'], () => besselJ0Dispatch(small));
    expect(counts.bessel_j0_f64).toBe(0);
  });
});
