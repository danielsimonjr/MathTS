import { describe, it, expect } from 'vitest';
import * as mathjsNamespace from 'mathjs';
import { create as createMathjs, all as mathjsAll } from 'mathjs';
import {
  create as createCompat,
  all as compatAll,
  Chain as CompatChain,
  docs as compatDocs,
} from '../../src/index.js';

/* The mathjs package exposes `docs` and `Chain` at runtime but its bundled
 * typings omit them; read them through a narrow cast (the same pattern
 * `g20-meta.test.ts` uses for `docs`). */
const mathjsDocs = (mathjsNamespace as unknown as { docs: Record<string, unknown> }).docs;
const MathjsChain = (mathjsNamespace as unknown as { Chain: unknown }).Chain;

/* G20 CHALLENGER (#1575): adversarial differential tests for the compat meta-API.
 *
 * Policy under test (Daniel's): `mathts-compat` copies mathjs 15.3.0 EXACTLY —
 * quirks included — as a thin wrapper, and never changes a critical library to
 * match mathjs. This file only reads compat's source boundary; it never touches
 * `typed-function`, `core`, `matrix`, `functions`, `parallel`, `gpu` or `workpool`.
 *
 * Oracle: the `mathjs` devDependency (15.3.0). Every assertion below states the
 * mathjs 15.3.0 value, so a compat divergence fails with both sides printed.
 *
 * The first block ("verified clean") pins the areas the challenger probed and
 * found already at parity — they must stay green. The second block ("defects")
 * pins every divergence found; each of those `it`s FAILS on the current branch
 * and documents the fix the group owes. Severity is in the test title.
 */

interface ChainLike {
  done(): unknown;
  valueOf(): unknown;
  toString(): string;
  type?: unknown;
  value?: unknown;
  toJSON?: unknown;
  isNumber?(): unknown;
}

interface MathLike {
  chain(value?: unknown): ChainLike;
  create(...args: unknown[]): MathLike;
  config(options?: Record<string, unknown>): Record<string, unknown>;
  factory(
    name: string,
    dependencies: string[],
    creator: (deps: Record<string, unknown>) => unknown
  ): unknown;
  import(objects: unknown, options?: unknown): unknown;
  reviver(key: string, value: unknown): unknown;
  replacer(key: string, value: unknown): unknown;
  typeOf(value: unknown): string;
  format(value: unknown, options?: Record<string, unknown>): string;
  fraction(n: unknown, d?: unknown): unknown;
  bignumber(n: unknown): unknown;
  complex(r: number, i: number): unknown;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener: (...args: unknown[]) => void): unknown;
  once(event: string, listener: (...args: unknown[]) => void): unknown;
  emit(event: string, ...args: unknown[]): unknown;
  [key: string]: unknown;
}

function mathjs(config: Record<string, unknown> = {}): MathLike {
  return createMathjs(mathjsAll, config) as unknown as MathLike;
}

function compat(config: Record<string, unknown> = {}): MathLike {
  return createCompat(compatAll, config) as unknown as MathLike;
}

/** A discriminant that survives throwing on either side, so a diff prints both. */
function outcome(run: () => unknown): string {
  try {
    return 'ok:' + describeValue(run());
  } catch (error) {
    const name = (error as Error)?.constructor?.name ?? 'Error';
    return `throw:${name}`;
  }
}

/**
 * A discriminant for a `create(...)` result that never stringifies the whole
 * instance: it records whether the call threw and, when it did not, the shape
 * of the returned instance (does it expose `add`, and as what).
 */
function createOutcome(run: () => unknown): string {
  try {
    const made = run() as Record<string, unknown> | null;
    const shape = made === null ? 'null' : typeof made;
    const add = made === null ? undefined : typeof made.add;
    return `ok:${shape}:add=${add}`;
  } catch (error) {
    return `throw:${(error as Error)?.constructor?.name ?? 'Error'}`;
  }
}

function describeValue(value: unknown): string {
  if (typeof value === 'function') return 'function';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return typeof value + ':' + String(value);
}

const fromJSON = (Ctor: unknown): unknown => (Ctor as { fromJSON?: unknown }).fromJSON;

describe('G20 challenger: verified clean (must stay at parity)', () => {
  it('all: the module-level factory map has the same key set', () => {
    expect(Object.keys(compatAll).sort()).toEqual(Object.keys(mathjsAll).sort());
  });

  it('docs: the named export is deep-equal to mathjs docs', () => {
    expect(Object.keys(compatDocs).sort()).toEqual(Object.keys(mathjsDocs).sort());
    for (const key of Object.keys(mathjsDocs)) {
      expect(JSON.stringify(compatDocs[key as keyof typeof compatDocs])).toBe(
        JSON.stringify(mathjsDocs[key as keyof typeof mathjsDocs])
      );
    }
  });

  it('chain: arithmetic still unwraps to the same number', () => {
    expect(compat().chain(2).done()).toBe(mathjs().chain(2).done());
    expect(
      (compat() as unknown as { chain(v: number): { add(n: number): ChainLike } })
        .chain(2)
        .add(3)
        .done()
    ).toBe(
      (mathjs() as unknown as { chain(v: number): { add(n: number): ChainLike } })
        .chain(2)
        .add(3)
        .done()
    );
  });

  it('events: multiple listeners, off removes one, once removed by off, payload shapes', () => {
    const record = (inst: MathLike): unknown => {
      const log: string[] = [];
      const a = (...args: unknown[]): void => {
        log.push('a' + JSON.stringify(args));
      };
      const b = (...args: unknown[]): void => {
        log.push('b' + JSON.stringify(args));
      };
      inst.on('e', a);
      inst.on('e', b);
      inst.emit('e', 1);
      inst.off('e', a);
      inst.emit('e', 2);
      const offOnce = (): void => {
        log.push('once');
      };
      inst.once('e2', offOnce);
      inst.off('e2', offOnce);
      inst.emit('e2');
      log.length = 0;
      inst.emit('e', 9);
      const imported: unknown[] = [];
      const imports = (...args: unknown[]): void => {
        // The second argument is an import resolver whose identity is per-call;
        // compare its type, not its reference.
        imported.push(args.map((arg) => (typeof arg === 'function' ? 'function' : arg)));
      };
      inst.on('import', imports);
      inst.import({ g20EventProbe: 1 }, { override: true });
      inst.off('import', imports);
      const cfg: unknown[] = [];
      const onConfig = (...args: unknown[]): void => {
        cfg.push(args.length);
      };
      inst.on('config', onConfig);
      inst.config({ number: 'Fraction' });
      inst.off('config', onConfig);
      return { log, imported, cfg };
    };
    expect(record(compat())).toEqual(record(mathjs()));
  });

  it('create: two created instances do not share config', () => {
    const a = compat();
    const b = compat();
    a.config({ number: 'BigNumber' });
    expect(b.config().number).toBe('number');
  });

  it('create(all, { number: "BigNumber" }): evaluate("1 + 2") is a BigNumber', () => {
    const cm = compat({ number: 'BigNumber' });
    const mm = mathjs({ number: 'BigNumber' });
    const evalOne = (inst: MathLike): unknown => (inst.evaluate as (e: string) => unknown)('1 + 2');
    const cv = evalOne(cm);
    const mv = evalOne(mm);
    expect(cm.typeOf(cv)).toBe(mm.typeOf(mv));
    expect(cm.format(cv, { precision: 14 })).toBe(mm.format(mv, { precision: 14 }));
  });
});

describe('G20 challenger: defects found (each fails on the current branch)', () => {
  /* D1 (P1) — `chain` is a Proxy, not mathjs's Chain: it carries no `type`, no
   * `value`, no `toJSON`, and `Chain.fromJSON` is missing, so a Chain does not
   * JSON round-trip and `typeOf` of a revived Chain is 'Object', not 'Chain'.
   * Root cause: compat/src/chain.ts builds an ad-hoc proxy over CompatChain. */
  it('D1a (P1): chain.type is "Chain"', () => {
    expect(compat().chain(2).type).toBe(mathjs().chain(2).type);
    expect(mathjs().chain(2).type).toBe('Chain');
  });

  it('D1b (P1): chain.value exposes the wrapped value', () => {
    expect(compat().chain(2).value).toBe(mathjs().chain(2).value);
    expect(mathjs().chain(2).value).toBe(2);
  });

  it("D1c (P1): JSON.stringify(chain) is mathjs's Chain tag", () => {
    expect(JSON.stringify(compat().chain(2))).toBe(JSON.stringify(mathjs().chain(2)));
    expect(JSON.stringify(mathjs().chain(2))).toBe('{"mathjs":"Chain","value":2}');
  });

  it('D1d (P1): Chain.fromJSON exists and revives a Chain tag', () => {
    expect(typeof fromJSON(CompatChain)).toBe(typeof fromJSON(MathjsChain));
    expect(typeof fromJSON(MathjsChain)).toBe('function');
    const tag = '{"mathjs":"Chain","value":9}';
    const c = compat();
    const revived = c.reviver('', JSON.parse(tag)) as ChainLike;
    expect(c.typeOf(revived)).toBe(c.typeOf(c.chain(9)));
    expect(c.typeOf(revived)).toBe('Chain');
    expect(typeof revived.done).toBe('function');
    expect(revived.done()).toBe(9);
  });

  /* D2 (P2) — `chain().toString()` uses `String(value)`; mathjs uses
   * `format(value)`, so fractions, arrays, strings and low-precision BigNumbers
   * render differently. Root cause: compat/src/chain.ts `toString: () => String(value)`. */
  it('D2a (P2): chain(fraction).toString() is "1/3"', () => {
    const c = compat();
    const m = mathjs();
    expect(c.chain(c.fraction(1, 3)).toString()).toBe(m.chain(m.fraction(1, 3)).toString());
    expect(m.chain(m.fraction(1, 3)).toString()).toBe('1/3');
  });

  it('D2b (P2): chain(array).toString() is "[1, 2]"', () => {
    expect(compat().chain([1, 2]).toString()).toBe(mathjs().chain([1, 2]).toString());
    expect(mathjs().chain([1, 2]).toString()).toBe('[1, 2]');
  });

  it('D2c (P2): chain(string).toString() quotes the string', () => {
    expect(compat().chain('hi').toString()).toBe(mathjs().chain('hi').toString());
    expect(mathjs().chain('hi').toString()).toBe('"hi"');
  });

  it('D2d (P2): chain(bignumber).toString() honours instance precision', () => {
    const c = compat({ number: 'BigNumber', precision: 5 });
    const m = mathjs({ number: 'BigNumber', precision: 5 });
    expect(c.chain(c.bignumber('1.23456789')).toString()).toBe(
      m.chain(m.bignumber('1.23456789')).toString()
    );
    expect(m.chain(m.bignumber('1.23456789')).toString()).toBe('1.2346');
  });

  /* D2e (P2) — root cause of D2d: `format(bignumber)` ignores the instance's
   * configured precision when no explicit option is passed. */
  it('D2e (P2): format(bignumber) uses the instance precision by default', () => {
    const c = compat({ number: 'BigNumber', precision: 5 });
    const m = mathjs({ number: 'BigNumber', precision: 5 });
    expect(c.format(c.bignumber('1.23456789'))).toBe(m.format(m.bignumber('1.23456789')));
    expect(m.format(m.bignumber('1.23456789'))).toBe('1.2346');
  });

  /* D3 (P2) — an instance `create(x)` treats a non-config object as a factory
   * map; mathjs binds `create` to its factories, so its sole argument is always
   * config, and an unknown key lands in `config()`, not on the instance. */
  it('D3 (P2): instance create({a:5}) is config, not a factory map', () => {
    const c = compat();
    const m = mathjs();
    const cA = (c.create({ a: 5 }) as unknown as Record<string, unknown>).a;
    const mA = (m.create({ a: 5 }) as unknown as Record<string, unknown>).a;
    expect(cA).toBe(mA);
    expect(mA).toBeUndefined();
    expect(c.create({ a: 5 }).config().a).toBe(m.create({ a: 5 }).config().a);
    expect(m.create({ a: 5 }).config().a).toBe(5);
  });

  /* D4 (P2) — the module-level `create` accepts non-factory inputs (a plain
   * object of values/arrows, an array of plain functions) that mathjs rejects. */
  it('D4a (P2): create({ fn: () => 1 }) is rejected like mathjs', () => {
    expect(createOutcome(() => createCompat({ probe: () => 1 }, {}))).toBe(
      createOutcome(() => createMathjs({ probe: () => 1 } as unknown as typeof mathjsAll, {}))
    );
    expect(
      createOutcome(() => createMathjs({ probe: () => 1 } as unknown as typeof mathjsAll, {}))
    ).toBe('throw:TypeError');
  });

  it('D4b (P2): create([() => 1]) is rejected like mathjs', () => {
    expect(createOutcome(() => createCompat([() => 1], {}))).toBe(
      createOutcome(() => createMathjs([() => 1] as unknown as typeof mathjsAll, {}))
    );
    expect(createOutcome(() => createMathjs([() => 1] as unknown as typeof mathjsAll, {}))).toBe(
      'throw:TypeError'
    );
  });

  /* D5 (P2) — a factory with a missing dependency fails eagerly at `import` in
   * compat but lazily on first read in mathjs, so code that imports a bundle and
   * never touches the bad member works on mathjs and throws on compat. */
  it('D5 (P2): a missing factory dependency is lazy (import succeeds, read throws)', () => {
    const run = (inst: MathLike, name: string): string => {
      const factory = inst.factory(name, ['g20-missing-dependency'], () => 1);
      const imported = outcome(() => inst.import({ [name]: factory }, { override: true }));
      if (imported !== 'ok:undefined') return 'import-' + imported;
      return 'read-' + outcome(() => Reflect.get(inst, name));
    };
    expect(run(compat(), 'g20LazyC')).toBe(run(mathjs(), 'g20LazyM'));
    expect(run(mathjs(), 'g20LazyM2')).toMatch(/^read-throw/);
  });

  /* D6 (P2) — a truncated mathjs tag makes mathjs THROW; compat silently
   * manufactures a wrong value, which is worse than an exception because it
   * corrupts data without a signal. */
  it('D6a (P2): reviver throws on {"mathjs":"BigNumber"} like mathjs', () => {
    expect(outcome(() => compat().reviver('', JSON.parse('{"mathjs":"BigNumber"}')))).toBe(
      outcome(() => mathjs().reviver('', JSON.parse('{"mathjs":"BigNumber"}')))
    );
    expect(outcome(() => mathjs().reviver('', JSON.parse('{"mathjs":"BigNumber"}')))).toBe(
      'throw:Error'
    );
  });

  it('D6b (P2): reviver throws on {"mathjs":"Complex"} like mathjs', () => {
    expect(outcome(() => compat().reviver('', JSON.parse('{"mathjs":"Complex"}')))).toBe(
      outcome(() => mathjs().reviver('', JSON.parse('{"mathjs":"Complex"}')))
    );
    expect(outcome(() => mathjs().reviver('', JSON.parse('{"mathjs":"Complex"}')))).toBe(
      'throw:SyntaxError'
    );
  });

  /* D7 (P2) — bare `JSON.stringify(fraction)` emits numeric `n`/`d`; mathjs
   * emits strings. The compat replacer normalises them, so only a bare
   * stringify diverges — but that is the documented Fraction.toJSON payload and
   * it differs byte-for-byte from mathjs. NOTE: compat/tests/dogfood-g32b.test.ts
   * currently PINS the divergent numeric form (`{ n: 1, d: 3 }`), so that test
   * asserts a value mathjs 15.3.0 does not produce. */
  it('D7 (P2): bare JSON.stringify(fraction) carries string n/d', () => {
    expect(JSON.stringify(compat().fraction(1, 3))).toBe(JSON.stringify(mathjs().fraction(1, 3)));
    expect(JSON.stringify(mathjs().fraction(1, 3))).toBe('{"mathjs":"Fraction","n":"1","d":"3"}');
  });
});
