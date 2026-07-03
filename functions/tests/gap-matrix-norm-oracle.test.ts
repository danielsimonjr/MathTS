import { describe, it, expect } from 'vitest';

import { norm } from '../src/typed/arithmetic.js';
import { matrix } from '../src/factories/index.js';

/**
 * The public typed `norm` had no matrix support: `norm(matrix, 2)` returned
 * `null`, `norm(matrix, 'fro')` threw, because a 2-D operand fell through to the
 * flat-vector path. Matrix norms added: Frobenius (`'fro'` / default), 1 (max
 * column sum), ∞ (max row sum), 2 (spectral = largest singular value). Oracles
 * are exact hand-computed values.
 */

const nm = norm as (x: unknown, p?: unknown) => number;

describe('norm — matrix (DenseMatrix + 2-D Array)', () => {
  const A = matrix([
    [3, 0],
    [0, 4],
  ]); // singular values {4,3}

  it("Frobenius: norm(diag(3,4), 'fro') = 5", () => {
    expect(nm(A, 'fro')).toBeCloseTo(5, 12);
  });

  it('default (no p) = Frobenius', () => {
    expect(nm(A)).toBeCloseTo(5, 12);
  });

  it('spectral 2-norm = largest singular value = 4', () => {
    expect(nm(A, 2)).toBeCloseTo(4, 9);
  });

  it('1-norm = max column sum', () => {
    // [[1,2],[3,4]] column sums 4, 6 → 6
    expect(
      nm(
        matrix([
          [1, 2],
          [3, 4],
        ]),
        1
      )
    ).toBeCloseTo(6, 12);
  });

  it('∞-norm = max row sum', () => {
    // [[1,2],[3,4]] row sums 3, 7 → 7
    expect(
      nm(
        matrix([
          [1, 2],
          [3, 4],
        ]),
        Infinity
      )
    ).toBeCloseTo(7, 12);
  });

  it('2-D plain array is a matrix norm too', () => {
    expect(
      nm(
        [
          [1, 2],
          [3, 4],
        ],
        'fro'
      )
    ).toBeCloseTo(Math.sqrt(30), 12);
  });

  it('1-D vector norm still works (regression)', () => {
    expect(nm([3, 4])).toBeCloseTo(5, 12);
    expect(nm([3, 4], 1)).toBeCloseTo(7, 12);
  });
});
