/**
 * Issue #714 — public BigNumber construction (dogfood G11).
 * @module @danielsimonjr/mathts-core/tests/types/bignumber-constructor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BigNumber, bignumber } from '../../src/types/bignumber.js';

describe('BigNumber public construction (#714)', () => {
  beforeEach(() => {
    BigNumber.resetConfig();
  });

  it('exact repro: new BigNumber(1).toString() is "1"', () => {
    const x = new BigNumber(1);
    expect(x.toString()).toBe('1');
    expect(x.toNumber()).toBe(1);
    expect(x.isBigNumber).toBe(true);
  });

  it('BigNumber.from matches new BigNumber for documented inputs', () => {
    expect(new BigNumber(42).toString()).toBe(BigNumber.from(42).toString());
    expect(new BigNumber('0.1').toString()).toBe(BigNumber.from('0.1').toString());
    expect(new BigNumber(123n).toString()).toBe(BigNumber.from(123n).toString());
    const bn = BigNumber.parse('3.14');
    expect(new BigNumber(bn)).toBe(bn);
  });

  it('bignumber() factory matches mathjs-style dispatch', () => {
    expect(bignumber(0.1).add(bignumber(0.2)).toString()).toBe('0.3');
    expect(bignumber('7.2e500').toString()).toBe(bignumber('7.2e500').toString());
    expect(bignumber().toString()).toBe('0');
    const x = bignumber('1.5');
    expect(bignumber(x)).toBe(x);
  });

  it('rejects invalid constructor inputs with a clear TypeError', () => {
    expect(() => new BigNumber(null as unknown as number)).toThrow(TypeError);
    expect(() => new BigNumber(null as unknown as number)).toThrow(/number, string, bigint/);
    expect(() => new BigNumber({} as unknown as number)).toThrow(TypeError);
    expect(() => new BigNumber([1] as unknown as number)).toThrow(TypeError);
  });

  it('BigNumber.config precision applies to constructed values', () => {
    BigNumber.config({ precision: 5 });
    const x = new BigNumber(1).div(3);
    expect(x.toSignificantDigits().toString()).toBe('0.33333');
    expect(new BigNumber('1').div(new BigNumber('3')).toSignificantDigits().toString()).toBe(
      '0.33333'
    );
  });

  it('decimal.js / mathjs parity samples for common literals', () => {
    expect(new BigNumber('0.1').add(new BigNumber('0.2')).toString()).toBe('0.3');
    expect(new BigNumber('-2.5').round().toString()).toBe('-3');
    expect(new BigNumber('1e-7').toExponential()).toBe('1e-7');
  });
});
