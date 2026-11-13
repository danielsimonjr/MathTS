// Interleaved A/B for svd() on the same n x n matrix in three input forms:
//   nested   - number[][] built as in issue #932
//   dense    - DenseMatrix built from the same values (the issue's slow arm)
//   pre      - DenseMatrix.toArray() output, built outside the timer, passed to svd()
// The pre arm separates the cost of the element-wise conversion from the cost of how
// the converted rows are allocated.
//
// Run with the expose-gc flag, from the repo root, after `bun run build` for matrix:
//   node --expose-gc tools/benchmarks/svd-dense-ab.mjs [n] [reps]
// Settings come from argv, then from environment variables:
//   MATHTS_AB_N      matrix size            (default 500)
//   MATHTS_AB_REPS   reps per arm           (default 5)
//   MATHTS_MATRIX_DIST  path to matrix/dist/index.js
//                      (default: matrix/dist/index.js under the repo root)

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

if (typeof globalThis.gc !== 'function') {
  throw new Error('svd-dense-ab: run with node --expose-gc (gc() is needed between timed calls)');
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const n = Number(process.argv[2] ?? process.env.MATHTS_AB_N ?? 500);
const reps = Number(process.argv[3] ?? process.env.MATHTS_AB_REPS ?? 5);
const distPath =
  process.env.MATHTS_MATRIX_DIST ?? path.join(repoRoot, 'matrix', 'dist', 'index.js');

if (!Number.isInteger(n) || n < 1 || !Number.isInteger(reps) || reps < 1) {
  throw new Error(`svd-dense-ab: n and reps must be positive integers (got n=${n}, reps=${reps})`);
}

const { DenseMatrix, svd } = await import(pathToFileURL(distPath).href);

// Same construction as the issue's reproduction.
function randNested(size, seed = 1) {
  const A = new Array(size);
  for (let i = 0; i < size; i++) {
    const r = new Array(size);
    for (let j = 0; j < size; j++) r[j] = Math.sin((i * size + j + seed) * 0.001);
    A[i] = r;
  }
  return A;
}

const nested = randNested(n);
for (let i = 0; i < n; i++) nested[i][i] += n;
const flat = new Float64Array(n * n);
for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) flat[i * n + j] = nested[i][j];
const dm = new DenseMatrix(n, n, flat);
const pre = dm.toArray();

const arms = {
  nested: () => svd(nested),
  dense: () => svd(dm),
  pre: () => svd(pre),
};
const names = Object.keys(arms);
const samples = Object.fromEntries(names.map((k) => [k, []]));
let sink = 0;

// Warm-up: one untimed call per arm, so JIT state does not favour the first arm.
for (const name of names) sink += arms[name]().S[0];

// Interleaved rounds. Each round rotates the arm order so no arm always runs first.
for (let r = 0; r < reps; r++) {
  for (let k = 0; k < names.length; k++) {
    const name = names[(r + k) % names.length];
    gc();
    const t0 = performance.now();
    const res = arms[name]();
    const ms = performance.now() - t0;
    sink += res.S[0];
    samples[name].push(ms);
    console.log(JSON.stringify({ round: r, arm: name, ms: Number(ms.toFixed(1)) }));
  }
}

function summarize(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return { median, min: s[0], max: s[s.length - 1] };
}

const stats = Object.fromEntries(names.map((k) => [k, summarize(samples[k])]));
console.log(`\nn=${n} reps=${reps} node=${process.version} sink=${sink.toExponential(3)}`);
for (const name of names) {
  const st = stats[name];
  console.log(
    `${name.padEnd(8)} median ${st.median.toFixed(1).padStart(9)} ms  min ${st.min.toFixed(1).padStart(9)}  max ${st.max.toFixed(1).padStart(9)}`
  );
}
console.log(
  `dense/nested median ratio ${(stats.dense.median / stats.nested.median).toFixed(3)}; pre/nested ${(stats.pre.median / stats.nested.median).toFixed(3)}`
);
