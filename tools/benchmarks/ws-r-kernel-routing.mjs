#!/usr/bin/env node
/**
 * WS-R comparison record for the public `median`, `fft` and `lusolve` (#901, #933, #694).
 *
 * The base-against-head numbers come from `tools/benchmark/ab/cases/ws-r.mjs`. This script
 * records the other half: how far the head tree is from the libraries the issues name, on the
 * same machine, in one process, with the contenders interleaved in alternating order.
 *
 *   median   `median(Float64Array 1..n)` against NumPy `np.median` (a Python child)
 *   fft      `fft(number[])`, `fft(Float64Array)` and `parallelFFT` against `fft.js`
 *   lusolve  `lusolve(A, b)` on nested arrays against `ml-matrix` `solve`
 *
 * A contender that is not installed is recorded as "not measured". Nothing is guessed.
 * `svd` against `ml-matrix` (#699) is not measured here: the `svd` code is owned by another
 * workstream.
 *
 * Run from the repo root after `bun run build`:
 *   node tools/benchmarks/ws-r-kernel-routing.mjs --out record.json
 *
 * Options (every value has one default below; an environment variable WSR_<NAME> or a flag
 * overrides it):
 *   --rounds N        interleaved rounds per contender (default 9)
 *   --median-n N      length of the median input (default 1000000)
 *   --fft-sizes a,b   transform lengths, powers of two (default 65536,1048576)
 *   --lusolve a,b     system sizes (default 200,500,1000)
 *   --fftjs DIR       folder whose node_modules holds `fft.js` (default: not measured)
 *   --python CMD      Python command with NumPy (default python; "none" skips NumPy)
 *   --out FILE        write the JSON record
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const requireFromRepo = createRequire(join(repoRoot, 'package.json'));

const DEFAULTS = {
  rounds: 9,
  medianN: 1_000_000,
  fftSizes: [65_536, 1_048_576],
  lusolve: [200, 500, 1000],
  fftjs: null,
  python: 'python',
  out: null,
};

function parseArgs(argv) {
  const o = { ...DEFAULTS };
  const env = (k) => process.env[`WSR_${k}`];
  const nums = (s) => String(s).split(',').filter(Boolean).map(Number);
  if (env('ROUNDS')) o.rounds = Number(env('ROUNDS'));
  if (env('FFTJS')) o.fftjs = env('FFTJS');
  if (env('PYTHON')) o.python = env('PYTHON');
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--rounds') o.rounds = Number(next());
    else if (a === '--median-n') o.medianN = Number(next());
    else if (a === '--fft-sizes') o.fftSizes = nums(next());
    else if (a === '--lusolve') o.lusolve = nums(next());
    else if (a === '--fftjs') o.fftjs = next();
    else if (a === '--python') o.python = next();
    else if (a === '--out') o.out = next();
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Calls per timed batch for a contender that takes about `ms` per call. */
const innerFor = (ms) => (ms > 200 ? 1 : ms > 40 ? 2 : ms > 8 ? 4 : 8);

/** Time `fn` over `inner` calls; milliseconds per call. */
function batch(fn, inner) {
  const t0 = performance.now();
  for (let i = 0; i < inner; i++) fn();
  return (performance.now() - t0) / inner;
}

/**
 * Interleave the contenders in alternating order and return the median ms per call of each.
 * A contender is `{ name, run(inner) -> ms per call, inner }`.
 */
function interleave(contenders, rounds) {
  const samples = Object.fromEntries(contenders.map((c) => [c.name, []]));
  for (let r = 0; r < rounds; r++) {
    const order = r % 2 ? [...contenders].reverse() : contenders;
    for (const c of order) samples[c.name].push(c.run());
  }
  return Object.fromEntries(contenders.map((c) => [c.name, median(samples[c.name])]));
}

function jsContender(name, fn) {
  fn();
  fn();
  const probe = batch(fn, 1);
  const inner = innerFor(probe);
  for (let w = 0; w < 3; w++) batch(fn, inner);
  return { name, run: () => batch(fn, inner) };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function floats(n, seed) {
  const r = mulberry32(seed);
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = r() * 2 - 1;
  return a;
}

/** NumPy `np.median` on 1..n, timed inside a Python child; one batch per call. */
function numpyMedian(python, n) {
  const code = [
    'import sys, time, json',
    'import numpy as np',
    `x = np.arange(1, ${n} + 1, dtype=np.float64)`,
    'np.median(x)',
    'reps = int(sys.argv[1])',
    't0 = time.perf_counter()',
    'for _ in range(reps): np.median(x)',
    'print(json.dumps({"ms": (time.perf_counter() - t0) / reps * 1000, "numpy": np.__version__}))',
  ].join('\n');
  const probe = spawnSync(python, ['-c', code, '1'], { encoding: 'utf8' });
  if (probe.status !== 0)
    return { error: (probe.stderr || 'python failed').trim().split('\n').pop() };
  const info = JSON.parse(probe.stdout);
  const inner = innerFor(info.ms);
  return {
    version: info.numpy,
    contender: {
      name: 'numpy np.median',
      run: () => {
        const r = spawnSync(python, ['-c', code, String(inner)], { encoding: 'utf8' });
        return JSON.parse(r.stdout).ms;
      },
    },
  };
}

function spd(n, seed) {
  const r = mulberry32(seed);
  const a = Array.from({ length: n }, () => Array.from({ length: n }, () => r() * 2 - 1));
  // A + A^T + n I: symmetric and diagonally dominant.
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const v = a[i][j] + a[j][i];
      a[i][j] = v;
      a[j][i] = v;
    }
    a[i][i] += n;
  }
  return a;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const F = await import(
    pathToFileURL(join(repoRoot, 'node_modules/@danielsimonjr/mathts-functions/dist/index.js')).href
  );
  const record = {
    node: process.version,
    cpus: availableParallelism(),
    rounds: o.rounds,
    median: null,
    fft: [],
    lusolve: [],
    notMeasured: ['svd against ml-matrix (#699): the svd code is owned by another workstream'],
  };

  // median
  {
    const n = o.medianN;
    const x = Float64Array.from({ length: n }, (_, i) => i + 1);
    const contenders = [jsContender('median(Float64Array)', () => F.median(x))];
    let numpyVersion = null;
    if (o.python !== 'none') {
      const np = numpyMedian(o.python, n);
      if (np.error) record.notMeasured.push(`NumPy np.median: ${np.error}`);
      else {
        numpyVersion = np.version;
        contenders.push(np.contender);
      }
    } else record.notMeasured.push('NumPy np.median: --python none');
    const ms = interleave(contenders, o.rounds);
    record.median = { n, ms, numpyVersion };
    if (ms['numpy np.median'] !== undefined) {
      record.median.overNumpy = ms['median(Float64Array)'] / ms['numpy np.median'];
    }
  }

  // fft
  let FFT = null;
  if (o.fftjs) {
    try {
      FFT = createRequire(join(resolve(o.fftjs), 'package.json'))('fft.js');
    } catch (e) {
      record.notMeasured.push(`fft.js: ${String(e.message).split('\n')[0]}`);
    }
  } else record.notMeasured.push('fft.js: no --fftjs folder given');
  for (const n of o.fftSizes) {
    const real = floats(n, 0x933a00 + n);
    const plain = Array.from(real);
    const contenders = [
      jsContender('fft(number[])', () => F.fft(plain)),
      jsContender('fft(Float64Array)', () => F.fft(real)),
    ];
    if (typeof F.parallelFFT === 'function') {
      const sync = () => F.parallelFFT(real);
      const probe = sync();
      if (!(probe instanceof Promise))
        contenders.push(jsContender('parallelFFT(Float64Array)', sync));
      else await probe.catch(() => {});
    }
    if (typeof F.complex === 'function') {
      // The cost of the result type alone: `fft` returns one `Complex` object per bin, so no
      // call of `fft` can be faster than making `n` of them. `fft.js` returns a flat buffer.
      const zeros = new Float64Array(n);
      contenders.push(
        jsContender('complex() x n (boxing floor)', () => {
          const boxed = new Array(n);
          for (let i = 0; i < n; i++) boxed[i] = F.complex(real[i], zeros[i]);
          return boxed;
        })
      );
    }
    if (FFT) {
      // The complex transform of the same real signal, as `fft(number[])` computes it.
      // The plan (`new FFT(n)`: twiddle table, bit-reverse table) is built once, outside the
      // timed call, and `fft` builds its twiddles in every call.
      const f = new FFT(n);
      const out = f.createComplexArray();
      const input = f.toComplexArray(real);
      contenders.push(jsContender('fft.js transform', () => f.transform(out, input)));
    }
    const ms = interleave(contenders, o.rounds);
    const row = { n, ms };
    if (ms['fft.js transform'] !== undefined) {
      row.numberArrayOverFftjs = ms['fft(number[])'] / ms['fft.js transform'];
      row.float64ArrayOverFftjs = ms['fft(Float64Array)'] / ms['fft.js transform'];
    }
    record.fft.push(row);
  }

  // lusolve against ml-matrix
  let ml = null;
  try {
    ml = requireFromRepo('ml-matrix');
  } catch (e) {
    record.notMeasured.push(`ml-matrix: ${String(e.message).split('\n')[0]}`);
  }
  if (ml) {
    for (const n of o.lusolve) {
      const A = spd(n, 0x694000 + n);
      const b = Array.from({ length: n }, (_, i) => Math.sin(i + 1));
      const contenders = [
        jsContender('lusolve(A, b)', () => F.lusolve(A, b)),
        jsContender('ml-matrix solve', () => ml.solve(new ml.Matrix(A), ml.Matrix.columnVector(b))),
      ];
      const ms = interleave(contenders, Math.max(3, Math.min(o.rounds, n >= 1000 ? 5 : o.rounds)));
      record.lusolve.push({ n, ms, overMlMatrix: ms['lusolve(A, b)'] / ms['ml-matrix solve'] });
    }
  }

  const text = JSON.stringify(record, null, 2) + '\n';
  if (o.out) writeFileSync(o.out, text);
  const f = (x) => x.toFixed(3);
  const lines = [
    `node ${record.node}, ${record.cpus} cpus, ${record.rounds} interleaved rounds`,
    '',
  ];
  lines.push(`median 1..${record.median.n}, ms per call`);
  for (const [k, v] of Object.entries(record.median.ms)) lines.push(`  ${k.padEnd(24)} ${f(v)}`);
  if (record.median.overNumpy !== undefined) {
    lines.push(
      `  median / numpy ${f(record.median.overNumpy)} (numpy ${record.median.numpyVersion})`
    );
  }
  for (const r of record.fft) {
    lines.push('', `fft n = ${r.n}, ms per call`);
    for (const [k, v] of Object.entries(r.ms)) lines.push(`  ${k.padEnd(24)} ${f(v)}`);
    if (r.numberArrayOverFftjs !== undefined) {
      lines.push(
        `  fft(number[]) / fft.js ${f(r.numberArrayOverFftjs)}   fft(Float64Array) / fft.js ${f(r.float64ArrayOverFftjs)}`
      );
    }
  }
  for (const r of record.lusolve) {
    lines.push('', `lusolve n = ${r.n}, ms per call`);
    for (const [k, v] of Object.entries(r.ms)) lines.push(`  ${k.padEnd(24)} ${f(v)}`);
    lines.push(`  lusolve / ml-matrix ${f(r.overMlMatrix)}`);
  }
  lines.push('', 'not measured:', ...record.notMeasured.map((s) => `  ${s}`));
  console.log(lines.join('\n'));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
