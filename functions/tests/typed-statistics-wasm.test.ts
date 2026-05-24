/**
 * Tests for WASM-sort-accelerated statistics functions — Slice 5.7b.
 *
 * Covers:
 *   - `parallelStatQuantile` — WASM sort kicks in above WASM_SORT_THRESHOLD.
 *   - `parallelStatPercentile` — thin wrapper, correct scale conversion.
 *   - `parallelStatMedian` — WASM sort path for large arrays.
 *
 * Strategy:
 * - Small arrays (below threshold): results must match known values.
 * - Large arrays (above threshold): dispatch through WASM sort and compare
 *   to small-array reference implementations.
 * - NaN handling: NaN-containing arrays should not corrupt statistics.
 */

import { describe, it, expect } from 'vitest';
import {
  parallelStatQuantile,
  parallelStatPercentile,
  parallelStatMedian,
} from '../src/typed/statistics.js';
import { WASM_SORT_THRESHOLD } from '../src/wasm/sort/wasm-bridge.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSeqF64(n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = i + 1;
  return out;
}

function makeRandomF64(n: number, seed = 0): Float64Array {
  let s = seed >>> 0;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    out[i] = ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  }
  return out;
}

/** Naïve reference quantile (JS sort). */
function refQuantile(data: Float64Array, q: number): number {
  const sorted = Array.from(data).sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - (pos - lower)) + sorted[upper] * (pos - lower);
}

// ---------------------------------------------------------------------------
// 1. parallelStatQuantile — small arrays (JS path)
// ---------------------------------------------------------------------------

describe('parallelStatQuantile (below threshold)', () => {
  it('median (q=0.5) of [1,2,3,4,5] is 3', () => {
    const data = new Float64Array([1, 2, 3, 4, 5]);
    expect(parallelStatQuantile(data, 0.5)).toBe(3);
  });

  it('q=0 returns minimum', () => {
    const data = new Float64Array([7, 2, 9, 1, 5]);
    expect(parallelStatQuantile(data, 0)).toBe(1);
  });

  it('q=1 returns maximum', () => {
    const data = new Float64Array([7, 2, 9, 1, 5]);
    expect(parallelStatQuantile(data, 1)).toBe(9);
  });

  it('q=0.25 on 1..10 returns 3.25', () => {
    const data = makeSeqF64(10);
    const q = parallelStatQuantile(data, 0.25) as number;
    expect(q).toBeCloseTo(3.25, 10);
  });

  it('throws for q outside [0,1]', () => {
    const data = new Float64Array([1, 2, 3]);
    expect(() => parallelStatQuantile(data, -0.1)).toThrow();
    expect(() => parallelStatQuantile(data, 1.1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. parallelStatQuantile — large arrays (WASM sort path)
// ---------------------------------------------------------------------------

describe('parallelStatQuantile (above threshold)', () => {
  it('q=0.5 on large sequential array matches reference', () => {
    const n = WASM_SORT_THRESHOLD + 100;
    const data = makeSeqF64(n); // already sorted
    const q = parallelStatQuantile(data, 0.5) as number;
    const ref = refQuantile(data, 0.5);
    expect(q).toBeCloseTo(ref, 8);
  });

  it('q=0.75 on large random array matches JS reference', () => {
    const n = WASM_SORT_THRESHOLD + 256;
    const data = makeRandomF64(n, 31);
    const q = parallelStatQuantile(data, 0.75) as number;
    const ref = refQuantile(data, 0.75);
    expect(q).toBeCloseTo(ref, 8);
  });

  it('q=0 on large array returns minimum', () => {
    const n = WASM_SORT_THRESHOLD + 50;
    const data = makeRandomF64(n, 17);
    const min = Math.min(...data);
    const q = parallelStatQuantile(data, 0) as number;
    expect(q).toBe(min);
  });
});

// ---------------------------------------------------------------------------
// 3. parallelStatPercentile
// ---------------------------------------------------------------------------

describe('parallelStatPercentile', () => {
  it('p=50 equals q=0.5 quantile', () => {
    const data = makeSeqF64(20);
    const p50 = parallelStatPercentile(data, 50);
    const q50 = parallelStatQuantile(data, 0.5) as number;
    expect(p50).toBe(q50);
  });

  it('p=0 returns minimum', () => {
    const data = new Float64Array([9, 3, 7, 1, 5]);
    expect(parallelStatPercentile(data, 0)).toBe(1);
  });

  it('p=100 returns maximum', () => {
    const data = new Float64Array([9, 3, 7, 1, 5]);
    expect(parallelStatPercentile(data, 100)).toBe(9);
  });

  it('throws for p outside [0,100]', () => {
    const data = new Float64Array([1, 2, 3]);
    expect(() => parallelStatPercentile(data, -1)).toThrow();
    expect(() => parallelStatPercentile(data, 101)).toThrow();
  });

  it('p=90 on large array matches reference', () => {
    const n = WASM_SORT_THRESHOLD + 128;
    const data = makeRandomF64(n, 99);
    const p90 = parallelStatPercentile(data, 90);
    const ref = refQuantile(data, 0.9);
    expect(p90).toBeCloseTo(ref, 8);
  });
});

// ---------------------------------------------------------------------------
// 4. parallelStatMedian (WASM sort path)
// ---------------------------------------------------------------------------

describe('parallelStatMedian (above threshold)', () => {
  it('median of odd-length large sequential array is centre value', async () => {
    const n = WASM_SORT_THRESHOLD + 1; // odd
    const data = makeSeqF64(n);
    const med = await parallelStatMedian(data);
    expect(med).toBeCloseTo((n + 1) / 2, 8);
  });

  it('median of large random array matches JS reference', async () => {
    const n = WASM_SORT_THRESHOLD + 50;
    const data = makeRandomF64(n, 77);
    const med = (await parallelStatMedian(data)) as number;
    const ref = refQuantile(data, 0.5);
    expect(med).toBeCloseTo(ref, 8);
  });
});
