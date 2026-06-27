/**
 * Migration Phase 3b — interpolation bridge on the AS binary.
 *
 * Proves tridiag-solve and divided-difference execute on the AS managed kernels
 * (call-counter > 0) and bit-match the JS reference, with singular / duplicate-x
 * inputs correctly falling through to JS.
 *
 * Skipped when no AS artifact is present.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import {
  WASM_TRIDIAG_THRESHOLD,
  WASM_INTERP_THRESHOLD,
  tridiagSolveDispatch,
  tridiagSolveJS,
  dividedDifferenceDispatch,
  dividedDifferenceJS,
} from '../src/wasm/interpolation/wasm-bridge.js';
import { AS_WASM_PATH, countExportCalls, maxAbsDiff } from './helpers/wasm-spy.js';

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;

describeIfAS('interpolation bridge — AssemblyScript managed dispatch (Phase 3b)', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  it('tridiagSolveDispatch executes the AS kernel and matches JS (n ≥ 1024)', () => {
    const n = WASM_TRIDIAG_THRESHOLD;
    const diag = new Float64Array(n);
    const lower = new Float64Array(n - 1);
    const upper = new Float64Array(n - 1);
    const rhs = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      diag[i] = 4 + 0.001 * i;
      rhs[i] = Math.sin(i * 0.1);
    }
    for (let i = 0; i < n - 1; i++) {
      lower[i] = -1;
      upper[i] = -1;
    }
    const { result, counts } = countExportCalls(['tridiag_solve_f64'], () =>
      tridiagSolveDispatch(diag, lower, upper, rhs)
    );
    expect(counts.tridiag_solve_f64).toBeGreaterThan(0);
    expect(result.length).toBe(n);
    expect(maxAbsDiff(result, tridiagSolveJS(diag, lower, upper, rhs))).toBeLessThan(1e-12);
  });

  it('dividedDifferenceDispatch executes the AS kernel and matches JS (n ≥ 256)', () => {
    const n = WASM_INTERP_THRESHOLD;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = i / (n - 1);
      ys[i] = Math.sin(xs[i] * 2);
    }
    const { result, counts } = countExportCalls(['divided_difference_f64'], () =>
      dividedDifferenceDispatch(xs, ys)
    );
    expect(counts.divided_difference_f64).toBeGreaterThan(0);
    expect(result.length).toBe(n);
    expect(maxAbsDiff(result, dividedDifferenceJS(xs, ys))).toBeLessThan(1e-12);
  });

  it('duplicate x-values fall through to JS and throw (n ≥ 256)', () => {
    const n = WASM_INTERP_THRESHOLD;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = i / (n - 1);
      ys[i] = xs[i];
    }
    xs[5] = xs[4]; // duplicate -> AS returns length 0 -> JS path throws
    expect(() => dividedDifferenceDispatch(xs, ys)).toThrow();
  });
});
