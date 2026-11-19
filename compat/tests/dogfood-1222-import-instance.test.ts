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
    expect(() => m2.import(create(all))).toThrow(MSG);
    const before = Object.keys(m2).length;
    expect(() => m2.import(create(all))).toThrow(MSG);
    expect(Object.keys(m2).length).toBe(before);
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
    expect(reads).toBe(mainReads);
  });
});
