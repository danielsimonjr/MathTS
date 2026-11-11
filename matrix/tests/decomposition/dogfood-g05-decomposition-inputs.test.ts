/**
 * Dogfood relay G05 — decomposition input types (#704, #705).
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { lu, luSolve, svd } from '../../src/operations/index.js';

/** NumPy reference: np.linalg.svd([[1,2],[3,4]], compute_uv=False) */
const NUMPY_S_2X2 = [5.464985704077139, 0.3659661906282276];

describe('G05 #704 — svd accepts DenseMatrix', () => {
  it('matches nested-array singular values (NumPy oracle)', () => {
    const nested = svd([
      [1, 2],
      [3, 4],
    ]);
    const packed = svd(new DenseMatrix(2, 2, [1, 2, 3, 4]));
    expect(packed.S[0]).toBeCloseTo(nested.S[0], 12);
    expect(packed.S[1]).toBeCloseTo(nested.S[1], 12);
    expect(packed.S[0]).toBeCloseTo(NUMPY_S_2X2[0], 9);
    expect(packed.S[1]).toBeCloseTo(NUMPY_S_2X2[1], 9);
    expect(packed.S[0]).toBeCloseTo(5.4649857, 8);
    expect(packed.rank).toBe(2);
    expect(packed.U.length).toBe(2);
    expect(packed.V.length).toBe(2);
  });

  it('rejects unknown objects instead of returning rank 0', () => {
    expect(() => svd({ rows: 2, cols: 2 } as unknown as number[][])).toThrow(TypeError);
  });
});

describe('G05 #705 — lu accepts nested arrays', () => {
  it('exact repro: lu([[4,1],[1,3]]) does not throw', () => {
    expect(() =>
      lu([
        [4, 1],
        [1, 3],
      ])
    ).not.toThrow();
  });

  it('matches DenseMatrix lu path', () => {
    const nested = lu([
      [4, 1],
      [1, 3],
    ]);
    const dense = lu(new DenseMatrix(2, 2, [4, 1, 1, 3]));
    expect(luSolve(nested, [1, 2])).toEqual(luSolve(dense, [1, 2]));
  });
});
