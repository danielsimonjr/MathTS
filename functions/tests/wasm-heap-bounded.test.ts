/**
 * With the AssemblyScript tier loaded, repeated managed-ABI calls keep linear memory bounded.
 *
 * The binary uses the stub runtime, a bump allocator that never frees, and `__unpin` does
 * nothing under it. Every managed call used to leave its inputs and its result array on the
 * heap for good: 200 `lgamma` calls on 16,384 values grew memory by about 50 MiB, and a
 * long-running process that opted in with `loadWasm()` climbed until `memory.grow` failed
 * and every call silently fell back to JS. The bridges now call the binary's `heap_reset`
 * after each call has copied its results out.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadWasm, lgamma, bitAnd, welchPSD } from '../src/index.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { overrideWasmPolicy } from '../src/wasm/policy.js';
import { AS_WASM_PATH, AS_WASM_MISSING_MESSAGE, countExportCalls } from './helpers/wasm-spy.js';

const CALLS = 200;
/** One call's footprint is well under this; the old leak added ~50 MiB over 200 calls. */
const GROWTH_BUDGET = 4 * 1024 * 1024;

function memoryBytes(): number {
  const mod = wasmLoader.getModule() as unknown as { memory: WebAssembly.Memory } | null;
  if (!mod) throw new Error('module not loaded');
  return mod.memory.buffer.byteLength;
}

/** Warm up (memory may grow once to fit a call), then assert repeated calls do not grow it. */
async function assertBounded(label: string, call: () => unknown): Promise<void> {
  for (let i = 0; i < 3; i++) await call();
  const before = memoryBytes();
  for (let i = 0; i < CALLS; i++) await call();
  const growth = memoryBytes() - before;
  expect(growth, `${label}: grew ${growth} bytes over ${CALLS} calls`).toBeLessThanOrEqual(
    GROWTH_BUDGET
  );
}

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(AS_WASM_PATH, AS_WASM_MISSING_MESSAGE).not.toBeNull();
});

describe('managed-ABI calls keep WASM memory bounded', () => {
  // This is about memory, not about where the dispatch policy sends each call: let every
  // bridge reach its kernel.
  let restorePolicy: () => void = () => {};

  beforeAll(async () => {
    wasmLoader.reset();
    expect(await loadWasm(AS_WASM_PATH!)).toBe(true);
    restorePolicy = overrideWasmPolicy({ '*': { min: 0 } });
  });

  afterAll(() => {
    restorePolicy();
    wasmLoader.reset();
  });

  it('the binary exports heap_reset', () => {
    const mod = wasmLoader.getModule() as unknown as Record<string, unknown>;
    expect(typeof mod.heap_reset).toBe('function');
  });

  it('lgamma (f64 in, f64 out)', async () => {
    const xs = Float64Array.from({ length: 16384 }, (_, i) => 0.5 + (i % 97) / 7);
    const { result, counts } = countExportCalls(['lgamma_f64'], () => lgamma(xs));
    const out = (await result) as Float64Array;
    expect(counts.lgamma_f64).toBeGreaterThan(0);
    expect(out[5]).toBeCloseTo(Math.log(Math.abs(gammaRef(xs[5]))), 10);
    await assertBounded('lgamma', () => lgamma(xs));
  });

  it('bitAnd (i32 in, i32 out)', async () => {
    const n = 131072;
    const a = Int32Array.from({ length: n }, (_, i) => (i * 2654435761) | 0);
    const b = Int32Array.from({ length: n }, (_, i) => (i * 40503) | 0);
    const { result, counts } = countExportCalls(['bitAnd_i32_array'], () => bitAnd(a, b));
    const out = (await result) as Int32Array;
    expect(counts.bitAnd_i32_array).toBeGreaterThan(0);
    expect(out[777]).toBe(a[777] & b[777]);
    await assertBounded('bitAnd', () => bitAnd(a, b));
  });

  it('welchPSD (a kernel that allocates its own result)', async () => {
    const signal = Float64Array.from({ length: 65536 }, (_, i) => Math.sin(i / 10));
    const { counts } = countExportCalls(['welch_psd_f64'], () =>
      welchPSD(signal, { frameLength: 256 })
    );
    expect(counts.welch_psd_f64).toBeGreaterThan(0);
    await assertBounded('welchPSD', () => welchPSD(signal, { frameLength: 256 }));
  });

  it('results stay correct after many resets', async () => {
    const xs = Float64Array.from({ length: 4096 }, (_, i) => 1 + i / 100);
    const first = (await lgamma(xs)) as Float64Array;
    for (let i = 0; i < 50; i++) await lgamma(xs);
    const last = (await lgamma(xs)) as Float64Array;
    expect(Array.from(last)).toEqual(Array.from(first));
  });
});

/** Lanczos Γ(x) for x > 0.5, only as an oracle for one value. */
function gammaRef(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  const z = x - 1;
  let a = c[0];
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * a;
}
