import { describe, it, expect } from 'vitest';
import { mean, sum, parallelStatMean, parallelStatSum } from '../src/index.js';

/**
 * EXPANSION_PLAN W8 — verifies the default `sum`/`mean` on `Float64Array`
 * are synchronous and match the worker-pool variants `parallelStatMean` and
 * `parallelStatSum`, which return a Promise. `Array` inputs stay synchronous.
 */
describe('parallel auto-dispatch', () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9];
  const f64 = new Float64Array(values);

  it('default mean on Float64Array is synchronous and matches parallelStatMean', async () => {
    const viaDefault = mean(f64);
    expect(viaDefault).toBe(5);
    expect(viaDefault).toBe(await parallelStatMean(f64));
  });

  it('default sum on Float64Array is synchronous and matches parallelStatSum', async () => {
    const viaDefault = sum(f64);
    expect(viaDefault).toBe(40);
    expect(viaDefault).toBe(await parallelStatSum(f64));
  });

  it('Array inputs stay synchronous', () => {
    expect(sum(values)).toBe(40);
    expect(mean(values)).toBe(5);
  });
});
