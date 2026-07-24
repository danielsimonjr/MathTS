/**
 * Factory-layer vs core-primitive parity guard.
 *
 * The mathjs-derived factory layer in `functions/src/factories/index.ts`
 * (`math.create({...})` plugin escape-hatch) REIMPLEMENTS several scalar and
 * array symbols that also have a canonical primitive in
 * `@danielsimonjr/mathts-core` (`core/src/arithmetic/scalar.ts`,
 * `core/src/array.ts`). Those independent bodies are allowlisted in
 * tools/create-dependency-graph/duplicate-allowlist.json as intentional
 * (the factory layer is a distinct public surface) — but "allowlist alone is
 * negligent" (feedback-allowlist-needs-parity-guard): a divergent factory impl
 * is exactly how a numeric bug could hide behind the plugin API.
 *
 * This test is the guard the allowlist entries reference:
 *   1. cross-check `functions.X ≡ core.X` for the scalar ops that claim the
 *      SAME semantics (add/subtract/multiply/divideScalar, isNumeric), and
 *   2. anchor the factory array ops (flatten/reshape/concat/squeeze) and the
 *      scalar predicates (isInteger/factorial) to explicit oracle results.
 *
 * NOTE (surfaced, not a bug): the deeper "collapse the factory/compat layer
 * into the typed layer" ADR remains Daniel's open call; allowlist-with-parity
 * is the interim divergence guard, not a resolution.
 */
import { describe, it, expect } from 'vitest';
import {
  addScalar as fAdd,
  subtractScalar as fSub,
  multiplyScalar as fMul,
  divideScalar as fDiv,
  isNumeric as fIsNumeric,
  isInteger as fIsInteger,
  factorial as fFactorial,
  flatten as fFlatten,
  reshape as fReshape,
  concat as fConcat,
  squeeze as fSqueeze,
} from '@danielsimonjr/mathts-functions';
import {
  addScalar as cAdd,
  subtractScalar as cSub,
  multiplyScalar as cMul,
  divideScalar as cDiv,
  isNumeric as cIsNumeric,
  Complex,
} from '@danielsimonjr/mathts-core';

describe('factory-core parity — scalar arithmetic (functions ≡ core ≡ oracle)', () => {
  const nums: Array<[number, number]> = [
    [2, 3],
    [5, -1],
    [-4, 7],
    [0.1, 0.2],
    [1e6, 1e-6],
  ];
  for (const [a, b] of nums) {
    it(`addScalar(${a},${b})`, () => {
      expect(fAdd(a, b)).toBe(a + b); // oracle
      expect(fAdd(a, b)).toBe(cAdd(a, b)); // functions ≡ core
    });
    it(`subtractScalar(${a},${b})`, () => {
      expect(fSub(a, b)).toBe(a - b);
      expect(fSub(a, b)).toBe(cSub(a, b));
    });
    it(`multiplyScalar(${a},${b})`, () => {
      expect(fMul(a, b)).toBe(a * b);
      expect(fMul(a, b)).toBe(cMul(a, b));
    });
    it(`divideScalar(${a},${b})`, () => {
      expect(fDiv(a, b)).toBe(a / b);
      expect(fDiv(a, b)).toBe(cDiv(a, b));
    });
  }

  it('scalar ops agree on Complex operands (functions ≡ core)', () => {
    const z1 = new Complex(1, 2);
    const z2 = new Complex(3, -1);
    const fa = fAdd(z1, z2) as Complex;
    const ca = cAdd(z1, z2) as Complex;
    expect([fa.re, fa.im]).toEqual([4, 1]); // oracle
    expect([fa.re, fa.im]).toEqual([ca.re, ca.im]);
    const fm = fMul(z1, z2) as Complex;
    const cm = cMul(z1, z2) as Complex;
    // (1+2i)(3-1i) = 5 + 5i
    expect([fm.re, fm.im]).toEqual([5, 5]);
    expect([fm.re, fm.im]).toEqual([cm.re, cm.im]);
  });
});

describe('factory-core parity — predicates (functions ≡ core / oracle)', () => {
  it('isNumeric agrees with core across a corpus', () => {
    for (const v of [5, -3.2, 0, NaN, Infinity]) {
      expect(fIsNumeric(v)).toBe(cIsNumeric(v));
    }
  });
  it('isInteger matches oracle', () => {
    expect(fIsInteger(4)).toBe(true);
    expect(fIsInteger(-7)).toBe(true);
    expect(fIsInteger(4.5)).toBe(false);
  });
  it('factorial matches oracle', () => {
    expect(fFactorial(0)).toBe(1);
    expect(fFactorial(5)).toBe(120);
    expect(fFactorial(6)).toBe(720);
  });
});

describe('factory array ops — oracle results', () => {
  it('flatten', () => {
    expect(
      fFlatten([
        [1, 2],
        [3, 4],
      ])
    ).toEqual([1, 2, 3, 4]);
  });
  it('reshape', () => {
    expect(fReshape([1, 2, 3, 4], [2, 2])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
  it('concat', () => {
    expect(fConcat([1, 2], [3, 4], 0)).toEqual([1, 2, 3, 4]);
  });
  it('squeeze', () => {
    expect(fSqueeze([[1], [2]])).toEqual([1, 2]);
  });
});
