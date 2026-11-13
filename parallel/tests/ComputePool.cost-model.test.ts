import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ComputePool, DEFAULT_THRESHOLD_BY_OP } from '../src/index.js';

/**
 * WS-R cost model for `ComputePool.matmul` (#935).
 *
 * `DEFAULT_THRESHOLD_BY_OP.matmul` is not a typed-in number: it is the output of the rule
 * in `tools/benchmarks/ws-r-compute-pool.mjs --decide`, run on the processes recorded in
 * `docs/benchmarks/ws-r-matmul-decision.json`. The first test derives the threshold from
 * those recorded rows again, so a constant that no recorded measurement supports fails.
 */

interface MatmulRow {
  n: number;
  parOverSeq: number;
}
interface Decision {
  maxRatio: number;
  crossoverN: number | null;
  thresholdElements: number | null;
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
  return crossover === null ? null : crossover * crossover;
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

describe('matmul threshold comes from a recorded measurement', () => {
  it('the recorded rows give the threshold in the file and the threshold in the pool', () => {
    const derived = derive(recorded);
    expect(derived).not.toBeNull();
    expect(recorded.decision.thresholdElements).toBe(derived);
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
  // The sizes on each side of the threshold: result elements are n * n.
  const below = Math.floor(Math.sqrt(threshold)) - 1;
  const above = Math.ceil(Math.sqrt(threshold)) + 1;

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

/** Count `new Float64Array(length >= minLength)` while `run` executes (the global is restored). */
async function countLargeF64<T>(minLength: number, run: () => Promise<T>): Promise<[T, number]> {
  const Original = globalThis.Float64Array;
  let count = 0;
  const Counting: typeof Float64Array = new Proxy(Original, {
    construct(target, args, newTarget): object {
      const first = args[0] as unknown;
      if (typeof first === 'number' && first >= minLength) count++;
      else if (
        first !== null &&
        typeof first === 'object' &&
        (first as ArrayLike<number>).length >= minLength
      ) {
        count++;
      }
      return Reflect.construct(target, args, newTarget === Counting ? target : newTarget);
    },
  });
  (globalThis as { Float64Array: unknown }).Float64Array = Counting;
  try {
    return [await run(), count];
  } finally {
    (globalThis as { Float64Array: unknown }).Float64Array = Original;
  }
}

describe('ComputePool.sin default path (#931)', () => {
  it("stays in-process for the 'never' op and builds one array of n values, the result", async () => {
    const pool = new ComputePool({ maxWorkers: 2 });
    await pool.initialize();
    try {
      const n = 100_000;
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = i * 1e-5;
      const [r, large] = await countLargeF64(n, () => pool.sin(x));
      expect(r.parallelized).toBe(false);
      expect(r.chunks).toBe(1);
      // An input copy would make it two.
      expect(large).toBe(1);
      for (let i = 0; i < n; i += 997) expect(Object.is(r.result[i], Math.sin(x[i]))).toBe(true);
    } finally {
      await pool.terminate(true);
    }
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
