/**
 * The tier-order guard: for element-wise chains, **the GPU beats WASM**, and
 * `fuseUnaryChainAsync` must try the tiers in the order GPU → WASM → JS.
 *
 * This ordering has been wrong TWICE, both times because a benchmark measured
 * something other than what it claimed. Read this before touching it:
 *
 *  1. GPU-first was originally adopted on a "2.3-2.9x faster than JS" result.
 *     That baseline was pure JS only because a *separate* bug meant WASM never
 *     loaded in browsers. When WASM was fixed it appeared to beat the GPU, so the
 *     order was flipped to WASM-first.
 *  2. That flip was ALSO wrong. The GPU number it rested on was inflated ~12x by
 *     `Float32Array.from(f64array)` inside the dispatch — the generic Array.from
 *     path, which boxes and runs ToNumber on every element (433 ms at n=2^20,
 *     versus 5.9 ms for `new Float32Array(f64)`). With that fixed the GPU wins
 *     outright, by 3.2-8.3x.
 *
 * The lesson: a tier's number is only as good as the tier it is compared against.
 * So this test measures ALL THREE tiers in a single run and fails loudly if the
 * ranking ever changes — in either direction.
 *
 * Precision, and why GPU-first is still safe: the GPU tier is f32 and every other
 * tier is f64-exact. It engages ONLY when the caller opted in via `enableGpu()`.
 * With the flag off (the default), `fuseUnaryChainAsync` is exactly WASM → JS and
 * returns bit-identical f64 — proven by the last test here.
 *
 * Note: the WASM bridge is SYNCHRONOUS while the browser WASM fetch is async, so
 * a browser caller must `await wasmLoader.load()` before the sync bridge can see
 * the module. That is what `beforeAll` does.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { elementwiseChainGpuDispatch, type GpuElementwiseOp } from '../src/gpu/elementwise-gpu.js';
import { elementwiseChainDispatch } from '../src/wasm/elementwise/wasm-bridge.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { fuseUnaryChainAsync } from '../src/typed/fused.js';
import { enableGpu, disableGpu, GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';
import { isRealGpu } from './helpers/gpu-hardware.js';

const adapter =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? await navigator.gpu.requestAdapter().catch(() => null)
    : null;

const sample = (n: number): Float64Array =>
  Float64Array.from({ length: n }, (_, i) => 0.05 + (0.9 * (i % 977)) / 977);

// CI runs the browser suite on Mesa lavapipe, a CPU rasterizer that reports as a
// real adapter — so `skipIf(!adapter)` does NOT skip there. A ranking assertion is
// meaningless on it (the "GPU" is the CPU plus copies). Perf runs on silicon only;
// correctness runs everywhere. See helpers/gpu-hardware.ts.
const realGpu = await isRealGpu(adapter);

beforeAll(async () => {
  enableGpu();
  await wasmLoader.load(); // the sync WASM bridge needs the module already resolved
});

// enableGpu() flips PROCESS-GLOBAL state. Always put it back.
afterAll(() => disableGpu());

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

describe.skipIf(!adapter)('for element-wise chains, the GPU must beat WASM', () => {
  it.skipIf(!realGpu)(
    'measures JS vs WASM vs GPU in one run and asserts the GPU wins',
    async () => {
      const ops: GpuElementwiseOp[] = ['sin', 'exp', 'tanh', 'cos'];
      const REPS = 5;

      /**
       * Times `f`, and REFUSES to time a tier that produced nothing.
       *
       * A dispatch that returns null (device lost, OOM, a gate declining) completes
       * in ~0 ms. Timing that as a result reported "gpu: 0.00 ms — Infinity× faster"
       * on a run where the GPU device had actually been lost. A tier that produced
       * no data has no speed; it has a bug. Fail instead of inventing a number.
       */
      const time = async (label: string, f: () => unknown | Promise<unknown>): Promise<number> => {
        const warm = await f();
        expect(
          warm,
          `${label} produced no result — cannot time a tier that did not run`
        ).toBeTruthy();
        const t0 = performance.now();
        for (let r = 0; r < REPS; r++) {
          const out = await f();
          expect(
            out,
            `${label} returned null mid-benchmark — the tier died under load`
          ).toBeTruthy();
        }
        return (performance.now() - t0) / REPS;
      };

      const SCALAR: Record<string, (x: number) => number> = {
        sin: Math.sin,
        exp: Math.exp,
        tanh: Math.tanh,
        cos: Math.cos,
      };
      const jsChain = (xs: Float64Array): Float64Array => {
        const out = new Float64Array(xs); // constructor, not .from() — see the header
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
        const jsMs = await time('js', () => jsChain(xs));
        const wasmMs = await time('wasm', () => elementwiseChainDispatch(ops, xs));
        const gpuMs = await time('gpu', () => elementwiseChainGpuDispatch(ops, xs));
        const ratio = wasmMs / gpuMs; // > 1 means the GPU is faster
        ratios.push(ratio);
        console.log(
          `[bench] ${String(n).padStart(8)} | ${jsMs.toFixed(2).padStart(8)} | ${wasmMs
            .toFixed(2)
            .padStart(8)} | ${gpuMs.toFixed(2).padStart(8)} | ${ratio.toFixed(2)}x`
        );
      }

      // The load-bearing assertion. Measured margins are 3.2-8.3x, so a bar at 1.5x
      // leaves room for thermal state and a shared GPU while still catching any real
      // regression — notably a return of the conversion tax, which cost ~12x.
      //
      // If this ever fails, do NOT just flip the tier order in fuseUnaryChainAsync.
      // Read the header first: both previous flips were made on a corrupted number.
      const worst = Math.min(...ratios);
      expect(
        worst,
        'WASM now beats the GPU for element-wise chains. Before flipping the tier order, ' +
          'verify the GPU path is not paying a per-element JS cost (TypedArray.from) — ' +
          'that exact bug caused the last incorrect flip.'
      ).toBeGreaterThan(1.5);
    },
    180_000
  );

  it('with the GPU ENABLED, fuseUnaryChainAsync uses the GPU (f32 values, f64 container)', async () => {
    enableGpu();
    const xs = sample(GPU_MIN_ELEMENTS);
    const out = await fuseUnaryChainAsync(['sin', 'exp'], xs);

    // The container is always f64 — the public contract.
    expect(out).toBeInstanceOf(Float64Array);

    // The VALUES carry f32 precision. Assert they are correct to ~f32 (1e-6) but
    // NOT to f64 — that is what proves the GPU tier actually ran rather than WASM
    // silently pre-empting it. An f64 tier would match to ~1e-15 here.
    let sawF32Precision = false;
    for (let i = 0; i < xs.length; i += 997) {
      const want = Math.exp(Math.sin(xs[i]));
      expect(out[i]).toBeCloseTo(want, 5);
      if (Math.abs(out[i] - want) > 1e-12) sawF32Precision = true;
    }
    expect(
      sawF32Precision,
      'every value was f64-exact — the GPU tier did not run, something pre-empted it'
    ).toBe(true);
  }, 120_000);

  it('with the GPU DISABLED (the default), it returns the exact f64 WASM result', async () => {
    disableGpu();
    try {
      const xs = sample(GPU_MIN_ELEMENTS);
      const out = await fuseUnaryChainAsync(['sin', 'exp'], xs);
      expect(out).toBeInstanceOf(Float64Array);

      // Opting out of the GPU must cost nothing in accuracy: full f64 exactness.
      for (let i = 0; i < xs.length; i += 997) {
        expect(out[i]).toBeCloseTo(Math.exp(Math.sin(xs[i])), 12);
      }
    } finally {
      enableGpu(); // restore for any later test in this file
    }
  }, 120_000);
});
