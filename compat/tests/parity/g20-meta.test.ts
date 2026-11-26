import { describe, it, expect } from 'vitest';
import * as mathjsNamespace from 'mathjs';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll, docs } from '../../src/index.js';

/* G20 (#1575): meta-API differential tests for `all`, `chain`, `create`, `docs`,
 * `emit`, `expression`, `factory`, `off`, `on`, `once`, `replacer`, `reviver`,
 * each compared against a live mathjs 15.3.0 oracle instance built the same way.
 *
 * Known, documented divergence (not asserted here): the compat config object
 * carries two compat-only fields (`deterministic`, `epsilon`) — see
 * g01-expression-policy.test.ts. The `config` event payload is compared through
 * the field the issue names, `number`. */

type EventRecord = { event: string; args: unknown[] };

type Listener = (...args: unknown[]) => void;

interface EventBus {
  on(event: string, cb: Listener): void;
  once(event: string, cb: Listener): void;
  off(event: string, cb: Listener): void;
  emit(event: string, ...args: unknown[]): void;
}

type MetaInstance = EventBus & {
  config(options?: Record<string, unknown>): Record<string, unknown>;
  evaluate(expression: string): unknown;
  chain(value: number): { add(n: number): { done(): number } };
  factory(
    name: string,
    dependencies: string[],
    create: (scope: Record<string, unknown>) => unknown
  ): unknown;
  expression: { transform: unknown; mathWithTransform: unknown };
  replacer: (this: unknown, key: string, value: unknown) => unknown;
  reviver: (this: unknown, key: string, value: unknown) => unknown;
  typeOf(value: unknown): string;
  format(value: unknown, options: { precision: number }): string;
  import(objects: Record<string, unknown>, options?: { override?: boolean }): void;
  complex(r: number, i: number): unknown;
  fraction(n: number, d: number): unknown;
  unit(s: string): unknown;
  matrix(v: number[][], t: string): unknown;
  bignumber(v: number): unknown;
};

function oracle(): MetaInstance {
  return create(all, {}) as unknown as MetaInstance;
}

function compat(): MetaInstance {
  return createCompat(compatAll, {}) as unknown as MetaInstance;
}

function bigNumberOracle(): MetaInstance {
  return create(all, { number: 'BigNumber' }) as unknown as MetaInstance;
}

function bigNumberCompat(): MetaInstance {
  return createCompat(compatAll, { number: 'BigNumber' }) as unknown as MetaInstance;
}

/** Collects every event the instance emits while `run` executes. */
function recordedEvents(
  instance: MetaInstance,
  events: string[],
  run: (inst: MetaInstance) => void
): EventRecord[] {
  const records: EventRecord[] = [];
  const listeners: Listener[] = [];
  for (const event of events) {
    const listener: Listener = (...args: unknown[]) => {
      records.push({ event, args });
    };
    listeners.push(listener);
    instance.on(event, listener);
  }
  run(instance);
  for (let i = 0; i < events.length; i += 1) {
    instance.off(events[i], listeners[i]);
  }
  return records;
}

describe('G20 meta-API differential parity (#1575)', () => {
  it('all: the meta-API members exist with the same typeof on both instances', () => {
    const m = oracle() as unknown as Record<string, unknown>;
    const c = compat() as unknown as Record<string, unknown>;
    const names = [
      'evaluate',
      'chain',
      'factory',
      'on',
      'off',
      'once',
      'emit',
      'replacer',
      'reviver',
      'expression',
      'config',
      'import',
    ] as const;
    for (const name of names) {
      expect(typeof c[name], `all.${name}`).toBe(typeof m[name]);
    }
  });

  it('create(all, { number: "BigNumber" }): evaluate("1 + 2") is a BigNumber on both', () => {
    const m = bigNumberOracle();
    const c = bigNumberCompat();
    const mv = m.evaluate('1 + 2');
    const cv = c.evaluate('1 + 2');
    expect(m.typeOf(mv)).toBe('BigNumber');
    expect(c.typeOf(cv)).toBe('BigNumber');
    expect(m.format(cv, { precision: 14 })).toBe(m.format(mv, { precision: 14 }));
  });

  it('chain(2).add(3).done() is 5 on both', () => {
    const m = oracle();
    const c = compat();
    expect(c.chain(2).add(3).done()).toBe(5);
    expect(m.chain(2).add(3).done()).toBe(5);
  });

  it('docs: the named export key set matches the mathjs 15.3.0 oracle', () => {
    const oracleDocs = mathjsNamespace as unknown as { docs: Record<string, unknown> };
    expect(Object.keys(docs).sort()).toEqual(Object.keys(oracleDocs.docs).sort());
  });

  it('emit: a custom event reaches the listener with its payload on both', () => {
    const m = oracle();
    const c = compat();
    for (const inst of [m, c]) {
      const received: unknown[] = [];
      const listener: Listener = (...args: unknown[]) => {
        received.push(...args);
      };
      inst.on('g20-custom', listener);
      inst.emit('g20-custom', 42, 'tag');
      expect(received).toEqual([42, 'tag']);
      inst.off('g20-custom', listener);
      inst.emit('g20-custom', 'after-off');
      expect(received).toEqual([42, 'tag']);
    }
  });

  it('expression: transform and mathWithTransform are objects on both', () => {
    const m = oracle();
    const c = compat();
    expect(typeof c.expression).toBe(typeof m.expression);
    expect(typeof c.expression.transform).toBe(typeof m.expression.transform);
    expect(c.expression.transform).toBeTypeOf('object');
    expect(c.expression.mathWithTransform).toBeTypeOf('object');
    expect(typeof m.expression.mathWithTransform).toBe('object');
  });

  it('factory: a tiny typed function produces a function on both', () => {
    const m = oracle();
    const c = compat();
    const mf = m.factory('g20DoubleM', ['number'], () => (x: number) => x * 2);
    const cf = c.factory('g20DoubleC', ['number'], () => (x: number) => x * 2);
    expect(typeof cf).toBe('function');
    expect(typeof mf).toBe('function');
  });

  it('off: after off, the config listener no longer fires on either', () => {
    const m = oracle();
    const c = compat();
    for (const inst of [m, c]) {
      let calls = 0;
      const listener: Listener = () => {
        calls += 1;
      };
      inst.on('config', listener);
      inst.config({});
      expect(calls).toBe(1);
      inst.off('config', listener);
      inst.config({});
      expect(calls).toBe(1);
    }
  });

  it('on("config"): the payload reports the changed number field on both', () => {
    const eventsM = recordedEvents(oracle(), ['config'], (inst) => {
      inst.config({ number: 'Fraction' });
    });
    const eventsC = recordedEvents(compat(), ['config'], (inst) => {
      inst.config({ number: 'Fraction' });
    });
    expect(eventsC.length).toBe(eventsM.length);
    const numberField = (record: EventRecord): unknown =>
      (record.args[0] as Record<string, unknown>).number;
    expect(eventsC.map(numberField)).toEqual(eventsM.map(numberField));
    expect(eventsC.map(numberField)).toContain('Fraction');
  });

  it('once: a once listener fires exactly one time on both', () => {
    const m = oracle();
    const c = compat();
    for (const inst of [m, c]) {
      let calls = 0;
      inst.once('config', () => {
        calls += 1;
      });
      inst.config({});
      inst.config({});
      inst.config({});
      expect(calls).toBe(1);
    }
  });

  it('import: the import event payload includes the imported name on both', () => {
    const eventsM = recordedEvents(oracle(), ['import'], (inst) => {
      inst.import({ g20ImportProbe: 1 }, { override: true });
    });
    const eventsC = recordedEvents(compat(), ['import'], (inst) => {
      inst.import({ g20ImportProbe: 1 }, { override: true });
    });
    expect(eventsC.length).toBe(eventsM.length);
    const firstArg = (record: EventRecord): unknown => record.args[0];
    expect(eventsC.map(firstArg)).toEqual(eventsM.map(firstArg));
    expect(eventsC.map(firstArg)).toContain('g20ImportProbe');
  });

  it('replacer: stringify matches mathjs for all seven types', () => {
    const m = oracle();
    const c = compat();
    const mBig = bigNumberOracle();
    const cBig = bigNumberCompat();
    const rows: Array<[string, string, string]> = [
      ['number', JSON.stringify(1.5, m.replacer), JSON.stringify(1.5, c.replacer)],
      [
        'Complex',
        JSON.stringify(m.complex(3, 4), m.replacer),
        JSON.stringify(c.complex(3, 4), c.replacer),
      ],
      [
        'Fraction',
        JSON.stringify(m.fraction(3, 4), m.replacer),
        JSON.stringify(c.fraction(3, 4), c.replacer),
      ],
      [
        'BigNumber',
        JSON.stringify(mBig.bignumber(2.5), m.replacer),
        JSON.stringify(cBig.bignumber(2.5), c.replacer),
      ],
      [
        'Unit',
        JSON.stringify(m.unit('5 cm'), m.replacer),
        JSON.stringify(c.unit('5 cm'), c.replacer),
      ],
      [
        'DenseMatrix',
        JSON.stringify(
          m.matrix(
            [
              [1, 2],
              [3, 4],
            ],
            'dense'
          ),
          m.replacer
        ),
        JSON.stringify(
          c.matrix(
            [
              [1, 2],
              [3, 4],
            ],
            'dense'
          ),
          c.replacer
        ),
      ],
      [
        'SparseMatrix',
        JSON.stringify(
          m.matrix(
            [
              [1, 2],
              [3, 4],
            ],
            'sparse'
          ),
          m.replacer
        ),
        JSON.stringify(
          c.matrix(
            [
              [1, 2],
              [3, 4],
            ],
            'sparse'
          ),
          c.replacer
        ),
      ],
    ];
    for (const [name, expected, actual] of rows) {
      expect(actual, name).toBe(expected);
    }
  });

  it('reviver: the parse side of the round trip restores type and format on both', () => {
    const m = oracle();
    const c = compat();
    const mBig = bigNumberOracle();
    const cBig = bigNumberCompat();
    const cases: Array<[string, unknown, unknown]> = [
      ['number', 1.5, 1.5],
      ['Complex', m.complex(3, 4), c.complex(3, 4)],
      ['Fraction', m.fraction(3, 4), c.fraction(3, 4)],
      ['BigNumber', mBig.bignumber(2.5), cBig.bignumber(2.5)],
      ['Unit', m.unit('5 cm'), c.unit('5 cm')],
      [
        'DenseMatrix',
        m.matrix(
          [
            [1, 2],
            [3, 4],
          ],
          'dense'
        ),
        c.matrix(
          [
            [1, 2],
            [3, 4],
          ],
          'dense'
        ),
      ],
      [
        'SparseMatrix',
        m.matrix(
          [
            [1, 2],
            [3, 4],
          ],
          'sparse'
        ),
        c.matrix(
          [
            [1, 2],
            [3, 4],
          ],
          'sparse'
        ),
      ],
    ];
    for (const [name, mv, cv] of cases) {
      const parsedM = JSON.parse(JSON.stringify(mv, m.replacer), m.reviver);
      const parsedC = JSON.parse(JSON.stringify(cv, c.replacer), c.reviver);
      expect(c.typeOf(parsedC), `${name} typeOf`).toBe(m.typeOf(parsedM));
      expect(c.format(parsedC, { precision: 14 }), `${name} format`).toBe(
        m.format(parsedM, { precision: 14 })
      );
    }
  });
});
