import { isDeterministic } from '@danielsimonjr/mathts-core';
import { isGpuEnabled } from '@danielsimonjr/mathts-gpu';

/**
 * Whether an implicit call may route to the GPU.
 *
 * Deterministic mode refuses the GPU even with `options.gpu === true`: the GPU computes in
 * f32, so its bits can never match the f64 JavaScript path. Named entry points such as
 * `gpuMatmul` do not call this helper.
 *
 * @param options - the per-call `gpu` option; `undefined` defers to the global flag.
 * @returns `true` when the GPU path may run.
 */
export function implicitGpuAllowed(options?: { gpu?: boolean }): boolean {
  return !isDeterministic() && (options?.gpu ?? isGpuEnabled());
}
