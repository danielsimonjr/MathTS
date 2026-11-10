/**
 * Benchmark the typed Float64Array ops that dispatched to worker threads before they became
 * synchronous. Medians of 9 interleaved reps at 5e4 / 5e5 / 5e6 elements, wall time.
 * The "sync" arm is always the shipped synchronous function from the built functions
 * package, with the WASM tier loaded (`loadWasm()`).
 *
 * Sections (pass one or more names; no name runs `unary`):
 *
 *   unary     The ops that dispatched through a NAMELESS shouldParallelize(len) (the global
 *             50k threshold): 14 arithmetic ops and 9 trigonometry ops. Worker arm:
 *             computePool.applyKernel with the kernel source the old signature sent.
 *   mapped    special and distributions ops that dispatched through the old async mapArray
 *             helper (nameless gate, applyKernel). Worker arm: the same function from a build
 *             of the parent commit, awaited. Set BENCH_BASELINE_DIST to its index.js
 *             (default functions/.bench/baseline-dist/index.js). The section fails when the
 *             file is missing.
 *   fft       fft2d and spectrogram (nameless gate, computePool.fftBatch). Worker arm: the
 *             parent-commit build, as for `mapped`. Size = rows*cols or frames*nfft.
 *   matmul    matmul (sync, matmulSequential) against computePool.matmul (workers above its
 *             4 096-element threshold), square n x n.
 *
 * Run from the repo root after a build:
 *
 *   node tools/benchmarks/sync-unary-kernels.mjs unary mapped fft matmul
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { computePool } from '../../parallel/dist/index.js';
import * as fns from '../../functions/dist/index.js';

const REPS = 9;
const SIZES = [5e4, 5e5, 5e6];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const sections = process.argv.slice(2).length ? process.argv.slice(2) : ['unary'];

// op name -> worker kernel source (the source the old typed signature sent)
const OPS = {
  sign: '(x) => Math.sign(x)',
  cube: '(x) => x * x * x',
  cbrt: '(x) => Math.cbrt(x)',
  log10: '(x) => Math.log10(x)',
  log2: '(x) => Math.log2(x)',
  log1p: '(x) => Math.log1p(x)',
  expm1: '(x) => Math.expm1(x)',
  round: '(x) => Math.round(x)',
  floor: '(x) => Math.floor(x)',
  ceil: '(x) => Math.ceil(x)',
  fix: '(x) => Math.trunc(x)',
  cosh: '(x) => Math.cosh(x)',
  sinh: '(x) => Math.sinh(x)',
  tanh: '(x) => Math.tanh(x)',
  csc: '(x) => 1 / Math.sin(x)',
  sec: '(x) => 1 / Math.cos(x)',
  cot: '(x) => 1 / Math.tan(x)',
  asin: '(x) => Math.asin(x)',
  acos: '(x) => Math.acos(x)',
  atan: '(x) => Math.atan(x)',
  asinh: '(x) => Math.asinh(x)',
  acosh: '(x) => Math.acosh(x)',
  atanh: '(x) => Math.atanh(x)',
};

// op name -> [build the call arguments from the data array, a value range for the data]
const MAPPED = {
  erfc: [(x) => [x], 4],
  erfi: [(x) => [x], 2],
  digamma: [(x) => [x], 10],
  lambertW: [(x) => [x], 10],
  besselK: [(x) => [1, x], 10],
  legendreP: [(x) => [5, x], 1],
  sinIntegral: [(x) => [x], 10],
  fresnelC: [(x) => [x], 10],
  normalCDF: [(x) => [x], 4],
  poissonPMF: [(x) => [x, 3], 10],
};

/** Time `sync()` and `workers()` REPS times, interleaved, and print one table row. */
async function row(label, n, sync, workers) {
  const seqT = [];
  const parT = [];
  for (let r = 0; r < REPS; r++) {
    let t = performance.now();
    sync();
    seqT.push(performance.now() - t);
    t = performance.now();
    await workers();
    parT.push(performance.now() - t);
  }
  const s = median(seqT);
  const p = median(parT);
  console.log(`| ${label} | ${n} | ${s.toFixed(2)} | ${p.toFixed(2)} | ${(s / p).toFixed(2)}x |`);
}

function randomArray(n, range) {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random() * range;
  return a;
}

async function loadBaseline() {
  const path = resolve(process.env.BENCH_BASELINE_DIST ?? 'functions/.bench/baseline-dist/index.js');
  if (!existsSync(path)) {
    throw new Error(`baseline build not found: ${path} (set BENCH_BASELINE_DIST)`);
  }
  const old = await import(pathToFileURL(path).href);
  await old.loadWasm();
  return old;
}

const header = () => {
  console.log('| op | size | sync typed fn (ms) | workers (ms) | workers speedup |');
  console.log('|---|---|---|---|---|');
};

const wasm = await fns.loadWasm();
await computePool.initialize();
console.log(`WASM tier loaded: ${wasm}`);

if (sections.includes('unary')) {
  console.log('\n## unary (worker arm: computePool.applyKernel)\n');
  header();
  const data = new Map(SIZES.map((n) => [n, randomArray(n, 10)]));
  // asin, acos and atanh take (-1, 1); acosh takes [1, inf).
  const domain = new Map(SIZES.map((n) => [n, randomArray(n, 1.8).map((v) => v - 0.9)]));
  const acoshData = new Map(SIZES.map((n) => [n, randomArray(n, 10).map((v) => v + 1)]));
  for (const [name, src] of Object.entries(OPS)) {
    const f = fns[name];
    for (const n of SIZES) {
      const a = ['asin', 'acos', 'atanh'].includes(name)
        ? domain.get(n)
        : name === 'acosh'
          ? acoshData.get(n)
          : data.get(n);
      await row(name, n, () => f(a), () => computePool.applyKernel(a, src));
    }
  }
}

if (sections.includes('mapped') || sections.includes('fft')) {
  const old = await loadBaseline();
  if (sections.includes('mapped')) {
    console.log('\n## mapped (worker arm: the parent-commit build, awaited)\n');
    header();
    for (const [name, [args, range]] of Object.entries(MAPPED)) {
      for (const n of SIZES) {
        const a = randomArray(n, range);
        const callArgs = args(a);
        await row(name, n, () => fns[name](...callArgs), () => old[name](...callArgs));
      }
    }
  }
  if (sections.includes('fft')) {
    console.log('\n## fft (worker arm: the parent-commit build, awaited)\n');
    header();
    for (const n of SIZES) {
      const side = 2 ** Math.round(Math.log2(Math.sqrt(n)));
      const x = Array.from({ length: side }, () => Array.from({ length: side }, Math.random));
      await row(`fft2d ${side}x${side}`, side * side, () => fns.fft2d(x), () => old.fft2d(x));
    }
    for (const n of SIZES) {
      // windowSize 256, hop 256: frames * nfft = n.
      const x = Array.from({ length: n }, Math.random);
      const opts = { windowSize: 256, hopSize: 256 };
      await row('spectrogram', n, () => fns.spectrogram(x, opts), () => old.spectrogram(x, opts));
    }
  }
}

if (sections.includes('matmul')) {
  console.log('\n## matmul (worker arm: computePool.matmul)\n');
  header();
  for (const n of [32, 64, 96, 128, 256, 512]) {
    const a = randomArray(n * n, 2);
    const b = randomArray(n * n, 2);
    await row(
      `matmul ${n}x${n}`,
      n * n,
      () => fns.matmul(a, n, n, b, n),
      () => computePool.matmul(a, n, n, b, n)
    );
  }
}

await computePool.terminate();
process.exit(0);
