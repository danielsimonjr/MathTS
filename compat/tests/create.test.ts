import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { MATHJS_PARITY_NAMES } from '../src/parity-names.generated.js';

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
    const math = create(all) as unknown as Record<string, unknown>;
    const first = math.add;
    expect(typeof first).toBe('function');
    expect(math.add).toBe(first);
    expect(math.add).toBe(first);
    expect(math.sqrt).toBe(math.sqrt);
  });

  it('keeps wrappers per-instance (not shared between instances)', () => {
    const a = create(all) as unknown as Record<string, unknown>;
    const b = create(all) as unknown as Record<string, unknown>;
    expect(a.add).not.toBe(b.add);
  });

  it('for…in lists the whole surface, unchanged by accessing members', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    const names = (): string[] => {
      const out: string[] = [];
      for (const key in math) out.push(key);
      return out;
    };
    const before = names();
    for (const key of Object.keys(all)) expect(before).toContain(key);
    expect(before).toContain('config');
    expect(before).toContain('chain');
    for (const key of before) expect(key in math).toBe(true);
    // touch every member (forces every lazy wrapper), then compare order + content
    for (const key of before) void math[key];
    expect(names()).toEqual(before);
    // function-valued members are still functions after materialization
    for (const key of before) {
      const v = math[key];
      if (typeof v === 'function') expect(math[key]).toBe(v);
    }
  });

  it('Object.keys lists exactly the mathjs-parity names, unchanged by access (#1200)', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    const parity = new Set(MATHJS_PARITY_NAMES);
    const own = Object.keys(math);
    for (const key of own) expect(parity.has(key)).toBe(true);
    const surfaced: string[] = [];
    for (const key in math) if (parity.has(key)) surfaced.push(key);
    expect([...own].sort()).toEqual(surfaced.sort());
    for (const key in math) void math[key];
    expect(Object.keys(math)).toEqual(own);
  });

  it('members are enumerable and remain assignable, own and inherited', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    expect(Object.prototype.propertyIsEnumerable.call(math, 'add')).toBe(true);
    const custom = () => 'custom';
    math.add = custom;
    expect(math.add).toBe(custom);
    // assignment before first read of another member must not disturb it
    expect(typeof math.subtract).toBe('function');
    expect(Object.hasOwn(math, 'integrate')).toBe(false);
    math.integrate = custom;
    expect(math.integrate).toBe(custom);
    expect(Object.hasOwn(math, 'integrate')).toBe(false);
  });

  it('spread of an instance copies the own keys only: the mathjs-parity names', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    const spread = Object.keys({ ...math });
    const parity = new Set(MATHJS_PARITY_NAMES);
    expect(spread.length).toBeGreaterThan(300);
    for (const key of spread) expect(parity.has(key)).toBe(true);
    expect(spread).not.toContain('integrate');
  });

  it('chain and evaluate reach an inherited name', () => {
    const math = create(all) as unknown as Record<string, unknown> & {
      chain: (v: unknown) => Record<string, () => { done: () => unknown }>;
      evaluate: (expr: string) => unknown;
    };
    expect(Object.hasOwn(math, 'besselJ0')).toBe(false);
    expect(math.evaluate('besselJ0(0)')).toBe(1);
    expect(math.chain(0).besselJ0().done()).toBe(1);
  });
});

describe('compat create(m) and import with inherited names (#1200)', () => {
  it('create(m) of an instance keeps every name', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    const copy = create(math as never) as unknown as Record<string, unknown>;
    for (const key in math) expect(key in copy).toBe(true);
    expect(typeof copy.integrate).toBe('function');
  });

  // A factory import is lazy (as in mathjs): the "already exists" error comes on the
  // first read of the name. An inherited name must behave as an own name ('sin') does.
  type Importing = Record<string, unknown> & {
    import: (fns: unknown, opts?: { override?: boolean }) => void;
  };
  const factoryFor = (name: string) =>
    Object.assign(() => () => 'imported', {
      fn: name,
      dependencies: [] as string[],
      isFactory: true,
    });

  for (const name of ['sin', 'integrate']) {
    it(`a factory import of ${name} without override throws "already exists"`, () => {
      const math = create(all) as unknown as Importing;
      expect(Object.hasOwn(math, name)).toBe(name === 'sin');
      expect(() => {
        math.import([factoryFor(name)]);
        void math[name];
      }).toThrow(new RegExp(`Cannot import "${name}": already exists`));
    });

    it(`a factory import of ${name} with override replaces it`, () => {
      const math = create(all) as unknown as Importing;
      math.import([factoryFor(name)], { override: true });
      expect((math[name] as () => unknown)()).toBe('imported');
    });
  }
});
