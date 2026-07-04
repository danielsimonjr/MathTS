import { describe, it, expect, vi } from 'vitest';
import { hasOwnProperty, endsWith, warnOnce, memoize } from '../src/shared.js';

describe('hasOwnProperty', () => {
  it('should return true for own property', () => {
    expect(hasOwnProperty({ a: 1 }, 'a')).toBe(true);
  });

  it('should return false for inherited property', () => {
    expect(hasOwnProperty({}, 'toString')).toBe(false);
  });

  it('should return false for missing property', () => {
    expect(hasOwnProperty({ a: 1 }, 'b')).toBe(false);
  });

  it('should return falsy for null object', () => {
    expect(hasOwnProperty(null, 'a')).toBeFalsy();
  });

  it('should return falsy for undefined object', () => {
    expect(hasOwnProperty(undefined, 'a')).toBeFalsy();
  });

  it('should work with array indices', () => {
    expect(hasOwnProperty([1, 2, 3], '0')).toBe(true);
    expect(hasOwnProperty([1, 2, 3], '5')).toBe(false);
  });
});

describe('endsWith', () => {
  it('is true only when text ends with search', () => {
    expect(endsWith('meter', 'ter')).toBe(true);
    expect(endsWith('meter', 'met')).toBe(false);
    expect(endsWith('meter', 'meter')).toBe(true);
    expect(endsWith('m', 'meter')).toBe(false);
  });
  it('treats the empty search as a suffix of anything', () => {
    expect(endsWith('anything', '')).toBe(true);
  });
});

describe('warnOnce', () => {
  it('warns only once per distinct message', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const msg = `unique-${Math.random()}`; // avoid collision with the module-level dedupe set
    warnOnce(msg);
    warnOnce(msg);
    warnOnce(msg);
    expect(spy.mock.calls.filter((c) => c.includes(msg)).length).toBe(1);
    spy.mockRestore();
  });
});

describe('memoize', () => {
  it('computes once per distinct argument set, then serves from cache', () => {
    let calls = 0;
    const f = memoize((x: unknown) => {
      calls += 1;
      return (x as number) * 2;
    });
    expect(f(21)).toBe(42);
    expect(f(21)).toBe(42);
    expect(calls).toBe(1); // second call hit the cache
    expect(f(5)).toBe(10);
    expect(calls).toBe(2);
  });

  it('honors a custom hasher', () => {
    let calls = 0;
    const f = memoize(
      (obj: unknown) => {
        calls += 1;
        return (obj as { id: number }).id;
      },
      { hasher: (args) => String((args[0] as { id: number }).id) }
    );
    expect(f({ id: 7 })).toBe(7);
    expect(f({ id: 7 })).toBe(7); // different object, same hash → cached
    expect(calls).toBe(1);
  });

  it('recomputes after the cache is cleared via `delete fn.cache`', () => {
    let calls = 0;
    const f = memoize((x: unknown) => {
      calls += 1;
      return x;
    });
    f(1);
    delete f.cache;
    f(1);
    expect(calls).toBe(2); // cleared cache forces recomputation (Unit createUnit relies on this)
  });

  it('bounds the cache to `limit` entries with LRU eviction (Unit passes limit: 100)', () => {
    let calls = 0;
    const f = memoize(
      (x: unknown) => {
        calls += 1;
        return x;
      },
      { limit: 2 }
    );
    f('a'); // cache: a
    f('b'); // cache: a,b
    f('a'); // hit → touch a → cache order: b,a
    f('c'); // insert c, size 3 > 2 → evict LRU = b → cache: a,c
    expect(calls).toBe(3); // a, b, c each computed once
    f('a'); // still cached (was touched)
    expect(calls).toBe(3);
    f('b'); // was evicted → recompute
    expect(calls).toBe(4);
  });
});
