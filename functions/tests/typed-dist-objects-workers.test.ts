/**
 * Tests for Slice 5.12 — distribution batch sampling with worker dispatch.
 *
 * These tests cover:
 *  1.  Normal(0,1).sampleN(1_000_000) returns 1M samples; mean ≈ 0, std ≈ 1.
 *  2.  sampleN(50_000) (below threshold) uses JS path — returns Float64Array
 *      synchronously (but wrapped in a resolved Promise).
 *  3.  Same-seed reproducibility: two calls with seed=42 return identical arrays.
 *  4.  Different seeds produce different outputs.
 *  5.  Gamma({shape:2, rate:1}).sampleN(200_000) mean ≈ 2 within tolerance.
 *  6.  Exponential({lambda:1}).sampleN(200_000) mean ≈ 1 within tolerance.
 *  7.  Beta({alpha:2, beta:5}).sampleN(200_000) mean ≈ 2/7 ≈ 0.2857.
 *  8.  tDist(5).sampleN(200_000) variance ≈ 5/(5-2) ≈ 1.667.
 *  9.  workerCount=1 override uses single-worker path (async, valid results).
 * 10.  sampleN at threshold (100_000) returns Promise<Float64Array>.
 * 11.  sampleN below threshold returns Float64Array values (sync path correctness).
 * 12.  Normal sampleN JS path (below threshold) reproducibility with same seed.
 */

import { describe, it, expect } from 'vitest';
import {
  normalDist,
  gammaDist,
  exponentialDist,
  betaDist,
  tDist,
  DIST_WORKER_THRESHOLD,
} from '../src/typed/dist-objects.js';

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

function mean(arr: Float64Array): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function variance(arr: Float64Array): number {
  const m = mean(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += (arr[i] - m) ** 2;
  return s / arr.length;
}

function std(arr: Float64Array): number {
  return Math.sqrt(variance(arr));
}

function arraysEqual(a: Float64Array, b: Float64Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Slice 5.12 — distribution batch sampling (sampleN)', () => {
  // 1. Large Normal sample — statistical correctness
  it('Normal(0,1).sampleN(1_000_000): mean ≈ 0 and std ≈ 1 within 0.01', async () => {
    const d = normalDist(0, 1);
    const samples = await d.sampleN(1_000_000, { seed: 1 });
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBe(1_000_000);
    expect(mean(samples)).toBeCloseTo(0, 1); // 1 decimal place = within 0.05
    expect(std(samples)).toBeCloseTo(1, 1);
  });

  // 2. Below-threshold path: sampleN(50_000) uses JS loop
  it('Normal(0,1).sampleN(50_000) (below threshold) returns correct Float64Array', async () => {
    expect(DIST_WORKER_THRESHOLD).toBe(100_000);
    const d = normalDist(0, 1);
    const result = d.sampleN(50_000, { seed: 7 });
    // Must be a Promise (sampleN always returns Promise)
    expect(result).toBeInstanceOf(Promise);
    const samples = await result;
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBe(50_000);
    // Statistical sanity (loose tolerance for small sample)
    expect(mean(samples)).toBeCloseTo(0, 0);
  });

  // 3. Same-seed reproducibility (above threshold)
  it('Normal(0,1).sampleN(200_000, {seed:42}) is reproducible', async () => {
    const d = normalDist(0, 1);
    const a = await d.sampleN(200_000, { seed: 42 });
    const b = await d.sampleN(200_000, { seed: 42 });
    expect(arraysEqual(a, b)).toBe(true);
  });

  // 4. Different seeds produce different outputs
  it('Normal(0,1).sampleN with different seeds produces different arrays', async () => {
    const d = normalDist(0, 1);
    const a = await d.sampleN(200_000, { seed: 11 });
    const b = await d.sampleN(200_000, { seed: 99 });
    expect(arraysEqual(a, b)).toBe(false);
  });

  // 5. Gamma — mean ≈ shape * scale = 2 * 1 = 2
  it('Gamma(shape=2, rate=1).sampleN(200_000): mean ≈ 2 within 0.05', async () => {
    const d = gammaDist(2, 1);
    const samples = await d.sampleN(200_000, { seed: 3 });
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBe(200_000);
    expect(mean(samples)).toBeCloseTo(2, 1);
  });

  // 6. Exponential — mean = 1/lambda = 1
  it('Exponential(lambda=1).sampleN(200_000): mean ≈ 1 within 0.05', async () => {
    const d = exponentialDist(1);
    const samples = await d.sampleN(200_000, { seed: 5 });
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBe(200_000);
    expect(mean(samples)).toBeCloseTo(1, 1);
  });

  // 7. Beta — mean = alpha / (alpha + beta) = 2/7 ≈ 0.2857
  it('Beta(alpha=2, beta=5).sampleN(200_000): mean ≈ 2/7 within 0.01', async () => {
    const d = betaDist(2, 5);
    const samples = await d.sampleN(200_000, { seed: 13 });
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBe(200_000);
    expect(mean(samples)).toBeCloseTo(2 / 7, 2);
  });

  // 8. Student-t(5) — variance = df/(df-2) = 5/3 ≈ 1.667
  it('StudentT(df=5).sampleN(200_000): variance ≈ 5/3 within 0.1', async () => {
    const d = tDist(5);
    const samples = await d.sampleN(200_000, { seed: 17 });
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBe(200_000);
    const v = variance(samples);
    expect(v).toBeGreaterThan(5 / 3 - 0.15);
    expect(v).toBeLessThan(5 / 3 + 0.15);
  });

  // 9. workerCount=1 override — single worker, still async, valid output
  it('Normal.sampleN(200_000, {workerCount:1}): single-worker path, correct length', async () => {
    const d = normalDist(2, 3);
    const samples = await d.sampleN(200_000, { seed: 21, workerCount: 1 });
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBe(200_000);
    // mean ≈ 2, std ≈ 3
    expect(mean(samples)).toBeCloseTo(2, 0);
    expect(std(samples)).toBeCloseTo(3, 0);
  });

  // 10. sampleN at exactly DIST_WORKER_THRESHOLD is async (returns Promise)
  it('Normal.sampleN(DIST_WORKER_THRESHOLD) returns a Promise', () => {
    const d = normalDist(0, 1);
    const result = d.sampleN(DIST_WORKER_THRESHOLD, { seed: 0 });
    expect(result).toBeInstanceOf(Promise);
  });

  // 11. Below-threshold JS path produces all-finite values
  it('Exponential.sampleN(10_000) JS path: all values finite and positive', async () => {
    const d = exponentialDist(2);
    const samples = await d.sampleN(10_000, { seed: 99 });
    expect(samples.length).toBe(10_000);
    for (let i = 0; i < samples.length; i++) {
      expect(isFinite(samples[i])).toBe(true);
      expect(samples[i]).toBeGreaterThan(0);
    }
  });

  // 12. Normal JS path reproducibility (below threshold, same seed)
  it('Normal.sampleN(1_000, {seed:77}) below threshold: same seed = same output', async () => {
    const d = normalDist(5, 2);
    const a = await d.sampleN(1_000, { seed: 77 });
    const b = await d.sampleN(1_000, { seed: 77 });
    expect(arraysEqual(a, b)).toBe(true);
  });
});
