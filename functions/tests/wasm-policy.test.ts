/**
 * The measured dispatch policy (src/wasm/policy.ts): once `loadWasm()` has run, a public
 * function reaches its AS kernel only in the band where tools/benchmark/wasm/opt-in.bench.ts
 * measured it faster in two runs. Everywhere else it keeps its JS path, because loading
 * made those calls slower (up to 4.5x for welchPSD) or no faster.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  loadWasm,
  abs,
  sin,
  exp,
  lgamma,
  welchPSD,
  polymul,
  polyFit,
  cubicSpline,
  bitAnd,
  fuseUnaryChain,
} from '../src/index.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { wasmPolicyAllows, overrideWasmPolicy, wasmDispatchPolicy } from '../src/wasm/policy.js';
import { AS_WASM_PATH, AS_WASM_MISSING_MESSAGE, countExportCalls } from './helpers/wasm-spy.js';

const ramp = (n: number, lo = 0.1, hi = 0.9): Float64Array =>
  Float64Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / n);

describe('wasmPolicyAllows', () => {
  it('dispatches inside a band and not outside it (max is exclusive)', () => {
    expect(wasmPolicyAllows('array_sin_ptr', 1023)).toBe(false);
    expect(wasmPolicyAllows('array_sin_ptr', 1024)).toBe(true);
    expect(wasmPolicyAllows('array_sin_ptr', 131071)).toBe(true);
    expect(wasmPolicyAllows('array_sin_ptr', 131072)).toBe(false);
    expect(wasmPolicyAllows('array_abs_ptr', 1e7)).toBe(true);
  });

  it('never dispatches a kernel without an entry', () => {
    expect(wasmPolicyAllows('welch_psd_f64', 1e6)).toBe(false);
    expect(wasmPolicyAllows('no_such_kernel', 1e6)).toBe(false);
    expect(Object.keys(wasmDispatchPolicy())).not.toContain('welch_psd_f64');
  });

  it('an override applies until restored; `*` covers kernels without their own entry', () => {
    const restore = overrideWasmPolicy({ welch_psd_f64: { min: 10 }, array_abs_ptr: null });
    expect(wasmPolicyAllows('welch_psd_f64', 10)).toBe(true);
    expect(wasmPolicyAllows('array_abs_ptr', 1e6)).toBe(false);
    const restoreAll = overrideWasmPolicy({ '*': { min: 0 } });
    expect(wasmPolicyAllows('poly_mul_f64', 1)).toBe(true);
    expect(wasmPolicyAllows('array_abs_ptr', 1e6)).toBe(false); // own entry wins over '*'
    restoreAll();
    restore();
    expect(wasmPolicyAllows('welch_psd_f64', 10)).toBe(false);
    expect(wasmPolicyAllows('array_abs_ptr', 1e6)).toBe(true);
  });
});

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(AS_WASM_PATH, AS_WASM_MISSING_MESSAGE).not.toBeNull();
});

describe('after loadWasm(), public functions follow the policy', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    expect(await loadWasm(AS_WASM_PATH!)).toBe(true);
  });

  afterAll(() => {
    wasmLoader.reset();
  });

  it('kernels inside their band run on AS', async () => {
    const a = countExportCalls(['array_abs_ptr'], () => abs(ramp(4096, -1, 1)));
    await a.result;
    expect(a.counts.array_abs_ptr).toBeGreaterThan(0);

    const s = countExportCalls(['array_sin_ptr'], () => sin(ramp(4096)));
    await s.result;
    expect(s.counts.array_sin_ptr).toBeGreaterThan(0);

    const chain = countExportCalls(['array_tanh_ptr', 'array_expm1_ptr'], () =>
      fuseUnaryChain(['tanh', 'expm1'], ramp(4096))
    );
    expect(chain.counts.array_tanh_ptr).toBeGreaterThan(0);

    const xs = Array.from(ramp(4096, -1, 1));
    const fit = countExportCalls(['poly_fit_f64'], () =>
      polyFit(
        xs,
        xs.map((x) => 1 + 2 * x - 3 * x * x * x),
        3
      )
    );
    expect(fit.counts.poly_fit_f64).toBeGreaterThan(0);
    expect(fit.result[3]).toBeCloseTo(-3, 9);
  });

  it('a band limit sends larger inputs back to JS (sin stops at 131,072)', async () => {
    const s = countExportCalls(['array_sin_ptr'], () => sin(ramp(131072)));
    await s.result;
    expect(s.counts.array_sin_ptr).toBe(0);
  });

  it('kernels measured slower stay on JS, with the same results', async () => {
    const e = countExportCalls(['array_exp_ptr'], () => exp(ramp(16384)));
    await e.result;
    expect(e.counts.array_exp_ptr).toBe(0);

    const g = countExportCalls(['lgamma_f64'], () => lgamma(ramp(16384, 0.5, 20)));
    await g.result;
    expect(g.counts.lgamma_f64).toBe(0);

    const signal = ramp(65536, -1, 1);
    const w = countExportCalls(['welch_psd_f64'], () => welchPSD(signal, { frameLength: 256 }));
    expect(w.counts.welch_psd_f64).toBe(0);
    expect(w.result.psd.length).toBe(129);

    const p = countExportCalls(['poly_mul_f64'], () =>
      polymul(Array.from(ramp(1024)), Array.from(ramp(1024)))
    );
    expect(p.counts.poly_mul_f64).toBe(0);
    expect(p.result.length).toBe(2047);

    const xs = Array.from({ length: 16384 }, (_, i) => i / 16384);
    const sp = countExportCalls(['tridiag_solve_f64'], () =>
      cubicSpline(
        xs,
        xs.map((x) => Math.sin(6 * x))
      )
    );
    expect(sp.counts.tridiag_solve_f64).toBe(0);
    expect(sp.result(0.5)).toBeCloseTo(Math.sin(3), 6);

    const n = 131072;
    const ia = Int32Array.from({ length: n }, (_, i) => i * 7);
    const b = countExportCalls(['bitAnd_i32_array'], () => bitAnd(ia, ia));
    await b.result;
    expect(b.counts.bitAnd_i32_array).toBe(0);
  });
});
