/**
 * WASM bridge for unary elementwise transcendental array ops.
 *
 * The AssemblyScript pointer-ABI kernels `array_<op>_ptr(inPtr, outPtr, n)` are
 * the WASM elementwise path: a single signature with self-managed scratch-region
 * marshalling. They remain net-faster than V8's `Math.*` over a `Float64Array`
 * — even including the JS→wasm copy-in and wasm→JS copy-out — for the expensive
 * transcendentals.
 * Benchmarked (`tools/benchmark/wasm/elementwise.bench.mjs`,
 * `npm run bench:elementwise`), n >= 1024, vs plain JS (the current path: these
 * ops have threshold `'never'` in ComputePool, so they run synchronously in JS):
 *
 *   abs 2.7–5.1x · sin 1.6–2.4x · cos 1.6–2.2x · exp 1.4–2.1x · log 1.5–2.2x · tan 1.35–1.9x
 *
 * `sqrt` is NOT included — JS hardware `Math.sqrt` beats wasm+copy (0.5–0.66x).
 *
 * Dispatch order: AS WASM pointer kernel (above threshold) → JS fallback
 * (returns null so the caller uses its existing JS/parallel path).
 *
 * The shared `getWasm()` accessor and the scratch-region runners live in
 * `../bridges/common.ts` (dup-audit Opportunity #2).
 */
import { getWasm, runUnaryPtr, runChainPtr, type PtrUnaryKernel, type RawWasm } from '../bridges/common.js';

/** Element-count threshold above which the WASM kernel beats JS. */
export const WASM_ELEMENTWISE_THRESHOLD = 1024;

/**
 * Unary ops with an `array_<op>_ptr` kernel that is benchmark-confirmed
 * net-faster than JS (see tools/benchmark/wasm/{elementwise,transcendental}.bench.mjs).
 * Excluded after measuring (JS wins): sqrt, cbrt, asin, acos, cosh, asinh, acosh.
 */
export const WASM_ELEMENTWISE_OPS = [
  'abs', 'sin', 'cos', 'tan', 'exp', 'log',
  // extended transcendentals (Tier 1, all win at every benchmarked size)
  'atan', 'sinh', 'tanh', 'atanh', 'expm1', 'log1p', 'log2', 'log10', 'sec', 'csc', 'cot',
  // expensive special with an existing libm kernel (Tier 2, ~5–7× — its JS is a
  // continued-fraction scalar, far costlier than Math.*)
  'erfc',
] as const;
export type WasmElementwiseOp = (typeof WASM_ELEMENTWISE_OPS)[number];

/** AS pointer kernel export name for an op, e.g. `array_sin_ptr`. */
const kernelName = (op: WasmElementwiseOp): string => `array_${op}_ptr`;

/**
 * Apply a unary elementwise op over `xs` via the AS `array_<op>_ptr` kernel.
 * Returns the result, or `null` (below threshold, wasm unavailable, kernel
 * missing, or any failure) — in which case the caller uses its JS/parallel path.
 * Never throws.
 */
export function elementwiseUnaryDispatch(
  op: WasmElementwiseOp,
  xs: Float64Array
): Float64Array | null {
  const n = xs.length;
  if (n < WASM_ELEMENTWISE_THRESHOLD) return null;
  const wasm = getWasm() as unknown as RawWasm | null;
  if (!wasm) return null;
  const fn = wasm[kernelName(op)] as PtrUnaryKernel | undefined;
  const mem = wasm.memory;
  if (typeof fn !== 'function' || !(mem instanceof WebAssembly.Memory)) return null;
  return runUnaryPtr(mem, fn, xs);
}

/**
 * Op-fusion (Tier 3): apply a *chain* of unary ops with the data resident in
 * wasm memory the whole time — one copy-in, one copy-out, regardless of chain
 * length. `fuseUnaryChain([sin, exp])` computes `exp(sin(x))` paying the JS↔wasm
 * transfer once instead of once per op. Returns null (caller applies the chain
 * in JS) below threshold, when wasm is unavailable, or any kernel is missing.
 * Never throws.
 */
export function elementwiseChainDispatch(
  ops: WasmElementwiseOp[],
  xs: Float64Array
): Float64Array | null {
  const n = xs.length;
  if (ops.length === 0 || n < WASM_ELEMENTWISE_THRESHOLD) return null;
  const wasm = getWasm() as unknown as RawWasm | null;
  if (!wasm) return null;
  const mem = wasm.memory;
  if (!(mem instanceof WebAssembly.Memory)) return null;
  const kernels: PtrUnaryKernel[] = [];
  for (const op of ops) {
    const fn = wasm[kernelName(op)] as PtrUnaryKernel | undefined;
    if (typeof fn !== 'function') return null;
    kernels.push(fn);
  }
  return runChainPtr(mem, kernels, xs);
}
