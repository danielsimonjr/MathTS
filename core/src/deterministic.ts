/**
 * Deterministic mode: a switch, global to the core module instance, that makes implicit routing reproducible.
 *
 * When on, the library runs the JavaScript path for every implicit choice that could
 * change result bits: WASM kernels except the ones measured bit-identical to JS, implicit
 * GPU routing, ComputePool and worker fan-outs, and the matrix BackendManager. Results
 * then match across runs on the same engine and version.
 *
 * Named entry points are not gated. `gpuMatmul`, `gpuMatrixBackend`, `wasmBackend.*` and
 * the `computePool` methods `applyKernel`, `applyKernel2`, `integrateFanOut`,
 * `distributionSampleFanOut`, `fftBatch` and `distanceMatrix` run as the caller named them.
 * The other `computePool` methods decide through `shouldParallelize`, so they are gated.
 *
 * The guarantee covers the same engine and version only. Bit identity across engines is
 * not guaranteed.
 *
 * Default: off.
 */

let deterministic = false;

/**
 * Turn deterministic mode on or off for this instance of the core module
 * (one per thread or worker that loads it).
 *
 * @param on - `true` routes implicit calls to the JavaScript path; `false` restores routing.
 */
export function setDeterministic(on: boolean): void {
  deterministic = on;
}

/**
 * Whether deterministic mode is on.
 *
 * @returns `true` while {@link setDeterministic} last received `true`.
 */
export function isDeterministic(): boolean {
  return deterministic;
}
