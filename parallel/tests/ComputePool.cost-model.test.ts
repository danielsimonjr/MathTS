import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ComputePool, DEFAULT_THRESHOLD_BY_OP } from '../src/index.js';

/**
 * WS-R cost model for `ComputePool.matmul` (#935).
 *
 * `DEFAULT_THRESHOLD_BY_OP.matmul` is a count of multiply-adds (`aRows * aCols * bCols`). It is
 * the cube of the crossover size that the rule in `tools/benchmarks/ws-r-compute-pool.mjs
 * --decide` gives for the processes recorded in `docs/benchmarks/ws-r-matmul-decision.json`.
 * The recorded grid is square and comes from one host, so the first test checks that the
 * constant follows the record. It does not check that the rule is right for other hosts.
 */

interface MatmulRow {
  n: number;
  parOverSeq: number;
}
interface Decision {
  maxRatio: number;
  crossoverN: number | null;
  thresholdMultiplyAdds: number | null;
}
interface DecisionFile {
  decision: Decision;
  records: Array<{ workers: number; matmul: MatmulRow[] }>;
}

const recordPath = fileURLToPath(
  new URL('../../docs/benchmarks/ws-r-matmul-decision.json', import.meta.url)
);
const recorded = JSON.parse(readFileSync(recordPath, 'utf8')) as DecisionFile;

/** The rule of `decideMatmul` in the benchmark script, applied to the recorded rows. */
function derive(file: DecisionFile): number | null {
  const sizes = [...new Set(file.records.flatMap((r) => r.matmul.map((m) => m.n)))].sort(
    (a, b) => a - b
  );
  const won = (n: number): boolean =>
    file.records.every((r) => {
      const row = r.matmul.find((m) => m.n === n);
      return row === undefined || row.parOverSeq <= file.decision.maxRatio;
    });
  let crossover: number | null = null;
  for (let i = sizes.length - 1; i >= 0 && won(sizes[i]); i--) crossover = sizes[i];
  return crossover === null ? null : crossover ** 3;
}

/** The plain triple loop: the order of every sum is k = 0 .. aCols - 1. */
function triple(a: Float64Array, n: number, b: Float64Array): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += a[i * n + k] * b[k * n + j];
      out[i * n + j] = sum;
    }
  }
  return out;
}

function operand(n: number, seed: number): Float64Array {
  const x = new Float64Array(n * n);
  for (let i = 0; i < x.length; i++) x[i] = (((i * seed) % 17) - 8) / 7;
  return x;
}

describe('matmul threshold equals the crossover of the recorded square grid', () => {
  it('the recorded rows give the threshold in the file and the threshold in the pool', () => {
    const derived = derive(recorded);
    expect(derived).not.toBeNull();
    expect(recorded.decision.thresholdMultiplyAdds).toBe(derived);
    expect(DEFAULT_THRESHOLD_BY_OP.matmul).toBe(derived);
  });

  it('the record covers a small pool and a large pool', () => {
    const workers = new Set(recorded.records.map((r) => r.workers));
    expect(Math.min(...workers)).toBeLessThanOrEqual(2);
    expect(Math.max(...workers)).toBeGreaterThanOrEqual(4);
  });
});

describe('ComputePool.matmul keeps small products in-process', () => {
  let pool: ComputePool;
  const threshold = DEFAULT_THRESHOLD_BY_OP.matmul as number;
  // The square sizes on each side of the threshold: multiply-adds are n^3.
  const below = Math.floor(Math.cbrt(threshold)) - 1;
  const above = Math.ceil(Math.cbrt(threshold)) + 1;

  beforeAll(async () => {
    pool = new ComputePool({ maxWorkers: 2 });
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate(true);
  });

  it('a product below the threshold runs in-process and equals the plain loop bit for bit', async () => {
    const a = operand(below, 3);
    const b = operand(below, 5);
    const r = await pool.matmul(a, below, below, b, below);
    expect(r.parallelized).toBe(false);
    const want = triple(a, below, b);
    for (let i = 0; i < want.length; i++) expect(Object.is(r.result[i], want[i])).toBe(true);
  });

  it('a product at the threshold uses the workers, and the result is the same bit for bit', async () => {
    const a = operand(above, 3);
    const b = operand(above, 5);
    const r = await pool.matmul(a, above, above, b, above);
    expect(r.parallelized).toBe(true);
    const want = triple(a, above, b);
    for (let i = 0; i < want.length; i++) expect(Object.is(r.result[i], want[i])).toBe(true);
  });

  it('a tall product with a short inner dimension has many result elements and stays in-process', async () => {
    // 512 x 2 times 2 x 72: 36,864 result elements, 73,728 multiply-adds.
    const [m, k, n] = [512, 2, 72];
    const a = new Float64Array(m * k).map((_, i) => ((i % 13) - 6) / 5);
    const b = new Float64Array(k * n).map((_, i) => ((i % 11) - 5) / 3);
    const r = await pool.matmul(a, m, k, b, n);
    expect(r.parallelized).toBe(false);
    const want = new Float64Array(m * n);
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let t = 0; t < k; t++) sum += a[i * k + t] * b[t * n + j];
        want[i * n + j] = sum;
      }
    for (let i = 0; i < want.length; i++) expect(Object.is(r.result[i], want[i])).toBe(true);
  });

  it('a product with a long inner dimension has few result elements and uses the workers', async () => {
    // 2 x 4,000 times 4,000 x 2,000: 4,000 result elements, 16,000,000 multiply-adds.
    const [m, k, n] = [2, 4000, 2000];
    const a = new Float64Array(m * k).map((_, i) => ((i % 13) - 6) / 5);
    const b = new Float64Array(k * n).map((_, i) => ((i % 11) - 5) / 3);
    const r = await pool.matmul(a, m, k, b, n);
    expect(r.parallelized).toBe(true);
    const seq = await pool.matmul(a, m, k, b, n, { forceSequential: true });
    for (let i = 0; i < m * n; i++) expect(Object.is(r.result[i], seq.result[i])).toBe(true);
  });

  it('forced sequential and forced parallel agree bit for bit at an odd size', async () => {
    const n = 37;
    const a = operand(n, 7);
    const b = operand(n, 11);
    const seq = await pool.matmul(a, n, n, b, n, { forceSequential: true });
    const par = await pool.matmul(a, n, n, b, n, { forceParallel: true });
    expect(seq.parallelized).toBe(false);
    expect(par.parallelized).toBe(true);
    for (let i = 0; i < n * n; i++) expect(Object.is(par.result[i], seq.result[i])).toBe(true);
  });
});

describe('ComputePool.sin default path (#931)', () => {
  it("stays in-process for the 'never' op, so Math.sin runs here once per value", async () => {
    const pool = new ComputePool({ maxWorkers: 2 });
    await pool.initialize();
    const n = 100_000;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = i * 1e-5;
    const before = Float64Array.from(x);
    // A worker would call its own Math.sin, which this spy does not see.
    const spy = vi.spyOn(Math, 'sin');
    let r;
    try {
      r = await pool.sin(x);
    } finally {
      const calls = spy.mock.calls.length;
      spy.mockRestore();
      await pool.terminate(true);
      expect(calls).toBe(n);
    }
    expect(r.parallelized).toBe(false);
    expect(r.chunks).toBe(1);
    expect(r.result).toHaveLength(n);
    for (let i = 0; i < n; i++) expect(Object.is(r.result[i], Math.sin(x[i]))).toBe(true);
    expect(x).toEqual(before);
  });
});

describe('ComputePool forceParallel after warmup (#903)', () => {
  it('warmup starts every worker, and the first forced call starts none', async () => {
    const pool = new ComputePool({ maxWorkers: 3 });
    try {
      await pool.initialize();
      // `initialize()` starts `minWorkers` workers; the rest start on demand.
      expect(pool.stats().totalWorkers).toBeLessThan(3);
      await pool.warmup();
      expect(pool.stats().totalWorkers).toBe(3);

      const n = 300_000;
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = i * 1e-6;
      const r = await pool.sin(x, { forceParallel: true });
      expect(pool.stats().totalWorkers).toBe(3);
      expect(r.parallelized).toBe(true);
      expect(r.chunks).toBeGreaterThan(1);
      for (let i = 0; i < n; i += 991) expect(Object.is(r.result[i], Math.sin(x[i]))).toBe(true);
    } finally {
      await pool.terminate(true);
    }
  });

  it('forceParallel on a pool that was not initialized starts the pool and runs on workers', async () => {
    const pool = new ComputePool({ maxWorkers: 2 });
    try {
      expect(pool.isReady()).toBe(false);
      const x = new Float64Array(1000).fill(0.5);
      const r = await pool.sin(x, { forceParallel: true });
      expect(pool.isReady()).toBe(true);
      expect(r.parallelized).toBe(true);
      expect(Object.is(r.result[999], Math.sin(0.5))).toBe(true);
    } finally {
      await pool.terminate(true);
    }
  });

  it('warmup(count) starts at most maxWorkers and throws after terminate', async () => {
    const pool = new ComputePool({ maxWorkers: 2 });
    await pool.warmup(10);
    expect(pool.stats().totalWorkers).toBe(2);
    await pool.terminate(true);
    await expect(pool.warmup()).rejects.toThrow(/terminated/i);
  });
});

interface ElementwiseOpRow {
  op: string;
  warmCrossoverElements: number | null;
  perSize: Array<{ n: number; worst: number }>;
}
interface ElementwiseDecisionFile {
  decision: { maxRatio: number; ops: ElementwiseOpRow[] };
}
interface ColdFile {
  trials: Array<{ sinParallelMs: number[]; sinSequentialMedianMs: number }>;
}

const readRecord = <T>(name: string): T =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../docs/benchmarks/${name}`, import.meta.url)), 'utf8')
  ) as T;

describe('element-wise transcendentals stay in-process by default (#903, #931)', () => {
  const ops = ['sin', 'cos', 'tan', 'exp', 'log'] as const;
  const decision = readRecord<ElementwiseDecisionFile>('ws-r-elementwise-decision.json').decision;
  const cold = readRecord<ColdFile>('ws-r-cold-start-head.json');

  it('the record has a warm crossover of at least 1,000,000 values for each op, from its own rows', () => {
    for (const op of ops) {
      const row = decision.ops.find((d) => d.op === op);
      expect(row, op).toBeDefined();
      const sizes = row!.perSize.map((s) => s.n).sort((a, b) => a - b);
      const won = (n: number): boolean =>
        row!.perSize.find((s) => s.n === n)!.worst <= decision.maxRatio;
      let crossover: number | null = null;
      for (let i = sizes.length - 1; i >= 0 && won(sizes[i]); i--) crossover = sizes[i];
      expect(row!.warmCrossoverElements, op).toBe(crossover);
      expect(crossover, op).not.toBeNull();
      expect(crossover as number, op).toBeGreaterThanOrEqual(1_000_000);
    }
  });

  it('the first forced-parallel call of a fresh pool takes longer than the in-process call', () => {
    expect(cold.trials.length).toBeGreaterThanOrEqual(3);
    for (const t of cold.trials) {
      expect(t.sinParallelMs[0]).toBeGreaterThan(t.sinSequentialMedianMs);
    }
  });

  it("so the default threshold of each of the five ops is 'never'", () => {
    for (const op of ops) expect(DEFAULT_THRESHOLD_BY_OP[op], op).toBe('never');
  });
});
