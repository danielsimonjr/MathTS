import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clone,
  mapObject,
  extend,
  deepExtend,
  deepFlatten,
} from '@danielsimonjr/mathts-core/internal';

function protoSnapshot() {
  return JSON.stringify(Object.prototype);
}

function ownPolluted(obj: Record<string, unknown>) {
  return Object.getOwnPropertyDescriptor(obj, 'polluted')?.value;
}

describe('object pollution guards', () => {
  let protoBefore: string;

  beforeEach(() => {
    protoBefore = protoSnapshot();
  });

  afterEach(() => {
    expect(protoSnapshot()).toBe(protoBefore);
    expect(ownPolluted(Object.prototype as Record<string, unknown>)).toBeUndefined();
  });

  it('clone skips JSON __proto__ payload without changing global prototype', () => {
    const src = JSON.parse('{"__proto__":{"polluted":true},"a":1}') as Record<string, unknown>;
    const result = clone(src);
    expect(result).toEqual({ a: 1 });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(ownPolluted(result as Record<string, unknown>)).toBeUndefined();
  });

  it('clone skips own __proto__ defined via defineProperty', () => {
    const src: Record<string, unknown> = { a: 1 };
    Object.defineProperty(src, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const result = clone(src);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect((result as { a: number }).a).toBe(1);
    expect(ownPolluted(result as Record<string, unknown>)).toBeUndefined();
  });

  it('mapObject copies a constructor.prototype payload as data and leaves every prototype alone', () => {
    const src = JSON.parse('{"constructor":{"prototype":{"polluted":true}},"x":2}') as Record<
      string,
      unknown
    >;
    const result = mapObject(src, (v) => v);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.keys(result).sort()).toEqual(['constructor', 'x']);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect((Object.prototype as { constructor: unknown }).constructor).toBe(Object);
  });

  it('mapObject skips an own __proto__ key', () => {
    const result = mapObject(JSON.parse('{"__proto__":{"polluted":true},"x":2}'), (v) => v);
    expect(result).toEqual({ x: 2 });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('extend skips an own __proto__ key on the source', () => {
    const target = { a: 1 };
    const result = extend(target, JSON.parse('{"__proto__":{"polluted":true},"b":2}'));
    expect(result).toEqual({ a: 1, b: 2 });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('deepExtend skips names on Object.prototype and Function.prototype', () => {
    const target: Record<string, unknown> = { a: 1 };
    deepExtend(
      target,
      JSON.parse(
        '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"call":1,"b":3}'
      )
    );
    expect(target).toEqual({ a: 1, b: 3 });
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
  });

  it('shallow copies keep data keys that are also names on Function.prototype or Object.prototype', () => {
    const src = { name: 'n', length: 2, call: 3, constructor: 4, toString: 5, a: 1 };
    const expected = { name: 'n', length: 2, call: 3, constructor: 4, toString: 5, a: 1 };
    // clone() recognises plain objects by `constructor === Object`, so a data key named
    // `constructor` is outside its contract; the other shallow copiers have no such test.
    const { constructor: _constructor, ...cloneable } = src;
    expect(clone(cloneable)).toEqual({ name: 'n', length: 2, call: 3, toString: 5, a: 1 });
    expect(mapObject(src, (v) => v)).toEqual(expected);
    expect(extend({}, src)).toEqual(expected);
    expect(deepFlatten({ outer: { name: 'n', length: 2 }, a: 1 })).toEqual({
      name: 'n',
      length: 2,
      a: 1,
    });
  });

  it('deepFlatten does not hoist keys from a skipped __proto__ object', () => {
    const nested = JSON.parse('{"__proto__":{"polluted":true,"nested":9},"a":{"b":1}}') as Record<
      string,
      unknown
    >;
    const flat = deepFlatten(nested);
    expect(flat).toEqual({ b: 1 });
    expect(flat.polluted).toBeUndefined();
    expect(Object.getPrototypeOf(flat)).toBe(Object.prototype);
  });

  it('ordinary objects still clone', () => {
    expect(clone({ a: 1 })).toEqual({ a: 1 });
  });
});
