/**
 * WS-2: benchmark the five OpNames absent from DEFAULT_THRESHOLD_BY_OP
 * (histogram, outer, matvec, transpose, integrateChunk-via-integrate), which
 * silently ride the untested 50 000 global threshold — and, for the four pool
 * methods, dispatch to workers UNCONDITIONALLY (no shouldParallelize gate).
 *
 * Measures inline-JS sequential baseline vs the computePool worker path across
 * a size ladder (median of N reps). Run from repo root after a build:
 *
 *   node tools/benchmarks/ws2-missing-ops.mjs
 *
 * CAVEAT: hardware/load dependent — medians of interleaved reps mitigate noise.
 */
import { computePool } from '../../parallel/dist/index.js';

const REPS = 9;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function rand(n) {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  return a;
}

async function bench(label, sizes, seqFn, parFn, sizeOf) {
  console.log(`\n=== ${label} ===`);
  console.log('size'.padEnd(12), 'seq(ms)'.padEnd(10), 'par(ms)'.padEnd(10), 'speedup');
  for (const s of sizes) {
    const seqTimes = [], parTimes = [];
    // interleave seq/par reps so load noise hits both arms equally
    for (let r = 0; r < REPS; r++) {
      let t = performance.now();
      await seqFn(s);
      seqTimes.push(performance.now() - t);
      t = performance.now();
      await parFn(s);
      parTimes.push(performance.now() - t);
    }
    const seq = median(seqTimes), par = median(parTimes);
    console.log(
      String(sizeOf ? sizeOf(s) : s).padEnd(12),
      seq.toFixed(3).padEnd(10),
      par.toFixed(3).padEnd(10),
      (seq / par).toFixed(2) + 'x'
    );
  }
}

// force the pool to always dispatch (bypass global threshold) for the par arm
await computePool.initialize();
computePool.updateConfig({ thresholdElements: 1 });

// --- histogram -------------------------------------------------------------
function jsHistogram(data, bins, min, max) {
  const h = new Array(bins).fill(0);
  const w = (max - min) / bins;
  for (let i = 0; i < data.length; i++) {
    let b = Math.floor((data[i] - min) / w);
    if (b >= bins) b = bins - 1;
    if (b < 0) b = 0;
    h[b]++;
  }
  return h;
}
{
  const sizes = [1e4, 1e5, 1e6, 4e6].map(Math.round);
  const inputs = new Map(sizes.map((n) => [n, rand(n)]));
  await bench(
    'histogram (64 bins)',
    sizes,
    async (n) => jsHistogram(inputs.get(n), 64, -1, 1),
    async (n) => computePool.histogram(inputs.get(n), 64, -1, 1)
  );
}

// --- transpose ---------------------------------------------------------------
function jsTranspose(data, rows, cols) {
  const out = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) out[j * rows + i] = data[i * cols + j];
  return out;
}
{
  const dims = [64, 256, 512, 1024, 2048];
  const inputs = new Map(dims.map((d) => [d, rand(d * d)]));
  await bench(
    'transpose (n x n)',
    dims,
    async (d) => jsTranspose(inputs.get(d), d, d),
    async (d) => computePool.transpose(inputs.get(d), d, d),
    (d) => `${d}x${d} (${d * d})`
  );
}

// --- matvec ------------------------------------------------------------------
function jsMatvec(m, rows, cols, v) {
  const out = new Float64Array(rows);
  for (let i = 0; i < rows; i++) {
    let s = 0;
    for (let j = 0; j < cols; j++) s += m[i * cols + j] * v[j];
    out[i] = s;
  }
  return out;
}
{
  const dims = [64, 256, 512, 1024, 2048];
  const mats = new Map(dims.map((d) => [d, rand(d * d)]));
  const vecs = new Map(dims.map((d) => [d, rand(d)]));
  await bench(
    'matvec (n x n · n)',
    dims,
    async (d) => jsMatvec(mats.get(d), d, d, vecs.get(d)),
    async (d) => computePool.matvec(mats.get(d), d, d, vecs.get(d)),
    (d) => `${d}x${d} (${d * d})`
  );
}

// --- outer -------------------------------------------------------------------
function jsOuter(a, b) {
  const out = new Float64Array(a.length * b.length);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) out[i * b.length + j] = a[i] * b[j];
  return out;
}
{
  const dims = [64, 256, 512, 1024, 2048];
  const as = new Map(dims.map((d) => [d, rand(d)]));
  const bs = new Map(dims.map((d) => [d, rand(d)]));
  await bench(
    'outer (n ⊗ n)',
    dims,
    async (d) => jsOuter(as.get(d), bs.get(d)),
    async (d) => computePool.outer(as.get(d), bs.get(d)),
    (d) => `${d}⊗${d} (${d * d})`
  );
}

// --- integrate (integrateChunk tasks) ---------------------------------------
// Sequential baseline: 64-node Gauss-Legendre-ish composite midpoint quadrature
// with the same total evaluation count as the parallel path's subdomains.
function jsIntegrate(f, a, b, n) {
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h);
  return s * h;
}
{
  const f = (x) => Math.exp(-x * x) * Math.sin(3 * x) * Math.cos(x / 2);
  const fnSource = f.toString();
  // 64 pseudo-GL nodes per sub-domain (uniform nodes; accuracy irrelevant for
  // timing — evaluation count is what matters). Total evals = workers × 64.
  const NODES = Array.from({ length: 64 }, (_, i) => -1 + ((i + 0.5) * 2) / 64);
  const WEIGHTS = new Array(64).fill(2 / 64);
  const workerCounts = [2, 8, 32, 128, 512];
  await bench(
    'integrateFanOut (64 evals/subdomain)',
    workerCounts,
    async (w) => jsIntegrate(f, -3, 3, w * 64),
    async (w) => computePool.integrateFanOut(fnSource, -3, 3, w, NODES, WEIGHTS),
    (w) => `${w} tasks (${w * 64} evals)`
  );
}

await computePool.shutdown?.();
process.exit(0);
