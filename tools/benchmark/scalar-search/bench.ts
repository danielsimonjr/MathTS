/**
 * Scalar-search benchmark cases (plan SR-11).
 *
 * Times the public scalar-regression surface on the engine that launched it:
 *
 *   1. compile and score the pinned `x^2 + x` front population once,
 *   2. the seed-7 pinned search of 120 evaluations, whose losses are checked
 *      against `pinned-rows.json` with `Object.is` before any timing — a mismatch
 *      fails the process,
 *   3. internal `evaluateScalarPopulation` (from `functions/dist/scalar-batch-parallel.js`)
 *      serial vs an explicit injected `WorkerPool` at 100, 1e3, 1e4 and 1e5 rows on
 *      the mid-size M3 bench tree. Case (3) reports **cold** pool (create+terminate
 *      per sample) and **reused** pool (one pool for warmup+samples, like
 *      `searchScalars`). SR-14 uses the reused-pool ratios. This does not measure the
 *      default `parallel: {}` path inside `searchScalars`. A `null` result or a throw
 *      fails the case.
 *
 * Plus an A/A control: two distinct but identical serial closures (same as the A/B
 * harness). Its ratio is printed every run; over five runs report the band you
 * observe — do not tighten it by deleting the control.
 *
 * One code tree per process: warm-up is >= 5 reps everywhere; medians are printed;
 * nothing here asserts a speedup.
 *
 * Public symbols timed here: `searchScalars`, `compileScalar`. Population scoring
 * uses the internal batch module the plan names; the functions barrel does not
 * export it.
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
} from '../../../functions/dist/scalar-batch-parallel.js';
import pinnedFixture from './pinned-rows.json' with { type: 'json' };
import { measurePair } from './lib.mjs';

const minReps = Number(process.env.SCALAR_BENCH_REPS ?? 5);
if (!Number.isInteger(minReps) || minReps < 2) {
  throw new Error(`scalar-search bench: reps must be an integer >= 2, got ${minReps}`);
}

const PINNED_ROWS = pinnedFixture.rows;

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

/** Drives the generator to its final result and records progress evaluations. */
async function runPinnedSearch(): Promise<{
  result: ScalarSearchResult;
  progressEvaluations: number[];
}> {
  const progressEvaluations: number[] = [];
  const gen = searchScalars(quadProblem, { ...pinnedOptions, rng: createSeededRng(7) });
  for (;;) {
    const step = await gen.next();
    if (step.done) return { result: step.value, progressEvaluations };
    progressEvaluations.push(step.value.evaluations);
  }
}

/**
 * Checks one run's front against PINNED_ROWS. Returns null when it matches,
 * otherwise a description of the first difference.
 */
function checkPinned(result: ScalarSearchResult): string | null {
  if (result.evaluations !== pinnedFixture.expectedEvaluations) {
    return `evaluations ${result.evaluations}, expected ${pinnedFixture.expectedEvaluations}`;
  }
  if (result.seed !== pinnedFixture.expectedSeed) {
    return `seed ${result.seed}, expected ${pinnedFixture.expectedSeed}`;
  }
  if (result.stopReason !== pinnedFixture.expectedStopReason) {
    return `stopReason ${result.stopReason}, expected ${pinnedFixture.expectedStopReason}`;
  }
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

function checkProgress(progressEvaluations: number[]): string | null {
  const expected = pinnedFixture.progressEvaluations;
  if (progressEvaluations.length !== expected.length) {
    return `progress length ${progressEvaluations.length}, expected ${expected.length}`;
  }
  for (let i = 0; i < expected.length; i++) {
    if (progressEvaluations[i] !== expected[i]) {
      return `progress[${i}] ${progressEvaluations[i]}, expected ${expected[i]}`;
    }
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
  const sorted = [...samples].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
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

const scalarWorkerPath = process.env.SCALAR_BENCH_WORKER;
if (!scalarWorkerPath) {
  throw new Error(
    'scalar-search bench: SCALAR_BENCH_WORKER must point at the built scalar-batch.worker.js (run.mjs sets it)'
  );
}

/** Cold pool: create and terminate on every call (mis-matches `searchScalars`). */
async function parallelCallCold(
  base: Omit<EvaluateScalarPopulationOptions, 'parallel'>
): Promise<ScalarPopulationEvalResult[]> {
  const pool = new WorkerPool(scalarWorkerPath);
  try {
    return await evaluateScalarPopulation({ ...base, parallel: { pool } });
  } finally {
    await pool.terminate();
  }
}

async function parallelCallReused(
  pool: WorkerPool,
  base: Omit<EvaluateScalarPopulationOptions, 'parallel'>
): Promise<ScalarPopulationEvalResult[]> {
  return evaluateScalarPopulation({ ...base, parallel: { pool } });
}

/**
 * Serial vs parallel with one `WorkerPool` for warmup and all timed samples, like
 * `searchScalars` (create once, terminate when the search ends).
 */
async function measureReusedPoolPair(
  serial: () => Promise<ScalarPopulationEvalResult[]>,
  base: Omit<EvaluateScalarPopulationOptions, 'parallel'>,
  reps: number
): Promise<{ aMs: number; bMs: number }> {
  const pool = new WorkerPool(scalarWorkerPath);
  try {
    const parallel = () => parallelCallReused(pool, base);
    return await measurePair(serial, parallel, reps, timed);
  } finally {
    await pool.terminate();
  }
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

  const { result: pinned, progressEvaluations } = await runPinnedSearch();
  const mismatch = checkPinned(pinned);
  if (mismatch !== null) {
    throw new Error(`scalar-search bench: seed-7 front mismatch: ${mismatch}`);
  }
  const progressMismatch = checkProgress(progressEvaluations);
  if (progressMismatch !== null) {
    throw new Error(`scalar-search bench: seed-7 progress mismatch: ${progressMismatch}`);
  }
  console.log('\npin: seed-7 front matches pinned-rows.json (Object.is on losses)');

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

  const case2Ms = await measure(async () => (await runPinnedSearch()).result, Math.max(minReps, 5));
  console.log('\ncase 2  seed-7 pinned search, 120 evaluations');
  console.log(`        median ${case2Ms.toFixed(4)} ms per run`);

  console.log(
    '\ncase 3  evaluateScalarPopulation, serial vs explicit WorkerPool (8 items, mid tree)'
  );
  console.log(
    '        rows     serial (ms)   parallel cold (ms)  ratio cold   parallel reused (ms)  ratio reused'
  );
  console.log(
    '        (reused pool: one WorkerPool for warmup + samples, matching searchScalars lifetime)'
  );
  const case3: Array<{
    rows: number;
    serialMs: number;
    parallelColdMs: number;
    ratioCold: number;
    parallelReusedMs: number;
    ratioReused: number;
  }> = [];
  for (const rows of [100, 1_000, 10_000, 100_000]) {
    const column = uniformColumn(rows, 0.15, 0.85, 1);
    const base: Omit<EvaluateScalarPopulationOptions, 'parallel'> = {
      variables: ['x'],
      columns: [column],
      items: POPULATION_ITEMS,
    };
    const serial = () => evaluateScalarPopulation(base);
    assertPopulationsAgree(await serial(), await parallelCallCold(base), rows);
    {
      const pool = new WorkerPool(scalarWorkerPath);
      try {
        assertPopulationsAgree(await serial(), await parallelCallReused(pool, base), rows);
      } finally {
        await pool.terminate();
      }
    }
    const reps = Math.max(minReps, rows <= 1_000 ? 15 : rows <= 10_000 ? 10 : 6);
    const cold = await measurePair(serial, () => parallelCallCold(base), reps, timed);
    const reused = await measureReusedPoolPair(serial, base, reps);
    case3.push({
      rows,
      serialMs: cold.aMs,
      parallelColdMs: cold.bMs,
      ratioCold: cold.bMs / cold.aMs,
      parallelReusedMs: reused.bMs,
      ratioReused: reused.bMs / reused.aMs,
    });
    console.log(
      `        ${String(rows).padStart(7)}   ${cold.aMs.toFixed(4).padStart(11)}   ${cold.bMs
        .toFixed(4)
        .padStart(17)}   ${(cold.bMs / cold.aMs).toFixed(2).padStart(10)}   ${reused.bMs
        .toFixed(4)
        .padStart(18)}   ${(reused.bMs / reused.aMs).toFixed(2)}`
    );
  }

  const controlColumn = uniformColumn(10_000, 0.15, 0.85, 1);
  const controlBase = {
    variables: ['x'] as const,
    columns: [controlColumn],
    items: POPULATION_ITEMS,
  };
  const controlA = () =>
    evaluateScalarPopulation({
      variables: [...controlBase.variables],
      columns: controlBase.columns,
      items: controlBase.items,
    });
  const controlB = () =>
    evaluateScalarPopulation({
      variables: [...controlBase.variables],
      columns: controlBase.columns,
      items: controlBase.items,
    });
  const control = await measurePair(controlA, controlB, Math.max(minReps, 10), timed);
  const controlRatio = control.bMs / control.aMs;
  console.log(
    `\ncontrol (A/A, two distinct serial closures, n = 1e4): ratio ${controlRatio.toFixed(4)}`
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
