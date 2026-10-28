import { describe, it, expect } from 'vitest';
import {
  polyFromExpression,
  polyToDenseCoefficients,
  type Poly,
} from '../src/typed/polynomial-ideal.js';
import { parseRationalFunction } from '../src/cas/rational-integrate.js';
import { factorPolynomialUnivariate } from '../src/typed/factorization/index.js';
import { symbolicIntegral } from '../src/index.js';

/** Independent oracle for the shared dense fill (no trimming). */
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

/** Legacy fill bodies (pre-consolidation) must match the oracle. */
function legacyFillPolyDenseFromStr(s: string, x: string): number[] {
  const poly = polyFromExpression(s, [x]);
  let maxPow = 0;
  for (const t of poly) maxPow = Math.max(maxPow, t.powers[0] ?? 0);
  const dense = new Array<number>(maxPow + 1).fill(0);
  for (const t of poly) dense[t.powers[0]] += t.coeff;
  return dense;
}

function legacyFillDenseFromPoly(p: Poly): number[] {
  let maxPow = 0;
  for (const t of p) {
    maxPow = Math.max(maxPow, t.powers[0] ?? 0);
  }
  const dense = new Array<number>(maxPow + 1).fill(0);
  for (const t of p) {
    dense[t.powers[0]] += t.coeff;
  }
  return dense;
}

function legacyAlgebraPolyToDense(p: Poly): number[] {
  return trimPolyExactOracle(legacyFillDenseFromPoly(p));
}

function legacyFactorizationPolyToDense(p: Poly): number[] {
  return trimPolyFactorizationOracle(legacyFillDenseFromPoly(p));
}

describe('polyToDense coefficient fill — shared oracle', () => {
  it('empty Poly yields [0]', () => {
    expect(polyToDenseFillOracle([])).toEqual([0]);
  });

  it('x^2 + 1 is sparse ascending [1, 0, 1]', () => {
    const p = polyFromExpression('x^2 + 1', ['x']);
    expect(polyToDenseFillOracle(p)).toEqual([1, 0, 1]);
  });

  it('accumulates like terms on the same power', () => {
    const p: Poly = [
      { coeff: 1, powers: [2] },
      { coeff: 2, powers: [2] },
      { coeff: -1, powers: [0] },
    ];
    expect(polyToDenseFillOracle(p)).toEqual([-1, 0, 3]);
  });

  it('shared helper and legacy fill paths match the oracle', () => {
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
      const oracle = polyToDenseFillOracle(p);
      expect(polyToDenseCoefficients(p)).toEqual(oracle);
      expect(legacyFillDenseFromPoly(p)).toEqual(oracle);
      expect(legacyAlgebraPolyToDense(p)).toEqual(trimPolyExactOracle(oracle));
      expect(legacyFactorizationPolyToDense(p)).toEqual(trimPolyFactorizationOracle(oracle));
    }
    expect(legacyFillPolyDenseFromStr('x^2 + 1', 'x')).toEqual(
      polyToDenseCoefficients(polyFromExpression('x^2 + 1', ['x']))
    );
  });
});

describe('polyToDense trimming stays caller-specific', () => {
  it('algebra exact trim drops trailing zero but keeps tiny coefficients', () => {
    const p: Poly = [
      { coeff: 1, powers: [1] },
      { coeff: 0, powers: [2] },
    ];
    const filled = polyToDenseFillOracle(p);
    expect(filled).toEqual([0, 1, 0]);
    expect(trimPolyExactOracle(filled)).toEqual([0, 1]);
    expect(trimPolyFactorizationOracle(filled)).toEqual([0, 1]);
  });

  it('factorization drops trailing |c| < 1e-9 and may return []', () => {
    const tinyTrail: Poly = [{ coeff: 1e-12, powers: [0] }];
    expect(trimPolyFactorizationOracle(polyToDenseFillOracle(tinyTrail))).toEqual([]);
    expect(trimPolyExactOracle(polyToDenseFillOracle(tinyTrail))).toEqual([1e-12]);

    const mixed: Poly = [
      { coeff: 1, powers: [0] },
      { coeff: 1e-12, powers: [1] },
    ];
    const filled = polyToDenseFillOracle(mixed);
    expect(trimPolyExactOracle(filled)).toEqual([1, 1e-12]);
    expect(trimPolyFactorizationOracle(filled)).toEqual([1]);
  });

  it('integration paths keep untrimmed fill (rational parse)', () => {
    const rf = parseRationalFunction('(x^2 + 1)/(x + 1)', 'x')!;
    expect(rf.numer).toEqual([1n, 0n, 1n]);
    expect(rf.denom).toEqual([1n, 1n]);
  });

  it('non-polynomial string still throws from polyFromExpression', () => {
    expect(() => polyFromExpression('sin(x)', ['x'])).toThrow();
    expect(() => legacyFillPolyDenseFromStr('sin(x)', 'x')).toThrow();
  });
});

describe('polyToDense — integration smoke (unchanged behavior)', () => {
  it('factorization still factors x^2 - 1', () => {
    expect(factorPolynomialUnivariate('x^2 - 1', 'x')).toBe('(x - 1)*(x + 1)');
  });

  it('symbolicIntegral by-parts path still works for x*exp(x)', () => {
    const F = symbolicIntegral('x*exp(x)', 'x');
    expect(F).toContain('exp');
    expect(F).not.toMatch(/^integral\(/);
  });
});
