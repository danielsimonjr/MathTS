/**
 * Issue #1049: the public types of the reductions give the exact element type for an array of
 * exact values. Each assignment has no cast, so the typecheck of this file fails when a public
 * overload gives `unknown` or `number` instead.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Complex, Fraction } from '@danielsimonjr/mathts-core';
import { mad, mean, median, mode, std, variance } from '../src/index.js';

const F = [new Fraction(1, 3), new Fraction(1, 6), new Fraction(1, 2)];
const B = [BigNumber.fromNumber(1), BigNumber.fromNumber(2), BigNumber.fromNumber(4)];
const C = [new Complex(1, 1), new Complex(2, 0), new Complex(0, 3)];
const I = [1n, 2n, 4n];

describe('#1049 exact element types in the public reduction types', () => {
  it('mean', () => {
    const f: Fraction = mean(F);
    const b: BigNumber = mean([B, B]);
    const c: Complex = mean(C);
    const i: number = mean(I);
    expect([f, b, c].map((x) => x.constructor)).toEqual([Fraction, BigNumber, Complex]);
    expect(typeof i).toBe('number');
  });

  it('variance and std', () => {
    const vf: Fraction = variance(F);
    const vb: BigNumber = variance(B);
    // #1550: the rest signature keeps the value's exact scalar type (unknown at
    // the source level); the bigint list computes to a number at runtime.
    const vi = variance(I) as number;
    const sf: number = std(F);
    const sb: BigNumber = std([B, B]);
    const si: number = std(I);
    // #1550: the squared deviation of a Complex is its complex square, so the
    // variance and the std of Complex values are Complex (as in mathjs).
    const vc: Complex = variance(C);
    const sc: Complex = std(C);
    expect([vf, vb, sb, vc, sc].map((x) => x.constructor)).toEqual([
      Fraction,
      BigNumber,
      BigNumber,
      Complex,
      Complex,
    ]);
    expect([typeof vi, typeof sf, typeof si]).toEqual(['number', 'number', 'number']);
  });

  it('median and mad', () => {
    const mf: Fraction = median(F);
    const mb: BigNumber = median(B);
    const mi: Fraction = median(I);
    const af: Fraction = mad(F);
    const ab: BigNumber = mad([B, B]);
    const ai: Fraction = mad(I);
    expect([mf, mb, mi, af, ab, ai].map((x) => x.constructor)).toEqual([
      Fraction,
      BigNumber,
      Fraction,
      Fraction,
      BigNumber,
      Fraction,
    ]);
  });

  it('mode', () => {
    const mf: Fraction[] = mode(F);
    const mc: Complex[] = mode(C);
    const mi: bigint[] = mode(I);
    expect([mf[0], mc[0]].map((x) => x.constructor)).toEqual([Fraction, Complex]);
    expect(typeof mi[0]).toBe('bigint');
  });
});
