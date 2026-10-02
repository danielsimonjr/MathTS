/**
 * Symplectic Gauss–Legendre 4th-order ODE integrator.
 *
 * The Butcher tableau is pinned to the same constants UPT uses
 * (Hairer/Lubich/Wanner §II.1; Sanz-Serna 1988).
 */

import { describe, it, expect } from 'vitest';
import {
  GL4_A,
  GL4_B,
  GL4_C,
  GL4ConvergenceError,
  gaussLegendre4,
} from '../src/numeric/gauss-legendre4.js';
import { gaussQuad } from '../src/typed/integration.js';

const SQRT3_OVER_6 = Math.sqrt(3) / 6;

describe('gaussLegendre4 Butcher tableau', () => {
  it('matches the 2-stage Gauss–Legendre nodes, matrix, and weights', () => {
    expect(GL4_C[0]).toBeCloseTo(0.5 - SQRT3_OVER_6, 15);
    expect(GL4_C[1]).toBeCloseTo(0.5 + SQRT3_OVER_6, 15);
    expect(GL4_A[0][0]).toBeCloseTo(0.25, 15);
    expect(GL4_A[0][1]).toBeCloseTo(0.25 - SQRT3_OVER_6, 15);
    expect(GL4_A[1][0]).toBeCloseTo(0.25 + SQRT3_OVER_6, 15);
    expect(GL4_A[1][1]).toBeCloseTo(0.25, 15);
    expect(GL4_B[0]).toBe(0.5);
    expect(GL4_B[1]).toBe(0.5);
  });

  it('satisfies the Sanz-Serna symplecticity condition and the row-sum condition', () => {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const lhs = GL4_B[i] * GL4_A[i][j] + GL4_B[j] * GL4_A[j][i];
        const rhs = GL4_B[i] * GL4_B[j];
        expect(lhs).toBeCloseTo(rhs, 15);
      }
      expect(GL4_A[i][0] + GL4_A[i][1]).toBeCloseTo(GL4_C[i], 15);
    }
  });

  it('is a different function from gaussQuad', () => {
    expect(gaussLegendre4).not.toBe(gaussQuad);
  });
});

function harmonic(t: number, y: readonly number[]): number[] {
  void t;
  return [y[1], -y[0]];
}

function finalError(steps: number): number {
  const sol = gaussLegendre4(harmonic, [1, 0], [0, 1], { steps });
  const q = Math.cos(1);
  const p = -Math.sin(1);
  const last = sol.y[sol.y.length - 1];
  return Math.max(Math.abs(last[0] - q), Math.abs(last[1] - p));
}

describe('gaussLegendre4 integration', () => {
  it('integrates the harmonic oscillator at order 4', () => {
    const coarse = finalError(16);
    const fine = finalError(64);
    // h shrinks by 4; a 4th-order method shrinks the global error by ~256.
    expect(fine).toBeLessThan(1e-8);
    expect(coarse / fine).toBeGreaterThan(64);
  });

  it('keeps harmonic-oscillator energy bounded over many periods', () => {
    const sol = gaussLegendre4(harmonic, [1, 0], [0, 40 * Math.PI], { steps: 800 });
    const energy = (y: readonly number[]) => 0.5 * (y[0] * y[0] + y[1] * y[1]);
    const e0 = energy(sol.y[0]);
    let maxDrift = 0;
    for (const y of sol.y) {
      maxDrift = Math.max(maxDrift, Math.abs(energy(y) - e0));
    }
    expect(maxDrift).toBeLessThan(1e-6);
    const last = sol.y[sol.y.length - 1];
    // 20 periods later the state is back near the start. The phase error is
    // the method's O(h^4) accumulation; the energy bound above is the
    // symplectic claim.
    expect(Math.abs(last[0] - 1)).toBeLessThan(1e-3);
    expect(Math.abs(last[1])).toBeLessThan(1e-3);
  });

  it('integrates y′ = −y to e^{−1}', () => {
    const sol = gaussLegendre4((_t, y) => [-y[0]], [1], [0, 1], { steps: 20 });
    expect(sol.t).toHaveLength(21);
    expect(sol.t[0]).toBe(0);
    expect(sol.t[20]).toBeCloseTo(1, 12);
    expect(sol.y[20][0]).toBeCloseTo(Math.exp(-1), 8);
  });

  it('integrates backward in time', () => {
    const sol = gaussLegendre4((_t, y) => [y[0]], [1], [0, -1], { h: 0.05 });
    const last = sol.y[sol.y.length - 1];
    expect(sol.t[sol.t.length - 1]).toBeCloseTo(-1, 12);
    expect(last[0]).toBeCloseTo(Math.exp(-1), 8);
  });

  it('returns the initial state when the span is empty', () => {
    const sol = gaussLegendre4(harmonic, [1, 0], [2, 2]);
    expect(sol.t).toEqual([2]);
    expect(sol.y).toEqual([[1, 0]]);
  });

  it('throws GL4ConvergenceError when Picard does not contract', () => {
    expect(() =>
      gaussLegendre4((_t, y) => [-1e6 * y[0]], [1], [0, 1], {
        steps: 1,
        picardMaxIter: 5,
        picardTol: 1e-14,
      })
    ).toThrowError(GL4ConvergenceError);
    expect(() =>
      gaussLegendre4((_t, y) => [-1e6 * y[0]], [1], [0, 1], {
        steps: 1,
        picardMaxIter: 5,
      })
    ).toThrowError(/Picard iteration did not converge/);
  });

  it('rejects an empty state, a bad step count, and a short derivative', () => {
    expect(() => gaussLegendre4(harmonic, [], [0, 1])).toThrow(TypeError);
    expect(() => gaussLegendre4(harmonic, [1, 0], [0, 1], { steps: 0 })).toThrow(TypeError);
    expect(() => gaussLegendre4(() => [1], [1, 0], [0, 1], { steps: 1 })).toThrow(
      /vector of length 2/
    );
  });
});
