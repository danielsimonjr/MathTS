/**
 * #1166 item 1 (zeta of a BigNumber is correct to the precision): a BigNumber is exact, so the
 * pole at 1, the value at 0 and the trivial zeros need no tolerance. zetaNumeric compared with
 * config.relTol and config.absTol (1e-12): 1 + 1e-25 gave NaN and 1e-40 gave -0.5. The reflection
 * formula gave a value that is not 0 for a negative even integer.
 *
 * Oracle: mpmath 1.3.0, rounded half up to the precision.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

type AnyFn = (...args: unknown[]) => unknown;
const zeta = (s: string): unknown =>
  ((f as unknown as Record<string, AnyFn>).zeta as AnyFn)(BigNumber.parse(s));
const eq = (actual: unknown, literal: string): void => {
  expect(actual).toBeInstanceOf(BigNumber);
  expect(String(actual)).toBe(String(BigNumber.parse(literal)));
};

afterEach(() => BigNumber.resetConfig());

describe('zeta of a BigNumber close to 1 and 0', () => {
  it.each([
    [
      '1.0000000000000000000000001',
      '10000000000000000000000000.57721566490153286060651209736398697941',
    ],
    ['1.0000000000000001', '10000000000000000.57721566490153286788809663845007486864898095907'],
    [
      '0.9999999999999999999999999999999999999999',
      '-9999999999999999999999999999999999999999.422784335098467139393488',
    ],
    ['1e-40', '-0.5000000000000000000000000000000000000000918938533204672741780330'],
    ['1e-15', '-0.5000000000000009189385332046737449585576906990440301058878820258'],
  ])('zeta(%s) at precision 64', { timeout: 20000 }, (s, expected) => {
    BigNumber.config({ precision: 64 });
    eq(zeta(s), expected);
  });

  it('zeta(1) is NaN and zeta(0) is -1/2', () => {
    BigNumber.config({ precision: 64 });
    expect(String(zeta('1'))).toBe('NaN');
    eq(zeta('0'), '-0.5');
  });
});

describe('zeta of a negative even integer is exactly 0', () => {
  it.each([[20], [64]])('precision %i', (precision) => {
    BigNumber.config({ precision });
    for (const s of ['-2', '-10', '-20', '-100', '-1000']) {
      expect(String(zeta(s)), s).toBe('0');
    }
  });
});
