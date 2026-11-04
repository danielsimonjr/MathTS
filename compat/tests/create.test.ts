import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

/**
 * EXPANSION_PLAN W5 — `compat` exposes the full functions surface.
 * `all` is the real @danielsimonjr/mathts-functions namespace (not an empty
 * placeholder) and `create(all)` surfaces it, with the compat shims overlaid.
 */
describe('compat create(all)', () => {
  it('all is the full functions namespace, not an empty placeholder', () => {
    expect(Object.keys(all).length).toBeGreaterThan(100);
  });

  it('create(all) surfaces the full functions surface', () => {
    const math = create(all);
    expect(typeof math.det).toBe('function');
    expect(typeof math.integrate).toBe('function');
    expect(typeof math.eigs).toBe('function');
    expect(typeof math.simplify).toBe('function');
  });

  it('create() with no arguments defaults to all', () => {
    const math = create();
    expect(typeof math.det).toBe('function');
  });

  it('keeps the compat shims for type constructors and arithmetic', () => {
    const math = create(all);
    expect(typeof math.add).toBe('function');
    expect(math.add(1, 2)).toBe(3);
    expect(typeof math.complex).toBe('function');
  });

  it('config still works', () => {
    const math = create(all);
    expect(math.config().precision).toBe(64);
    math.config({ precision: 32 });
    expect(math.config().precision).toBe(32);
  });

  it('computes a determinant through the surfaced function', () => {
    const math = create(all);
    const det = math.det as (m: number[][]) => number;
    expect(
      det([
        [1, 2],
        [3, 4],
      ])
    ).toBe(-2);
  });
});

describe('compat create(all) lazy wrapping', () => {
  it('a frozen instance still calls its functions (wrapper served from the closure)', () => {
    const math = Object.freeze(create(all)) as unknown as {
      add: (a: number, b: number) => number;
    };
    expect(math.add(1, 2)).toBe(3);
    expect(math.add).toBe(math.add);
  });

  it('memoizes wrappers: math.add === math.add and stays stable across reads', () => {
    const math = create(all) as Record<string, unknown>;
    const first = math.add;
    expect(typeof first).toBe('function');
    expect(math.add).toBe(first);
    expect(math.add).toBe(first);
    expect(math.sqrt).toBe(math.sqrt);
  });

  it('keeps wrappers per-instance (not shared between instances)', () => {
    const a = create(all) as Record<string, unknown>;
    const b = create(all) as Record<string, unknown>;
    expect(a.add).not.toBe(b.add);
  });

  it('Object.keys lists the whole surface, unchanged by accessing members', () => {
    const math = create(all) as Record<string, unknown>;
    const before = Object.keys(math);
    expect(before.length).toBeGreaterThan(Object.keys(all).length - 1);
    for (const key of Object.keys(all)) expect(before).toContain(key);
    expect(before).toContain('config');
    expect(before).toContain('chain');
    // touch every member (forces every lazy wrapper), then compare order + content
    for (const key of before) void math[key];
    expect(Object.keys(math)).toEqual(before);
    // function-valued members are still functions after materialization
    for (const key of before) {
      const v = math[key];
      if (typeof v === 'function') expect(math[key]).toBe(v);
    }
  });

  it('members are enumerable own properties and remain assignable', () => {
    const math = create(all) as Record<string, unknown>;
    expect(Object.prototype.propertyIsEnumerable.call(math, 'add')).toBe(true);
    const custom = () => 'custom';
    math.add = custom;
    expect(math.add).toBe(custom);
    // assignment before first read of another member must not disturb it
    expect(typeof math.subtract).toBe('function');
  });

  it('spread of an instance materializes the same keys', () => {
    const math = create(all) as Record<string, unknown>;
    expect(Object.keys({ ...math })).toEqual(Object.keys(math));
  });
});
