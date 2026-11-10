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
 *             helper (nameless gate, applyKernel).
 *   fft       fft2d and spectrogram (nameless gate, computePool.fftBatch). Size = rows*cols
 *             or frames*nfft.
 *
 *             Two builds of functions cannot load in one process (typed-function conversions
 *             register twice), so `mapped` and `fft` time one build per run, awaited, and print
 *             one time column. Run them once as is, and once with `--baseline` and
 *             BENCH_BASELINE_DIST set to the index.js of a build of the parent commit
 *             (default functions/.bench/baseline-dist/index.js; the run fails when the file is
 *             missing). The worker speedup is the ratio of the two time columns.
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

const REPS = 9;
const SIZES = [5e4, 5e5, 5e6];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const args = process.argv.slice(2).filter((a) => a !== '--baseline');
const useBaseline = process.argv.includes('--baseline');
const sections = args.length ? args : ['unary'];

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

/** Time `run()` REPS times and print one single-arm table row. */
async function row1(label, n, run) {
  const t = [];
  for (let r = 0; r < REPS; r++) {
    const t0 = performance.now();
    await run();
    t.push(performance.now() - t0);
  }
  console.log(`| ${label} | ${n} | ${median(t).toFixed(2)} |`);
}

async function loadBaseline() {
  const path = resolve(process.env.BENCH_BASELINE_DIST ?? 'functions/.bench/baseline-dist/index.js');
  if (!existsSync(path)) {
    throw new Error(`baseline build not found: ${path} (set BENCH_BASELINE_DIST)`);
  }
  return import(pathToFileURL(path).href);
}

const header = () => {
  console.log('| op | size | sync typed fn (ms) | workers (ms) | workers speedup |');
  console.log('|---|---|---|---|---|');
};

const fns = useBaseline ? await loadBaseline() : await import('../../functions/dist/index.js');
const build = useBaseline ? 'parent-commit build (old async path)' : 'shipped build (sync)';
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

const header1 = (title) => {
  console.log(`
## ${title}: ${build}
`);
  console.log('| op | size | ms |');
  console.log('|---|---|---|');
};

if (sections.includes('mapped')) {
  header1('mapped');
  for (const [name, [args, range]] of Object.entries(MAPPED)) {
    for (const n of SIZES) {
      const callArgs = args(randomArray(n, range));
      await row1(name, n, () => fns[name](...callArgs));
    }
  }
}

if (sections.includes('fft')) {
  header1('fft');
  for (const n of SIZES) {
    const side = 2 ** Math.round(Math.log2(Math.sqrt(n)));
    const x = Array.from({ length: side }, () => Array.from({ length: side }, Math.random));
    await row1(`fft2d ${side}x${side}`, side * side, () => fns.fft2d(x));
  }
  for (const n of SIZES) {
    // windowSize 256, hop 256: frames * nfft = n.
    const x = Array.from({ length: n }, Math.random);
    await row1('spectrogram', n, () => fns.spectrogram(x, { windowSize: 256, hopSize: 256 }));
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
