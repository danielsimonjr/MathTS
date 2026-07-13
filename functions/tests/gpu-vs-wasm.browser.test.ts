/**
 * The tier-order guard: for element-wise chains, **WASM beats the GPU**.
 *
 * This test exists because we got the ordering wrong once, and the reason is
 * instructive: a separate bug meant the WASM module never loaded in browsers, so
 * the GPU was benchmarked against a **pure-JS** baseline and looked like a 2–2.9×
 * win. Once WASM actually loaded, the GPU turned out to be ~1.8× SLOWER — and
 * WASM is f64-exact where the GPU is f32. For memory-bound element-wise work the
 * GPU is therefore both slower and less precise, so it must never pre-empt WASM
 * in `fuseUnaryChainAsync`.
 *
 * (The GPU still wins decisively on compute-bound work — see `gpuMatmul`, where
 * O(n³) arithmetic amortizes the O(n²) transfer. This is about element-wise.)
 *
 * Note: the WASM bridge is SYNCHRONOUS while the browser WASM fetch is async, so
 * a browser caller must `await wasmLoader.load()` before the sync bridge can see
 * the module. That is what `beforeAll` does here.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { elementwiseChainGpuDispatch, type GpuElementwiseOp } from '../src/gpu/elementwise-gpu.js';
import { elementwiseChainDispatch } from '../src/wasm/elementwise/wasm-bridge.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { fuseUnaryChainAsync } from '../src/typed/fused.js';
import { enableGpu, disableGpu, GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';

const adapter =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? await navigator.gpu.requestAdapter().catch(() => null)
    : null;

const sample = (n: number): Float64Array =>
  Float64Array.from({ length: n }, (_, i) => 0.05 + (0.9 * (i % 977)) / 977);

beforeAll(async () => {
  enableGpu();
  await wasmLoader.load(); // the sync WASM bridge needs the module already resolved
});

describe('WASM loads in the browser', () => {
  it('elementwiseChainDispatch is ACTIVE (regression guard — it used to be dead)', () => {
    const out = elementwiseChainDispatch(['sin', 'exp'], sample(GPU_MIN_ELEMENTS));
    expect(
      out,
      'WASM chain dispatch returned null — the browser WASM path is dead again'
    ).not.toBeNull();
    expect(out!.length).toBe(GPU_MIN_ELEMENTS);
  });
});

describe.skipIf(!adapter)('for element-wise chains, WASM must beat the GPU', () => {
  it('measures JS vs WASM vs GPU and asserts WASM wins', async () => {
    const ops: GpuElementwiseOp[] = ['sin', 'exp', 'tanh', 'cos'];
    const REPS = 5;

    const time = async (f: () => unknown | Promise<unknown>): Promise<number> => {
      await f(); // warm up
      const t0 = performance.now();
      for (let r = 0; r < REPS; r++) await f();
      return (performance.now() - t0) / REPS;
    };

    const SCALAR: Record<string, (x: number) => number> = {
      sin: Math.sin,
      exp: Math.exp,
      tanh: Math.tanh,
      cos: Math.cos,
    };
    const jsChain = (xs: Float64Array): Float64Array => {
      const out = Float64Array.from(xs);
      for (const op of ops) {
        const f = SCALAR[op];
        for (let i = 0; i < out.length; i++) out[i] = f(out[i]);
      }
      return out;
    };

    console.log('[bench] chain sin->exp->tanh->cos   (5 reps, ms)');
    console.log('[bench]        n |       js |     wasm |      gpu | gpu-vs-wasm');

    const ratios: number[] = [];
    for (const n of [GPU_MIN_ELEMENTS, 1 << 18, 1 << 20]) {
      const xs = sample(n);
      const jsMs = await time(() => jsChain(xs));
      const wasmMs = await time(() => elementwiseChainDispatch(ops, xs));
      const gpuMs = await time(() => elementwiseChainGpuDispatch(ops, xs));
      const ratio = wasmMs / gpuMs; // < 1 means WASM is faster
      ratios.push(ratio);
      console.log(
        `[bench] ${String(n).padStart(8)} | ${jsMs.toFixed(2).padStart(8)} | ${wasmMs
          .toFixed(2)
          .padStart(8)} | ${gpuMs.toFixed(2).padStart(8)} | ${ratio.toFixed(2)}x`
      );
    }

    // The load-bearing assertion. If a future change ever makes the GPU beat WASM
    // here, this fails LOUDLY — and the tier order in `fuseUnaryChainAsync` should
    // then be revisited with these numbers, not with a guess.
    const worst = Math.max(...ratios);
    expect(
      worst,
      'GPU now beats WASM for element-wise chains — revisit the tier order in fuseUnaryChainAsync'
    ).toBeLessThan(1);
  }, 180_000);

  it('fuseUnaryChainAsync returns the exact f64 WASM result — WASM is tried first', async () => {
    const xs = sample(GPU_MIN_ELEMENTS);

    // GPU is ENABLED, a device exists, the size clears the threshold, and every op
    // has a GPU kernel — yet WASM must still win the dispatch, because it is both
    // faster and exact. A Float32Array here would mean the GPU pre-empted WASM.
    const out = await fuseUnaryChainAsync(['sin', 'exp'], xs);
    expect(out, 'GPU pre-empted WASM — tier-order regression').toBeInstanceOf(Float64Array);

    for (let i = 0; i < xs.length; i += 4096) {
      expect(out[i]).toBeCloseTo(Math.exp(Math.sin(xs[i])), 12);
    }

    disableGpu();
  });
});
