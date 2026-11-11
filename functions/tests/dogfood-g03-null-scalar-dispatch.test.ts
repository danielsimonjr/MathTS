/**
 * Dogfood relay G03 — issues #807 (core scalar) and #813 (typed add dispatch).
 */
import { describe, it, expect } from 'vitest';

import { addScalar, multiplyScalar, divideScalar, number } from '@danielsimonjr/mathts-core';
import { add, multiply } from '@danielsimonjr/mathts-functions';

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
});
