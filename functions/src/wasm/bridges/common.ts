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
 * AssemblyScript-binary detection sentinel. The AS binary (the binary the
 * `functions` package bundles and dispatches to) exports the pointer-ABI
 * elementwise kernels (`array_<op>_ptr`) and a managed runtime (`__new`).
 *
 * This gate lets a bridge confirm the loaded module is the AS binary before
 * issuing a managed-ABI call. If the binary can't be loaded or lacks the AS
 * exports, the gate is false and the bridge falls back to JS. AssemblyScript is
 * the sole WASM backend (the Rust→AS migration is complete); dispatch is AS→JS.
 */
export function isAsWasm(wasm: Record<string, unknown> | null | undefined): boolean {
  return !!wasm && typeof wasm['array_sin_ptr'] === 'function';
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

// ---------------------------------------------------------------------------
// AssemblyScript managed ABI marshalling (dup-audit Cluster D).
//
// The AS binary's special / poly / signal / sort / interpolation / bitwise
// kernels are MANAGED: they take and return AssemblyScript `Float64Array` /
// `Int32Array` objects. At the wasm boundary those are *header pointers*, not
// JS typed arrays — calling them with the Rust pointer-ABI args (raw data ptr +
// length) silently mis-reads the header and produces garbage (the Phase-3a
// corruption: poly returned all-zeros for n≥256). These helpers build a real
// AS array (pinned buffer + header) the way `matrix/src/backends/WASMBackend.ts`
// (`AsAllocCache`) and `tools/benchmark/wasm/rust-vs-as-abi.spike.mts` do, so a
// managed kernel can be called correctly from the functions bridges.
// ---------------------------------------------------------------------------

/** AssemblyScript runtime type ids (see WASMBackend.ts AsAllocCache). */
const AS_ID_ARRAY_BUFFER = 1;
const AS_ID_FLOAT64_ARRAY = 5;
const AS_ID_INT32_ARRAY = 6;
/** AS typed-array header is { buffer, dataStart, byteLength } = 3 × u32. */
const AS_HEADER_BYTES = 12;

/** Minimal view of the AS managed runtime exported by the AS binary. */
interface AsRuntime extends RawWasm {
  __new: (size: number, id: number) => number;
  __pin: (ptr: number) => number;
  __unpin: (ptr: number) => void;
}

interface AsAlloc {
  headerPtr: number;
  bufferPtr: number;
}

function asAllocHeader(mod: AsRuntime, byteLength: number, typeId: number): AsAlloc {
  const bufferPtr = (mod.__pin(mod.__new(byteLength, AS_ID_ARRAY_BUFFER)) >>> 0) as number;
  const headerPtr = (mod.__new(AS_HEADER_BYTES, typeId) >>> 0) as number;
  mod.__pin(headerPtr);
  const dv = new DataView(mod.memory.buffer);
  dv.setUint32(headerPtr + 0, bufferPtr, true); // mm info / buffer
  dv.setUint32(headerPtr + 4, bufferPtr, true); // dataStart
  dv.setUint32(headerPtr + 8, byteLength, true); // byteLength
  return { headerPtr, bufferPtr };
}

function asUnpin(mod: AsRuntime, a: AsAlloc): void {
  mod.__unpin(a.headerPtr);
  mod.__unpin(a.bufferPtr);
}

/**
 * Copy a `Float64Array` RETURNED by an AS managed kernel (a header pointer)
 * into a fresh JS `Float64Array`. Must be called before the source allocation
 * is released.
 */
export function asReadReturnedF64(mod: RawWasm, headerPtr: number): Float64Array {
  const dv = new DataView(mod.memory.buffer);
  const dataStart = dv.getUint32((headerPtr >>> 0) + 4, true);
  const byteLength = dv.getUint32((headerPtr >>> 0) + 8, true);
  return new Float64Array(new Float64Array(mod.memory.buffer, dataStart, byteLength >>> 3));
}

/** Int32Array variant of {@link asReadReturnedF64}. */
export function asReadReturnedI32(mod: RawWasm, headerPtr: number): Int32Array {
  const dv = new DataView(mod.memory.buffer);
  const dataStart = dv.getUint32((headerPtr >>> 0) + 4, true);
  const byteLength = dv.getUint32((headerPtr >>> 0) + 8, true);
  return new Int32Array(new Int32Array(mod.memory.buffer, dataStart, byteLength >>> 2));
}

/**
 * Marshal `inputs` (f64) into AS managed arrays, run `body` with the module and
 * the header pointers (same order as `inputs`), then release. `body` must read
 * any AS-returned array (via `asReadReturnedF64` / `asReadReturnedI32`) into a
 * detached JS copy BEFORE returning — the allocations are unpinned afterward.
 *
 * Returns `body`'s result, or `null` on any failure / missing runtime (caller
 * falls back to JS). Never throws.
 */
export function withAsF64<T>(
  wasm: RawWasm,
  inputs: Float64Array[],
  body: (mod: AsRuntime, headers: number[]) => T
): T | null {
  const mod = wasm as AsRuntime;
  if (typeof mod.__new !== 'function' || typeof mod.__unpin !== 'function') return null;
  const allocs: AsAlloc[] = [];
  try {
    const headers: number[] = [];
    for (const arr of inputs) {
      const a = asAllocHeader(mod, arr.length * 8, AS_ID_FLOAT64_ARRAY);
      new Float64Array(mod.memory.buffer, a.bufferPtr, arr.length).set(arr);
      allocs.push(a);
      headers.push(a.headerPtr);
    }
    return body(mod, headers);
  } catch {
    return null;
  } finally {
    for (const a of allocs) {
      try {
        asUnpin(mod, a);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Int32 variant of {@link withAsF64}. */
export function withAsI32<T>(
  wasm: RawWasm,
  inputs: Int32Array[],
  body: (mod: AsRuntime, headers: number[]) => T
): T | null {
  const mod = wasm as AsRuntime;
  if (typeof mod.__new !== 'function' || typeof mod.__unpin !== 'function') return null;
  const allocs: AsAlloc[] = [];
  try {
    const headers: number[] = [];
    for (const arr of inputs) {
      const a = asAllocHeader(mod, arr.length * 4, AS_ID_INT32_ARRAY);
      new Int32Array(mod.memory.buffer, a.bufferPtr, arr.length).set(arr);
      allocs.push(a);
      headers.push(a.headerPtr);
    }
    return body(mod, headers);
  } catch {
    return null;
  } finally {
    for (const a of allocs) {
      try {
        asUnpin(mod, a);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Factory for the dominant special-function bridge shape: a single f64 array in,
 * a same-length f64 array out, dispatched to the AS managed kernel `cfg.name`.
 * Builds the full threshold → AS-managed → JS-fallback dispatch, removing the
 * duplicated alloc/try/probe boilerplate (dup-audit Cluster D).
 */
export function makeUnaryArrayDispatch(cfg: {
  threshold: number;
  /** AS managed kernel export name. */
  name: string;
  /** Pure-JS fallback. */
  js: (xs: Float64Array) => Float64Array;
}): (xs: Float64Array) => Float64Array {
  return (xs: Float64Array): Float64Array => {
    if (xs.length >= cfg.threshold) {
      const wasm = getWasm() as unknown as RawWasm | null;
      if (wasm && isAsWasm(wasm)) {
        const out = withAsF64(wasm, [xs], (mod, [h]) =>
          asReadReturnedF64(mod, (mod[cfg.name] as (a: number) => number)(h))
        );
        if (out) return out;
      }
    }
    return cfg.js(xs);
  };
}

export type { WasmModule };
