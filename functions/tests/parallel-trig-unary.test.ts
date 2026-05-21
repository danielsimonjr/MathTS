/**
 * Correctness tests: parallel Float64Array overloads vs scalar for
 * trigonometric unary functions added in this sprint.
 *
 * Pattern follows special.test.ts: initialize computePool, lower the threshold
 * so the worker path is exercised, assert element-wise match against the scalar
 * overload, then restore defaults.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  csc,
  sec,
  cot,
  asin,
  acos,
  atan,
  asinh,
  acosh,
  atanh,
} from '../src/typed/trigonometry.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

describe('Parallel Float64Array overloads — trigonometry unary', () => {
  beforeAll(async () => {
    await computePool.initialize();
    // Lower threshold to ensure the worker path is exercised.
    computePool.updateConfig({ thresholdElements: 64, chunkSize: 256 });
  });

  afterAll(async () => {
    computePool.updateConfig({ thresholdElements: 50000, chunkSize: 10000 });
    await computePool.terminate();
  });

  // A sample of indices checked element-wise against the scalar overload.
  const sample = [0, 1, 7, 49, 99, 173, 249];

  it('csc Float64Array matches scalar overload element-wise', async () => {
    // Avoid multiples of pi where sin(x) = 0 (csc undefined).
    const xs = Float64Array.from({ length: 250 }, (_, i) => 0.1 + i * 0.04);
    const result = await (csc(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(csc(xs[i]) as number, 12);
    }
  });

  it('sec Float64Array matches scalar overload element-wise', async () => {
    // Avoid multiples of pi/2 where cos(x) = 0 (sec undefined).
    const xs = Float64Array.from({ length: 250 }, (_, i) => 0.1 + i * 0.04);
    const result = await (sec(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(sec(xs[i]) as number, 12);
    }
  });

  it('cot Float64Array matches scalar overload element-wise', async () => {
    // Avoid multiples of pi where tan(x) = 0 (cot undefined).
    const xs = Float64Array.from({ length: 250 }, (_, i) => 0.1 + i * 0.04);
    const result = await (cot(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(cot(xs[i]) as number, 12);
    }
  });

  it('asin Float64Array matches scalar overload element-wise (domain [-1, 1])', async () => {
    // Stay within [-1, 1] so Math.asin returns real values.
    const xs = Float64Array.from({ length: 250 }, (_, i) => -1 + i * (2 / 249));
    const result = await (asin(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(Math.asin(xs[i]), 12);
    }
  });

  it('acos Float64Array matches scalar overload element-wise (domain [-1, 1])', async () => {
    // Stay within [-1, 1] so Math.acos returns real values.
    const xs = Float64Array.from({ length: 250 }, (_, i) => -1 + i * (2 / 249));
    const result = await (acos(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(Math.acos(xs[i]), 12);
    }
  });

  it('atan Float64Array matches scalar overload element-wise', async () => {
    const xs = Float64Array.from({ length: 250 }, (_, i) => -10 + i * 0.08);
    const result = await (atan(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(atan(xs[i]) as number, 12);
    }
  });

  it('asinh Float64Array matches scalar overload element-wise', async () => {
    const xs = Float64Array.from({ length: 250 }, (_, i) => -5 + i * 0.04);
    const result = await (asinh(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(asinh(xs[i]) as number, 12);
    }
  });

  it('acosh Float64Array matches scalar overload element-wise (domain [1, ∞))', async () => {
    // acosh is only real for x >= 1.
    const xs = Float64Array.from({ length: 250 }, (_, i) => 1 + i * 0.04);
    const result = await (acosh(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(acosh(xs[i]) as number, 12);
    }
  });

  it('atanh Float64Array matches scalar overload element-wise (domain (-1, 1))', async () => {
    // atanh is real for |x| < 1.
    const xs = Float64Array.from({ length: 250 }, (_, i) => -0.99 + i * (1.98 / 249));
    const result = await (atanh(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(atanh(xs[i]) as number, 12);
    }
  });
});
