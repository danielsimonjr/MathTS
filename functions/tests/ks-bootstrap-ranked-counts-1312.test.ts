import { describe, expect, it } from 'vitest';
import { kolmogorovSmirnovTest } from '../src/typed/hypothesis.js';
import { erfcScalar } from '../src/typed/special.js';

describe('normal KS bootstrap from cached CDF values (#1312)', () => {
  it('matches seeded resampling with the equivalent explicit CDF, including ties', async () => {
    const sample = [-2, -1, -1, 0, 0, 2, 0.5, 1];
    const options = { bootstrap: 100, bootstrapSeed: 872 };
    const expected = await kolmogorovSmirnovTest(
      sample,
      (x) => 0.5 * erfcScalar(-x / Math.SQRT2),
      options
    );
    expect(await kolmogorovSmirnovTest(sample, 'normal', options)).toEqual(expected);
    expect(await kolmogorovSmirnovTest(sample, undefined, options)).toEqual(expected);
  });

  it('allows ten thousand bootstraps of a five-thousand-element sample', async () => {
    const sample = Array.from({ length: 5000 }, (_value, i) => Math.sin(i) * 3 + i / 2500);
    const result = await kolmogorovSmirnovTest(sample, undefined, {
      bootstrap: 10000,
      bootstrapSeed: 1,
    });
    if (!('bootstrapStatistics' in result)) throw new Error('Missing bootstrap result');
    expect(result.bootstrapStatistics).toHaveLength(10000);
    expect(Number.isFinite(result.bootstrapMean)).toBe(true);
  });
});
