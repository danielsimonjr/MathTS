/**
 * Sort WASM kernel benchmark — Slice 5.7a.
 *
 * Compares the pure-JS sort path against the WASM-dispatched path for
 * sort_f64, argsort_f64, rank_f64 over Float64Array inputs.
 *
 * Run with:
 *   npx ts-node --esm tools/benchmark/wasm/sort.bench.ts
 *   (requires the Rust WASM artifact at /home/user/MathTS/lib/wasm/mathts.wasm)
 *
 * Expected result:
 *   - WASM (Rust pdqsort) should beat JS V8 TimSort above ~1 K elements.
 *   - Below WASM_SORT_THRESHOLD the bridge always uses JS, so JS "wins" trivially.
 *   - argsort and rank add one O(n) pass on top of sort; still faster than
 *     building a JS object-array + sort + inversion.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  WASM_SORT_THRESHOLD,
  sortF64Dispatch,
  argsortF64Dispatch,
  rankF64Dispatch,
  sortF64JS,
  argsortF64JS,
  rankF64JS,
} from '../../../functions/src/wasm/sort/wasm-bridge.js';
import { wasmLoader } from '../../../functions/src/wasm/WasmLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

const RUNS = 20;

function makeRandom(n: number, seed = 0): Float64Array {
  let s = seed >>> 0;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    out[i] = ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  }
  return out;
}

function bench(label: string, fn: () => void, runs = RUNS): number {
  // Warm-up
  for (let i = 0; i < 3; i++) fn();
  // Timed runs
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const elapsed = (performance.now() - t0) / runs;
  const ms = elapsed.toFixed(3);
  console.log(`  ${label.padEnd(38)}: ${ms} ms/run`);
  return elapsed;
}

async function main() {
  console.log('=== WASM Sort Kernel Benchmark (Slice 5.7a) ===\n');
  console.log(`WASM_SORT_THRESHOLD = ${WASM_SORT_THRESHOLD}`);

  if (WASM_PATH) {
    console.log(`Loading WASM from ${WASM_PATH} …`);
    await wasmLoader.loadFromFile(WASM_PATH);
    console.log('WASM loaded.\n');
  } else {
    console.warn('WASM artifact not found — running JS-only baseline.\n');
  }

  // --- sort_f64 ---
  for (const n of [1_000, 16_384, 65_536, 262_144]) {
    const label = `n = ${n.toLocaleString()}`;
    console.log(`\n[sort_f64]  ${label}`);
    bench('  JS (sortF64JS)', () => {
      const d = makeRandom(n, 1);
      sortF64JS(d);
    });
    bench('  Dispatch (sortF64Dispatch)', () => {
      const d = makeRandom(n, 1);
      sortF64Dispatch(d);
    });
  }

  // --- argsort_f64 ---
  for (const n of [16_384, 65_536]) {
    const label = `n = ${n.toLocaleString()}`;
    console.log(`\n[argsort_f64]  ${label}`);
    bench('  JS (argsortF64JS)', () => {
      argsortF64JS(makeRandom(n, 2));
    });
    bench('  Dispatch (argsortF64Dispatch)', () => {
      argsortF64Dispatch(makeRandom(n, 2));
    });
  }

  // --- rank_f64 ---
  for (const n of [16_384, 65_536]) {
    const label = `n = ${n.toLocaleString()}`;
    console.log(`\n[rank_f64]  ${label}`);
    bench('  JS (rankF64JS)', () => {
      rankF64JS(makeRandom(n, 3));
    });
    bench('  Dispatch (rankF64Dispatch)', () => {
      rankF64Dispatch(makeRandom(n, 3));
    });
  }

  console.log('\nDone.');
}

main().catch(console.error);
