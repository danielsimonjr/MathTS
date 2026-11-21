/**
 * Issue #1142: a ComputePool entry reads `data.length` before it knows what `data` is.
 *
 * Mechanism: an entry picks the sequential or the parallel path from `data.length`. A number has no
 * `length`, so the force flag decided and the call returned 0 or an unrelated TypeError. On the
 * parallel path the pool transfers `chunk.buffer`: a `number[]` or a string has no buffer, and the
 * worker library threw `DataCloneError` in a later tick, which ended the process. A typed array of
 * another element type sent its bytes, and the worker read them as Float64 or Int32.
 *
 * The fix turns each data argument into the array type that the entry reads (a copy for another
 * array-like, no copy for the right type) or throws one TypeError that names the entry. The input
 * is never changed or detached.
 *
 * RED of a row that crashes the runner before the fix: do not run it in this file. Run the case in
 * its own process (`node .relay-sprint/scratch-planrev/v8.mjs crash N`). The titles of these rows
 * hold `[crash before the fix]`, so a run before the fix can leave them out with
 * `-t "^(?!.*crash before the fix)"`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ComputePool, parallelCount, parallelSum, parallelVariance } from '../src/index.js';
import type { DispatchOptions } from '../src/index.js';

/** Every op name that these tests set, so that the workers pool runs each one on its workers. */
const OPS = [
  'sum',
  'prod',
  'dot',
  'distance',
  'add',
  'subtract',
  'multiply',
  'divide',
  'scale',
  'matmul',
  'transpose',
  'minMax',
  'min',
  'max',
  'variance',
  'mean',
  'std',
  'norm',
  'histogram',
  'abs',
  'sqrt',
  'matvec',
  'outer',
  'pow',
  'sign',
  'bitAnd',
  'bitOr',
  'bitXor',
  'bitNot',
  'leftShift',
  'rightArithShift',
  'rightLogShift',
] as const;

/** A ThresholdByOp that sets every listed op to one value. */
function thresholds(value: 'always' | 'never'): never {
  return Object.fromEntries(OPS.map((op) => [op, value])) as never;
}

/** Runs everything on the calling thread, unless the call forces the workers. */
const inline = new ComputePool({
  maxWorkers: 2,
  thresholdElements: 1e12,
  thresholdByOp: thresholds('never'),
});
/** Runs every listed op on the workers, unless the call forces the calling thread. */
const workers = new ComputePool({
  maxWorkers: 2,
  thresholdElements: 1,
  thresholdByOp: thresholds('always'),
});

beforeAll(async () => {
  await inline.initialize();
  await workers.initialize();
}, 60_000);

afterAll(async () => {
  await inline.terminate(true);
  await workers.terminate(true);
});

/** The error that a promise rejects with, or null when it resolves. */
async function rejection(promise: Promise<unknown>): Promise<Error | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error as Error;
  }
}

/** Asserts that the promise rejects with a TypeError that has exactly this message. */
async function expectTypeError(promise: Promise<unknown>, message: string): Promise<void> {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(TypeError);
  expect(error?.message).toBe(message);
}

/** The text of a result: a typed array and an array print their entries. */
function plain(value: unknown): unknown {
  if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

type Mode = { label: string; pool: ComputePool; force?: DispatchOptions; parallelized: boolean };

/** The four ways to reach an entry that has a `force` parameter. */
const MODES: Mode[] = [
  {
    label: 'forceSequential',
    pool: workers,
    force: { forceSequential: true },
    parallelized: false,
  },
  { label: 'inline pool, no force', pool: inline, force: undefined, parallelized: false },
  { label: 'workers pool, no force', pool: workers, force: undefined, parallelized: true },
  { label: 'forceParallel', pool: inline, force: { forceParallel: true }, parallelized: true },
];

type Pool = ComputePool;
type Call = (
  pool: Pool,
  data: unknown,
  force?: DispatchOptions
) => Promise<{
  result: unknown;
  parallelized: boolean;
}>;

/**
 * An entry with a `force` parameter. `bad` is the call with `data` as the first array argument,
 * `badSecond` the call with `data` as the second one. `good` holds a number[] (or another typed
 * array) and the value that the entry gives for it.
 */
interface ForceEntry {
  name: string;
  /** The name in the TypeError: the method that holds the guard. */
  op: string;
  call: Call;
  /** The call that puts `data` in the second array argument, for an entry with two. */
  callSecond?: Call;
  /** An input of another array type and the result that every mode gives. */
  good: { input: unknown; expected: unknown };
}

const FORCE_ENTRIES: ForceEntry[] = [
  {
    name: 'sum',
    op: 'sum',
    call: (p, x, f) => p.sum(x as never, f),
    good: { input: [1, 2, 3, 4], expected: 10 },
  },
  {
    name: 'prod',
    op: 'prod',
    call: (p, x, f) => p.prod(x as never, f),
    good: { input: [1, 2, 3, 4], expected: 24 },
  },
  {
    name: 'dot',
    op: 'dot',
    call: (p, x, f) => p.dot(x as never, [1, 2, 3, 4] as never, f),
    callSecond: (p, x, f) => p.dot([1, 2, 3, 4] as never, x as never, f),
    good: { input: [1, 2, 3, 4], expected: 30 },
  },
  {
    name: 'distance',
    op: 'distance',
    call: (p, x, f) => p.distance(x as never, [3, 4, 0, 0] as never, f),
    callSecond: (p, x, f) => p.distance([3, 4, 0, 0] as never, x as never, f),
    good: { input: [0, 0, 0, 0], expected: 5 },
  },
  {
    name: 'elementwise',
    op: 'elementwise',
    call: (p, x, f) => p.elementwise(x as never, [1, 1, 1, 1] as never, 'add', f),
    callSecond: (p, x, f) => p.elementwise([1, 1, 1, 1] as never, x as never, 'add', f),
    good: { input: [1, 2, 3, 4], expected: [2, 3, 4, 5] },
  },
  {
    name: 'add (delegates to elementwise)',
    op: 'elementwise',
    call: (p, x, f) => p.add(x as never, [1, 1, 1, 1] as never, f),
    good: { input: [1, 2, 3, 4], expected: [2, 3, 4, 5] },
  },
  {
    name: 'scale',
    op: 'scale',
    call: (p, x, f) => p.scale(x as never, 2, f),
    good: { input: [1, 2, 3, 4], expected: [2, 4, 6, 8] },
  },
  {
    name: 'transpose',
    op: 'transpose',
    call: (p, x, f) => p.transpose(x as never, 2, 2, f),
    good: { input: [1, 2, 3, 4], expected: [1, 3, 2, 4] },
  },
  {
    name: 'minMax',
    op: 'minMax',
    call: (p, x, f) => p.minMax(x as never, f),
    good: {
      input: new Int32Array([1, 2, 3, 4]),
      expected: { min: 1, max: 4, minIdx: 0, maxIdx: 3 },
    },
  },
  {
    name: 'min (delegates to minMax)',
    op: 'minMax',
    call: (p, x, f) => p.min(x as never, f),
    good: { input: new Int32Array([2, 1, 3]), expected: 1 },
  },
  {
    name: 'variance',
    op: 'variance',
    call: (p, x, f) => p.variance(x as never, f),
    good: {
      input: [1, 2, 3, 4],
      expected: { mean: 2.5, variance: 1.25, std: 1.118033988749895 },
    },
  },
  {
    name: 'mean (delegates to variance)',
    op: 'variance',
    call: (p, x, f) => p.mean(x as never, f),
    good: { input: [1, 2, 3, 4], expected: 2.5 },
  },
  {
    name: 'norm',
    op: 'norm',
    call: (p, x, f) => p.norm(x as never, f),
    good: { input: [3, 4], expected: 5 },
  },
  {
    name: 'histogram',
    op: 'histogram',
    call: (p, x, f) => p.histogram(x as never, 2, 0, 4, f),
    good: { input: [1, 2, 3, 4], expected: [1, 3] },
  },
  {
    name: 'unary',
    op: 'unary',
    call: (p, x, f) => p.unary(x as never, 'abs', f),
    good: { input: new Float32Array([-1, 2]), expected: [1, 2] },
  },
  {
    name: 'abs (delegates to unary)',
    op: 'unary',
    call: (p, x, f) => p.abs(x as never, f),
    good: { input: new Float32Array([-1, 2]), expected: [1, 2] },
  },
  {
    name: 'matvec',
    op: 'matvec',
    call: (p, x, f) => p.matvec(x as never, 2, 2, [1, 1] as never, f),
    callSecond: (p, x, f) => p.matvec([1, 2, 3, 4] as never, 2, 2, x as never, f),
    good: { input: [1, 2, 3, 4], expected: [3, 7] },
  },
  {
    name: 'outer',
    op: 'outer',
    call: (p, x, f) => p.outer(x as never, [3, 4] as never, f),
    callSecond: (p, x, f) => p.outer([1, 2] as never, x as never, f),
    good: { input: [1, 2], expected: [3, 4, 6, 8] },
  },
];

describe('entries with a force parameter: a number is a TypeError on every path', () => {
  for (const entry of FORCE_ENTRIES) {
    for (const mode of MODES) {
      it(`${entry.name}(1), ${mode.label}`, async () => {
        await expectTypeError(
          entry.call(mode.pool, 1, mode.force),
          `${entry.op}: expects an array of numbers, got a number`
        );
      });
    }
  }

  it('the second array argument is checked too', async () => {
    for (const entry of FORCE_ENTRIES) {
      if (!entry.callSecond) continue;
      for (const mode of MODES) {
        await expectTypeError(
          entry.callSecond(mode.pool, 1, mode.force),
          `${entry.op}: expects an array of numbers, got a number`
        );
      }
    }
  });

  it('null and a string name their type', async () => {
    await expectTypeError(
      workers.sum(null as never, { forceParallel: true }),
      'sum: expects an array of numbers, got a null'
    );
    await expectTypeError(
      inline.sum('ab' as never, { forceSequential: true }),
      'sum: expects an array of numbers, got a string'
    );
  });

  it('a string on the forced parallel path is a TypeError [crash before the fix]', async () => {
    await expectTypeError(
      workers.sum('ab' as never, { forceParallel: true }),
      'sum: expects an array of numbers, got a string'
    );
  });
});

describe('entries with a force parameter: another array type gives the same value on every path', () => {
  for (const entry of FORCE_ENTRIES) {
    for (const mode of MODES) {
      const crash = Array.isArray(entry.good.input) && mode.parallelized;
      const tag = crash ? ' [crash before the fix]' : '';
      it(`${entry.name}(${Array.isArray(entry.good.input) ? 'number[]' : (entry.good.input as object).constructor.name}), ${mode.label}${tag}`, async () => {
        const out = await entry.call(mode.pool, entry.good.input, mode.force);
        expect(plain(out.result)).toEqual(entry.good.expected);
        expect(out.parallelized).toBe(mode.parallelized);
      });
    }
  }
});

describe('entries without a force parameter: two pools', () => {
  const POOLS: [string, Pool, boolean][] = [
    ['inline pool', inline, false],
    ['workers pool', workers, true],
  ];

  const ENTRIES: {
    name: string;
    op: string;
    call: (pool: Pool, data: unknown) => Promise<{ result: unknown; parallelized: boolean }>;
    good: unknown;
    expected: unknown;
    /** When set, the entry does not reach the workers in this test: say why. */
    sequentialOnly?: string;
  }[] = [
    {
      name: 'applyKernel',
      op: 'applyKernel',
      call: (p, x) => p.applyKernel(x as never, '(x) => x * 2'),
      good: [1, 2],
      expected: [2, 4],
    },
    {
      name: 'applyKernel2',
      op: 'applyKernel2',
      call: (p, x) => p.applyKernel2(x as never, [3, 4] as never, '(x, y) => x + y'),
      good: [1, 2],
      expected: [4, 6],
    },
    {
      name: 'pow',
      op: 'pow',
      call: (p, x) => p.pow(x as never, [2, 2] as never),
      good: [1, 2],
      expected: [1, 4],
    },
    {
      name: 'sign',
      op: 'sign',
      call: (p, x) => p.sign(x as never),
      good: [-3, 0, 5],
      expected: [-1, 0, 1],
    },
    {
      name: 'fftBatch',
      op: 'fftBatch',
      call: (p, x) => p.fftBatch(x as never, [0, 0, 0, 0] as never, 1, 4),
      good: [1, 0, 0, 0],
      expected: { real: [1, 1, 1, 1], imag: [0, 0, 0, 0] },
    },
    {
      name: 'distanceMatrix',
      op: 'distanceMatrix',
      call: (p, x) => p.distanceMatrix(x as never, 2, 2),
      good: [0, 0, 3, 4],
      expected: [0, 5, 5, 0],
    },
    {
      name: 'tensordot',
      op: 'tensordot',
      call: (p, x) => p.tensordot(x as never, [2], [3, 4] as never, [2], [0], [0]),
      good: [1, 2],
      expected: { data: [11], shape: [] },
    },
    {
      name: 'matmul',
      op: 'matmul',
      call: (p, x) => p.matmul(x as never, 2, 2, new Float64Array([5, 6, 7, 8]), 2),
      good: new Float64Array([1, 2, 3, 4]),
      expected: [19, 22, 43, 50],
    },
  ];

  for (const entry of ENTRIES) {
    for (const [label, pool] of POOLS) {
      if (entry.name === 'matmul') continue;
      it(`${entry.name}(1), ${label}`, async () => {
        await expectTypeError(
          entry.call(pool, 1),
          `${entry.op}: expects an array of numbers, got a number`
        );
      });
    }
    for (const [label, pool, parallelized] of POOLS) {
      const crash = Array.isArray(entry.good) && parallelized;
      const tag = crash ? ' [crash before the fix]' : '';
      it(`${entry.name}(${Array.isArray(entry.good) ? 'number[]' : 'Float64Array'}), ${label}${tag}`, async () => {
        const out = await entry.call(pool, entry.good);
        expect(plain(out.result)).toEqual(entry.expected);
        // The pow, sign and tensordot kernels run on the workers only when the pool says so.
        if (entry.name !== 'tensordot') expect(out.parallelized).toBe(parallelized);
      });
    }
  }

  it('matmul keeps the TypeError of assertMatmulArgs on both pools', async () => {
    for (const [, pool] of POOLS) {
      const error = await rejection(pool.matmul([1] as never, 1, 1, [2] as never, 1));
      expect(error).toBeInstanceOf(TypeError);
      expect(error?.message).not.toMatch(/expects an array of numbers/);
    }
  });

  it('sign(1) is a TypeError and not [] (the silent value before the fix)', async () => {
    for (const [, pool] of POOLS) {
      await expectTypeError(
        pool.sign(1 as never),
        'sign: expects an array of numbers, got a number'
      );
    }
  });
});

describe('Int32 entries', () => {
  const POOLS: [string, Pool][] = [
    ['inline pool', inline],
    ['workers pool', workers],
  ];

  it('bitAnd, leftShift and bitNot give the same value for a number[] [crash before the fix]', async () => {
    for (const [, pool] of POOLS) {
      expect(plain((await pool.bitAnd([6, 3] as never, [3, 3] as never)).result)).toEqual([2, 3]);
      expect(plain((await pool.leftShift([1, 2] as never, 1)).result)).toEqual([2, 4]);
      expect(plain((await pool.bitNot([1, 2] as never)).result)).toEqual([-2, -3]);
    }
  });

  it('a number is a TypeError', async () => {
    for (const [, pool] of POOLS) {
      await expectTypeError(
        pool.bitNot(1 as never),
        'bitNot: expects an array of numbers, got a number'
      );
      await expectTypeError(
        pool.bitAnd(1 as never, [1] as never),
        'bitAnd: expects an array of numbers, got a number'
      );
      await expectTypeError(
        pool.bitAnd([1] as never, 1 as never),
        'bitAnd: expects an array of numbers, got a number'
      );
      await expectTypeError(
        pool.leftShift(1 as never, 1),
        'leftShift: expects an array of numbers, got a number'
      );
      await expectTypeError(
        pool.leftShift([1] as never, null as never),
        'leftShift: expects an array of numbers, got a null'
      );
    }
  });

  it('the workers pool runs the Int32 entries on its workers', async () => {
    expect((await workers.bitNot(new Int32Array([1, 2]))).parallelized).toBe(true);
    expect((await inline.bitNot(new Int32Array([1, 2]))).parallelized).toBe(false);
  });
});

describe('Array entries: map, filter, reduce, find, sort', () => {
  const POOLS: [string, Pool, DispatchOptions | undefined, boolean][] = [
    ['forceSequential', workers, { forceSequential: true }, false],
    ['inline pool, no force', inline, undefined, false],
    ['workers pool, no force', workers, undefined, true],
    ['forceParallel', inline, { forceParallel: true }, true],
  ];

  it('a number is a TypeError on every path', async () => {
    for (const [, pool, force] of POOLS) {
      const message = (op: string, type = 'number'): string =>
        `${op}: expects an array, got a ${type}`;
      await expectTypeError(
        pool.map(1 as never, (x: number) => x, force),
        message('map')
      );
      await expectTypeError(
        pool.filter(1 as never, (x: number) => x > 0, force),
        message('filter')
      );
      await expectTypeError(
        pool.reduce(1 as never, (a: number, b: number) => a + b, 0, force),
        message('reduce')
      );
      await expectTypeError(
        pool.find(1 as never, (x: number) => x > 0, force),
        message('find')
      );
      await expectTypeError(pool.sort(1 as never, undefined, force), message('sort'));
      await expectTypeError(
        pool.map('ab' as never, (x: string) => x, force),
        message('map', 'string')
      );
    }
  });

  it('map of a Float64Array gives a plain Array on every path', async () => {
    for (const [, pool, force, parallelized] of POOLS) {
      const out = await pool.map(
        new Float64Array([1, 2, 3, 4]) as never,
        (x: number) => x * 0.5,
        force
      );
      expect(Array.isArray(out.result)).toBe(true);
      expect(out.result).toEqual([0.5, 1, 1.5, 2]);
      expect(out.parallelized).toBe(parallelized);
    }
  });

  it('map of an Int32Array does not truncate the result', async () => {
    for (const [, pool, force] of POOLS) {
      const out = await pool.map(new Int32Array([1, 2]) as never, (x: number) => x * 0.5, force);
      expect(out.result).toEqual([0.5, 1]);
    }
  });

  it('filter of a Float64Array gives a plain Array on every path', async () => {
    for (const [, pool, force, parallelized] of POOLS) {
      const out = await pool.filter(
        new Float64Array([3, 1, 2]) as never,
        (x: number) => x > 1,
        force
      );
      expect(Array.isArray(out.result)).toBe(true);
      expect(out.result).toEqual([3, 2]);
      expect(out.parallelized).toBe(parallelized);
    }
  });

  it('reduce, find and sort of a Float64Array', async () => {
    for (const [, pool, force] of POOLS) {
      const data = new Float64Array([3, 1, 2]);
      expect(
        (await pool.reduce(data as never, (a: number, b: number) => a + b, 0, force)).result
      ).toBe(6);
      expect((await pool.find(data as never, (x: number) => x === 1, force)).result).toMatchObject({
        found: true,
        value: 1,
        index: 1,
      });
      const sorted = await pool.sort(data as never, undefined, force);
      expect(Array.isArray(sorted.result)).toBe(true);
      expect(sorted.result).toEqual([1, 2, 3]);
      expect(Array.from(data)).toEqual([3, 1, 2]);
    }
  });
});

describe('MathWorkerPool: the guard is the first statement of a public data method', () => {
  it('sum of a number[] with forceParallel runs on the workers [crash before the fix]', async () => {
    const out = await workers.getWorkerPool().sum([1, 2, 3, 4] as never, { forceParallel: true });
    expect(out.result).toBe(10);
    expect(out.parallelized).toBe(true);
  });

  it('sum of a number is a TypeError with and without a force flag', async () => {
    const pool = workers.getWorkerPool();
    const message = 'sum: expects an array of numbers, got a number';
    await expectTypeError(pool.sum(1 as never, { forceParallel: true }), message);
    await expectTypeError(pool.sum(1 as never), message);
    await expectTypeError(pool.sum(1 as never, { forceSequential: true }), message);
  });

  it('a BigInt typed array is a TypeError and not a crash', async () => {
    const error = await rejection(
      workers.sum(new BigInt64Array(2) as never, { forceParallel: true })
    );
    expect(error).toBeInstanceOf(TypeError);
  });
});

describe('the free functions of operations/', () => {
  it('parallelSum(1) and parallelVariance(1) throw the same TypeError on every path', async () => {
    for (const force of [{ forceSequential: true }, {}, { forceParallel: true }]) {
      await expectTypeError(
        parallelSum(1 as never, { pool: inline, ...force }),
        'sum: expects an array of numbers, got a number'
      );
      await expectTypeError(
        parallelVariance(1 as never, { pool: inline, ...force }),
        'variance: expects an array of numbers, got a number'
      );
    }
  });

  it('parallelCount of a number is a TypeError, and of a typed array is its length', async () => {
    await expectTypeError(
      parallelCount(1 as never, undefined, { pool: inline }),
      'count: expects an array, got a number'
    );
    expect(
      (await parallelCount(new Float64Array(4) as never, undefined, { pool: inline })).result
    ).toBe(4);
  });
});

describe('the input is never changed or detached', () => {
  it('a Float64Array keeps its length and values after a forced parallel call', async () => {
    const data = new Float64Array([1, 2, 3, 4]);
    const out = await workers.sum(data, { forceParallel: true });
    expect(out.result).toBe(10);
    expect(data.length).toBe(4);
    expect(Array.from(data)).toEqual([1, 2, 3, 4]);
  });

  it('a number[] and an Int32Array keep their values [crash before the fix]', async () => {
    const list = [1, 2, 3, 4];
    const ints = new Int32Array([1, 2, 3, 4]);
    await workers.sum(list as never, { forceParallel: true });
    await workers.sum(ints as never, { forceParallel: true });
    expect(list).toEqual([1, 2, 3, 4]);
    expect(Array.from(ints)).toEqual([1, 2, 3, 4]);
  });
});
