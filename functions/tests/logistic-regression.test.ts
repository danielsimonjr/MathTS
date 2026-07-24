import { describe, it, expect } from 'vitest';
import { logisticRegression } from '../src/index.js';

describe('logisticRegression (IRLS)', () => {
  it('separable 1-D data -> positive slope, prob 0.5 at the boundary', () => {
    const X = [[-2], [-1], [1], [2]];
    const y = [0, 0, 1, 1];
    const m = logisticRegression(X, y);
    expect(m.coefficients[0]).toBeGreaterThan(0);
    expect(m.predictProba([[0]])[0]).toBeCloseTo(0.5, 1);
    expect(m.predict([[-3]])[0]).toBe(0);
    expect(m.predict([[3]])[0]).toBe(1);
  });
  it('2-D: predicts the correct class for clearly separated points', () => {
    const X = [
      [0, 0],
      [0.5, 0.5],
      [5, 5],
      [5.5, 5.5],
    ];
    const y = [0, 0, 1, 1];
    const m = logisticRegression(X, y);
    expect(m.predict([[0.2, 0.2]])[0]).toBe(0);
    expect(m.predict([[5.2, 5.2]])[0]).toBe(1);
  });
});
