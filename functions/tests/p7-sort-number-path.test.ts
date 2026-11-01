/**
 * P7-9 pins: number comparator path for sort (asc/desc, Matrix, in-place).
 */
import { describe, it, expect } from 'vitest';
import { sort, matrix, bignumber, compareNatural } from '../src/index.js';
import { factory_compare } from '../src/factories/index.js';

function tokens(xs: unknown[]): string[] {
  return xs.map((x) => (Object.is(x, -0) ? '-0' : Number.isNaN(x) ? 'NaN' : String(x)));
}

describe('P7-9 sort number path', () => {
  it('sorts a seeded array ascending, bit-exact including -0/0 and NaN placement', () => {
    const a = [3, -0, 1, NaN, 0, 2, -1];
    const expected = a.slice().sort(factory_compare as (x: number, y: number) => number);
    const got = sort(a) as number[];
    expect(got).toBe(a);
    expect(tokens(got)).toEqual(tokens(expected));
  });

  it('sorts descending with the found number comparator', () => {
    const a = [3, 1, 2, -0, 0];
    const got = sort(a, 'desc') as number[];
    expect(got[0]).toBe(3);
    expect(got[1]).toBe(2);
    expect(got[2]).toBe(1);
    expect(got[3] === 0 && got[4] === 0).toBe(true);
  });

  it('mutates a plain array in place', () => {
    const a = [5, 1, 4];
    const out = sort(a) as number[];
    expect(out).toBe(a);
    expect(a).toEqual([1, 4, 5]);
  });

  it('keeps Matrix storage and sorts the 1-d vector', () => {
    const m = matrix([5, 1, 4]) as { storage(): string; toArray(): number[] };
    const out = sort(m) as { storage(): string; toArray(): number[] };
    expect(out.storage()).toBe(m.storage());
    expect(out.toArray()).toEqual([1, 4, 5]);
  });

  it('custom comparator is unchanged', () => {
    const byLen = (x: unknown, y: unknown) => (x as string).length - (y as string).length;
    expect(sort(['Langdon', 'Tom', 'Sara'], byLen)).toEqual(['Tom', 'Sara', 'Langdon']);
  });

  it('natural-order string sort is unchanged', () => {
    expect(sort(['C', 'B', 'A', 'D'], 'natural')).toEqual(['A', 'B', 'C', 'D']);
    expect(sort(['C', 'B', 'A', 'D'], compareNatural)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('BigNumber stays on the generic path', () => {
    const a = [3, 1, 2].map((x) => bignumber(x));
    const got = sort(a) as { toString(): string }[];
    expect(got.map((x) => x.toString())).toEqual(['1', '2', '3']);
  });
});
