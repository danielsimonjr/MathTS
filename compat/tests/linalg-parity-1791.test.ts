import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);
const { eigs, fraction } = math;

describe('linalg mathjs 15.3 parity (#1791)', () => {
  it('det uses Bareiss semantics on dense arrays', () => {
    expect(
      math.det([
        [1, 2],
        [3, 4],
      ])
    ).toBe(-2);
    expect(math.det([[]])).toBe(1);
  });

  it('qr rejects sparse matrices', () => {
    expect(() =>
      math.qr(
        math.sparse([
          [1, 0],
          [0, 1],
        ] as unknown as number[][])
      )
    ).toThrow(/sparse/);
  });

  it('pinv arity matches mathjs', () => {
    expect(() => (math.pinv as (...a: unknown[]) => unknown)()).toThrow(/Too few/);
    expect(() => (math.pinv as (...a: unknown[]) => unknown)(1, 2)).toThrow(/Too many/);
  });

  it('expm square-matrix error message matches mathjs', () => {
    expect(() => math.expm([[1, 2, 3]])).toThrow(/Matrix must be square/);
  });
  it('defective 2×2 fromWeb returns one eigenvector', () => {
    const fromWeb = eigs([
      [-2, 1],
      [-1, 0],
    ]);
    expect(fromWeb.eigenvectors).toHaveLength(1);
  });

  it('supports fractions in the matrix', () => {
    const M = [
      [fraction(1, 2), 0],
      [0, fraction(1, 3)],
    ];
    const result = eigs(M);
    expect(result.values).toHaveLength(2);
  });
});
