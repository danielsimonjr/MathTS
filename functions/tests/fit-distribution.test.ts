import { describe, it, expect } from 'vitest';
import { fitDistribution } from '../src/index.js';

describe('fitDistribution (MLE)', () => {
  it('normal: mean=5, std=2', () => {
    const r = fitDistribution('normal', [2, 4, 4, 4, 5, 5, 7, 9]);
    expect(r.params.mean).toBeCloseTo(5, 6);
    expect(r.params.std).toBeCloseTo(2, 6);
  });
  it('exponential: rate = 1/mean', () => {
    const r = fitDistribution('exponential', [1, 2, 3, 2]);
    expect(r.params.lambda).toBeCloseTo(0.5, 6);
  });
  it('poisson: lambda = mean', () => {
    const r = fitDistribution('poisson', [2, 3, 4, 3]);
    expect(r.params.lambda).toBeCloseTo(3, 6);
  });
  it('gamma: positive shape/scale, mean recovered', () => {
    const r = fitDistribution('gamma', [1.2, 2.4, 0.8, 3.1, 1.9, 2.2, 1.5, 2.8, 1.1, 2.0]);
    expect(r.params.shape).toBeGreaterThan(0);
    expect(r.params.scale).toBeGreaterThan(0);
    expect(r.params.shape * r.params.scale).toBeCloseTo(1.9, 0);
  });
  it('returns a finite logLikelihood', () => {
    const r = fitDistribution('normal', [1, 2, 3, 4, 5]);
    expect(Number.isFinite(r.logLikelihood)).toBe(true);
  });
});
