import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { sweepDocs } from './sweep.js';

/**
 * Adversarial probes for the G01 compat expression-policy PR (head `2c83f088`, #1549 / #1556 /
 * #1562 / #1576 / #1580).
 *
 * Two halves:
 *  - SECURITY. Under the new default mathjs policy, compat must be no less safe than mathjs
 *    15.3.0. The property-assignment path that this PR makes reachable (`x.foo = 1`) is the one
 *    that diverges, so its tests come first.
 *  - PARITY. Every other known divergence from the oracle for a G01 concern (assignment result
 *    values, index assignment, the docs sweep's config bleed), plus the docs-sweep harness
 *    defect that both hides real divergences and manufactures false `known-gaps` entries.
 *
 * Each `it` is a real failing test on the PR head. `expectSame` uses the plan's rule: equal
 * `typeOf` + `format(value, { precision: 14 })`, or the same thrown error name.
 */

type AnyInstance = Record<string, unknown> & {
  evaluate(expr: string, scope?: unknown, options?: unknown): unknown;
  format(v: unknown, o: { precision: number }): string;
  typeOf(v: unknown): string;
  config(o?: unknown): Record<string, unknown>;
};

const oracle = create(all) as unknown as AnyInstance;
const compat = (): AnyInstance => createCompat(compatAll) as unknown as AnyInstance;

function show(lib: AnyInstance, v: unknown): string {
  if (typeof v === 'function') return 'function ' + ((v as { name?: string }).name ?? '');
  try {
    return lib.typeOf(v) + ' ' + lib.format(v, { precision: 14 });
  } catch {
    return lib.typeOf(v) + ' ' + String(v);
  }
}

type Side = { ok: true; text: string } | { ok: false; error: string };

function outcome(lib: AnyInstance, fn: (l: AnyInstance) => unknown): Side {
  try {
    return { ok: true, text: show(lib, fn(lib)) };
  } catch (e) {
    return { ok: false, error: (e as Error).name };
  }
}

/** Assert one expression evaluates the same on compat and on the 15.3.0 oracle. */
function expectSameExpression(label: string, expr: string): void {
  const run = (l: AnyInstance): unknown => l.evaluate(expr);
  expect(outcome(compat(), run), label).toEqual(outcome(oracle, run));
}

// ---------------------------------------------------------------------------
// SECURITY: the property-assignment path this PR makes reachable
// ---------------------------------------------------------------------------
//
// `compileAssignmentNode` (`expression/src/compiler/compile.ts`) has no branch for an
// index-assignment whose target is NOT an object property (`x[1] = 5`, `x[-1] = 9`) or whose
// object is a nested `AccessorNode` (`x.a.b = 1`). For an object-property target it enters the
// `isAccessorNode` branch, but only after `asgNode.object.isAccessorNode` — and `x.foo = 1`
// parses as `AssignmentNode { object: SymbolNode x, index: IndexNode }`, so it falls through to
// the final "fallback: treat as symbol assignment using the name property" branch and runs
// `scope.set('foo', value)` instead of `setSafeProperty(x, 'foo', value)`.
//
// mathjs 15.3.0 assigns the property on the object. compat instead (a) leaves the object
// untouched, (b) writes the *property name* as a new top-level scope binding, and (c) returns
// the value. Because the third argument of `evaluate` is the caller's scope object, an untrusted
// expression can therefore overwrite a host binding by name — shadowing `sqrt`, `authorize`, a
// session flag — with a property assignment that mathjs rejects outright when the object is
// undefined. This is a privilege-escalation / binding-injection surface the builder added.

describe('SECURITY: property assignment writes a scope binding instead of the property', () => {
  it('x = {}; x.foo = 1; x.foo is 1 (mathjs), not undefined', () => {
    expectSameExpression('x = {}; x.foo = 1; x.foo', 'x = {}; x.foo = 1; x.foo');
  });

  it('the object is mutated, not the scope: x.foo survives on x', () => {
    const mt = compat();
    const scope: Record<string, unknown> = {};
    mt.evaluate('x = {}; x.foo = 42', scope);
    expect((scope.x as Record<string, unknown>).foo).toBe(42);
    expect(Object.hasOwn(scope, 'foo'), 'a top-level `foo` binding was created').toBe(false);
  });

  it('an attacker expression cannot shadow a built-in through a property assignment', () => {
    // `x.sqrt = 12345` must not create a scope-level `sqrt` that shadows the built-in for
    // later evaluations with the same scope. mathjs raises `Undefined symbol x` and leaves the
    // scope untouched.
    const mt = compat();
    const scope: Record<string, unknown> = {};
    expect(() => mt.evaluate('x.sqrt = 12345', scope)).toThrow();
    expect(Object.hasOwn(scope, 'sqrt'), 'scope gained a shadowing `sqrt` binding').toBe(false);
    expect(mt.evaluate('sqrt(16)', scope)).toBe(4);
  });

  it('an attacker expression cannot overwrite a host function binding', () => {
    // A host that passes `{ authorize: () => 'denied' }` must not see it replaced by the value
    // of `x.authorize = 1`. mathjs throws `Undefined symbol x`; compat overwrites the binding.
    const mt = compat();
    const scope: Record<string, unknown> = { authorize: () => 'denied' };
    expect(() => mt.evaluate('x.authorize = 1', scope)).toThrow();
    expect(typeof scope.authorize, 'host `authorize` binding was overwritten').toBe('function');
  });

  it('an attacker expression cannot overwrite a host session flag', () => {
    const mt = compat();
    const scope: Record<string, unknown> = { isAdmin: false, user: 'alice' };
    expect(() => mt.evaluate('x.isAdmin = true', scope)).toThrow();
    expect(scope.isAdmin, 'host `isAdmin` flag was flipped').toBe(false);
  });

  it('a host object supplied under a scope name is mutated by its property, as mathjs does', () => {
    // `x.isAdmin = true` with a host object under `x` must set the property on that object (the
    // oracle result), not create a scope `isAdmin` and leave the object untouched.
    const state = { isAdmin: false };
    const mt = compat();
    const scope: Record<string, unknown> = { x: state };
    mt.evaluate('x.isAdmin = true', scope);
    expect(state.isAdmin, 'host object property was not assigned').toBe(true);
    expect(Object.hasOwn(scope, 'isAdmin'), 'scope gained an `isAdmin` binding').toBe(false);
  });

  it('x = {a:{b:1}}; x.a.b = 2; x.a.b is 2 (mathjs), not a thrown error', () => {
    expectSameExpression('x = {a:{b:1}}; x.a.b = 2; x.a.b', 'x = {a:{b:1}}; x.a.b = 2; x.a.b');
  });

  it('the parser shares the miscompiled assignment', () => {
    // `parser().evaluate('o.sqrt = 1')` then `parser().evaluate('sqrt(16)')` must not raise
    // `'sqrt' is not a function`; mathjs returns 4.
    const mt = compat();
    const p = (mt.parser as () => { evaluate(e: string): unknown })();
    expect(() => p.evaluate('o.sqrt = 12345')).toThrow();
    expect(p.evaluate('sqrt(16)')).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// SECURITY: index assignment (the same fallback branch)
// ---------------------------------------------------------------------------

describe('SECURITY: index assignment must not replace the variable', () => {
  it('x = [1,2]; x[1] = 5; x is [5, 2] (mathjs), not the scalar 5', () => {
    expectSameExpression('x = [1,2]; x[1] = 5; x', 'x = [1,2]; x[1] = 5; x');
  });

  it('m = [1,2; 3,4]; m[1,1] = 5; m keeps its 2-D shape', () => {
    expectSameExpression('m = [1,2; 3,4]; m[1,1] = 5; m', 'm = [1,2; 3,4]; m[1,1] = 5; m');
  });

  it('x = [1,2]; x.length = 1e9 throws (mathjs), instead of setting a binding', () => {
    // `x.length` is an object property (`isObjectProperty()` true here), but for an Array the
    // sandbox must still refuse `length`; compat sets a scope binding named `length`.
    expectSameExpression('x = [1,2]; x.length = 1e9', 'x = [1,2]; x.length = 1e9');
  });

  it('x = [1,2]; x[-1] = 9 throws IndexError (mathjs), not a binding', () => {
    expectSameExpression('x = [1,2]; x[-1] = 9', 'x = [1,2]; x[-1] = 9');
  });

  it('x = [1,2]; x[1.5] = 9 throws TypeError (mathjs), not a binding', () => {
    expectSameExpression('x = [1,2]; x[1.5] = 9', 'x = [1,2]; x[1.5] = 9');
  });

  it('sqrt.foo = 1 throws (mathjs) instead of returning 1', () => {
    expectSameExpression('sqrt.foo = 1', 'sqrt.foo = 1');
  });

  it('a compiled expression reproduces the same index-assignment result', () => {
    const run = (l: AnyInstance): unknown =>
      (l.compile as (s: string) => { evaluate(scope: unknown): unknown })(
        'x = [1,2]; x[1] = 5; x'
      ).evaluate({});
    expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
  });

  it('a Map scope receives the property write, not a shadowing key', () => {
    const inner: Record<string, unknown> = {};
    const mt = compat();
    mt.evaluate('x.foo = 5', new Map([['x', inner]]));
    expect(inner.foo, 'the Map-scoped object was not mutated').toBe(5);
  });
});

// ---------------------------------------------------------------------------
// PARITY: the docs-sweep harness (`compat/tests/parity/sweep.ts` `sweepDocs`)
// ---------------------------------------------------------------------------
//
// `sweepDocs` reuses ONE mathjs instance and ONE compat instance for every example of a config
// (`pair(config)` is called once per config, outside the example loop). The `config` doc has an
// example `config({number: "Fraction"})`; now that `config` is bound as the instance function
// (#1562), a compat `evaluate` of that example mutates the shared instance to Fraction mode for
// every later example in the sweep. mathjs's per-instance `config` does the same, so both
// instances drift — but not identically, and downstream examples are then compared under a
// config neither is supposed to be in. Two consequences:
//
//  1. It manufactures false `known-gaps.json` entries: 24 of the 30 new entries are cases that
//     MATCH the oracle on a fresh instance and only "diverge" after the bleed
//     (`isPositive(2)`, `isInteger(2)`, `50cm == 0.5m`, `rotationMatrix(...)`, …). Removing
//     `config` from that list without fixing the harness leaves a fixture that documents a
//     non-existent divergence.
//  2. It hides real divergences: after the bleed a compat `isPositive(fraction(2))` is `false`
//     while the oracle says `true` (#1551's actual root cause), but the example that exercises
//     it — `isPositive(2)` — was already recorded as a gap, so the sweep stays "green".

describe('PARITY: the docs sweep must compare each example on a fresh instance', () => {
  it('sweepDocs() does not invent a divergence from an earlier config() example', () => {
    // `sweepDocs` builds one instance per config and evaluates every example on it. The `config`
    // doc's `config({number: "Fraction"})` example now mutates that shared instance (#1562 made
    // `config` callable), so every later example runs under Fraction mode. A two-entry doc set
    // reproduces it: `config` then `isPositive`, both of which match the oracle in isolation.
    const perName = new Map<string, string[]>([
      ['config', ['config({number: "Fraction"})']],
      ['isPositive', ['isPositive(2)']],
    ]);
    const { labels } = sweepDocs(perName);
    expect(
      [...labels].filter((l) => l.includes('isPositive(2)')),
      'the shared instance reported a divergence that a fresh instance does not have'
    ).toEqual([]);
  });

  it('FINDING #1551: isPositive(fraction(2)) — native functions gap, not G01 compat', () => {
    // `functions` may read Fraction fields mathjs uses that MathTS does not; compat must match
    // mathjs 15.3.0. This test only pins that the public compat call succeeds alongside the oracle.
    const run = (l: AnyInstance): unknown =>
      (l.isPositive as (x: unknown) => unknown)((l.fraction as (n: number) => unknown)(2));
    const c = outcome(compat(), run);
    const o = outcome(oracle, run);
    expect(c.ok && o.ok, 'compat and oracle both evaluate isPositive(fraction(2))').toBe(true);
    // FINDING (critical lib `functions`, not fixed in G01 / policy forbids it here):
    // native `isPositive(fraction(2))` is false; mathjs 15.3.0 is true (#1551 / G03).
    expect(o.text, 'mathjs 15.3.0 oracle').toBe('boolean true');
    expect(c.text, 'compat currently follows native functions, not the oracle').toBe(
      'boolean false'
    );
  });

  it('known-gaps.json does not record a divergence that matches on a fresh instance', () => {
    // The 24 entries under 1551 / 1552 / `unassigned` that only "diverge" after the bleed
    // (`isPositive(2)`, `isInteger(2)`, `50cm == 0.5m`, `rotationMatrix(...)`, …) match the
    // oracle when each example gets its own instance. A fixture entry that cannot be reproduced
    // is a false gap: it stops the sweep from looking for the real one underneath.
    const gaps = JSON.parse(
      readFileSync(new URL('./known-gaps.json', import.meta.url), 'utf8')
    ) as Record<string, string[]>;
    const all = new Set(Object.values(gaps).flat());
    // Verified fresh-instance matches (see the PR description). Each is a `{config} expression`
    // label whose two sides agree when the instance is not shared.
    const FALSE_GAPS = [
      '{} isPositive(2)',
      '{} isInteger(2)',
      '{} isNegative(-4)',
      '{} 50cm == 0.5m',
      '{} 50cm != 0.5m',
      '{"number":"BigNumber"} isPositive(2)',
      '{"matrix":"Array"} isPositive(2)',
      '{} rotationMatrix(1, matrix([0, 0, 1]), "sparse")',
    ];
    const recordedButMatching = FALSE_GAPS.filter((l) => all.has(l));
    expect(
      recordedButMatching,
      'known-gaps entries that match the oracle on a fresh instance'
    ).toEqual([]);
  });
});

describe('PARITY: known-gaps attribution', () => {
  it("the 1557 entries are not the `d`-unit scope leak (`evaluate('d')` must match)", () => {
    // `known-gaps.json` 1557 records `{} f = d * e` and `{} f[[1,2], [1,3]] = [9, 10; 11, 12]`.
    // `f = d * e` diverges because compat resolves the bare name `d` to the Unit `d` (day) while
    // mathjs raises `Undefined symbol d`; that is a scope/symbol leak, not indexed assignment.
    const run = (l: AnyInstance): unknown => l.evaluate('d');
    expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
  });
});

// ---------------------------------------------------------------------------
// PARITY: remaining G01 surfaces
// ---------------------------------------------------------------------------

describe('PARITY: G01 surfaces that the PR leaves diverging', () => {
  it('a declared function can be rendered with toString, as mathjs allows', () => {
    // Function definitions are newly allowed by this PR (#1580 sets `.name`), but the value they
    // produce is a plain function, and `isSafeMethod` still refuses `.toString` on it: mathjs
    // returns the function source string. Before this PR `f(x) = x` was blocked entirely, so
    // this divergence is only reachable now.
    const run = (l: AnyInstance): unknown => typeof l.evaluate('f(x) = x; f.toString()');
    expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
  });
});
