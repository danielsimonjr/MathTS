import { describe, it, expect, vi } from 'vitest';
import { create, all } from '../src/index.js';

/**
 * #1222: mathjs 15.2.0 throws for every `math.import(otherInstance)` call, with
 * accidental messages that change with the instance content. compat throws one
 * deliberate TypeError instead. Plain objects, arrays and factories still import.
 */
type Rec = Record<string, unknown> & Record<'triple1222' | 'quadruple1222', (x: number) => number>;
const MSG = /import of a math instance is not supported/;

describe('compat import(instance) (#1222)', () => {
  it('throws one TypeError for a full instance', () => {
    const m1 = create(all);
    expect(() => create({}).import(m1)).toThrow(TypeError);
    expect(() => create({}).import(m1)).toThrow(MSG);
    expect(() => create(all).import(m1)).toThrow(MSG);
  });

  it('throws the same error with override and silent', () => {
    const m1 = create(all);
    expect(() => create(all).import(m1, { override: true })).toThrow(MSG);
    expect(() => create(all).import(m1, { silent: true })).toThrow(MSG);
  });

  it('throws for a partial instance and for an instance inside an array or object', () => {
    const p = create({});
    expect(() => create(all).import(p)).toThrow(MSG);
    expect(() => create(all).import([p])).toThrow(MSG);
    expect(() => create(all).import({ inner: p })).toThrow(MSG);
  });

  it('leaves the target unchanged after the throw', () => {
    const m2 = create({});
    const before = Object.keys(m2);
    expect(() => m2.import(create(all))).toThrow(MSG);
    expect(() => m2.import({ inner: create(all) }, { override: true })).toThrow(MSG);
    expect(Object.keys(m2)).toEqual(before);
  });

  it('still imports a plain object, an array and a function', () => {
    const m = create(all);
    m.import({ triple1222: (x: number) => 3 * x });
    expect((m as unknown as Rec).triple1222(2)).toBe(6);
    m.import([{ quadruple1222: (x: number) => 4 * x }]);
    expect((m as unknown as Rec).quadruple1222(2)).toBe(8);
    m.import({ k: 5 });
    expect((m as unknown as Rec).k).toBe(5);
  });

  it('an array of primitives throws the mathjs message (mathjs 15.2.0 parity)', () => {
    const m = create(all);
    expect(() => m.import({ T: [1, 2, 3] })).toThrow('Factory, Object, or Array expected');
    expect(() => m.import({ T: ['a'] })).toThrow('Factory, Object, or Array expected');
    expect(() => m.import({ T: [1, 2] }, { silent: true })).not.toThrow();
    expect((m as unknown as Rec).T).toBeUndefined();
  });

  it('throws for an instance of another module copy (#1033 two-bundle case)', async () => {
    vi.resetModules();
    const copyB = (await import('../src/index.js')) as typeof import('../src/index.js');
    expect(copyB.create).not.toBe(create);
    expect(() => copyB.create(all).import(create(all))).toThrow(MSG);
    expect(() => copyB.create(copyB.all).import({ inner: create({}) })).toThrow(MSG);
    expect(() => create(all).import([copyB.create({})])).toThrow(MSG);
  });

  it('runs no user getter in the instance check', () => {
    let reads = 0;
    const nested = {};
    Object.defineProperty(nested, 'x', {
      enumerable: true,
      get() {
        reads += 1;
        return create({});
      },
    });
    let mainReads = 0;
    const control = {};
    Object.defineProperty(control, 'x', {
      enumerable: true,
      get() {
        mainReads += 1;
        return 1;
      },
    });
    try {
      create(all).import({ control }, { silent: true });
    } catch {
      /* the import result is not under test */
    }
    try {
      create(all).import({ nested }, { silent: true });
    } catch {
      /* the import result is not under test */
    }
    expect(mainReads).toBe(1);
    expect(reads).toBe(mainReads);
  });

  it('keeps the brand out of the enumerable surface', () => {
    const brand = Symbol.for('mathts.compat.instance');
    for (const m of [create(all), create({})]) {
      const names: PropertyKey[] = [];
      for (const key in m) names.push(key);
      expect(names).not.toContain(brand);
      expect(Reflect.ownKeys({ ...m })).not.toContain(brand);
      expect(Object.getOwnPropertySymbols(Object.assign({}, m))).toEqual([]);
      const holder = Object.getOwnPropertySymbols(m).includes(brand) ? m : Object.getPrototypeOf(m);
      expect(Object.getOwnPropertyDescriptor(holder, brand)).toEqual({
        value: true,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    }
    expect(Object.getOwnPropertySymbols(create(all))).toEqual([]);
    expect(Object.getOwnPropertySymbols(Object.prototype)).not.toContain(brand);
    expect(
      JSON.stringify(create({}), (_k, v: unknown) => (typeof v === 'function' ? undefined : v))
    ).not.toContain('mathts.compat.instance');
  });

  it('does not take a parser, a chain, a frozen or a cyclic object for an instance', () => {
    const m = create(all);
    const notInstance = (fn: () => void): void => {
      try {
        fn();
      } catch (error) {
        expect((error as Error).message).not.toMatch(MSG);
      }
    };
    notInstance(() => m.import(m.parser()));
    notInstance(() => m.import({ p: m.parser() }, { silent: true }));
    notInstance(() => m.import(m.chain(1)));
    notInstance(() => m.import({ c: m.chain(1) }, { silent: true }));
    m.import(Object.freeze({ frozen1222: (x: number) => x + 1 }));
    expect((m as unknown as Record<string, (x: number) => number>).frozen1222(1)).toBe(2);
    expect(() => m.import(Object.freeze(create({})))).toThrow(MSG);
    // The check stops at an object that it has seen; the importer of mathjs does not.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    notInstance(() => m.import(cyclic, { silent: true }));
    expect(() => m.import({ cyclic, inst: create({}) })).toThrow(MSG);
  });

  it('runs no get trap of a Proxy in the check, and a revoked Proxy throws a TypeError', () => {
    const traps: string[] = [];
    const handler = new Proxy(
      {},
      {
        get(_target, trap) {
          traps.push(String(trap));
          return undefined;
        },
      }
    );
    const proxied = new Proxy({ inst: create({}) }, handler);
    expect(() => create(all).import(proxied)).toThrow(MSG);
    expect(traps).not.toContain('get');
    expect(() => create(all).import(new Proxy(create(all), {}))).toThrow(MSG);
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(() => create(all).import(proxy)).toThrow(TypeError);
    expect(() => create(all).import([proxy], { silent: true })).toThrow(TypeError);
  });
});
