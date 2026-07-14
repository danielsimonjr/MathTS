/**
 * GPU fused chain + on-device reduction.
 *
 * The measured case for building this — end-to-end through the shipped functions,
 * `sum(exp(sin(x)))`, NVIDIA Pascal:
 *
 *   | n         | WASM+jsSum | gpuChain+jsSum | fused gpuReduce |
 *   | 262,144   |    25.6 ms |        16.7 ms |     **9.9 ms**  |
 *   | 1,048,576 |    96.8 ms |        34.3 ms |    **25.4 ms**  |
 *   | 4,194,304 |   260.0 ms |       100.0 ms |    **72.2 ms**  |
 *
 * 1.35-1.7x over the shipped GPU path and 2.6-3.8x over the CPU tier, because it
 * replaces an n-float readback with an n/256-float one.
 *
 * It is also NARROW, and the tests below pin the boundary: it only pays when the
 * caller wants ONLY the scalar. A *standalone* GPU reduction (no chain) uploads n
 * floats to return one number and LOSES to a plain JS sum by 3-9x — so `ops` must
 * be non-empty, and the dispatch declines otherwise rather than quietly selling a
 * slower path.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  elementwiseChainReduceGpuDispatch,
  elementwiseChainGpuDispatch,
  type GpuElementwiseOp,
} from '../src/gpu/elementwise-gpu.js';
import { fuseUnaryChainReduceAsync } from '../src/typed/fused.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { getGpuDevice, enableGpu, disableGpu, GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';
import { REAL_GPU, F32_REL_TOL } from './helpers/gpu-hardware.js';

const device = await getGpuDevice().catch(() => null);

beforeAll(async () => {
  enableGpu();
  await wasmLoader.load();
});
afterAll(() => disableGpu()); // enableGpu() is PROCESS-GLOBAL state. Put it back.

const N = GPU_MIN_ELEMENTS;
const sample = (n: number): Float64Array =>
  Float64Array.from({ length: n }, (_, i) => 0.05 + (0.9 * (i % 977)) / 977);

const CHAIN: GpuElementwiseOp[] = ['sin', 'exp'];
const scalar = (x: number): number => Math.exp(Math.sin(x));

describe.skipIf(!device)('GPU fused chain + reduction', () => {
  it('sum matches an independent f64 oracle', async () => {
    const xs = sample(N);
    const got = await elementwiseChainReduceGpuDispatch(CHAIN, xs, 'sum');
    expect(got, 'GPU declined — the reduce tier did not engage').not.toBeNull();

    let want = 0;
    for (let i = 0; i < xs.length; i++) want += scalar(xs[i]);
    expect(Math.abs(got! - want) / Math.abs(want)).toBeLessThan(F32_REL_TOL);
  }, 120_000);

  it('max and min match the f64 oracle', async () => {
    const xs = sample(N);

    const gotMax = await elementwiseChainReduceGpuDispatch(CHAIN, xs, 'max');
    const gotMin = await elementwiseChainReduceGpuDispatch(CHAIN, xs, 'min');
    expect(gotMax).not.toBeNull();
    expect(gotMin).not.toBeNull();

    let want = { max: -Infinity, min: Infinity };
    for (let i = 0; i < xs.length; i++) {
      const v = scalar(xs[i]);
      want = { max: Math.max(want.max, v), min: Math.min(want.min, v) };
    }
    expect(Math.abs(gotMax! - want.max) / Math.abs(want.max)).toBeLessThan(F32_REL_TOL);
    expect(Math.abs(gotMin! - want.min) / Math.abs(want.min)).toBeLessThan(F32_REL_TOL);
  }, 120_000);

  it('is correct when n is NOT a multiple of the workgroup size', async () => {
    // n=65536 is EXACTLY 256 workgroups, so the tests above never take the
    // out-of-range branch at all. Only a ragged tail does. +37 => 257 workgroups,
    // the last of which has 37/256 lanes in range and 219 on the identity.
    const n = GPU_MIN_ELEMENTS + 37;
    const xs = sample(n);

    const gotSum = await elementwiseChainReduceGpuDispatch(CHAIN, xs, 'sum');
    const gotMin = await elementwiseChainReduceGpuDispatch(CHAIN, xs, 'min');
    expect(gotSum).not.toBeNull();
    expect(gotMin).not.toBeNull();

    let want = 0;
    let wantMin = Infinity;
    for (let i = 0; i < n; i++) {
      const v = scalar(xs[i]);
      want += v;
      wantMin = Math.min(wantMin, v);
    }
    expect(Math.abs(gotSum! - want) / Math.abs(want)).toBeLessThan(F32_REL_TOL);
    expect(Math.abs(gotMin! - wantMin) / Math.abs(wantMin)).toBeLessThan(F32_REL_TOL);
  }, 120_000);

  it('max on a ragged tail with an ALL-NEGATIVE chain (the identity must be -inf)', async () => {
    // This is the test that can actually fail if the `max` identity is wrong, and
    // NOTHING else here can.
    //
    // Every other case feeds exp(sin(x)) in [1.05, 2.25] — strictly positive. A
    // broken identity of 0.0 would give max(0, 2.25) = 2.25 and pass every oracle
    // above. So: a ragged tail (to reach the identity branch at all) over a chain
    // whose output is entirely NEGATIVE. With a 0.0 identity the answer clamps to
    // 0; with -inf it is the true max.
    const n = GPU_MIN_ELEMENTS + 37;
    const xs = Float64Array.from({ length: n }, (_, i) => -0.05 - (2.9 * (i % 977)) / 977);
    const negChain: GpuElementwiseOp[] = ['sin']; // sin(x) < 0 for x in [-2.95, -0.05]

    const got = await elementwiseChainReduceGpuDispatch(negChain, xs, 'max');
    expect(got).not.toBeNull();

    let want = -Infinity;
    for (let i = 0; i < n; i++) want = Math.max(want, Math.sin(xs[i]));
    expect(want, 'test is void unless every value is negative').toBeLessThan(0);

    expect(
      Math.abs(got! - want) / Math.abs(want),
      'max was clamped upward — the out-of-range identity is not -inf'
    ).toBeLessThan(F32_REL_TOL);
  }, 120_000);

  it('two dispatches in flight at once do not corrupt each other', async () => {
    // The WebGPU error scope is a per-device LIFO STACK: with unserialized dispatches,
    // A pushes, B pushes, A pops -> A pops B's scope, and a real validation error can
    // go unobserved (returning a zeroed buffer as a plausible `sum`). `serializeGpu`
    // exists to prevent that; this pins it with an ordinary Promise.all.
    const xs = sample(GPU_MIN_ELEMENTS);
    let wantSum = 0;
    let wantMin = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const v = scalar(xs[i]);
      wantSum += v;
      wantMin = Math.min(wantMin, v);
    }

    const [a, b, c] = await Promise.all([
      elementwiseChainReduceGpuDispatch(CHAIN, xs, 'sum'),
      elementwiseChainReduceGpuDispatch(CHAIN, xs, 'min'),
      elementwiseChainGpuDispatch(CHAIN, xs),
    ]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();
    expect(Math.abs(a! - wantSum) / wantSum).toBeLessThan(F32_REL_TOL);
    expect(Math.abs(b! - wantMin) / Math.abs(wantMin)).toBeLessThan(F32_REL_TOL);
    expect(c!.length).toBe(xs.length);
    expect(Math.abs(c![0] - scalar(xs[0])) / scalar(xs[0])).toBeLessThan(F32_REL_TOL);
  }, 120_000);

  it('DECLINES an empty chain — a standalone GPU reduction is a measured loss', async () => {
    // Not an oversight: uploading n floats to return one number loses to a plain
    // JS sum by 3-9x. Returning null makes the caller fall back to the CPU, which
    // is genuinely faster here.
    const got = await elementwiseChainReduceGpuDispatch([], sample(N), 'sum');
    expect(got, 'a standalone GPU reduction must be declined, not served').toBeNull();
  }, 120_000);

  it('declines below the threshold, and when the caller has not opted in', async () => {
    const small = sample(1024);
    expect(await elementwiseChainReduceGpuDispatch(CHAIN, small, 'sum')).toBeNull();

    // Per-call override beats the process-global flag.
    expect(
      await elementwiseChainReduceGpuDispatch(CHAIN, sample(N), 'sum', { gpu: false })
    ).toBeNull();
  }, 120_000);

  it('fuseUnaryChainReduceAsync: GPU when enabled, exact f64 CPU when not', async () => {
    const xs = sample(N);
    let want = 0;
    for (let i = 0; i < xs.length; i++) want += scalar(xs[i]);

    enableGpu();
    const onGpu = await fuseUnaryChainReduceAsync(CHAIN, xs, 'sum');
    expect(Math.abs(onGpu - want) / want).toBeLessThan(F32_REL_TOL);

    disableGpu();
    try {
      const onCpu = await fuseUnaryChainReduceAsync(CHAIN, xs, 'sum');
      // The CPU path is f64 throughout, so it must be far more accurate than f32.
      expect(Math.abs(onCpu - want) / want).toBeLessThan(1e-12);
    } finally {
      enableGpu();
    }
  }, 120_000);

  // Perf only on real silicon: a software rasterizer answers a hardware question
  // with noise. Correctness above stays ungated and runs on CI.
  it.skipIf(!REAL_GPU)(
    'beats reading the whole array back and summing on the CPU',
    async () => {
      // n=2^22 on purpose. The D/C ratio is NOISY at smaller sizes (measured 1.19x-2.83x
      // across runs at 2^18/2^20 — the GPU work is short enough that fixed costs dominate)
      // and STABLE here: 1.31x, 1.35x, 1.36x, 1.39x across four runs. A wall-clock ratio is
      // only worth asserting where it is reproducible.
      const n = 1 << 22;
      const xs = sample(n);
      const REPS = 5;

      const time = async (f: () => Promise<unknown>): Promise<number> => {
        expect(await f()).toBeTruthy();
        const t0 = performance.now();
        for (let r = 0; r < REPS; r++) expect(await f()).toBeTruthy();
        return (performance.now() - t0) / REPS;
      };

      // What we shipped before this: chain on the GPU, read back n floats, sum on CPU.
      const readbackThenSum = await time(async () => {
        const out = await elementwiseChainGpuDispatch(CHAIN, xs);
        if (!out) return null;
        let s = 0;
        for (let i = 0; i < out.length; i++) s += out[i];
        return s;
      });
      const fusedReduce = await time(() => elementwiseChainReduceGpuDispatch(CHAIN, xs, 'sum'));

      console.log(
        `[reduce] n=${n}: readback+cpuSum ${readbackThenSum.toFixed(2)}ms  ` +
          `fusedReduce ${fusedReduce.toFixed(2)}ms  (${(readbackThenSum / fusedReduce).toFixed(2)}x)`
      );

      // Measured 1.31-1.39x here across four runs. The bar is 1.15x: enough headroom for
      // thermal state and a shared GPU, and still decisive — if the on-device reduction
      // regressed to a full n-float readback, this ratio would collapse to ~1.0.
      //
      // The margin is modest because the f64->f32 conversion is an n-scaling cost that
      // BOTH paths pay, which dilutes the ratio (the absolute saving is ~28 ms). Do not
      // "fix" a failure here by lowering the bar toward 1.0 — that is the failure.
      expect(
        readbackThenSum / fusedReduce,
        'the fused reduction no longer beats reading the array back — its entire reason to exist'
      ).toBeGreaterThan(1.15);
    },
    180_000
  );
});
