/**
 * Rust→AS migration Phase 3b — sort bridge on the AS binary.
 *
 * sort_f64 is repointed to the AS managed kernel: value-sort is bit-identical to
 * the JS reference regardless of stability. argsort_f64 / rank_f64 are NOT
 * repointed — the AS sort is UNSTABLE, so for tied values it returns a different
 * (still valid) permutation than the JS stable reference; under AS they stay on
 * the JS stable implementation.
 *
 * RED before the fix: with the AS binary default, the bridge probed the Rust
 * pointer name and called the AS managed kernel with pointer args — sort left
 * the data unsorted and argsort/rank returned all-zeros.
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

  it('argsort/rank stay on the JS stable reference (AS unstable) — AS kernel NOT used', () => {
    // Duplicate-heavy input: the unstable AS sort would reorder ties.
    const dup = new Float64Array(N);
    for (let i = 0; i < N; i++) dup[i] = Math.floor(i % 7) / 3;

    const a = countExportCalls(['argsort_f64'], () => argsortF64Dispatch(Float64Array.from(dup)));
    expect(a.counts.argsort_f64).toBe(0); // AS argsort deliberately not used
    expect(Array.from(a.result)).toEqual(Array.from(argsortF64JS(dup)));

    const r = countExportCalls(['rank_f64'], () => rankF64Dispatch(Float64Array.from(dup)));
    expect(r.counts.rank_f64).toBe(0);
    expect(Array.from(r.result)).toEqual(Array.from(rankF64JS(dup)));
  });

  it('below threshold uses JS (no AS kernel call)', () => {
    const small = randomData(7).slice(0, WASM_SORT_THRESHOLD - 1);
    const { counts } = countExportCalls(['sort_f64'], () => sortF64Dispatch(small));
    expect(counts.sort_f64).toBe(0);
  });
});
