/**
 * Polymorphic scalar-arithmetic tests (Unit-merge Phase 1.1).
 *
 * `core/src/arithmetic/scalar.ts` is the load-bearing dependency the mathjs Unit
 * needs to be relocated into core: it must do `addScalar`/`subtractScalar`/… over
 * ANY mix of core's numeric primitives (number, bigint, Complex, Fraction,
 * BigNumber). These oracles pin exact mathematical results — closed forms
 * (i·i = −1), exact-rational identities (2/3·3/4 = 1/2), and float-exact BigNumber
 * sums (0.1 + 0.2 = 0.3) that a plain `number` cannot represent. They are
 * implementation-independent: a systematically-wrong dispatch is caught by a value
 * it must produce, not by a round-trip through the code under test.
 * See [[feedback-oracle-tests-implementation-independent]].
 */
import { describe, it, expect } from 'vitest';

import {
  addScalar,
  subtractScalar,
  multiplyScalar,
  divideScalar,
  pow,
  abs,
  fix,
  round,
  equal,
  isNumeric,
  number,
} from '../../src/arithmetic/scalar';
import { Complex } from '../../src/types/complex';
import { Fraction } from '../../src/types/fraction';
import { BigNumber } from '../../src/types/bignumber';

const C = (re: number, im = 0) => new Complex(re, im);
const F = (n: number | bigint, d: number | bigint = 1) => new Fraction(n, d);
const B = (n: number) => BigNumber.fromNumber(n);

describe('addScalar', () => {
  it('adds two numbers', () => {
    expect(addScalar(2, 3)).toBe(5);
  });
  it('adds two bigints (stays bigint)', () => {
    expect(addScalar(2n, 3n)).toBe(5n);
  });
  it('adds two Complex: (1+2i)+(3+4i) = 4+6i', () => {
    const r = addScalar(C(1, 2), C(3, 4)) as Complex;
    expect([r.re, r.im]).toEqual([4, 6]);
  });
  it('adds two Fractions EXACTLY: 1/3 + 1/6 = 1/2', () => {
    const r = addScalar(F(1, 3), F(1, 6)) as Fraction;
    expect(r.equals(F(1, 2))).toBe(true);
  });
  it('adds two BigNumbers EXACTLY: 0.1 + 0.2 = 0.3 (no float error)', () => {
    const r = addScalar(B(0.1), B(0.2)) as BigNumber;
    expect(r.equals(B(0.3))).toBe(true);
  });
  it('promotes a plain number into the Complex domain: 2 + 3i = 2+3i', () => {
    const r = addScalar(2, C(0, 3)) as Complex;
    expect([r.re, r.im]).toEqual([2, 3]);
  });
  it('is commutative across the promotion: 3i + 2 = 2+3i', () => {
    const r = addScalar(C(0, 3), 2) as Complex;
    expect([r.re, r.im]).toEqual([2, 3]);
  });
});

describe('subtractScalar (non-commutative — order must be preserved)', () => {
  it('subtracts two numbers', () => {
    expect(subtractScalar(5, 3)).toBe(2);
  });
  it('subtracts two bigints', () => {
    expect(subtractScalar(5n, 3n)).toBe(2n);
  });
  it('rich − plain keeps order: (5+5i) − 3 = 2+5i', () => {
    const r = subtractScalar(C(5, 5), 3) as Complex;
    expect([r.re, r.im]).toEqual([2, 5]);
  });
  it('plain − rich promotes AND keeps order: 3 − (5+5i) = −2−5i', () => {
    const r = subtractScalar(3, C(5, 5)) as Complex;
    expect([r.re, r.im]).toEqual([-2, -5]);
  });
  it('subtracts Fractions EXACTLY: 1/2 − 1/3 = 1/6', () => {
    const r = subtractScalar(F(1, 2), F(1, 3)) as Fraction;
    expect(r.equals(F(1, 6))).toBe(true);
  });
});

describe('multiplyScalar', () => {
  it('multiplies two numbers', () => {
    expect(multiplyScalar(6, 7)).toBe(42);
  });
  it('multiplies two bigints', () => {
    expect(multiplyScalar(6n, 7n)).toBe(42n);
  });
  it('multiplies Complex: (1+2i)(3+4i) = −5+10i', () => {
    const r = multiplyScalar(C(1, 2), C(3, 4)) as Complex;
    expect([r.re, r.im]).toEqual([-5, 10]);
  });
  it('multiplies Fractions EXACTLY: 2/3 · 3/4 = 1/2', () => {
    const r = multiplyScalar(F(2, 3), F(3, 4)) as Fraction;
    expect(r.equals(F(1, 2))).toBe(true);
  });
});

describe('divideScalar (non-commutative)', () => {
  it('divides two numbers', () => {
    expect(divideScalar(1, 4)).toBe(0.25);
  });
  it('divides two bigints (integer division)', () => {
    expect(divideScalar(7n, 2n)).toBe(3n);
  });
  it('divides Fractions EXACTLY: 1/1 ÷ 3/1 = 1/3', () => {
    const r = divideScalar(F(1), F(3)) as Fraction;
    expect(r.equals(F(1, 3))).toBe(true);
  });
  it('plain ÷ rich promotes and keeps order: 1 ÷ (2/1) = 1/2', () => {
    const r = divideScalar(1, F(2)) as Fraction;
    expect(r.equals(F(1, 2))).toBe(true);
  });
});

describe('pow', () => {
  it('number^number: 2^10 = 1024', () => {
    expect(pow(2, 10)).toBe(1024);
  });
  it('bigint^bigint: 2^10 = 1024n', () => {
    expect(pow(2n, 10n)).toBe(1024n);
  });
  it('Complex i^2 = −1', () => {
    const r = pow(C(0, 1), 2) as Complex;
    expect(r.re).toBeCloseTo(-1, 12);
    expect(r.im).toBeCloseTo(0, 12);
  });
  it('Fraction (2/3)^2 = 4/9 EXACTLY', () => {
    const r = pow(F(2, 3), 2) as Fraction;
    expect(r.equals(F(4, 9))).toBe(true);
  });
  it('BigNumber 2^3 = 8', () => {
    const r = pow(B(2), 3) as BigNumber;
    expect(r.equals(B(8))).toBe(true);
  });
  it('non-integer exponent on an exact base falls back to a real number (not silently wrong)', () => {
    // BigNumber.pow / Fraction.pow are integer-only; √ of an exact base is
    // irrational, so the result is a plain number ≈ 2, never 1 (the old bug) or a throw.
    expect(pow(B(4), 0.5)).toBeCloseTo(2, 12);
    expect(pow(F(4, 1), 0.5)).toBeCloseTo(2, 12);
  });
});

describe('abs', () => {
  it('abs(number)', () => {
    expect(abs(-5)).toBe(5);
  });
  it('abs(bigint)', () => {
    expect(abs(-5n)).toBe(5n);
  });
  it('abs(Complex) = magnitude: |3+4i| = 5', () => {
    expect(abs(C(3, 4))).toBe(5);
  });
  it('abs(Fraction) EXACTLY: |−3/4| = 3/4', () => {
    const r = abs(F(-3, 4)) as Fraction;
    expect(r.equals(F(3, 4))).toBe(true);
  });
  it('abs(BigNumber): |−2| = 2', () => {
    const r = abs(B(-2)) as BigNumber;
    expect(r.equals(B(2))).toBe(true);
  });
});

describe('fix (truncate toward zero)', () => {
  it('fix(2.7) = 2, fix(−2.7) = −2', () => {
    expect(fix(2.7)).toBe(2);
    expect(fix(-2.7)).toBe(-2);
  });
  it('fix(Fraction 7/2) = 3, fix(Fraction −7/2) = −3', () => {
    expect((fix(F(7, 2)) as Fraction).equals(F(3))).toBe(true);
    expect((fix(F(-7, 2)) as Fraction).equals(F(-3))).toBe(true);
  });
  it('fix(BigNumber −2.7) = −2', () => {
    expect((fix(B(-2.7)) as BigNumber).equals(B(-2))).toBe(true);
  });
});

describe('round (nearest)', () => {
  it('round(2.4) = 2, round(2.6) = 3', () => {
    expect(round(2.4)).toBe(2);
    expect(round(2.6)).toBe(3);
  });
  it('round(Fraction 12/5 = 2.4) = 2', () => {
    expect((round(F(12, 5)) as Fraction).equals(F(2))).toBe(true);
  });
  it('round(BigNumber 2.6) = 3', () => {
    expect((round(B(2.6)) as BigNumber).equals(B(3))).toBe(true);
  });
  it('negative half-integers round CONSISTENTLY across types (half toward +∞ = −2)', () => {
    // Guards the BigNumber default (halfUp = away-from-zero → −3) from diverging
    // from Math.round/Fraction.round (half toward +∞ → −2).
    expect(round(-2.5)).toBe(-2);
    expect((round(F(-5, 2)) as Fraction).equals(F(-2))).toBe(true);
    expect((round(B(-2.5)) as BigNumber).equals(B(-2))).toBe(true);
  });
});

describe('equal (tolerance-aware for floats, exact for rationals)', () => {
  it('equal(2, 2) = true, equal(2, 3) = false', () => {
    expect(equal(2, 2)).toBe(true);
    expect(equal(2, 3)).toBe(false);
  });
  it('equal(0.1 + 0.2, 0.3) = true (within relTol)', () => {
    expect(equal(0.1 + 0.2, 0.3)).toBe(true);
  });
  it('equal Fractions EXACTLY: 1/2 == 2/4', () => {
    expect(equal(F(1, 2), F(2, 4))).toBe(true);
  });
  it('equal Complex: (1+2i) == (1+2i), != (1+3i)', () => {
    expect(equal(C(1, 2), C(1, 2))).toBe(true);
    expect(equal(C(1, 2), C(1, 3))).toBe(false);
  });
  it('equal BigNumber: 0.3 == 0.3', () => {
    expect(equal(B(0.3), B(0.3))).toBe(true);
  });
});

describe('isNumeric (mathjs semantics — Complex is NOT numeric)', () => {
  it('true for number, bigint, Fraction, BigNumber', () => {
    expect(isNumeric(5)).toBe(true);
    expect(isNumeric(5n)).toBe(true);
    expect(isNumeric(F(1, 2))).toBe(true);
    expect(isNumeric(B(1))).toBe(true);
  });
  it('true for boolean (mathjs coerces true/false → 1/0; Unit accepts new Unit(true))', () => {
    expect(isNumeric(true)).toBe(true);
    expect(isNumeric(false)).toBe(true);
  });
  it('FALSE for Complex (mathjs treats Complex separately)', () => {
    expect(isNumeric(C(1, 2))).toBe(false);
  });
  it('false for non-numeric values', () => {
    expect(isNumeric('x')).toBe(false);
    expect(isNumeric(null)).toBe(false);
    expect(isNumeric({})).toBe(false);
  });
});

describe('number (convert any scalar to a JS number)', () => {
  it('number(5) = 5, number(5n) = 5', () => {
    expect(number(5)).toBe(5);
    expect(number(5n)).toBe(5);
  });
  it('number(Fraction 1/4) = 0.25', () => {
    expect(number(F(1, 4))).toBe(0.25);
  });
  it('number(BigNumber 0.25) = 0.25', () => {
    expect(number(B(0.25))).toBe(0.25);
  });
  it('number(real Complex 3+0i) = 3', () => {
    expect(number(C(3, 0))).toBe(3);
  });
  it('number(non-real Complex 3+4i) throws', () => {
    expect(() => number(C(3, 4))).toThrow();
  });
});
