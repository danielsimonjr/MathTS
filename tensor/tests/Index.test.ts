import { describe, it, expect } from 'vitest';
import { Index, idx } from '../src/named-index';

describe('Index — construction', () => {
  it('creates an index with the given dim and name', () => {
    const i = new Index(3, { name: 'i' });
    expect(i.dim).toBe(3);
    expect(i.name).toBe('i');
    expect(i.primeLevel).toBe(0);
    expect(i.tags).toEqual([]);
  });

  it('idx convenience factory sets name correctly', () => {
    const i = idx(4, 'j');
    expect(i.dim).toBe(4);
    expect(i.name).toBe('j');
  });

  it('idx with opts forwards tags and primeLevel', () => {
    const i = idx(2, 'k', { tags: ['site'], primeLevel: 1 });
    expect(i.tags).toEqual(['site']);
    expect(i.primeLevel).toBe(1);
  });

  it('two indices with the same dim and name have DIFFERENT ids', () => {
    const a = idx(3, 'i');
    const b = idx(3, 'i');
    expect(a.id).not.toBe(b.id);
  });

  it('reusing a reference preserves identity', () => {
    const a = idx(3, 'i');
    const ref = a;
    expect(ref.id).toBe(a.id);
  });

  it('throws for non-positive integer dim', () => {
    expect(() => new Index(0)).toThrow();
    expect(() => new Index(-1)).toThrow();
  });
});

describe('Index — prime / noprime', () => {
  it('prime returns a new Index with incremented primeLevel', () => {
    const i = idx(3, 'i');
    const ip = i.prime();
    expect(ip.primeLevel).toBe(1);
    expect(ip.id).toBe(i.id); // same identity
    expect(i.primeLevel).toBe(0); // original unchanged
  });

  it('prime(by) increments by the given amount', () => {
    const i = idx(3, 'i');
    const ip3 = i.prime(3);
    expect(ip3.primeLevel).toBe(3);
  });

  it('noprime resets primeLevel to 0', () => {
    const i = idx(3, 'i').prime(5);
    const i0 = i.noprime();
    expect(i0.primeLevel).toBe(0);
    expect(i.primeLevel).toBe(5); // original unchanged
  });

  it('prime / noprime return new instances (immutability)', () => {
    const i = idx(3, 'i');
    const ip = i.prime();
    expect(ip).not.toBe(i);
    const i0 = ip.noprime();
    expect(i0).not.toBe(ip);
  });
});

describe('Index — tags', () => {
  it('addTag returns a new Index with the tag added', () => {
    const i = idx(3, 'i');
    const it2 = i.addTag('site');
    expect(it2.hasTag('site')).toBe(true);
    expect(i.hasTag('site')).toBe(false); // original unchanged
    expect(it2).not.toBe(i);
  });

  it('addTag is a no-op if tag already present (returns same object)', () => {
    const i = idx(3, 'i', { tags: ['site'] });
    const i2 = i.addTag('site');
    expect(i2).toBe(i); // identity preserved for no-op
  });

  it('removeTag returns a new Index with the tag removed', () => {
    const i = idx(3, 'i', { tags: ['site', 'phys'] });
    const i2 = i.removeTag('site');
    expect(i2.hasTag('site')).toBe(false);
    expect(i2.hasTag('phys')).toBe(true);
    expect(i.hasTag('site')).toBe(true); // original unchanged
  });

  it('removeTag is a no-op if tag absent (returns same object)', () => {
    const i = idx(3, 'i');
    const i2 = i.removeTag('absent');
    expect(i2).toBe(i);
  });

  it('hasTag returns false for unknown tag', () => {
    const i = idx(3, 'i');
    expect(i.hasTag('nope')).toBe(false);
  });
});

describe('Index — matches', () => {
  it('an index matches itself', () => {
    const i = idx(3, 'i');
    expect(i.matches(i)).toBe(true);
  });

  it('two independently created indices with same dim/name do NOT match', () => {
    const a = idx(3, 'i');
    const b = idx(3, 'i');
    expect(a.matches(b)).toBe(false);
  });

  it('prime(i) does NOT match i (different primeLevel)', () => {
    const i = idx(3, 'i');
    const ip = i.prime();
    expect(i.matches(ip)).toBe(false);
    expect(ip.matches(i)).toBe(false);
  });

  it('noprime(prime(i)) matches i', () => {
    const i = idx(3, 'i');
    const ip = i.prime();
    const i0 = ip.noprime();
    expect(i0.matches(i)).toBe(true);
  });

  it('different tags do NOT prevent matching (tags are irrelevant for matches)', () => {
    const i = idx(3, 'i');
    const it2 = i.addTag('extra');
    expect(i.matches(it2)).toBe(true);
  });
});

describe('Index — toString', () => {
  it('includes name and dim', () => {
    const i = idx(3, 'i');
    expect(i.toString()).toContain('i');
    expect(i.toString()).toContain('3');
  });

  it('includes prime markers for primeLevel > 0', () => {
    const ip = idx(3, 'i').prime(2);
    expect(ip.toString()).toContain("''");
  });
});
