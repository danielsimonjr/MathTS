/**
 * Migration Phase 3b — sort bridge on the AS binary.
 *
 * All three kernels are on the AS managed binary. Phase 6:
 *   - sort_f64 is now an INTROSORT (3-way quicksort + median-of-3 + heapsort
 *     fallback): duplicate-heavy input is O(n log n) (was O(n²)); value-sort
 *     stays bit-identical to JS.
 *   - argsort_f64 is repointed to AS: the AS index sort uses a STABLE
 *     total-order comparator (value, then original index), so it returns exactly
 *     the JS stable permutation on tied values.
 *
 * Skipped when no AS artifact is present.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import {
  WASM_SORT_THRESHOLD,
  sortF64Dispatch,
  argsortF64Dispatch,
  sortF64JS,
  argsortF64JS,
} from '../src/wasm/sort/wasm-bridge.js';
import { getWasm, withAsF64, type RawWasm } from '../src/wasm/bridges/common.js';
import { AS_WASM_PATH, countExportCalls } from './helpers/wasm-spy.js';
import { overrideWasmPolicy } from '../src/wasm/policy.js';

// These tests prove the AS kernels themselves (they run, and they match JS), so they let
// every bridge reach its kernel. In production the measured dispatch policy
// (src/wasm/policy.ts) keeps most kernels on their JS path even after `loadWasm()`.
let restoreWasmPolicy = (): void => {};
beforeAll(() => {
  restoreWasmPolicy = overrideWasmPolicy({ '*': { min: 0 } });
});
afterAll(() => {
  restoreWasmPolicy();
});

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;
const N = WASM_SORT_THRESHOLD; // 16384

function randomData(seed: number): Float64Array {
  let s = seed >>> 0;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    out[i] = ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  }
  return out;
}

describeIfAS('sort bridge — AssemblyScript managed dispatch (Phase 3b)', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  it('sortF64Dispatch executes the AS kernel and is bit-identical to JS (incl. NaN-last)', () => {
    const data = randomData(12345);
    for (let i = 0; i < 50; i++) data[i * 100] = NaN; // NaN ties → must sort last
    const { result, counts } = countExportCalls(['sort_f64'], () =>
      sortF64Dispatch(Float64Array.from(data))
    );
    expect(counts.sort_f64).toBeGreaterThan(0); // proves AS path, not JS fallback
    const ref = sortF64JS(Float64Array.from(data));
    for (let i = 0; i < N; i++) {
      if (Number.isNaN(ref[i])) expect(Number.isNaN(result[i])).toBe(true);
      else expect(result[i]).toBe(ref[i]);
    }
  });

  it('sortF64Dispatch is bit-identical on duplicate-heavy input (introsort)', () => {
    // Heavy duplicates: the old Lomuto quicksort degraded to O(n²) here.
    const dup = new Float64Array(N);
    for (let i = 0; i < N; i++) dup[i] = (i % 3) * 1.0;
    const { result, counts } = countExportCalls(['sort_f64'], () =>
      sortF64Dispatch(Float64Array.from(dup))
    );
    expect(counts.sort_f64).toBeGreaterThan(0);
    const ref = sortF64JS(Float64Array.from(dup));
    for (let i = 0; i < N; i++) expect(result[i]).toBe(ref[i]);
  });

  it('sort_f64 kernel does not go quadratic on duplicate-heavy input', () => {
    // The check is a ratio, not an absolute budget. The n and 4n samples alternate in one
    // process, so machine load slows both lanes together. Each lane keeps its fastest of 7
    // samples. The input has 3 distinct values, so the 3-way partition is linear: from n to 4n
    // the time grows about 4 times. A quadratic sort grows the time 16 times. The sample calls
    // the kernel export directly, with no JS fallback. A kernel trap gives a null result, and
    // the null check then fails the test.
    const dupes = (n: number): Float64Array => {
      const out = new Float64Array(n);
      for (let i = 0; i < n; i++) out[i] = (i % 3) * 1.0;
      return out;
    };
    const small = dupes(N);
    const large = dupes(4 * N);
    const sample = (data: Float64Array): number => {
      const copy = Float64Array.from(data);
      const wasm = getWasm() as unknown as RawWasm;
      const t0 = performance.now();
      const out = withAsF64(wasm, [copy], (mod, [h]) =>
        (mod['sort_f64'] as (d: number) => number)(h)
      );
      const ms = performance.now() - t0;
      expect(out).not.toBeNull();
      return ms;
    };
    sample(small);
    sample(large);
    let smallMs = Infinity;
    let largeMs = Infinity;
    for (let k = 0; k < 7; k++) {
      smallMs = Math.min(smallMs, sample(small));
      largeMs = Math.min(largeMs, sample(large));
    }
    expect(largeMs / Math.max(smallMs, 0.01)).toBeLessThan(10);
  });

  it('argsort/rank execute the AS kernel and match the JS stable reference on ties', () => {
    // Duplicate-heavy + NaN input: an unstable sort would reorder ties. The AS
    // index sort breaks ties by original index, so it must match the JS stable
    // reference EXACTLY (and the AS kernel must actually be invoked).
    const dup = new Float64Array(N);
    for (let i = 0; i < N; i++) dup[i] = Math.floor(i % 7) / 3;
    for (let i = 0; i < 40; i++) dup[i * 400] = NaN; // NaN ties → must sort last, stably

    const a = countExportCalls(['argsort_f64'], () => argsortF64Dispatch(Float64Array.from(dup)));
    expect(a.counts.argsort_f64).toBeGreaterThan(0); // proves AS path, not JS fallback
    expect(Array.from(a.result)).toEqual(Array.from(argsortF64JS(dup)));
  });

  it('below threshold uses JS (no AS kernel call)', () => {
    const small = randomData(7).slice(0, WASM_SORT_THRESHOLD - 1);
    const { counts } = countExportCalls(['sort_f64', 'argsort_f64'], () => {
      sortF64Dispatch(small);
      argsortF64Dispatch(small);
    });
    expect(counts.sort_f64).toBe(0);
    expect(counts.argsort_f64).toBe(0);
  });
});
