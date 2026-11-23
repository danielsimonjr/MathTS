/**
 * The BigNumber rows of `mod` (typed and factory) use the same rule as the number kernel: the floor
 * of the quotient snaps to the nearest integer within the live `relTol` and `absTol`, so
 * `mod(2.9999999999999999999999, 1)` is -1e-22 (mathjs 15.2.0) and not 0.9999999999999999999999.
 * The exact remainder stays for two integers and for a quotient that does not snap (#1118).
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const mt = math as unknown as Record<string, Fn>;
const mj = mathjs as unknown as Record<string, Fn>;

const big = (s: string): unknown => mt.bignumber(s);
const mbig = (s: string): unknown => mj.bignumber(s);
/** The decimal string of a BigNumber of either library. */
const text = (v: unknown): string => (v as { toString(): string }).toString();
const isNegativeZero = (v: unknown): boolean =>
  Object.is((v as { toNumber(): number }).toNumber(), -0);

/** Pairs whose quotient is within `relTol` (1e-12) of an integer, but is not an integer. */
const SNAPPING: ReadonlyArray<readonly [string, string]> = [
  ['2.9999999999999999999999', '1'],
  ['1.0000000000000000000001', '1'],
  ['0.30000000000000000000000001', '0.1'],
  ['-2.9999999999999999999999', '1'],
  ['-2.9999999999999999999999', '-1'],
  ['2.9999999999999999999999', '-1'],
  ['0.2999999999999999999999', '0.1'],
  ['12345.99999999999999', '0.5'],
  ['7.4999999999999999999', '2.5'],
];

describe('BigNumber mod snaps the floor of the quotient as mathjs does', () => {
  for (const [a, b] of SNAPPING) {
    it(`mod(${a}, ${b}) equals mathjs, typed and factory`, () => {
      const expected = mj.mod(mbig(a), mbig(b)) as { toNumber(): number };
      for (const mod of [mt.mod, mt.factory_mod]) {
        const result = mod(big(a), big(b)) as { eq(x: string): boolean; toNumber(): number };
        expect(result.eq(text(expected)), `${text(result)} vs ${text(expected)}`).toBe(true);
        expect(Object.is(result.toNumber(), -0)).toBe(Object.is(expected.toNumber(), -0));
      }
    });
  }

  it('agrees in sign and size with the number kernel', () => {
    // 3 - 1e-13 is 2.9999999999997 as a double, and as a BigNumber string.
    const n = mt.mod(3 - 1e-13, 1) as number;
    const b = mt.mod(big('2.9999999999999'), big('1')) as { toNumber(): number };
    expect(n).toBeLessThan(0);
    expect(b.toNumber()).toBeLessThan(0);
    expect(Math.abs(b.toNumber())).toBeLessThan(1e-12);
  });
});

describe('BigNumber mod keeps the exact remainder where no snap applies', () => {
  it('two integers: mod(1700006399999, 86400000) is 86399999 as the number kernel gives it', () => {
    expect(text(mt.mod(big('1700006399999'), big('86400000')))).toBe('86399999');
    expect(text(mt.factory_mod(big('1700006399999'), big('86400000')))).toBe('86399999');
  });

  it('a quotient that is wider than the precision does not round (#1118)', () => {
    const x = '1' + '0'.repeat(70) + '.5';
    const expected = (BigInt('1' + '0'.repeat(70)) % 7n).toString();
    // 10^70 mod 7 with a fractional part of 0.5: the integer part of the remainder is exact.
    const result = text(mt.mod(big(x), big('7')));
    expect(result.startsWith(expected + '.5') || result === `${expected}.5`).toBe(true);
  });

  it('a zero divisor returns the dividend; a non-finite operand gives NaN', () => {
    expect(text(mt.mod(big('2.5'), big('0')))).toBe('2.5');
    expect(text(mt.mod(big('Infinity'), big('3')))).toBe('NaN');
    expect(text(mt.mod(big('3'), big('Infinity')))).toBe('NaN');
    expect(text(mt.mod(big('NaN'), big('3')))).toBe('NaN');
  });

  it('a result of 0 has no negative sign', () => {
    expect(isNegativeZero(mt.mod(big('-4'), big('2')))).toBe(false);
    expect(isNegativeZero(mt.mod(big('0'), big('-4')))).toBe(false);
  });

  it('the precision of the class is the same after a snapped call', () => {
    const BigNumberClass = (big('1') as { constructor: { precision: number } }).constructor;
    const before = BigNumberClass.precision;
    mt.mod(big('2.9999999999999999999999'), big('1'));
    mt.mod(big('5.5'), big('-2'));
    expect(BigNumberClass.precision).toBe(before);
  });
});
