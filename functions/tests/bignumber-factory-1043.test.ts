import { afterEach, describe, it, expect } from 'vitest';
import { BigNumber, Complex, Fraction } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

/**
 * #1043: the factory layer was ported from mathjs and calls decimal.js names on core's BigNumber.
 * Before the fix, factory_norm, pow, gcd, lcm, expm1, log1p, nthRoot, round, sign and unaryMinus
 * threw for BigNumber input. The typed norm and hypot returned a double.
 */
type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const b = (v: string | number): BigNumber => new BigNumber(v);
const str = (x: unknown): string => {
  expect(x).toBeInstanceOf(BigNumber);
  return (x as BigNumber).toString();
};

afterEach(() => {
  BigNumber.resetConfig();
});

describe('#1043 factory functions with BigNumber input', () => {
  it('factory_norm of a BigNumber vector is sqrt of the sum of squares, exact', () => {
    expect(str(fn('factory_norm')([b('3'), b('4')]))).toBe('5');
    expect(str(fn('factory_norm')([b('0.1'), b('0.2')]))).toBe(b('0.05').sqrt().toString());
    expect(str(fn('factory_norm')([b('1'), b('-2'), b('2')], 1))).toBe('5');
    expect(str(fn('factory_norm')([b('1'), b('-7'), b('2')], Infinity))).toBe('7');
  });

  it('factory_pow with BigNumber operands', () => {
    expect(str(fn('factory_pow')(b(2), b(10)))).toBe('1024');
    expect(str(fn('factory_pow')(b(2), b('0.5')))).toBe(b(2).sqrt().toString());
    // mathjs: a negative base with a fractional exponent gives a Complex.
    const z = fn('factory_pow')(b(-4), b('0.5')) as Complex;
    expect(z).toBeInstanceOf(Complex);
    expect(z.re).toBeCloseTo(0, 14);
    expect(z.im).toBeCloseTo(2, 14);
  });

  it('gcd, lcm, sign, unaryMinus and round keep BigNumber results', () => {
    expect(str(fn('factory_gcd')(b(12), b(18)))).toBe('6');
    expect(str(fn('factory_gcd')(b(-12), b(18)))).toBe('6');
    expect(str(fn('factory_lcm')(b(4), b(6)))).toBe('12');
    expect(str(fn('factory_sign')(b(-3)))).toBe('-1');
    expect(str(fn('factory_sign')(b(0)))).toBe('0');
    expect(str(fn('factory_unaryMinus')(b('2.5')))).toBe('-2.5');
    expect(str(fn('factory_round')(b('1.2345'), b(2)))).toBe('1.23');
    expect(str(fn('factory_round')(b('2.5')))).toBe('3');
  });

  it('expm1, log1p and nthRoot keep BigNumber results', () => {
    expect(str(fn('factory_expm1')(b(1)))).toBe(b(1).exp().sub(1).toString());
    expect(str(fn('factory_log1p')(b(1)))).toBe(b(2).ln().toString());
    expect(str(fn('factory_nthRoot')(b(-8), b(3)))).toBe('-2');
    expect(str(fn('factory_nthRoot')(b(81), b(4)))).toBe('3');
  });

  it('nthRoot leaves the configured precision unchanged, on a result and on a throw', () => {
    BigNumber.config({ precision: 40 });
    fn('factory_nthRoot')(b(2), b(2));
    expect(BigNumber.precision).toBe(40);
    expect(() => fn('factory_nthRoot')(b(-8), b(2))).toThrow();
    expect(BigNumber.precision).toBe(40);
  });
});

describe('#1043 typed norm and hypot of BigNumber data', () => {
  it('norm of a BigNumber vector is a BigNumber at the configured precision', () => {
    BigNumber.config({ precision: 40 });
    const r = f.norm([b('0.1'), b('0.2')] as unknown as number[]);
    expect(str(r)).toBe(b('0.05').sqrt().toString());
    expect((r as BigNumber).toString().replace(/[-.]/g, '').length).toBeGreaterThan(30);
  });

  it('hypot of BigNumber arguments and of a BigNumber array is a BigNumber', () => {
    BigNumber.config({ precision: 40 });
    expect(str(f.hypot(b(3), b(4)))).toBe('5');
    expect(str(f.hypot(b(1), b(2), b(2)))).toBe('3');
    expect(str(f.hypot([b(3), b(4)] as unknown as number[]))).toBe('5');
    expect(str(f.hypot(b('0.1'), b('0.2')))).toBe(b('0.05').sqrt().toString());
  });

  it('a number mixed with a BigNumber gives a BigNumber', () => {
    expect(str(f.hypot(b(3), 4 as unknown as BigNumber))).toBe('5');
    expect(str(f.hypot([b(3), 4] as unknown as number[]))).toBe('5');
  });

  it('norm of a 2-D BigNumber array is the exact Frobenius norm', () => {
    const m = [
      [b(1), b(2)],
      [b(2), b(4)],
    ] as unknown as number[][];
    expect(str(f.norm(m))).toBe('5');
    expect(str(f.norm(m, 'fro'))).toBe('5');
  });

  it('norm of a Fraction vector takes the exact path, not the double one', () => {
    const r = f.norm([new Fraction(3, 5), new Fraction(4, 5)] as unknown as number[]);
    expect(Number(r)).toBe(1);
  });

  it('number input keeps the double result, bit for bit', () => {
    expect(f.norm([0.1, 0.2])).toBe(Math.hypot(0.1, 0.2));
    expect(f.norm([3, 4])).toBe(5);
    expect(f.hypot(3, 4)).toBe(5);
    expect(f.hypot([0.1, 0.2])).toBe(Math.hypot(0.1, 0.2));
  });
});

describe('#1043 typed nthRoot(BigNumber, n)', () => {
  it('gives the exact root of a large exact power', () => {
    expect(String(f.nthRoot(new BigNumber('1e60'), 3))).toBe('100000000000000000000');
    expect(String(f.nthRoot(new BigNumber(3).pow(100), 100))).toBe('3');
  });

  it('gives a negative real root for an odd root, and throws for an even one (#1097)', () => {
    expect(String(f.nthRoot(new BigNumber(-27), 3))).toBe('-3');
    expect(() => f.nthRoot(new BigNumber(-16), 2)).toThrow('Root must be odd when a is negative.');
  });

  it('restores the configured precision', () => {
    f.nthRoot(new BigNumber('1e60'), 3);
    expect(BigNumber.precision).toBe(64);
  });
});
