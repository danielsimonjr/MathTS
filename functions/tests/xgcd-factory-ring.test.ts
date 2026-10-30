/**
 * Pins for createXgcd BigNumber / Fraction factory paths (not typed xgcd in typed/arithmetic.ts).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { BigNumber, Fraction } from '@danielsimonjr/mathts-core';

const bn = (n: number) => BigNumber.fromNumber(n);
import { factory_xgcd } from '../src/factories/index.js';
import { runWithConfig } from '../src/index.js';
import type { Matrix } from '../src/types.js';

const INTEGER_MSG = 'Parameters in function xgcd must be integer numbers';

afterEach(() => {
  runWithConfig({ matrix: 'Matrix' }, () => undefined);
});

function bezoutOk(
  a: { multiply(x: unknown): { add(y: unknown): unknown } },
  b: { multiply(x: unknown): { add(y: unknown): unknown } },
  g: unknown,
  x: unknown,
  y: unknown
): boolean {
  return a
    .multiply(x)
    .add(b.multiply(y))
    .equals(g as never);
}

function xgcdTriple(result: unknown): [unknown, unknown, unknown] {
  const arr = Array.isArray(result) ? result : (result as Matrix).valueOf();
  return [arr[0], arr[1], arr[2]];
}

describe('factory_xgcd BigNumber path', () => {
  it('(36163, 21199) matches extended Euclid reference', () => {
    const [g, x, y] = xgcdTriple(factory_xgcd(bn(36163), bn(21199)));
    expect((g as BigNumber).valueOf()).toBe(1247);
    expect((x as BigNumber).valueOf()).toBe(-7);
    expect((y as BigNumber).valueOf()).toBe(12);
    expect(36163 * -7 + 21199 * 12).toBe(1247);
  });

  it('negative input normalizes gcd sign', () => {
    const [g] = xgcdTriple(factory_xgcd(bn(-12), bn(18)));
    expect((g as BigNumber).valueOf()).toBe(6);
    expect((g as BigNumber).isNegative()).toBe(false);
  });

  it('(a, 0) returns gcd = |a| with Bezout coefficients', () => {
    const [g, x, y] = xgcdTriple(factory_xgcd(bn(12), bn(0)));
    expect((g as BigNumber).valueOf()).toBe(12);
    expect((x as BigNumber).valueOf()).toBe(1);
    expect((y as BigNumber).valueOf()).toBe(0);
  });

  it('(0, 0) uses number 0 for the middle coefficient when gcd is zero', () => {
    const res = factory_xgcd(bn(0), bn(0)) as Matrix;
    const arr = res.valueOf() as unknown[];
    expect((arr[0] as BigNumber).isZero()).toBe(true);
    expect(arr[1]).toBe(0);
    expect(typeof arr[1]).toBe('number');
    expect((arr[2] as BigNumber).isZero()).toBe(true);
  });

  it('rejects non-integer inputs with the factory message', () => {
    expect(() => factory_xgcd(bn(1.5), bn(2))).toThrow(INTEGER_MSG);
  });

  it('honors config.matrix Array vs Matrix', () => {
    runWithConfig({ matrix: 'Array' }, () => {
      const arr = factory_xgcd(bn(36), bn(24)) as BigNumber[];
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.map((v) => v.valueOf())).toEqual([12, 1, -1]);
    });
    runWithConfig({ matrix: 'Matrix' }, () => {
      const mat = factory_xgcd(bn(36), bn(24)) as Matrix;
      expect(Array.isArray(mat)).toBe(false);
      expect((mat.valueOf() as BigNumber[]).map((v) => v.valueOf())).toEqual([12, 1, -1]);
    });
  });
});

describe('factory_xgcd Fraction path', () => {
  it('(36163, 21199) matches extended Euclid reference', () => {
    const a = new Fraction(36163);
    const b = new Fraction(21199);
    const [g, x, y] = xgcdTriple(factory_xgcd(a, b));
    expect(g.equals(new Fraction(1247))).toBe(true);
    expect(x.equals(new Fraction(-7))).toBe(true);
    expect(y.equals(new Fraction(12))).toBe(true);
    expect(bezoutOk(a, b, g, x, y)).toBe(true);
  });

  it('negative input normalizes gcd sign', () => {
    const a = new Fraction(-12);
    const b = new Fraction(18);
    const [g, x, y] = xgcdTriple(factory_xgcd(a, b));
    expect(g.equals(new Fraction(6))).toBe(true);
    expect(bezoutOk(a, b, g, x, y)).toBe(true);
  });

  it('(a, 0) returns gcd = |a| with Bezout coefficients', () => {
    const a = new Fraction(12);
    const b = new Fraction(0);
    const [g, x, y] = xgcdTriple(factory_xgcd(a, b));
    expect(g.equals(new Fraction(12))).toBe(true);
    expect(x.equals(new Fraction(1))).toBe(true);
    expect(y.equals(new Fraction(0))).toBe(true);
  });

  it('(0, 0) uses number 0 for the middle coefficient when gcd is zero', () => {
    const res = factory_xgcd(new Fraction(0), new Fraction(0)) as Matrix;
    const arr = res.valueOf() as unknown[];
    expect((arr[0] as Fraction).equals(new Fraction(0))).toBe(true);
    expect(arr[1]).toBe(0);
    expect(typeof arr[1]).toBe('number');
    expect((arr[2] as Fraction).equals(new Fraction(0))).toBe(true);
  });

  it('rejects non-integer inputs with the factory message', () => {
    expect(() => factory_xgcd(new Fraction(12, 5), new Fraction(8))).toThrow(INTEGER_MSG);
  });

  it('honors config.matrix Array vs Matrix', () => {
    runWithConfig({ matrix: 'Array' }, () => {
      const arr = factory_xgcd(new Fraction(36), new Fraction(24));
      expect(Array.isArray(arr)).toBe(true);
      expect((arr as Fraction[])[0].equals(new Fraction(12))).toBe(true);
    });
    runWithConfig({ matrix: 'Matrix' }, () => {
      const mat = factory_xgcd(new Fraction(36), new Fraction(24)) as Matrix;
      expect(Array.isArray(mat)).toBe(false);
      expect((mat.valueOf()[0] as Fraction).equals(new Fraction(12))).toBe(true);
    });
  });
});
