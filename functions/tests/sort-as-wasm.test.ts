/**
 * Migration Phase 3b — sort bridge on the AS binary.
 *
 * All three kernels are on the AS managed binary. Phase 6:
 *   - sort_f64 is now an INTROSORT (3-way quicksort + median-of-3 + heapsort
 *     fallback): duplicate-heavy input is O(n log n) (was O(n²)); value-sort
 *     stays bit-identical to JS.
 *   - argsort_f64 / rank_f64 are repointed to AS: the AS index sort uses a STABLE
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
  rankF64Dispatch,
  sortF64JS,
  argsortF64JS,
  rankF64JS,
} from '../src/wasm/sort/wasm-bridge.js';
import { AS_WASM_PATH, countExportCalls } from './helpers/wasm-spy.js';

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

  it('sortF64Dispatch is fast + bit-identical on duplicate-heavy input (introsort)', () => {
    // Heavy duplicates: the old Lomuto quicksort degraded to O(n²) here. The
    // 3-way introsort keeps it O(n log n). Correctness is the primary assertion;
    // a generous wall-clock ceiling guards against an accidental O(n²) regression.
    const dup = new Float64Array(N);
    for (let i = 0; i < N; i++) dup[i] = (i % 3) * 1.0;
    const t0 = performance.now();
    const { result, counts } = countExportCalls(['sort_f64'], () =>
      sortF64Dispatch(Float64Array.from(dup))
    );
    const dt = performance.now() - t0;
    expect(counts.sort_f64).toBeGreaterThan(0);
    const ref = sortF64JS(Float64Array.from(dup));
    for (let i = 0; i < N; i++) expect(result[i]).toBe(ref[i]);
    expect(dt).toBeLessThan(1000); // O(n²) on 16 384 dupes would blow past this
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

    const r = countExportCalls(['rank_f64'], () => rankF64Dispatch(Float64Array.from(dup)));
    expect(r.counts.rank_f64).toBeGreaterThan(0);
    expect(Array.from(r.result)).toEqual(Array.from(rankF64JS(dup)));
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
