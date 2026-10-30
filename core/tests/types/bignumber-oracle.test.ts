/**
 * PR 8 — BigNumber sin/cos/exp pinned to libm (`Math.*`), independent of the
 * Taylor series in `core/src/types/bignumber.ts`.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber } from '../../src/types/bignumber.js';

function expectLibm(got: number, libm: number): void {
  const scale = Math.abs(libm) > 0 ? Math.abs(libm) : 1;
  expect(Math.abs(got - libm) / scale).toBeLessThan(1e-12);
}

describe('BigNumber elementary vs libm', () => {
  const one = BigNumber.fromNumber(1);

  it('sin(1), cos(1), exp(1) match Math.*', () => {
    expectLibm(one.sin().toNumber(), Math.sin(1));
    expectLibm(one.cos().toNumber(), Math.cos(1));
    expectLibm(one.exp().toNumber(), Math.exp(1));
  });

  it('sin(0) = 0', () => {
    expect(BigNumber.fromNumber(0).sin().toNumber()).toBe(0);
  });

  it('exp(0) = 1', () => {
    expect(BigNumber.fromNumber(0).exp().toNumber()).toBe(1);
  });

  it('sin(NaN) is NaN', () => {
    expect(BigNumber.fromNumber(NaN).sin().isNaN()).toBe(true);
  });

  it('sin(±∞) is NaN', () => {
    expect(BigNumber.fromNumber(Infinity).sin().isNaN()).toBe(true);
    expect(BigNumber.fromNumber(-Infinity).sin().isNaN()).toBe(true);
  });

  it('cos(NaN) is NaN', () => {
    expect(BigNumber.fromNumber(NaN).cos().isNaN()).toBe(true);
  });

  it('cos(±∞) is NaN', () => {
    expect(BigNumber.fromNumber(Infinity).cos().isNaN()).toBe(true);
    expect(BigNumber.fromNumber(-Infinity).cos().isNaN()).toBe(true);
  });

  it('exp(NaN) is NaN', () => {
    expect(BigNumber.fromNumber(NaN).exp().isNaN()).toBe(true);
  });
});
