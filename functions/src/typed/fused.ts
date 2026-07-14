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
import { elementwiseChainGpuDispatch, type GpuChainOptions } from '../gpu/elementwise-gpu.js';
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
  // Constructor, not `.from()` — see the note in elementwise-gpu.ts. `.from()`
  // on a typed array is the generic per-element ToNumber path (~73x slower).
  const out = new Float64Array(xs);
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
 * Tiers, in order: **GPU (f32, opt-in) → WASM (f64) → JS (f64)**.
 *
 * ### Why the GPU is tried first — but ONLY when explicitly enabled
 *
 * Chain `sin→exp→tanh→cos`, 5 reps. ONE run, 2026-07-13, Chrome on an NVIDIA
 * Pascal adapter — the same run quoted in the CHANGELOG and the reference docs, so
 * the three tables agree. Pinned by `gpu-vs-wasm.browser.test.ts`:
 *
 * | n         | JS     | WASM   | GPU        | GPU vs WASM |
 * | --------- | ------ | ------ | ---------- | ----------- |
 * | 65,536    | 44 ms  | 17 ms  | **5.2 ms** | **3.2×**    |
 * | 262,144   | 185 ms | 63 ms  | **7.5 ms** | **8.3×**    |
 * | 1,048,576 | 711 ms | 256 ms | **35 ms**  | **7.2×**    |
 *
 * The GPU is the fastest tier by a wide margin. It is nevertheless **last-resort
 * by default**, because it computes in f32 while every other tier is f64-exact.
 * `enableGpu()` is how a caller consents to that trade: precision for speed. With
 * the flag off — the default — this function is exactly WASM → JS and returns
 * bit-identical f64 results, so opting out costs nothing.
 *
 * ### Provenance of these numbers (read before changing the order)
 *
 * This ordering has been wrong twice, both times from a benchmark measuring
 * something other than what it claimed:
 *
 *  1. GPU-first was first adopted on a "2.3-2.9x faster than JS" result. That
 *     baseline was pure JS only because a *separate* bug meant WASM never loaded
 *     in browsers. Fixing WASM revealed it beat the GPU, so the order was flipped
 *     to WASM-first.
 *  2. That flip was also wrong. The GPU figure it rested on was inflated by
 *     `Float32Array.from(f64array)` in the dispatch — the generic `Array.from`
 *     path, which runs ToNumber per element. Naming the denominators, because they
 *     differ: the *conversion* alone was 73x slower (433 ms vs 5.9 ms at n=2^20),
 *     which made the *end-to-end dispatch* 12.2x slower (439.80 ms -> 36.06 ms).
 *     With that fixed, the GPU wins outright, as above.
 *
 * The lesson both times: a tier's number is only as good as the tier it is
 * compared against. Re-measure ALL THREE tiers in one run before touching this
 * order — `gpu-vs-wasm.browser.test.ts` does exactly that and fails loudly if the
 * ranking changes.
 *
 * (The GPU also wins decisively for compute-bound work like a large matmul — see
 * `gpuMatmul`. It is not merely a memory-bound-work story.)
 *
 * **Precision.** Always returns a `Float64Array`. When the GPU tier runs, the
 * *values* carry f32 precision (~7 significant digits) even though the container
 * is f64 — the GPU cannot compute in f64 at all.
 *
 * It previously returned `Float64Array | Float32Array` to encode which path ran.
 * That union was a footgun: `.map` / `.filter` / `.set` on it are TS2349 errors,
 * so **every** caller had to narrow with `instanceof` before touching the result,
 * and `new Float64Array(r.buffer)` silently produced garbage when the f32 branch
 * hit. A narrowing tax on 100% of callers, for a branch most never take, is a bad
 * trade. Callers who specifically want the raw f32 buffer can call
 * `elementwiseChainGpuDispatch` directly — it is exported for exactly that.
 */
export async function fuseUnaryChainAsync(
  ops: WasmElementwiseOp[],
  xs: Float64Array,
  options?: GpuChainOptions
): Promise<Float64Array> {
  // GPU first — but it self-gates on the opt-in flag (`enableGpu()` or
  // `options.gpu`) and returns null when the caller has not consented, when no
  // device exists, below GPU_MIN_ELEMENTS, or when any op lacks a kernel. With
  // the flag off (the default) this is a cheap null and we fall straight through
  // to the f64 tiers, so default behaviour is unchanged and stays exact.
  const gpu = await elementwiseChainGpuDispatch(ops, xs, options);
  // Widen f32 values into the f64 contract. Constructor, not `.from()` — the
  // return trip paid the same generic-path tax as the input conversion did.
  if (gpu) return new Float64Array(gpu);

  // WASM: the fastest EXACT tier.
  const wasm = elementwiseChainDispatch(ops, xs);
  if (wasm) return wasm;

  return jsChain(ops, xs);
}
