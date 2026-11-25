import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Issue #1551: the `Fraction` signatures of `isPositive` / `isNegative` read the
 * fraction.js field names `x.s` / `x.n`, which are `undefined` on the MathTS `Fraction`
 * type (`numerator` / `denominator`), so the predicates always returned `false`.
 *
 * The fix routes the predicates through the Fraction's own API. This scan fails when any
 * `Fraction:` signature in these two files touches `.s`, `.n`, or `.d` again, so a
 * regression to the fraction.js field names cannot be reintroduced silently.
 */

const FILES = [
  new URL('../src/utils/isPositive.ts', import.meta.url),
  new URL('../src/utils/isNegative.ts', import.meta.url),
];

// A signature line like `Fraction: (x): boolean => x.s > 0n` — the field reads that were
// the bug. Method calls (`x.isPositive()`) do not match this pattern.
const FRACTION_FIELD_ACCESS = /\.(s|n|d)\b(?!\()/;

describe('fraction sign fields (#1551)', () => {
  for (const file of FILES) {
    const path = file.pathname;
    const source = readFileSync(file, 'utf8');

    it(`${path} has no Fraction signature reading .s / .n / .d`, () => {
      const fractionLines = source
        .split('\n')
        .filter((line) => /^\s*['"]?Fraction['"]?:/.test(line));
      expect(fractionLines.length, 'the file must still have a Fraction signature').toBeGreaterThan(
        0
      );

      const offenders = fractionLines.filter((line) => FRACTION_FIELD_ACCESS.test(line));
      expect(
        offenders,
        `Fraction signatures must use the Fraction API (isPositive/isNegative/isZero), not the fraction.js fields .s/.n/.d`
      ).toEqual([]);
    });

    it(`${path} routes the Fraction signature through the Fraction's own sign API`, () => {
      expect(
        /Fraction['"]?:.*\.is(Positive|Negative|Zero)\(\)/.test(source),
        'expected the Fraction signature to call isPositive() / isNegative() / isZero()'
      ).toBe(true);
    });
  }
});
