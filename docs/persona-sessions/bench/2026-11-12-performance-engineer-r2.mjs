#!/usr/bin/env node
/**
 * MathTS persona dogfood harness — performance engineer, 2026-11-12.
 * Re-run: node --expose-gc harness.mjs
 */
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(fileURLToPath(import.meta.url));
const gc = globalThis.gc;

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const pct = (p) => {
    const i = (n - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  return {
    n,
    min: s[0],
    median: pct(0.5),
    p95: pct(0.95),
    max: s[n - 1],
    mean,
    stdev: Math.sqrt(variance),
    variance,
  };
}

function heap() {
  if (gc) gc();
  const m = process.memoryUsage();
  return { rss: m.rss, heapUsed: m.heapUsed, external: m.external };
}

async function tryRecord(name, fn, opts) {
  try {
    record(await bench(name, fn, opts));
  } catch (e) {
    const msg = e && e.stack ? e.stack : String(e);
    const short = String(e.message || e).slice(0, 400);
    results.notes.push(`FAIL ${name}: ${short}`);
    results.cases.push({ name, error: short, stack: msg.split('\n').slice(0, 8) });
    console.log(`FAIL ${name}: ${short}`);
  }
}

async function bench(name, fn, { warmup = 5, iters = 15 } = {}) {
  for (let i = 0; i < warmup; i++) await fn();
  const samples = [];
  const h0 = heap();
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  const h1 = heap();
  return {
    name,
    ms: stats(samples),
    heapDeltaBytes: {
      rss: h1.rss - h0.rss,
      heapUsed: h1.heapUsed - h0.heapUsed,
      external: h1.external - h0.external,
    },
  };
}

function randNested(n, seed = 1) {
  const A = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = new Array(n);
    for (let j = 0; j < n; j++) r[j] = Math.sin((i * n + j + seed) * 0.001);
    A[i] = r;
  }
  return A;
}

function randF64(n, seed = 1) {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = Math.sin((i + seed) * 0.001);
  return d;
}

function maxAbsDiff(a, b) {
  let m = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

const results = {
  env: {
    cpu: 'Intel(R) Xeon(R) Processor',
    cores: 4,
    node: process.version,
    bun: null,
    os: `${process.platform} ${process.arch}`,
    exposeGc: Boolean(gc),
    shaRepoHint: 'published npm, not repo build',
  },
  cases: [],
  importTimesMs: {},
  bundles: {},
  packages: {},
  determinism: [],
  notes: [],
};

function record(r) {
  results.cases.push(r);
  const m = r.ms;
  console.log(
    `${r.name}: median=${m.median.toFixed(3)}ms p95=${m.p95.toFixed(3)} stdev=${m.stdev.toFixed(3)} heapΔ=${r.heapDeltaBytes.heapUsed}`
  );
}

// --- import / cold start (fresh processes) ---
function importTime(spec) {
  const code = `const t=performance.now(); await import(${JSON.stringify(spec)}); console.log(performance.now()-t);`;
  const samples = [];
  for (let i = 0; i < 7; i++) {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    if (r.status !== 0) {
      return { error: r.stderr || r.stdout };
    }
    samples.push(Number(r.stdout.trim().split('\n').pop()));
  }
  return stats(samples);
}

console.log('=== import / cold-start ===');
if (process.env.SKIP_META) {
  results.notes.push('SKIP_META: reused prior import/bundle measurements');
} else
  for (const spec of [
    '@danielsimonjr/mathts-functions',
    '@danielsimonjr/mathts-matrix',
    '@danielsimonjr/mathts-core',
    '@danielsimonjr/mathts-tensor',
    'mathjs',
    'ml-matrix',
    'fft.js',
  ]) {
    const s = importTime(spec);
    results.importTimesMs[spec] = s;
    console.log(
      'import',
      spec,
      s.error || `median=${s.median.toFixed(1)}ms p95=${s.p95.toFixed(1)}`
    );
  }

// --- esbuild bundles ---
async function bundleSize(entryCode, outfile) {
  const esbuild = (await import('esbuild')).default;
  const src = join(ROOT, outfile + '.entry.mjs');
  writeFileSync(src, entryCode);
  const r = await esbuild.build({
    entryPoints: [src],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    packages: 'bundle',
  });
  const bytes = r.outputFiles[0].contents.byteLength;
  return bytes;
}

console.log('=== bundles ===');
try {
  results.bundles['functions-named-evaluate'] = await bundleSize(
    `import { evaluate } from '@danielsimonjr/mathts-functions'; console.log(evaluate);`,
    'b-eval'
  );
  results.bundles['functions-star'] = await bundleSize(
    `import * as F from '@danielsimonjr/mathts-functions'; console.log(Object.keys(F).length);`,
    'b-star'
  );
  results.bundles['matrix-named-DenseMatrix'] = await bundleSize(
    `import { DenseMatrix } from '@danielsimonjr/mathts-matrix'; console.log(DenseMatrix);`,
    'b-dm'
  );
  results.bundles['matrix-star'] = await bundleSize(
    `import * as M from '@danielsimonjr/mathts-matrix'; console.log(Object.keys(M).length);`,
    'b-mstar'
  );
  results.bundles['mathjs-evaluate'] = await bundleSize(
    `import { evaluate } from 'mathjs'; console.log(evaluate);`,
    'b-mje'
  );
  results.bundles['fft-js'] = await bundleSize(
    `import FFT from 'fft.js'; console.log(FFT);`,
    'b-fft'
  );
  results.bundles['ml-matrix-Matrix'] = await bundleSize(
    `import { Matrix } from 'ml-matrix'; console.log(Matrix);`,
    'b-ml'
  );
  console.log(results.bundles);
} catch (e) {
  results.notes.push(`esbuild failed: ${e.message}`);
  console.log('esbuild failed', e);
}

// --- package meta ---
import { readdirSync, statSync } from 'node:fs';
function duBytes(p) {
  let t = 0;
  const st = statSync(p);
  if (st.isFile()) return st.size;
  for (const n of readdirSync(p)) t += duBytes(join(p, n));
  return t;
}
for (const name of [
  '@danielsimonjr/mathts-functions',
  '@danielsimonjr/mathts-matrix',
  '@danielsimonjr/mathts-core',
  '@danielsimonjr/mathts-linalg',
  '@danielsimonjr/mathts-tensor',
  '@danielsimonjr/mathts-signal',
  '@danielsimonjr/mathts-statistics',
  '@danielsimonjr/mathts-parallel',
  '@danielsimonjr/mathts-expression',
  'mathjs',
  'ml-matrix',
  'fft.js',
]) {
  const pkgPath = join(ROOT, 'node_modules', name);
  const pj = JSON.parse(readFileSync(join(pkgPath, 'package.json'), 'utf8'));
  results.packages[name] = {
    version: pj.version,
    diskBytes: duBytes(pkgPath),
    deps: Object.keys(pj.dependencies || {}),
  };
}

// --- live benches ---
const {
  evaluate,
  compileExpr,
  parse,
  fft,
  parallelFFT,
  mean,
  std,
  variance,
  median,
  sort,
  add: mathAdd,
  sin,
  loadWasm,
  isWasmLoaded,
} = await import('@danielsimonjr/mathts-functions');
const { DenseMatrix, backendManager } = await import('@danielsimonjr/mathts-matrix');
const { svd, lu, luSolve } = await import('@danielsimonjr/mathts-linalg');
const { Tensor } = await import('@danielsimonjr/mathts-tensor');
const { ComputePool } = await import('@danielsimonjr/mathts-parallel');
const { create, all } = await import('mathjs');
const { Matrix } = await import('ml-matrix');
const FFT = (await import('fft.js')).default;
const math = create(all);

console.log('=== scalar evaluate / compile ===');
await tryRecord('mathts.evaluate.scalar', () => evaluate('2+3*4-sin(0.5)^2'), {
  warmup: 20,
  iters: 80,
});
const compiled = compileExpr('2+3*x-sin(y)^2');
await tryRecord('mathts.compileExpr.evaluate', () => compiled.evaluate({ x: 4, y: 0.5 }), {
  warmup: 20,
  iters: 80,
});
await tryRecord(
  'mathts.parse+compile+evaluate',
  () => {
    const n = parse('2+3*x-sin(y)^2');
    const c = n.compile();
    return c.evaluate({ x: 4, y: 0.5 });
  },
  { warmup: 10, iters: 40 }
);
await tryRecord('mathjs.evaluate.scalar', () => math.evaluate('2+3*4-sin(0.5)^2'), {
  warmup: 20,
  iters: 80,
});
const mjCompiled = math.compile('2+3*x-sin(y)^2');
await tryRecord('mathjs.compile.evaluate', () => mjCompiled.evaluate({ x: 4, y: 0.5 }), {
  warmup: 20,
  iters: 80,
});

console.log('=== elementwise 1e5 / 1e6 ===');
const v1e5 = randF64(1e5);
const v1e6 = randF64(1e6);
const a1e5 = Array.from(v1e5);
await tryRecord('mathts.add.1e5.number[]', () => mathAdd(a1e5, a1e5), { warmup: 5, iters: 12 });
await tryRecord('mathts.sin.1e5.Float64Array', () => sin(v1e5), { warmup: 5, iters: 12 });
await tryRecord(
  'mathts.DenseMatrix.add.1e5',
  () => {
    const m = new DenseMatrix(1, v1e5.length, v1e5);
    return m.add(m);
  },
  { warmup: 5, iters: 10 }
);
await tryRecord('mathjs.add.1e5', () => math.add(a1e5, a1e5), { warmup: 3, iters: 8 });
await tryRecord(
  'mathts.add.1e6.Float64Array-as-array',
  () => mathAdd(Array.from(v1e6), Array.from(v1e6)),
  { warmup: 2, iters: 5 }
);

console.log('=== matmul ===');
for (const n of process.env.SKIP_HEAVY ? [128] : [128, 512, 1024]) {
  const flat = randF64(n * n);
  const dm = new DenseMatrix(n, n, flat);
  const nested = [];
  for (let i = 0; i < n; i++) nested.push(Array.from(flat.subarray(i * n, (i + 1) * n)));
  const ml = new Matrix(nested);
  const iters = n >= 1024 ? 3 : n >= 512 ? 5 : 10;
  await tryRecord(`mathts.DenseMatrix.multiply.${n}`, () => dm.multiply(dm), { warmup: 2, iters });
  await tryRecord(`ml-matrix.mmul.${n}`, () => ml.mmul(ml), { warmup: 2, iters });
  if (n <= 128) {
    await tryRecord(`mathjs.multiply.nested.${n}`, () => math.multiply(nested, nested), {
      warmup: 1,
      iters: 3,
    });
  }
}

console.log('=== backendManager WASM GEMM ===');
const initOk = await backendManager.initialize();
results.notes.push(
  `backendManager.initialize() => ${initOk} backends=${backendManager.getAvailableBackends?.()}`
);
const n512 = 512;
const dm512 = new DenseMatrix(n512, n512, randF64(n512 * n512));
await tryRecord('mathts.backendManager.multiply.512', () => backendManager.multiply(dm512, dm512), {
  warmup: 2,
  iters: 5,
});
backendManager.forceBackend('wasm');
await tryRecord(
  'mathts.backendManager.multiply.512.forceWasm',
  () => backendManager.multiply(dm512, dm512),
  {
    warmup: 1,
    iters: 4,
  }
);
backendManager.forceBackend(null);

console.log('=== solve / SVD ===');
{
  const n = 500;
  const A = randNested(n);
  for (let i = 0; i < n; i++) A[i][i] += n;
  const b = Array.from({ length: n }, (_, i) => Math.sin(i + 1));
  const dmA = DenseMatrix.fromArray(A);
  await tryRecord(
    'mathts.luSolve.DenseMatrix.500',
    () => {
      const fac = lu(dmA);
      return luSolve(fac, b);
    },
    { warmup: 1, iters: 3 }
  );
  await tryRecord(
    'mathts.lu.nested.8.shouldFail',
    () =>
      lu([
        [4, 1],
        [1, 3],
      ]),
    { warmup: 0, iters: 1 }
  );
  try {
    await tryRecord('mathjs.lusolve.500', () => math.lusolve(A, b), { warmup: 1, iters: 3 });
  } catch (e) {
    results.notes.push(`mathjs.lusolve.500 failed: ${e.message}`);
  }
  const A128 = randNested(128);
  await tryRecord('mathts.svd.nested.128', () => svd(A128), { warmup: 1, iters: 4 });
  if (!process.env.SKIP_HEAVY) {
    const A500 = randNested(500);
    await tryRecord('mathts.svd.nested.500', () => svd(A500), { warmup: 0, iters: 1 });
  }
  const dm500 = new DenseMatrix(500, 500, randF64(500 * 500));
  await tryRecord('mathts.svd.DenseMatrix.500', () => svd(dm500), { warmup: 1, iters: 3 });
}

console.log('=== FFT ===');
function fftJsReal(n, data) {
  const f = new FFT(n);
  const out = f.createComplexArray();
  const input = f.createComplexArray();
  for (let i = 0; i < n; i++) input[2 * i] = data[i];
  f.transform(out, input);
  return out;
}

for (const n of process.env.SKIP_HEAVY ? [1 << 16] : [1 << 16, 1 << 20]) {
  const data = randF64(n);
  const arr = Array.from(data);
  const iters = n >= 1 << 20 ? 3 : 6;
  await tryRecord(`mathts.fft.number[].${n}`, () => fft(arr), { warmup: 1, iters });
  await tryRecord(`mathts.parallelFFT.${n}`, () => parallelFFT(data), { warmup: 1, iters });
  await tryRecord(`fft.js.transform.${n}`, () => fftJsReal(n, data), { warmup: 1, iters });
  if (n <= 1 << 16) {
    await tryRecord(`mathjs.fft.${n}`, () => math.fft(arr), { warmup: 1, iters: 3 });
  }
}

console.log('=== statistics / sort / tensor ===');
{
  const a = Array.from(v1e6);
  await tryRecord('mathts.mean.1e6', () => mean(a), { warmup: 3, iters: 8 });
  await tryRecord('mathts.std.1e6', () => std(a), { warmup: 2, iters: 6 });
  await tryRecord('mathts.variance.1e6', () => variance(a), { warmup: 2, iters: 6 });
  await tryRecord('mathts.median.1e6', () => median(a), { warmup: 1, iters: 4 });
  await tryRecord('mathjs.mean.1e6', () => math.mean(a), { warmup: 2, iters: 6 });
  const s = Array.from(v1e5);
  await tryRecord('mathts.sort.1e5', () => sort(s.slice()), { warmup: 3, iters: 8 });
  await tryRecord('js.Float64Array.sort.1e5', () => randF64(1e5).sort(), { warmup: 3, iters: 8 });
  const tA = new Tensor([1000, 1], randF64(1000));
  const tB = new Tensor([1, 1000], randF64(1000));
  await tryRecord('mathts.Tensor.mul.broadcast.1000x1000', () => tA.mul(tB), {
    warmup: 3,
    iters: 10,
  });
}

console.log('=== parallel vs single-thread ===');
{
  const pool = new ComputePool();
  await pool.initialize();
  const v = randF64(1e6);
  await tryRecord('ComputePool.sin.1e6', () => pool.sin(v), { warmup: 2, iters: 6 });
  await tryRecord('typed.sin.number[].1e6', () => sin(v), { warmup: 1, iters: 4 });
  const n = 256;
  const A = randF64(n * n);
  const B = randF64(n * n);
  await tryRecord('ComputePool.matmul.256', () => pool.matmul(A, n, n, B, n), {
    warmup: 2,
    iters: 6,
  });
  const dm = new DenseMatrix(n, n, A);
  const dn = new DenseMatrix(n, n, B);
  await tryRecord('DenseMatrix.multiply.256', () => dm.multiply(dn), { warmup: 2, iters: 6 });
  const sample = await pool.sin(v);
  results.notes.push(
    `ComputePool.sin parallelized=${sample.parallelized} chunks=${sample.chunks} duration=${sample.duration}`
  );
}

console.log('=== WASM vs JS after loadWasm ===');
results.notes.push(`isWasmLoaded before loadWasm: ${isWasmLoaded()}`);
const wasmOk = await loadWasm();
results.notes.push(`loadWasm() => ${wasmOk} isWasmLoaded=${isWasmLoaded()}`);
{
  const a = Array.from(v1e5);
  await tryRecord('mathts.sin.1e5.afterLoadWasm', () => sin(v1e5), { warmup: 5, iters: 10 });
  await tryRecord('mathts.sort.1e6.afterLoadWasm', () => sort(Array.from(v1e6)), {
    warmup: 1,
    iters: 3,
  });
}

console.log('=== determinism ===');
{
  const expr = 'sin(0.3)+cos(0.4)^2';
  const r1 = evaluate(expr);
  const r2 = evaluate(expr);
  results.determinism.push({ name: 'evaluate.scalar', a: r1, b: r2, equal: Object.is(r1, r2) });
  const A = randNested(32);
  const s1 = svd(A);
  const s2 = svd(A);
  const dS = maxAbsDiff(s1.S, s2.S);
  results.determinism.push({ name: 'svd.32', maxAbsS: dS, equal: dS === 0 });
  const x = Array.from(randF64(256));
  const f1 = fft(x);
  const f2 = fft(x);
  let md = 0;
  for (let i = 0; i < f1.length; i++) {
    md = Math.max(md, Math.abs(f1[i].re - f2[i].re), Math.abs(f1[i].im - f2[i].im));
  }
  results.determinism.push({ name: 'fft.256', maxAbs: md, equal: md === 0 });
  const dm = new DenseMatrix(64, 64, randF64(64 * 64));
  const m1 = dm.multiply(dm).toFloat64Array();
  const m2 = dm.multiply(dm).toFloat64Array();
  const dd = maxAbsDiff(m1, m2);
  results.determinism.push({ name: 'matmul.64', maxAbs: dd, equal: dd === 0 });
  // DenseMatrix SVD silent empty
  const empty = svd(new DenseMatrix(8, 8, randF64(64)));
  results.determinism.push({
    name: 'svd.DenseMatrix.empty',
    S: empty.S,
    rank: empty.rank,
    silentEmpty: Array.isArray(empty.S) && empty.S.length === 0,
  });
}

const outJson = process.env.OUT_JSON || join(ROOT, 'results.json');
writeFileSync(outJson, JSON.stringify(results, null, 2));
console.log('wrote', outJson);
