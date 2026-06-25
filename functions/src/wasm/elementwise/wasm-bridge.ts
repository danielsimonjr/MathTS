/**
 * WASM bridge for unary elementwise transcendental array ops.
 *
 * The Rust kernels `simd_<op>_array(inPtr, outPtr, n)` are scalar `libm` loops
 * (not actually vectorized), but they are still net-faster than V8's `Math.*`
 * applied over a `Float64Array` — even including the JS→wasm copy-in and
 * wasm→JS copy-out — for the expensive transcendentals. Benchmarked
 * (`tools/benchmark/wasm/elementwise.bench.mjs`, `npm run bench:elementwise`),
 * n >= 1024, vs plain JS (the current path: these ops have threshold `'never'`
 * in ComputePool, so they run synchronously in JS, never on workers):
 *
 *   abs 2.7–5.1x · sin 1.6–2.4x · cos 1.6–2.2x · exp 1.4–2.1x · log 1.5–2.2x · tan 1.35–1.9x
 *
 * `sqrt` is NOT included — JS hardware `Math.sqrt` beats wasm+copy (0.5–0.66x).
 *
 * Dispatch order: Rust WASM (above threshold) → JS fallback (returns null so the
 * caller uses its existing JS/parallel path).
 */
import { wasmLoader, type WasmModule } from '../WasmLoader.js';

/** Element-count threshold above which the WASM kernel beats JS. */
export const WASM_ELEMENTWISE_THRESHOLD = 1024;

/** Unary ops with a Rust `simd_<op>_array` kernel that is net-faster than JS. */
export const WASM_ELEMENTWISE_OPS = ['abs', 'sin', 'cos', 'tan', 'exp', 'log'] as const;
export type WasmElementwiseOp = (typeof WASM_ELEMENTWISE_OPS)[number];

function getWasm(): WasmModule | null {
  try {
    return wasmLoader.getModule();
  } catch {
    return null;
  }
}

// simd_<op>_array(inPtr, outPtr, n) -> void (writes n results to outPtr).
type UnaryArrayFn = (inPtr: number, outPtr: number, n: number) => void;
interface RustModule {
  memory: WebAssembly.Memory;
  [k: string]: unknown;
}

// The Rust wasm exports only `memory` (no allocator — not even __new; the
// loader's allocateFloat64Array is AssemblyScript-only and throws here). We
// therefore manage a small JS-side scratch region for the (input, output)
// buffers ourselves. Captured past all static data on first use; the simd_*
// kernels never grow the module's heap, so a reused scratch base is safe for
// these synchronous, non-reentrant calls.
let scratchBase = -1;

/**
 * Apply a unary elementwise op over `xs` via the Rust `simd_<op>_array` kernel.
 * Returns the result, or `null` (below threshold, wasm unavailable, kernel
 * missing, or any failure) — in which case the caller uses its JS/parallel path.
 * Never throws.
 */
export function elementwiseUnaryDispatch(op: WasmElementwiseOp, xs: Float64Array): Float64Array | null {
  const n = xs.length;
  if (n < WASM_ELEMENTWISE_THRESHOLD) return null;
  const wasm = getWasm() as unknown as RustModule | null;
  if (!wasm) return null;
  const fn = wasm[`simd_${op}_array`] as UnaryArrayFn | undefined;
  const mem = wasm.memory;
  if (typeof fn !== 'function' || !(mem instanceof WebAssembly.Memory)) return null;

  try {
    const need = 2 * n * 8; // input + output, f64
    if (scratchBase < 0) scratchBase = mem.buffer.byteLength; // past static data + heap
    if (scratchBase + need > mem.buffer.byteLength) {
      mem.grow(Math.ceil((scratchBase + need - mem.buffer.byteLength) / 65536));
    }
    const inOff = scratchBase;
    const outOff = scratchBase + n * 8;
    // Re-acquire views each step: mem.grow detaches the previous ArrayBuffer.
    new Float64Array(mem.buffer, inOff, n).set(xs);
    fn(inOff, outOff, n);
    const result = new Float64Array(n);
    result.set(new Float64Array(mem.buffer, outOff, n));
    return result;
  } catch {
    return null;
  }
}
