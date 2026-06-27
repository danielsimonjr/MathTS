/**
 * Special-function array kernels — AssemblyScript vs JS.
 *
 * Benchmarks a representative set of the AS managed-ABI special-function kernels
 * that `functions/src/wasm/special/wasm-bridge.ts` dispatches to, against the
 * package's own pure-JS fallbacks (the canonical scalars looped element-wise):
 *
 *   - bessel_j0  (`besselJ0Dispatch`  vs `besselJ0JS`)
 *   - bessel_j1  (`besselJ1Dispatch`  vs `besselJ1JS`)
 *   - lgamma     (`lgammaDispatch`    vs `lgammaJS`)
 *   - elliptic_k (`ellipticKDispatch` vs `ellipticKJS`)
 *
 * These JS fallbacks are continued-fraction / series scalars — far costlier than
 * a `Math.*` call — so the AS kernel typically wins by a wide margin once the
 * 1024-element marshalling threshold is cleared.
 *
 * Run: `npm run bench:special`
 */

import { initWasm } from '../../../functions/src/wasm/WasmLoader.js';
import {
  besselJ0Dispatch,
  besselJ0JS,
  besselJ1Dispatch,
  besselJ1JS,
  lgammaDispatch,
  lgammaJS,
  ellipticKDispatch,
  ellipticKJS,
} from '../../../functions/src/wasm/special/wasm-bridge.js';
import { maxdiffF64, runCases, isMainModule, type WasmCase } from './harness.js';

const SIZES = [1024, 16384, 131072, 1_000_000];

/** Bessel argument spread over (0.5, 50] — full oscillatory + asymptotic range. */
function besselInput(n: number): Float64Array {
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = 0.5 + (i % 5000) * 0.01;
  return xs;
}

/** lgamma argument spread over (0.1, 50] (poles at non-positive integers avoided). */
function lgammaInput(n: number): Float64Array {
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = 0.1 + (i % 5000) * 0.01;
  return xs;
}

/** Elliptic modulus m ∈ [0, 1). */
function mInput(n: number): Float64Array {
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = (i % 1000) / 1000;
  return xs;
}

const cases: WasmCase[] = [
  {
    op: 'bessel_j0',
    unit: 'elements',
    sizes: SIZES,
    prepare: besselInput,
    js: (i) => besselJ0JS(i as Float64Array),
    as: (i) => besselJ0Dispatch(i as Float64Array),
    maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  },
  {
    op: 'bessel_j1',
    unit: 'elements',
    sizes: SIZES,
    prepare: besselInput,
    js: (i) => besselJ1JS(i as Float64Array),
    as: (i) => besselJ1Dispatch(i as Float64Array),
    maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  },
  {
    op: 'lgamma',
    unit: 'elements',
    sizes: SIZES,
    prepare: lgammaInput,
    js: (i) => lgammaJS(i as Float64Array),
    as: (i) => lgammaDispatch(i as Float64Array),
    maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  },
  {
    op: 'elliptic_k',
    unit: 'elements',
    sizes: SIZES,
    prepare: mInput,
    js: (i) => ellipticKJS(i as Float64Array),
    as: (i) => ellipticKDispatch(i as Float64Array),
    maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  },
];

export async function main(): Promise<void> {
  await initWasm();
  await runCases('SPECIAL FUNCTIONS — AssemblyScript managed kernels vs JS scalars', cases);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
