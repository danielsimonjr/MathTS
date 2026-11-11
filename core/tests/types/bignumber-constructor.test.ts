/**
 * Issue #714 — public BigNumber construction (dogfood G11).
 * @module @danielsimonjr/mathts-core/tests/types/bignumber-constructor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BigNumber, bignumber, isBigNumber } from '../../src/types/bignumber.js';
import { mathTyped } from '../../src/typed/mathts-typed.js';

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
    const copy = new BigNumber(bn);
    expect(copy).not.toBe(bn);
    expect(copy.toString()).toBe('3.14');
    expect(copy.equals(bn)).toBe(true);
    expect(BigNumber.from(bn)).toBe(bn);
  });

  it('does not treat a second argument as an internal coefficient', () => {
    const Ctor = BigNumber as unknown as new (...args: unknown[]) => BigNumber;
    expect(() => new Ctor(1, 2)).toThrow(TypeError);
    expect(() => new Ctor(1, 2)).toThrow(/one argument/);
    expect(() => new Ctor(1, 2n)).toThrow(TypeError);
    expect(() => new Ctor('ff', 16)).toThrow(/one argument/);
  });

  it('number, string, bigint, NaN, Infinity, -0, and whitespace', () => {
    expect(new BigNumber(0).isZero()).toBe(true);
    expect(new BigNumber(-0).isZero()).toBe(true);
    expect(new BigNumber(-0).toString()).toBe('0');
    expect(new BigNumber(-0).toNumber()).toBe(0);
    expect(new BigNumber(NaN).isNaN()).toBe(true);
    expect(new BigNumber(NaN).toString()).toBe('NaN');
    expect(new BigNumber(Infinity).isInfinite()).toBe(true);
    expect(new BigNumber(Infinity).toString()).toBe('Infinity');
    expect(new BigNumber(-Infinity).toString()).toBe('-Infinity');
    expect(new BigNumber('  1.50 ').toString()).toBe('1.5');
    expect(new BigNumber('1.23e-4').toString()).toBe('0.000123');
    expect(new BigNumber('+7.2e+2').toString()).toBe('720');
    expect(new BigNumber(10n).toString()).toBe('10');
    expect(() => new BigNumber('0x10')).toThrow(SyntaxError);
    expect(() => new BigNumber('0b10')).toThrow(SyntaxError);
    expect(() => new BigNumber('')).toThrow(/empty string/);
    expect(() => new BigNumber('   ')).toThrow(/empty string/);
    expect(() => new BigNumber('abc')).toThrow(SyntaxError);
    expect(() => new BigNumber('1.2.3')).toThrow(SyntaxError);
    expect(() => new BigNumber('1e')).toThrow(SyntaxError);
    expect(() => new BigNumber('1e+')).toThrow(SyntaxError);
  });

  it('instanceof and typed-function dispatch see constructed values', () => {
    const x = new BigNumber('0.1');
    expect(x).toBeInstanceOf(BigNumber);
    expect(isBigNumber(x)).toBe(true);
    const add = mathTyped('add', {
      'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.add(b),
      'number, number': (a: number, b: number) => a + b,
    });
    const sum = add(x, new BigNumber('0.2'));
    expect(sum).toBeInstanceOf(BigNumber);
    expect(isBigNumber(sum)).toBe(true);
    if (sum instanceof BigNumber) expect(sum.toString()).toBe('0.3');
    expect(add(1, 2)).toBe(3);
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
