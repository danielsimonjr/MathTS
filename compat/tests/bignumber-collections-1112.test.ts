import * as reference from 'mathjs';
import { BigNumber as NativeBigNumber } from '@danielsimonjr/mathts-core';
import { BigNumber as CompatBigNumber, create, all, bignumberDependencies } from '../src/index.js';
/**
 * #1112: compat `bignumber` converts collections and keeps a BigNumber return type for a scalar.
 * `tsc -p tsconfig.test.json` compiles the type lines; `bun test` runs the value checks.
 */
import { describe, it, expect } from 'vitest';
import type { BigNumber } from '@danielsimonjr/mathts-core';
import { bignumber, fraction, matrix } from '../src/shims.js';

// Type fixtures: each line compiles only when a scalar call returns BigNumber.
// #1587: `bignumber` takes one argument, as in mathjs, so a `map(bignumber)`
// callback shape (value, index, array) must wrap the value itself.
const xs: BigNumber[] = [1, 2].map((x) => bignumber(x));
type Ret = ReturnType<typeof bignumber>;
const one: BigNumber = bignumber(1) as Ret;
const single: BigNumber = bignumber(1);

const isBig = (v: unknown): boolean => !!v && (v as { isBigNumber?: boolean }).isBigNumber === true;
const str = (v: unknown): string => String(v);

describe('compat bignumber (#1112)', () => {
  it('keeps the BigNumber type for a scalar', () => {
    expect(xs.map(str)).toEqual(['1', '2']);
    expect(str(one)).toBe('1');
    expect(str(single)).toBe('1');
  });
  it('converts an Array element by element', () => {
    const r = bignumber([1, 2]) as unknown[];
    expect(Array.isArray(r)).toBe(true);
    expect(r.every(isBig)).toBe(true);
    expect(r.map(str)).toEqual(['1', '2']);
  });
  it('converts a Matrix element by element', () => {
    const m = bignumber(matrix([[1, 2]])) as { isMatrix?: boolean; toArray(): unknown[][] };
    expect(m.isMatrix).toBe(true);
    expect(m.toArray()[0].every(isBig)).toBe(true);
    expect(m.toArray()[0].map(str)).toEqual(['1', '2']);
  });
  it('returns 0 for no value and keeps a BigNumber', () => {
    expect(str(bignumber())).toBe('0');
    const b = bignumber(7);
    expect(bignumber(b)).toBe(b);
  });
  it('converts null, a boolean, a bigint and a Fraction (the old shim gave +-Infinity)', () => {
    expect(str(bignumber(null))).toBe('0');
    expect(str(bignumber(true))).toBe('1');
    expect(str(bignumber(5n))).toBe('5');
    const fromFraction = fraction(1, 3) as import('../src/index.js').MathjsFraction;
    expect(str(bignumber(fromFraction as unknown as Parameters<typeof bignumber>[0]))).toBe(
      '0.3333333333333333333333333333333333333333333333333333333333333333'
    );
  });
});

it('retains mathjs notation through construction, arithmetic and JSON', () => {
  const full = create(all);
  const selected = create({ bignumberDependencies });
  for (const value of ['1e-7', '-1.23e-6', '1e20', '1e21', '9.99e30', 'NaN', 'Infinity']) {
    const expected = reference.bignumber(value);
    for (const actual of [
      bignumber(value),
      full.bignumber(value),
      selected.bignumber(value),
      new CompatBigNumber(value),
      new full.BigNumber(value),
      full.evaluate('bignumber(x)', { x: value }) as CompatBigNumber,
    ]) {
      expect(String(actual)).toBe(String(expected));
      expect(actual + '').toBe(expected + '');
      expect(Number(actual)).toBe(Number(expected));
      expect(String(actual.times(2).plus(1))).toBe(String(expected.times(2).plus(1)));
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
      expect(String(JSON.parse(JSON.stringify(actual), full.reviver))).toBe(String(expected));
    }
  }
  const configured = create(all, { number: 'BigNumber' });
  expect(String(configured.evaluate('1e25'))).toBe('1e+25');
  expect(String(configured.parse('1e25').evaluate())).toBe('1e+25');
  expect(String(full.add(1, full.bignumber('1e25')))).toBe('1.0000000000000000000000001e+25');
  expect(String(new NativeBigNumber('1e21'))).toBe('1000000000000000000000');
});
