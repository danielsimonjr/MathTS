import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);
const { eigs, fraction } = math;

describe('eigs mathjs 15.3 parity (#1791)', () => {
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