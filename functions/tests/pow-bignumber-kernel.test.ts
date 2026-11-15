/**
 * The typed `pow` and the factory `pow` share one BigNumber kernel, as in mathjs. A non-negative
 * base or an integer exponent keeps the BigNumber result. A negative base with a non-integer
 * exponent gives a Complex. With the `predictable` option, that result is NaN. Before the shared
 * kernel, the typed `pow` gave a double for a positive base and NaN for a negative base.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Complex } from '@danielsimonjr/mathts-core';
import { pow, factory_pow, runWithConfig } from '../src/index.js';

const B = (x: string): BigNumber => BigNumber.from(x);
const both = [
  ['typed', pow as (a: unknown, b: unknown) => unknown],
  ['factory', factory_pow as (a: unknown, b: unknown) => unknown],
] as const;

describe('pow: one BigNumber kernel', () => {
  for (const [label, f] of both) {
    it(`${label}: a positive base with a non-integer exponent stays a BigNumber`, () => {
      const r = f(B('8'), B('0.5'));
      expect(r).toBeInstanceOf(BigNumber);
      expect(String(r)).toBe(String(B('8').pow(B('0.5'))));
    });

    it(`${label}: a negative base with a non-integer exponent gives a Complex`, () => {
      const r = f(B('-8'), B('0.5')) as Complex;
      expect(r).toBeInstanceOf(Complex);
      const want = new Complex(-8, 0).pow(0.5);
      expect([r.re, r.im]).toEqual([want.re, want.im]);
    });

    it(`${label}: an integer exponent keeps the BigNumber`, () => {
      expect(String(f(B('-8'), B('2')))).toBe('64');
    });
  }

  it('typed: a BigNumber base with a number exponent uses the same kernel', () => {
    expect(pow(B('8'), 0.5)).toBeInstanceOf(BigNumber);
    expect(pow(B('-8'), 0.5)).toBeInstanceOf(Complex);
  });

  it('typed: predictable keeps a negative base real', () => {
    const r = runWithConfig({ predictable: true }, () => pow(B('-8'), B('0.5')));
    expect(r).toBeInstanceOf(BigNumber);
    expect((r as BigNumber).isNaN()).toBe(true);
  });
});
