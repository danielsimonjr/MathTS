/**
 * Unit tests for the parameter-list reader (#1151): `readParameterList`, `parameterName` and
 * `callbackArity` of `src/utils/function-source.ts`.
 *
 * A source that a real function gives through `toString()` is read from that function where the
 * form allows it. The other sources are string literals, so that each case holds the same text
 * under `bun test` and under vitest (a transpiler can print a source in another layout).
 */

import { describe, it, expect } from 'vitest';
import { callbackArity, parameterName, readParameterList } from '../src/utils/function-source.js';

/** The entries of the parameter list of `source`, or undefined when the source is not readable. */
function params(source: string): string[] | undefined {
  return readParameterList(source)?.params;
}

describe('readParameterList: the end of the list', () => {
  it('does not stop at the first ")": a parenthesised default stays inside its entry', () => {
    expect(params('(x=(1), y) => x+y')).toEqual(['x=(1)', 'y']);
    expect(params('function(x=(1+2), y){return x*y}')).toEqual(['x=(1+2)', 'y']);
    expect(params('(x, y=(1)) => x+y')).toEqual(['x', 'y=(1)']);
    expect(params('(a, b=(1), ...r) => r.length')).toEqual(['a', 'b=(1)', '...r']);
  });

  it('leaves a comment out of the entry text', () => {
    expect(params('(x /* ) */, y) => x+y')).toEqual(['x', 'y']);
    expect(params('(x, // ) , z\n y) => x+y')).toEqual(['x', 'y']);
  });

  it('skips a ")" and a "," inside a string and inside a template literal', () => {
    expect(params(`(x = ')', y) => x`)).toEqual([`x = ')'`, 'y']);
    expect(params(`(x = ",", y) => x`)).toEqual([`x = ","`, 'y']);
    expect(params('(x = `)${(1)}`, y) => x')).toEqual(['x = `)${(1)}`', 'y']);
    expect(params('(x = `${ `)` }`, y) => x')).toEqual(['x = `${ `)` }`', 'y']);
  });

  it('keeps a nested pattern, array and object in one entry', () => {
    expect(params('({a, b}, [c]) => a')).toEqual(['{a, b}', '[c]']);
    expect(params('(a = [1, 2], b = {c: (1)}) => a')).toEqual(['a = [1, 2]', 'b = {c: (1)}']);
  });

  it('drops the empty entry of a trailing comma and of an empty list', () => {
    expect(params('(a, b,) => a')).toEqual(['a', 'b']);
    expect(params('() => 1')).toEqual([]);
    expect(params('function () {}')).toEqual([]);
  });

  it('stops at the matching ")" and never reads the body', () => {
    // A body that is not balanced and not a valid program must not change the result.
    expect(params("(a, b) => { ((( '")).toEqual(['a', 'b']);
  });

  it('gives undefined when the list is not closed', () => {
    expect(readParameterList('(a, b')).toBeUndefined();
    expect(readParameterList('(a = ")", b')).toBeUndefined();
    expect(readParameterList('(a, /* b')).toBeUndefined();
    expect(readParameterList('')).toBeUndefined();
    expect(readParameterList('   ')).toBeUndefined();
  });
});

describe('readParameterList: division, regex literal and rest', () => {
  it('reads "/" after a value as a division', () => {
    const arrow = (a: number, s = 1 / 2) => a * s;
    const list = readParameterList(arrow.toString());
    expect(list?.params).toHaveLength(2);
    expect(callbackArity(arrow)).toEqual({ count: 2, rest: false });
    expect(params('(a, s = 1 / (2), ...r) => 0')).toHaveLength(3);
    expect(callbackArity((a: number, s = 1 / 2, ...r: number[]) => a + s + r.length).rest).toBe(
      true
    );
    expect(params('(a = b / c / (d), e) => a')).toEqual(['a = b / c / (d)', 'e']);
    expect(params('(a = x[1] / 2, e) => a')).toEqual(['a = x[1] / 2', 'e']);
  });

  it('reads "/" after an operator, "(" or "," as a regex literal', () => {
    expect(params(String.raw`(a = /\)/, ...r) => a`)).toEqual([String.raw`a = /\)/`, '...r']);
    expect(params('(a = /[)/]/, b) => a')).toEqual(['a = /[)/]/', 'b']);
    expect(params('(a = typeof /)/, b) => a')).toEqual(['a = typeof /)/', 'b']);
    expect(params('(a = (/,/), b) => a')).toEqual(['a = (/,/)', 'b']);
  });

  it('reports a rest parameter after a parenthesised default', () => {
    const f = (a: number, b = 1, ...r: number[]) => a + b + r.length;
    expect(callbackArity(f).rest).toBe(true);
    expect(callbackArity((a: number, ...r: number[]) => a + r.length).rest).toBe(true);
    expect(callbackArity((a: number, b: number) => a + b).rest).toBe(false);
  });
});

describe('readParameterList: the header', () => {
  it('reads an arrow function with one bare parameter', () => {
    expect(readParameterList('x => x')).toEqual({
      kind: 'arrow',
      generator: false,
      name: undefined,
      params: ['x'],
    });
    expect(readParameterList('async a => a')).toMatchObject({ kind: 'arrow', params: ['a'] });
    expect(readParameterList('/* c */ x /* d */ => x')).toMatchObject({
      kind: 'arrow',
      params: ['x'],
    });
  });

  it('reads an arrow function with a list, async or not', () => {
    expect(readParameterList('(a, b) => a')).toMatchObject({ kind: 'arrow', params: ['a', 'b'] });
    expect(readParameterList('async (a, b) => a')).toMatchObject({
      kind: 'arrow',
      params: ['a', 'b'],
    });
    expect(readParameterList('async(a) => a')).toMatchObject({ kind: 'arrow', params: ['a'] });
  });

  it('reads a function expression with its own name', () => {
    expect(readParameterList('function f (x, y) { return x }')).toEqual({
      kind: 'function',
      generator: false,
      name: 'f',
      params: ['x', 'y'],
    });
    expect(readParameterList('function (x) { return x }')).toMatchObject({
      kind: 'function',
      name: undefined,
    });
    expect(readParameterList('async function f(a) {}')).toMatchObject({
      kind: 'function',
      name: 'f',
      params: ['a'],
    });
    expect(readParameterList('function /* ( */ f /* ) */ (a) {}')).toMatchObject({
      name: 'f',
      params: ['a'],
    });
    expect(readParameterList('function $f_1 (a) {}')).toMatchObject({ name: '$f_1' });
  });

  it('flags a generator', () => {
    expect(readParameterList('function* g(a) {}')).toEqual({
      kind: 'function',
      generator: true,
      name: 'g',
      params: ['a'],
    });
    expect(readParameterList('function *(a) {}')).toMatchObject({
      generator: true,
      name: undefined,
    });
    expect(readParameterList('async function* g(a) {}')).toMatchObject({ generator: true });
  });

  it('reads a method, a getter and a setter: kind method, no name', () => {
    const obj = {
      m(a: number, ...r: number[]) {
        return a + r.length;
      },
      async *ag(a: number) {
        yield a;
      },
      *g(a: number) {
        yield a;
      },
      ['x' + 1](a: number) {
        return a;
      },
      'a(b'(c: number) {
        return c;
      },
      get p() {
        return 1;
      },
      set p(v: number) {
        void v;
      },
    } as Record<string, unknown>;
    expect(readParameterList((obj.m as () => void).toString())).toMatchObject({
      kind: 'method',
      name: undefined,
    });
    expect(callbackArity(obj.m as () => void).rest).toBe(true);
    expect(readParameterList((obj.ag as () => void).toString())).toMatchObject({
      kind: 'method',
      generator: true,
      params: ['a'],
    });
    expect(readParameterList((obj.g as () => void).toString())).toMatchObject({
      kind: 'method',
      generator: true,
    });
    expect(readParameterList((obj.x1 as () => void).toString())).toMatchObject({
      kind: 'method',
      params: ['a'],
    });
    expect(readParameterList((obj['a(b'] as () => void).toString())).toMatchObject({
      kind: 'method',
      params: ['c'],
    });
    const desc = Object.getOwnPropertyDescriptor(obj, 'p') as PropertyDescriptor;
    expect(readParameterList((desc.get as () => void).toString())).toMatchObject({
      kind: 'method',
      params: [],
    });
    expect(readParameterList((desc.set as () => void).toString())).toMatchObject({
      kind: 'method',
      params: ['v'],
    });
  });

  it('reads literal method sources whatever the transpiler prints', () => {
    expect(readParameterList('m(a, ...r) {}')).toMatchObject({
      kind: 'method',
      params: ['a', '...r'],
    });
    expect(readParameterList('async *m(a) {}')).toMatchObject({ kind: 'method', generator: true });
    expect(readParameterList('get p() { return 1 }')).toMatchObject({ kind: 'method', params: [] });
    expect(readParameterList('set p(v) {}')).toMatchObject({ kind: 'method', params: ['v'] });
    expect(readParameterList(`['x' + 1](a) { return a }`)).toMatchObject({
      kind: 'method',
      params: ['a'],
    });
    expect(readParameterList(`'a(b'(c) {}`)).toMatchObject({ kind: 'method', params: ['c'] });
    expect(readParameterList('async(a) { }')).toMatchObject({ kind: 'method', params: ['a'] });
  });

  it('gives undefined for a class', () => {
    class A {
      constructor(public a: number) {}
    }
    expect(readParameterList(A.toString())).toBeUndefined();
    expect(readParameterList('class { constructor(a) {} }')).toBeUndefined();
    expect(callbackArity(A as never).rest).toBeUndefined();
  });

  it('reads a function that new Function made', () => {
    const f = new Function('a', 'b', 'return a');
    expect(params(f.toString())).toEqual(['a', 'b']);
  });

  it('gives no parameter for a native and for a bound function (the rest of a bound function is hidden)', () => {
    expect(readParameterList(Math.sqrt.toString())).toMatchObject({ kind: 'function', params: [] });
    const bound = ((a: number, ...r: number[]) => a + r.length).bind(null);
    expect(params(bound.toString())).toEqual([]);
    expect(callbackArity(bound).rest).toBe(false);
    // The count is the larger of the declared length and the number of entries.
    expect(callbackArity(Math.sqrt)).toEqual({ count: 1, rest: false });
    expect(callbackArity(Math.pow)).toEqual({ count: 2, rest: false });
  });
});

describe('callbackArity', () => {
  it('counts a defaulted parameter that function.length leaves out', () => {
    const f = (a: number, s = 1 / 2) => a * s;
    expect(f.length).toBe(1);
    expect(callbackArity(f)).toEqual({ count: 2, rest: false });
    const g = (a: number, b = 1, c = 2) => a + b + c;
    expect(callbackArity(g)).toEqual({ count: 3, rest: false });
  });

  it('is unknown (rest undefined) when the source cannot be read', () => {
    const f = (a: number) => a;
    Object.defineProperty(f, 'toString', { value: () => '(a, b' });
    expect(callbackArity(f).rest).toBeUndefined();
    expect(callbackArity(f).count).toBe(1);
  });
});

describe('parameterName', () => {
  it('returns the name of a plain entry, a default and a rest entry', () => {
    expect(parameterName('x')).toBe('x');
    expect(parameterName('x = (1)')).toBe('x');
    expect(parameterName('x=(1)')).toBe('x');
    expect(parameterName('...r')).toBe('r');
    expect(parameterName('$a_1')).toBe('$a_1');
  });

  it('reads a name with the Unicode identifier rule', () => {
    expect(parameterName('π = 1')).toBe('π');
    expect(parameterName('ünï')).toBe('ünï');
    const zwnj = String.fromCharCode(0x200c);
    expect(parameterName('a' + zwnj + 'b')).toBe('a' + zwnj + 'b');
  });

  it('gives undefined for a pattern and for a text that is not one name', () => {
    expect(parameterName('{a} = {}')).toBeUndefined();
    expect(parameterName('{a, b}')).toBeUndefined();
    expect(parameterName('[a, b] = []')).toBeUndefined();
    expect(parameterName('...[a, b]')).toBeUndefined();
    expect(parameterName('')).toBeUndefined();
    expect(parameterName('1a')).toBeUndefined();
    expect(parameterName('a b')).toBeUndefined();
    // A backslash escape in a name is not a plain identifier.
    expect(parameterName(String.fromCharCode(92) + 'u006fouter')).toBeUndefined();
  });

  it('reads the entries of a list that has two patterns', () => {
    const list = readParameterList('({a, b}, [c]) => a');
    expect(list?.params.map(parameterName)).toEqual([undefined, undefined]);
  });
});
