import { describe, it, expect } from 'vitest';
import {
  complex,
  fraction,
  bignumber,
  matrix,
  number,
  string,
  boolean,
  bigint,
  parser,
  reviver,
  replacer,
} from '../src/index.js';
import { Complex, isComplex } from '@danielsimonjr/mathts-core';

/** EXPANSION_PLAN W9 — type-conversion exports, stateful parser, JSON helpers. */
describe('type-conversion exports', () => {
  it('constructs numeric and matrix types', () => {
    const c = complex(3, 4);
    expect(isComplex(c)).toBe(true);
    expect((c as { re: number }).re).toBe(3);
    expect(fraction(1, 2)).toBeDefined();
    expect(bignumber('123')).toBeDefined();
    expect(matrix([[1, 2], [3, 4]])).toBeDefined();
  });

  it('coerces primitive types', () => {
    expect(number('5')).toBe(5);
    expect(string(5)).toBe('5');
    expect(boolean(1)).toBe(true);
    expect(boolean(0)).toBe(false);
    expect(bigint(7)).toBe(7n);
  });
});

describe('stateful parser', () => {
  it('retains explicitly set variables across evaluate calls', () => {
    const p = parser();
    p.set('x', 3);
    expect(p.evaluate('x^2')).toBe(9);
    expect(p.get('x')).toBe(3);
    p.clear();
    expect(p.get('x')).toBeUndefined();
  });

  it('retains computed values stored back into the scope', () => {
    const p = parser();
    p.set('x', 4);
    p.set('y', p.evaluate('x + 1'));
    expect(p.evaluate('x * y')).toBe(20);
  });
});

describe('JSON reviver / replacer', () => {
  it('round-trips a Complex value', () => {
    const json = JSON.stringify(new Complex(2, -3), replacer);
    const back = JSON.parse(json, reviver) as Complex;
    expect(isComplex(back)).toBe(true);
    expect(back.re).toBe(2);
    expect(back.im).toBe(-3);
  });

  it('preserves non-finite numbers', () => {
    const json = JSON.stringify({ a: Infinity, b: NaN, c: -Infinity }, replacer);
    const back = JSON.parse(json, reviver) as Record<string, number>;
    expect(back.a).toBe(Infinity);
    expect(back.c).toBe(-Infinity);
    expect(Number.isNaN(back.b)).toBe(true);
  });
});
