/**
 * Sort kernel — AssemblyScript vs JS.
 *
 * Benchmarks the AS introsort (`sort_f64`, dispatched by
 * `functions/src/wasm/sort/wasm-bridge.ts#sortF64Dispatch`) against the JS
 * fallback `sortF64JS` (a NaN-last comparator over `Array.prototype.sort`).
 *
 * Both paths copy the input before sorting (the op is in-place) so repeated
 * timing reps start from the same unsorted data; the copy cost is paid equally
 * by both sides. The AS threshold is 16,384 elements, so the ladder starts
 * there. HONEST NOTE: the JS fallback is NOT V8's fast numeric sort — NaN-last
 * semantics force a *comparator* sort (`Array.prototype.sort(cmpNanLast)`),
 * which forfeits V8's fast path. Against that comparator baseline the AS
 * introsort (managed-ABI round-trip included) measures as the faster path —
 * see the AS/JS ratio. (A bare `Float64Array.sort()` with no comparator would
 * be much faster but does not implement the required NaN-last order.)
 *
 * Run: `npm run bench:sort`
 */

import { initWasm } from '../../../functions/src/wasm/WasmLoader.js';
import { sortF64Dispatch, sortF64JS } from '../../../functions/src/wasm/sort/wasm-bridge.js';
import { maxdiffF64, runCases, isMainModule, type WasmCase } from './harness.js';

// Below the 16,384 AS threshold the dispatch runs JS, so start at the threshold.
const SIZES = [16384, 131072, 1_000_000];

function randomInput(n: number): Float64Array {
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = Math.random() * 1e6 - 5e5;
  return xs;
}

const cases: WasmCase[] = [
  {
    op: 'sort_f64',
    unit: 'elements',
    sizes: SIZES,
    prepare: randomInput,
    // Copy before sorting — the op is in-place; both paths pay the copy equally.
    js: (i) => sortF64JS((i as Float64Array).slice()),
    as: (i) => sortF64Dispatch((i as Float64Array).slice()),
    maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
    note: 'AS introsort vs JS NaN-last comparator sort (not V8 fast path); both copy first.',
  },
];

export async function main(): Promise<void> {
  await initWasm();
  await runCases('SORT — AssemblyScript sort_f64 (introsort) vs JS Array.sort', cases);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
