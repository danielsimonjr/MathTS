/**
 * Native Fraction sign fields (#1551).
 *
 * Root cause: `isPositive` / `isNegative` (and `fix`) compared `x.s` / `x.n`, the
 * fraction.js layout. MathTS `Fraction` stores `numerator` / `denominator` and exposes
 * `isPositive()` / `isNegative()`. `x.s` is undefined, so every Fraction looked
 * non-positive.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { fix, fraction, isNegative, isPositive, isZero, matrix } from '../src/index.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../src');

function assertNoFractionJsFields(rel: string): void {
  const text = readFileSync(join(srcRoot, rel), 'utf8');
  expect(text, `${rel} must mention Fraction`).toMatch(/Fraction/);
  expect(text, `${rel} must not read fraction.js fields .s/.n/.d`).not.toMatch(
    /\bx\.[snd]\b/
  );
}

describe('Fraction sign fields (#1551)', () => {
  it('isPositive / isNegative / isZero on scalars', () => {
    expect(isPositive(fraction(2))).toBe(true);
    expect(isPositive(fraction(1, 3))).toBe(true);
    expect(isPositive(fraction(-2, 5))).toBe(false);
    expect(isPositive(fraction(0))).toBe(false);
    expect(isNegative(fraction(-2, 5))).toBe(true);
    expect(isNegative(fraction(2))).toBe(false);
    expect(isNegative(fraction(0))).toBe(false);
    expect(isZero(fraction(0))).toBe(true);
    expect(isZero(fraction(1, 3))).toBe(false);
  });

  it('isPositive of an array and a matrix of Fractions', () => {
    expect(isPositive([fraction(2), fraction(-1)])).toEqual([true, false]);
    const m = matrix([[fraction(2), fraction(-1)]]);
    const mapped = isPositive(m) as { toArray(): unknown };
    expect(mapped.toArray()).toEqual([[true, false]]);
  });

  it('fix of a negative Fraction uses isNegative, not fraction.js s', () => {
    expect(String(fix(fraction(-3, 2)))).toBe('-1');
    expect(String(fix(fraction(5, 2)))).toBe('2');
  });

  it('source does not read fraction.js s/n/d on Fraction', () => {
    assertNoFractionJsFields('utils/isPositive.ts');
    assertNoFractionJsFields('utils/isNegative.ts');
    assertNoFractionJsFields('arithmetic/fix.ts');
  });
});
