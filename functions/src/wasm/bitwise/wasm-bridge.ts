/**
 * WASM dispatch bridge for elementwise Int32Array bitwise ops.
 *
 * The typed bitwise functions in `functions/src/typed/bitwise.ts` already
 * have a `ComputePool` fallback for `Int32Array` inputs (worker-pool tier
 * or in-process JS, depending on size). This bridge adds a *third* tier
 * above that for very large arrays where the SIMD/native WASM kernels
 * dominate the worker dispatch overhead.
 *
 * Behavior:
 *  - If `wasmLoader.getModule()` returns null (nobody called
 *    `wasmLoader.load()` yet, or load failed), every helper here returns
 *    `null` and the caller falls back to `ComputePool`.
 *  - If the loaded module has the matching export, we marshal both
 *    operand `Int32Array`s into WASM-owned memory, run the kernel, and
 *    return a JS-side copy of the result.
 *  - Any thrown error is swallowed and the helper returns `null` so the
 *    `ComputePool` fallback still runs — the WASM tier is purely an
 *    optimization, not a correctness requirement.
 *
 * Backend (AssemblyScript only, as of the Rust→AS migration Phase 5 functions
 * cutover):
 *   - AS exports use `*_i32_array` and pass high-level `Int32Array` references
 *     that the AS loader rebinds against module memory.
 *   - The legacy Rust `*Array` / `*ArrayPerElement` pointer-ABI path was removed
 *     from this bridge; under any non-AS binary the helpers return `null` and the
 *     caller falls back to `ComputePool`.
 */

import { wasmLoader, type WasmModule } from '../WasmLoader.js';
import {
  getWasm,
  isAsWasm,
  withAsI32,
  asReadReturnedI32,
  type RawWasm,
} from '../bridges/common.js';

/**
 * Length threshold above which we attempt the WASM dispatch tier. This is
 * deliberately conservative (64K Int32 elements = 256 KiB per operand)
 * because the marshal cost (two memcpys in + one memcpy out) only pays
 * off when the kernel inner loop dominates. At smaller sizes the
 * `ComputePool` in-process path is already faster than a WASM round trip.
 */
export const WASM_BITWISE_THRESHOLD = 64 * 1024;

/** AS managed kernel export name for each op. */
interface OpNames {
  as: keyof WasmModule;
}

const BINARY_OPS: Record<string, OpNames> = {
  bitAnd: { as: 'bitAnd_i32_array' },
  bitOr: { as: 'bitOr_i32_array' },
  bitXor: { as: 'bitXor_i32_array' },
  leftShift: { as: 'leftShift_i32_array' },
  rightArithShift: { as: 'rightArithShift_i32_array' },
  rightLogShift: { as: 'rightLogShift_i32_array' },
};

const UNARY_OPS: Record<string, OpNames> = {
  bitNot: { as: 'bitNot_i32_array' },
};

/**
 * Run an elementwise binary Int32Array op via WASM. Returns the result
 * (a new `Int32Array` copy) on success, `null` if no kernel is available.
 * Any error from the kernel is swallowed and treated as `null` so the
 * caller falls back to `ComputePool`.
 *
 * Backend selection is gated by the AS sentinel (`isAsWasm`): the AS binary
 * exports `*_i32_array(a, b, result)` MANAGED (header refs, `result` is an output
 * param). Under any non-AS binary this returns `null` and the caller falls back
 * to `ComputePool`.
 */
export function runBinaryBitwiseWasm(
  op: keyof typeof BINARY_OPS,
  a: Int32Array,
  b: Int32Array
): Int32Array | null {
  if (a.length !== b.length) return null;
  const wasm = getWasm() as unknown as RawWasm | null;
  if (!wasm || !isAsWasm(wasm)) return null;
  const n = a.length;
  const names = BINARY_OPS[op];
  try {
    // AS managed ABI: *_i32_array(a, b, result) writes into the `result` header.
    return withAsI32(wasm, [a, b, new Int32Array(n)], (mod, [ha, hb, hr]) => {
      (mod[names.as] as (x: number, y: number, r: number) => void)(ha, hb, hr);
      return asReadReturnedI32(mod, hr);
    });
  } catch {
    return null;
  }
}

/**
 * Unary variant — currently only `bitNot`.
 */
export function runUnaryBitwiseWasm(op: keyof typeof UNARY_OPS, a: Int32Array): Int32Array | null {
  const wasm = getWasm() as unknown as RawWasm | null;
  if (!wasm || !isAsWasm(wasm)) return null;
  const n = a.length;
  const names = UNARY_OPS[op];
  try {
    // AS managed ABI: *_i32_array(a, result) writes into the `result` header.
    return withAsI32(wasm, [a, new Int32Array(n)], (mod, [ha, hr]) => {
      (mod[names.as] as (x: number, r: number) => void)(ha, hr);
      return asReadReturnedI32(mod, hr);
    });
  } catch {
    return null;
  }
}

/**
 * Test-only hook: force-clear any cached state. Re-runs of the typed
 * bitwise tests rely on `wasmLoader.reset()` to drop the loaded module;
 * this re-exports it under a stable name so the bitwise tests don't have
 * to import the loader directly.
 */
export function resetBitwiseWasm(): void {
  wasmLoader.reset();
}
