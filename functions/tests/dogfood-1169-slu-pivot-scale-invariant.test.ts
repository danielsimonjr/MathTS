/**
 * Dogfood #1169 (review) - the pivot search of slu does not depend on the scale of the matrix.
 *
 * csLu compared the candidates of a column with `larger`, whose tolerance is absolute. For a
 * matrix near 1e-100 every candidate tied with the first, so the first row became the pivot,
 * even when its entry was 1e-10 times the largest one. With the threshold 1 (partial pivoting)
 * no entry of L may then exceed 1. The same loss of scale made the diagonal preference of a
 * threshold below 1 take any non-zero diagonal entry.
 */
import { describe, it, expect } from 'vitest';
import { slu as sluFn, sparse } from '../src/factories/index.js';

type Sparse = { toArray(): number[][] };
type Slu = { L: Sparse; U: Sparse; p: number[]; q: number[] | null };
const slu = sluFn as (a: unknown, order: number, threshold: number) => Slu;

/** The largest absolute entry of L below the diagonal. */
function largestMultiplier(L: Sparse): number {
  let big = 0;
  L.toArray().forEach((row, i) =>
    row.forEach((v, j) => {
      if (j < i) big = Math.max(big, Math.abs(v));
    })
  );
  return big;
}

describe('#1169 slu pivot search is scale invariant', () => {
  for (const s of [1, 1e-14, 1e-100, 1e-300, 1e100]) {
    it(`partial pivoting keeps |L| <= 1 at scale ${s}`, () => {
      const A = [
        [1e-10 * s, 1 * s],
        [1 * s, 1 * s],
      ];
      const f = slu(sparse(A), 0, 1);
      expect(largestMultiplier(f.L)).toBeLessThanOrEqual(1);
    });
  }

  for (const s of [1, 1e-100]) {
    it(`a larger candidate wins over a small diagonal entry when the threshold is 0.5 (scale ${s})`, () => {
      // column 0: diagonal entry 1e-10*s against 1*s; the threshold 0.5 forbids the diagonal
      const A = [
        [1e-10 * s, 2 * s, 0],
        [1 * s, 1 * s, 3 * s],
        [0, 1 * s, 1 * s],
      ];
      const f = slu(sparse(A), 0, 0.5);
      expect(largestMultiplier(f.L)).toBeLessThanOrEqual(1);
    });
  }
});
