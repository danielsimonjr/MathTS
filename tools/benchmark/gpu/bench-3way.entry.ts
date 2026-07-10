/**
 * 3-way matmul benchmark entry — JS/TS vs WASM (AssemblyScript) vs WebGPU.
 *
 * Runs the REAL matrix backends (not ad-hoc kernels): `jsBackend.multiply`,
 * `WASMBackend.multiply` (AS SIMD, served .wasm), and `GPUBackend.matmul`
 * (WebGPU compute shader). WebGPU only runs in a browser, so this is bundled
 * (esbuild, browser target) and driven from a page — see bench-3way.html.
 *
 * NOTE: WASM (AssemblyScript) is the matured accelerator; the WebGPU/`GPUBackend`
 * path is EXPERIMENTAL and not yet a production accelerator — its column is a
 * forward-looking placeholder, meant to be exercised in a WebGPU-capable browser
 * (Chrome + DevTools) once real WebGPU accelerators exist. Today: JS vs WASM is real.
 *
 * Build:  npm run bench:backends:build   (esbuild → bench-3way.bundle.js)
 * Run:    serve the repo on localhost, open the page, click Run.
 */
import { jsBackend } from '../../../matrix/src/backends/JSBackend.js';
import { WASMBackend } from '../../../matrix/src/backends/WASMBackend.js';
import { getGlobalGPUBackend } from '../../../matrix/src/backends/GPUBackend.js';
import { DenseMatrix } from '../../../matrix/src/types/DenseMatrix.js';

// Served from the repo root by the local static server.
const WASM_URL = '/matrix/dist/wasm/mathts-as.wasm';

export interface Row {
  n: number;
  jsMs: number;
  wasmMs: number;
  gpuMs: number; // NaN if WebGPU unavailable
  wasmVsJs: number; // speedup (jsMs / wasmMs)
  gpuVsJs: number; // speedup (jsMs / gpuMs), NaN if unavailable
  wasmMaxDiff: number; // vs JS reference
  gpuMaxDiff: number; // vs JS reference (f32 precision → larger)
}
export interface BenchResult {
  rows: Row[];
  wasmActive: boolean;
  gpuStatus: string;
}

function randFlat(n: number): number[] {
  const a = new Array<number>(n * n);
  for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  return a;
}

/** Flat Float64Array of a DenseMatrix result (private field — fine for a bench). */
function flatOf(m: DenseMatrix): Float64Array {
  return (m as unknown as { data: Float64Array }).data;
}

function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = Math.abs(a[i] - b[i]);
    if (x > d) d = x;
  }
  return d;
}

function medianSync(reps: number, fn: () => void): number {
  fn(); // warmup
  const ts: number[] = [];
  for (let r = 0; r < reps; r++) {
    const t = performance.now();
    fn();
    ts.push(performance.now() - t);
  }
  ts.sort((x, y) => x - y);
  return ts[Math.floor(ts.length / 2)];
}

async function medianAsync(reps: number, fn: () => Promise<unknown>): Promise<number> {
  await fn(); // warmup
  const ts: number[] = [];
  for (let r = 0; r < reps; r++) {
    const t = performance.now();
    await fn();
    ts.push(performance.now() - t);
  }
  ts.sort((x, y) => x - y);
  return ts[Math.floor(ts.length / 2)];
}

export async function runBench(
  sizes: number[] = [128, 256, 512, 1024],
  reps = 5
): Promise<BenchResult> {
  const wasm = new WASMBackend({ wasmPath: WASM_URL });
  await wasm.initialize();
  const wasmActive = (wasm as unknown as { wasmModule: unknown }).wasmModule != null;

  const gpu = getGlobalGPUBackend();
  await gpu.initialize();
  const gpuOk = gpu.isReady;

  const rows: Row[] = [];
  for (const n of sizes) {
    const flatA = randFlat(n);
    const flatB = randFlat(n);
    const dmA = DenseMatrix.fromFlat(n, n, flatA);
    const dmB = DenseMatrix.fromFlat(n, n, flatB);
    const f32A = Float32Array.from(flatA);
    const f32B = Float32Array.from(flatB);

    const jsRef = flatOf(jsBackend.multiply(dmA, dmB));
    const jsMs = medianSync(reps, () => void jsBackend.multiply(dmA, dmB));

    const wasmRes = flatOf(wasm.multiply(dmA, dmB));
    const wasmMs = medianSync(reps, () => void wasm.multiply(dmA, dmB));

    let gpuMs = NaN;
    let gpuMaxDiff = NaN;
    if (gpuOk) {
      const gpuRes = await gpu.matmul(f32A, f32B, n, n, n);
      gpuMaxDiff = maxAbsDiff(jsRef, gpuRes);
      gpuMs = await medianAsync(reps, () => gpu.matmul(f32A, f32B, n, n, n));
    }

    rows.push({
      n,
      jsMs,
      wasmMs,
      gpuMs,
      wasmVsJs: jsMs / wasmMs,
      gpuVsJs: gpuOk ? jsMs / gpuMs : NaN,
      wasmMaxDiff: maxAbsDiff(jsRef, wasmRes),
      gpuMaxDiff,
    });
  }

  return { rows, wasmActive, gpuStatus: gpu.status };
}

// Expose to the page.
(globalThis as unknown as { runBench: typeof runBench }).runBench = runBench;
