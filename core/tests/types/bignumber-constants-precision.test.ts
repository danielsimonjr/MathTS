/**
 * The exported BigNumber constants and the π of the exact unit scales hold at least the digits of
 * the default precision (64). Before the fix, the constants were 51-digit literals, and a
 * BigNumber `deg` value converted with that π. The reference digits below are independent of the
 * series in `bignumber.ts`.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/types/unit';
import {
  BigNumber,
  BIGNUMBER_PI,
  BIGNUMBER_E,
  BIGNUMBER_LN2,
  BIGNUMBER_LN10,
} from '../../src/types/bignumber';

const PI =
  '3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117';
const E =
  '2.718281828459045235360287471352662497757247093699959574966967627724076630353547594571382178525166427';
const LN2 =
  '0.693147180559945309417232121458176568075500134360255254120680009493393621969694715605863326996418687';
const LN10 =
  '2.302585092994045684017991454684364207601101488628772976033327900967572609677352480235997205089598298';

/** The significant digits of a decimal string, without the sign, the point and leading zeros. */
function digits(text: string): string {
  return text.replace(/^-/, '').replace('.', '').replace(/^0+/, '');
}

/** The significant digits of `text` rounded half up to `n` digits. */
function rounded(text: string, n: number): string {
  const d = digits(text).padEnd(n + 1, '0');
  const up = BigInt(d.slice(0, n)) + (Number(d[n]) >= 5 ? 1n : 0n);
  return up.toString().slice(0, n);
}

/** Expect `value` to equal `reference` rounded to `n` significant digits. */
function expectDigits(value: { toString(): string }, reference: string, n: number): void {
  expect(rounded(value.toString(), n)).toBe(rounded(reference, n));
}

describe('BigNumber constants at the default precision', () => {
  it('the default precision is 64 digits', () => {
    expect(BigNumber.precision).toBe(64);
  });

  it.each([
    ['BIGNUMBER_PI', BIGNUMBER_PI, PI],
    ['BIGNUMBER_E', BIGNUMBER_E, E],
    ['BIGNUMBER_LN2', BIGNUMBER_LN2, LN2],
    ['BIGNUMBER_LN10', BIGNUMBER_LN10, LN10],
  ])('%s holds 64 correct digits', (_name, value, reference) => {
    expectDigits(value, reference, 64);
  });

  it.each([
    ['piAt', () => BigNumber.piAt(80), PI],
    ['eAt', () => BigNumber.eAt(80), E],
    ['ln2At', () => BigNumber.ln2At(80), LN2],
    ['ln10At', () => BigNumber.ln10At(80), LN10],
  ])('%s(80) holds 80 correct digits', (_name, at, reference) => {
    expectDigits(at(), reference, 80);
  });

  it('a BigNumber deg value converts with π at the configured precision', () => {
    const rad = new Unit(BigNumber.fromNumber(180), 'deg').toSI().value as unknown as {
      toString(): string;
    };
    expectDigits(rad, PI, 64);
  });
});
