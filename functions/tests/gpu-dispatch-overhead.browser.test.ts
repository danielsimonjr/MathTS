/**
 * REGRESSION GUARD: the GPU wrapper must not dwarf the GPU kernel.
 *
 * `elementwiseChainGpuDispatch` once converted its input with
 * `Float32Array.from(f64array)`. That is NOT the typed-array fast path — it is
 * the generic `Array.from` algorithm, which walks the source through the
 * ArrayLike/iterator protocol and runs ToNumber on every element. Measured on
 * real hardware at n=2^20:
 *
 *     Float32Array.from(f64)  433.32 ms
 *     new Float32Array(f64)     5.92 ms      <- 73x faster, identical result
 *
 * A 2-op chain whose kernel takes ~23 ms was therefore billed ~470 ms, and the
 * GPU looked ~19x slower than it is. That bogus number is what made WASM appear
 * to beat the GPU, and the acceleration tier order was written around it.
 *
 * This test pins the wrapper tax. It fails at ~470 ms on the buggy code and
 * passes at ~35 ms once the conversion uses the constructor.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { getGpuDevice, GPU_MIN_ELEMENTS, enableGpu, disableGpu } from '@danielsimonjr/mathts-gpu';
import { elementwiseChainGpuDispatch } from '../src/gpu/elementwise-gpu.js';
import { isRealGpu, F32_REL_TOL } from './helpers/gpu-hardware.js';

const device = await getGpuDevice().catch(() => null);

// CI runs this suite on Mesa lavapipe (a CPU rasterizer), where a perf budget is
// meaningless — see helpers/gpu-hardware.ts. Correctness runs everywhere; the
// timing assertion runs only on real silicon.
const adapter =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? await navigator.gpu.requestAdapter().catch(() => null)
    : null;
const realGpu = await isRealGpu(adapter);

// enableGpu() flips PROCESS-GLOBAL state. Always put it back.
afterAll(() => disableGpu());

/**
 * Budget for a 2-op chain over 2^20 f64 inputs, end to end: convert, upload,
 * two compute passes, read back, and hand out an f32 array.
 *
 * The kernel itself is ~23 ms and the fixed wrapper lands around ~35 ms, so 120
 * ms is a >3x headroom against real variance (thermal state, a shared GPU,
 * another tab compositing). The bug it guards against costs ~433 ms — nearly 4x
 * the budget — so the gap is far too wide for noise to close in either
 * direction. Widen this only with a named cause, never to make a red run green.
 */
const BUDGET_MS = 120;

describe.skipIf(!device)('GPU dispatch overhead', () => {
  it.skipIf(!realGpu)(
    'does not pay a generic-path conversion tax on its input',
    async () => {
      enableGpu();
      const n = 1 << 20;
      expect(n).toBeGreaterThanOrEqual(GPU_MIN_ELEMENTS);

      const xs = Float64Array.from({ length: n }, (_, i) => 0.05 + (0.9 * (i % 977)) / 977);
      const ops = ['sin', 'exp'];

      await elementwiseChainGpuDispatch(ops, xs); // warm up: device, pipelines, pool

      const REPS = 5;
      const t0 = performance.now();
      for (let r = 0; r < REPS; r++) {
        const out = await elementwiseChainGpuDispatch(ops, xs);
        expect(out, 'GPU declined — this guard needs the GPU path live').not.toBeNull();
      }
      const ms = (performance.now() - t0) / REPS;

      console.log(`[overhead] elementwiseChainGpuDispatch 2 ops @ ${n}: ${ms.toFixed(2)} ms`);

      expect(
        ms,
        `GPU dispatch took ${ms.toFixed(0)}ms for a ~23ms kernel. Something in the wrapper ` +
          `is paying a per-element JS cost — check for TypedArray.from() on a typed array.`
      ).toBeLessThan(BUDGET_MS);
    },
    120_000
  );

  it('returns values equal to the scalar oracle', async () => {
    enableGpu();
    const n = GPU_MIN_ELEMENTS;
    const xs = Float64Array.from({ length: n }, (_, i) => 0.05 + (0.9 * (i % 977)) / 977);

    const out = await elementwiseChainGpuDispatch(['sin', 'exp'], xs);
    expect(out).not.toBeNull();

    // Relative error, against the adapter-appropriate f32 bound.
    for (let i = 0; i < n; i += 997) {
      const want = Math.exp(Math.sin(xs[i]));
      expect(Math.abs(out![i] - want) / Math.abs(want)).toBeLessThan(F32_REL_TOL);
    }
  }, 120_000);
});
