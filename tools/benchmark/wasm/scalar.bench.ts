/**
 * `evaluateScalar` per row vs `compileScalar` batch evaluation (M3 / Sprint 1R item 6).
 *
 * ratio = batchMs / interpMs; < 1 means compiled batch wins.
 *
 * Run on V8, twice (AGENTS.md benchmarking rules 7, 8 and 10):
 *   node tools/benchmark/wasm/run-node.mjs scalar
 */
import { scalarSize, type ScalarNode } from '../../../expression/src/scalar-structure.js';
import { compileScalar, evaluateScalar, scalar } from '../../../functions/src/index.js';
import { defaultIterations, isMainModule, median, sciLabel } from './harness.js';

function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function uniform(n: number, lo: number, hi: number, seed = 1): Float64Array {
  const r = rng(seed);
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = lo + (hi - lo) * r();
  return xs;
}

function timeOnce(fn: () => void): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

function buildSmall(): ScalarNode {
  return scalar.op('+', [
    scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]),
    scalar.number(3),
  ]);
}

/** sin(x) * exp(x) + natural_log(x + 1) — natural log is `ln` in the scalar builder. */
function buildMid(): ScalarNode {
  return scalar.op('+', [
    scalar.op('*', [
      scalar.call('sin', scalar.symbol('x')),
      scalar.call('exp', scalar.symbol('x')),
    ]),
    scalar.call('ln', scalar.op('+', [scalar.symbol('x'), scalar.number(1)])),
  ]);
}

function leftFoldPlus(terms: readonly ScalarNode[]): ScalarNode {
  let acc = terms[0];
  for (let i = 1; i < terms.length; i++) {
    acc = scalar.op('+', [acc, terms[i]]);
  }
  return acc;
}

function buildLarge(): ScalarNode {
  const x = scalar.symbol('x');
  const node = leftFoldPlus([
    x,
    scalar.call('sin', x),
    scalar.call('cos', x),
    scalar.call('exp', scalar.op('*', [x, scalar.number(0.25)])),
    scalar.call('ln', scalar.op('+', [x, scalar.number(1)])),
    scalar.call('tanh', x),
    scalar.call('abs', x),
    scalar.call('log10', scalar.op('+', [x, scalar.number(0.5)])),
  ]);
  const nodeCount = scalarSize(node);
  if (nodeCount !== 28) {
    throw new Error(`scalar bench: large tree nodeCount ${nodeCount}, expected 28`);
  }
  return node;
}

const TREES: ReadonlyArray<{ name: string; node: ScalarNode }> = [
  { name: 'small', node: buildSmall() },
  { name: 'mid', node: buildMid() },
  { name: 'large', node: buildLarge() },
];

const SIZES = [100, 1_000, 10_000, 100_000, 1_000_000];

interface BenchRow {
  tree: string;
  n: number;
  interpMs: number;
  batchMs: number;
  ratio: number;
  maxDiff: number;
}

function assertBitwiseMatch(
  interp: Float64Array,
  batch: { values: Float64Array; valid: Uint8Array; allValid: boolean }
): void {
  const { values, valid, allValid } = batch;
  if (!allValid) throw new Error('scalar bench: batch allValid is false');
  if (values.length !== interp.length) {
    throw new Error(`scalar bench: length mismatch ${interp.length} vs ${values.length}`);
  }
  for (let i = 0; i < valid.length; i++) {
    if (valid[i] !== 1) throw new Error(`scalar bench: valid[${i}] = ${valid[i]}`);
  }
  for (let i = 0; i < interp.length; i++) {
    if (!Object.is(interp[i], values[i])) {
      throw new Error(`scalar bench: bitwise mismatch at ${i}: ${interp[i]} vs ${values[i]}`);
    }
  }
}

function runInterp(node: ScalarNode, col: Float64Array): Float64Array {
  const n = col.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = evaluateScalar(node, { x: col[i] });
  }
  return out;
}

function validateOnce(
  node: ScalarNode,
  col: Float64Array,
  compiled: ReturnType<typeof compileScalar>
): void {
  const interp = runInterp(node, col);
  if (!(interp instanceof Float64Array) || interp.length !== col.length) {
    throw new Error('scalar bench: interp did not return Float64Array of length n');
  }
  const batch = compiled.evaluate([col]);
  assertBitwiseMatch(interp, batch);
}

async function timeBoth(
  interp: () => void,
  batch: () => void,
  n: number
): Promise<{ interpMs: number; batchMs: number }> {
  const reps = Math.max(8, defaultIterations(n));
  const warmupRounds = 5;
  for (let w = 0; w < warmupRounds; w++) {
    interp();
    batch();
  }
  const interpSamples: number[] = [];
  const batchSamples: number[] = [];
  for (let r = 0; r < reps; r++) {
    const order = r % 2 === 0 ? ['interp', 'batch'] : ['batch', 'interp'];
    for (const which of order) {
      if (which === 'interp') interpSamples.push(timeOnce(interp));
      else batchSamples.push(timeOnce(batch));
    }
  }
  return { interpMs: median(interpSamples), batchMs: median(batchSamples) };
}

function printCrossoverHint(rows: BenchRow[]): void {
  const byTree = new Map<string, BenchRow[]>();
  for (const row of rows) {
    const list = byTree.get(row.tree) ?? [];
    list.push(row);
    byTree.set(row.tree, list);
  }
  for (const [tree, treeRows] of byTree) {
    const sorted = [...treeRows].sort((a, b) => a.n - b.n);
    let crossover: number | null = null;
    for (const row of sorted) {
      if (row.ratio < 0.8) {
        const allLargerOk = sorted.filter((r) => r.n >= row.n).every((r) => r.ratio < 0.8);
        if (allLargerOk) {
          crossover = row.n;
          break;
        }
      }
    }
    if (crossover !== null) {
      console.log(
        `crossover hint (${tree}, this run only): n >= ${sciLabel(crossover)} with ratio < 0.8 at all larger sizes`
      );
    } else {
      console.log(`crossover hint (${tree}, this run only): none on this grid (ratio < 0.8 band)`);
    }
  }
}

async function runControl(compiledSmall: ReturnType<typeof compileScalar>): Promise<number> {
  const n = 10_000;
  const col = uniform(n, 0.15, 0.85, 1);
  const a = () => {
    compiledSmall.evaluate([col]);
  };
  const t = await timeBoth(a, a, n);
  const ratio = t.batchMs / t.interpMs;
  console.log('\ncontrol (small tree, n=1e4, both thunks = compiled.evaluate)');
  console.log(
    `       interp ms ${t.interpMs.toFixed(4)}   batch ms ${t.batchMs.toFixed(4)}   ratio ${ratio.toFixed(4)}`
  );
  if (Math.abs(ratio - 1) > 0.1) {
    throw new Error(`scalar bench: control ratio ${ratio} is outside [0.9, 1.1]`);
  }
  return ratio;
}

export async function main(): Promise<void> {
  console.log(
    'evaluateScalar per row vs compileScalar batch. ratio = batch/interp (< 1: compiled wins).'
  );

  const smallNode = buildSmall();
  const compiledSmall = compileScalar(smallNode, { variables: ['x'] });
  const controlRatio = await runControl(compiledSmall);

  const rows: BenchRow[] = [];

  for (const { name, node } of TREES) {
    const compiled = compileScalar(node, { variables: ['x'] });
    console.log(`\n## ${name} tree`);
    console.log('       n    interp (ms)    batch (ms)    ratio');
    for (const n of SIZES) {
      const col = uniform(n, 0.15, 0.85, 1);
      validateOnce(node, col, compiled);

      const interp = () => {
        runInterp(node, col);
      };
      const batch = () => {
        compiled.evaluate([col]);
      };

      const t = await timeBoth(interp, batch, n);
      const ratio = t.batchMs / t.interpMs;
      const row: BenchRow = {
        tree: name,
        n,
        interpMs: t.interpMs,
        batchMs: t.batchMs,
        ratio,
        maxDiff: 0,
      };
      rows.push(row);
      console.log(
        `${sciLabel(n).padStart(8)}   ${t.interpMs.toFixed(4).padStart(11)}   ${t.batchMs
          .toFixed(4)
          .padStart(11)}   ${ratio.toFixed(2).padStart(6)}`
      );
    }
  }

  printCrossoverHint(rows);
  console.log(`\ncontrol ratio (this run): ${controlRatio.toFixed(4)}`);
  console.log(`SCALAR_BATCH_JSON ${JSON.stringify(rows)}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
