/**
 * Dogfood #688 — lusolve must not return a silent particular solution on singular
 * or non-finite systems (NumPy LinAlgError / mathjs singular message parity).
 */
import { describe, expect, it } from 'vitest';
import { inv, lusolve } from '../src/factories/index.js';
import { linsolve } from '../src/typed/numeric.js';
import { LUSOLVE_SINGULAR_MESSAGE } from '../src/algebra/solver/pivot-tolerance.js';

const singularRe = /singular/i;

describe('#688 lusolve singular / non-finite', () => {
  const A = [
    [1, 2],
    [2, 4],
  ];
  const bConsistent = [1, 2];
  const bInconsistent = [1, 1];

  it('consistent rank-deficient system throws (not [1,0])', () => {
    expect(() => lusolve(A, bConsistent)).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('inconsistent singular system still throws', () => {
    expect(() => lusolve(A, bInconsistent)).toThrow(singularRe);
  });

  it('linsolve on the same consistent system throws singular', () => {
    expect(() => linsolve(A, bConsistent)).toThrow(/linsolve: singular matrix/);
  });

  it('NaN coefficients throw before returning a vector', () => {
    expect(() => lusolve([[NaN, 1], [0, 1]], [1, 1])).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('Infinity coefficients throw', () => {
    expect(() => lusolve([[Infinity, 1], [0, 1]], [1, 1])).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('well-conditioned 2×2 still solves', () => {
    const x = lusolve(
      [
        [4, 3],
        [6, 3],
      ],
      [10, 12]
    ) as number[][];
    expect(x[0][0]).toBeCloseTo(1, 12);
    expect(x[1][0]).toBeCloseTo(2, 12);
  });

  it('inv rejects the same singular matrix', () => {
    expect(() => inv(A)).toThrow(/determinant is zero/);
  });
});
