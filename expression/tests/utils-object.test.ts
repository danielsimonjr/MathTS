import { describe, it, expect } from 'vitest';
import {
  clone,
  mapObject,
  extend,
  deepExtend,
  deepStrictEqual,
  deepFlatten,
  canDefineProperty,
  lazy,
  traverse,
  hasOwnProperty,
  isLegacyFactory,
  get,
  set,
  pick,
  pickShallow,
} from '../src/utils/object.js';

// ---------------------------------------------------------------------------
// clone
// ---------------------------------------------------------------------------
describe('clone (object)', () => {
  it('returns primitives unchanged', () => {
    expect(clone(42)).toBe(42);
    expect(clone('hello')).toBe('hello');
    expect(clone(true)).toBe(true);
    expect(clone(null)).toBeNull();
    expect(clone(undefined)).toBeUndefined();
  });

  it('clones an array recursively', () => {
    const a = [1, 2, 3];
    const b = clone(a);
    expect(b).toEqual(a);
    expect(b).not.toBe(a);
  });

  it('clones a nested array', () => {
    const a = [
      [1, 2],
      [3, 4],
    ];
    const b = clone(a);
    expect(b).toEqual(a);
    expect(b[0]).not.toBe(a[0]);
  });

  it('clones a plain object', () => {
    const obj = { a: 1, b: 2 };
    const c = clone(obj);
    expect(c).toEqual(obj);
    expect(c).not.toBe(obj);
  });

  it('uses the object own clone() method if present', () => {
    const obj = { clone: () => ({ custom: true }) };
    expect(clone(obj)).toEqual({ custom: true });
  });

  it('clones a Date', () => {
    const d = new Date('2020-01-01');
    const c = clone(d);
    expect(c).toEqual(d);
    expect(c).not.toBe(d);
  });

  it('throws for unknown types', () => {
    // A Symbol cannot be cloned
    expect(() => clone(Symbol('x'))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// mapObject
// ---------------------------------------------------------------------------
describe('mapObject', () => {
  it('applies the callback to each own property', () => {
    const result = mapObject({ a: 1, b: 2 }, (v) => v * 10);
    expect(result).toEqual({ a: 10, b: 20 });
  });

  it('returns an empty object for empty input', () => {
    expect(mapObject({}, (v) => v)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// extend
// ---------------------------------------------------------------------------
describe('extend', () => {
  it('copies own properties from b to a', () => {
    const a: Record<string, unknown> = { x: 1 };
    const result: Record<string, unknown> = extend(a, { y: 2, z: 3 });
    expect(result).toEqual({ x: 1, y: 2, z: 3 });
    expect(result).toBe(a);
  });

  it('overwrites existing properties', () => {
    const a: Record<string, unknown> = { x: 1, y: 10 };
    extend(a, { y: 99 });
    expect(a.y).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// deepExtend
// ---------------------------------------------------------------------------
describe('deepExtend', () => {
  it('merges nested plain objects', () => {
    const a: Record<string, unknown> = { nested: { x: 1 } };
    deepExtend(a, { nested: { y: 2 } });
    expect(a.nested).toEqual({ x: 1, y: 2 });
  });

  it('overwrites non-object values', () => {
    const a: Record<string, unknown> = { x: 1 };
    deepExtend(a, { x: 99 });
    expect(a.x).toBe(99);
  });

  it('deep extends array values in b', () => {
    const a: Record<string, unknown> = {};
    deepExtend(a, { arr: [1, 2] });
    expect(a).toEqual({ arr: [1, 2] });
  });

  it('deep extends array values over existing array values in a', () => {
    const a: Record<string, unknown> = { arr: [1, 2] };
    deepExtend(a, { arr: [3, 4, 5] });
    expect(a).toEqual({ arr: [3, 4, 5] });
  });

  it('deep extends arrays with nested objects', () => {
    const a: Record<string, unknown> = { arr: [{ x: 1 }] };
    deepExtend(a, { arr: [{ y: 2 }] });
    expect(a).toEqual({ arr: [{ x: 1, y: 2 }] });
  });

  it('throws when b itself is an array and a is not', () => {
    expect(() => deepExtend({}, [1, 2])).toThrow('Cannot extend an object with an array');
  });

  it('deep extends when both a and b are arrays', () => {
    const a = [1, 2];
    deepExtend(a, [3, 4, 5]);
    expect(a).toEqual([3, 4, 5]);
  });
});

// ---------------------------------------------------------------------------
// deepStrictEqual
// ---------------------------------------------------------------------------
describe('deepStrictEqual', () => {
  it('returns true for equal primitives', () => {
    expect(deepStrictEqual(1, 1)).toBe(true);
    expect(deepStrictEqual('a', 'a')).toBe(true);
  });

  it('returns false for unequal primitives', () => {
    expect(deepStrictEqual(1, 2)).toBe(false);
    expect(deepStrictEqual(1, '1')).toBe(false);
  });

  it('returns true for equal arrays', () => {
    expect(deepStrictEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('returns false for arrays of different length', () => {
    expect(deepStrictEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns false for array vs non-array', () => {
    expect(deepStrictEqual([1], { 0: 1 })).toBe(false);
  });

  it('returns true for equal plain objects', () => {
    expect(deepStrictEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('returns false for objects with different keys', () => {
    expect(deepStrictEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('returns true for same function reference', () => {
    const fn = () => 42;
    expect(deepStrictEqual(fn, fn)).toBe(true);
  });

  it('returns false for different function references', () => {
    expect(
      deepStrictEqual(
        () => 1,
        () => 1
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deepFlatten
// ---------------------------------------------------------------------------
describe('deepFlatten', () => {
  it('flattens nested objects into a single level', () => {
    const result = deepFlatten({ a: { b: 1, c: 2 }, d: 3 });
    expect(result).toEqual({ b: 1, c: 2, d: 3 });
  });

  it('returns the same values for already-flat objects', () => {
    expect(deepFlatten({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
  });
});

// ---------------------------------------------------------------------------
// canDefineProperty
// ---------------------------------------------------------------------------
describe('canDefineProperty', () => {
  it('returns true in modern JS engines', () => {
    expect(canDefineProperty()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// lazy
// ---------------------------------------------------------------------------
describe('lazy', () => {
  it('calls the resolver only once', () => {
    let callCount = 0;
    const obj: Record<string, unknown> = {};
    lazy(obj, 'x', () => {
      callCount++;
      return 42;
    });
    expect(obj['x']).toBe(42);
    expect(obj['x']).toBe(42);
    expect(callCount).toBe(1);
  });

  it('allows the property to be set', () => {
    const obj: Record<string, unknown> = {};
    lazy(obj, 'val', () => 1);
    obj['val'] = 99;
    expect(obj['val']).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// traverse
// ---------------------------------------------------------------------------
describe('traverse', () => {
  it('traverses a dot-separated path, creating missing namespaces', () => {
    const obj: Record<string, unknown> = {};
    const leaf = traverse(obj, 'a.b.c');
    expect(leaf).toBe(
      (obj as unknown as Record<string, Record<string, Record<string, unknown>>>).a.b.c
    );
  });

  it('accepts an array path', () => {
    const obj: Record<string, unknown> = {};
    traverse(obj, ['x', 'y']);
    expect((obj as unknown as Record<string, Record<string, unknown>>).x.y).toBeDefined();
  });

  it('returns the root when path is empty string', () => {
    const obj: Record<string, unknown> = { z: 1 };
    expect(traverse(obj, '')).toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// hasOwnProperty
// ---------------------------------------------------------------------------
describe('hasOwnProperty', () => {
  it('returns true for own properties', () => {
    expect(hasOwnProperty({ a: 1 }, 'a')).toBe(true);
  });

  it('returns false for inherited properties', () => {
    expect(hasOwnProperty({}, 'toString')).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasOwnProperty(null, 'x')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLegacyFactory
// ---------------------------------------------------------------------------
describe('isLegacyFactory', () => {
  it('returns true when object has a factory function', () => {
    expect(isLegacyFactory({ factory: () => {} })).toBe(true);
  });

  it('returns false when factory is not a function', () => {
    expect(isLegacyFactory({ factory: 42 })).toBe(false);
  });

  it('returns false for null and non-objects', () => {
    expect(isLegacyFactory(null)).toBe(false);
    expect(isLegacyFactory(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// get (nested)
// ---------------------------------------------------------------------------
describe('get (object)', () => {
  it('retrieves a top-level property', () => {
    expect(get({ a: 1 }, 'a')).toBe(1);
  });

  it('retrieves a nested property via dot path', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(get(obj, 'a.b.c')).toBe(42);
  });

  it('retrieves a nested property via array path', () => {
    const obj = { a: { b: 99 } };
    expect(get(obj, ['a', 'b'])).toBe(99);
  });

  it('returns undefined for missing keys', () => {
    expect(get({}, 'missing')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// set (nested)
// ---------------------------------------------------------------------------
describe('set (object)', () => {
  it('sets a top-level property', () => {
    const obj: Record<string, unknown> = {};
    set(obj, 'x', 42);
    expect(obj.x).toBe(42);
  });

  it('sets a nested property, creating intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    set(obj, 'a.b.c', 99);
    expect((obj as { a: { b: { c: number } } }).a.b.c).toBe(99);
  });

  it('sets a property via array path', () => {
    const obj: Record<string, unknown> = {};
    set(obj, ['m', 'n'], 7);
    expect((obj as { m: { n: number } }).m.n).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// pick
// ---------------------------------------------------------------------------
describe('pick', () => {
  it('picks the specified properties', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('skips missing properties', () => {
    const obj = { a: 1 };
    expect(pick(obj, ['a', 'z'])).toEqual({ a: 1 });
  });

  it('applies transform when provided', () => {
    const obj = { a: 5 };
    const result = pick(obj, ['a'], (v) => (v as number) * 2);
    expect(result).toEqual({ a: 10 });
  });
});

// ---------------------------------------------------------------------------
// pickShallow
// ---------------------------------------------------------------------------
describe('pickShallow', () => {
  it('picks top-level properties without deep traversal', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pickShallow(obj, ['a', 'b'])).toEqual({ a: 1, b: 2 });
  });

  it('skips missing properties', () => {
    const obj = { a: 1 };
    expect(pickShallow(obj, ['a', 'missing'])).toEqual({ a: 1 });
  });
});
