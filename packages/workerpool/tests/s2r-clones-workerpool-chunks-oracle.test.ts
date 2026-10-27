/**
 * Sprint 2R clone-merge batch 2 (G61–G64) — independent oracles for workerpool
 * chunking, map/filter dispatch, and multi-index iteration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { MathWorkerPool, chunkTyped, chunkPairTyped, forEachMultiIndex } from '../src/index.js';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const tsdownCli = createRequire(import.meta.url).resolve('tsdown/run');
const workerScript = fileURLToPath(new URL('../dist/worker.js', import.meta.url));

/** Test-only access to private chunk helpers (TS `private` is compile-time only). */
type ChunkTestSurface = {
  chunkFloat64Array(data: Float64Array, size?: number): Float64Array[];
  chunkInt32Array(data: Int32Array, size?: number): Int32Array[];
  chunkPairFloat64Array(
    a: Float64Array,
    b: Float64Array,
    size?: number
  ): [Float64Array, Float64Array][];
  chunkPairInt32Array(a: Int32Array, b: Int32Array, size?: number): [Int32Array, Int32Array][];
};

function asChunkTestSurface(pool: MathWorkerPool): ChunkTestSurface {
  // One deliberate partial mock choke point for private method access in tests.
  return pool as unknown as ChunkTestSurface;
}

function forEachMultiIndexOracle(sizes: readonly number[], cb: (idx: number[]) => void): void {
  const rank = sizes.length;
  if (rank === 0) {
    cb([]);
    return;
  }
  const idx = new Array<number>(rank).fill(0);
  const total = sizes.reduce((a, b) => a * b, 1);
  for (let n = 0; n < total; n++) {
    cb(idx.slice());
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      if (idx[d] < sizes[d]) break;
      idx[d] = 0;
    }
  }
}

describe('S2R workerpool batch2 — map/filter (G61 oracle)', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    if (!existsSync(workerScript)) {
      execFileSync(
        process.execPath,
        [tsdownCli, 'src/worker.ts', '--format', 'esm', '--no-clean'],
        { cwd: pkgRoot, stdio: 'ignore' }
      );
    }
    pool = new MathWorkerPool({ maxWorkers: 2, parallelThreshold: 8, chunkSize: 3 });
    await pool.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool?.terminate();
  });

  const mapOracle = (data: number[]) => data.map((x) => x + 1);
  const filterOracle = (data: number[]) => data.filter((x) => x > 0);

  it('map x=>x+1 below threshold (sequential)', async () => {
    const data = [0, 1, 2, 3, 4, 5, 6];
    const r = await pool.map(data, (x) => x + 1);
    expect(r.parallelized).toBe(false);
    expect(r.result).toEqual(mapOracle(data));
  });

  it('map x=>x+1 above threshold (parallel)', async () => {
    const data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const r = await pool.map(data, (x) => x + 1, { forceParallel: true });
    expect(r.parallelized).toBe(true);
    expect(r.result).toEqual(mapOracle(data));
  });

  it('map on empty input', async () => {
    const r = await pool.map([], (x) => x + 1);
    expect(r.result).toEqual([]);
    expect(r.parallelized).toBe(false);
  });

  it('filter x=>x>0 below threshold', async () => {
    const data = [-2, 0, 1, 3];
    const r = await pool.filter(data, (x) => x > 0);
    expect(r.parallelized).toBe(false);
    expect(r.result).toEqual(filterOracle(data));
  });

  it('filter x=>x>0 above threshold (parallel)', async () => {
    const data = [-3, -1, 0, 1, 2, 3, 4, 5, 6, 7];
    const r = await pool.filter(data, (x) => x > 0, { forceParallel: true });
    expect(r.parallelized).toBe(true);
    expect(r.result).toEqual(filterOracle(data));
  });

  it('filter on empty input', async () => {
    const r = await pool.filter([], (x) => x > 0);
    expect(r.result).toEqual([]);
    expect(r.parallelized).toBe(false);
  });
});

describe('S2R workerpool batch2 — typed chunking (G62 oracle)', () => {
  it('Float64 length 5 chunk 2 → three owned slices', () => {
    const pool = new MathWorkerPool({ chunkSize: 2 });
    const surface = asChunkTestSurface(pool);
    const data = Float64Array.from([1, 2, 3, 4, 5]);
    const chunks = chunkTyped(data, 2);
    expect(chunks).toEqual(surface.chunkFloat64Array(data, 2));
    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(2);
    expect(chunks[1].length).toBe(2);
    expect(chunks[2].length).toBe(1);
    expect(chunks[1].byteLength).toBe(16);
    expect(chunks[1].buffer).not.toBe(data.buffer);
  });

  it('Int32 chunks use slice-owned buffers', () => {
    const pool = new MathWorkerPool({ chunkSize: 2 });
    const surface = asChunkTestSurface(pool);
    const data = Int32Array.from([10, 20, 30]);
    const chunks = chunkTyped(data, 2);
    expect(chunks).toEqual(surface.chunkInt32Array(data, 2));
    expect(chunks.length).toBe(2);
    expect(chunks[1].byteLength).toBe(4);
    expect(chunks[1].buffer).not.toBe(data.buffer);
  });
});

describe('S2R workerpool batch2 — pair chunking (G63 oracle)', () => {
  it('pair chunks equal length; last chunk may be short; b aligned to a', () => {
    const pool = new MathWorkerPool({ chunkSize: 2 });
    const surface = asChunkTestSurface(pool);
    const a = Float64Array.from([1, 2, 3, 4, 5]);
    const b = Float64Array.from([10, 20, 30, 40, 50]);
    const pairs = chunkPairTyped(a, b, 2);
    expect(pairs).toEqual(surface.chunkPairFloat64Array(a, b, 2));
    expect(pairs.length).toBe(3);
    for (const [ca, cb] of pairs) {
      expect(ca.length).toBe(cb.length);
    }
    expect(pairs[2][0].length).toBe(1);
    expect(pairs[2][1][0]).toBe(50);
    expect(pairs[1][0][0]).toBe(3);
    expect(pairs[1][1][0]).toBe(30);
  });

  it('Int32 pair chunks match Float64 pair shape', () => {
    const pool = new MathWorkerPool({ chunkSize: 3 });
    const surface = asChunkTestSurface(pool);
    const a = Int32Array.from([1, 2, 3, 4]);
    const b = Int32Array.from([5, 6, 7, 8]);
    const pairs = chunkPairTyped(a, b, 3);
    expect(pairs).toEqual(surface.chunkPairInt32Array(a, b, 3));
    expect(pairs.length).toBe(2);
    expect(pairs[0][0].length).toBe(3);
    expect(pairs[1][0].length).toBe(1);
    expect(pairs[1][1][0]).toBe(8);
  });
});

describe('S2R workerpool batch2 — multi-index (G64 oracle)', () => {
  it('rank 0 calls cb([]) once', () => {
    const visits: number[][] = [];
    forEachMultiIndex([], (idx) => visits.push(idx));
    expect(visits).toEqual([[]]);
    const oracleVisits: number[][] = [];
    forEachMultiIndexOracle([], (idx) => oracleVisits.push(idx));
    expect(visits).toEqual(oracleVisits);
  });

  it('sizes [2,2] visits 4 indices in row-major order', () => {
    const visits: number[][] = [];
    forEachMultiIndex([2, 2], (idx) => visits.push(idx));
    const oracleVisits: number[][] = [];
    forEachMultiIndexOracle([2, 2], (idx) => oracleVisits.push(idx));
    expect(visits).toEqual(oracleVisits);
    expect(visits).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });
});
