import { afterEach, describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

/**
 * #1118: BigNumber add and multiply round to config.precision. The factory mod computed
 * x - y * floor(x / y), and the rounded product gave a wrong remainder for integers longer than the
 * precision, so the factory gcd was wrong too. isPrime squared values with no precision raise.
 * Oracle: Python 3 (`%`, `math.gcd`, a deterministic Miller-Rabin test).
 */
type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const b = (v: string): BigNumber => BigNumber.parse(v);
const str = (x: unknown): string => String(x);

afterEach(() => {
  BigNumber.resetConfig();
});

const X = '987654321098765432109876';
const Y = '123456789012345';

describe('#1118 factory mod and gcd of integers longer than the precision', () => {
  for (const precision of [20, 64]) {
    it(`factory_mod and factory_gcd are exact at precision ${precision}`, () => {
      BigNumber.config({ precision });
      expect(str(fn('factory_mod')(b(X), b(Y)))).toBe('111116623221036');
      expect(str(fn('factory_gcd')(b(X), b(Y)))).toBe('3');
      // The floored mod takes the sign of the divisor.
      expect(str(fn('factory_mod')(b(X), b('-' + Y)))).toBe('-12340165791309');
      expect(str(fn('factory_mod')(b('-' + X), b(Y)))).toBe('12340165791309');
      // The sum remainder + divisor has more digits than the precision, and it does not round.
      expect(str(fn('factory_mod')(b('-1'), b('1e30')))).toBe('999999999999999999999999999999');
      expect(str(fn('factory_mod')(b('7'), b('-3')))).toBe('-2');
      expect(str(fn('factory_mod')(b('-7.5'), b('2')))).toBe('0.5');
      expect(str(fn('factory_mod')(b('6'), b('3')))).toBe('0');
    });
  }

  it('factory_xgcd and factory_invmod stay exact at precision 20', () => {
    BigNumber.config({ precision: 20 });
    const res = fn('factory_xgcd')(b(X), b(Y)) as { toArray?: () => unknown[] } | unknown[];
    const [g, s, t] = (Array.isArray(res) ? res : res.toArray!()) as BigNumber[];
    expect([g, s, t].map(String)).toEqual(['3', '5330323120803', '-42642585355004793538465']);
    BigNumber.config({ precision: 100 });
    expect(b(X).multiply(s).add(b(Y).multiply(t)).toString()).toBe('3');
    BigNumber.config({ precision: 20 });
    expect(str(fn('invmod')(b('3'), b('100000000000000000000000000007')))).toBe(
      '33333333333333333333333333336'
    );
    expect(BigNumber.precision).toBe(20);
  });

  it('the precision is restored after the floored add', () => {
    BigNumber.config({ precision: 20 });
    fn('factory_mod')(b('-1'), b('1e30'));
    expect(BigNumber.precision).toBe(20);
  });
});

describe('#1118 isPrime of a BigNumber above 2^32', () => {
  const cases: [string, boolean][] = [
    ['2305843009213693951', true], // 2^61 - 1
    ['100000000000000000039', true],
    ['100000000000000000041', false],
    [String((2n ** 31n - 1n) * (2n ** 61n - 1n)), false],
    // Above 3.3e24 the large-n branch runs: 2^89 - 1 and 2^127 - 1.
    ['618970019642690137449562111', true],
    [String(2n ** 127n - 1n), true],
  ];
  for (const precision of [20, 64]) {
    it(`gives the Miller-Rabin answer at precision ${precision}`, () => {
      BigNumber.config({ precision });
      for (const [n, prime] of cases) {
        expect(fn('isPrime')(b(n)), n).toBe(prime);
      }
      expect(BigNumber.precision).toBe(precision);
    });
  }
});

/**
 * Integer functions whose steps were exact before add and multiply rounded. Each one runs its
 * steps with guard digits and rounds the result one time.
 * Oracle: Python 3 integers (`math.lcm`, `math.comb`, `math.factorial`, a Bell triangle), rounded
 * one time with `decimal` (ROUND_HALF_UP).
 */
describe('#1118 integer functions give the exact value, rounded one time', () => {
  const zeros = (n: number): string => '0'.repeat(n);

  it('lcm of operands whose product is longer than the precision', () => {
    BigNumber.config({ precision: 20 });
    for (const lcm of [fn('lcm'), fn('factory_lcm')]) {
      // The result fits the precision: it is exact.
      expect(str(lcm(b('12339999959278'), b('43209999857407')))).toBe('53321139824040238');
      // The exact value is 60966315568292943087588.
      expect(str(lcm(b('123456789012'), b('987654321098')))).toBe('60966315568292943088000');
      expect(str(lcm(b('9876543210987654321098765'), b('5')))).toBe('9876543210987654321100000');
    }
    expect(BigNumber.precision).toBe(20);
  });

  it('composition and catalan (the binomial product)', () => {
    BigNumber.config({ precision: 20 });
    // C(69, 34) has 20 digits: exact.
    expect(str(fn('composition')(b('70'), b('35')))).toBe('56093138908331422716');
    // The Catalan number has 19 digits, and C(70, 35) has 21 digits.
    expect(str(fn('catalan')(b('35')))).toBe('3116285494907301262');
    // The exact value is 2622127042276492108820.
    expect(str(fn('catalan')(b('40')))).toBe('2622127042276492108800');
    expect(str(fn('catalan')(b('100')))).toBe('89651994709013149669' + zeros(37));
    BigNumber.config({ precision: 64 });
    expect(str(fn('catalan')(b('100')))).toBe(
      '896519947090131496687170070074100632420837521538745909320'
    );
    expect(str(fn('composition')(b('301'), b('151')))).toBe(
      '9375970277282745279319375443906408487923265570008135892047235271' + zeros(25)
    );
    expect(BigNumber.precision).toBe(64);
  });

  it('bellNumbers', () => {
    BigNumber.config({ precision: 20 });
    expect(str(fn('bellNumbers')(b('25')))).toBe('4638590332229999353');
    // The exact value is 846749014511809332450147.
    expect(str(fn('bellNumbers')(b('30')))).toBe('846749014511809332450000');
    expect(str(fn('bellNumbers')(b('100')))).toBe('47585391276764833659' + zeros(96));
    BigNumber.config({ precision: 64 });
    expect(str(fn('bellNumbers')(b('100')))).toBe(
      '4758539127676483365879076884138720782636366968682561146661633464' + zeros(52)
    );
    expect(BigNumber.precision).toBe(64);
  });

  it('factorial and gamma', () => {
    BigNumber.config({ precision: 20 });
    expect(str(fn('factorial')(b('21')))).toBe('51090942171709440000');
    expect(str(fn('factorial')(b('30')))).toBe('26525285981219105864' + zeros(13));
    expect(str(fn('gamma')(b('31')))).toBe('26525285981219105864' + zeros(13));
    expect(str(fn('factorial')(b('60')))).toBe('83209871127413901443' + zeros(62));
    expect(str(fn('factorial')(b('100')))).toBe('93326215443944152682' + zeros(138));
    BigNumber.config({ precision: 64 });
    expect(str(fn('factorial')(b('60')))).toBe(
      '8320987112741390144276341183223364380754172606361245952449277696' + zeros(18)
    );
    expect(BigNumber.precision).toBe(64);
  });

  it('log1p keeps an argument that 1 + x loses (oracle: mpmath)', () => {
    BigNumber.config({ precision: 20 });
    for (const log1p of [fn('log1p'), fn('factory_log1p')]) {
      expect(str(log1p(b('1e-25')))).toBe('0.0000000000000000000000001');
      expect(str(log1p(b('1e-40')))).toBe(b('1e-40').toString());
      expect(str(log1p(b('1e-10')))).toBe('0.000000000099999999995');
      expect(str(log1p(b('-0.3')))).toBe('-0.35667494393873237891');
      expect(str(log1p(b('3')))).toBe('1.3862943611198906188');
      expect(str(log1p(b('-1')))).toBe('-Infinity');
    }
  });
});
