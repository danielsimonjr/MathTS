/**
 * Op-fusion public API (Tier 3 of the WASM pairing gap plan).
 *
 * Applies a *chain* of unary elementwise ops with the array resident in WASM
 * memory across the whole chain, so the JS↔wasm transfer is paid **once**, not
 * once per op. This is the structural lever the per-op benchmarks pointed to:
 * a single op barely beats (or loses to) JS once the copy is counted, but a
 * chain of K ops amortizes that one copy over K kernels.
 *
 *   fuseUnaryChain(['sin', 'exp'], xs)  // = exp(sin(x)), one copy in + one out
 *
 * Falls back to a sequential JS scalar pass when WASM is unavailable or the
 * array is below threshold, so the result is always correct.
 */
import {
  elementwiseChainDispatch,
  type WasmElementwiseOp,
} from '../wasm/elementwise/wasm-bridge.js';
import { elementwiseChainGpuDispatch } from '../gpu/elementwise-gpu.js';
import { erfcScalar } from './special.js';

/** Scalar implementation of every fusable op, for the JS fallback path. */
const SCALAR: Record<WasmElementwiseOp, (x: number) => number> = {
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  log: Math.log,
  atan: Math.atan,
  sinh: Math.sinh,
  tanh: Math.tanh,
  atanh: Math.atanh,
  expm1: Math.expm1,
  log1p: Math.log1p,
  log2: Math.log2,
  log10: Math.log10,
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  cot: (x) => 1 / Math.tan(x),
  erfc: erfcScalar,
};

/**
 * Apply `ops` left-to-right over `xs` (i.e. `ops[last](…ops[0](x))`), fused in
 * WASM when possible. Returns a new `Float64Array`; never mutates `xs`.
 */
export function fuseUnaryChain(ops: WasmElementwiseOp[], xs: Float64Array): Float64Array {
  const wasm = elementwiseChainDispatch(ops, xs);
  if (wasm) return wasm;
  return jsChain(ops, xs);
}

/** Sequential scalar pass — the always-correct f64 fallback. */
function jsChain(ops: readonly WasmElementwiseOp[], xs: Float64Array): Float64Array {
  const out = Float64Array.from(xs);
  for (const op of ops) {
    const f = SCALAR[op];
    for (let i = 0; i < out.length; i++) out[i] = f(out[i]);
  }
  return out;
}

/**
 * Async sibling of {@link fuseUnaryChain} that may run the chain on the **GPU**.
 *
 * This exists as a separate, `async` entry point rather than changing
 * `fuseUnaryChain`, because a GPU dispatch is inherently asynchronous and
 * `fuseUnaryChain`'s synchronous signature is public API.
 *
 * Tiers, in order: **GPU (f32)** → WASM (f64) → JS (f64).
 *
 * The GPU tier engages only when the caller has opted in via `enableGpu()`, a
 * device is available, the array clears `GPU_MIN_ELEMENTS`, and every op in the
 * chain has a GPU kernel. Otherwise this behaves exactly like `fuseUnaryChain`.
 *
 * **Precision:** when the GPU tier engages the result is a `Float32Array`
 * (~7 significant digits); otherwise it is an exact-f64 `Float64Array`. The
 * return type tells you which path ran — that is the precision contract, and it
 * is why the GPU tier is opt-in rather than automatic.
 */
export async function fuseUnaryChainAsync(
  ops: WasmElementwiseOp[],
  xs: Float64Array
): Promise<Float64Array | Float32Array> {
  const gpu = await elementwiseChainGpuDispatch(ops, xs);
  if (gpu) return gpu;
  return fuseUnaryChain(ops, xs);
}
