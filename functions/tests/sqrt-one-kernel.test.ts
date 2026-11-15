/**
 * The typed `sqrt` and the factory `sqrt` share one scalar kernel. A negative BigNumber gives a
 * Complex through the number path, and the `predictable` option keeps the result real (NaN),
 * as in mathjs. Before the shared kernel, the typed `sqrt` returned a NaN BigNumber.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Complex, Fraction } from '@danielsimonjr/mathts-core';
import { sqrt, factory_sqrt, runWithConfig } from '../src/index.js';

const both = [
  ['typed', sqrt as (x: unknown) => unknown],
  ['factory', factory_sqrt as (x: unknown) => unknown],
] as const;

describe('sqrt: one scalar kernel', () => {
  for (const [label, f] of both) {
    it(`${label}: a negative BigNumber gives a Complex`, () => {
      const r = f(BigNumber.fromNumber(-4));
      expect(r).toBeInstanceOf(Complex);
      expect([(r as Complex).re, (r as Complex).im]).toEqual([0, 2]);
    });

    it(`${label}: the other scalar paths agree`, () => {
      expect(String(f(BigNumber.fromNumber(2)))).toBe(String(BigNumber.fromNumber(2).sqrt()));
      expect(f(9)).toBe(3);
      expect(Number.isNaN(f(NaN) as number)).toBe(true);
      expect(Object.is(f(-0), -0)).toBe(true);
      const c = f(-9) as Complex;
      expect([c.re, c.im]).toEqual([0, 3]);
      const q = f(new Fraction(-1, 4)) as Complex;
      expect([q.re, q.im]).toEqual([0, 0.5]);
    });
  }

  it('typed: predictable keeps a negative BigNumber real', () => {
    const r = runWithConfig({ predictable: true }, () => sqrt(BigNumber.fromNumber(-4)));
    expect(r).toBeInstanceOf(BigNumber);
    expect((r as BigNumber).isNaN()).toBe(true);
  });
});
