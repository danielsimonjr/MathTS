#!/usr/bin/env node
/**
 * WS-R cost-model measurement for `ComputePool` (#931, #903, #935).
 *
 * Question: at which sizes do workers beat the in-process path for the element-wise
 * transcendentals and for `matmul`, and how far is the in-process `pool.sin` path from a
 * plain `Float64Array` loop (what `functions.sin` runs)?
 *
 * One tree per process (`--tree head` or `--tree base`). Inside the process every
 * comparison is interleaved A B B A after warm-up, with the workers already spawned, so
 * the lazy worker start-up (a 100 ms first call) is not in any timed sample. `--ab` spawns
 * child processes in the order base, head, head, base and prints head/base per row.
 *
 * The `cold` section is the other half: it times the first calls of a fresh pool, which
 * pay for the worker start-up and for kernels that no worker has run yet. `--decide FILES`
 * turns head-tree records of one section (`matmul` or `elementwise`) into the threshold
 * rule: a size is won when every process has parallel / sequential at or below
 * `--max-ratio` (default 0.90), and the crossover is the smallest won size with every larger
 * size won too. The rule reads warm pools only.
 *
 * Run from the repo root after `bun run build`. The base tree comes from
 * `node tools/benchmark/ab/make-base.mjs --workspace` (a snapshot of a built ref).
 *
 *   node tools/benchmarks/ws-r-compute-pool.mjs --tree head --out head.json
 *   node tools/benchmarks/ws-r-compute-pool.mjs --ab --out ab.json
 *
 * Options (every value has one default below; an environment variable WSR_<NAME> or a
 * flag overrides it):
 *   --tree head|base   which dist tree to load (default head)
 *   --workers N        `maxWorkers` of the pool (default: os.availableParallelism())
 *   --reps N           interleaved rounds per size (default 9)
 *   --elementwise a,b  ops to time (default sin,cos,exp,log; tan is also accepted)
 *   --sizes a,b        element counts for the element-wise ops
 *   --matmul a,b       square matrix sizes for matmul
 *   --only elementwise|matmul|path|cold   run one section
 *   --trials N         fresh pools for the `cold` section (default 3)
 *   --calls N          calls per fresh pool in the `cold` section (default 10)
 *   --decide a,b       head-tree record files to combine into one decision
 *   --max-ratio R      a size is won at parallel / sequential <= R (default 0.90)
 *   --out FILE         write the JSON record
 */
import { spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const DEFAULTS = {
  tree: 'head',
  workers: availableParallelism(),
  reps: 9,
  elementwise: ['sin', 'cos', 'exp', 'log'],
  sizes: [100_000, 250_000, 1_000_000, 4_000_000, 16_000_000],
  matmul: [64, 96, 128, 160, 192, 224, 256, 320, 384],
  only: null,
  out: null,
  trials: 3,
  calls: 10,
  decide: null,
  // A size is "won" by the workers when forceParallel / forceSequential is at or below this
  // ratio in EVERY recorded process. 0.90 keeps the decision outside the +-5% band that two
  // identical closures show on this machine.
  maxRatio: 0.9,
};

/**
 * The matmul threshold rule. `records` are head-tree records, one per process, and may mix
 * worker counts. A grid size is won when every record has par/seq <= maxRatio at it. The
 * crossover is the smallest size that is won, with every larger grid size won too.
 * The grid is square (n x n times n x n), so the threshold is its multiply-add count
 * (`aRows * aCols * bCols = n^3`, the unit of `DEFAULT_THRESHOLD_BY_OP.matmul`), or null when
 * no size is won. The grid does not vary the inner dimension: the cost of a product is the
 * multiply-add count, so the square cut is the cut for any shape of the same count.
 */
function decideMatmul(records, maxRatio) {
  const sizes = [...new Set(records.flatMap((r) => r.matmul.map((m) => m.n)))].sort(
    (a, b) => a - b
  );
  const perSize = sizes.map((n) => {
    const ratios = records
      .map((r) => r.matmul.find((m) => m.n === n)?.parOverSeq)
      .filter((x) => x !== undefined);
    return {
      n,
      worst: Math.max(...ratios),
      best: Math.min(...ratios),
      won: ratios.every((x) => x <= maxRatio),
    };
  });
  let crossover = null;
  for (let i = perSize.length - 1; i >= 0 && perSize[i].won; i--) crossover = perSize[i].n;
  return {
    rule: `smallest grid n whose par/seq is <= ${maxRatio} in every process, with every larger n also won; threshold = n * n * n multiply-adds`,
    maxRatio,
    processes: records.map((r) => ({ workers: r.workers, node: r.node })),
    perSize,
    crossoverN: crossover,
    thresholdMultiplyAdds: crossover === null ? null : crossover ** 3,
  };
}

/**
 * The element-wise rule, per op: the same rule as `decideMatmul`, on the size of the input.
 * `records` are head-tree records. A size is won for an op when every record that has the
 * row has par/seq <= maxRatio. The warm crossover is the smallest won size with every larger
 * size won too, or null when the largest size is not won. It is a warm-pool figure: the
 * records time pools whose workers are all running and have run the kernel before.
 */
function decideElementwise(records, maxRatio) {
  const rows = records.flatMap((r) => r.elementwise);
  const ops = [...new Set(rows.map((e) => e.op))];
  return {
    rule: `per op: smallest input size whose par/seq is <= ${maxRatio} in every process, with every larger size also won; warm pools only`,
    maxRatio,
    processes: records.map((r) => ({ workers: r.workers, node: r.node })),
    ops: ops.map((op) => {
      const sizes = [...new Set(rows.filter((e) => e.op === op).map((e) => e.n))].sort(
        (a, b) => a - b
      );
      const perSize = sizes.map((n) => {
        const ratios = rows.filter((e) => e.op === op && e.n === n).map((e) => e.parOverSeq);
        return {
          n,
          processes: ratios.length,
          worst: Math.max(...ratios),
          best: Math.min(...ratios),
          won: ratios.every((x) => x <= maxRatio),
        };
      });
      let crossover = null;
      for (let i = perSize.length - 1; i >= 0 && perSize[i].won; i--) crossover = perSize[i].n;
      return { op, perSize, warmCrossoverElements: crossover };
    }),
  };
}

function parseArgs(argv) {
  const o = { ...DEFAULTS };
  const env = (k) => process.env[`WSR_${k.toUpperCase()}`];
  const list = (s) => String(s).split(',').filter(Boolean);
  const nums = (s) => list(s).map(Number);
  if (env('tree')) o.tree = env('tree');
  if (env('workers')) o.workers = Number(env('workers'));
  if (env('reps')) o.reps = Number(env('reps'));
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--ab') o.ab = true;
    else if (a === '--tree') o.tree = next();
    else if (a === '--workers') o.workers = Number(next());
    else if (a === '--reps') o.reps = Number(next());
    else if (a === '--elementwise') o.elementwise = list(next());
    else if (a === '--sizes') o.sizes = nums(next());
    else if (a === '--matmul') o.matmul = nums(next());
    else if (a === '--only') o.only = next();
    else if (a === '--trials') o.trials = Number(next());
    else if (a === '--calls') o.calls = Number(next());
    else if (a === '--out') o.out = next();
    else if (a === '--decide') o.decide = list(next());
    else if (a === '--max-ratio') o.maxRatio = Number(next());
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function timeCall(fn, reps) {
  const t0 = performance.now();
  for (let i = 0; i < reps; i++) await fn();
  return (performance.now() - t0) / reps;
}

/** Interleaved A B B A rounds. Returns the median per call of each side, in ms. */
async function abba(a, b, rounds, inner) {
  const as = [];
  const bs = [];
  for (let r = 0; r < rounds; r++) {
    as.push(await timeCall(a, inner));
    bs.push(await timeCall(b, inner));
    bs.push(await timeCall(b, inner));
    as.push(await timeCall(a, inner));
  }
  return { a: median(as), b: median(bs) };
}

function innerFor(elements) {
  return elements >= 4_000_000 ? 1 : elements >= 1_000_000 ? 2 : 4;
}

async function loadTree(tree) {
  const root =
    tree === 'base'
      ? join(repoRoot, 'node_modules', '.perf-base', 'node_modules')
      : join(repoRoot, 'node_modules');
  const entry = (pkg) => pathToFileURL(join(root, '@danielsimonjr', pkg, 'dist', 'index.js')).href;
  const parallel = await import(entry('mathts-parallel'));
  const functions = await import(entry('mathts-functions'));
  const matrix = await import(entry('mathts-matrix'));
  return { parallel, functions, matrix };
}

async function warmWorkers(pool, want) {
  // The pool starts `minWorkers` threads and adds the rest on demand. Run forced calls on
  // data large enough to need every worker until the pool has them all.
  const x = new Float64Array(want * 70_000).fill(0.5);
  for (let i = 0; i < 12 && pool.stats().totalWorkers < want; i++) {
    await pool.sin(x, { forceParallel: true });
  }
  for (let i = 0; i < 3; i++) await pool.sin(x, { forceParallel: true });
}

/**
 * Cold pools. A pool starts `minWorkers` threads and adds the rest on the first parallel
 * dispatch, and a worker runs a new kernel in the interpreter for its first calls. The
 * warm sections above hide both costs. This section times the first `calls` calls of a fresh
 * pool, for a forced-parallel `sin` and for the default `matmul`, with the in-process time
 * of the same work (`sin`) and `DenseMatrix.multiply` (`matmul`) next to them.
 */
async function measureCold(o) {
  const { parallel, functions, matrix } = await loadTree(o.tree);
  const { ComputePool } = parallel;
  const n = 1_000_000;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = i * 1e-6;
  const m = 256;
  const a = new Float64Array(m * m);
  const b = new Float64Array(m * m);
  for (let i = 0; i < m * m; i++) {
    a[i] = ((i * 7) % 13) / 13;
    b[i] = ((i * 5) % 11) / 11;
  }
  const dm = matrix.DenseMatrix.fromFlat(m, m, Array.from(a));
  const dm2 = matrix.DenseMatrix.fromFlat(m, m, Array.from(b));
  const timed = async (fn) => {
    const t0 = performance.now();
    await fn();
    return performance.now() - t0;
  };
  const record = {
    tree: o.tree,
    node: process.version,
    cpus: availableParallelism(),
    maxWorkers: o.workers,
    calls: o.calls,
    sinElements: n,
    matmulSize: m,
    trials: [],
  };
  for (let t = 0; t < o.trials; t++) {
    const sinPool = new ComputePool({ maxWorkers: o.workers });
    await sinPool.initialize();
    const workersAtStart = sinPool.stats().totalWorkers;
    const sinParallelMs = [];
    for (let i = 0; i < o.calls; i++) {
      sinParallelMs.push(await timed(() => sinPool.sin(x, { forceParallel: true })));
    }
    const workersAfter = sinPool.stats().totalWorkers;
    const sinSequentialMs = [];
    for (let i = 0; i < 5; i++) sinSequentialMs.push(await timed(() => functions.sin(x)));
    await sinPool.terminate(true);

    const mmPool = new ComputePool({ maxWorkers: o.workers });
    await mmPool.initialize();
    const matmulMs = [];
    let parallelized = null;
    for (let i = 0; i < o.calls; i++) {
      matmulMs.push(
        await timed(async () => {
          parallelized = (await mmPool.matmul(a, m, m, b, m)).parallelized;
        })
      );
    }
    const denseMs = [];
    for (let i = 0; i < 5; i++) denseMs.push(await timed(() => dm.multiply(dm2)));
    await mmPool.terminate(true);

    record.trials.push({
      workersAtStart,
      workersAfter,
      sinParallelMs,
      sinSequentialMedianMs: median(sinSequentialMs),
      matmulMs,
      matmulParallelized: parallelized,
      denseMedianMs: median(denseMs),
    });
  }
  return record;
}

function coldTable(record) {
  const f = (xs) => xs.map((v) => v.toFixed(1)).join(' ');
  const out = [
    `tree=${record.tree} node=${record.node} cpus=${record.cpus} maxWorkers=${record.maxWorkers}`,
    `first ${record.calls} calls of a fresh pool, ms per call`,
  ];
  record.trials.forEach((t, i) => {
    out.push(
      '',
      `trial ${i + 1}: workers ${t.workersAtStart} -> ${t.workersAfter}`,
      `  sin ${record.sinElements} forceParallel: ${f(t.sinParallelMs)}   | in-process median ${t.sinSequentialMedianMs.toFixed(1)}`,
      `  matmul ${record.matmulSize} default (parallelized=${t.matmulParallelized}): ${f(t.matmulMs)}   | DenseMatrix.multiply median ${t.denseMedianMs.toFixed(1)}`
    );
  });
  return out.join('\n');
}

async function measure(o) {
  const { parallel, functions, matrix } = await loadTree(o.tree);
  const { ComputePool } = parallel;
  const pool = new ComputePool({ maxWorkers: o.workers });
  await pool.initialize();
  await warmWorkers(pool, o.workers);
  const record = {
    tree: o.tree,
    node: process.version,
    cpus: availableParallelism(),
    workers: pool.stats().totalWorkers,
    reps: o.reps,
    elementwise: [],
    matmul: [],
    path: [],
  };

  if (o.only === null || o.only === 'path') {
    // The in-process `pool.sin` against the loop `functions.sin` runs, same input.
    for (const n of [100_000, 1_000_000]) {
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = i * 1e-6;
      const poolSeq = () => pool.sin(x);
      const typed = () => functions.sin(x);
      for (let w = 0; w < 6; w++) {
        await poolSeq();
        await typed();
      }
      const t = await abba(poolSeq, typed, o.reps, innerFor(n));
      record.path.push({ n, poolSinMs: t.a, functionsSinMs: t.b, ratio: t.a / t.b });
    }
  }

  if (o.only === null || o.only === 'elementwise') {
    for (const op of o.elementwise) {
      for (const n of o.sizes) {
        const x = new Float64Array(n);
        for (let i = 0; i < n; i++) x[i] = 0.1 + (i % 1000) * 1e-3;
        const seq = () => pool[op](x, { forceSequential: true });
        const par = () => pool[op](x, { forceParallel: true });
        for (let w = 0; w < 3; w++) {
          await seq();
          await par();
        }
        const t = await abba(seq, par, o.reps, innerFor(n));
        record.elementwise.push({ op, n, seqMs: t.a, parMs: t.b, parOverSeq: t.b / t.a });
      }
    }
  }

  if (o.only === null || o.only === 'matmul') {
    for (const n of o.matmul) {
      const a = new Float64Array(n * n);
      const b = new Float64Array(n * n);
      for (let i = 0; i < n * n; i++) {
        a[i] = ((i * 7) % 13) / 13;
        b[i] = ((i * 5) % 11) / 11;
      }
      const seq = () => pool.matmul(a, n, n, b, n, { forceSequential: true });
      const par = () => pool.matmul(a, n, n, b, n, { forceParallel: true });
      const auto = () => pool.matmul(a, n, n, b, n);
      const dm = matrix.DenseMatrix.fromFlat(n, n, Array.from(a));
      const dm2 = matrix.DenseMatrix.fromFlat(n, n, Array.from(b));
      const dense = () => dm.multiply(dm2);
      for (let w = 0; w < 2; w++) {
        await seq();
        await par();
        await dense();
      }
      const inner = n >= 768 ? 1 : n >= 384 ? 2 : 4;
      const t = await abba(seq, par, o.reps, inner);
      const d = await abba(auto, dense, o.reps, inner);
      const reported = await auto();
      record.matmul.push({
        n,
        seqMs: t.a,
        parMs: t.b,
        parOverSeq: t.b / t.a,
        poolDefaultMs: d.a,
        denseMultiplyMs: d.b,
        poolDefaultOverDense: d.a / d.b,
        poolDefaultParallelized: reported.parallelized,
      });
    }
  }

  await pool.terminate(true);
  return record;
}

function table(record) {
  const out = [];
  out.push(
    `tree=${record.tree} node=${record.node} cpus=${record.cpus} workers=${record.workers} reps=${record.reps}`
  );
  if (record.path.length) {
    out.push('', 'in-process pool.sin vs functions.sin (ratio > 1: the pool path is slower)');
    for (const r of record.path) {
      out.push(
        `  n=${r.n}  pool.sin ${r.poolSinMs.toFixed(3)} ms  functions.sin ${r.functionsSinMs.toFixed(3)} ms  ratio ${r.ratio.toFixed(3)}`
      );
    }
  }
  if (record.elementwise.length) {
    out.push('', 'element-wise, forceParallel / forceSequential (ratio < 1: workers win)');
    for (const r of record.elementwise) {
      out.push(
        `  ${r.op.padEnd(4)} n=${String(r.n).padEnd(9)} seq ${r.seqMs.toFixed(3).padStart(9)} ms  par ${r.parMs.toFixed(3).padStart(9)} ms  par/seq ${r.parOverSeq.toFixed(3)}`
      );
    }
  }
  if (record.matmul.length) {
    out.push(
      '',
      'matmul n x n: forceParallel / forceSequential, and pool default / DenseMatrix.multiply'
    );
    for (const r of record.matmul) {
      out.push(
        `  n=${String(r.n).padEnd(5)} seq ${r.seqMs.toFixed(3).padStart(9)} ms  par ${r.parMs.toFixed(3).padStart(9)} ms  par/seq ${r.parOverSeq.toFixed(3)}  | pool default ${r.poolDefaultMs.toFixed(3)} ms (parallelized=${r.poolDefaultParallelized}) dense ${r.denseMultiplyMs.toFixed(3)} ms  default/dense ${r.poolDefaultOverDense.toFixed(3)}`
      );
    }
  }
  return out.join('\n');
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.ab) {
    // base, head, head, base: a drift in machine speed falls on both sides.
    const order = ['base', 'head', 'head', 'base'];
    const runs = { base: [], head: [] };
    for (const tree of order) {
      const args = [
        fileURLToPath(import.meta.url),
        '--tree',
        tree,
        '--workers',
        String(o.workers),
        '--reps',
        String(o.reps),
      ];
      for (const k of ['elementwise', 'sizes', 'matmul'])
        args.push(`--${k}`, [].concat(o[k]).join(','));
      if (o.only) args.push('--only', o.only);
      const r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
      if (r.status !== 0) throw new Error(`child ${tree} failed: ${r.stderr}`);
      runs[tree].push(JSON.parse(r.stdout.trim().split('\n').pop()));
    }
    const pick = (tree, key, i, field) => median(runs[tree].map((rec) => rec[key][i][field]));
    const rows = { path: [], elementwise: [], matmul: [] };
    const first = runs.head[0];
    first.path.forEach((p, i) =>
      rows.path.push({
        n: p.n,
        base: pick('base', 'path', i, 'ratio'),
        head: pick('head', 'path', i, 'ratio'),
      })
    );
    first.elementwise.forEach((p, i) =>
      rows.elementwise.push({
        op: p.op,
        n: p.n,
        base: pick('base', 'elementwise', i, 'parOverSeq'),
        head: pick('head', 'elementwise', i, 'parOverSeq'),
      })
    );
    first.matmul.forEach((p, i) =>
      rows.matmul.push({
        n: p.n,
        baseParOverSeq: pick('base', 'matmul', i, 'parOverSeq'),
        headParOverSeq: pick('head', 'matmul', i, 'parOverSeq'),
        baseDefaultOverDense: pick('base', 'matmul', i, 'poolDefaultOverDense'),
        headDefaultOverDense: pick('head', 'matmul', i, 'poolDefaultOverDense'),
        baseParallelized: runs.base[0].matmul[i].poolDefaultParallelized,
        headParallelized: runs.head[0].matmul[i].poolDefaultParallelized,
      })
    );
    const f = (x) => x.toFixed(3);
    const per = (tree, key, i, field) => runs[tree].map((rec) => f(rec[key][i][field])).join(' ');
    const text = [
      `A/B base vs head, order ${order.join(' ')}, medians of ${order.length} processes`,
      `node ${first.node}, ${first.cpus} cpus, ${first.workers} workers, ${first.reps} rounds`,
      '',
      ...(rows.path.length
        ? [
            'pool.sin (default path) / functions.sin, in-process; lower is better, per process in brackets',
            ...first.path.map(
              (p, i) =>
                `  n=${p.n}  base ${f(rows.path[i].base)} [${per('base', 'path', i, 'ratio')}]  head ${f(rows.path[i].head)} [${per('head', 'path', i, 'ratio')}]`
            ),
            '',
          ]
        : []),
      ...(rows.elementwise.length
        ? [
            'forceParallel / forceSequential (lower: workers win), per process in brackets',
            ...first.elementwise.map(
              (p, i) =>
                `  ${p.op.padEnd(4)} n=${String(p.n).padEnd(9)} base ${f(rows.elementwise[i].base)} [${per('base', 'elementwise', i, 'parOverSeq')}]  head ${f(rows.elementwise[i].head)} [${per('head', 'elementwise', i, 'parOverSeq')}]`
            ),
            '',
          ]
        : []),
      ...(rows.matmul.length
        ? [
            'matmul n x n, ms per call (median of processes) and ratios, per process in brackets',
            '  seq = forceSequential, par = forceParallel, dense = DenseMatrix.multiply',
            ...first.matmul.flatMap((p, i) => {
              const m = (tree, field) => median(runs[tree].map((rec) => rec.matmul[i][field]));
              return [
                `  n=${p.n}`,
                `    base  seq ${f(m('base', 'seqMs'))}  par ${f(m('base', 'parMs'))}  dense ${f(m('base', 'denseMultiplyMs'))}  par/seq ${f(rows.matmul[i].baseParOverSeq)} [${per('base', 'matmul', i, 'parOverSeq')}]  default/dense ${f(rows.matmul[i].baseDefaultOverDense)} [${per('base', 'matmul', i, 'poolDefaultOverDense')}] parallelized=${rows.matmul[i].baseParallelized}`,
                `    head  seq ${f(m('head', 'seqMs'))}  par ${f(m('head', 'parMs'))}  dense ${f(m('head', 'denseMultiplyMs'))}  par/seq ${f(rows.matmul[i].headParOverSeq)} [${per('head', 'matmul', i, 'parOverSeq')}]  default/dense ${f(rows.matmul[i].headDefaultOverDense)} [${per('head', 'matmul', i, 'poolDefaultOverDense')}] parallelized=${rows.matmul[i].headParallelized}`,
              ];
            }),
          ]
        : []),
    ].join('\n');
    console.log(text);
    if (o.out) writeFileSync(o.out, JSON.stringify({ runs, rows }, null, 2) + '\n');
    return;
  }
  if (o.decide) {
    // Combine head-tree records (each file is a record, or an --ab output) into one decision.
    const records = [];
    for (const file of o.decide) {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      if (data.runs) records.push(...data.runs.head);
      else records.push(data);
    }
    const withMatmul = records.filter((r) => r.matmul.length > 0);
    const withElementwise = records.filter((r) => r.elementwise.length > 0);
    if (withMatmul.length > 0 && withElementwise.length > 0) {
      throw new Error('--decide takes records of one section: matmul or elementwise');
    }
    let decision;
    let lines;
    if (withElementwise.length > 0) {
      decision = decideElementwise(withElementwise, o.maxRatio);
      lines = [
        `element-wise warm-pool decision from ${withElementwise.length} head-tree processes (workers ${withElementwise.map((r) => r.workers).join(', ')})`,
        `  rule: ${decision.rule}`,
        ...decision.ops.flatMap((d) => [
          `  ${d.op}`,
          ...d.perSize.map(
            (x) =>
              `    n=${String(x.n).padEnd(9)} par/seq worst ${x.worst.toFixed(3)} best ${x.best.toFixed(3)} (${x.processes} processes)  ${x.won ? 'won' : 'not won'}`
          ),
          `    warm crossover = ${d.warmCrossoverElements === null ? 'none' : `${d.warmCrossoverElements} elements`}`,
        ]),
      ];
    } else {
      decision = decideMatmul(records, o.maxRatio);
      lines = [
        `matmul threshold decision from ${records.length} head-tree processes`,
        `  rule: ${decision.rule}`,
        ...decision.perSize.map(
          (s) =>
            `  n=${String(s.n).padEnd(4)} par/seq worst ${s.worst.toFixed(3)} best ${s.best.toFixed(3)}  ${s.won ? 'won' : 'not won'}`
        ),
        `  crossover n = ${decision.crossoverN}, threshold = ${decision.thresholdMultiplyAdds} multiply-adds`,
      ];
    }
    console.log(lines.join('\n'));
    if (o.out) writeFileSync(o.out, JSON.stringify({ decision, records }, null, 2) + '\n');
    return;
  }
  if (o.only === 'cold') {
    const cold = await measureCold(o);
    console.log(coldTable(cold));
    if (o.out) writeFileSync(o.out, JSON.stringify(cold, null, 2) + '\n');
    return;
  }
  const record = await measure(o);
  if (process.stdout.isTTY || process.env.WSR_TABLE === '1') console.log(table(record));
  else console.log(JSON.stringify(record));
  if (o.out) writeFileSync(o.out, JSON.stringify(record, null, 2) + '\n');
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
