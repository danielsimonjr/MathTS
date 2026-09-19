import { describe, it, expect } from 'vitest';
import { ObjectWrappingMap, PartitionedMap } from '../src/map.js';

/**
 * Drain an iterator with next(). entries() and [Symbol.iterator]() return a bare iterator that
 * is not itself iterable (a pre-existing limitation of mapIterator), so spread cannot be used.
 */
function drain<T>(it: Iterator<T>): T[] {
  const out: T[] = [];
  for (let r = it.next(); !r.done; r = it.next()) out.push(r.value);
  return out;
}

describe('ObjectWrappingMap', () => {
  it('iterates keys, values and entries of the wrapped object', () => {
    const m = new ObjectWrappingMap<string, number>({ a: 1, b: 2 });
    expect([...m.keys()]).toEqual(['a', 'b']);
    expect([...m.values()]).toEqual([1, 2]);
    expect(drain(m.entries())).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(drain(m[Symbol.iterator]())).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('getOrInsert keeps an existing value and inserts a missing one', () => {
    const obj: Record<string, number> = { a: 1 };
    const m = new ObjectWrappingMap<string, number>(obj);
    expect(m.getOrInsert('a', 9)).toBe(1);
    expect(m.getOrInsert('b', 2)).toBe(2);
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  it('getOrInsertComputed calls the callback only for a missing key', () => {
    const obj: Record<string, number> = { a: 1 };
    const m = new ObjectWrappingMap<string, number>(obj);
    const calls: string[] = [];
    const compute = (key: string) => {
      calls.push(key);
      return key.length * 10;
    };
    expect(m.getOrInsertComputed('a', compute)).toBe(1);
    expect(m.getOrInsertComputed('bb', compute)).toBe(20);
    expect(calls).toEqual(['bb']);
    expect(obj.bb).toBe(20);
  });
});

describe('PartitionedMap', () => {
  const make = () => {
    const a = new Map<string, number>([['x', 1]]);
    const b = new Map<string, number>([['y', 2]]);
    return { a, b, p: new PartitionedMap(a, b, new Set(['y', 'z'])) };
  };

  it('iterates keys, values and entries of both partitions', () => {
    const { p } = make();
    expect([...p.keys()]).toEqual(['x', 'y']);
    expect([...p.values()]).toEqual([1, 2]);
    expect(drain(p.entries())).toEqual([
      ['x', 1],
      ['y', 2],
    ]);
  });

  it('getOrInsert writes a missing key to its partition', () => {
    const { a, b, p } = make();
    expect(p.getOrInsert('x', 9)).toBe(1);
    expect(p.getOrInsert('z', 3)).toBe(3);
    expect(p.getOrInsert('w', 4)).toBe(4);
    expect(b.get('z')).toBe(3);
    expect(a.get('w')).toBe(4);
  });

  it('getOrInsertComputed calls the callback only for a missing key', () => {
    const { b, p } = make();
    let calls = 0;
    const compute = () => {
      calls += 1;
      return 7;
    };
    expect(p.getOrInsertComputed('y', compute)).toBe(2);
    expect(p.getOrInsertComputed('z', compute)).toBe(7);
    expect(calls).toBe(1);
    expect(b.get('z')).toBe(7);
  });
});
