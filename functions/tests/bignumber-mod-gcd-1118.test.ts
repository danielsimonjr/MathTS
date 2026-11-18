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
