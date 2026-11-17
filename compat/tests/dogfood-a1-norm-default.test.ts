/**
 * Dogfood #995 and #1082: the compat `norm` of a matrix.
 * The default p is 2, the spectral norm (largest singular value), as in mathjs 15.2.0.
 * Oracle: NumPy 2.3.5 singular values of [[-3,0],[0,1]] are [3, 1].
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const m = create(all) as unknown as {
  norm: (x: unknown, p?: unknown) => number;
  matrix: (x: unknown) => unknown;
};

describe('compat norm of a matrix (#995, #1082)', () => {
  it('the default norm of [[1,0],[0,2]] is the spectral norm 2', () => {
    expect(
      m.norm([
        [1, 0],
        [0, 2],
      ])
    ).toBeCloseTo(2, 12);
    expect(
      m.norm(
        m.matrix([
          [1, 0],
          [0, 2],
        ])
      )
    ).toBeCloseTo(2, 12);
  });
  it("norm(..., 'fro') stays the Frobenius norm sqrt(5)", () => {
    expect(
      m.norm(
        [
          [1, 0],
          [0, 2],
        ],
        'fro'
      )
    ).toBeCloseTo(Math.sqrt(5), 12);
  });
  it('norm([[-3,0],[0,1]], 2) is 3, not 9', () => {
    expect(
      m.norm(
        [
          [-3, 0],
          [0, 1],
        ],
        2
      )
    ).toBeCloseTo(3, 12);
    expect(
      m.norm([
        [-3, 0],
        [0, 1],
      ])
    ).toBeCloseTo(3, 12);
    expect(
      m.norm(
        m.matrix([
          [-3, 0],
          [0, 1],
        ])
      )
    ).toBeCloseTo(3, 12);
  });
});
