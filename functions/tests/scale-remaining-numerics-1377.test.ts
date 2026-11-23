import { describe, expect, it } from 'vitest';
import {
  bartlettTest,
  fitScalarParameters,
  gaussianProcessRegression,
  lasso,
  monteCarloIntegrate,
  projectVector,
  propagateUncertainty,
  reflectVector,
  scalar,
} from '../src/index.js';

describe('#1377 numerical routines at extreme scales', () => {
  it('does not discard a small predictor in LASSO', () => {
    const x = [-2, -1, 1, 2];
    for (const unit of [1e-200, 1e200]) {
      const { coefficients, intercept } = lasso(
        x.map((v) => [unit * v]),
        x.map((v) => 3 + 2 * v),
        0
      );
      expect(coefficients[0] * unit).toBeCloseTo(2, 12);
      expect(intercept).toBeCloseTo(3, 12);
    }
  });

  it('scales the Monte Carlo sample variance in both directions', () => {
    const bounds = [[0, 1] as const];
    const opts = { n: 1000, seed: 1377 };
    const base = monteCarloIntegrate(([x]) => x, bounds, opts);
    expect(base.estimate).toBeCloseTo(0.5, 1);
    for (const unit of [1e-200, 1e200]) {
      let calls = 0;
      const result = monteCarloIntegrate(
        ([x]) => {
          calls++;
          return unit * x;
        },
        bounds,
        opts
      );
      expect(calls).toBe(opts.n);
      expect(result.estimate / unit).toBeCloseTo(base.estimate, 13);
      expect(result.stderr / unit).toBeCloseTo(base.stderr, 13);
    }
  });

  it('keeps the analytic independent standard deviation finite', () => {
    for (const unit of [1e-200, 1e200]) {
      const result = propagateUncertainty('x + y', { x: 1, y: 2 }, { x: 3 * unit, y: 4 * unit });
      expect(result.sigma / unit).toBeCloseTo(5, 12);
    }
  });

  it('takes the covariance square root before rescaling to input units', () => {
    for (const unit of [1e-200, 1e200]) {
      const result = propagateUncertainty(
        ({ x, y }) => unit * (3 * x + 4 * y),
        { x: 0, y: 0 },
        undefined,
        {
          covariance: [
            [1, 0],
            [0, 1],
          ],
        }
      );
      expect(result.sigma / unit).toBeCloseTo(5, 12);
    }
  });

  it.each(['rbf', 'matern32', 'matern52'] as const)(
    '%s kernel is invariant to coordinate units',
    (kernel) => {
      const x = [[-1], [0], [1]];
      const y = [1, 3, 2];
      const query = [[-0.5], [0.5]];
      const base = gaussianProcessRegression(x, y, { kernel, lengthScale: 1, noise: 0.2 }).predict(
        query
      );
      for (const unit of [1e-200, 1e200]) {
        const rescale = (rows: number[][]) => rows.map(([v]) => [unit * v]);
        const predicted = gaussianProcessRegression(rescale(x), y, {
          kernel,
          lengthScale: unit,
          noise: 0.2,
        }).predict(rescale(query));
        for (let i = 0; i < query.length; i++) {
          expect(predicted.mean[i]).toBeCloseTo(base.mean[i], 13);
          expect(predicted.variance[i]).toBeCloseTo(base.variance[i], 13);
        }
      }
    }
  );

  it('solves a badly scaled affine least-squares problem and its standard errors', () => {
    const model = scalar.op('+', [
      scalar.symbol('a'),
      scalar.op('*', [scalar.symbol('b'), scalar.symbol('x')]),
    ]);
    const unit = 1e-100;
    const fit = fitScalarParameters(
      model,
      [Float64Array.of(0, unit, 2 * unit, 3 * unit)],
      Float64Array.of(1, 2, 2, 3),
      ['x'],
      { parameters: ['a', 'b'], restarts: 0 }
    );
    expect(fit.parameters[0]).toBeCloseTo(1.1, 9);
    expect(fit.parameters[1] * unit).toBeCloseTo(0.6, 9);
    expect(fit.standardErrors?.[0]).toBeCloseTo(Math.sqrt(0.07), 9);
    expect(fit.standardErrors![1] * unit).toBeCloseTo(Math.sqrt(0.02), 9);
  });

  it('projects and reflects without squaring unscaled normal components', () => {
    const v = [6e200, 8e200];
    for (const unit of [1e-200, 1e200]) {
      expect(projectVector(v, [unit, 0])).toEqual([6e200, 0]);
      expect(reflectVector(v, [unit, 0])).toEqual([-6e200, 8e200]);
    }
    expect(projectVector([1e200, 2e-200], [0, 1e-200])).toEqual([0, 2e-200]);
  });

  it('keeps the small Bartlett statistic of nearly equal variances', () => {
    const stretch = 1 + 1e-7;
    // 60-digit evaluation of Bartlett's formula using the exact input doubles.
    const expected = 1.599999841868387e-14;
    const { statistic } = bartlettTest([
      [-1, 0, 1],
      [-stretch, 0, stretch],
    ]);
    expect(Math.abs(statistic / expected - 1)).toBeLessThan(5e-9);
  });
});
