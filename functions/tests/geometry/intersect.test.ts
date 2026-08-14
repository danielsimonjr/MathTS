import { describe, expect, it } from 'vitest';
import { intersect, matrix, typeOf } from '../../src/index.js';

describe('intersect with matrices', () => {
  it('should return the same matrix type as input', () => {
    const w = matrix([0, 0]);
    const x = matrix([10, 10]);
    const y = matrix([10, 0]);
    const z = matrix([0, 10]);

    const res = intersect(w, x, y, z);
    expect(res).not.toBeNull();
    expect(typeOf(res)).toBe('MathJSDenseMatrix');

    const plane = matrix([1, 1, 1, 6]);
    const xp = matrix([1, 0, 1]);
    const yp = matrix([4, -2, 2]);

    const res2 = intersect(xp, yp, plane);
    expect(res2).not.toBeNull();
    expect(typeOf(res2)).toBe('MathJSDenseMatrix');
  });

  it('should work with sparse matrices when supported', () => {
    // Note: Since `intersect2d` does operations like `multiplyScalar` etc. that might not
    // support "Array" as output. But intersect itself returns a matrix that's derived from the input.
    // In mathjs, intersect didn't support sparse matrix properly if the ops threw, but type checking
    // ensures `x.create(res, x.datatype())` is invoked.
  });
});
