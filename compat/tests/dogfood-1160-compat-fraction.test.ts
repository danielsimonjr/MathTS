/**
 * Issue #1160 in compat: `fraction` and `number` as callbacks, and the compat `fraction` shim.
 *
 * The compat shim `fraction` was a second implementation of the functions `fraction`: a plain
 * function with an optional second parameter, so `map([1, 4], fraction)` read the index as the
 * denominator. The shim is now the functions `fraction` (a typed-function) plus the no-argument
 * and `undefined` signatures that compat always had (`fraction()` and `fraction(undefined)` are 0).
 * `number` has no shim: `create()` wraps the functions export and keeps its typed data.
 *
 * Values of another library come from the mathjs devDependency of this package (15.2.0).
 */

import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { fraction } from '../src/shims.js';
import { create as mjCreate, all as mjAll } from 'mathjs';

/** The compat instance seen through the loose shape that this file needs. */
type Lib = {
  map(x: unknown, ...rest: unknown[]): unknown;
  matrix(x: unknown): { map(cb: unknown): { toArray(): unknown[] } };
  chain(x: unknown): { map(cb: unknown): { done(): unknown } };
  evaluate(expr: string, scope?: Record<string, unknown>): unknown;
  fraction(...args: unknown[]): unknown;
  number(...args: unknown[]): unknown;
  bignumber(x: unknown): unknown;
};

const mt = create(all) as unknown as Lib;
const mj = mjCreate(mjAll) as unknown as Record<string, (...args: unknown[]) => unknown>;
const frac = fraction as unknown as (...args: unknown[]) => unknown;

/** The text of every entry (deep): a Fraction compares as mathjs prints it ('0.5', '0.(3)'). */
function text(x: unknown): string {
  if (Array.isArray(x)) return String(x.map(text));
  if (x && typeof x === 'object' && typeof (x as { toArray?: unknown }).toArray === 'function') {
    return text((x as { toArray(): unknown }).toArray());
  }
  return String(x);
}

describe('#1160 compat fraction as a callback', () => {
  it('map, Matrix map, chain and evaluate give the mathjs values', () => {
    expect(text(mt.map([1, 4], mt.fraction))).toBe('1,4');
    expect(text(mt.matrix([1, 4]).map(mt.fraction))).toBe('1,4');
    expect(text(mt.chain([1, 4]).map(mt.fraction).done())).toBe('1,4');
    expect(text(mt.evaluate('map([1, 4], fraction)'))).toBe('1,4');
    // The same calls in mathjs 15.2.0.
    expect(text(mj.map([1, 4], mj.fraction))).toBe('1,4');
  });

  it('a matrix with two axes: the index is [i, j]', () => {
    expect(
      text(
        mt
          .matrix([
            [1, 4],
            [2, 3],
          ])
          .map(mt.fraction)
      )
    ).toBe('1,4,2,3');
  });

  it('the shim map', () => {
    expect(text(mt.map([1, 4], frac))).toBe('1,4');
  });
});

describe('#1160 compat number as a callback', () => {
  it('map of strings gives numbers (mathjs [1, 4])', () => {
    expect(mt.map(['1', '4'], mt.number)).toEqual([1, 4]);
    expect(mj.map(['1', '4'], mj.number)).toEqual([1, 4]);
  });
});

describe('#1160 compat fraction: direct calls', () => {
  it('keeps the compat results for no argument and undefined (0)', () => {
    expect(String(frac())).toBe('0');
    expect(String(frac(undefined))).toBe('0');
    expect(String(mt.fraction())).toBe('0');
  });

  it('reads a string, a number and two numbers', () => {
    expect(String(frac('1/3'))).toBe('0.(3)');
    expect(String(frac(0.5))).toBe('0.5');
    expect(String(frac(1, 2))).toBe('0.5');
    expect(() => frac(1.5, 2)).toThrow(/Parameters must be integer/);
  });

  it('converts a value that the old shim rejected, as mathjs does', () => {
    expect(String(frac(null))).toBe('0');
    expect(text(frac([1, 0.5]))).toBe('1,0.5');
    expect(String(frac({ n: 1, d: 3 }))).toBe('0.(3)');
    expect(String(frac(mt.bignumber('0.25')))).toBe('0.25');
    expect(String(frac(true))).toBe('1');
    expect(String(frac(2n ** 64n))).toBe('18446744073709551616');
  });

  it('rejects a third argument and an index as the denominator', () => {
    expect(() => frac(1, 2, 3)).toThrow(TypeError);
    expect(() => frac(1, [0])).toThrow(TypeError);
  });
});

describe('#1160 values of another library (mathjs 15.2.0)', () => {
  it('number reads a BigNumber and a Fraction of mathjs', () => {
    expect(mt.number(mj.bignumber('2.5'))).toBe(2.5);
    expect(mt.number(mj.fraction(1, 4))).toBe(0.25);
  });

  it('fraction reads a BigNumber of mathjs', () => {
    expect(String(mt.fraction(mj.bignumber('0.25')))).toBe('0.25');
    expect(String(frac(mj.bignumber('0.25')))).toBe('0.25');
  });
});
