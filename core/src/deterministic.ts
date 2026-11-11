/**
 * Deterministic mode: a process-wide switch that makes implicit routing reproducible.
 *
 * When on, the library runs the JavaScript path for every implicit choice that could
 * change result bits: WASM kernels except the ones measured bit-identical to JS, implicit
 * GPU routing, ComputePool and worker fan-outs, and the matrix BackendManager. Results
 * then match across runs on the same engine and version.
 *
 * Named entry points are not gated. `gpuMatmul`, `gpuMatrixBackend`, `wasmBackend.*` and
 * direct `computePool.*` calls run as the caller named them.
 *
 * The guarantee covers the same engine and version only. Bit identity across engines is
 * not guaranteed.
 *
 * Default: off.
 */

let deterministic = false;

/**
 * Turn deterministic mode on or off for the whole process.
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
