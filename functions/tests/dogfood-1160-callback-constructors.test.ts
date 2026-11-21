/**
 * Issue #1160: `fraction`, `number` and `transpose` as callbacks of `map`, `forEach`, `filter`,
 * the Matrix methods and `evaluate`.
 *
 * Mechanism: the three exports were plain functions with optional positional parameters
 * (`fraction(n, d?)`, `number(x, valuelessUnit?)`, `transpose(data, rows?, cols?)`). Every callback
 * adapter resolves the arity only of a typed-function; for a plain function it uses the declared
 * length, so the second parameter received the index (`new Fraction(1, [0])` divides by zero).
 * mathjs builds the three as typed-functions, so `typed.resolve` picks the one-argument signature
 * on every surface. The fix does the same.
 *
 * Expected values: mathjs 15.2.0 (the `MJ:` lines of the plan-review probe). A Fraction compares
 * through `String`, as mathjs does ('0.5', '0.(3)').
 */

import { describe, it, expect } from 'vitest';
import {
  chain,
  complex,
  evaluate,
  filter,
  forEach,
  fraction,
  map,
  mapSlices,
  matrix,
  number,
  sparse,
  transpose,
  unit,
} from '../src/index.js';

/** The Matrix surface that these tests use: `matrix` and `sparse` are typed as returning `unknown`. */
interface Mat {
  map(callback: unknown): Mat;
  forEach(callback: unknown): void;
  toArray(): unknown[];
}
const mat = matrix as unknown as (data: unknown) => Mat;
const spr = sparse as unknown as (data: unknown) => Mat;
const chn = chain as unknown as (data: unknown) => { map(callback: unknown): { done(): unknown } };

type Fn = (...args: unknown[]) => unknown;

/** The array of a result: a Matrix gives its array, an Array stays. */
function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : (x as { toArray(): unknown[] }).toArray();
}

/** The text of every entry (deep), so that a Fraction compares as mathjs prints it. */
function text(x: unknown): string {
  return String(
    Array.isArray(x) ? x.map(text) : x && typeof x === 'object' && 'toArray' in x ? text(arr(x)) : x
  );
}

const frac = fraction as unknown as Fn;
const num = number as unknown as Fn;
const tr = transpose as unknown as Fn;
const cplx = complex as unknown as Fn;

describe('#1160 fraction as a callback', () => {
  it('map, filter and forEach of an Array', () => {
    const r = map([1, 4], frac as never) as unknown[];
    expect(r.map(String)).toEqual(['1', '4']);
    expect(r.every((v) => (v as { type?: string }).type === 'Fraction')).toBe(true);
    expect(filter([1, 4], frac as never)).toEqual([1, 4]);
    expect(() => forEach([1, 4], frac as never)).not.toThrow();
  });

  it('the Matrix methods map, forEach and the function filter of a Matrix', () => {
    expect(text(mat([1, 4]).map(frac as never))).toBe('1,4');
    expect(() => mat([1, 4]).forEach(frac as never)).not.toThrow();
    expect(text(filter(mat([1, 4]), frac as never))).toBe('1,4');
    expect(text(map(mat([1, 4]), frac as never))).toBe('1,4');
  });

  it('a matrix with two axes: the index is [i, j]', () => {
    expect(
      text(
        mat([
          [1, 4],
          [2, 3],
        ]).map(frac as never)
      )
    ).toBe('1,4,2,3');
    expect(
      text(
        map(
          [
            [1, 4],
            [2, 3],
          ],
          frac as never
        )
      )
    ).toBe('1,4,2,3');
  });

  it('evaluate: map of an Array and of a range', () => {
    // RED before the fix: [1, 2] (the index 1 became the denominator), and [1, 1, 1] for the range.
    expect(text(evaluate('map([1, 4], fraction)'))).toBe('1,4');
    expect(text(evaluate('map(1:3, fraction)'))).toBe('1,2,3');
    expect(text(evaluate('filter([1, 4], fraction)'))).toBe('1,4');
    expect(() => evaluate('forEach([1, 4], fraction)')).not.toThrow();
  });

  it('mapSlices and chain', () => {
    expect(text(mapSlices([[1, 4]], 1, frac as never))).toBe('1,4');
    expect(
      text(
        chn([1, 4])
          .map(frac as never)
          .done()
      )
    ).toBe('1,4');
  });

  it('SparseMatrix map and forEach (the Matrix methods have no arity adapter of their own)', () => {
    const s = () =>
      spr([
        [1, 0],
        [0, 4],
      ]);
    expect(text(s().map(frac as never))).toBe('1,0,0,4');
    expect(text(map(s(), frac as never))).toBe('1,0,0,4');
    expect(() => s().forEach(frac as never)).not.toThrow();
    expect(() => forEach(s(), frac as never)).not.toThrow();
    expect(text(s().map(num as never))).toBe('1,0,0,4');
    // A function with a rest parameter keeps all three arguments on a SparseMatrix.
    const rest = new Function('return (a, ...r) => r.length')() as never;
    expect(text(s().map(rest))).toBe('2,2,2,2');
  });

  it('two arrays keep the two-argument signature (value, value)', () => {
    expect(text(map([1, 4], [2, 2], frac as never))).toBe('0.5,2');
    expect(text(evaluate('map([1, 4], [2, 2], fraction)'))).toBe('0.5,2');
  });

  it('a plain Array.prototype.map passes the index: the typed function rejects three arguments', () => {
    expect(() => [1, 4].map(frac as never)).toThrow(TypeError);
  });
});

describe('#1160 number as a callback', () => {
  it('map, forEach and Matrix methods', () => {
    expect(map(['1', '4'], num as never)).toEqual([1, 4]);
    expect(filter(['1', '4'], num as never)).toEqual(['1', '4']);
    expect(() => forEach(['1', '4'], num as never)).not.toThrow();
    expect(arr(mat(['1', '4']).map(num as never))).toEqual([1, 4]);
    expect(() => mat(['1', '4']).forEach(num as never)).not.toThrow();
    expect(arr(map(mat(['1', '4']), num as never))).toEqual([1, 4]);
  });

  it('evaluate keeps working (guard: it passes before the fix)', () => {
    expect(arr(evaluate('map(["1", "4"], number)'))).toEqual([1, 4]);
  });
});

describe('#1160 transpose as a callback', () => {
  it('map of an Array and of a Matrix', () => {
    expect(map([1, 4], tr as never)).toEqual([1, 4]);
    expect(arr(mat([1, 4]).map(tr as never))).toEqual([1, 4]);
  });

  it('evaluate keeps working (guard)', () => {
    expect(arr(evaluate('map([1, 4], transpose)'))).toEqual([1, 4]);
  });
});

describe('#1160 complex keeps its call-shape check (guard: fixed before this batch)', () => {
  it('map and evaluate', () => {
    expect((map([1, 4], cplx as never) as unknown[]).map(String)).toEqual(['1', '4']);
    expect(text(evaluate('map([1, 4], complex)'))).toBe('1,4');
  });
});

describe('#1160 fraction: direct calls', () => {
  it('rejects a call that mathjs rejects', () => {
    expect(() => frac(1, 2, 3 as never)).toThrow(TypeError);
    expect(() => frac(1, [0] as never)).toThrow(TypeError);
    expect(() => frac(complex(1, 2) as never)).toThrow(TypeError);
    expect(() => frac(undefined as never)).toThrow(TypeError);
    expect(() => frac(1, null as never)).toThrow(TypeError);
    expect(() => frac(new Date(4) as never)).toThrow(TypeError);
  });

  it('converts what mathjs converts', () => {
    expect(String(frac(null as never))).toBe('0');
    expect(text(frac([1, 0.5] as never))).toBe('1,0.5');
    expect(text(frac(mat([1, 0.5]) as never))).toBe('1,0.5');
    expect(String(frac({ n: 1, d: 3 } as never))).toBe('0.(3)');
    const u = frac(unit('0.5 m') as never) as { value: { type?: string } };
    expect(u.value.type).toBe('Fraction');
    expect(String(u.value)).toBe('0.5');
    expect(String(frac(true as never))).toBe('1');
    expect(String(frac('1/3' as never))).toBe('0.(3)');
    expect(String(frac(0.1 as never))).toBe('0.1');
  });

  it('keeps the calls that work today', () => {
    expect(String(frac(1, '3' as never))).toBe('0.(3)');
    expect(String(frac(1n as never, 3 as never))).toBe('0.(3)');
    expect(String(frac(1, true as never))).toBe('1');
    expect(String(frac(1.5, 2))).toBe('0.75');
    expect(String(frac(1, undefined as never))).toBe('1');
    expect(String(frac(1, 2))).toBe('0.5');
  });

  it('keeps every digit of a bigint (no conversion to number)', () => {
    expect(String(frac((2n ** 64n) as never))).toBe('18446744073709551616');
  });
});

describe('#1160 number: direct calls', () => {
  it('rejects a value that mathjs rejects', () => {
    expect(() => num(undefined as never)).toThrow(TypeError);
    expect(() => num({} as never)).toThrow(TypeError);
    expect(() => num(cplx(1, 0) as never)).toThrow(TypeError);
    expect(() => num(new Date(5) as never)).toThrow(TypeError);
  });

  it('keeps the calls that work today', () => {
    expect(num()).toBe(0);
    expect(num(null as never)).toBe(0);
    expect(num('NaN' as never)).toBeNaN();
    expect(num('1' as never, undefined as never)).toBe(1);
    expect(num('0x10' as never)).toBe(16);
    expect(num('' as never)).toBe(0);
    expect(num(true as never)).toBe(1);
    expect(num(1n as never)).toBe(1);
    expect(() => num('abc' as never)).toThrow(SyntaxError);
    expect(() => num('abc' as never)).toThrow('String "abc" is not a valid number');
    expect(num(unit('5 m') as never, 'cm' as never)).toBe(500);
    expect(num([unit('5 m')] as never, 'cm' as never)).toEqual([500]);
    expect(num(['1', ['2']] as never)).toEqual([1, [2]]);
    expect(String((num(unit('5 m') as never) as { value: number }).value)).toBe('5');
  });

  it('keeps the TypeError of a text and a number with a unit argument', () => {
    expect(() => num('5' as never, 'cm' as never)).toThrow(TypeError);
    expect(() => num(1, 2 as never)).toThrow(TypeError);
  });
});

describe('#1160 transpose: direct calls', () => {
  it('keeps the calls that work today', () => {
    expect(Array.from(tr([1, 2, 3, 4, 5, 6], 2, 3) as ArrayLike<number>)).toEqual([
      1, 4, 2, 5, 3, 6,
    ]);
    expect(tr(1)).toBe(1);
    expect(tr('a')).toBe('a');
    expect(
      tr([
        [1, 2],
        [3, 4],
      ])
    ).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(tr([1, 2])).toEqual([1, 2]);
    expect(Array.from(tr(new Float64Array([1, 2, 3, 4, 5, 6]), 2, 3) as ArrayLike<number>)).toEqual(
      [1, 4, 2, 5, 3, 6]
    );
  });

  it('keeps the TypeError of a typed array without rows and cols, and of a bad length', () => {
    expect(() => tr(new Float64Array(4))).toThrow(TypeError);
    expect(() => tr(new Float64Array(3), 2, 2)).toThrow('data length 3 !== rows*cols (4)');
  });

  it('rejects no argument: mathjs gives a TypeError', () => {
    expect(() => tr()).toThrow(TypeError);
    expect(() => tr()).toThrow(/in function transpose/);
  });
});
