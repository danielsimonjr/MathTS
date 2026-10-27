/**
 * Shared parallel array-evaluation helpers for the typed math surfaces.
 *
 * `kernelSource` and `mapArray` were previously duplicated verbatim in
 * `typed/special.ts` and `typed/distributions.ts`; they now live here once.
 * `mapBinaryF64` centralizes the shared sequential/worker loop for binary
 * `Float64Array` typed overloads in signal (FFT magnitude/power).
 * Unary Float64Array overloads keep per-function inlined `Math.*` loops:
 * a shared callback (`mapUnaryFloat64`) was measured megamorphic and
 * 56–643% slower on the n<50k sequential path (see PR #454 review).
 *
 * Both helpers run on the MAIN THREAD (they build the kernel source string and
 * dispatch it), so they may freely import — they are never themselves
 * serialized into a worker. The scalar functions whose `.toString()` is
 * embedded by `kernelSource` are what must stay self-contained, not these.
 *
 * @packageDocumentation
 */

import { computePool, type OpName } from '@danielsimonjr/mathts-parallel';

/** 64-bit float (default for decimals) */
type f64 = number;

/**
 * Build a self-contained kernel source string: dependency function
 * declarations followed by an expression that evaluates to `(x) => number`.
 */
export function kernelSource(deps: Array<(...args: never[]) => unknown>, body: string): string {
  return `(() => {\n${deps.map((d) => d.toString()).join('\n')}\nreturn (${body});\n})()`;
}

/**
 * Evaluate a scalar function across an array, dispatching large inputs to the
 * worker pool. Falls back to a sequential loop when the pool is not
 * initialized or the input is below the parallel threshold.
 */
export async function mapArray(
  x: Float64Array,
  scalar: (v: f64) => f64,
  buildKernel: () => string
): Promise<Float64Array> {
  if (computePool.shouldParallelize(x.length)) {
    const r = await computePool.applyKernel(x, buildKernel());
    return r.result;
  }
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = scalar(x[i]);
  return out;
}

/**
 * Binary Float64Array map (e.g. FFT magnitude/power). Optional `parallelOp` selects
 * the per-op threshold (defaults to the global `thresholdElements` gate).
 */
export async function mapBinaryF64(
  a: Float64Array,
  b: Float64Array,
  scalar: (x: f64, y: f64) => f64,
  kernel: string,
  parallelOp?: OpName
): Promise<Float64Array> {
  if (computePool.shouldParallelize(a.length, parallelOp)) {
    const r = await computePool.applyKernel2(a, b, kernel);
    return r.result;
  }
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = scalar(a[i], b[i]);
  return out;
}
