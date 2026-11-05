/**
 * Scalar-search benchmark cases (plan SR-11).
 *
 * Times the public scalar-regression surface on the engine that launched it:
 *
 *   1. compile and score the pinned `x^2 + x` front population once,
 *   2. the seed-7 pinned search of 120 evaluations, whose losses are checked
 *      against PINNED_ROWS with `Object.is` before any timing — a mismatch
 *      fails the process,
 *   3. `evaluateScalarPopulation` serial vs `parallel` at 100, 1e3, 1e4 and
 *      1e5 rows on the mid-size M3 bench tree. A `null` result or a throw
 *      fails the case.
 *
 * Plus an A/A control: two serial scores of the same closure. Its ratio is
 * printed every run; over five runs it should stay inside ±2% (report the
 * wider band when it does not — never tighten it by deleting the control).
 *
 * One code tree per process: this bench times only the packages it was
 * launched against and is never run twice in one process for a comparison.
 * Warm-up is >= 5 reps everywhere; medians are printed; nothing here asserts
 * a speedup.
 *
 * `evaluateScalarPopulation` lives in `functions/src/scalar-batch-parallel.ts`
 * (the plan's parallel-scoring audit row) but the functions barrel does not
 * re-export it on `main`, and SR-11 is tools-and-docs only, so this bench
 * imports the module directly instead of changing the package's export
 * surface. Everything else comes from the packages' public entries.
 */
import { createSeededRng } from '@danielsimonjr/mathts-core';
import {
  createScalarBuilder,
  scalarCanonicalKey,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import {
  compileScalar,
  searchScalars,
  type ScalarSearchResult,
} from '@danielsimonjr/mathts-functions';
import { WorkerPool } from '@danielsimonjr/mathts-parallel';
import {
  evaluateScalarPopulation,
  type EvaluateScalarPopulationOptions,
  type ScalarPopulationEvalResult,
} from '../../../functions/src/scalar-batch-parallel.js';
import { median } from './lib.mjs';

const minReps = Number(process.env.SCALAR_BENCH_REPS ?? 5);
if (!Number.isInteger(minReps) || minReps < 2) {
  throw new Error(`scalar-search bench: reps must be an integer >= 2, got ${minReps}`);
}

// ---------------------------------------------------------------------------
// The pinned problem, byte-for-byte the fixture of functions/tests/scalar-search.test.ts
// ---------------------------------------------------------------------------

const b = createScalarBuilder();
const X = b.symbol('x');

function linspace(n: number, lo: number, hi: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = lo + ((hi - lo) * i) / (n - 1);
  }
  return out;
}

const xs = linspace(20, -1, 1);
const plantedQuad = b.op('+', [b.op('*', [X, X]), X]);
const observed = compileScalar(plantedQuad, { variables: ['x'] }).evaluate([xs]).values;
const quadProblem = { variables: ['x'], columns: [xs], observed };

const quadGrammar = {
  variables: ['x'],
  binary: ['+', '*', '^'],
  unary: [],
  literals: [1],
  maxSize: 7,
};

const pinnedOptions = {
  grammar: quadGrammar,
  tournamentP: 0.982,
  populationSize: 8,
  tournamentSize: 4,
  maxEvaluations: 120,
};

// Recorded by the seed-7 single-population run (M13a) — keep in step with
// functions/tests/scalar-search.test.ts. Losses compare with Object.is.
const PINNED_ROWS = [
  { complexity: 1, loss: 4.870097681877825, key: '{"k":"s","v":"x"}' },
  {
    complexity: 5,
    loss: 6.317050217590134e-32,
    key: '{"k":"*","a":[{"k":"+","a":[{"k":"n","v":"1"},{"k":"s","v":"x"}]},{"k":"s","v":"x"}]}',
  },
  {
    complexity: 7,
    loss: 0,
    key: '{"k":"+","a":[{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"2"}},{"k":"s","v":"x"}]}',
  },
] as const;

/** Drives the generator to its final result. */
async function runPinnedSearch(): Promise<ScalarSearchResult> {
  const gen = searchScalars(quadProblem, { ...pinnedOptions, rng: createSeededRng(7) });
  for (;;) {
    const step = await gen.next();
    if (step.done) return step.value;
  }
}

/**
 * Checks one run's front against PINNED_ROWS. Returns null when it matches,
 * otherwise a description of the first difference.
 */
function checkPinned(result: ScalarSearchResult): string | null {
  if (result.evaluations !== 120) return `evaluations ${result.evaluations}, expected 120`;
  if (result.seed !== 7) return `seed ${result.seed}, expected 7`;
  if (result.front.length !== PINNED_ROWS.length) {
    return `front has ${result.front.length} rows, expected ${PINNED_ROWS.length}`;
  }
  for (let i = 0; i < PINNED_ROWS.length; i++) {
    const row = result.front[i]!;
    const pin = PINNED_ROWS[i]!;
    if (row.complexity !== pin.complexity) {
      return `row ${i} complexity ${row.complexity}, expected ${pin.complexity}`;
    }
    const key = scalarCanonicalKey(row.item);
    if (key !== pin.key) return `row ${i} key ${key}, expected ${pin.key}`;
    if (!Object.is(row.loss, pin.loss)) return `row ${i} loss ${row.loss}, expected ${pin.loss}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Times `fn`; a null result or a throw fails the process. */
async function timed(fn: () => unknown): Promise<number> {
  const t0 = performance.now();
  const out = await fn();
  const ms = performance.now() - t0;
  if (out == null) throw new Error('scalar-search bench: timed call returned null');
  return ms;
}

/** Warmup then timed reps, both with the null/throw guard; returns the median. */
async function measure(fn: () => unknown, reps: number, warmup = 5): Promise<number> {
  for (let w = 0; w < warmup; w++) await timed(fn);
  const samples: number[] = [];
  for (let r = 0; r < reps; r++) samples.push(await timed(fn));
  return median(samples);
}

/** ABBA-interleaved medians of two thunks over `reps` rounds. */
async function measurePair(
  a: () => unknown,
  bThunk: () => unknown,
  reps: number,
  warmup = 5
): Promise<{ aMs: number; bMs: number }> {
  for (let w = 0; w < warmup; w++) {
    await timed(a);
    await timed(bThunk);
  }
  const aMs: number[] = [];
  const bMs: number[] = [];
  for (let r = 0; r < reps; r++) {
    const order = r % 2 === 0 ? [a, bThunk] : [bThunk, a];
    aMs.push(await timed(order[0]!));
    bMs.push(await timed(order[1]!));
  }
  return { aMs: median(aMs), bMs: median(bMs) };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function uniformColumn(n: number, lo: number, hi: number, seed = 1): Float64Array {
  const r = mulberry32(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = lo + (hi - lo) * r();
  return out;
}

// The mid-size tree of the M3 bench (docs/BENCHMARK_RESULTS.md, 2026-10-25):
// sin(x) * exp(x) + ln(x + 1) — 10 nodes; `ln` is natural log in the builder.
function buildMidTree(): ScalarNode {
  return b.op('+', [
    b.op('*', [b.call('sin', X), b.call('exp', X)]),
    b.call('ln', b.op('+', [X, b.number(1)])),
  ]);
}

function buildSmallTree(): ScalarNode {
  return b.op('+', [b.op('*', [X, X]), b.number(3)]);
}

const POPULATION_ITEMS = [
  { index: 0, node: buildMidTree() },
  { index: 1, node: buildSmallTree() },
  { index: 2, node: buildMidTree() },
  { index: 3, node: buildSmallTree() },
  { index: 4, node: buildMidTree() },
  { index: 5, node: buildSmallTree() },
  { index: 6, node: buildMidTree() },
  { index: 7, node: buildSmallTree() },
];

/** The default public parallel path: a pool per call, terminated after it. */
const scalarWorkerPath = process.env.SCALAR_BENCH_WORKER;
if (!scalarWorkerPath) {
  throw new Error(
    'scalar-search bench: SCALAR_BENCH_WORKER must point at the built scalar-batch.worker.js (run.mjs sets it)'
  );
}

function parallelCall(
  base: Omit<EvaluateScalarPopulationOptions, 'parallel'>
): Promise<ScalarPopulationEvalResult[]> {
  const pool = new WorkerPool(scalarWorkerPath);
  return evaluateScalarPopulation({ ...base, parallel: { pool } }).finally(() => pool.terminate());
}

/** Fails the process when a serial and a parallel population result differ. */
function assertPopulationsAgree(
  serialOut: ScalarPopulationEvalResult[],
  parallelOut: ScalarPopulationEvalResult[],
  rows: number
): void {
  if (serialOut.length !== parallelOut.length) {
    throw new Error(
      `scalar-search bench: serial returned ${serialOut.length} items, parallel ${parallelOut.length}`
    );
  }
  for (let i = 0; i < serialOut.length; i++) {
    const sb = serialOut[i]?.batch;
    const pb = parallelOut[i]?.batch;
    if (sb == null || pb == null) {
      throw new Error(`scalar-search bench: item ${i} returned a null batch`);
    }
    if (sb.values.length !== rows || pb.values.length !== rows) {
      throw new Error(
        `scalar-search bench: item ${i} returned ${sb.values.length} of ${rows} rows`
      );
    }
    if (!sb.allValid || !pb.allValid) {
      throw new Error(`scalar-search bench: item ${i} produced an invalid row`);
    }
    for (let j = 0; j < rows; j++) {
      if (!Object.is(sb.values[j], pb.values[j])) {
        throw new Error(
          `scalar-search bench: item ${i} row ${j} serial ${sb.values[j]} vs parallel ${pb.values[j]}`
        );
      }
    }
  }
}

async function main(): Promise<void> {
  const engine = process.versions.bun
    ? `Bun ${process.versions.bun}`
    : `Node ${process.versions.node}`;
  console.log(`scalar-search bench on ${engine}, ${process.platform} ${process.arch}`);

  // Correctness first: the seed-7 pinned search must reproduce PINNED_ROWS
  // before any timing happens.
  const pinned = await runPinnedSearch();
  const mismatch = checkPinned(pinned);
  if (mismatch !== null) {
    throw new Error(`scalar-search bench: seed-7 front mismatch: ${mismatch}`);
  }
  console.log('\npin: seed-7 front matches PINNED_ROWS (Object.is on losses)');

  // Case 1 — compile and score the pinned front population once.
  const frontTrees = pinned.front.map((row, i) => ({
    node: row.item,
    params: pinned.fittedParameters[i],
  }));
  const zeroLossRow = pinned.front.findIndex((row) => Object.is(row.loss, 0));
  if (zeroLossRow < 0) throw new Error('scalar-search bench: pinned front has no loss-0 row');
  const compiledZeroLoss = compileScalar(frontTrees[zeroLossRow]!.node, { variables: ['x'] });
  const zeroLossBatch = compiledZeroLoss.evaluate([xs], frontTrees[zeroLossRow]!.params);
  if (zeroLossBatch == null || zeroLossBatch.values == null) {
    throw new Error('scalar-search bench: compiled.evaluate returned null');
  }
  for (let i = 0; i < xs.length; i++) {
    if (!Object.is(zeroLossBatch.values[i], observed[i])) {
      throw new Error(
        `scalar-search bench: zero-loss tree row ${i} is ${zeroLossBatch.values[i]}, observed ${observed[i]}`
      );
    }
  }
  const compileAndScore = (): boolean | null => {
    for (const tree of frontTrees) {
      const compiled = compileScalar(tree.node, { variables: ['x'] });
      const batch = compiled.evaluate([xs], tree.params);
      if (batch == null || batch.values == null) return null;
    }
    return true;
  };
  const case1Ms = await measure(compileAndScore, Math.max(minReps, 50));
  console.log(`\ncase 1  compile + score the pinned front (${frontTrees.length} trees)`);
  console.log(`        median ${case1Ms.toFixed(4)} ms`);

  // Case 2 — the seed-7 pinned search of 120 evaluations.
  const case2Ms = await measure(() => runPinnedSearch(), Math.max(minReps, 5));
  console.log('\ncase 2  seed-7 pinned search, 120 evaluations');
  console.log(`        median ${case2Ms.toFixed(4)} ms per run`);

  // Case 3 — evaluateScalarPopulation serial vs parallel on the M3 mid tree.
  console.log('\ncase 3  evaluateScalarPopulation, serial vs parallel (8 items, mid tree)');
  console.log('        rows     serial (ms)   parallel (ms)   ratio');
  const case3: Array<{ rows: number; serialMs: number; parallelMs: number; ratio: number }> = [];
  for (const rows of [100, 1_000, 10_000, 100_000]) {
    const column = uniformColumn(rows, 0.15, 0.85, 1);
    const base: Omit<EvaluateScalarPopulationOptions, 'parallel'> = {
      variables: ['x'],
      columns: [column],
      items: POPULATION_ITEMS,
    };
    const serial = () => evaluateScalarPopulation(base);
    assertPopulationsAgree(await serial(), await parallelCall(base), rows);
    const reps = Math.max(minReps, rows <= 1_000 ? 15 : rows <= 10_000 ? 10 : 6);
    const t = await measurePair(serial, () => parallelCall(base), reps);
    case3.push({ rows, serialMs: t.aMs, parallelMs: t.bMs, ratio: t.bMs / t.aMs });
    console.log(
      `        ${String(rows).padStart(7)}   ${t.aMs.toFixed(4).padStart(11)}   ${t.bMs
        .toFixed(4)
        .padStart(13)}   ${(t.bMs / t.aMs).toFixed(2)}`
    );
  }

  // A/A control: two serial scores of the same closure. Printed every run;
  // the five-run band is reported in docs/BENCHMARK_RESULTS.md.
  const controlColumn = uniformColumn(10_000, 0.15, 0.85, 1);
  const controlCall = () =>
    evaluateScalarPopulation({
      variables: ['x'],
      columns: [controlColumn],
      items: POPULATION_ITEMS,
    });
  const control = await measurePair(controlCall, controlCall, Math.max(minReps, 10));
  const controlRatio = control.bMs / control.aMs;
  console.log(
    `\ncontrol (A/A, serial evaluateScalarPopulation twice, n = 1e4): ratio ${controlRatio.toFixed(4)}`
  );

  console.log(
    `\nSCALAR_SEARCH_BENCH_JSON ${JSON.stringify({
      engine: process.versions.bun ? 'bun' : 'node',
      case1Ms,
      case2Ms,
      case3,
      controlRatio,
    })}`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
