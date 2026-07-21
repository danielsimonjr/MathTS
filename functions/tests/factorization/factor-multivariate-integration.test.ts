import { describe, it, expect } from 'vitest';
import { factor, evaluate } from '../../src/index.js';
const at = (e: string, vals: Record<string, number>) => evaluate(e, vals) as number;

describe('factor() — multivariate irreducible factorization', () => {
  it('factors what the old path left whole (numeric-verified)', () => {
    const f = factor('x^2 + 3*x*y + 4*x + 2*y^2 + 5*y + 3'); // (x+y+1)(x+2y+3)
    expect(f).not.toBe('x^2 + 3*x*y + 4*x + 2*y^2 + 5*y + 3');
    for (const [x, y] of [
      [2, 3],
      [-1, 4],
      [0.5, -2],
    ]) {
      expect(at(f, { x, y })).toBeCloseTo((x + y + 1) * (x + 2 * y + 3), 6);
    }
  });
  it('regression: existing multivariate fast-paths byte-identical', () => {
    // Pinned to the CURRENT factor() byte output (polyToString does not elide
    // unit coefficients, so the cofactor renders as "1*y + 1*x"). This guards
    // that the fast path is preserved exactly when Kronecker adds nothing.
    expect(factor('x^2*y + x*y^2')).toBe('x*y*(1*y + 1*x)');
    expect(factor('4*x^2 - 9*y^2')).toBe('(2*x - 3*y)*(2*x + 3*y)');
  });
  it('irreducible multivariate returned unchanged', () => {
    expect(factor('x^2 + y^2')).toBe('x^2 + y^2');
  });
});
