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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  elementwiseChainGpuDispatch,
  GPU_ELEMENTWISE_OPS,
  type GpuElementwiseOp,
} from '../src/gpu/elementwise-gpu.js';
import { fuseUnaryChain, fuseUnaryChainAsync } from '../src/typed/fused.js';
import { enableGpu, disableGpu, GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';

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
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  cot: (x) => 1 / Math.tan(x),
};

/** Oracles for ops the GPU deliberately does NOT support (used to check fallback). */
const ORACLE_ALL = { expm1: Math.expm1, log1p: Math.log1p } as const;

/**
 * Inputs in (0, 1) — inside the domain of every op above (log/atanh need
 * x in (0,1); tan/sec/csc/cot stay away from their poles there).
 */
function sample(n: number): Float64Array {
  return Float64Array.from({ length: n }, (_, i) => 0.05 + (0.9 * (i % 977)) / 977);
}

/**
 * TRUE relative error.
 *
 * An earlier version divided by `Math.max(1, |w|)`, which silently degrades to
 * an ABSOLUTE error for every |w| < 1 — i.e. for every value in the sampled
 * domain. That made the metric structurally incapable of catching a
 * catastrophic relative error near zero (it missed `log1p` returning 0 for
 * 1e-8, a 100% relative error). Divide by |w|, with only a denormal-scale floor.
 */
function maxRelErr(got: ArrayLike<number>, want: (i: number) => number): number {
  let m = 0;
  for (let i = 0; i < got.length; i++) {
    const w = want(i);
    if (!Number.isFinite(w)) continue;
    const denom = Math.abs(w);
    m = Math.max(m, Math.abs(got[i] - w) / (denom > 1e-30 ? denom : 1e-30));
  }
  return m;
}

beforeAll(() => {
  enableGpu();
});

// `enableGpu()` flips PROCESS-GLOBAL state. Always put it back — this file is
// also collected by `functions/vitest.config.ts` under Node (where it self-skips),
// and a leaked flag would silently change sibling suites' behaviour.
afterAll(() => {
  disableGpu();
});

describe.skipIf(!HAS_GPU)('GPU element-wise kernels vs JS oracles', () => {
  const xs = sample(GPU_MIN_ELEMENTS);

  it.each(GPU_ELEMENTWISE_OPS)('%s matches the JS oracle within f32 tolerance', async (op) => {
    const got = await elementwiseChainGpuDispatch([op], xs);
    expect(got, `${op} returned null — the GPU tier did not engage`).not.toBeNull();

    const err = maxRelErr(got!, (i) => ORACLE[op](xs[i]));
    console.log(`[gpu] ${op}: max rel err = ${err.toExponential(2)}`);
    expect(err).toBeLessThan(1e-4);
  });

  /**
   * Near-zero regression guard for `expm1` / `log1p`.
   *
   * The naive identities `exp(x)-1` and `log(1+x)` are CATASTROPHIC here in
   * f32: `1.0 + 1e-8` rounds to exactly 1.0f, so `log(1+x)` returns 0 where the
   * true value is 1e-8 — a 100% relative error. The main sample domain
   * ([0.05, 0.95]) never goes near zero, so it cannot catch this. The kernels
   * use compensated (Kahan) forms; this test is what holds them to it.
   */
  it.each(['expm1', 'log1p'] as const)(
    '%s has NO GPU kernel and falls back (it cannot be computed accurately in f32)',
    async (op) => {
      const tiny = Float64Array.from({ length: GPU_MIN_ELEMENTS }, (_, i) =>
        // 1e-9 .. 1e-3, log-spaced — squarely in the catastrophic region.
        Math.pow(10, -9 + (6 * (i % 1000)) / 1000)
      );

      // Refusing to run is the CONTRACT, not a gap. WGSL has no expm1/log1p
      // builtin; the naive identity is ~100% wrong near zero, and even the
      // Kahan-compensated form measured 38%/62% max relative error on real
      // hardware (the GPU's fast-math `log()` is inaccurate near 1.0). An f32
      // fast path may be less precise; it may not be wrong.
      expect(await elementwiseChainGpuDispatch([op], tiny)).toBeNull();
      expect(GPU_ELEMENTWISE_OPS).not.toContain(op);

      // ...and the caller still gets an exact answer, from the CPU tiers.
      const viaChain = await fuseUnaryChainAsync([op], tiny);
      const err = maxRelErr(viaChain, (i) => ORACLE_ALL[op](tiny[i]));
      console.log(`[gpu] ${op} fell back; CPU max rel err = ${err.toExponential(2)}`);
      expect(err).toBeLessThan(1e-12);
    }
  );

  /**
   * IEEE parity at domain edges — the blind spot the old oracle could not see.
   *
   * `maxRelErr` SKIPS non-finite expectations, and the sample domain never hit an
   * edge, so `log(0)` / `atanh(2)` were entirely untested. WGSL leaves those
   * results INDETERMINATE (an implementation may return anything), while JS is
   * exact. The kernels now pin IEEE semantics explicitly; this asserts it, so a
   * driver that disagrees fails loudly instead of returning garbage silently.
   */
  it('matches JS exactly at domain edges (log(0), atanh(±1), out-of-domain NaN)', async () => {
    const cases: Array<[GpuElementwiseOp, number[]]> = [
      ['log', [0, -1, -0.5]],
      ['log2', [0, -1]],
      ['log10', [0, -1]],
      ['atanh', [1, -1, 2, -2]],
    ];
    const ORACLE_EDGE: Record<string, (x: number) => number> = {
      log: Math.log,
      log2: Math.log2,
      log10: Math.log10,
      atanh: Math.atanh,
    };

    for (const [op, edges] of cases) {
      const xs = new Float64Array(GPU_MIN_ELEMENTS);
      edges.forEach((v, i) => (xs[i] = v));
      const got = await elementwiseChainGpuDispatch([op], xs);
      expect(got).not.toBeNull();

      edges.forEach((v, i) => {
        const want = ORACLE_EDGE[op](v);
        const g = got![i];
        if (Number.isNaN(want)) {
          expect(Number.isNaN(g), `${op}(${v}) should be NaN, got ${g}`).toBe(true);
        } else {
          // -Infinity / +Infinity must match exactly, not "closely".
          expect(g, `${op}(${v})`).toBe(want);
        }
      });
    }
  });

  it('honours a per-call { gpu } override, independent of the global flag', async () => {
    const xs = sample(GPU_MIN_ELEMENTS);
    disableGpu(); // global OFF...
    // ...but an explicit per-call opt-in still runs.
    expect(await elementwiseChainGpuDispatch(['sin'], xs, { gpu: true })).not.toBeNull();
    // ...and an explicit opt-out wins even when the global is ON.
    enableGpu();
    expect(await elementwiseChainGpuDispatch(['sin'], xs, { gpu: false })).toBeNull();
    enableGpu();
  });

  it('stays correct across repeated calls (pooled buffers are reused, not stale)', async () => {
    // BufferPool recycles and rounds sizes UP, so a later call can receive a
    // buffer larger than its data and still holding a previous call's values.
    // The kernel bounds-checks against the `n` uniform, so this must stay exact.
    const big = sample(GPU_MIN_ELEMENTS * 2);
    const small = sample(GPU_MIN_ELEMENTS);
    await elementwiseChainGpuDispatch(['exp'], big); // dirty the pool with larger buffers
    const got = await elementwiseChainGpuDispatch(['sin'], small);
    expect(got).not.toBeNull();
    expect(got!.length).toBe(small.length);
    const err = maxRelErr(got!, (i) => Math.sin(small[i]));
    console.log(`[gpu] pooled-reuse sin: max rel err = ${err.toExponential(2)}`);
    expect(err).toBeLessThan(1e-4);
  });

  it('fused chain exp(sin(x)) matches the composed oracle', async () => {
    const got = await elementwiseChainGpuDispatch(['sin', 'exp'], xs);
    expect(got).not.toBeNull();
    const err = maxRelErr(got!, (i) => Math.exp(Math.sin(xs[i])));
    console.log(`[gpu] chain exp(sin(x)): max rel err = ${err.toExponential(2)}`);
    expect(err).toBeLessThan(1e-4);
  });

  // Ping-pong parity: the buffers swap once per op, so an ODD-length chain ends
  // in the opposite buffer from an EVEN-length one. Both parities must read back
  // the last op's output. (Length 1 and 2 are already covered by the single-op
  // and exp(sin(x)) tests; 3 and 4 pin it again at depth.)
  it.each([
    [['sin', 'abs', 'tanh'] as GpuElementwiseOp[]], // odd
    [['sin', 'abs', 'tanh', 'atan'] as GpuElementwiseOp[]], // even
  ])('chain %s reads back the final op (ping-pong parity)', async (ops) => {
    const got = await elementwiseChainGpuDispatch(ops, xs);
    expect(got).not.toBeNull();
    const err = maxRelErr(got!, (i) => ops.reduce((acc, op) => ORACLE[op](acc), xs[i] as number));
    console.log(`[gpu] chain ${ops.join('->')}: max rel err = ${err.toExponential(2)}`);
    expect(err).toBeLessThan(1e-3);
  });
});

describe.skipIf(!HAS_GPU)('MEASUREMENT — does the GPU actually win?', () => {
  /**
   * NOTE ON THE BASELINE: this suite never calls `wasmLoader.load()` (only
   * `enableGpu()` in `beforeAll`), so `elementwiseChainDispatch` still
   * returns `null` HERE and `fuseUnaryChain` degrades to the pure-JS scalar
   * pass — same as every other caller that hasn't awaited an explicit WASM
   * load. (This is not a browser-specific limitation: as of the 2026-07-13
   * fix, `wasmLoader.load()` resolves and engages the AS binary in the
   * browser too — see `elementwise-wasm.browser.test.ts` — it's just not
   * invoked in this file, since this suite measures the GPU tier.) The
   * comparison below is therefore **GPU vs JS**, the honest baseline for a
   * consumer who hasn't opted into the WASM tier. It is NOT a GPU-vs-WASM
   * claim.
   *
   * Sizes start AT the threshold: below it the dispatcher returns `null`
   * immediately, so timing it would measure a no-op, not GPU work.
   */
  it('benchmarks GPU vs the browser CPU path for a fused chain across sizes', async () => {
    const ops: GpuElementwiseOp[] = ['sin', 'exp', 'tanh', 'cos'];
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
      // NOTE: this is fuseUnaryChain WITHOUT an awaited wasmLoader.load(), so the
      // sync WASM bridge has no module yet and this measures the JS scalar pass.
      // The true GPU-vs-WASM comparison lives in gpu-vs-wasm.browser.test.ts:
      // the GPU is 3.2-8.3x FASTER than WASM for element-wise chains (and f32, not f64).
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
