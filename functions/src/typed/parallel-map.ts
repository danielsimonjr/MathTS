/**
 * Shared parallel array-evaluation helpers for the typed math surfaces.
 *
 * `kernelSource` builds a self-contained worker kernel string (used by hypothesis.ts).
 * `mapBinaryF64` is the shared sequential/worker loop of the async `parallelFFTMagnitude`
 * and `parallelFFTPower`. The synchronous typed Float64Array signatures use `f64Unary`
 * (`./f64-kernels.ts`) instead.
 *
 * Both helpers run on the main thread, so they may import freely. The scalar functions
 * whose `.toString()` `kernelSource` embeds must stay self-contained.
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
