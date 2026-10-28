import { describe, it, expect } from 'vitest';
import {
  polyFromExpression,
  polyToDenseCoefficients,
  type Poly,
} from '../src/typed/polynomial-ideal.js';
import { parseRationalFunction } from '../src/cas/rational-integrate.js';
import { factorPolynomialUnivariate } from '../src/typed/factorization/index.js';
import { symbolicIntegral } from '../src/cas-integration.js';

/**
 * Independent dense-fill oracle (the pre-consolidation loop). Expected values
 * in these tests are literals; this is only a second check that the helper
 * still matches that algorithm.
 */
function polyToDenseFillOracle(p: Poly): number[] {
  let maxPow = 0;
  for (const t of p) maxPow = Math.max(maxPow, t.powers[0] ?? 0);
  const dense = new Array<number>(maxPow + 1).fill(0);
  for (const t of p) dense[t.powers[0]] += t.coeff;
  return dense;
}

/** Mirrors `trimPoly` in `algebra.ts` (exact trailing zeros only). */
function trimPolyExactOracle(coeffs: number[]): number[] {
  let end = coeffs.length - 1;
  while (end > 0 && coeffs[end] === 0) end--;
  return coeffs.slice(0, end + 1);
}

/** Mirrors factorization `polyToDense` trailing near-zero drop (`1e-9`). */
function trimPolyFactorizationOracle(coeffs: number[]): number[] {
  let n = coeffs.length;
  while (n > 0 && Math.abs(coeffs[n - 1]) < 1e-9) n -= 1;
  return coeffs.slice(0, n);
}

describe('polyToDenseCoefficients — hardcoded fill', () => {
  it('empty Poly yields [0]', () => {
    expect(polyToDenseCoefficients([])).toEqual([0]);
  });

  it('x^2 + 1 is sparse ascending [1, 0, 1]', () => {
    const p = polyFromExpression('x^2 + 1', ['x']);
    expect(polyToDenseCoefficients(p)).toEqual([1, 0, 1]);
  });

  it('accumulates like terms on the same power', () => {
    const p: Poly = [
      { coeff: 1, powers: [2] },
      { coeff: 2, powers: [2] },
      { coeff: -1, powers: [0] },
    ];
    expect(polyToDenseCoefficients(p)).toEqual([-1, 0, 3]);
  });

  it('constant term only', () => {
    expect(polyToDenseCoefficients([{ coeff: 5, powers: [0] }])).toEqual([5]);
  });

  it('3*x^2 - x is [0, -1, 3]', () => {
    const p = polyFromExpression('3*x^2 - x', ['x']);
    expect(polyToDenseCoefficients(p)).toEqual([0, -1, 3]);
  });

  it('does not mutate the input Poly', () => {
    const p: Poly = [{ coeff: 1, powers: [1] }];
    polyToDenseCoefficients(p);
    expect(p).toEqual([{ coeff: 1, powers: [1] }]);
  });

  it('does not trim trailing exact zeros or tiny coefficients', () => {
    const withZero: Poly = [
      { coeff: 1, powers: [1] },
      { coeff: 0, powers: [2] },
    ];
    expect(polyToDenseCoefficients(withZero)).toEqual([0, 1, 0]);

    const tiny: Poly = [{ coeff: 1e-12, powers: [0] }];
    expect(polyToDenseCoefficients(tiny)).toEqual([1e-12]);
  });

  it('cancellation that leaves a trailing exact zero stays untrimmed', () => {
    const p: Poly = [
      { coeff: 0.5, powers: [3] },
      { coeff: -0.5, powers: [3] },
      { coeff: 2, powers: [1] },
    ];
    expect(polyToDenseCoefficients(p)).toEqual([0, 2, 0, 0]);
  });

  it('NaN coefficient is preserved at that power', () => {
    const out = polyToDenseCoefficients([{ coeff: NaN, powers: [0] }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeNaN();
  });

  it('matches the independent fill oracle', () => {
    const cases: Poly[] = [
      [],
      polyFromExpression('x^2 + 1', ['x']),
      polyFromExpression('3*x^2 - x', ['x']),
      [
        { coeff: 0.5, powers: [3] },
        { coeff: -0.5, powers: [3] },
        { coeff: 2, powers: [1] },
      ],
    ];
    for (const p of cases) {
      expect(polyToDenseCoefficients(p)).toEqual(polyToDenseFillOracle(p));
    }
  });
});

describe('polyToDense trimming stays caller-specific', () => {
  it('algebra exact trim drops trailing zero but keeps tiny coefficients', () => {
    const p: Poly = [
      { coeff: 1, powers: [1] },
      { coeff: 0, powers: [2] },
    ];
    const filled = polyToDenseCoefficients(p);
    expect(filled).toEqual([0, 1, 0]);
    expect(trimPolyExactOracle(filled)).toEqual([0, 1]);
    expect(trimPolyFactorizationOracle(filled)).toEqual([0, 1]);

    const tiny: Poly = [{ coeff: 1e-12, powers: [0] }];
    expect(trimPolyExactOracle(polyToDenseCoefficients(tiny))).toEqual([1e-12]);
  });

  it('factorization drops trailing |c| < 1e-9 and may return []', () => {
    const tinyTrail: Poly = [{ coeff: 1e-12, powers: [0] }];
    expect(trimPolyFactorizationOracle(polyToDenseCoefficients(tinyTrail))).toEqual([]);
    expect(trimPolyExactOracle(polyToDenseCoefficients(tinyTrail))).toEqual([1e-12]);

    const mixed: Poly = [
      { coeff: 1, powers: [0] },
      { coeff: 1e-12, powers: [1] },
    ];
    const filled = polyToDenseCoefficients(mixed);
    expect(filled).toEqual([1, 1e-12]);
    expect(trimPolyExactOracle(filled)).toEqual([1, 1e-12]);
    expect(trimPolyFactorizationOracle(filled)).toEqual([1]);
  });

  it('integration paths keep untrimmed fill (rational parse)', () => {
    const rf = parseRationalFunction('(x^2 + 1)/(x + 1)', 'x')!;
    expect(rf.numer).toEqual([1n, 0n, 1n]);
    expect(rf.denom).toEqual([1n, 1n]);
  });

  it('non-polynomial string still throws from polyFromExpression', () => {
    expect(() => polyFromExpression('sin(x)', ['x'])).toThrow(
      "polynomial parse: unknown symbol 'sin' (declared variables: x) (at position 3 in 'sin(x)')"
    );
    expect(() => polyToDenseCoefficients(polyFromExpression('sin(x)', ['x']))).toThrow(
      "polynomial parse: unknown symbol 'sin' (declared variables: x) (at position 3 in 'sin(x)')"
    );
  });
});

describe('polyToDense — integration smoke (unchanged behavior)', () => {
  it('factorization still factors x^2 - 1', () => {
    expect(factorPolynomialUnivariate('x^2 - 1', 'x')).toBe('(x - 1)*(x + 1)');
  });

  it('factorization 1e-9 trim makes a tiny high-degree term look constant', () => {
    // 5e-10 survives polyFromExpression (EPS 1e-10) then factorization drops |c| < 1e-9.
    expect(factorPolynomialUnivariate('1 + 5e-10*x^2', 'x')).toBeNull();
  });

  it('symbolicIntegral by-parts path still works for x*exp(x)', () => {
    const F = symbolicIntegral('x*exp(x)', 'x');
    expect(F).toContain('exp');
    expect(F).not.toMatch(/^integral\(/);
  });
});
