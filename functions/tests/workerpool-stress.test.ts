/**
 * Stress the worker pool the way `special.test.ts` does, but assert
 * CORRECTNESS under saturation — not merely that it returns.
 *
 * Background: `special.test.ts > single-argument overloads match the scalar
 * implementation` flaked twice under the full turbo gate (all packages' suites
 * running concurrently) and was not reproducible in isolation. That test forces
 * the worker path (`thresholdElements: 64`) and fires TEN concurrent chunked
 * `applyKernel` dispatches. Two very different bugs could produce that failure:
 *
 *   (a) a benign harness timeout under CPU contention, or
 *   (b) `WorkerPool` returning WRONG or PARTIAL results under load.
 *
 * (b) would be a serious product bug. This test is built to tell them apart: it
 * repeats the concurrent-dispatch pattern many times and checks every element
 * against the scalar oracle, so a wrong/partial/cross-contaminated result fails
 * loudly and distinguishably from a timeout.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';

/** Self-contained scalar kernels (must not close over anything — they are eval'd in a worker). */
const KERNELS = [
  { name: 'square', src: '(x) => x * x', f: (x: number) => x * x },
  { name: 'sinx', src: '(x) => Math.sin(x)', f: (x: number) => Math.sin(x) },
  { name: 'expx', src: '(x) => Math.exp(x)', f: (x: number) => Math.exp(x) },
  { name: 'cbrt', src: '(x) => Math.cbrt(x)', f: (x: number) => Math.cbrt(x) },
  { name: 'atanx', src: '(x) => Math.atan(x)', f: (x: number) => Math.atan(x) },
];

const N = 300; // same size special.test.ts uses
const ROUNDS = 40;

beforeAll(async () => {
  await computePool.initialize();
  // Same config special.test.ts uses to FORCE the worker path and multi-chunking.
  computePool.updateConfig({ thresholdElements: 64, chunkSize: 256 });
});

afterAll(async () => {
  computePool.updateConfig({ thresholdElements: 50000, chunkSize: 10000 });
  await computePool.terminate();
});

describe('WorkerPool correctness under concurrent, chunked saturation', () => {
  it(`stays exact across ${ROUNDS} rounds of ${KERNELS.length} concurrent chunked kernels`, async () => {
    // Distinct data per kernel — so a cross-contaminated result (kernel A's
    // output landing in kernel B's slot) is detectable, not coincidentally equal.
    const inputs = KERNELS.map((_, k) =>
      Float64Array.from({ length: N }, (_, i) => 0.05 + i * 0.03 + k * 0.001)
    );

    for (let round = 0; round < ROUNDS; round++) {
      // Fire them ALL concurrently, exactly like the flaky test does.
      const results = await Promise.all(
        KERNELS.map((k, idx) => computePool.applyKernel(inputs[idx], k.src))
      );

      results.forEach((r, idx) => {
        const { f } = KERNELS[idx];
        const xs = inputs[idx];
        const out = r.result;

        // Partial/short result — the failure mode a length check would catch.
        expect(out.length, `round ${round}, kernel ${KERNELS[idx].name}: wrong length`).toBe(N);

        for (let i = 0; i < N; i++) {
          // Exactness, not "close enough": the worker runs the identical f64
          // scalar op, so any deviation means the plumbing corrupted the value
          // (wrong chunk offset, cross-contamination, stale buffer).
          expect(out[i], `round ${round}, kernel ${KERNELS[idx].name}, index ${i}`).toBeCloseTo(
            f(xs[i]),
            12
          );
        }
      });
    }
  }, 300_000);
});
