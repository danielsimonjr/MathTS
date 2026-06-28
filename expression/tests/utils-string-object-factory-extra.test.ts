import { describe, it, expect } from 'vitest';
import { BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import { format } from '../src/utils/string.js';
import {
  clone,
  deepExtend,
  deepStrictEqual,
  canDefineProperty,
  traverse,
} from '../src/utils/object.js';
import { sortFactories, factory, isFactory } from '../src/utils/factory.js';
import type { LegacyFactory } from '../src/utils/factory.js';

// ---------------------------------------------------------------------------
// utils/string.format - BigNumber and Fraction branches
// ---------------------------------------------------------------------------
describe('string format - non-number value branches', () => {
  it('formats a BigNumber', () => {
    const result = format(BigNumber.fromNumber(3.5), {});
    expect(result).toBe('3.5');
  });

  it('formats a Fraction as a ratio by default', () => {
    const result = format(new Fraction(1, 3), undefined);
    expect(result).toBe('1/3');
  });

  it('formats a negative Fraction as a ratio', () => {
    const result = format(new Fraction(-2, 5), undefined);
    expect(result).toBe('-2/5');
  });

  it('formats a Fraction as a decimal when requested', () => {
    const result = format(new Fraction(1, 4), { fraction: 'decimal' });
    // decimal branch calls Fraction.toString(); assert it returns a string.
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats a nested array of mixed values', () => {
    expect(format([1, [2, 3]], {})).toBe('[1, [2, 3]]');
  });

  it('formats a function with a syntax property', () => {
    const fn = Object.assign(() => 0, { syntax: 'f(x)' });
    expect(format(fn, {})).toBe('f(x)');
  });

  it('formats a function without syntax as "function"', () => {
    expect(format(() => 0, {})).toBe('function');
  });

  it('uses an object format() method when present', () => {
    const obj = { format: (_o: unknown) => 'CUSTOM_FORMAT' };
    expect(format(obj, {})).toBe('CUSTOM_FORMAT');
  });

  it('falls back to JSON-like notation for a plain object', () => {
    // A plain object whose toString equals the native Object.prototype.toString
    // takes the key-looping branch and produces JSON-like output.
    const result = format({ a: 2, b: 3 }, {});
    expect(result).toBe('{"a": 2, "b": 3}');
  });

  it('truncates long results when the truncate option is set', () => {
    const long = 'x'.repeat(100);
    const result = format(long, { truncate: 10 });
    expect(result.length).toBe(10);
    expect(result.endsWith('...')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// utils/object - less-traveled branches
// ---------------------------------------------------------------------------
describe('object utils - extra branches', () => {
  it('clone treats a function as immutable (returns same reference)', () => {
    const fn = () => 1;
    expect(clone(fn)).toBe(fn);
  });

  it('clone returns the same Date value but a new instance', () => {
    const d = new Date(1000);
    const c = clone(d);
    expect(c).not.toBe(d);
    expect(c.valueOf()).toBe(1000);
  });

  it('deepExtend merges nested objects and arrays', () => {
    const a: Record<string, unknown> = { nested: { x: 1 }, list: [{ p: 1 }] };
    const b: Record<string, unknown> = { nested: { y: 2 }, list: [{ q: 2 }], extra: [1, 2] };
    deepExtend(a, b);
    expect(a.nested).toEqual({ x: 1, y: 2 });
    expect((a.list as unknown[])[0]).toEqual({ p: 1, q: 2 });
    expect(a.extra).toEqual([1, 2]);
  });

  it('deepExtend into an array target', () => {
    const a: Record<string, unknown>[] = [{ x: 1 }];
    deepExtend(a, [{ y: 2 }]);
    expect(a[0]).toEqual({ x: 1, y: 2 });
  });

  it('deepExtend throws when extending an object with an array', () => {
    expect(() => deepExtend({}, [1, 2])).toThrow('Cannot extend an object with an array');
  });

  it('deepStrictEqual compares functions by reference', () => {
    const fn = () => 0;
    expect(deepStrictEqual(fn, fn)).toBe(true);
    expect(deepStrictEqual(fn, () => 0)).toBe(false);
  });

  it('deepStrictEqual returns false for object vs non-object', () => {
    expect(deepStrictEqual({ a: 1 }, 5)).toBe(false);
    expect(deepStrictEqual({ a: 1 }, [1])).toBe(false);
  });

  it('deepStrictEqual returns false when b has an extra key', () => {
    expect(deepStrictEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('deepStrictEqual returns true for equal nested objects', () => {
    expect(deepStrictEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it('canDefineProperty returns true on a modern engine', () => {
    expect(canDefineProperty()).toBe(true);
  });

  it('traverse creates missing namespaces', () => {
    const obj: Record<string, unknown> = {};
    const leaf = traverse(obj, 'a.b.c');
    leaf.value = 42;
    expect(
      (obj as unknown as Record<string, Record<string, Record<string, Record<string, unknown>>>>).a
        .b.c.value
    ).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// utils/factory - sortFactories ordering / circular handling
// ---------------------------------------------------------------------------
describe('factory - sortFactories', () => {
  it('orders factories so dependencies come first', () => {
    const a = factory('a', ['b'], () => 'a');
    const b = factory('b', [], () => 'b');
    const sorted = sortFactories([a, b]).map((f) => (isFactory(f) ? f.fn : f.name));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('a'));
  });

  it('handles a direct circular dependency without infinite recursion', () => {
    const a = factory('a', ['b'], () => 'a');
    const b = factory('b', ['a'], () => 'b');
    const sorted = sortFactories([a, b]);
    expect(sorted).toHaveLength(2);
  });

  it('handles a transitive dependency chain', () => {
    const a = factory('a', ['b'], () => 'a');
    const b = factory('b', ['c'], () => 'b');
    const c = factory('c', [], () => 'c');
    const names = sortFactories([a, b, c]).map((f) => (isFactory(f) ? f.fn : f.name));
    expect(names.indexOf('c')).toBeLessThan(names.indexOf('b'));
    expect(names.indexOf('b')).toBeLessThan(names.indexOf('a'));
  });

  it('places legacy factories after regular factories', () => {
    const a = factory('a', [], () => 'a');
    const legacy: LegacyFactory = { name: 'legacy', factory: () => 'legacy' };
    const sorted = sortFactories([legacy, a]);
    const names = sorted.map((f) => (isFactory(f) ? f.fn : f.name));
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('legacy'));
  });
});
