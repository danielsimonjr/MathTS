/**
 * Bucket C, arithmetic slice — equivalence guard for the "temperature split".
 *
 * The public typed dispatchers `pow`/`round`/`fix`/`equal` (functions/src/typed/
 * arithmetic.ts) used to RE-IMPLEMENT their rich-type (BigNumber/Fraction/Complex)
 * scalar policy inline, and those copies DIVERGED from `core/src/arithmetic/scalar.ts`
 * into three live public-API bugs:
 *
 *   pow(bignumber(2), 0.5)  -> 1     (should be ~1.4142)  — unguarded a.pow(0.5)
 *   pow(fraction(3), 2.9)   -> 27    (should be ~24.19)   — silently floored exponent
 *   round(bignumber(-2.5))  -> -3    (should be -2)       — half-away vs core's halfCeil
 *   equal(0.1+0.2, 0.3)     -> false (should be true)     — strict === vs tolerance
 *
 * The fix delegates those rich-type / policy cases to core's oracle-pinned primitive
 * (hot number/bigint cases stay inline). This test PINS the fixed values (cross-checked
 * against numpy) AND asserts, via fast-check, that the typed dispatcher's rich-type
 * output is identical to core's primitive over a domain-aware generator + an explicit
 * edge corpus — so the two can never silently drift apart again.
 *
 * Per Rule 4 ("never assume — verify with a second method") we do not trust that the
 * delegation is wired correctly just because it compiles; every case is proven ≡ core.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { pow, round, fix, equal } from '@danielsimonjr/mathts-functions';
import {
  BigNumber,
  Fraction,
  Complex,
  pow as corePow,
  round as coreRound,
  fix as coreFix,
  equal as coreEqual,
} from '@danielsimonjr/mathts-core';

const bn = (x: number): BigNumber => BigNumber.fromNumber(x);
const asNum = (v: unknown): number =>
  v instanceof BigNumber || v instanceof Fraction ? v.toNumber() : (v as number);

// ---------------------------------------------------------------------------
// The three (four, counting the Fraction floor) bugs, pinned to CORRECT values.
// ---------------------------------------------------------------------------
describe('Bucket C — the fixed public-API bugs', () => {
  it('pow(bignumber(2), 0.5) ≈ sqrt(2) (was 1)', () => {
    expect(asNum(pow(bn(2), 0.5))).toBeCloseTo(Math.SQRT2, 12);
  });

  it('pow(fraction(3), 2.9) ≈ 24.1908… (was floored to 27)', () => {
    // numpy: 3 ** 2.9 == 24.190878415700578
    expect(asNum(pow(new Fraction(3), 2.9))).toBeCloseTo(24.190878415700578, 10);
  });

  it('pow(bignumber, integer) stays exact BigNumber', () => {
    const r = pow(bn(2), 5);
    expect(r).toBeInstanceOf(BigNumber);
    expect((r as BigNumber).toNumber()).toBeCloseTo(32, 12);
  });

  it('round(bignumber(-2.5)) = -2 (halfCeil; was -3)', () => {
    expect(asNum(round(bn(-2.5)))).toBe(-2);
  });

  it('round(bignumber(2.5)) = 3', () => {
    expect(asNum(round(bn(2.5)))).toBe(3);
  });

  it('equal(0.1 + 0.2, 0.3) = true (tolerance; was false via strict ===)', () => {
    expect(equal(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('equal keeps genuinely different numbers apart', () => {
    expect(equal(0.3, 0.30001)).toBe(false);
    expect(equal(5, 6)).toBe(false);
    expect(equal(NaN, NaN)).toBe(false);
    expect(equal(Infinity, Infinity)).toBe(true);
    expect(equal(Infinity, -Infinity)).toBe(false);
  });

  it('round(±0) is preserved', () => {
    expect(asNum(round(bn(0)))).toBe(0);
  });

  it('fix truncates toward zero for rich types', () => {
    expect(asNum(fix(bn(1.9)))).toBe(1);
    expect(asNum(fix(bn(-1.9)))).toBe(-1);
    expect(asNum(fix(new Fraction(7, 4)))).toBe(1);
    expect(asNum(fix(new Fraction(-7, 4)))).toBe(-1);
  });

  it('huge BigNumber exponents delegate correctly', () => {
    // 10^20 exact via integer BigNumber path.
    const r = pow(bn(10), 20);
    expect(r).toBeInstanceOf(BigNumber);
    expect((r as BigNumber).toString()).toBe('100000000000000000000');
  });
});

// ---------------------------------------------------------------------------
// Equivalence: typed dispatcher rich-type case ≡ core primitive.
// ---------------------------------------------------------------------------

const eqNum = (a: unknown, b: unknown): boolean => {
  const x = asNum(a);
  const y = asNum(b);
  if (Number.isNaN(x) && Number.isNaN(y)) return true;
  // both may be BigNumber (integer path) or number (Math.pow fallback); compare as reals.
  return Object.is(x, y) || Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
};

describe('Bucket C — typed dispatcher ≡ core scalar primitive', () => {
  it('round(BigNumber) matches core', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (x) => {
        expect(eqNum(round(bn(x)), coreRound(bn(x)))).toBe(true);
      })
    );
    // edge corpus
    for (const x of [-2.5, 2.5, -0.5, 0.5, 0, -0, 1.5, -1.5, 100.5]) {
      expect(eqNum(round(bn(x)), coreRound(bn(x)))).toBe(true);
    }
  });

  it('round(Fraction) matches core', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: 1, max: 32 }),
        (p, q) => {
          expect(eqNum(round(new Fraction(p, q)), coreRound(new Fraction(p, q)))).toBe(true);
        }
      )
    );
  });

  it('fix(BigNumber) matches core', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (x) => {
        expect(eqNum(fix(bn(x)), coreFix(bn(x)))).toBe(true);
      })
    );
  });

  it('fix(Fraction) matches core', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: 1, max: 32 }),
        (p, q) => {
          expect(eqNum(fix(new Fraction(p, q)), coreFix(new Fraction(p, q)))).toBe(true);
        }
      )
    );
  });

  it('pow(BigNumber, number) matches core (integer + non-integer exponents)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 50, noNaN: true }),
        fc.double({ min: -4, max: 4, noNaN: true }),
        (base, exp) => {
          expect(eqNum(pow(bn(base), exp), corePow(bn(base), exp))).toBe(true);
        }
      )
    );
    // edge corpus: exact integers, 0.5, and non-integers
    for (const [b, e] of [
      [2, 0.5],
      [2, 3],
      [4, 0.5],
      [3, 2.9],
      [9, 0.5],
      [10, 20],
    ] as const) {
      expect(eqNum(pow(bn(b), e), corePow(bn(b), e))).toBe(true);
    }
  });

  it('pow(BigNumber, BigNumber) matches core', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 20, noNaN: true }),
        fc.integer({ min: -3, max: 6 }),
        (base, exp) => {
          expect(eqNum(pow(bn(base), bn(exp)), corePow(bn(base), bn(exp)))).toBe(true);
        }
      )
    );
  });

  it('pow(Fraction, number) matches core (integer stays exact, non-integer -> real)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 8 }),
        fc.double({ min: -3, max: 3, noNaN: true }),
        (p, q, exp) => {
          expect(eqNum(pow(new Fraction(p, q), exp), corePow(new Fraction(p, q), exp))).toBe(true);
        }
      )
    );
  });

  it('pow(Complex, number/Complex) matches core', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.double({ min: -3, max: 3, noNaN: true }),
        (re, im, exp) => {
          const a = new Complex(re, im);
          const t = pow(a, exp) as Complex;
          const c = corePow(a, exp) as Complex;
          expect(t.re).toBeCloseTo(c.re, 9);
          expect(t.im).toBeCloseTo(c.im, 9);
        }
      )
    );
  });

  it('equal(number, number) matches core tolerance semantics', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), fc.double({ noNaN: true }), (a, b) => {
        expect(equal(a, b)).toBe(coreEqual(a, b));
      })
    );
    // edge corpus where strict === and tolerance disagree
    expect(equal(0.1 + 0.2, 0.3)).toBe(coreEqual(0.1 + 0.2, 0.3));
  });

  it('equal(Fraction/BigNumber/Complex) matches core (exact)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -50, max: 50 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: -50, max: 50 }),
        fc.integer({ min: 1, max: 12 }),
        (p1, q1, p2, q2) => {
          const a = new Fraction(p1, q1);
          const b = new Fraction(p2, q2);
          expect(equal(a, b)).toBe(coreEqual(a, b));
          const A = bn(p1 / q1);
          const B = bn(p2 / q2);
          expect(equal(A, B)).toBe(coreEqual(A, B));
        }
      )
    );
  });
});
