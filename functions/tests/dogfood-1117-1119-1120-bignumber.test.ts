/**
 * Dogfood relay: #1117 (Fraction to BigNumber kept 16 digits), #1119 (bignumber() argument
 * handling), #1120 (solveODE RK23 with BigNumber input accepted a whole-interval first step).
 * The oracle for the argument cases is mathjs 15.2.0; the oracle for the digits is exact
 * rational arithmetic.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import {
  add,
  bignumber,
  complex,
  fraction,
  matrix,
  quantileSeq,
  solveODE,
  unaryMinus,
  unit,
} from '@danielsimonjr/mathts-functions';

const bn = (s: string | number) => bignumber(s as never) as unknown as BigNumber;
const near = (x: unknown, exact: string, tol = '1e-60') =>
  expect(
    (x as BigNumber).subtract(BigNumber.parse(exact)).abs().compareTo(BigNumber.parse(tol))
  ).toBeLessThan(0);

describe('#1117 Fraction converts to BigNumber at the configured precision', () => {
  it('add(fraction(1,3), bignumber(1)) keeps 64 digits', () => {
    const r = add(fraction(1, 3) as never, bn(1) as never) as unknown as BigNumber;
    near(r, '1.' + '3'.repeat(70));
  });
  it('a negative fraction keeps its sign', () => {
    const r = add(fraction(-1, 3) as never, bn(1) as never) as unknown as BigNumber;
    near(r, '0.' + '6'.repeat(64));
    const s = add(bn(1) as never, fraction(-1, 3) as never) as unknown as BigNumber;
    near(s, '0.' + '6'.repeat(64));
  });
  it('the conversion follows the configured precision', () => {
    const saved = BigNumber.config().precision;
    try {
      BigNumber.config({ precision: 20 });
      const r = add(fraction(1, 3) as never, bn(1) as never) as unknown as BigNumber;
      near(r, '1.' + '3'.repeat(40), '1e-19');
    } finally {
      BigNumber.config({ precision: saved });
    }
  });
  it('quantileSeq of fractions with a BigNumber count gives exact outer quantiles', () => {
    const q = quantileSeq(
      [fraction(1, 3), fraction(2, 3), fraction(1)] as never,
      bn(3) as never
    ) as unknown as BigNumber[];
    near(q[0], '0.5');
    near(q[1], '0.' + '6'.repeat(70));
    near(q[2], '0.' + '8333333333333333333333333333333333333333333333333333333333333333333333');
  });
  it('a Fraction in a number context stays a number', () => {
    expect((add(fraction(1, 3) as never, 1 as never) as unknown) instanceof Fraction).toBe(true);
  });
});

describe('#1119 bignumber() argument handling matches mathjs 15.2.0', () => {
  const b = bignumber as (...a: unknown[]) => unknown;
  it('no argument gives 0', () => {
    expect((b() as BigNumber).toString()).toBe('0');
  });
  it('undefined throws a TypeError that names bignumber', () => {
    expect(() => b(undefined)).toThrow(TypeError);
    expect(() => b(undefined)).toThrow(/bignumber/);
    expect(() => b(undefined)).not.toThrow(/isMatrix/);
  });
  it('a Complex throws a TypeError', () => {
    expect(() => b(complex(1, 2))).toThrow(TypeError);
  });
  it('a plain object throws a TypeError', () => {
    expect(() => b({})).toThrow(TypeError);
  });
  it('null, booleans, strings, bigint and fractions convert as in mathjs', () => {
    expect((b(null) as BigNumber).toString()).toBe('0');
    expect((b(true) as BigNumber).toString()).toBe('1');
    expect((b(false) as BigNumber).toString()).toBe('0');
    expect((b('0x1F') as BigNumber).toString()).toBe('31');
    expect((b('0b101') as BigNumber).toString()).toBe('5');
    expect((b('0o17') as BigNumber).toString()).toBe('15');
    expect((b('-0x1F') as BigNumber).toString()).toBe('-31');
    expect((b('0x1.8') as BigNumber).toString()).toBe('1.5');
    expect((b('0xFFi8') as BigNumber).toString()).toBe('-1');
    expect((b('0x7Fi8') as BigNumber).toString()).toBe('127');
    expect(() => b('0x1FFi8')).toThrow(SyntaxError);
    expect(() => b('0xG')).toThrow(SyntaxError);
    expect((b(5n) as BigNumber).toString()).toBe('5');
    near(b(fraction(-1, 3)), '-0.' + '3'.repeat(64));
  });
  it("'' and a bad string throw", () => {
    expect(() => b('')).toThrow();
    expect(() => b('abc')).toThrow();
  });
  it('a Unit converts its value and a matrix converts element by element', () => {
    const u = b(unit(5, 'cm')) as { value: unknown };
    expect((u.value as BigNumber).toString()).toBe('0.05');
    const m = b(matrix([1, 2])) as { toArray(): unknown[] };
    expect(m.toArray().map(String)).toEqual(['1', '2']);
    expect((b([1, [2]]) as unknown[][]).flat(2).map(String)).toEqual(['1', '2']);
  });
  it('NaN and Infinity convert', () => {
    expect((b(NaN) as BigNumber).isNaN()).toBe(true);
    expect((b(-Infinity) as BigNumber).toString()).toBe('-Infinity');
  });
});

describe('#1120 solveODE RK23 and RK45 with BigNumber input', () => {
  const f = (_t: unknown, y: unknown) => unaryMinus(y as never);
  const last = (r: { y: unknown[] }) => Number((r.y[r.y.length - 1] as BigNumber).toString());
  const exact = Math.exp(-1);
  for (const method of ['RK23', 'RK45'] as const) {
    it(`${method}: BigNumber y0 gives e^-1, not 1/3`, () => {
      const r = solveODE(f as never, [0, 1] as never, bn(1) as never, { method } as never) as never;
      expect(Math.abs(last(r) - exact)).toBeLessThan(1e-3);
    });
    it(`${method}: BigNumber tspan gives e^-1`, () => {
      const r = solveODE(
        f as never,
        [bn(0), bn(1)] as never,
        1 as never,
        { method } as never
      ) as never;
      expect(Math.abs(last(r) - exact)).toBeLessThan(1e-3);
    });
  }
  it('RK23 takes more than two steps', () => {
    const r = solveODE(
      f as never,
      [bn(0), bn(1)] as never,
      bn(1) as never,
      {
        method: 'RK23',
      } as never
    ) as { t: unknown[] };
    expect(r.t.length).toBeGreaterThan(3);
  });
  it('a backward BigNumber span works', () => {
    const r = solveODE(
      (_t: unknown, y: unknown) => y as never,
      [bn(1), bn(0)] as never,
      bn(Math.E) as never,
      {
        method: 'RK23',
      } as never
    ) as never;
    expect(Math.abs(last(r) - 1)).toBeLessThan(1e-3);
  });
  it('the number path is unchanged', () => {
    const r = solveODE(
      ((_t: number, y: number) => -y) as never,
      [0, 1] as never,
      1 as never,
      {
        method: 'RK23',
      } as never
    ) as never;
    expect(Math.abs(last(r) - exact)).toBeLessThan(1e-3);
  });
});
