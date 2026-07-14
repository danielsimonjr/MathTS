/**
 * The benchmark that REGENERATES the FFT table quoted in the CHANGELOG, the docs, and
 * `fft-gpu.ts`. Run it before you change any of those numbers.
 *
 * It exists because a reviewer pointed out that the published table was reproducible by
 * nothing in the repo — and by then the table had already been wrong twice (a cold-JIT CPU
 * baseline, and a CPU path `parallelFFT` never actually takes).
 *
 * Perf only on real silicon; on CI's software adapter these numbers are meaningless.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fftGpuDispatch } from '../src/gpu/fft-gpu.js';
import { fftCoreFloat64 } from '../src/signal/fft-core-f64.js';
import { getGpuDevice, enableGpu, disableGpu } from '@danielsimonjr/mathts-gpu';
import { REAL_GPU } from './helpers/gpu-hardware.js';

const device = await getGpuDevice().catch(() => null);
beforeAll(() => enableGpu());
afterAll(() => disableGpu());

describe.skipIf(!device || !REAL_GPU)('GPU FFT — published benchmark', () => {
  it('regenerates the CPU-vs-GPU table', async () => {
    const WARM = 5;
    const REPS = 7;

    // Refuses to time a tier that produced nothing: a declined dispatch returns null in ~0ms
    // and would print a fake speedup. That bug has already reported a dead tier as
    // "infinitely fast" once in this project.
    const time = async (label: string, f: () => unknown): Promise<number> => {
      for (let w = 0; w < WARM; w++) {
        expect(await f(), `${label} produced nothing`).toBeTruthy();
      }
      const t0 = performance.now();
      for (let r = 0; r < REPS; r++) {
        expect(await f(), `${label} returned null mid-benchmark`).toBeTruthy();
      }
      return (performance.now() - t0) / REPS;
    };

    console.log('[fftbench]        n | CPU f64 core | GPU f32 | speedup');
    const rows: Array<{ n: number; ratio: number }> = [];

    for (const n of [1 << 18, 1 << 19, 1 << 20, 1 << 21]) {
      const x = Float64Array.from(
        { length: n },
        (_, i) => Math.sin(i * 0.01) + 0.5 * Math.cos(i * 0.033)
      );
      const zeros = new Float64Array(n);

      // Buffers reused: no multi-MB allocation inside the timed region. `fftCoreFloat64` does
      // not mutate its inputs (it allocates internally and bit-reverse-copies), so defensive
      // copies here would only inflate the CPU baseline — the same class of self-inflicted
      // wound as `Float64Array.from()` on a typed array.
      const cpu = await time('cpu', () => fftCoreFloat64(x, zeros, false));
      const gpu = await time('gpu', () => fftGpuDispatch(x, zeros, false));

      rows.push({ n, ratio: cpu / gpu });
      console.log(
        `[fftbench] ${String(n).padStart(8)} | ${cpu.toFixed(1).padStart(12)} | ${gpu.toFixed(1).padStart(7)} | ${(cpu / gpu).toFixed(2)}x`
      );
    }

    // Gate on a size where the margin is ROBUST, not on the threshold row.
    //
    // 262,144 is the crossover — by construction the most marginal row and the most sensitive
    // to load. Measured 2.2-2.6x alone but 1.78x when the whole browser suite is contending for
    // the same GPU. Asserting there would be asserting on machine contention, which is exactly
    // why the CPU benchmarks were moved out of the aggregate. Every row is still PRINTED (it is
    // the published table); only the assertion moves.
    //
    // At n=2^20 the margin is 3.1-3.2x whether isolated or contended, so a 2.0x bar has ~55%
    // headroom and still fails loudly if the kernel regresses to CPU-competitive.
    const big = rows.find((r) => r.n === 1 << 20);
    expect(big, 'the n=2^20 row is the one we gate on — it must be measured').toBeDefined();
    expect(
      big!.ratio,
      'the GPU FFT no longer clears its published margin at n=2^20'
    ).toBeGreaterThan(2.0);

    // And it must never be SLOWER than the CPU at any measured size.
    const worst = Math.min(...rows.map((r) => r.ratio));
    expect(worst, 'the GPU FFT is slower than the CPU core at some size').toBeGreaterThan(1.0);
  }, 600_000);
});
