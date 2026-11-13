import { describe, it, expect } from 'vitest';
// Issue #928: lstsq is exported from the linalg entry too. Imported by package name.
import { lstsq, pinv } from '@danielsimonjr/mathts-linalg';

describe('issue #928: @danielsimonjr/mathts-linalg exports lstsq', () => {
  it('exports lstsq and it matches the pinv(A)*b result', () => {
    const A = [
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    const b = [1, 2, 2];
    expect(typeof lstsq).toBe('function');
    const x = lstsq(A, b);
    const viaPinv = pinv(A).map((row) => row.reduce((s, a, j) => s + a * b[j], 0));
    for (let i = 0; i < x.length; i++) {
      expect(Math.abs(x[i] - viaPinv[i])).toBeLessThan(1e-10);
    }
  });
});
