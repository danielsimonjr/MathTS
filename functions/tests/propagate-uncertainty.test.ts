/**
 * First-order uncertainty propagation.
 *
 * The independent-input numbers match the delta-method example used by UPT:
 * f = x*y at (2, 3) with σx = 0.1, σy = 0.2 → value 6, partials {x: 3, y: 2}, σ = 0.5.
 */

import { describe, it, expect } from 'vitest';
import { propagateUncertainty } from '../src/numeric/propagate-uncertainty.js';
import { propagateUncertainty as exported } from '../src/index.js';

describe('propagateUncertainty', () => {
  it('propagates independent uncertainties through a product', () => {
    const result = propagateUncertainty('x * y', { x: 2, y: 3 }, { x: 0.1, y: 0.2 });
    expect(result.value).toBe(6);
    expect(result.partials).toEqual({ x: 3, y: 2 });
    expect(result.sigma).toBeCloseTo(0.5, 12);
  });

  it('uses a covariance matrix in values-key order', () => {
    const result = propagateUncertainty('x * y', { x: 2, y: 3 }, undefined, {
      covariance: [
        [0.01, 0.01],
        [0.01, 0.04],
      ],
    });
    expect(result.value).toBe(6);
    expect(result.partials).toEqual({ x: 3, y: 2 });
    expect(result.sigma).toBeCloseTo(Math.sqrt(0.37), 12);
  });

  it('treats a missing sigma as zero and ignores keys in insertion order', () => {
    const result = propagateUncertainty('x * y', { x: 2, y: 3 }, { x: 0.1 });
    expect(result.sigma).toBeCloseTo(0.3, 12);
    expect(Object.keys(result.partials)).toEqual(['x', 'y']);
  });

  it('differentiates a nonlinear expression', () => {
    const result = propagateUncertainty('x ^ 2', { x: 3 }, { x: 0.1 });
    expect(result.value).toBe(9);
    expect(result.partials.x).toBeCloseTo(6, 12);
    expect(result.sigma).toBeCloseTo(0.6, 12);
  });

  it('differentiates through a built-in function', () => {
    const result = propagateUncertainty('sin(x)', { x: 0 }, { x: 0.1 });
    expect(result.value).toBeCloseTo(0, 12);
    expect(result.partials.x).toBeCloseTo(1, 12);
    expect(result.sigma).toBeCloseTo(0.1, 12);
  });

  it('returns zero uncertainty for a constant', () => {
    const result = propagateUncertainty('2 + pi', {});
    expect(result.value).toBeCloseTo(2 + Math.PI, 12);
    expect(result.sigma).toBe(0);
    expect(result.partials).toEqual({});
  });

  it('rejects sigmas and covariance together', () => {
    expect(() =>
      propagateUncertainty(
        'x',
        { x: 1 },
        { x: 0.1 },
        {
          covariance: [[0.01]],
        }
      )
    ).toThrow(/not both/);
  });

  it('rejects a negative sigma, a foreign sigma key, and a bad covariance', () => {
    expect(() => propagateUncertainty('x', { x: 1 }, { x: -0.1 })).toThrow(RangeError);
    expect(() => propagateUncertainty('x', { x: 1 }, { y: 0.1 })).toThrow(/no matching value/);
    expect(() =>
      propagateUncertainty('x * y', { x: 1, y: 2 }, undefined, {
        covariance: [[0.1]],
      })
    ).toThrow(/2×2/);
    expect(() => propagateUncertainty('x', { x: 1 }, undefined, { covariance: [[-1]] })).toThrow(
      /negative variance/
    );
  });

  it('is the function exported from the package entry', () => {
    expect(exported).toBe(propagateUncertainty);
  });
});
