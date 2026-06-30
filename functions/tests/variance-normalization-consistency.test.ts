import { describe, it, expect } from 'vitest';
import {
  variance,
  std,
  parallelStatVariance,
  parallelStatStd,
} from '@danielsimonjr/mathts-functions';

/**
 * GC1 — variance/std normalization consistency guard.
 *
 * Before this fix, plain `variance`/`std` defaulted to POPULATION (÷n) while
 * `parallelStatVariance`/`parallelStatStd` defaulted to SAMPLE/unbiased (÷(n-1)),
 * so switching to the parallel variant silently changed the statistical answer.
 * mathjs's default is unbiased, so the plain variants are aligned to that and
 * given the same `normalization` parameter. This test pins them equal so the
 * divergence cannot silently reappear.
 */
describe('GC1: variance/std normalization consistency', () => {
  const data = [1, 2, 3, 4, 5, 8, 13, 21];
  const f64 = new Float64Array(data);

  it('plain variance defaults to unbiased (mathjs parity)', () => {
    // [1,2,3,4]: mean=2.5, sum of squared deviations m2=5; unbiased=5/3
    expect(variance([1, 2, 3, 4])).toBeCloseTo(5 / 3, 10);
  });

  it('plain std defaults to unbiased', () => {
    expect(std([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5 / 3), 10);
  });

  it("'uncorrected' normalization gives population variance/std", () => {
    expect(variance([1, 2, 3, 4], 'uncorrected')).toBeCloseTo(1.25, 10);
    expect(std([1, 2, 3, 4], 'uncorrected')).toBeCloseTo(Math.sqrt(1.25), 10);
  });

  it("'biased' normalization divides by n+1", () => {
    // m2=5, n=4 → 5/5 = 1
    expect(variance([1, 2, 3, 4], 'biased')).toBeCloseTo(1.0, 10);
  });

  it('plain variance (default) matches parallelStatVariance (default)', async () => {
    expect(variance(data)).toBeCloseTo(await parallelStatVariance(f64), 10);
  });

  it('plain std (default) matches parallelStatStd (default)', async () => {
    expect(std(data)).toBeCloseTo(await parallelStatStd(f64), 10);
  });

  it('Array and Float64Array paths agree for every normalization', async () => {
    for (const norm of ['unbiased', 'uncorrected', 'biased'] as const) {
      expect(variance(data, norm)).toBeCloseTo((await variance(f64, norm)) as number, 10);
      expect(std(data, norm)).toBeCloseTo((await std(f64, norm)) as number, 10);
    }
  });

  it('single-element unbiased variance is 0 (mathjs parity), not NaN', () => {
    expect(variance([5])).toBe(0);
    expect(std([5])).toBe(0);
  });

  it('empty array stays NaN', () => {
    expect(variance([])).toBeNaN();
    expect(std([])).toBeNaN();
  });
});
