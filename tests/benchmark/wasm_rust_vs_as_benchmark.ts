/**
 * Benchmark: Rust WASM vs AssemblyScript WASM vs pure JavaScript
 *
 * Run with: npx tsx tests/benchmark/wasm_rust_vs_as_benchmark.ts
 * Prerequisites:
 *   Rust WASM:  npm run build:wasm:rust   → lib/wasm/mathts.wasm
 *   AS WASM:    npm run build:wasm         → assembly/build/mathts.wasm
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Utilities
// ============================================================

interface WasmExports {
  memory: WebAssembly.Memory;
  // Rust ABI (camelCase, raw pointers into linear memory)
  multiplyDense?: Function;
  add?: Function;
  dotProduct?: Function;
  transpose?: Function;
  det?: Function;
  // AS managed runtime
  __new?: Function;
  __pin?: Function;
  __unpin?: Function;
  __collect?: Function;
  // AS ABI (snake_case, Float64Array header refs)
  matrix_multiply?: Function;
  matrix_add?: Function;
  array_dot?: Function;
  matrix_transpose?: Function;
  [key: string]: any;
}

// ============================================================
// AssemblyScript managed-array helpers
// ============================================================
//
// AS exports (`matrix_add`, `matrix_multiply`, `array_dot`, ...) take
// Float64Array **header** refs — a 12-byte block holding
// [dataStart, dataStart, byteLength] — NOT raw pointers like the Rust ABI.
// The helpers below mirror what `assembly/build/mathts.js` does in
// `__lowerTypedArray(Float64Array, 5, 3, ...)`.
//
// IDs (from `__rtti_base` in the AS module):
//   1 = ArrayBuffer
//   5 = Float64Array  (header type)
const AS_ID_ARRAY_BUFFER = 1;
const AS_ID_FLOAT64_ARRAY = 5;
const AS_HEADER_BYTES = 12;

interface AsAlloc {
  header: number;
  buffer: number;
  length: number;
}

/** Allocate a Float64Array (data + header) inside an AS module. */
function asAllocFloat64(mod: WasmExports, length: number): AsAlloc {
  const byteLength = length * 8;
  const buffer = (mod.__pin as Function)((mod.__new as Function)(byteLength, AS_ID_ARRAY_BUFFER)) >>> 0;
  const header = ((mod.__new as Function)(AS_HEADER_BYTES, AS_ID_FLOAT64_ARRAY) >>> 0) as number;
  (mod.__pin as Function)(header);
  const dv = new DataView(mod.memory.buffer);
  dv.setUint32(header + 0, buffer, true);
  dv.setUint32(header + 4, buffer, true);
  dv.setUint32(header + 8, byteLength, true);
  return { header, buffer, length };
}

/** Allocate + fill a Float64Array from JS data. */
function asWriteFloat64(mod: WasmExports, data: Float64Array): AsAlloc {
  const alloc = asAllocFloat64(mod, data.length);
  new Float64Array(mod.memory.buffer, alloc.buffer, alloc.length).set(data);
  return alloc;
}

/**
 * Per-module pool — same rationale as `WASMBackend`: the AS `stub` runtime
 * has no `free` so allocate-per-iter OOMs. Cache and reuse handles by length.
 */
class AsPool {
  private free = new Map<number, AsAlloc[]>();
  acquire(mod: WasmExports, length: number): AsAlloc {
    const pool = this.free.get(length);
    if (pool && pool.length > 0) return pool.pop()!;
    return asAllocFloat64(mod, length);
  }
  release(alloc: AsAlloc): void {
    const pool = this.free.get(alloc.length) ?? [];
    pool.push(alloc);
    this.free.set(alloc.length, pool);
  }
}

function bench(fn: () => void, warmup = 3, iterations = 10): number {
  for (let i = 0; i < warmup; i++) fn();
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

function speedup(base: number, fast: number): string {
  if (fast <= 0 || base <= 0) return 'N/A';
  const ratio = base / fast;
  return ratio >= 1 ? `${ratio.toFixed(1)}x faster` : `${(1 / ratio).toFixed(1)}x slower`;
}

// ============================================================
// Load WASM module
// ============================================================

async function loadWasm(wasmPath: string): Promise<WasmExports | null> {
  if (!fs.existsSync(wasmPath)) return null;
  try {
    const buffer = fs.readFileSync(wasmPath);
    const module = await WebAssembly.compile(buffer);
    const instance = await WebAssembly.instantiate(module, {
      env: {
        abort: () => {},
        'Math.cos': Math.cos,
        'Math.sin': Math.sin,
        'Math.sqrt': Math.sqrt,
        'Math.abs': Math.abs,
        'Math.log': Math.log,
        'Math.exp': Math.exp,
        'Math.pow': Math.pow,
        'Math.floor': Math.floor,
        'Math.ceil': Math.ceil,
        'Math.round': Math.round,
        'Math.random': Math.random,
        'Math.atan2': Math.atan2,
        'Math.min': Math.min,
        'Math.max': Math.max,
        seed: () => {},
      },
    });
    return instance.exports as any as WasmExports;
  } catch (e: any) {
    console.log(`  [Could not load ${path.basename(wasmPath)}: ${e.message?.slice(0, 80)}]`);
    return null;
  }
}

// ============================================================
// WASM memory helpers
// ============================================================

function writeF64(memory: WebAssembly.Memory, offset: number, data: Float64Array): void {
  new Float64Array(memory.buffer, offset, data.length).set(data);
}

function flattenMatrix(m: number[][]): Float64Array {
  const rows = m.length,
    cols = m[0].length;
  const flat = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) flat[i * cols + j] = m[i][j];
  return flat;
}

// ============================================================
// JS reference implementations
// ============================================================

function jsMatMul(a: number[][], b: number[][]): number[][] {
  const m = a.length,
    n = b[0].length,
    k = b.length;
  const c: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += a[i][p] * b[p][j];
      c[i][j] = s;
    }
  return c;
}

function jsDot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function jsVecAdd(a: Float64Array, b: Float64Array): Float64Array {
  const r = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) r[i] = a[i] + b[i];
  return r;
}

function jsDet(m: number[][], n: number): number {
  // LU-based determinant
  const a = m.map((r) => [...r]);
  let sign = 1;
  for (let k = 0; k < n; k++) {
    let maxVal = 0,
      maxRow = k;
    for (let i = k; i < n; i++) {
      const v = Math.abs(a[i][k]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = i;
      }
    }
    if (maxRow !== k) {
      [a[k], a[maxRow]] = [a[maxRow], a[k]];
      sign = -sign;
    }
    if (Math.abs(a[k][k]) < 1e-14) return 0;
    for (let i = k + 1; i < n; i++) {
      const f = a[i][k] / a[k][k];
      for (let j = k + 1; j < n; j++) a[i][j] -= f * a[k][j];
    }
  }
  let det = sign;
  for (let i = 0; i < n; i++) det *= a[i][i];
  return det;
}

// ============================================================
// Test data generators
// ============================================================

function randomMatrix(n: number): number[][] {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random() * 10 - 5));
}

function randomF64(n: number): Float64Array {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random() * 10 - 5;
  return a;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('='.repeat(80));
  console.log(' Benchmark: Rust WASM  vs  AssemblyScript WASM  vs  JavaScript');
  console.log('='.repeat(80));
  console.log();

  // Rust WASM: built to lib/wasm/ by wasm-rust/scripts/build.sh
  const rustPath = path.join(__dirname, '..', '..', 'lib', 'wasm', 'mathts.wasm');
  // AS WASM: built to assembly/build/ by npm run build:wasm
  const asPath = path.join(__dirname, '..', '..', 'assembly', 'build', 'mathts.wasm');

  const hasRust = fs.existsSync(rustPath);
  const hasAS = fs.existsSync(asPath);

  console.log(
    `Rust WASM: ${hasRust ? (fs.statSync(rustPath).size / 1024).toFixed(0) + ' KB  (' + rustPath + ')' : 'NOT FOUND — run: npm run build:wasm:rust'}`
  );
  console.log(
    `AS WASM:   ${hasAS ? (fs.statSync(asPath).size / 1024).toFixed(0) + ' KB  (' + asPath + ')' : 'NOT FOUND — run: npm run build:wasm'}`
  );
  console.log();

  // Load WASM modules
  console.log('Loading WASM modules...');
  const rust = hasRust ? await loadWasm(rustPath) : null;
  const as_ = hasAS ? await loadWasm(asPath) : null;
  console.log(
    `  Rust: ${rust ? 'loaded (' + Object.keys(rust).filter((k) => typeof rust[k] === 'function').length + ' exports)' : 'not available'}`
  );
  console.log(
    `  AS:   ${as_ ? 'loaded (' + Object.keys(as_).filter((k) => typeof as_[k] === 'function').length + ' exports)' : 'not available'}`
  );
  console.log();

  // Results collector
  const rows: string[][] = [];
  rows.push(['Operation', 'JS (ms)', 'Rust (ms)', 'AS (ms)', 'Rust vs JS', 'Rust vs AS']);

  function rustEnsureMemory(r: WasmExports, neededBytes: number): void {
    while (r.memory.buffer.byteLength < neededBytes) {
      r.memory.grow(Math.ceil(neededBytes / 65536));
    }
  }

  // Shared AS pool — reused across benchmark sections.
  const asPool = new AsPool();

  // ============================================================
  // Matrix Multiply
  // ============================================================
  for (const n of [50, 100, 200]) {
    const label = `matmul ${n}x${n}`;
    console.log(`--- ${label} ---`);

    const a = randomMatrix(n);
    const b = randomMatrix(n);
    const flatA = flattenMatrix(a);
    const flatB = flattenMatrix(b);

    const jsMs = bench(() => jsMatMul(a, b));

    // Rust WASM (flat memory)
    let rustMs: number | null = null;
    if (rust?.multiplyDense && rust.memory) {
      const aOff = 1024,
        bOff = aOff + n * n * 8,
        cOff = bOff + n * n * 8;
      rustEnsureMemory(rust, cOff + n * n * 8);
      writeF64(rust.memory, aOff, flatA);
      writeF64(rust.memory, bOff, flatB);
      rustMs = bench(() => {
        (rust.multiplyDense as Function)(aOff, n, n, bOff, n, n, cOff);
      });
    }

    // AS WASM: uses `matrix_multiply(aHdr, aRows, aCols, bHdr, bCols, resHdr)`.
    // Managed Float64Array headers, NOT raw flat-memory pointers.
    let asMs: number | null = null;
    if (as_?.matrix_multiply && as_.__new && as_.memory) {
      const aAlloc = asWriteFloat64(as_, flatA);
      const bAlloc = asWriteFloat64(as_, flatB);
      const rAlloc = asPool.acquire(as_, n * n);
      asMs = bench(() => {
        (as_.matrix_multiply as Function)(aAlloc.header, n, n, bAlloc.header, n, rAlloc.header);
      });
      asPool.release(aAlloc);
      asPool.release(bAlloc);
      asPool.release(rAlloc);
    }

    console.log(`  JS:   ${jsMs.toFixed(3)} ms`);
    if (rustMs !== null) console.log(`  Rust: ${rustMs.toFixed(3)} ms  (${speedup(jsMs, rustMs)})`);
    if (asMs !== null) console.log(`  AS:   ${asMs.toFixed(3)} ms  (${speedup(jsMs, asMs)})`);

    rows.push([
      label,
      jsMs.toFixed(3),
      rustMs?.toFixed(3) ?? '-',
      asMs?.toFixed(3) ?? '-',
      rustMs ? speedup(jsMs, rustMs) : '-',
      rustMs && asMs ? speedup(asMs, rustMs) : '-',
    ]);
  }

  // ============================================================
  // Dot Product
  // ============================================================
  for (const n of [1000, 10000, 100000]) {
    const label = `dot ${n}`;
    console.log(`--- ${label} ---`);

    const va = randomF64(n);
    const vb = randomF64(n);

    const jsMs = bench(() => jsDot(va, vb));

    let rustMs: number | null = null;
    if (rust?.dotProduct && rust.memory) {
      const aOff = 1024,
        bOff = aOff + n * 8;
      rustEnsureMemory(rust, bOff + n * 8);
      writeF64(rust.memory, aOff, va);
      writeF64(rust.memory, bOff, vb);
      rustMs = bench(() => {
        (rust.dotProduct as Function)(aOff, bOff, n);
      });
    }

    // AS WASM: uses `array_dot(aHdr, bHdr) -> f64`.
    let asMs: number | null = null;
    if (as_?.array_dot && as_.__new && as_.memory) {
      const aAlloc = asWriteFloat64(as_, va);
      const bAlloc = asWriteFloat64(as_, vb);
      asMs = bench(() => {
        (as_.array_dot as Function)(aAlloc.header, bAlloc.header);
      });
      asPool.release(aAlloc);
      asPool.release(bAlloc);
    }

    console.log(`  JS:   ${jsMs.toFixed(3)} ms`);
    if (rustMs !== null) console.log(`  Rust: ${rustMs.toFixed(3)} ms  (${speedup(jsMs, rustMs)})`);
    if (asMs !== null) console.log(`  AS:   ${asMs.toFixed(3)} ms  (${speedup(jsMs, asMs)})`);

    rows.push([
      label,
      jsMs.toFixed(3),
      rustMs?.toFixed(3) ?? '-',
      asMs?.toFixed(3) ?? '-',
      rustMs ? speedup(jsMs, rustMs) : '-',
      rustMs && asMs ? speedup(asMs, rustMs) : '-',
    ]);
  }

  // ============================================================
  // Vector Add
  // ============================================================
  for (const n of [1000, 10000, 100000]) {
    const label = `vecadd ${n}`;
    console.log(`--- ${label} ---`);

    const va = randomF64(n);
    const vb = randomF64(n);

    const jsMs = bench(() => jsVecAdd(va, vb));

    let rustMs: number | null = null;
    if (rust?.add && rust.memory) {
      const aOff = 1024,
        bOff = aOff + n * 8,
        cOff = bOff + n * 8;
      rustEnsureMemory(rust, cOff + n * 8);
      writeF64(rust.memory, aOff, va);
      writeF64(rust.memory, bOff, vb);
      rustMs = bench(() => {
        (rust.add as Function)(aOff, bOff, n, cOff);
      });
    }

    // AS WASM: uses `matrix_add(aHdr, bHdr, resHdr)` — same as array_add but
    // we keep matrix_add for symmetry with the Rust column's "add" op.
    let asMs: number | null = null;
    if (as_?.matrix_add && as_.__new && as_.memory) {
      const aAlloc = asWriteFloat64(as_, va);
      const bAlloc = asWriteFloat64(as_, vb);
      const rAlloc = asPool.acquire(as_, n);
      asMs = bench(() => {
        (as_.matrix_add as Function)(aAlloc.header, bAlloc.header, rAlloc.header);
      });
      asPool.release(aAlloc);
      asPool.release(bAlloc);
      asPool.release(rAlloc);
    }

    console.log(`  JS:   ${jsMs.toFixed(3)} ms`);
    if (rustMs !== null) console.log(`  Rust: ${rustMs.toFixed(3)} ms  (${speedup(jsMs, rustMs)})`);
    if (asMs !== null) console.log(`  AS:   ${asMs.toFixed(3)} ms  (${speedup(jsMs, asMs)})`);

    rows.push([
      label,
      jsMs.toFixed(3),
      rustMs?.toFixed(3) ?? '-',
      asMs?.toFixed(3) ?? '-',
      rustMs ? speedup(jsMs, rustMs) : '-',
      rustMs && asMs ? speedup(asMs, rustMs) : '-',
    ]);
  }

  // ============================================================
  // Determinant
  // ============================================================
  for (const n of [10, 50, 100]) {
    const label = `det ${n}x${n}`;
    console.log(`--- ${label} ---`);

    const m = randomMatrix(n);
    const flat = flattenMatrix(m);

    const jsMs = bench(() => jsDet(m, n));

    let rustMs: number | null = null;
    if (rust?.det && rust.memory) {
      const aOff = 1024;
      rustEnsureMemory(rust, aOff + n * n * 8);
      writeF64(rust.memory, aOff, flat);
      rustMs = bench(() => {
        (rust.det as Function)(aOff, n);
      });
    }

    // AS WASM: no `det` / `matrix_det` export. AS ships only basic algebra
    // (matrix_*) and array_* primitives — LU / determinant come from the
    // Rust crate. Leave the AS column empty for `det` rows. (Confirmed via
    // `grep '^export declare function.*det' assembly/build/mathts.d.ts`.)
    const asMs: number | null = null;

    console.log(`  JS:   ${jsMs.toFixed(3)} ms`);
    if (rustMs !== null) console.log(`  Rust: ${rustMs.toFixed(3)} ms  (${speedup(jsMs, rustMs)})`);
    if (asMs !== null) console.log(`  AS:   ${asMs.toFixed(3)} ms  (${speedup(jsMs, asMs)})`);

    rows.push([
      label,
      jsMs.toFixed(3),
      rustMs?.toFixed(3) ?? '-',
      asMs?.toFixed(3) ?? '-',
      rustMs ? speedup(jsMs, rustMs) : '-',
      rustMs && asMs ? speedup(asMs, rustMs) : '-',
    ]);
  }

  // ============================================================
  // Summary Table
  // ============================================================
  console.log();
  console.log('='.repeat(80));
  console.log(' Results');
  console.log('='.repeat(80));
  console.log();

  const colWidths = rows[0].map((_, ci) => Math.max(...rows.map((r) => (r[ci] || '').length)));
  for (const [ri, row] of rows.entries()) {
    const line = row.map((cell, ci) => cell.padStart(colWidths[ci])).join('  ');
    console.log(line);
    if (ri === 0) console.log('-'.repeat(line.length));
  }

  console.log();
  console.log(
    `Binary sizes: Rust ${hasRust ? (fs.statSync(rustPath).size / 1024).toFixed(0) : '?'} KB  |  AS ${hasAS ? (fs.statSync(asPath).size / 1024).toFixed(0) : '?'} KB`
  );
}

main().catch(console.error);
