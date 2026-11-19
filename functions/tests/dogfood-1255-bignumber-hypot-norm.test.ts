/**
 * Dogfood #1255 - hypot and norm of BigNumber values square each value, so a value
 * above about 4.5e15 in exponent overflows and a tiny one underflows, and the
 * configured exponent bounds are not honoured. The sum of squares is now scaled.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const b = (v: string | number): BigNumber => new BigNumber(String(v));
const str = (x: unknown): string => {
  expect(x).toBeInstanceOf(BigNumber);
  return (x as BigNumber).toString();
};

afterEach(() => {
  BigNumber.resetConfig();
});

const impls = ['hypot', 'factory_hypot'];

describe.each(impls)('#1255 %s of BigNumber values', (name) => {
  const h = (...a: unknown[]) => fn(name)(...a);
  it('the issue input: hypot(3e5e15, 4e5e15) is 5e5e15', () => {
    expect(str(h(b('3e5000000000000000'), b('4e5000000000000000')))).toBe('5e+5000000000000000');
  });
  it('tiny values do not underflow', () => {
    expect(str(h(b('-3e-5000000000000000'), b('4e-5000000000000000')))).toBe('5e-5000000000000000');
  });
  it('a configured bound is honoured', () => {
    BigNumber.config({ maxExponent: 100 });
    expect(str(h(b('3e60'), b('4e60')))).toBe(b('5e60').toString());
  });
  it('a zero vector is zero', () => {
    expect(str(h(b(0), b(0), b(0)))).toBe('0');
  });
  it('mixed signs', () => {
    expect(str(h(b('-3e5000000000000000'), b('4e5000000000000000'), b(0)))).toBe(
      '5e+5000000000000000'
    );
  });
  it('one huge and many small entries', () => {
    const xs = [
      b('3e5000000000000000'),
      ...Array.from({ length: 20 }, () => b('1e-5000000000000000')),
    ];
    expect(str(h(xs))).toBe('3e+5000000000000000');
  });
  it('ordinary values keep the digits', () => {
    BigNumber.config({ precision: 40 });
    expect(str(h(b('0.1'), b('0.2')))).toBe(b('0.05').sqrt().toString());
    expect(str(h(b(3), b(4)))).toBe('5');
  });
});

describe('#1255 norm of BigNumber values', () => {
  const big = (v: string | number) => b(v);
  it('vector 2-norm', () => {
    const v = [big('3e5000000000000000'), big('4e5000000000000000')];
    expect(str(fn('norm')(v))).toBe('5e+5000000000000000');
    expect(str(fn('norm')(v, 2))).toBe('5e+5000000000000000');
    expect(str(fn('factory_norm')(v))).toBe('5e+5000000000000000');
  });
  it('vector tiny', () => {
    const v = [big('3e-5000000000000000'), big('4e-5000000000000000')];
    expect(str(fn('norm')(v))).toBe('5e-5000000000000000');
  });
  it('vector with a configured bound', () => {
    BigNumber.config({ maxExponent: 100 });
    expect(str(fn('norm')([big('3e60'), big('4e60')]))).toBe(b('5e60').toString());
  });
  it('vector fro', () => {
    const v = [big('3e5000000000000000'), big('4e5000000000000000')];
    expect(str(fn('norm')(v, 'fro'))).toBe('5e+5000000000000000');
  });
  it('matrix fro', () => {
    const m = [
      [big('3e5000000000000000'), big(0)],
      [big(0), big('4e5000000000000000')],
    ];
    expect(str(fn('norm')(m, 'fro'))).toBe('5e+5000000000000000');
  });
  it('matrix fro tiny and configured', () => {
    const m = [
      [big('3e-5000000000000000'), big(0)],
      [big(0), big('-4e-5000000000000000')],
    ];
    expect(str(fn('norm')(m, 'fro'))).toBe('5e-5000000000000000');
    BigNumber.config({ maxExponent: 100 });
    expect(
      str(
        fn('norm')(
          [
            [big('3e60'), big(0)],
            [big(0), big('4e60')],
          ],
          'fro'
        )
      )
    ).toBe(b('5e60').toString());
  });
  it('zero vector and zero matrix', () => {
    expect(str(fn('norm')([big(0), big(0)]))).toBe('0');
    expect(
      str(
        fn('norm')(
          [
            [big(0), big(0)],
            [big(0), big(0)],
          ],
          'fro'
        )
      )
    ).toBe('0');
  });
  it('mixed signs and ordinary values', () => {
    expect(str(fn('norm')([big(-3), big(4)]))).toBe('5');
    expect(
      str(
        fn('norm')(
          [
            [big(-3), big(0)],
            [big(0), big(4)],
          ],
          'fro'
        )
      )
    ).toBe('5');
  });
  it('one huge and many small entries', () => {
    const v = [
      big('3e5000000000000000'),
      ...Array.from({ length: 20 }, () => big('1e-5000000000000000')),
    ];
    expect(str(fn('norm')(v))).toBe('3e+5000000000000000');
  });
  it('numbers are unchanged', () => {
    expect(fn('norm')([3, 4])).toBe(5);
    expect(fn('norm')([1e200, 1e200])).toBe(Math.hypot(1e200, 1e200));
    expect(fn('hypot')(3, 4)).toBe(5);
    expect(
      fn('norm')(
        [
          [3, 0],
          [0, 4],
        ],
        'fro'
      )
    ).toBe(5);
  });
});

describe('#1255 digits and distance', () => {
  it('1000 random vectors at precision 64 give the digits of the plain formula', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    BigNumber.config({ precision: 64 });
    for (let t = 0; t < 1000; t++) {
      const n = 2 + Math.floor(rnd() * 5);
      const xs = Array.from({ length: n }, () =>
        b(`${rnd() < 0.5 ? '-' : ''}${(rnd() * 1000).toFixed(12)}e${Math.floor(rnd() * 80) - 40}`)
      );
      let sum = b(0);
      for (const x of xs) sum = sum.add(x.multiply(x));
      expect(str(fn('hypot')(xs))).toBe(sum.sqrt().toString());
      expect(str(fn('norm')(xs))).toBe(sum.sqrt().toString());
    }
  });
  it('euclidean distance of BigNumber points does not overflow', () => {
    const p = [b('0'), b('0')];
    const q = [b('3e5000000000000000'), b('4e5000000000000000')];
    expect(str(fn('distance')(p, q))).toBe('5e+5000000000000000');
  });
});
