import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { MathWorkerPool } from '../src/index.js';
import { tensordotRange } from '../src/tensordot-range.js';
import { legacyParallelKernel, legacyWorkerKernel } from './fixtures/tensordot-legacy-kernel.js';

/**
 * P6-8 differential pins. `tensordotRange` replaces two copies that had drifted (`Array.from` axes
 * and core strides in `parallel`, a direct `Set` and worker strides in the worker). Both are kept
 * verbatim in `fixtures/tensordot-legacy-kernel.ts`. Every case compares every bit of the output
 * (`Object.is`, so a changed accumulation order, a signed zero or a NaN shows) over several
 * `[outStart, outEnd)` ranges. Only `*` and `+` are involved, so the result does not depend on
 * the engine's `Math` implementation.
 */

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const tsdownCli = createRequire(import.meta.url).resolve('tsdown/run');
const workerScript = fileURLToPath(new URL('../dist/worker.js', import.meta.url));

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixed magnitudes, so the order of the additions changes the rounded sum. */
function randomTensor(shape: readonly number[], seed: number): Float64Array {
  const rand = mulberry32(seed);
  const n = shape.reduce((p, d) => p * d, 1);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (rand() - 0.5) * 10 ** Math.floor(rand() * 7 - 3);
  return out;
}

interface Case {
  name: string;
  aShape: number[];
  bShape: number[];
  axesA: number[];
  axesB: number[];
  resultShape: number[];
}

const CASES: Case[] = [
  {
    name: 'rank-3 by rank-2, last axis against first',
    aShape: [2, 3, 4],
    bShape: [4, 5],
    axesA: [2],
    axesB: [0],
    resultShape: [2, 3, 5],
  },
  {
    name: 'two contracted axes, permuted pairing, not adjacent',
    aShape: [3, 4, 5],
    bShape: [5, 2, 3],
    axesA: [2, 0],
    axesB: [0, 2],
    resultShape: [4, 2],
  },
  {
    name: 'contracted axis first in both operands',
    aShape: [4, 3],
    bShape: [4, 2, 2],
    axesA: [0],
    axesB: [0],
    resultShape: [3, 2, 2],
  },
  {
    name: 'full contraction to a scalar',
    aShape: [3, 4],
    bShape: [3, 4],
    axesA: [0, 1],
    axesB: [0, 1],
    resultShape: [],
  },
  {
    name: 'dot product of two vectors',
    aShape: [37],
    bShape: [37],
    axesA: [0],
    axesB: [0],
    resultShape: [],
  },
  {
    name: 'outer product (no contracted axis)',
    aShape: [2, 3],
    bShape: [4],
    axesA: [],
    axesB: [],
    resultShape: [2, 3, 4],
  },
  {
    name: 'middle axis of a against the last axis of b',
    aShape: [2, 5, 3],
    bShape: [3, 4, 5],
    axesA: [1, 2],
    axesB: [2, 0],
    resultShape: [2, 4],
  },
  {
    name: 'zero-length contracted axis sums to +0',
    aShape: [2, 0],
    bShape: [0, 3],
    axesA: [1],
    axesB: [0],
    resultShape: [2, 3],
  },
  {
    name: 'zero-length free axis yields an empty result',
    aShape: [0, 3],
    bShape: [3, 2],
    axesA: [1],
    axesB: [0],
    resultShape: [0, 2],
  },
];

function rangesFor(total: number): [number, number][] {
  const out: [number, number][] = [[0, total]];
  if (total > 1) {
    out.push([0, 1], [total - 1, total], [1, total], [0, total - 1]);
    const mid = Math.floor(total / 2);
    out.push([0, mid], [mid, total], [Math.min(3, total - 1), Math.min(11, total)]);
  }
  return out;
}

function expectSameBits(got: Float64Array, want: Float64Array, label: string): void {
  expect(got.length, `${label}: length`).toBe(want.length);
  for (let i = 0; i < want.length; i++) {
    if (!Object.is(got[i], want[i])) {
      throw new Error(`${label}: element ${i} is ${got[i]}, expected ${want[i]}`);
    }
  }
}

describe('tensordotRange against the two kernels it replaced (P6-8)', () => {
  CASES.forEach((c, k) => {
    it(`${c.name}: bit-identical to both legacy kernels on every range`, () => {
      const a = randomTensor(c.aShape, 0x1000 + k);
      const b = randomTensor(c.bShape, 0x2000 + k);
      const total = c.resultShape.reduce((p, d) => p * d, 1);
      for (const [s, e] of rangesFor(total)) {
        const label = `${c.name} [${s}, ${e})`;
        const got = tensordotRange(a, c.aShape, b, c.bShape, c.axesA, c.axesB, c.resultShape, s, e);
        const viaParallel = legacyParallelKernel(
          a,
          c.aShape,
          b,
          c.bShape,
          c.axesA,
          c.axesB,
          c.resultShape,
          s,
          e
        );
        const viaWorker = new Float64Array(
          legacyWorkerKernel(
            a.slice().buffer,
            c.aShape,
            b.slice().buffer,
            c.bShape,
            c.axesA,
            c.axesB,
            c.resultShape,
            s,
            e
          )
        );
        expectSameBits(got, viaParallel, `${label} vs parallel kernel`);
        expectSameBits(got, viaWorker, `${label} vs worker kernel`);
        expect(got.length).toBe(e - s);
      }
    });
  });

  it('the cases are not all trivially zero (the differential can fail)', () => {
    const c = CASES[0];
    const a = randomTensor(c.aShape, 1);
    const b = randomTensor(c.bShape, 2);
    const got = tensordotRange(a, c.aShape, b, c.bShape, c.axesA, c.axesB, c.resultShape, 0, 30);
    expect(got.every((x) => x !== 0 && Number.isFinite(x))).toBe(true);
    expect(new Set(got).size).toBe(30);
  });

  it('accepts readonly axes without copying them and does not mutate them', () => {
    const axesA = Object.freeze([2]) as readonly number[];
    const axesB = Object.freeze([0]) as readonly number[];
    const a = randomTensor([2, 3, 4], 5);
    const b = randomTensor([4, 5], 6);
    const got = tensordotRange(a, [2, 3, 4], b, [4, 5], axesA, axesB, [2, 3, 5], 0, 30);
    const want = legacyParallelKernel(a, [2, 3, 4], b, [4, 5], [2], [0], [2, 3, 5], 0, 30);
    expectSameBits(got, want, 'readonly axes');
    expect(axesA).toEqual([2]);
    expect(axesB).toEqual([0]);
  });

  it('returns a fresh buffer of exactly (outEnd - outStart) doubles', () => {
    const c = CASES[0];
    const a = randomTensor(c.aShape, 7);
    const b = randomTensor(c.bShape, 8);
    const got = tensordotRange(a, c.aShape, b, c.bShape, c.axesA, c.axesB, c.resultShape, 4, 13);
    expect(got.buffer.byteLength).toBe(9 * 8);
    expect(got.byteOffset).toBe(0);
    expect(got.buffer).not.toBe(a.buffer);
    expect(got.buffer).not.toBe(b.buffer);
  });
});

describe('worker `tensordotChunk` handler returns what the legacy handler did (P6-8)', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    if (!existsSync(workerScript)) {
      execFileSync(
        process.execPath,
        [tsdownCli, 'src/worker.ts', '--format', 'esm', '--no-clean'],
        {
          cwd: pkgRoot,
          stdio: 'ignore',
        }
      );
    }
    pool = new MathWorkerPool({ maxWorkers: 1, parallelThreshold: 1_000_000 });
    await pool.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool?.terminate(true);
  });

  CASES.forEach((c, k) => {
    it(`${c.name}: a real worker returns the legacy handler's bytes`, async () => {
      const a = randomTensor(c.aShape, 0x3000 + k);
      const b = randomTensor(c.bShape, 0x4000 + k);
      const total = c.resultShape.reduce((p, d) => p * d, 1);
      for (const [s, e] of [rangesFor(total)[0], rangesFor(total).at(-1)!]) {
        const out = await pool.exec<ArrayBuffer>('tensordotChunk', [
          a.slice().buffer,
          c.aShape,
          b.slice().buffer,
          c.bShape,
          c.axesA,
          c.axesB,
          c.resultShape,
          s,
          e,
        ]);
        expect(out.byteLength).toBe((e - s) * 8);
        const want = new Float64Array(
          legacyWorkerKernel(
            a.slice().buffer,
            c.aShape,
            b.slice().buffer,
            c.bShape,
            c.axesA,
            c.axesB,
            c.resultShape,
            s,
            e
          )
        );
        expectSameBits(new Float64Array(out), want, `${c.name} [${s}, ${e}) from the worker`);
      }
    });
  });
});
