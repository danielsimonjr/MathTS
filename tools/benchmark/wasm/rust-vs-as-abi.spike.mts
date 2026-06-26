/**
 * Phase 1 (GATING) perf spike — Rust vs AssemblyScript WASM, with REALISTIC
 * round-trip marshalling, for the Rust→AS migration ABI decision.
 *
 *   docs/roadmap/RUST_TO_AS_MIGRATION_PLAN.md  → "Phase 1 — Perf spike"
 *   docs/roadmap/RUST_TO_AS_MIGRATION_EVAL.md  → §4 "ABI analysis / The perf risk"
 *
 * Run:  npx tsx tools/benchmark/wasm/rust-vs-as-abi.spike.mts
 *
 * Three representative kernels, n ∈ {1024, 10_000, 100_000, 1_000_000}:
 *   - array_sin        — the HOT elementwise path (Rust simd_sin_array, pointer)
 *   - bessel_j0_f64    — managed special (large n, low call-rate)
 *   - sort_f64         — in-place sort
 *
 * Three ABIs benchmarked (each pays its OWN real marshalling, full JS round-trip
 * Float64Array in → wasm → Float64Array out):
 *   - RUST       functions/dist/wasm/mathts.wasm     pointer ABI, self-managed
 *                JS-side scratch region (the elementwise-bridge perf bar).
 *   - AS-managed matrix/dist/wasm/mathts-as.wasm     managed ABI, __new/__pin
 *                header glue (the WASMBackend.ts production reference, pooled).
 *   - AS-ptr     _spike/array_sin_ptr.wasm           pointer-ABI AS prototype
 *                (Task 1.2), driven by the SAME lean scratch bridge as Rust.
 *
 * Pointer-ABI AS prototype compiled with:
 *   npx asc tools/benchmark/wasm/_spike/array_sin_ptr.ts \
 *     -o tools/benchmark/wasm/_spike/array_sin_ptr.wasm \
 *     --runtime stub --optimize --noAssert --exportRuntime
 *
 * Input: seeded uniform-random in (0,1). Random is the FAIR sort benchmark — the
 * existing benches' structured sawtooth (0.5+(i%997)*1e-3) is duplicate-heavy and
 * drives AS's naive `_qsort` into O(n²) (measured 28.7× vs Rust at n=131072); see
 * the Phase-1 doc's sort caveat. Sin/bessel timing is data-independent, so random
 * vs sawtooth is irrelevant for those rows.
 *
 * Reports median ms/op (median of R timed repetitions, each averaging `iters`
 * calls). Honest measurement — no estimates. Throwaway spike kept for
 * re-runnability; it touches NO production code path.
 */
import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

/* eslint-disable @typescript-eslint/no-explicit-any */

const here = dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const RUST_PATH = path.join(root, 'functions/dist/wasm/mathts.wasm');
const AS_PATH = path.join(root, 'matrix/dist/wasm/mathts-as.wasm');
const AS_PTR_PATH = path.join(here, '_spike/array_sin_ptr.wasm');

const SIZES = [1024, 10_000, 100_000, 1_000_000];
const REPS = 7; // timed repetitions; report the median

// AS runtime-info ids (from WASMBackend.ts).
const AS_ID_ARRAY_BUFFER = 1;
const AS_ID_FLOAT64_ARRAY = 5;

// ---------------------------------------------------------------------------
// Module loading
// ---------------------------------------------------------------------------
async function instantiate(p: string, imports: WebAssembly.Imports = {}): Promise<any> {
  const buf = readFileSync(p);
  const { instance } = await WebAssembly.instantiate(buf, imports);
  return instance.exports;
}

// The AS artifact imports env.abort (+ tolerates seed/Math/Date; see WASMBackend).
function asImports(): WebAssembly.Imports {
  return {
    env: {
      abort: () => {
        throw new Error('AS abort');
      },
      seed: () => Date.now(),
    },
    Math: Math as any,
    Date: Date as any,
  };
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Run `call` `iters` times, R reps; return median per-call ms across reps. */
function timeMedian(call: () => void, iters: number, reps = REPS): number {
  for (let i = 0; i < Math.min(iters, 30); i++) call(); // warmup
  const per: number[] = [];
  for (let r = 0; r < reps; r++) {
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) call();
    per.push((performance.now() - t0) / iters);
  }
  return median(per);
}

// Seeded uniform-random input in (0,1) — reproducible across ABIs (mulberry32).
function makeInput(n: number): Float64Array {
  const a = new Float64Array(n);
  let s = (0x9e3779b9 ^ n) >>> 0;
  for (let i = 0; i < n; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    a[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296 || 1e-9; // in (0,1)
  }
  return a;
}

/** Constant-work iteration count: ~2e7 elements per timed loop, clamped. */
function iterFor(n: number): number {
  return Math.max(12, Math.min(2000, Math.floor(2e7 / n)));
}

// ---------------------------------------------------------------------------
// Pointer-ABI bridge (Rust + AS-ptr): self-managed JS-side scratch region,
// mirrors functions/src/wasm/elementwise/wasm-bridge.ts (zero per-call alloc).
// ---------------------------------------------------------------------------
function ptrScratch(ex: any, n: number, buffers: number) {
  const mem: WebAssembly.Memory = ex.memory;
  const need = buffers * n * 8 + 65536;
  const base = mem.buffer.byteLength;
  mem.grow(Math.ceil(need / 65536));
  return { mem, base };
}

/** Pointer-ABI unary op: fn(inPtr, outPtr, n). Full round-trip. */
function ptrUnary(ex: any, fnName: string, src: Float64Array): () => void {
  const n = src.length;
  const { mem, base } = ptrScratch(ex, n, 2);
  const inOff = base;
  const outOff = base + n * 8;
  const fn = ex[fnName] as (a: number, b: number, n: number) => void;
  return () => {
    new Float64Array(mem.buffer, inOff, n).set(src); // copy IN
    fn(inOff, outOff, n);
    const out = new Float64Array(n);
    out.set(new Float64Array(mem.buffer, outOff, n)); // copy OUT
    return void out;
  };
}

/** Rust bessel_j0_f64(xsPtr, n, outPtr). Full round-trip. */
function ptrBessel(ex: any, src: Float64Array): () => void {
  const n = src.length;
  const { mem, base } = ptrScratch(ex, n, 2);
  const inOff = base;
  const outOff = base + n * 8;
  const fn = ex.bessel_j0_f64 as (p: number, n: number, o: number) => number;
  return () => {
    new Float64Array(mem.buffer, inOff, n).set(src);
    fn(inOff, n, outOff);
    const out = new Float64Array(n);
    out.set(new Float64Array(mem.buffer, outOff, n));
    return void out;
  };
}

/** Rust sort_f64(ptr, n) — in-place; copy fresh unsorted data each call. */
function ptrSort(ex: any, src: Float64Array): () => void {
  const n = src.length;
  const { mem, base } = ptrScratch(ex, n, 1);
  const fn = ex.sort_f64 as (p: number, n: number) => number;
  return () => {
    new Float64Array(mem.buffer, base, n).set(src); // fresh unsorted in
    fn(base, n);
    const out = new Float64Array(n);
    out.set(new Float64Array(mem.buffer, base, n)); // copy OUT
    return void out;
  };
}

// ---------------------------------------------------------------------------
// Managed-AS bridge: __new/__pin header glue, pooled (mirrors WASMBackend.ts
// AsAllocCache so the per-call cost is the realistic production one, not a
// pathological allocate-per-call leak).
// ---------------------------------------------------------------------------
function asAlloc(mod: any, length: number) {
  const byteLength = length * 8;
  const bufferPtr = (mod.__pin(mod.__new(byteLength, AS_ID_ARRAY_BUFFER)) as number) >>> 0;
  const headerPtr = (mod.__new(12, AS_ID_FLOAT64_ARRAY) as number) >>> 0;
  mod.__pin(headerPtr);
  const dv = new DataView(mod.memory.buffer);
  dv.setUint32(headerPtr + 0, bufferPtr, true);
  dv.setUint32(headerPtr + 4, bufferPtr, true);
  dv.setUint32(headerPtr + 8, byteLength, true);
  return { headerPtr, bufferPtr, length };
}
function asWrite(mod: any, a: { bufferPtr: number; length: number }, src: Float64Array) {
  new Float64Array(mod.memory.buffer, a.bufferPtr, a.length).set(src);
}
function asRead(mod: any, a: { bufferPtr: number; length: number }): Float64Array {
  return new Float64Array(new Float64Array(mod.memory.buffer, a.bufferPtr, a.length));
}
/** Read a Float64Array RETURNED by an AS export (header ptr → copy out). */
function asReadReturned(mod: any, headerPtr: number): Float64Array {
  const dv = new DataView(mod.memory.buffer);
  const dataStart = dv.getUint32((headerPtr >>> 0) + 4, true);
  const byteLength = dv.getUint32((headerPtr >>> 0) + 8, true);
  return new Float64Array(new Float64Array(mod.memory.buffer, dataStart, byteLength / 8));
}

/** AS array_sin(aHdr, resultHdr): pooled in+out, no internal alloc. */
function asArraySin(mod: any, src: Float64Array): () => void {
  const aIn = asAlloc(mod, src.length);
  const aOut = asAlloc(mod, src.length);
  const fn = mod.array_sin as (a: number, r: number) => void;
  return () => {
    asWrite(mod, aIn, src); // copy IN
    fn(aIn.headerPtr, aOut.headerPtr);
    return void asRead(mod, aOut); // copy OUT
  };
}

/** AS bessel_j0_f64(xs): returns a freshly-allocated managed array per call. */
function asBessel(mod: any, src: Float64Array): () => void {
  const aIn = asAlloc(mod, src.length);
  const fn = mod.bessel_j0_f64 as (a: number) => number;
  return () => {
    asWrite(mod, aIn, src);
    return void asReadReturned(mod, fn(aIn.headerPtr)); // copy OUT
  };
}

/** AS sort_f64(data): in-place, returns same header; copy fresh data each call. */
function asSort(mod: any, src: Float64Array): () => void {
  const aIn = asAlloc(mod, src.length);
  const fn = mod.sort_f64 as (a: number) => number;
  return () => {
    asWrite(mod, aIn, src); // fresh unsorted in
    return void asReadReturned(mod, fn(aIn.headerPtr)); // copy OUT
  };
}

function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

// One-shot captures for correctness (return the produced array).
function captureUnary(ex: any, fnName: string, src: Float64Array): Float64Array {
  const n = src.length;
  const { mem, base } = ptrScratch(ex, n, 2);
  new Float64Array(mem.buffer, base, n).set(src);
  ex[fnName](base, base + n * 8, n);
  return new Float64Array(new Float64Array(mem.buffer, base + n * 8, n));
}
function captureBessel(ex: any, src: Float64Array): Float64Array {
  const n = src.length;
  const { mem, base } = ptrScratch(ex, n, 2);
  new Float64Array(mem.buffer, base, n).set(src);
  ex.bessel_j0_f64(base, n, base + n * 8);
  return new Float64Array(new Float64Array(mem.buffer, base + n * 8, n));
}
function captureSort(ex: any, src: Float64Array): Float64Array {
  const n = src.length;
  const { mem, base } = ptrScratch(ex, n, 1);
  new Float64Array(mem.buffer, base, n).set(src);
  ex.sort_f64(base, n);
  return new Float64Array(new Float64Array(mem.buffer, base, n));
}
function captureAsSin(mod: any, src: Float64Array): Float64Array {
  const a = asAlloc(mod, src.length);
  const o = asAlloc(mod, src.length);
  asWrite(mod, a, src);
  mod.array_sin(a.headerPtr, o.headerPtr);
  return asRead(mod, o);
}
function captureAsBessel(mod: any, src: Float64Array): Float64Array {
  const a = asAlloc(mod, src.length);
  asWrite(mod, a, src);
  return asReadReturned(mod, mod.bessel_j0_f64(a.headerPtr));
}
function captureAsSort(mod: any, src: Float64Array): Float64Array {
  const a = asAlloc(mod, src.length);
  asWrite(mod, a, src);
  return asReadReturned(mod, mod.sort_f64(a.headerPtr));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main() {
  const os = await import('os');
  console.log('# Phase 1 ABI perf spike — Rust vs AssemblyScript (realistic round-trip)');
  console.log(
    `# node ${process.version} | ${os.cpus()[0].model.trim()} | ${os.cpus().length} cores | ${(os.totalmem() / 1e9).toFixed(1)} GB | ${process.platform}`
  );
  console.log(`# median of ${REPS} reps, full Float64Array in→wasm→out each call`);
  console.log(`# input: seeded uniform-random in (0,1)\n`);

  const rust = await instantiate(RUST_PATH);
  const asPtr = await instantiate(AS_PTR_PATH, {
    env: {
      abort: () => {
        throw new Error('AS-ptr abort');
      },
    },
  });

  for (const [nm, ex, want] of [
    ['rust', rust, ['simd_sin_array', 'bessel_j0_f64', 'sort_f64', 'memory']],
    ['as-ptr', asPtr, ['array_sin_ptr', 'memory']],
  ] as const) {
    for (const w of want) if (!(w in ex)) throw new Error(`${nm} missing export ${w}`);
  }

  const header = [
    'op', 'n', 'Rust ms', 'AS-managed ms', 'AS-ptr ms', 'AS-mgd/Rust', 'AS-ptr/Rust', 'maxdiff',
  ];
  const rows: string[][] = [];

  for (const op of ['array_sin', 'bessel_j0_f64', 'sort_f64'] as const) {
    for (const n of SIZES) {
      const src = makeInput(n);
      const iters = iterFor(n);
      // Fresh AS instance per cell so the stub-runtime bump allocator never
      // bloats across cells (bessel allocates a result array per call).
      const asMod = await instantiate(AS_PATH, asImports());

      let rustMs = NaN, asMgdMs = NaN, asPtrMs = NaN, diff = NaN;

      if (op === 'array_sin') {
        const refRust = captureUnary(rust, 'simd_sin_array', src);
        diff = Math.max(
          maxAbsDiff(refRust, captureAsSin(asMod, src)),
          maxAbsDiff(refRust, captureUnary(asPtr, 'array_sin_ptr', src))
        );
        rustMs = timeMedian(ptrUnary(rust, 'simd_sin_array', src), iters);
        asMgdMs = timeMedian(asArraySin(asMod, src), iters);
        asPtrMs = timeMedian(ptrUnary(asPtr, 'array_sin_ptr', src), iters);
      } else if (op === 'bessel_j0_f64') {
        diff = maxAbsDiff(captureBessel(rust, src), captureAsBessel(asMod, src));
        rustMs = timeMedian(ptrBessel(rust, src), iters);
        // AS bessel allocates internally per call (leaks under stub runtime);
        // bound iters so total internal allocation stays < ~160 MB.
        const besselIters = Math.max(8, Math.min(iters, Math.floor(160e6 / (n * 8))));
        asMgdMs = timeMedian(asBessel(asMod, src), besselIters);
      } else {
        diff = maxAbsDiff(captureSort(rust, src), captureAsSort(asMod, src));
        rustMs = timeMedian(ptrSort(rust, src), iters);
        asMgdMs = timeMedian(asSort(asMod, src), iters);
      }

      rows.push([
        op,
        String(n),
        rustMs.toFixed(5),
        asMgdMs.toFixed(5),
        Number.isNaN(asPtrMs) ? '—' : asPtrMs.toFixed(5),
        (asMgdMs / rustMs).toFixed(2),
        Number.isNaN(asPtrMs) ? '—' : (asPtrMs / rustMs).toFixed(2),
        diff.toExponential(1),
      ]);
    }
  }

  printTable(header, rows);
}

function printTable(header: string[], rows: string[][]) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (r: string[]) => r.map((c, i) => c.padStart(widths[i])).join('  ');
  console.log(fmt(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(fmt(r));
}

await main();
