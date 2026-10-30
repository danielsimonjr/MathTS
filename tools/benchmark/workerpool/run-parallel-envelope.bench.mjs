#!/usr/bin/env node
/**
 * P6-7 speed gate: the sub-threshold path of `sum`, `prod`, `norm`, `map`, `filter`, `sort` and
 * `reduce` (shared `runParallel` envelope) against the build before P6-7 (`--old`).
 *
 *   # the build under test
 *   bunx turbo build --filter=@danielsimonjr/mathts-workerpool
 *   # the baseline: the P6-6 `src/index.ts` built into its own directory
 *   git show 7b843c5b:packages/workerpool/src/index.ts > packages/workerpool/src/index.ts
 *   (cd packages/workerpool && bunx tsdown src/index.ts --format esm --out-dir node_modules/.cache/p6-7-old)
 *   git checkout -- packages/workerpool/src/index.ts
 *
 * The baseline goes under `node_modules` so that its `import 'workerpool'` resolves.
 *
 *   OLD=packages/workerpool/node_modules/.cache/p6-7-old/index.js
 *   node tools/benchmark/workerpool/run-parallel-envelope.bench.mjs --old $OLD
 *   bun tools/benchmark/workerpool/run-parallel-envelope.bench.mjs --old $OLD
 *
 * Rules from AGENTS.md "Benchmarking rules": the measured path is the one a caller takes (the
 * public method on a live, initialised pool, at n = parallelThreshold - 1 so the sequential branch
 * runs: that branch is the only one the refactor can slow, because the worker round trip dwarfs a
 * closure call); five warm-up samples per side; old and new timed alternately (A B B A) so JIT
 * warm-up cannot favour one side; a first pass requires equal results and equal envelope fields,
 * so a dead or wrong path fails the run instead of timing as fast. Exit code 1 when any method is
 * slower than the noise band (default 5%) by the median of the per-round ratios.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const oldIdx = argv.indexOf('--old');
const oldPath = oldIdx >= 0 ? argv[oldIdx + 1] : process.env.OLD_WORKERPOOL;
if (!oldPath) {
  console.error('usage: run-parallel-envelope.bench.mjs --old <path to the pre-P6-7 index.js>');
  process.exit(2);
}

const WARM = 5;
const ROUNDS = 21;
const NOISE = Number(process.env.BENCH_NOISE ?? 0.05);

const { MathWorkerPool: OldPool } = await import(pathToFileURL(resolve(oldPath)).href);
const { MathWorkerPool: NewPool } = await import(
  pathToFileURL(resolve(import.meta.dirname, '../../../packages/workerpool/dist/index.js')).href
);

const oldPool = new OldPool();
const newPool = new NewPool();
await oldPool.initialize();
await newPool.initialize();
const N = newPool.config.parallelThreshold - 1;
if (oldPool.config.parallelThreshold !== newPool.config.parallelThreshold) {
  throw new Error('old and new pools disagree on parallelThreshold');
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x5eed);
const f64 = new Float64Array(N);
const arr = new Array(N);
for (let i = 0; i < N; i++) {
  f64[i] = rand() * 2 - 1;
  arr[i] = Math.floor(rand() * 1000);
}

const mapFn = (x) => x * 2 + 1;
const filterFn = (x) => x % 3 === 0;
const addFn = (acc, x) => acc + x;
const cmpFn = (a, b) => a - b;

const ops = [
  { name: 'sum', reps: 300, run: (p) => p.sum(f64) },
  { name: 'prod', reps: 300, run: (p) => p.prod(f64) },
  { name: 'norm', reps: 300, run: (p) => p.norm(f64) },
  { name: 'map', reps: 100, run: (p) => p.map(arr, mapFn) },
  { name: 'filter', reps: 100, run: (p) => p.filter(arr, filterFn) },
  { name: 'reduce', reps: 200, run: (p) => p.reduce(arr, addFn, 7) },
  { name: 'sort', reps: 10, run: (p) => p.sort(arr, cmpFn) },
];

async function sample(op, pool) {
  const t0 = performance.now();
  let last;
  for (let i = 0; i < op.reps; i++) last = await op.run(pool);
  const ms = performance.now() - t0;
  if (last === undefined || last === null || last.parallelized !== false) {
    throw new Error(
      `${op.name}: expected a sequential result envelope, got ${JSON.stringify(last)}`
    );
  }
  return ms / op.reps;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

let slower = 0;
console.log(`n=${N} warm=${WARM} rounds=${ROUNDS} noise=${NOISE * 100}% (A=old, B=new, ABBA)`);

// Every op is checked and warmed on both builds before any is timed: the first op measured
// otherwise pays the other ops' JIT warm-up on one side only (sum read 0.52 without this).
for (const op of ops) {
  const a = await op.run(oldPool);
  const b = await op.run(newPool);
  const same =
    JSON.stringify(a.result) === JSON.stringify(b.result) &&
    a.chunks === b.chunks &&
    a.parallelized === b.parallelized &&
    a.workersUsed === b.workersUsed;
  if (!same) {
    console.error(`${op.name}: old and new results differ`);
    process.exit(1);
  }
}
for (let i = 0; i < WARM; i++) {
  for (const op of ops) {
    await sample(op, oldPool);
    await sample(op, newPool);
  }
}

for (const op of ops) {
  const ratios = [];
  const oldTimes = [];
  const newTimes = [];
  for (let r = 0; r < ROUNDS; r++) {
    const a1 = await sample(op, oldPool);
    const b1 = await sample(op, newPool);
    const b2 = await sample(op, newPool);
    const a2 = await sample(op, oldPool);
    ratios.push((b1 + b2) / (a1 + a2));
    oldTimes.push((a1 + a2) / 2);
    newTimes.push((b1 + b2) / 2);
  }
  const ratio = median(ratios);
  const verdict = ratio > 1 + NOISE ? 'SLOWER' : ratio < 1 - NOISE ? 'faster' : 'neutral';
  if (verdict === 'SLOWER') slower++;
  console.log(
    `${op.name.padEnd(7)} old ${(median(oldTimes) * 1000).toFixed(2)} us  new ${(median(newTimes) * 1000).toFixed(2)} us  new/old ${ratio.toFixed(3)}  ${verdict}`
  );
}

await oldPool.terminate(true);
await newPool.terminate(true);
if (slower > 0) {
  console.error(`${slower} method(s) slower than the ${NOISE * 100}% noise band`);
  process.exit(1);
}
