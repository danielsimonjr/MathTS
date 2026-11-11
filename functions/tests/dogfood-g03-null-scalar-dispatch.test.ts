/**
 * Dogfood relay G03 — issues #807 (core scalar) and #813 (typed add dispatch).
 */
import { describe, it, expect } from 'vitest';

import {
  addScalar,
  multiplyScalar,
  divideScalar,
  number,
  Complex,
  Fraction,
  BigNumber,
  Unit,
  type UnitInstance,
} from '@danielsimonjr/mathts-core';
import { add, multiply } from '@danielsimonjr/mathts-functions';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

describe('#807 — core scalar null dispatch', () => {
  const fns = [
    ['addScalar', addScalar],
    ['multiplyScalar', multiplyScalar],
    ['divideScalar', divideScalar],
  ] as const;

  it.each(fns)('%s(null, 1) never throws reading im', (name, fn) => {
    const run = (fn as (a: unknown, b: unknown) => unknown).bind(null);
    expect(() => run(null, 1)).toThrow(new RegExp(`${name}: unexpected type null`));
    try {
      run(null, 1);
    } catch (e) {
      expect((e as Error).message).not.toMatch(/reading 'im'/);
    }
  });

  it('number(null) throws a typed error', () => {
    expect(() => number(null as never)).toThrow(/number: unexpected type null/);
  });
});

describe('#813 — typed add invalid operands', () => {
  const A = add as (a: unknown, b: unknown) => unknown;

  const mustReject = [null, undefined, { x: 1 }, Symbol('x'), '2', () => {}] as const;

  it.each(mustReject)('add(%s, 1) throws unexpected type, not too few args', (value) => {
    expect(() => A(value, 1)).toThrow(/add: unexpected type/);
    expect(() => A(value, 1)).not.toThrow(/Too few arguments/);
  });

  it("add('2', 1) does not return Complex", () => {
    expect(() => A('2', 1)).toThrow(/add: unexpected type string/);
  });

  it('add(true, 1) === 2 (boolean coercion retained)', () => {
    expect(A(true, 1)).toBe(2);
  });

  it('add(1n, 1) is a plain number, not Fraction', () => {
    const r = A(1n, 1);
    expect(typeof r).toBe('number');
    expect(r).toBe(2);
  });
});

describe('#813 — typed multiply rejects nullish like add', () => {
  const M = multiply as (a: unknown, b: unknown) => unknown;

  it('multiply(null, 1) throws unexpected type', () => {
    expect(() => M(null, 1)).toThrow(/multiply: unexpected type null/);
  });

  it("multiply('2', 1) throws", () => {
    expect(() => M('2', 1)).toThrow(/multiply: unexpected type string/);
  });

  it('multiply(1n, 1) is a number and multiply(true, 2) coerces', () => {
    expect(M(1n, 1)).toBe(1);
    expect(M(true, 2)).toBe(2);
  });
});

describe('#813 probes — second operand, dates, and real dispatch', () => {
  const A = add as (a: unknown, b: unknown) => unknown;
  const M = multiply as (a: unknown, b: unknown) => unknown;

  it('rejects null, string, and Date on either side', () => {
    expect(() => A(1, null)).toThrow(/add: unexpected type null at index 1/);
    expect(() => A(1, '2')).toThrow(/add: unexpected type string at index 1/);
    expect(() => A(new Date(0), 1)).toThrow(/add: unexpected type \[object Date\]/);
    expect(() => A(new Date(0), 1)).not.toThrow(/Too few arguments/);
    expect(() => M(1, undefined)).toThrow(/multiply: unexpected type undefined at index 1/);
  });

  it('still adds Complex, Fraction, BigNumber, Unit, and matrices', () => {
    const c = A(new Complex(1, 2), new Complex(3, 4)) as Complex;
    expect(c.re).toBe(4);
    expect(c.im).toBe(6);
    const f = A(new Fraction(1, 2), 1) as Fraction;
    expect(f.numerator).toBe(3n);
    expect(f.denominator).toBe(2n);
    const b = A(BigNumber.fromNumber(0.1), BigNumber.fromNumber(0.2)) as BigNumber;
    expect(b.toNumber()).toBeCloseTo(0.3, 10);
    const u = A(new Unit(1, 'm'), new Unit(2, 'm')) as UnitInstance;
    expect(u.value).toBe(3);
    const mat = A(DenseMatrix.fromArray([[1, 2]]), 3) as { _data: number[][] };
    expect(mat._data).toEqual([[4, 5]]);
    expect(A([1, 2], 1)).toEqual([2, 3]);
    const f64 = A(new Float64Array([1, 2]), new Float64Array([3, 4])) as Float64Array;
    expect(Array.from(f64)).toEqual([4, 6]);
    const scaled = M(new Unit(2, 'm'), 3) as UnitInstance;
    expect(scaled.value).toBe(6);
  });

  it('add(1, 2) and add(1, 2, 3) stay numbers; a later null still throws', () => {
    expect(A(1, 2)).toBe(3);
    const variadic = add as (a: unknown, b: unknown, c: unknown) => unknown;
    expect(variadic(1, 2, 3)).toBe(6);
    expect(() => variadic(1, 2, null)).toThrow(/add: unexpected type null/);
  });
});
