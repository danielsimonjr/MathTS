/**
 * REAL-GPU validation + measurement for the fused element-wise chain.
 *
 * Two jobs:
 *  1. Correctness — every WGSL kernel is compared against an independent JS
 *     oracle within an f32 tolerance, and the fused chain is compared against
 *     the composed scalar chain. (WGSL compile errors are otherwise SILENT.)
 *  2. Measurement — GPU vs WASM vs JS for the same chain across sizes. The GPU
 *     tier only earns its place if it actually wins; the numbers are printed so
 *     the threshold is chosen from data rather than guessed.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  elementwiseChainGpuDispatch,
  GPU_ELEMENTWISE_OPS,
  type GpuElementwiseOp,
} from '../src/gpu/elementwise-gpu.js';
import { fuseUnaryChain } from '../src/typed/fused.js';
import { enableGpu, GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';

const adapter =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? await navigator.gpu.requestAdapter().catch(() => null)
    : null;
const HAS_GPU = adapter !== null;

/** Independent f64 oracles — deliberately NOT the implementation under test. */
const ORACLE: Record<GpuElementwiseOp, (x: number) => number> = {
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  log: Math.log,
  atan: Math.atan,
  sinh: Math.sinh,
  tanh: Math.tanh,
  atanh: Math.atanh,
  log2: Math.log2,
  log10: Math.log10,
  expm1: Math.expm1,
  log1p: Math.log1p,
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  cot: (x) => 1 / Math.tan(x),
};

/**
 * Inputs in (0, 1) — inside the domain of every op above (log/atanh need
 * x in (0,1); tan/sec/csc/cot stay away from their poles there).
 */
function sample(n: number): Float64Array {
  return Float64Array.from({ length: n }, (_, i) => 0.05 + (0.9 * (i % 977)) / 977);
}

function maxRelErr(got: ArrayLike<number>, want: (i: number) => number): number {
  let m = 0;
  for (let i = 0; i < got.length; i++) {
    const w = want(i);
    if (!Number.isFinite(w)) continue;
    m = Math.max(m, Math.abs(got[i] - w) / Math.max(1, Math.abs(w)));
  }
  return m;
}

beforeAll(() => {
  enableGpu();
});

describe.skipIf(!HAS_GPU)('GPU element-wise kernels vs JS oracles', () => {
  const xs = sample(GPU_MIN_ELEMENTS);

  it.each(GPU_ELEMENTWISE_OPS)('%s matches the JS oracle within f32 tolerance', async (op) => {
    const got = await elementwiseChainGpuDispatch([op], xs);
    expect(got, `${op} returned null — the GPU tier did not engage`).not.toBeNull();

    const err = maxRelErr(got!, (i) => ORACLE[op](xs[i]));
    // expm1/log1p use naive identities in f32 and lose relative precision near
    // zero; the rest track the hardware transcendentals closely.
    const tol = op === 'expm1' || op === 'log1p' ? 1e-3 : 1e-4;
    console.log(`[gpu] ${op}: max rel err = ${err.toExponential(2)}`);
    expect(err).toBeLessThan(tol);
  });

  it('fused chain exp(sin(x)) matches the composed oracle', async () => {
    const got = await elementwiseChainGpuDispatch(['sin', 'exp'], xs);
    expect(got).not.toBeNull();
    const err = maxRelErr(got!, (i) => Math.exp(Math.sin(xs[i])));
    console.log(`[gpu] chain exp(sin(x)): max rel err = ${err.toExponential(2)}`);
    expect(err).toBeLessThan(1e-4);
  });

  it('a 4-op chain stays correct (proves the ping-pong buffers are wired right)', async () => {
    // An odd/even mix of chain lengths catches a swapped src/dst buffer.
    const ops: GpuElementwiseOp[] = ['sin', 'abs', 'log1p', 'tanh'];
    const got = await elementwiseChainGpuDispatch(ops, xs);
    expect(got).not.toBeNull();
    const err = maxRelErr(got!, (i) => ops.reduce((acc, op) => ORACLE[op](acc), xs[i] as number));
    console.log(`[gpu] chain ${ops.join('->')}: max rel err = ${err.toExponential(2)}`);
    expect(err).toBeLessThan(1e-3);
  });
});

describe.skipIf(!HAS_GPU)('MEASUREMENT — does the GPU actually win?', () => {
  /**
   * NOTE ON THE BASELINE: in the browser the WASM tier does NOT load
   * (`elementwiseChainDispatch` returns null there), so `fuseUnaryChain`
   * degrades to the pure-JS scalar pass. The comparison below is therefore
   * **GPU vs JS** — which is the honest real-world comparison for a browser,
   * because JS is what actually runs there today. It is NOT a GPU-vs-WASM
   * claim.
   *
   * Sizes start AT the threshold: below it the dispatcher returns `null`
   * immediately, so timing it would measure a no-op, not GPU work.
   */
  it('benchmarks GPU vs the browser CPU path for a fused chain across sizes', async () => {
    const ops: GpuElementwiseOp[] = ['sin', 'exp', 'tanh', 'log1p'];
    const sizes = [GPU_MIN_ELEMENTS, 1 << 18, 1 << 20, 1 << 22];
    const REPS = 5;

    const time = async (f: () => unknown | Promise<unknown>): Promise<number> => {
      await f(); // warm up (shader compile, pipeline cache, JIT)
      const t0 = performance.now();
      for (let r = 0; r < REPS; r++) await f();
      return (performance.now() - t0) / REPS;
    };

    console.log(`\n[bench] fused chain ${ops.join('->')}  (${REPS} reps, ms)`);
    console.log('[bench]        n | js (cpu) |      gpu | speedup');

    const rows: { n: number; cpu: number; gpu: number }[] = [];
    for (const n of sizes) {
      const xs = sample(n);
      // In-browser this is the pure-JS scalar pass (WASM does not load here).
      const cpu = await time(() => fuseUnaryChain(ops, xs));
      const gpu = await time(() => elementwiseChainGpuDispatch(ops, xs));
      rows.push({ n, cpu, gpu });
      const speedup = cpu / gpu;
      console.log(
        `[bench] ${String(n).padStart(8)} | ${cpu.toFixed(2).padStart(8)} | ${gpu
          .toFixed(2)
          .padStart(8)} | ${speedup.toFixed(2)}x`
      );
    }

    // Not a perf assertion (hardware varies) — just prove the tier ran and is
    // measurable. The numbers above are what decides the threshold.
    expect(rows.every((r) => r.gpu > 0)).toBe(true);
  }, 120_000);
});
