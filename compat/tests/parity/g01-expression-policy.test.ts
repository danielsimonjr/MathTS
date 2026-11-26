import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';
import { expectSame } from './differential.js';

/**
 * G01 — compat expression policy (#1549, #1562, #1556, #1580).
 *
 * The compat `create(all)` evaluator follows mathjs: assignment, function
 * definitions, in-expression `simplify` / `derivative` / `parse` / `evaluate` /
 * `compile` / `parser` / `help` / `config`, node methods and `ResultSet` block
 * results. The typed API keeps its safe default; compat opts back in with
 * `{ safe: true }`.
 */

type AnyFn = (...args: unknown[]) => unknown;
type EvaluateFn = (expr: string, scope?: unknown, options?: unknown) => unknown;

const asEvaluate = (value: unknown): EvaluateFn => value as EvaluateFn;
const asFn = (value: unknown): AnyFn => value as AnyFn;

describe('G01 compat expression policy (#1549)', () => {
  it('parser: x = 3; x + 1', () => {
    expectSame('parser: x = 3; x + 1', {}, (L) => {
      const p = asFn(L.parser)() as { evaluate(expr: string): unknown };
      p.evaluate('x = 3');
      return p.evaluate('x + 1');
    });
  });

  it("evaluate('a = 2')", () => {
    expectSame("evaluate('a = 2')", {}, (L) => asEvaluate(L.evaluate)('a = 2'));
  });

  it("evaluate('f(x) = x^2; f(3)')", () => {
    expectSame("evaluate('f(x) = x^2; f(3)')", {}, (L) =>
      asEvaluate(L.evaluate)('f(x) = x^2; f(3)')
    );
  });

  it("compile('a = 2').evaluate({})", () => {
    expectSame("compile('a = 2').evaluate({})", {}, (L) =>
      (asFn(L.compile)('a = 2') as { evaluate(scope: unknown): unknown }).evaluate({})
    );
  });

  it('evaluate(\'simplify("2x + x")\')', () => {
    expectSame('evaluate(\'simplify("2x + x")\')', {}, (L) =>
      asEvaluate(L.evaluate)('simplify("2x + x")')
    );
  });

  it('evaluate(\'derivative("x^2", "x")\')', () => {
    expectSame('evaluate(\'derivative("x^2", "x")\')', {}, (L) =>
      asEvaluate(L.evaluate)('derivative("x^2", "x")')
    );
  });

  it('evaluate(\'evaluate("2 + 3")\')', () => {
    expectSame('evaluate(\'evaluate("2 + 3")\')', {}, (L) =>
      asEvaluate(L.evaluate)('evaluate("2 + 3")')
    );
  });

  it("evaluate('help(sqrt)')", () => {
    expectSame("evaluate('help(sqrt)')", {}, (L) => asEvaluate(L.evaluate)('help(sqrt)'));
  });

  it('node1 = parse("2 + 3"); node1.evaluate()', () => {
    expectSame('node1 = parse("2 + 3"); node1.evaluate()', {}, (L) => {
      const scope: Record<string, unknown> = {};
      asEvaluate(L.evaluate)('node1 = parse("2 + 3")', scope);
      return asEvaluate(L.evaluate)('node1.evaluate()', scope);
    });
  });

  it('compile of a function definition evaluates through the compiled expression', () => {
    expectSame("compile('f(x) = x^2; f(3)').evaluate({})", {}, (L) =>
      (asFn(L.compile)('f(x) = x^2; f(3)') as { evaluate(scope: unknown): unknown }).evaluate({})
    );
  });
});

describe('G01 config() inside an expression (#1562)', () => {
  /** The config fields mathjs 15.3.0 returns; compat carries two extra compat-only
   * fields (`deterministic`, `epsilon`) on its config object, which #1562 does not ask
   * to change — the issue is that `config` was bound as an object, not a function. */
  const CONFIG_FIELDS = [
    'relTol',
    'absTol',
    'matrix',
    'number',
    'numberFallback',
    'precision',
    'predictable',
    'randomSeed',
    'legacySubset',
  ] as const;

  it("evaluate('config()') is callable and returns the mathjs config fields", () => {
    expectSame("evaluate('config()') fields", {}, (L) => {
      const config = asEvaluate(L.evaluate)('config()') as Record<string, unknown>;
      return Object.fromEntries(CONFIG_FIELDS.map((k) => [k, config[k]]));
    });
  });

  it('config({number: "Fraction"}) updates that instance only', () => {
    const compat = createCompat(compatAll, {});
    const config = asFn(compat.config) as (o?: unknown) => Record<string, unknown>;
    expect(config().number).toBe('number');
    const returned = asEvaluate(compat.evaluate)('config({number: "Fraction"})') as Record<
      string,
      unknown
    >;
    expect(returned.number).toBe('Fraction');
    expect(config().number).toBe('Fraction');
    // A second instance is unchanged.
    const second = createCompat(compatAll, {});
    expect((asFn(second.config) as (o?: unknown) => Record<string, unknown>)().number).toBe(
      'number'
    );
    // Restore so later suites are unaffected (module instance is shared).
    config({ number: 'number' });
  });
});

describe('G01 ResultSet block results (#1556)', () => {
  const mathjs = create(all, {});
  const compat = createCompat(compatAll, {});

  const entriesOf = (value: unknown): unknown[] =>
    (value as { constructor: { prototype: { isResultSet: boolean } }; entries: unknown[] })
      .constructor.prototype.isResultSet === true
      ? (value as { entries: unknown[] }).entries
      : ((): never => {
          throw new Error('not a ResultSet');
        })();

  it("evaluate('1; 2') is a ResultSet with entries [2] on both libraries", () => {
    for (const lib of [mathjs, compat]) {
      const result = asEvaluate(lib.evaluate)('1; 2');
      expect(entriesOf(result)).toEqual([2]);
    }
  });

  it("evaluate('1\\n2') is a ResultSet with entries [1, 2] on both libraries", () => {
    for (const lib of [mathjs, compat]) {
      const result = asEvaluate(lib.evaluate)('1\n2');
      expect(entriesOf(result)).toEqual([1, 2]);
    }
  });

  it("parse('1; 2').evaluate() is a ResultSet", () => {
    for (const lib of [mathjs, compat]) {
      const node = asFn(lib.parse)('1; 2') as { evaluate(): unknown };
      expect(entriesOf(node.evaluate())).toEqual([2]);
    }
  });

  it('the ResultSet matches the oracle entry for entry', () => {
    expectSame("show(evaluate('1\\n2'))", {}, (L) => asEvaluate(L.evaluate)('1\n2'));
  });
});

describe('G01 function names (#1580)', () => {
  it("evaluate('isOdd(x) = x % 2').name is isOdd", () => {
    expectSame("evaluate('isOdd(x) = x % 2')", {}, (L) =>
      asEvaluate(L.evaluate)('isOdd(x) = x % 2')
    );
  });
});

describe('G01 opt-in hardening', () => {
  const compat = createCompat(compatAll, {});

  it('{ safe: true } still rejects assignment with the Security error', () => {
    expect(() => asEvaluate(compat.evaluate)('a = 2', {}, { safe: true })).toThrow(
      /Security: assignment expressions are disabled/
    );
  });

  it('safe and unsafe together throw TypeError before parse', () => {
    expect(() => asEvaluate(compat.evaluate)('2 + 3', {}, { safe: true, unsafe: true })).toThrow(
      TypeError
    );
  });
});
