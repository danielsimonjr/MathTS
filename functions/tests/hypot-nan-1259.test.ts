/**
 * #1259: one rule for `hypot` and every Euclidean magnitude, on every path and type.
 *
 * The rule is the IEEE 754 rule of `hypot`: an infinite argument gives +Infinity, also when
 * another argument is NaN. Else a NaN argument gives NaN. The oracle is `Math.hypot`
 * (ECMAScript, IEEE 754), not mathjs. mathjs 15.2.0 gives NaN for `hypot(Infinity, NaN)` and for
 * `hypot(Infinity, Infinity)`: its scaled loop divides Infinity by Infinity. MathTS deviates from
 * mathjs here on purpose.
 *
 * The rule covers `hypot`, the modulus of a Complex (`abs`), `norm` (the vector 2-norm, the
 * Frobenius norm and the matrix 2-norm) and `distance`.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Complex } from '@danielsimonjr/mathts-core';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const hypot = math.hypot as unknown as Fn;
const factoryHypot = math.factory_hypot as unknown as Fn;
const bignumber = math.bignumber as unknown as Fn;
const matrix = math.matrix as unknown as Fn;
const norm = math.norm as unknown as Fn;
const factoryNorm = math.factory_norm as unknown as Fn;
const distance = math.distance as unknown as Fn;
const abs = math.abs as unknown as Fn;
const factoryAbs = math.factory_abs as unknown as Fn;
const evaluate = math.evaluate as unknown as Fn;

/** The argument lists of the rule. Each list has an infinite value, a NaN, or both. */
const rows: number[][] = [
  [Infinity, NaN],
  [NaN, Infinity],
  [-Infinity, NaN],
  [NaN, -Infinity],
  [-Infinity, NaN, 1],
  [1, NaN, -Infinity, 2],
  [Infinity, Infinity],
  [Infinity, -Infinity],
  [3, 4, Infinity, Infinity],
  [Infinity, 3],
  [NaN, 3],
  [NaN, NaN],
  [3, 4],
];

/** `Number(value)` of a number or a BigNumber result. */
function num(value: unknown): number {
  if (typeof value === 'number') return value;
  expect(value).toBeInstanceOf(BigNumber);
  return (value as BigNumber).toNumber();
}

function expectRule(value: unknown, args: readonly number[]): void {
  expect(num(value)).toBe(Math.hypot(...args));
}

const big = (xs: readonly number[]): unknown[] => xs.map((x) => bignumber(x));

describe('hypot follows the IEEE rule on every path (#1259)', () => {
  it.each(rows)('typed hypot(%s, ...)', (...args) => {
    expectRule(hypot(...args), args);
    expectRule(hypot(args), args);
    expectRule(hypot(args.map((x) => [x])), args);
    expectRule(hypot(matrix(args)), args);
    expectRule(evaluate(`hypot(${args.map(String).join(', ')})`), args);
  });

  it.each(rows)('factory hypot(%s, ...)', (...args) => {
    expectRule(factoryHypot(...args), args);
    expectRule(factoryHypot(args), args);
    expectRule(factoryHypot(matrix(args)), args);
  });

  it.each(rows)('BigNumber hypot(%s, ...): typed, mixed, factory, core hypotN', (...args) => {
    const b = big(args);
    const results = [hypot(...b), hypot(b), factoryHypot(...b), BigNumber.hypotN(b as BigNumber[])];
    for (const r of results) {
      expect(r).toBeInstanceOf(BigNumber);
      expectRule(r, args);
    }
    // A BigNumber with numbers: the value follows the rule. (With three or more arguments the
    // typed call converts the BigNumber to a number; that result type is a separate finding.)
    expect(Number(hypot(bignumber(args[0]), ...args.slice(1)))).toBe(Math.hypot(...args));
  });

  it('a long list does not overflow the call stack (it spread the list onto the stack)', () => {
    const ones = new Array<number>(130000).fill(1);
    const want = Math.sqrt(130000); // the sum of squares is exact, so the root is correctly rounded
    expect(factoryHypot(ones)).toBe(want);
    expect(hypot(ones)).toBe(want);
    ones[129999] = Infinity;
    ones[5] = NaN;
    expect(hypot(ones)).toBe(Infinity);
    ones[129999] = 1;
    expect(hypot(ones)).toBeNaN();
  });
});

describe('the modulus of a Complex follows the IEEE rule (#1259)', () => {
  const parts: Array<[number, number]> = [
    [Infinity, NaN],
    [NaN, -Infinity],
    [-Infinity, -Infinity],
    [NaN, 3],
    [3, 4],
  ];
  it.each(parts)('abs(%s + %s i): typed and factory', (re, im) => {
    const z = new Complex(re, im);
    expect(abs(z)).toBe(Math.hypot(re, im));
    expect(factoryAbs(z)).toBe(Math.hypot(re, im));
    expect(norm(z)).toBe(Math.hypot(re, im));
  });
});

describe('norm and distance follow the IEEE rule (#1259)', () => {
  it.each(rows)(
    'norm(%s, ...): vector, Frobenius, matrix 2-norm, factory, BigNumber',
    (...args) => {
      const want = Math.hypot(...args);
      expect(num(norm(args))).toBe(want);
      expect(num(norm(new Float64Array(args)))).toBe(want);
      expect(num(norm(matrix(args)))).toBe(want);
      expect(num(norm([args], 'fro'))).toBe(want);
      expect(num(norm(matrix([args]), 'fro'))).toBe(want);
      expect(num(factoryNorm(args))).toBe(want);
      expect(num(factoryNorm([args], 'fro'))).toBe(want);
      expect(num(norm(big(args)))).toBe(want);
      expect(num(factoryNorm(big(args)))).toBe(want);
      expect(num(factoryNorm([big(args)], 'fro'))).toBe(want);
    }
  );

  it('a Complex entry with an infinite part makes the norm infinite', () => {
    const entries = [new Complex(Infinity, NaN), new Complex(1, 2)];
    expect(num(norm(entries))).toBe(Infinity);
    expect(num(factoryNorm([entries], 'fro'))).toBe(Infinity);
    expect(num(norm([new Complex(NaN, 1), 3]))).toBeNaN();
  });

  it.each([
    [
      [
        [Infinity, 0],
        [0, NaN],
      ],
      Infinity,
    ],
    [
      [
        [NaN, 0],
        [0, -Infinity],
      ],
      Infinity,
    ],
    [
      [
        [NaN, 0],
        [0, 1],
      ],
      NaN,
    ],
  ] as const)('matrix 2-norm of %j is %s (typed and factory)', (data, want) => {
    const rowsOf = data.map((r) => [...r]);
    expect(num(norm(rowsOf, 2))).toBe(want);
    expect(num(factoryNorm(rowsOf, 2))).toBe(want);
  });

  it.each(rows.filter((r) => r.length === 2))('distance([0, 0], [%s, %s])', (x, y) => {
    const want = Math.hypot(x, y);
    expect(num(distance([0, 0], [x, y]))).toBe(want);
    expect(num(distance([bignumber(0), bignumber(0)], [bignumber(x), bignumber(y)]))).toBe(want);
    expect(math.distance2D([0, 0], [x, y])).toBe(want);
    expect(math.distance3D([0, 0, 0], [x, y, 0])).toBe(want);
    expect(math.distanceND([0, 0], [x, y])).toBe(want);
  });

  it('finite distances keep their value (pins)', () => {
    expect(math.distance2D([0, 0], [3, 4])).toBe(5);
    expect(math.distance3D([1, 2, 3], [4, 6, 3])).toBe(5);
    expect(math.distanceND([0, 0, 0], [1, 2, 2])).toBe(3);
    expect(math.distanceND([0, 0, 0], [3, 4])).toBe(5);
    // The sum of squares overflows; the value is the hypot (it was Infinity).
    expect(math.distance2D([0, 0], [3e200, 4e200])).toBe(Math.hypot(3e200, 4e200));
  });
});
