/**
 * #1115: `factorial` of a BigNumber multiplied n terms for every n, so n = 1e9 never returned.
 * Above n = 10000 it uses the Stirling series.
 *
 * Oracles: mpmath 1.3.0 (ln(n!) through loggamma), and the exact bigint product.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const bn = (s: string | number): BigNumber => BigNumber.parse(String(s));
const eq = (actual: unknown, literal: string): void => {
  expect(actual).toBeInstanceOf(BigNumber);
  expect(String(actual)).toBe(String(bn(literal)));
};
/** The number of significant digits of a BigNumber. */
const digits = (x: unknown): number =>
  String(x)
    .replace(/[-.]|e.*$/g, '')
    .replace(/^0+/, '').length;

afterEach(() => BigNumber.resetConfig());

describe('#1115: factorial of a large BigNumber', () => {
  const factorial = (n: number | string): unknown => fn('factorial')(bn(n));
  /**
   * Python's exact `math.factorial(n)`, rounded half up to 64 digits (the BigNumber default). The
   * product of 20000 terms is the oracle of the exact path, and a bigint product of that size takes
   * more than 10 seconds in JavaScriptCore, so the test holds the digits and does not compute them.
   */
  const FACTORIAL_10000 =
    '2.846259680917054518906413212119868890148051401702799230794179994e+35659';
  const FACTORIAL_10001 =
    '2.846544306885146224358303853441080877037066206842969510717259412e+35663';
  const FACTORIAL_20000 =
    '1.819206320230345134827641756866458766071609901478752648918062219e+77337';
  const FACTORIAL_20000_P20 = '1.8192063202303451348e+77337';
  const FACTORIAL_20000_P150 =
    '1.81920632023034513482764175686645876607160990147875264891806221863456946103855753445383609582775872473917750238418991204167124538392657686572347546452e+77337';

  it('factorial(10000) (exact path) equals the exact product', { timeout: 20000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(factorial(10000), FACTORIAL_10000);
  });

  it('factorial(10001) (first Stirling n) equals the exact product', { timeout: 20000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(factorial(10001), FACTORIAL_10001);
    // mpmath: 2.8465443068851462244e35663
    eq((factorial(10001) as BigNumber).toSignificantDigits(20), '2.8465443068851462244e35663');
  });

  it('factorial(20000) (Stirling) equals the exact product', { timeout: 20000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(factorial(20000), FACTORIAL_20000);
  });

  it('factorial(20000) is correct at precision 20 and 150', { timeout: 20000 }, () => {
    BigNumber.config({ precision: 20 });
    eq(factorial(20000), FACTORIAL_20000_P20);
    BigNumber.config({ precision: 150 });
    eq(factorial(20000), FACTORIAL_20000_P150);
  });

  it('factorial(3e5) returns (item 1 of the issue)', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    const r = factorial(300000) as BigNumber;
    expect(r.e).toBe(1512851);
    expect(String(r.toSignificantDigits(15))).toMatch(/^1\.47739153173804e\+1512851$/);
  });

  it('factorial(1e9) returns a finite value', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    const r = factorial(1e9) as BigNumber;
    expect(r.isFinite()).toBe(true);
    // log10(1e9!) = lgamma(1e9 + 1) / ln 10 = 8565705522.99583810...
    expect(r.e).toBe(8565705522);
    expect(String(r.toSignificantDigits(15))).toBe(String(bn('9.90462657922299e8565705522')));
    expect(digits(r)).toBeLessThanOrEqual(64);
  });

  it('factorial of a BigNumber above the exponent range is Infinity', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    expect((factorial('1e20') as BigNumber).isFinite()).toBe(false);
  });

  it('factorial of a small BigNumber is exact', () => {
    BigNumber.config({ precision: 64 });
    expect(String(factorial(20))).toBe('2432902008176640000');
    let product = 1n;
    for (let k = 2n; k <= 170n; k++) product *= k;
    expect(String(factorial(170))).toBe(String(BigNumber.fromBigInt(product).roundToPrecision(64)));
  });
});
