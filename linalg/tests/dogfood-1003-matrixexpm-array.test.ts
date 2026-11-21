import { describe, it, expect } from 'vitest';
// Issue #1003: `matrixExpm([[0,1],[0,0]])` from the linalg entry threw `A.toArray is not a
// function`. Imported by package name (the built dist), as the issue reproduces it.
import { matrixExpm } from '@danielsimonjr/mathts-linalg';

describe('issue #1003: linalg matrixExpm accepts a nested array', () => {
  it('matrixExpm([[0,1],[0,0]]) is [[1,1],[0,1]] (I + N for the nilpotent N)', () => {
    const r = matrixExpm([
      [0, 1],
      [0, 0],
    ]).toArray();
    const expected = [
      [1, 1],
      [0, 1],
    ];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        expect(Math.abs(r[i][j] - expected[i][j])).toBeLessThan(1e-15);
      }
    }
  });
});
