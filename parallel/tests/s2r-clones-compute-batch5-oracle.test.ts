/**
 * Sprint 2R clone-merge batch 5 (G64–G67) — independent oracles for ComputePool
 * dot/distance, bitwise ops, and multi-index iteration (via workerpool export).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { forEachMultiIndex } from '@danielsimonjr/mathts-workerpool';
import { ComputePool } from '../src/index.js';

/** Independent row-major cartesian product (not the odometer loop). */
function rowMajorCartesian(sizes: readonly number[]): number[][] {
  if (sizes.length === 0) return [[]];
  const head = sizes[0];
  const tails = rowMajorCartesian(sizes.slice(1));
  const out: number[][] = [];
  for (let i = 0; i < head; i++) {
    for (const t of tails) out.push([i, ...t]);
  }
  return out;
}

function collectIndices(sizes: readonly number[]): number[][] {
  const visits: number[][] = [];
  forEachMultiIndex(sizes, (idx) => visits.push(idx));
  return visits;
}

describe('S2R parallel batch5 — multi-index (G64 oracle)', () => {
  it('rank 0 calls cb([]) once', () => {
    expect(collectIndices([])).toEqual([[]]);
    expect(collectIndices([])).toEqual(rowMajorCartesian([]));
  });

  it('sizes [2,2] visits 4 indices in row-major order', () => {
    const visits = collectIndices([2, 2]);
    expect(visits).toEqual(rowMajorCartesian([2, 2]));
    expect(visits).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });
});

describe('S2R parallel batch5 — dot/distance (G65 oracle)', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool();
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate();
  });

  it('[3,4]·[3,4] = 25; identical vectors distance 0', async () => {
    const a = new Float64Array([3, 4]);
    const b = new Float64Array([3, 4]);
    expect((await pool.dot(a, b)).result).toBe(25);
    expect((await pool.dot(a, b)).parallelized).toBe(false);
    expect((await pool.distance(a, b)).result).toBe(0);
    expect((await pool.distance(a, b)).parallelized).toBe(false);
  });

  it('length mismatch messages stay exact', async () => {
    const a = new Float64Array([1, 2, 3]);
    const b = new Float64Array([1, 2]);
    await expect(pool.dot(a, b)).rejects.toThrow('dot: vectors must have the same length');
    await expect(pool.distance(a, b)).rejects.toThrow(
      'distance: vectors must have the same length'
    );
  });

  it('large n stays sequential (dot/distance thresholds never)', async () => {
    const big = new Float64Array(200_000).fill(1);
    expect((await pool.dot(big, big)).parallelized).toBe(false);
    expect((await pool.distance(big, big)).parallelized).toBe(false);
  });
});

describe('S2R parallel batch5 — bitwise binary (G66 oracle)', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool();
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate();
  });

  it('bitAnd/bitOr/bitXor exact values', async () => {
    const a = new Int32Array([0b1100, 0b1010]);
    const b = new Int32Array([0b1010, 0b0110]);
    expect(Array.from((await pool.bitAnd(a, b)).result)).toEqual([0b1000, 0b0010]);
    expect(Array.from((await pool.bitOr(a, b)).result)).toEqual([0b1110, 0b1110]);
    expect(Array.from((await pool.bitXor(a, b)).result)).toEqual([0b0110, 0b1100]);
  });

  it('length mismatch throws Array lengths must match', async () => {
    const a = new Int32Array([1, 2, 3]);
    const b = new Int32Array([1, 2]);
    await expect(pool.bitAnd(a, b)).rejects.toThrow('Array lengths must match');
  });

  it('large n stays sequential (bitwise never)', async () => {
    const big = new Int32Array(200_000).fill(7);
    expect((await pool.bitAnd(big, big)).parallelized).toBe(false);
  });
});

describe('S2R parallel batch5 — bitwise shifts (G67 oracle)', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool();
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate();
  });

  it('scalar << 2', async () => {
    const a = new Int32Array([1, 2, 3]);
    expect(Array.from((await pool.leftShift(a, 2)).result)).toEqual([4, 8, 12]);
    expect((await pool.leftShift(a, 2)).parallelized).toBe(false);
  });

  it('arithmetic >> of a negative (scalar)', async () => {
    const a = new Int32Array([-8]);
    expect(Array.from((await pool.rightArithShift(a, 2)).result)).toEqual([-2]);
  });

  it('logical >>> stored as int32 (scalar and array)', async () => {
    const scalar = new Int32Array([-1]);
    expect(Array.from((await pool.rightLogShift(scalar, 1)).result)).toEqual([0x7fffffff]);
    const arr = new Int32Array([-1, -8]);
    expect(Array.from((await pool.rightLogShift(arr, 1)).result)).toEqual([0x7fffffff, 0x7ffffffc]);
  });

  it('large n stays sequential for leftShift scalar', async () => {
    expect((await pool.leftShift(new Int32Array(200_000), 1)).parallelized).toBe(false);
  });
});
