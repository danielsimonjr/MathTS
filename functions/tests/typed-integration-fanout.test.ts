/**
 * Tests for the worker fan-out of parallelGaussQuad / parallelRomberg, and for the
 * synchronous gaussQuad / romberg that refuse workerCount > 1.
 *
 * These tests cover:
 *  1. Single-worker path produces identical results to no-option path.
 *  2. Multi-worker correctness: ∫₀^π sin(x) dx ≈ 2 within 1e-9.
 *  3. Multi-worker correctness: ∫₀^1 x² dx ≈ 1/3 within 1e-9.
 *  4. Closure that references an outer-scope variable is rejected.
 *  5. Async closure is rejected.
 *  6. workerCount set but totalPoints < GAUSS_WORKER_THRESHOLD falls back to
 *     in-process path (no error, correct result).
 *  7–8. validateClosureSource edge cases (arrow / classic function forms).
 *  9. romberg fan-out correctness.
 * 10. Arrow-function form stringifies and dispatches correctly.
 */

import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  gaussQuad,
  romberg,
  parallelGaussQuad,
  parallelRomberg,
  validateClosureSource,
  GAUSS_WORKER_THRESHOLD,
} from '../src/typed/integration.js';

beforeAll(async () => {
  await computePool.initialize();
  // Fail, do not skip: without a ready pool the fan-out tests prove nothing.
  expect(computePool.isReady()).toBe(true);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await computePool.terminate();
});

describe('gaussQuad / romberg are synchronous', () => {
  it('gaussQuad returns a number at every n', () => {
    expect(typeof gaussQuad(Math.sin, 0, Math.PI, 3)).toBe('number');
    expect(typeof gaussQuad(Math.sin, 0, Math.PI, GAUSS_WORKER_THRESHOLD)).toBe('number');
    expect(gaussQuad(Math.sin, 0, Math.PI, GAUSS_WORKER_THRESHOLD)).toBeCloseTo(2, 12);
  });

  it('romberg returns a number', () => {
    const r = romberg(Math.sin, 0, Math.PI);
    expect(typeof r).toBe('number');
    expect(r).toBeCloseTo(2, 10);
  });

  it('workerCount 1 is accepted and gives the default result', () => {
    const n = GAUSS_WORKER_THRESHOLD;
    expect(gaussQuad(Math.sin, 0, Math.PI, n, 5, { workerCount: 1 })).toBe(
      gaussQuad(Math.sin, 0, Math.PI, n)
    );
    expect(romberg(Math.sin, 0, Math.PI, 1e-12, { workerCount: 1 })).toBe(
      romberg(Math.sin, 0, Math.PI)
    );
  });

  it('workerCount > 1 throws a TypeError that names the parallel export', () => {
    expect(() => gaussQuad(Math.sin, 0, Math.PI, 64, 5, { workerCount: 4 })).toThrow(TypeError);
    expect(() => gaussQuad(Math.sin, 0, Math.PI, 64, 5, { workerCount: 4 })).toThrow(
      /parallelGaussQuad/
    );
    expect(() => romberg(Math.sin, 0, Math.PI, 1e-12, { workerCount: 2 })).toThrow(TypeError);
    expect(() => romberg(Math.sin, 0, Math.PI, 1e-12, { workerCount: 2 })).toThrow(
      /parallelRomberg/
    );
  });
});

describe('parallelGaussQuad / parallelRomberg — worker fan-out', () => {
  it('parallelGaussQuad workerCount=4 reaches the workers, integral of sin on [0, pi] = 2', async () => {
    const spy = vi.spyOn(computePool, 'integrateFanOut');
    spy.mockClear();
    const result = await parallelGaussQuad(
      (x) => Math.sin(x),
      0,
      Math.PI,
      GAUSS_WORKER_THRESHOLD,
      5,
      {
        workerCount: 4,
      }
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toBeCloseTo(2, 9);
  });

  it('parallelGaussQuad workerCount=4 integral of x^2 on [0, 1] = 1/3, terse arrow too', async () => {
    const n = GAUSS_WORKER_THRESHOLD;
    expect(await parallelGaussQuad((x) => x * x, 0, 1, n, 5, { workerCount: 4 })).toBeCloseTo(
      1 / 3,
      9
    );
    const f = (x: number) => x ** 2;
    expect(await parallelGaussQuad(f, 0, 1, n, 5, { workerCount: 2 })).toBeCloseTo(1 / 3, 9);
  });

  it('parallelGaussQuad rejects a closure that captures an outer-scope variable', async () => {
    // Not a literal initializer: Bun's runtime transpiler inlines a `const`
    // literal into the closure, so its source text would no longer name `scale`.
    const scale = Number('2');
    const f = (x: number) => scale * Math.sin(x);
    await expect(parallelGaussQuad(f, 0, 1, 64, 5, { workerCount: 4 })).rejects.toThrow(
      /outer-scope identifier.*scale/
    );
  });

  it('validateClosureSource rejects an async closure', () => {
    const asyncFn = async (x: number) => Math.sin(x);
    expect(() => validateClosureSource(asyncFn.toString())).toThrow(
      /async closures cannot be dispatched/
    );
  });

  it('parallelGaussQuad below the threshold gives the sync result without workers', async () => {
    const spy = vi.spyOn(computePool, 'integrateFanOut');
    spy.mockClear();
    // n=3 is single-interval mode; n=6, order 5 gives 30 points < 64.
    expect(await parallelGaussQuad((x) => x * x, 0, 1, 3, 5, { workerCount: 4 })).toBe(
      gaussQuad((x) => x * x, 0, 1, 3)
    );
    expect(await parallelGaussQuad((x) => x * x, 0, 1, 6, 5, { workerCount: 4 })).toBe(
      gaussQuad((x) => x * x, 0, 1, 6)
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('parallelGaussQuad workerCount 1 gives the sync result without workers', async () => {
    const spy = vi.spyOn(computePool, 'integrateFanOut');
    spy.mockClear();
    expect(await parallelGaussQuad((x) => Math.sin(x), 0, Math.PI, 64)).toBe(
      gaussQuad(Math.sin, 0, Math.PI, 64)
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('validateClosureSource accepts an arrow function and a function expression', () => {
    expect(() => validateClosureSource(((x: number) => x * x).toString())).not.toThrow();
    expect(() => validateClosureSource('function(x) { return Math.sin(x); }')).not.toThrow();
  });

  it('parallelRomberg workerCount=4 reaches the workers, integral of sin on [0, pi] = 2', async () => {
    const spy = vi.spyOn(computePool, 'integrateFanOut');
    spy.mockClear();
    const result = await parallelRomberg((x) => Math.sin(x), 0, Math.PI, 1e-12, { workerCount: 4 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toBeCloseTo(2, 9);
  });

  it('parallelRomberg workerCount 1 gives the sync result without workers', async () => {
    const spy = vi.spyOn(computePool, 'integrateFanOut');
    spy.mockClear();
    expect(await parallelRomberg((x) => 1 / x, 1, 2)).toBe(romberg((x) => 1 / x, 1, 2));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('validateClosureSource — unit tests', () => {
  it('accepts Math.sin, Math.cos, Math.PI', () => {
    expect(() => validateClosureSource('(x) => Math.sin(x) + Math.PI')).not.toThrow();
  });

  it('accepts nested arithmetic with Math constants', () => {
    expect(() =>
      validateClosureSource('(x) => Math.exp(-x * x) / Math.sqrt(2 * Math.PI)')
    ).not.toThrow();
  });

  it('rejects identifier that is not a param or allowed global', () => {
    const badSrc = '(x) => myHelperFn(x)';
    expect(() => validateClosureSource(badSrc)).toThrow(/outer-scope identifier.*myHelperFn/);
  });

  it('rejects async arrow function', () => {
    expect(() => validateClosureSource('async (x) => x')).toThrow(/async closures/);
  });
});
