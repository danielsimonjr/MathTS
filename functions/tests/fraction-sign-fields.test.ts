import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { fix, fraction, isInteger, isNegative, isPositive, isZero } from '../src/index.js';

const FRACTION_SIG = /Fraction\s*:/;
const FIELD_READ = /\b(x|[\w]+)\s*\.\s*(s|n|d)\b|\b(x|[\w]+)\s*\[\s*['"](s|n|d)['"]\s*\]/g;

function scanFractionFieldReads(source: string): string[] {
  const hits: string[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!FRACTION_SIG.test(lines[i]!)) continue;
    const window = lines.slice(i, Math.min(i + 12, lines.length)).join('\n');
    FIELD_READ.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FIELD_READ.exec(window))) {
      hits.push(`${i + 1}: ${m[0]}`);
    }
  }
  return hits;
}

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../src');

describe('#1551 Fraction sign / integer fields (native factories)', () => {
  it('isPositive / isNegative / isZero / isInteger / fix use the Fraction API', () => {
    const third = fraction(1, 3) as Fraction;
    const neg = fraction(-1, 3) as Fraction;
    const whole = fraction(2) as Fraction;
    const halfNeg = fraction(-5, 2) as Fraction;

    expect(isPositive(third)).toBe(true);
    expect(isNegative(neg)).toBe(true);
    expect(isPositive(neg)).toBe(false);
    expect(isZero(fraction(0))).toBe(true);
    expect(isInteger(whole)).toBe(true);
    expect(isInteger(third)).toBe(false);
    expect(String(fix(halfNeg))).toBe(String(new Fraction(-2n, 1n)));
    expect(String(fix(fraction(5, 2)))).toBe(String(new Fraction(2n, 1n)));

    expect(isPositive([third, neg, whole, fraction(0)])).toEqual([true, false, true, false]);
  });

  it('does not read fraction.js .s / .n / .d on Fraction signatures', () => {
    const files = [
      'utils/isPositive.ts',
      'utils/isNegative.ts',
      'utils/isInteger.ts',
      'arithmetic/fix.ts',
      'arithmetic/pow.ts',
    ];
    for (const rel of files) {
      const source = readFileSync(join(srcRoot, rel), 'utf8');
      expect(scanFractionFieldReads(source), rel).toEqual([]);
    }
  });
});
