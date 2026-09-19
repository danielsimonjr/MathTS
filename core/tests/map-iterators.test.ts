import { describe, it, expect } from 'vitest';
import { ObjectWrappingMap, PartitionedMap } from '../src/map.js';

/**
 * A real Map's keys()/values()/entries() return iterable iterators: each one can be spread,
 * looped with for-of, passed to Array.from, and its [Symbol.iterator]() returns itself.
 * These tests hold both Map-like classes in core/src/map.ts to that contract.
 */
type MapLike = Map<string, number>;

const cases: Array<[string, () => MapLike, Array<[string, number]>]> = [
  [
    'ObjectWrappingMap',
    () => new ObjectWrappingMap<string, number>({ a: 1, b: 2 }),
    [
      ['a', 1],
      ['b', 2],
    ],
  ],
  [
    'PartitionedMap',
    () =>
      new PartitionedMap<string, number>(
        new Map([['x', 1]]),
        new Map([['y', 2]]),
        new Set(['y'])
      ) as unknown as MapLike,
    [
      ['x', 1],
      ['y', 2],
    ],
  ],
];

describe.each(cases)('%s iterators behave like Map iterators', (_name, make, expected) => {
  const keys = expected.map(([k]) => k);
  const values = expected.map(([, v]) => v);
  const methods = [
    ['entries', expected],
    ['keys', keys],
    ['values', values],
  ] as const;

  for (const [method, want] of methods) {
    const iter = (m: MapLike): IterableIterator<unknown> =>
      (m[method] as () => IterableIterator<unknown>).call(m);

    it(`${method}(): spread`, () => {
      expect([...iter(make())]).toEqual(want);
    });

    it(`${method}(): for-of`, () => {
      const out: unknown[] = [];
      for (const e of iter(make())) out.push(e);
      expect(out).toEqual(want);
    });

    it(`${method}(): Array.from`, () => {
      expect(Array.from(iter(make()))).toEqual(want);
    });

    it(`${method}(): [Symbol.iterator]() returns the iterator itself`, () => {
      const it = iter(make());
      expect(typeof it[Symbol.iterator]).toBe('function');
      expect(it[Symbol.iterator]()).toBe(it);
    });

    it(`${method}(): next() protocol`, () => {
      const it = iter(make());
      for (const w of want) expect(it.next()).toEqual({ value: w, done: false });
      const end = it.next();
      expect(end.done).toBe(true);
      expect(end.value).toBeUndefined();
      expect(it.next().done).toBe(true);
    });
  }

  it('[Symbol.iterator]() result is itself iterable, like Map.prototype[Symbol.iterator]', () => {
    const m = make();
    expect([...m[Symbol.iterator]()]).toEqual(expected);
  });

  it('for-of over the map itself yields the entries', () => {
    const out: unknown[] = [];
    for (const e of make()) out.push(e);
    expect(out).toEqual(expected);
  });
});
