import { describe, it, expect } from 'vitest';
import {
  ObjectWrappingMap,
  PartitionedMap,
  createEmptyMap,
  createMap,
  toObject,
  assign,
  isObjectWrappingMap,
} from '../src/utils/map.js';

// ---------------------------------------------------------------------------
// ObjectWrappingMap
// ---------------------------------------------------------------------------
describe('ObjectWrappingMap', () => {
  it('get returns the value for a safe key', () => {
    const m = new ObjectWrappingMap({ x: 42 });
    expect(m.get('x')).toBe(42);
  });

  it('get returns undefined for a missing key', () => {
    const m = new ObjectWrappingMap({});
    expect(m.get('missing')).toBeUndefined();
  });

  it('set stores a value and returns this', () => {
    const m = new ObjectWrappingMap<string, number>({});
    const ret = m.set('y', 99);
    expect(ret).toBe(m);
    expect(m.get('y')).toBe(99);
  });

  it('has returns true for an existing safe key', () => {
    const m = new ObjectWrappingMap({ a: 1 });
    expect(m.has('a')).toBe(true);
  });

  it('has returns false for missing keys', () => {
    const m = new ObjectWrappingMap({});
    expect(m.has('z')).toBe(false);
  });

  it('has returns false for unsafe keys like __proto__', () => {
    const m = new ObjectWrappingMap({});
    expect(m.has('__proto__' as any)).toBe(false);
  });

  it('keys returns an iterator over own safe keys', () => {
    const m = new ObjectWrappingMap({ a: 1, b: 2 });
    expect([...m.keys()].sort()).toEqual(['a', 'b']);
  });

  it('values returns an iterator over values', () => {
    const m = new ObjectWrappingMap({ a: 10, b: 20 });
    expect([...m.values()].sort()).toEqual([10, 20]);
  });

  it('entries returns [key, value] pairs', () => {
    const m = new ObjectWrappingMap({ x: 5 });
    // entries() returns a custom Iterator (not IterableIterator), so collect manually
    const it = m.entries();
    const entries: [string, number][] = [];
    let next = it.next();
    while (!next.done) {
      entries.push(next.value as [string, number]);
      next = it.next();
    }
    expect(entries).toEqual([['x', 5]]);
  });

  it('forEach iterates all entries', () => {
    const m = new ObjectWrappingMap({ p: 1, q: 2 });
    const collected: [string, number][] = [];
    m.forEach((v, k) => collected.push([k as string, v as number]));
    expect(collected.sort()).toEqual([
      ['p', 1],
      ['q', 2],
    ]);
  });

  it('delete removes the key and returns true', () => {
    const m = new ObjectWrappingMap<string, number>({ a: 1 });
    expect(m.delete('a')).toBe(true);
    expect(m.has('a')).toBe(false);
  });

  it('delete returns false for an unsafe key', () => {
    const m = new ObjectWrappingMap({});
    expect(m.delete('__proto__' as any)).toBe(false);
  });

  it('clear removes all entries', () => {
    const m = new ObjectWrappingMap({ a: 1, b: 2 });
    m.clear();
    expect([...m.keys()]).toEqual([]);
  });

  it('size reflects the number of own properties', () => {
    const m = new ObjectWrappingMap({ a: 1, b: 2, c: 3 });
    expect(m.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// PartitionedMap
// ---------------------------------------------------------------------------
describe('PartitionedMap', () => {
  function makePartitioned() {
    const a = new Map<string, number>([
      ['shared', 1],
      ['onlyA', 2],
    ]);
    const b = new Map<string, number>([['onlyB', 3]]);
    const bKeys = new Set(['onlyB']);
    return new PartitionedMap(a, b, bKeys);
  }

  it('get reads from a for non-bKeys', () => {
    const pm = makePartitioned();
    expect(pm.get('onlyA')).toBe(2);
    expect(pm.get('shared')).toBe(1);
  });

  it('get reads from b for bKeys', () => {
    const pm = makePartitioned();
    expect(pm.get('onlyB')).toBe(3);
  });

  it('set writes to b for bKeys', () => {
    const pm = makePartitioned();
    pm.set('onlyB', 99);
    expect(pm.b.get('onlyB')).toBe(99);
  });

  it('set writes to a for non-bKeys', () => {
    const pm = makePartitioned();
    pm.set('newKey', 42);
    expect(pm.a.get('newKey')).toBe(42);
  });

  it('has returns true when key exists in either partition', () => {
    const pm = makePartitioned();
    expect(pm.has('onlyA')).toBe(true);
    expect(pm.has('onlyB')).toBe(true);
  });

  it('has returns false for missing keys', () => {
    const pm = makePartitioned();
    expect(pm.has('gone')).toBe(false);
  });

  it('keys returns all keys from both partitions', () => {
    const pm = makePartitioned();
    const keys = [...pm.keys()].sort();
    expect(keys).toEqual(['onlyA', 'onlyB', 'shared']);
  });

  it('values returns all values', () => {
    const pm = makePartitioned();
    const values = [...pm.values()].sort();
    expect(values).toEqual([1, 2, 3]);
  });

  it('entries returns all [key,value] pairs', () => {
    const pm = makePartitioned();
    // entries() returns a custom Iterator (not IterableIterator), collect manually
    const it = pm.entries();
    const entries: [string, number][] = [];
    let next = it.next();
    while (!next.done) {
      entries.push(next.value as [string, number]);
      next = it.next();
    }
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    expect(entries).toEqual([
      ['onlyA', 2],
      ['onlyB', 3],
      ['shared', 1],
    ]);
  });

  it('forEach iterates all entries', () => {
    const pm = makePartitioned();
    const keys: string[] = [];
    pm.forEach((_v, k) => keys.push(k as string));
    expect(keys.sort()).toEqual(['onlyA', 'onlyB', 'shared']);
  });

  it('delete removes from the correct partition', () => {
    const pm = makePartitioned();
    pm.delete('onlyB');
    expect(pm.has('onlyB')).toBe(false);
  });

  it('clear empties both partitions', () => {
    const pm = makePartitioned();
    pm.clear();
    expect(pm.size).toBe(0);
  });

  it('size returns the total number of keys', () => {
    const pm = makePartitioned();
    expect(pm.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// createEmptyMap
// ---------------------------------------------------------------------------
describe('createEmptyMap', () => {
  it('returns an empty Map', () => {
    const m = createEmptyMap();
    expect(m.size).toBe(0);
    expect(m instanceof Map).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createMap
// ---------------------------------------------------------------------------
describe('createMap', () => {
  it('returns an empty Map for no argument', () => {
    const m = createMap();
    expect(m.size).toBe(0);
  });

  it('returns the same Map instance when passed a Map', () => {
    const original = new Map([['a', 1]]);
    expect(createMap(original)).toBe(original);
  });

  it('wraps a plain object in ObjectWrappingMap', () => {
    const m = createMap({ x: 42 });
    expect(m.get('x')).toBe(42);
  });

  it('throws for unsupported inputs', () => {
    expect(() => createMap(42 as any)).toThrow('createMap can create maps from objects or Maps');
  });
});

// ---------------------------------------------------------------------------
// toObject
// ---------------------------------------------------------------------------
describe('toObject', () => {
  it('returns the wrapped object for ObjectWrappingMap', () => {
    const inner = { a: 1 };
    const m = new ObjectWrappingMap(inner);
    expect(toObject(m)).toBe(inner);
  });

  it('converts a regular Map to a plain object', () => {
    const m = new Map([
      ['x', 10],
      ['y', 20],
    ]);
    const obj = toObject(m);
    expect(obj).toEqual({ x: 10, y: 20 });
  });
});

// ---------------------------------------------------------------------------
// assign
// ---------------------------------------------------------------------------
describe('assign', () => {
  it('copies entries from a Map into the target map', () => {
    const target = new Map<string, number>();
    const source = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    assign(target, source);
    expect(target.get('a')).toBe(1);
    expect(target.get('b')).toBe(2);
  });

  it('copies entries from a plain object', () => {
    const target = new Map<string, number>();
    assign(target, { x: 5, y: 6 } as any);
    expect(target.get('x')).toBe(5);
    expect(target.get('y')).toBe(6);
  });

  it('skips null/undefined sources', () => {
    const target = new Map([['a', 1]]);
    assign(target, null, undefined);
    expect(target.size).toBe(1);
  });

  it('merges multiple sources', () => {
    const target = new Map<string, number>();
    assign(target, { a: 1 } as any, new Map([['b', 2]]));
    expect(target.get('a')).toBe(1);
    expect(target.get('b')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isObjectWrappingMap
// ---------------------------------------------------------------------------
describe('isObjectWrappingMap', () => {
  it('returns true for ObjectWrappingMap instances', () => {
    expect(isObjectWrappingMap(new ObjectWrappingMap({ a: 1 }))).toBe(true);
  });

  it('returns false for regular Maps', () => {
    expect(isObjectWrappingMap(new Map())).toBe(false);
  });

  it('returns false for plain objects', () => {
    expect(isObjectWrappingMap({})).toBe(false);
  });

  it('returns false for null', () => {
    expect(isObjectWrappingMap(null)).toBe(false);
  });
});
