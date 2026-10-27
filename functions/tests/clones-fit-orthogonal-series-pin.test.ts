/**
 * Sprint 2R clone-merge: `chebyshevFit` / `legendreFit` in interpolation.ts.
 * Independent oracles (closed-form T_n / P_n, literal coefficients, exact errors).
 * Errors compared by Error class + message string — not `toThrow(new Error(...))`.
 */
import { describe, it, expect } from 'vitest';
import { chebyshevFit, legendreFit } from '../src/typed/interpolation.js';
import { WASM_POLY_FIT_THRESHOLD } from '../src/wasm/poly/wasm-bridge.js';

function expectError(fn: () => unknown, message: string): void {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Error);
  const err = thrown as Error;
  expect(err.name).toBe('Error');
  expect(err.message).toBe(message);
}

describe('clone pin — orthogonal-series fit (JS path, below WASM threshold)', () => {
  it('chebyshevFit recovers T₂ coefficients [0, 0, 1] on three nodes', () => {
    const xs = [-1, 0, 1];
    const ys = xs.map((x) => 2 * x * x - 1);
    expect(xs.length).toBeLessThan(WASM_POLY_FIT_THRESHOLD);
    expect(chebyshevFit(xs, ys, 2)).toEqual([0, 0, 1]);
  });

  it('legendreFit recovers P₂ coefficients [0, 0, 1] on three nodes', () => {
    const xs = [-1, 0, 1];
    const ys = xs.map((x) => (3 * x * x - 1) / 2);
    expect(xs.length).toBeLessThan(WASM_POLY_FIT_THRESHOLD);
    expect(legendreFit(xs, ys, 2)).toEqual([0, 0, 1]);
  });

  it('chebyshevFit recovers T₀ + ½ T₁ exactly on four nodes', () => {
    const xs = [-1, -0.5, 0.5, 1];
    const ys = xs.map((x) => 1 + 0.5 * x);
    expect(xs.length).toBeLessThan(WASM_POLY_FIT_THRESHOLD);
    expect(chebyshevFit(xs, ys, 1)).toEqual([1, 0.5]);
  });

  it('legendreFit recovers literal P₀ + P₁ on two nodes', () => {
    const xs = [-1, 1];
    const ys = [2, 4];
    expect(xs.length).toBeLessThan(WASM_POLY_FIT_THRESHOLD);
    expect(legendreFit(xs, ys, 1)).toEqual([3, 1]);
  });
});

describe('clone pin — orthogonal-series fit errors and under-determined inputs', () => {
  it('chebyshevFit throws when fewer points than degree + 1', () => {
    expectError(
      () => chebyshevFit([0, 1], [1, 2], 2),
      'chebyshevFit requires more data points than polynomial degree'
    );
  });

  it('legendreFit throws when fewer points than degree + 1', () => {
    expectError(
      () => legendreFit([0, 1], [1, 2], 2),
      'legendreFit requires more data points than polynomial degree'
    );
  });

  it('chebyshevFit throws rank-deficient wrapper message on collinear xs', () => {
    const xs = [0.5, 0.5, 0.5];
    const ys = [1, 2, 3];
    expectError(() => chebyshevFit(xs, ys, 2), 'chebyshevFit: rank-deficient system');
  });

  it('legendreFit throws rank-deficient wrapper message on collinear xs', () => {
    const xs = [0.5, 0.5, 0.5];
    const ys = [1, 2, 3];
    expectError(() => legendreFit(xs, ys, 2), 'legendreFit: rank-deficient system');
  });
});
