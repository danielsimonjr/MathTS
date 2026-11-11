/**
 * Dogfood #688 — lusolve must not return a silent particular solution on singular
 * or non-finite systems (NumPy LinAlgError / mathjs singular message parity).
 */
import { describe, expect, it } from 'vitest';
import {
  bignumber,
  inv,
  lusolve,
  matrix,
  sparse,
  usolve,
  usolveAll,
} from '../src/factories/index.js';
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
    expect(() =>
      lusolve(
        [
          [NaN, 1],
          [0, 1],
        ],
        [1, 1]
      )
    ).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('Infinity coefficients throw', () => {
    expect(() =>
      lusolve(
        [
          [Infinity, 1],
          [0, 1],
        ],
        [1, 1]
      )
    ).toThrow(LUSOLVE_SINGULAR_MESSAGE);
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

  it('a well-conditioned system scaled by 1e-8 still solves', () => {
    const s = 1e-8;
    const x = lusolve(
      [
        [4 * s, 3 * s],
        [6 * s, 3 * s],
      ],
      [10 * s, 12 * s]
    ) as number[][];
    expect(x[0][0]).toBeCloseTo(1, 8);
    expect(x[1][0]).toBeCloseTo(2, 8);
  });

  it('a well-conditioned system scaled by 1e8 still solves', () => {
    const s = 1e8;
    const x = lusolve(
      [
        [4 * s, 3 * s],
        [6 * s, 3 * s],
      ],
      [10 * s, 12 * s]
    ) as number[][];
    expect(x[0][0]).toBeCloseTo(1, 6);
    expect(x[1][0]).toBeCloseTo(2, 6);
  });

  it('a unit-scale near-singular matrix throws (pivot below 1e-15 · ||A||)', () => {
    expect(() =>
      lusolve(
        [
          [1, 1],
          [1, 1 + 1e-18],
        ],
        [1, 1]
      )
    ).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('a mildly ill-conditioned matrix above the relative floor still returns a vector', () => {
    const x = lusolve(
      [
        [1, 1],
        [1, 1 + 1e-8],
      ],
      [2, 2 + 1e-8]
    ) as number[][];
    expect(x).toHaveLength(2);
    expect(Number.isFinite(x[0][0])).toBe(true);
    expect(Number.isFinite(x[1][0])).toBe(true);
    expect(x[0][0] + x[1][0]).toBeCloseTo(2, 5);
  });

  it('DenseMatrix input matches the array path on the singular fixture', () => {
    expect(() => lusolve(matrix(A), bConsistent)).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('sparse consistent singular system throws', () => {
    expect(() => lusolve(sparse(A), bConsistent)).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('sparse inconsistent singular system throws', () => {
    expect(() => lusolve(sparse(A), bInconsistent)).toThrow(singularRe);
  });

  it('sparse well-conditioned system solves', () => {
    const x = lusolve(
      sparse([
        [4, 3],
        [6, 3],
      ]),
      [10, 12]
    ) as { valueOf(): number[][] };
    const rows = x.valueOf();
    expect(rows[0][0]).toBeCloseTo(1, 12);
    expect(rows[1][0]).toBeCloseTo(2, 12);
  });

  it('prefactored lup of a singular matrix still throws', () => {
    // Build U directly: the free-variable case is a zero diagonal and a zero RHS.
    const L = [
      [1, 0],
      [2, 1],
    ];
    const U = [
      [1, 2],
      [0, 0],
    ];
    expect(() => lusolve({ L, U, p: [0, 1] }, [1, 2])).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('direct usolve throws on an exact zero pivot even when the RHS is zero', () => {
    expect(() =>
      usolve(
        [
          [1, 2],
          [0, 0],
        ],
        [1, 0]
      )
    ).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('direct usolve of a tiny nonsingular diagonal with zero RHS returns zero', () => {
    const x = usolve(
      [
        [1e-20, 0],
        [0, 1e-20],
      ],
      [0, 0]
    ) as number[][];
    expect(x).toEqual([[0], [0]]);
  });

  it('usolveAll still reports the affine space of a singular upper triangle', () => {
    const solutions = usolveAll(
      [
        [1, 2],
        [0, 0],
      ],
      [1, 0]
    ) as unknown[];
    expect(solutions.length).toBeGreaterThan(1);
  });

  it('BigNumber lusolve of a well-conditioned system still solves', () => {
    const A2 = [
      [4, 3],
      [6, 3],
    ].map((row) => row.map((v) => bignumber(v)));
    const b2 = [10, 12].map((v) => bignumber(v));
    const x = lusolve(A2, b2) as { toString(): string }[][];
    expect(x[0][0].toString()).toBe('1');
    expect(x[1][0].toString()).toBe('2');
  });

  it('packed Float64Array singular system throws (G05 input)', () => {
    const packed = new Float64Array([1, 2, 2, 4]);
    expect(() => lusolve(packed, bConsistent)).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });

  it('packed Float64Array well-conditioned system solves', () => {
    const packed = new Float64Array([4, 3, 6, 3]);
    const x = lusolve(packed, [10, 12]) as number[][];
    expect(x[0][0]).toBeCloseTo(1, 12);
    expect(x[1][0]).toBeCloseTo(2, 12);
  });

  it('NaN off the diagonal throws', () => {
    expect(() =>
      lusolve(
        [
          [1, NaN],
          [0, 1],
        ],
        [1, 1]
      )
    ).toThrow(LUSOLVE_SINGULAR_MESSAGE);
  });
});
