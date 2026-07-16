import { describe, it, expect } from 'vitest';
import { nnls, lsqBounded } from '../src/index.js';

describe('nnls (non-negative least squares)', () => {
  it('nnls(I, [3,-2]) clamps the negative -> [3,0]', () => {
    const r = nnls(
      [
        [1, 0],
        [0, 1],
      ],
      [3, -2]
    );
    expect(r.x[0]).toBeCloseTo(3, 6);
    expect(r.x[1]).toBeCloseTo(0, 6);
  });
  it('nnls(I, [3,5]) unconstrained -> [3,5]', () => {
    const r = nnls(
      [
        [1, 0],
        [0, 1],
      ],
      [3, 5]
    );
    expect(r.x[0]).toBeCloseTo(3, 6);
    expect(r.x[1]).toBeCloseTo(5, 6);
  });
  it('all solution components are non-negative', () => {
    const r = nnls(
      [
        [1, -1],
        [1, 1],
        [0, 1],
      ],
      [-1, 2, -3]
    );
    expect(r.x.every((v) => v >= -1e-9)).toBe(true);
  });
});

describe('lsqBounded', () => {
  it('box-constrained: [5,-3] on [0,2]^2 -> [2,0]', () => {
    const r = lsqBounded(
      [
        [1, 0],
        [0, 1],
      ],
      [5, -3],
      [0, 0],
      [2, 2]
    );
    expect(r.x[0]).toBeCloseTo(2, 4);
    expect(r.x[1]).toBeCloseTo(0, 4);
  });
});
