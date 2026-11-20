#!/usr/bin/env node
/**
 * Time the public FFT entry points of `@danielsimonjr/mathts-functions` against `fft.js`.
 *
 * Run it with `node` directly (a `bun run` script puts `node` back on Bun):
 *
 *   FFTJS_MODULE=/abs/path/to/node_modules/fft.js/lib/fft.js \
 *     node --expose-gc tools/benchmark/functions/fft-entry-points.bench.mjs <n> [rounds]
 *
 * `fft.js` is not a dependency of the repository. Install it in a scratch folder
 * (`npm install fft.js@4.0.4`) and pass the path of its entry file in `FFTJS_MODULE`.
 * `FUNCTIONS_ENTRY` selects another built entry of the functions package (default: the
 * `dist/index.js` of this checkout). Build the package first: `bunx turbo build --filter=@danielsimonjr/mathts-functions`.
 *
 * Each round times every entry point once. The order alternates between rounds (forward, then
 * reverse). The ratio of a round is the time of an entry point divided by the time of `fft.js`
 * (plan built per call) in the same round. The table shows the median of the per-round ratios,
 * so a slow round that hits every entry point does not move the result. `fft.js` appears twice:
 * with `new FFT(n)` and both work arrays inside the timed call (what a caller sees that builds a
 * plan for each signal), and with them built once (the best case of `fft.js`).
 *
 * Other jobs on the host change the milliseconds. Compare the ratios, and state the host and the
 * Node version with every table.
 */
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const fftJsPath = process.env.FFTJS_MODULE;
if (!fftJsPath) {
  throw new Error(
    'FFTJS_MODULE is not set. Install fft.js in a scratch folder (npm install fft.js@4.0.4) and pass the path of its entry file.'
  );
}
const functionsEntry = resolve(
  process.env.FUNCTIONS_ENTRY ?? join(here, '..', '..', '..', 'functions', 'dist', 'index.js')
);

const FFT = createRequire(import.meta.url)(resolve(fftJsPath));
const F = await import(pathToFileURL(functionsEntry).href);

const n = Number(process.argv[2] ?? 65536);
const rounds = Number(process.argv[3] ?? 15);
if (!Number.isInteger(n) || n < 2 || (n & (n - 1)) !== 0) {
  throw new Error(`n must be a power of two (got ${process.argv[2]})`);
}
if (!Number.isInteger(rounds) || rounds < 1) {
  throw new Error(`rounds must be a positive integer (got ${process.argv[3]})`);
}
const gc = globalThis.gc;

// Raise the priority of this process only, so other jobs on the host take fewer of the timed slices.
try {
  os.setPriority(0, os.constants.priority.PRIORITY_HIGH);
} catch (e) {
  console.log('priority not raised:', e.message);
}

// One fixed pseudo-random real signal (Park-Miller), the same for every entry point.
let seed = 12345;
const data = new Float64Array(n);
for (let i = 0; i < n; i++) {
  seed = (seed * 48271) % 2147483647;
  data[i] = seed / 2147483647 - 0.5;
}
const arr = Array.from(data);

function fftJsPerCall() {
  const plan = new FFT(n);
  const out = plan.createComplexArray();
  const input = plan.createComplexArray();
  for (let i = 0; i < n; i++) input[2 * i] = data[i];
  plan.transform(out, input);
  return out;
}

const reusedPlan = new FFT(n);
const reusedOut = reusedPlan.createComplexArray();
const reusedIn = reusedPlan.createComplexArray();
for (let i = 0; i < n; i++) reusedIn[2 * i] = data[i];
function fftJsReused() {
  reusedPlan.transform(reusedOut, reusedIn);
  return reusedOut;
}

const candidates = [
  ['fft(number[])', () => F.fft(arr)],
  ['fft(Float64Array)', () => F.fft(data)],
  ['parallelFFT(number[])', () => F.parallelFFT(arr)],
  ['await parallelFFT(Float64Array)', async () => F.parallelFFT(data)],
  ['fft.js, plan per call', fftJsPerCall],
  ['fft.js, plan and arrays reused', fftJsReused],
];
const ref = candidates.length - 2;
const refReused = candidates.length - 1;

// One warm-up call of each entry point (JIT, twiddle tables).
for (const [, fn] of candidates) await fn();

const times = candidates.map(() => []);
for (let r = 0; r < rounds; r++) {
  const order = candidates.map((_, i) => i);
  if (r % 2 === 1) order.reverse();
  for (const i of order) {
    if (gc) gc();
    const t0 = performance.now();
    await candidates[i][1]();
    times[i].push(performance.now() - t0);
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

console.log(
  `n=${n} rounds=${rounds} node=${process.version} os=${os.type()} ${os.release()} ${os.arch()}`
);
console.log(`cpu=${os.cpus()[0].model} x${os.cpus().length} date=${new Date().toISOString()}`);
console.log(
  '| Entry point | median ms | min ms | median ratio to fft.js (plan per call) | min ratio | max ratio | median ratio to fft.js (plan reused) |'
);
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (let i = 0; i < candidates.length; i++) {
  const ratios = times[i].map((t, r) => t / times[ref][r]);
  const ratiosReused = times[i].map((t, r) => t / times[refReused][r]);
  console.log(
    `| ${candidates[i][0]} | ${median(times[i]).toFixed(2)} | ${Math.min(...times[i]).toFixed(2)} | ${median(ratios).toFixed(2)} | ${Math.min(...ratios).toFixed(2)} | ${Math.max(...ratios).toFixed(2)} | ${median(ratiosReused).toFixed(2)} |`
  );
}
