/**
 * #1166 (items 1 and 2): `zeta` of a BigNumber was correct to 8 digits only, because the Borwein
 * term count came from `config.relTol`; `expm1` of a BigNumber in the function layer was
 * `exp(x) - 1`, which is 0 for a small x.
 *
 * Oracle: mpmath 1.3.0 (every constant below has 64 significant digits or more).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { create, all } from '@danielsimonjr/mathts-compat';
import * as f from '../src/index.js';
import { expm1 as typedExpm1 } from '../src/typed/arithmetic.js';

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

describe('#1166 item 2: expm1 of a small BigNumber keeps the argument', () => {
  it('the typed and the factory expm1 return 1e-70 for 1e-70', () => {
    BigNumber.config({ precision: 64 });
    eq(typedExpm1(bn('1e-70')), '1e-70');
    eq(fn('factory_expm1')(bn('1e-70')), '1e-70');
    eq(fn('expm1')(bn('1e-70')), '1e-70');
  });

  it('compat and the expression parser return 1e-70 for 1e-70', () => {
    const math = create(all, { number: 'BigNumber', precision: 64 }) as unknown as {
      expm1: (x: unknown) => unknown;
      bignumber: (x: string) => unknown;
      evaluate: (expr: string) => unknown;
    };
    eq(math.expm1(math.bignumber('1e-70')), '1e-70');
    eq(math.evaluate('expm1(1e-70)'), '1e-70');
  });

  it('expm1(1e10) and expm1(-1e10) do not throw', () => {
    BigNumber.config({ precision: 64 });
    eq(typedExpm1(bn('-1e10')), '-1');
    eq(fn('factory_expm1')(bn('-1e10')), '-1');
  });
});

describe('#1166 item 1: zeta of a BigNumber is correct to the precision', () => {
  const zeta = (x: string): unknown => fn('zeta')(bn(x));

  it('zeta(2) is pi^2 / 6 to 64 digits', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    const z = zeta('2');
    eq(z, '1.644934066848226436472415166646025189218949901206798437735558229');
    expect(digits(z)).toBeLessThanOrEqual(64);
  });

  it('zeta(4) is pi^4 / 90 to 64 digits', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    const z = zeta('4');
    eq(z, '1.082323233711138191516003696541167902774750951918726907682976215');
    expect(digits(z)).toBeLessThanOrEqual(64);
  });

  it('zeta(3) is the Apery constant to 64 digits', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(zeta('3'), '1.202056903159594285399738161511449990764986292340498881792271555');
  });

  it('zeta(-1) is -1/12 to 64 digits (the reflection path)', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(zeta('-1'), '-0.08333333333333333333333333333333333333333333333333333333333333333');
  });

  it('zeta(2) follows a precision of 20 and of 120', { timeout: 20000 }, () => {
    BigNumber.config({ precision: 20 });
    eq(zeta('2'), '1.6449340668482264365');
    BigNumber.config({ precision: 120 });
    eq(
      zeta('2'),
      '1.64493406684822643647241516664602518921894990120679843773555822937000747040320087383362890061975870530400431896233719068'
    );
  });

  it('zeta of a number is unchanged', () => {
    expect(fn('zeta')(2)).toBeCloseTo(1.6449340668482264, 12);
  });
});
