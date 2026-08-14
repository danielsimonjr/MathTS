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

import {
  pow,
  round,
  fix,
  equal,
  add,
  subtract,
  multiply,
  divide,
  abs,
} from '@danielsimonjr/mathts-functions';
import {
  BigNumber,
  Fraction,
  Complex,
  pow as corePow,
  round as coreRound,
  fix as coreFix,
  equal as coreEqual,
  addScalar as coreAdd,
  subtractScalar as coreSubtract,
  multiplyScalar as coreMultiply,
  divideScalar as coreDivide,
  abs as coreAbs,
} from '@danielsimonjr/mathts-core';
import type { NumericScalar } from '@danielsimonjr/mathts-core';

const bn = (x: number): BigNumber => BigNumber.fromNumber(x);
const asNum = (v: unknown): number =>
  v instanceof BigNumber || v instanceof Fraction ? v.toNumber() : (v as number);

/** IEEE-aware float equality. `toBeCloseTo` fails on NaN≈NaN (NaN - NaN is NaN). */
function eqIeee(a: number, b: number, digits = 9): void {
  if (Object.is(a, b)) return;
  expect(a).toBeCloseTo(b, digits);
}

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
          eqIeee(t.re, c.re);
          eqIeee(t.im, c.im);
        }
      )
    );
  });

  it('pow(Complex(Number.MIN_VALUE, 0), negative) matches core (CI counterexample)', () => {
    // Seed 1484219061 / [5e-324, 0, -0.9534450651769089]: toBeCloseTo(NaN, NaN)
    // failed because Inf*0 in fromPolar produced NaN on the imaginary part.
    const a = new Complex(5e-324, 0);
    const exp = -0.9534450651769089;
    const t = pow(a, exp) as Complex;
    const c = corePow(a, exp) as Complex;
    eqIeee(t.re, c.re);
    eqIeee(t.im, c.im);
    expect(t.re).toBe(Infinity);
    expect(t.im === 0).toBe(true);
    expect(Number.isNaN(t.im)).toBe(false);
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

// ---------------------------------------------------------------------------
// Slice 2 — the remaining core-backed scalar ops: add / subtract / multiply /
// divide / abs (the full inventory of ops appearing BOTH as a plain primitive
// in core/src/arithmetic/scalar.ts AND as a mathTyped dispatcher case in
// functions/src/typed/arithmetic.ts, excluding slice 1's pow/round/equal/fix).
//
// DELEGATE-vs-GUARD-BY-TEST RULE (stated, not just applied): slice 1 found real
// bugs in pow/round/fix/equal because the typed dispatcher's rich-type case
// re-implemented a DISTINCT policy/algorithm (e.g. BigNumber round defaulting
// to half-away-from-zero vs core's explicit halfCeil) that silently diverged
// from core's. Inspecting add/subtract/multiply/divide/abs shows no such
// second implementation: every same-type case is the identical one-liner
// forward to the shared instance method in BOTH files (`a.add(b)`, `x.abs()`,
// ...), and every cross-type (number+Complex/Fraction/BigNumber) promotion
// case preserves operand ORDER identically to core's asComplex/asFraction/
// asBigNumber promotion — verified explicitly below for the non-commutative
// ops (subtract/divide), which is exactly the class of bug (wrong promotion
// order) slice 1 found in pow. Since there is only ONE implementation of the
// underlying policy being called from two sites, delegating would add a
// redundant cross-module call with zero divergence-safety benefit. Rule:
// DELEGATE when two call sites embody DISTINCT branching/algorithm choices
// that can drift apart; GUARD BY TEST ONLY (this section) when both call
// sites are a direct forward to the same shared method — the equivalence test
// is the safety net, and it fires if that ever stops being true.
// ---------------------------------------------------------------------------

/**
 * Generic equivalence oracle: are the typed dispatcher's output and core's
 * primitive output the "same value", across every NumericScalar shape
 * (number/bigint/Complex/Fraction/BigNumber, same-type or mixed)? Built on the
 * already-proven-correct `coreEqual` (slice 1), with one NaN carve-out:
 * `equal(NaN, NaN)` is defined to be `false` (mathjs/IEEE parity — NaN is
 * never equal to anything, not even itself), which is the right semantics for
 * a public `equal()` but the WRONG semantics for "did the two code paths
 * compute the same result" — so NaN-vs-NaN is treated as a match here.
 */
function resultsMatch(t: unknown, c: unknown): boolean {
  if (typeof t === 'number' && typeof c === 'number' && Number.isNaN(t) && Number.isNaN(c)) {
    return true;
  }
  return coreEqual(t as NumericScalar, c as NumericScalar);
}

const numDomain = fc.double({ min: -1e6, max: 1e6, noNaN: true });
const numDomainNonZero = numDomain.filter((x) => x !== 0);
// A divisor kept away from zero AND away from denormals: a denormal (e.g.
// ±5e-324) still passes `!== 0` but, promoted to Complex, makes |divisor|² in
// the division formula underflow — a genuine numerical degenerate case, not a
// typed-vs-core divergence (both sides call the identical Complex.divide()).
const numDivisorSafe = numDomain.filter((x) => Math.abs(x) > 1e-3);
const bigintDomain = fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n });
const bigintDomainNonZero = bigintDomain.filter((x) => x !== 0n);
const fracP = fc.integer({ min: -1000, max: 1000 });
const fracPNonZero = fracP.filter((p) => p !== 0);
const fracQ = fc.integer({ min: 1, max: 32 });
const cplxPart = fc.double({ min: -1e3, max: 1e3, noNaN: true });

const EDGE_NUMS = [0, -0, NaN, Infinity, -Infinity, Number.MIN_VALUE, -Number.MIN_VALUE, 1, -1];

describe('Bucket C — add/subtract/multiply/divide/abs: typed dispatcher ≡ core scalar primitive', () => {
  // --- add (commutative) ---------------------------------------------------
  it('add(number, number) matches core, incl. edge corpus', () => {
    fc.assert(
      fc.property(numDomain, numDomain, (a, b) => {
        expect(resultsMatch(add(a, b), coreAdd(a, b))).toBe(true);
      })
    );
    for (const a of EDGE_NUMS)
      for (const b of EDGE_NUMS) {
        expect(resultsMatch(add(a, b), coreAdd(a, b))).toBe(true);
      }
  });

  it('add(bigint, bigint) matches core', () => {
    fc.assert(
      fc.property(bigintDomain, bigintDomain, (a, b) => {
        expect(resultsMatch(add(a, b) as bigint, coreAdd(a, b))).toBe(true);
      })
    );
  });

  it('add(Complex, Complex) and mixed number/Complex match core', () => {
    fc.assert(
      fc.property(cplxPart, cplxPart, cplxPart, cplxPart, (re1, im1, re2, im2) => {
        const a = new Complex(re1, im1);
        const b = new Complex(re2, im2);
        expect(resultsMatch(add(a, b), coreAdd(a, b))).toBe(true);
      })
    );
    fc.assert(
      fc.property(numDomain, cplxPart, cplxPart, (n, re, im) => {
        const c = new Complex(re, im);
        expect(resultsMatch(add(n, c), coreAdd(n, c))).toBe(true);
        expect(resultsMatch(add(c, n), coreAdd(c, n))).toBe(true);
      })
    );
  });

  it('add(Fraction, Fraction) and mixed number/Fraction match core', () => {
    fc.assert(
      fc.property(fracP, fracQ, fracP, fracQ, (p1, q1, p2, q2) => {
        const a = new Fraction(p1, q1);
        const b = new Fraction(p2, q2);
        expect(resultsMatch(add(a, b), coreAdd(a, b))).toBe(true);
      })
    );
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), fracP, fracQ, (n, p, q) => {
        const f = new Fraction(p, q);
        expect(resultsMatch(add(n, f), coreAdd(n, f))).toBe(true);
        expect(resultsMatch(add(f, n), coreAdd(f, n))).toBe(true);
      })
    );
  });

  it('add(BigNumber, BigNumber) and mixed number/BigNumber match core', () => {
    fc.assert(
      fc.property(numDomain, numDomain, (x, y) => {
        const a = bn(x);
        const b = bn(y);
        expect(resultsMatch(add(a, b), coreAdd(a, b))).toBe(true);
        expect(resultsMatch(add(x, b), coreAdd(x, b))).toBe(true);
        expect(resultsMatch(add(a, x), coreAdd(a, x))).toBe(true);
      })
    );
  });

  // --- subtract (non-commutative — order is exactly where a promotion bug hides) ---
  it('subtract(number, number) matches core, incl. edge corpus', () => {
    fc.assert(
      fc.property(numDomain, numDomain, (a, b) => {
        expect(resultsMatch(subtract(a, b), coreSubtract(a, b))).toBe(true);
      })
    );
    for (const a of EDGE_NUMS)
      for (const b of EDGE_NUMS) {
        expect(resultsMatch(subtract(a, b), coreSubtract(a, b))).toBe(true);
      }
  });

  it('subtract(bigint, bigint) matches core', () => {
    fc.assert(
      fc.property(bigintDomain, bigintDomain, (a, b) => {
        expect(resultsMatch(subtract(a, b) as bigint, coreSubtract(a, b))).toBe(true);
      })
    );
  });

  it('subtract(Complex, Complex) and mixed number/Complex preserve order like core', () => {
    fc.assert(
      fc.property(cplxPart, cplxPart, cplxPart, cplxPart, (re1, im1, re2, im2) => {
        const a = new Complex(re1, im1);
        const b = new Complex(re2, im2);
        expect(resultsMatch(subtract(a, b), coreSubtract(a, b))).toBe(true);
      })
    );
    fc.assert(
      fc.property(numDomain, cplxPart, cplxPart, (n, re, im) => {
        const c = new Complex(re, im);
        // order matters: n - c  vs  c - n
        expect(resultsMatch(subtract(n, c), coreSubtract(n, c))).toBe(true);
        expect(resultsMatch(subtract(c, n), coreSubtract(c, n))).toBe(true);
      })
    );
  });

  it('subtract(Fraction, Fraction) and mixed number/Fraction preserve order like core', () => {
    fc.assert(
      fc.property(fracP, fracQ, fracP, fracQ, (p1, q1, p2, q2) => {
        const a = new Fraction(p1, q1);
        const b = new Fraction(p2, q2);
        expect(resultsMatch(subtract(a, b), coreSubtract(a, b))).toBe(true);
      })
    );
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), fracP, fracQ, (n, p, q) => {
        const f = new Fraction(p, q);
        expect(resultsMatch(subtract(n, f), coreSubtract(n, f))).toBe(true);
        expect(resultsMatch(subtract(f, n), coreSubtract(f, n))).toBe(true);
      })
    );
  });

  it('subtract(BigNumber, BigNumber) and mixed number/BigNumber preserve order like core', () => {
    fc.assert(
      fc.property(numDomain, numDomain, (x, y) => {
        const a = bn(x);
        const b = bn(y);
        expect(resultsMatch(subtract(a, b), coreSubtract(a, b))).toBe(true);
        expect(resultsMatch(subtract(x, b), coreSubtract(x, b))).toBe(true);
        expect(resultsMatch(subtract(a, x), coreSubtract(a, x))).toBe(true);
      })
    );
  });

  // --- multiply (commutative) -----------------------------------------------
  it('multiply(number, number) matches core, incl. edge corpus', () => {
    fc.assert(
      fc.property(numDomain, numDomain, (a, b) => {
        expect(resultsMatch(multiply(a, b), coreMultiply(a, b))).toBe(true);
      })
    );
    for (const a of EDGE_NUMS)
      for (const b of EDGE_NUMS) {
        expect(resultsMatch(multiply(a, b), coreMultiply(a, b))).toBe(true);
      }
  });

  it('multiply(bigint, bigint) matches core', () => {
    fc.assert(
      fc.property(bigintDomain, bigintDomain, (a, b) => {
        expect(resultsMatch(multiply(a, b) as bigint, coreMultiply(a, b))).toBe(true);
      })
    );
  });

  it('multiply(Complex, Complex) and mixed number/Complex match core', () => {
    fc.assert(
      fc.property(cplxPart, cplxPart, cplxPart, cplxPart, (re1, im1, re2, im2) => {
        const a = new Complex(re1, im1);
        const b = new Complex(re2, im2);
        expect(resultsMatch(multiply(a, b), coreMultiply(a, b))).toBe(true);
      })
    );
    fc.assert(
      fc.property(numDomain, cplxPart, cplxPart, (n, re, im) => {
        const c = new Complex(re, im);
        expect(resultsMatch(multiply(n, c), coreMultiply(n, c))).toBe(true);
        expect(resultsMatch(multiply(c, n), coreMultiply(c, n))).toBe(true);
      })
    );
  });

  it('multiply(Fraction, Fraction) and mixed number/Fraction match core', () => {
    fc.assert(
      fc.property(fracP, fracQ, fracP, fracQ, (p1, q1, p2, q2) => {
        const a = new Fraction(p1, q1);
        const b = new Fraction(p2, q2);
        expect(resultsMatch(multiply(a, b), coreMultiply(a, b))).toBe(true);
      })
    );
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), fracP, fracQ, (n, p, q) => {
        const f = new Fraction(p, q);
        expect(resultsMatch(multiply(n, f), coreMultiply(n, f))).toBe(true);
        expect(resultsMatch(multiply(f, n), coreMultiply(f, n))).toBe(true);
      })
    );
  });

  it('multiply(BigNumber, BigNumber) and mixed number/BigNumber match core', () => {
    fc.assert(
      fc.property(numDomain, numDomain, (x, y) => {
        const a = bn(x);
        const b = bn(y);
        expect(resultsMatch(multiply(a, b), coreMultiply(a, b))).toBe(true);
        expect(resultsMatch(multiply(x, b), coreMultiply(x, b))).toBe(true);
        expect(resultsMatch(multiply(a, x), coreMultiply(a, x))).toBe(true);
      })
    );
  });

  // --- divide (non-commutative; divisor kept non-zero to avoid throw-noise
  // unrelated to typed-vs-core divergence — both sides call the identical
  // divide() method on a zero divisor, so that path can't diverge either way) ---
  it('divide(number, number) matches core, incl. div-by-zero/Infinity/NaN edge corpus', () => {
    fc.assert(
      fc.property(numDomain, numDomainNonZero, (a, b) => {
        expect(resultsMatch(divide(a, b), coreDivide(a, b))).toBe(true);
      })
    );
    for (const a of EDGE_NUMS)
      for (const b of EDGE_NUMS) {
        expect(resultsMatch(divide(a, b), coreDivide(a, b))).toBe(true);
      }
  });

  it('divide(bigint, bigint) matches core', () => {
    fc.assert(
      fc.property(bigintDomain, bigintDomainNonZero, (a, b) => {
        expect(resultsMatch(divide(a, b) as bigint, coreDivide(a, b))).toBe(true);
      })
    );
  });

  it('divide(Complex, Complex) and mixed number/Complex preserve order like core', () => {
    // Divisor magnitude is gated away from zero (`fc.pre`) rather than merely
    // "each part nonzero" — two denormal parts (e.g. ±5e-324) still produce a
    // near-zero-magnitude divisor, and Complex division on a near-zero divisor
    // is a genuine floating-point degenerate case (extreme catastrophic
    // rounding), not a typed-vs-core DIVERGENCE — both sides call the
    // identical `a.divide(b)`, so it can't diverge either way; it's simply
    // out of scope for this equivalence guard.
    fc.assert(
      fc.property(cplxPart, cplxPart, cplxPart, cplxPart, (re1, im1, re2, im2) => {
        fc.pre(re2 * re2 + im2 * im2 > 1e-6);
        const a = new Complex(re1, im1);
        const b = new Complex(re2, im2);
        expect(resultsMatch(divide(a, b), coreDivide(a, b))).toBe(true);
      })
    );
    fc.assert(
      fc.property(numDivisorSafe, cplxPart, cplxPart, (n, re, im) => {
        fc.pre(re * re + im * im > 1e-6);
        const c = new Complex(re, im);
        expect(resultsMatch(divide(n, c), coreDivide(n, c))).toBe(true);
        expect(resultsMatch(divide(c, n), coreDivide(c, n))).toBe(true);
      })
    );
  });

  it('divide(Fraction, Fraction) and mixed number/Fraction preserve order like core', () => {
    fc.assert(
      fc.property(fracP, fracQ, fracPNonZero, fracQ, (p1, q1, p2, q2) => {
        const a = new Fraction(p1, q1);
        const b = new Fraction(p2, q2);
        expect(resultsMatch(divide(a, b), coreDivide(a, b))).toBe(true);
      })
    );
    // `n` is used as a divisor too (f / n below), so it must be nonzero as well.
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }).filter((n) => n !== 0),
        fracPNonZero,
        fracQ,
        (n, p, q) => {
          const f = new Fraction(p, q);
          expect(resultsMatch(divide(n, f), coreDivide(n, f))).toBe(true);
          expect(resultsMatch(divide(f, n), coreDivide(f, n))).toBe(true);
        }
      )
    );
  });

  it('divide(BigNumber, BigNumber) and mixed number/BigNumber preserve order like core', () => {
    fc.assert(
      fc.property(numDomain, numDomainNonZero, (x, y) => {
        const a = bn(x);
        const b = bn(y);
        expect(resultsMatch(divide(a, b), coreDivide(a, b))).toBe(true);
        expect(resultsMatch(divide(x, b), coreDivide(x, b))).toBe(true);
        if (x !== 0) expect(resultsMatch(divide(a, x), coreDivide(a, x))).toBe(true);
      })
    );
  });

  // --- abs (unary; same-type one-liner forward on every branch) ------------
  it('abs(number) and abs(bigint) match core, incl. edge corpus', () => {
    fc.assert(
      fc.property(numDomain, (a) => {
        expect(resultsMatch(abs(a), coreAbs(a))).toBe(true);
      })
    );
    fc.assert(
      fc.property(bigintDomain, (a) => {
        expect(resultsMatch(abs(a) as bigint, coreAbs(a))).toBe(true);
      })
    );
    for (const a of EDGE_NUMS) {
      expect(resultsMatch(abs(a), coreAbs(a))).toBe(true);
    }
  });

  it('abs(Complex) matches core (magnitude, a plain number)', () => {
    fc.assert(
      fc.property(cplxPart, cplxPart, (re, im) => {
        const c = new Complex(re, im);
        expect(resultsMatch(abs(c) as number, coreAbs(c))).toBe(true);
      })
    );
  });

  it('abs(Fraction) matches core', () => {
    fc.assert(
      fc.property(fracP, fracQ, (p, q) => {
        const f = new Fraction(p, q);
        expect(resultsMatch(abs(f), coreAbs(f))).toBe(true);
      })
    );
  });

  it('abs(BigNumber) matches core', () => {
    fc.assert(
      fc.property(numDomain, (x) => {
        const a = bn(x);
        expect(resultsMatch(abs(a), coreAbs(a))).toBe(true);
      })
    );
  });
});
