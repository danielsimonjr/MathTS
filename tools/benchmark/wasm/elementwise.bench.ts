/**
 * Elementwise transcendental kernels — AssemblyScript vs JS.
 *
 * Benchmarks the `array_<op>_ptr` pointer-ABI AS kernels that
 * `functions/src/wasm/elementwise/wasm-bridge.ts` dispatches to
 * (`elementwiseUnaryDispatch`) against the plain `Math.*` loop that is the JS
 * fallback path. Also covers the op-fusion chain (`elementwiseChainDispatch`),
 * which keeps the data resident in wasm memory across a chain of ops — one
 * copy-in / one copy-out regardless of chain length.
 *
 * The AS path is the production dispatch helper; it returns `null` below the
 * 1024-element threshold or when wasm is unavailable, in which case the bench
 * falls back to the JS loop (so a row can never silently report a no-op as a
 * win — the maxdiff column stays 0 and the ratio reflects JS-vs-JS).
 *
 * Run: `npm run bench:elementwise`
 */

import { initWasm } from '../../../functions/src/wasm/WasmLoader.js';
import {
  elementwiseUnaryDispatch,
  elementwiseChainDispatch,
  type WasmElementwiseOp,
} from '../../../functions/src/wasm/elementwise/wasm-bridge.js';
import { maxdiffF64, runCases, isMainModule, type WasmCase } from './harness.js';

const SIZES = [1024, 16384, 131072, 1_000_000];

/** Positive inputs in (0.1, 1.1] so log/atanh/etc. stay in-domain. */
function positiveInput(n: number): Float64Array {
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = Math.random() + 0.1;
  return xs;
}

/** Map an op name to its scalar `Math.*` reference for the JS path. */
const MATH_REF: Partial<Record<WasmElementwiseOp, (x: number) => number>> = {
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
};

/** JS fallback loop for a unary op. */
function jsUnary(op: WasmElementwiseOp, xs: Float64Array): Float64Array {
  const f = MATH_REF[op]!;
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = f(xs[i]);
  return out;
}

/** Build a unary-op case. */
function unaryCase(op: WasmElementwiseOp): WasmCase {
  return {
    op,
    unit: 'elements',
    sizes: SIZES,
    prepare: (n) => positiveInput(n),
    js: (input) => jsUnary(op, input as Float64Array),
    as: (input) => {
      const xs = input as Float64Array;
      // Real dispatch; null below threshold / no wasm → JS fallback.
      return elementwiseUnaryDispatch(op, xs) ?? jsUnary(op, xs);
    },
    maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  };
}

/** Op-fusion chain: exp(cos(sin(x))) in one wasm residency vs JS loop. */
const CHAIN: WasmElementwiseOp[] = ['sin', 'cos', 'exp'];
const chainCase: WasmCase = {
  op: `fusion[${CHAIN.join('->')}]`,
  unit: 'elements',
  sizes: SIZES,
  prepare: (n) => positiveInput(n),
  js: (input) => {
    const xs = input as Float64Array;
    const out = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) out[i] = Math.exp(Math.cos(Math.sin(xs[i])));
    return out;
  },
  as: (input) => {
    const xs = input as Float64Array;
    const r = elementwiseChainDispatch(CHAIN, xs);
    if (r) return r;
    const out = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) out[i] = Math.exp(Math.cos(Math.sin(xs[i])));
    return out;
  },
  maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  note: 'Op-fusion: one copy-in / one copy-out for the whole chain.',
};

export async function main(): Promise<void> {
  await initWasm();
  const ops: WasmElementwiseOp[] = ['abs', 'sin', 'cos', 'tan', 'exp', 'log', 'sinh', 'tanh'];
  const cases: WasmCase[] = [...ops.map(unaryCase), chainCase];
  await runCases('ELEMENTWISE — AssemblyScript array_<op>_ptr kernels vs Math.* (JS)', cases);
}

// Run when invoked directly (tsx tools/benchmark/wasm/elementwise.bench.ts).
if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
