import { describe, it, expect } from 'vitest';
import {
  getSafeProperty,
  setSafeProperty,
  isSafeProperty,
  getSafeMethod,
  isSafeMethod,
  isPlainObject,
} from '../src/utils/customs.js';

describe('utils/customs - isPlainObject', () => {
  it('returns true for plain object literals', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('returns false for arrays, dates, functions, regexps', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(() => 0)).toBe(false);
    expect(isPlainObject(/x/)).toBe(false);
  });

  it('returns false for class instances', () => {
    class Foo {}
    expect(isPlainObject(new Foo())).toBe(false);
  });

  it('returns falsy for primitives, null, undefined', () => {
    expect(isPlainObject(null)).toBeFalsy();
    expect(isPlainObject(undefined)).toBeFalsy();
    expect(isPlainObject(0)).toBe(false);
    expect(isPlainObject('s')).toBe(false);
    expect(isPlainObject(true)).toBe(false);
  });
});

describe('utils/customs - isSafeProperty', () => {
  it('returns true for own properties of a plain object', () => {
    expect(isSafeProperty({ a: 1 }, 'a')).toBe(true);
    // non-existent own property: still safe to read/set (returns undefined)
    expect(isSafeProperty({}, 'somethingNew')).toBe(true);
  });

  it('returns true for whitelisted native properties on arrays', () => {
    expect(isSafeProperty([1, 2], 'length')).toBe(true);
  });

  it('returns false for properties inherited from Object.prototype', () => {
    expect(isSafeProperty({}, 'constructor')).toBe(false);
    expect(isSafeProperty({}, 'toString')).toBe(false);
    expect(isSafeProperty({}, 'hasOwnProperty')).toBe(false);
    expect(isSafeProperty({}, '__proto__')).toBe(false);
    expect(isSafeProperty({}, 'valueOf')).toBe(false);
  });

  it('returns false for properties inherited from Function.prototype', () => {
    // Function.prototype lookups on plain objects — guarded against
    expect(isSafeProperty({}, 'call')).toBe(false);
    expect(isSafeProperty({}, 'apply')).toBe(false);
    expect(isSafeProperty({}, 'bind')).toBe(false);
  });

  it('returns false for non-plain-object non-array values', () => {
    expect(isSafeProperty(new Date(), 'getTime')).toBe(false);
    class Foo {
      a = 1;
    }
    expect(isSafeProperty(new Foo(), 'a')).toBe(false);
  });
});

describe('utils/customs - getSafeProperty', () => {
  it('returns the value for a safe property', () => {
    expect(getSafeProperty({ x: 42 }, 'x')).toBe(42);
    expect(getSafeProperty([10, 20, 30], 'length')).toBe(3);
  });

  it('throws "No access to property" for unsafe properties', () => {
    expect(() => getSafeProperty({}, 'constructor')).toThrow(/No access to property/);
    expect(() => getSafeProperty({}, '__proto__')).toThrow(/No access to property/);
  });

  it('throws "Cannot access method as a property" when accessing a method', () => {
    expect(() => getSafeProperty({}, 'toString')).toThrow(
      /Cannot access method "toString" as a property/
    );
  });

  it('throws for non-plain-object inputs', () => {
    class Foo {
      a = 1;
    }
    expect(() => getSafeProperty(new Foo(), 'a')).toThrow(/No access/);
  });
});

describe('utils/customs - setSafeProperty', () => {
  it('sets and returns the value for a safe property', () => {
    const o: Record<string, unknown> = {};
    expect(setSafeProperty(o, 'x', 7)).toBe(7);
    expect(o.x).toBe(7);
  });

  it('throws when setting an unsafe property', () => {
    expect(() => setSafeProperty({}, 'constructor', 1)).toThrow(/No access/);
    expect(() => setSafeProperty({}, '__proto__', {})).toThrow(/No access/);
    expect(() => setSafeProperty({}, 'toString', () => 'x')).toThrow(/No access/);
  });
});

describe('utils/customs - isSafeMethod', () => {
  it('returns true for whitelisted inherited methods (toString/valueOf/toLocaleString)', () => {
    // The whitelist applies when the method is inherited (not own) — own
    // copies of toString/etc. are flagged as "ghosted" instead.
    expect(isSafeMethod({}, 'toString')).toBe(true);
    expect(isSafeMethod({}, 'valueOf')).toBe(true);
    expect(isSafeMethod({}, 'toLocaleString')).toBe(true);
  });

  it('returns true for own methods on a plain object', () => {
    expect(isSafeMethod({ foo: () => 1 }, 'foo')).toBe(true);
  });

  it('returns false for unsafe inherited methods', () => {
    expect(isSafeMethod({}, 'constructor')).toBe(false);
    expect(isSafeMethod({}, 'hasOwnProperty')).toBe(false);
    expect(isSafeMethod(() => 0, 'call')).toBe(false);
    expect(isSafeMethod(() => 0, 'apply')).toBe(false);
    expect(isSafeMethod(() => 0, 'bind')).toBe(false);
  });

  it('returns false when the property is not a function', () => {
    expect(isSafeMethod({ a: 1 }, 'a')).toBe(false);
  });

  it('returns false for null or undefined object', () => {
    expect(isSafeMethod(null, 'toString')).toBe(false);
    expect(isSafeMethod(undefined, 'toString')).toBe(false);
  });

  it('returns false for ghosted prototype methods (overridden on the instance)', () => {
    class Foo {
      bar() {
        return 'proto';
      }
    }
    const f = new Foo();
    f.bar = () => 'ghost';
    expect(isSafeMethod(f, 'bar')).toBe(false);
  });
});

describe('utils/customs - getSafeMethod', () => {
  it('returns the method when safe', () => {
    const obj = { greet: () => 'hi' };
    const m = getSafeMethod(obj, 'greet');
    expect(typeof m).toBe('function');
    expect(m()).toBe('hi');
  });

  it('throws for unsafe methods', () => {
    expect(() => getSafeMethod({}, 'constructor')).toThrow(/No access to method/);
    expect(() => getSafeMethod(() => 0, 'call')).toThrow(/No access to method/);
  });
});
