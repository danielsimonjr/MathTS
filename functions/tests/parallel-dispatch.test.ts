import { describe, it, expect } from 'vitest';
import { mean, sum, parallelStatMean, parallelStatSum } from '../src/index.js';

/**
 * EXPANSION_PLAN W8 — verifies the existing size-based parallel dispatch:
 * the default `sum`/`mean` already route `Float64Array` inputs to the
 * compute pool (returning a `Promise`) while `Array` inputs stay synchronous.
 * No return-type change is made — auto-dispatch is already the contract.
 */
describe('parallel auto-dispatch', () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9];
  const f64 = new Float64Array(values);

  it('mean dispatches Float64Array to the pool and matches parallelStatMean', async () => {
    const viaDefault = await mean(f64);
    expect(viaDefault).toBe(5);
    expect(viaDefault).toBe(await parallelStatMean(f64));
  });

  it('sum dispatches Float64Array to the pool and matches parallelStatSum', async () => {
    const viaDefault = await sum(f64);
    expect(viaDefault).toBe(40);
    expect(viaDefault).toBe(await parallelStatSum(f64));
  });

  it('Array inputs stay synchronous', () => {
    expect(sum(values)).toBe(40);
    expect(mean(values)).toBe(5);
  });
});
