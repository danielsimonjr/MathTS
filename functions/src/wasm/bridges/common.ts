/**
 * Shared helpers for the WASM dispatch bridges (dup-audit Opportunity #2,
 * Clusters C + D — `getWasm()` ×7 and the per-kernel dispatch boilerplate).
 *
 * Phase 3a scope: this module starts with exactly what the elementwise bridge
 * needs — the shared `getWasm()` accessor, backend detection sentinels, the
 * pointer-ABI unary kernel type, and the self-managed scratch-region runners
 * (`runUnaryPtr` / `runChainPtr`) that the elementwise + fusion path uses. The
 * remaining bridges (special / sort / signal / poly / interpolation / bitwise)
 * adopt this module — and gain an `alloc/try/release/probe/JS-fallback`
 * `makeDispatch` factory — in migration Phases 3b/3c.
 */

import { wasmLoader, type WasmModule } from '../WasmLoader.js';

/**
 * Fetch the loaded WASM module, or `null` if nothing is loaded / the loader
 * threw. Never throws. Shared by every bridge (was duplicated ×7).
 */
export function getWasm(): WasmModule | null {
  try {
    return wasmLoader.getModule();
  } catch {
    return null;
  }
}

/**
 * Minimal structural view of a loaded module used by the pointer-ABI path: a
 * `memory` plus arbitrary string-keyed kernel exports.
 */
export interface RawWasm {
  memory: WebAssembly.Memory;
  [k: string]: unknown;
}

/**
 * Backend-detection sentinels. The AssemblyScript binary exports the
 * pointer-ABI elementwise kernels (`array_<op>_ptr`) and a managed runtime
 * (`__new`); the Rust binary exports `simd_<op>_array` and has no allocator.
 *
 * These let a bridge tell which binary is loaded so it can avoid mis-calling a
 * same-named export across the two incompatible ABIs (the AS binary reuses
 * several Rust kernel names — e.g. `poly_mul_f64`, `sort_f64` — with a managed
 * calling convention).
 */
export function isAsWasm(wasm: Record<string, unknown> | null | undefined): boolean {
  return !!wasm && typeof wasm['array_sin_ptr'] === 'function';
}
export function isRustWasm(wasm: Record<string, unknown> | null | undefined): boolean {
  return !!wasm && typeof wasm['simd_sin_array'] === 'function';
}

/** Pointer-ABI unary kernel: `fn(inPtr, outPtr, n)` writes `n` results to `outPtr`. */
export type PtrUnaryKernel = (inPtr: number, outPtr: number, n: number) => void;

// ---------------------------------------------------------------------------
// Self-managed scratch region (pointer-ABI elementwise + fusion path).
//
// The pointer kernels never grow the module heap, so a reused scratch base —
// captured once past all static data + heap on first use — is safe for these
// synchronous, non-reentrant calls. This is the zero-per-call-alloc path that
// the dup-audit explicitly flags as *distinct* from the other bridges'
// allocate/release marshalling, so it lives here as its own primitive.
// ---------------------------------------------------------------------------

let scratchBase = -1;

function ensureScratch(mem: WebAssembly.Memory, need: number): number {
  if (scratchBase < 0) scratchBase = mem.buffer.byteLength; // past static data + heap
  if (scratchBase + need > mem.buffer.byteLength) {
    mem.grow(Math.ceil((scratchBase + need - mem.buffer.byteLength) / 65536));
  }
  return scratchBase;
}

/**
 * Reset the cached scratch base. Call after `wasmLoader.reset()` (e.g. in
 * tests) so the next dispatch re-captures the base against the new module's
 * memory rather than a detached buffer's stale length.
 */
export function resetScratch(): void {
  scratchBase = -1;
}

/**
 * Apply a single pointer-ABI unary kernel over `xs` via the scratch region.
 * One copy-in, one copy-out. Returns `null` on any failure (caller falls back
 * to JS). Never throws.
 */
export function runUnaryPtr(
  mem: WebAssembly.Memory,
  fn: PtrUnaryKernel,
  xs: Float64Array
): Float64Array | null {
  const n = xs.length;
  try {
    const need = 2 * n * 8; // input + output, f64
    const base = ensureScratch(mem, need);
    const inOff = base;
    const outOff = base + n * 8;
    // Re-acquire views after ensureScratch: mem.grow detaches the prior buffer.
    new Float64Array(mem.buffer, inOff, n).set(xs);
    fn(inOff, outOff, n);
    const result = new Float64Array(n);
    result.set(new Float64Array(mem.buffer, outOff, n));
    return result;
  } catch {
    return null;
  }
}

/**
 * Apply a *chain* of pointer-ABI unary kernels with the data resident in WASM
 * memory the whole time — one copy-in, one copy-out regardless of chain length.
 * Ping-pongs two scratch buffers (the kernels are out-of-place). Returns `null`
 * on any failure (caller applies the chain in JS). Never throws.
 */
export function runChainPtr(
  mem: WebAssembly.Memory,
  fns: PtrUnaryKernel[],
  xs: Float64Array
): Float64Array | null {
  const n = xs.length;
  try {
    const need = 2 * n * 8; // two ping-pong buffers
    const base = ensureScratch(mem, need);
    const bufA = base;
    const bufB = base + n * 8;
    new Float64Array(mem.buffer, bufA, n).set(xs);
    let cur = bufA;
    let other = bufB;
    for (const fn of fns) {
      fn(cur, other, n);
      const t = cur;
      cur = other;
      other = t;
    }
    const result = new Float64Array(n);
    result.set(new Float64Array(mem.buffer, cur, n));
    return result;
  } catch {
    return null;
  }
}

export type { WasmModule };
