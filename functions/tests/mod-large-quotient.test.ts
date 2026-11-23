/**
 * `mod` of two finite numbers whose quotient is 2^53 or more in magnitude. The quotient has no
 * fractional bits there, so the mathjs formula `a - b * floor(a / b)` gives 0 or -Infinity for a
 * remainder that `%` returns exactly. The oracle is a BigInt computation on the exact values of
 * the two doubles.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const mt = math as unknown as Record<string, Fn>;

/** The exact value of a positive finite double as mantissa * 2^exponent. */
function decompose(x: number): { m: bigint; e: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & 0xfffffffffffffn;
  return biased === 0 ? { m: fraction, e: -1074 } : { m: fraction | (1n << 52n), e: biased - 1075 };
}

/** The remainder of two positive finite doubles, exact (the remainder is a double). */
function exactRemainder(a: number, b: number): number {
  const x = decompose(a);
  const y = decompose(b);
  const e = Math.min(x.e, y.e);
  const r = (x.m << BigInt(x.e - e)) % (y.m << BigInt(y.e - e));
  return Number(r) * 2 ** e;
}

describe('mod with a quotient of 2^53 or more', () => {
  const CASES: ReadonlyArray<readonly [number, number]> = [
    [1e308, 0.1],
    [1.5e308, 0.7],
    [1e22, 0.7],
    [2 ** 60, 0.3],
    [10000000000000002, 0.1],
    [1e300, 7.5],
    [1, 1e-320],
    [Number.MAX_VALUE, 1e-300],
  ];

  for (const [a, b] of CASES) {
    it(`mod(${a}, ${b}) is the exact remainder, typed and factory`, () => {
      const expected = exactRemainder(a, b);
      expect(mt.mod(a, b)).toBe(expected);
      expect(mt.factory_mod(a, b)).toBe(expected);
    });
  }

  it('a negative operand gives the sign of the divisor and stays below it', () => {
    for (const [a, b] of [
      [-1e308, 0.3],
      [1e308, -0.3],
      [-1e22, -0.7],
    ] as const) {
      const r = mt.mod(a, b) as number;
      expect(Number.isFinite(r)).toBe(true);
      expect(Math.abs(r)).toBeLessThanOrEqual(Math.abs(b));
      expect(r === 0 || r < 0 === b < 0).toBe(true);
    }
  });

  it('a non-finite operand still gives NaN, and a zero divisor still returns the dividend', () => {
    expect(mt.mod(Infinity, 0.1)).toBeNaN();
    expect(mt.mod(1e308, Infinity)).toBeNaN();
    expect(mt.mod(NaN, 0.1)).toBeNaN();
    expect(mt.mod(1e308, 0)).toBe(1e308);
  });

  it('a quotient below 2^53 keeps the mathjs formula with the snapped floor', () => {
    expect(mt.mod(0.3, 0.1)).toBe(-5.551115123125783e-17);
    expect(mt.mod(5.5, 2)).toBe(1.5);
    expect(mt.mod(-5.5, 2)).toBe(0.5);
  });
});
