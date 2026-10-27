/**
 * Sprint 2R clone-merge: `chebyshevFit` / `legendreFit` in interpolation.ts.
 * Independent oracles (closed-form T_n / P_n, literal coefficients from
 * origin/main, exact errors). Errors compared by Error class + message string
 * — not `toThrow(new Error(...))`.
 *
 * origin/main length check: `xs.length !== ys.length || xs.length < degree + 1`.
 * Four error strings (git show origin/main:functions/src/typed/interpolation.ts):
 *   'chebyshevFit requires more data points than polynomial degree'
 *   'legendreFit requires more data points than polynomial degree'
 *   'chebyshevFit: rank-deficient system'
 *   'legendreFit: rank-deficient system'
 * WASM threshold literal: WASM_POLY_FIT_THRESHOLD = 1024.
 */
import { describe, it, expect } from 'vitest';
import * as interpolation from '../src/typed/interpolation.js';
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
  it('keeps origin/main WASM_POLY_FIT_THRESHOLD of 1024', () => {
    expect(WASM_POLY_FIT_THRESHOLD).toBe(1024);
  });

  it('does not export the shared fitOrthogonalSeries driver', () => {
    expect(Object.hasOwn(interpolation, 'fitOrthogonalSeries')).toBe(false);
    expect(typeof interpolation.chebyshevFit).toBe('function');
    expect(typeof interpolation.legendreFit).toBe('function');
  });

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

  it('accepts n === degree + 1 (length-check boundary) for T₁ and P₁', () => {
    const xs = [-1, 1];
    const ys = [-1, 1];
    expect(xs.length).toBe(1 + 1);
    expect(chebyshevFit(xs, ys, 1)).toEqual([0, 1]);
    expect(legendreFit(xs, ys, 1)).toEqual([0, 1]);
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

  it('chebyshevFit throws the same length-check string when xs and ys lengths differ', () => {
    expectError(
      () => chebyshevFit([0, 1, 2], [1, 2], 1),
      'chebyshevFit requires more data points than polynomial degree'
    );
  });

  it('legendreFit throws the same length-check string when xs and ys lengths differ', () => {
    expectError(
      () => legendreFit([0, 1, 2], [1, 2], 1),
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

describe('clone pin — orthogonal-series fit WASM-threshold branch (JS dispatch fallback)', () => {
  it('chebyshevFit at n = 1024 recovers T₂ via dispatch then Array.from', () => {
    const n = 1024;
    expect(n).toBe(WASM_POLY_FIT_THRESHOLD);
    const xs = Array.from({ length: n }, (_, i) => -1 + (2 * i) / (n - 1));
    const ys = xs.map((x) => 2 * x * x - 1);
    const coeffs = chebyshevFit(xs, ys, 2);
    expect(coeffs).toHaveLength(3);
    expect(coeffs[0]).toBeCloseTo(0, 10);
    expect(coeffs[1]).toBeCloseTo(0, 10);
    expect(coeffs[2]).toBeCloseTo(1, 10);
  });

  it('legendreFit at n = 1024 recovers P₂ via dispatch then Array.from', () => {
    const n = 1024;
    expect(n).toBe(WASM_POLY_FIT_THRESHOLD);
    const xs = Array.from({ length: n }, (_, i) => -1 + (2 * i) / (n - 1));
    const ys = xs.map((x) => (3 * x * x - 1) / 2);
    const coeffs = legendreFit(xs, ys, 2);
    expect(coeffs).toHaveLength(3);
    expect(coeffs[0]).toBeCloseTo(0, 10);
    expect(coeffs[1]).toBeCloseTo(0, 10);
    expect(coeffs[2]).toBeCloseTo(1, 10);
  });

  it('rank-deficient n ≥ 1024 falls through dispatch throw to the JS wrapper message', () => {
    const n = 1024;
    const xs = Array.from({ length: n }, () => 0.5);
    const ys = Array.from({ length: n }, (_, i) => i);
    expectError(() => chebyshevFit(xs, ys, 2), 'chebyshevFit: rank-deficient system');
    expectError(() => legendreFit(xs, ys, 2), 'legendreFit: rank-deficient system');
  });
});
