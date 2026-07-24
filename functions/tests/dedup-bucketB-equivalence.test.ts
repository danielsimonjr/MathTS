import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { assertEquivalent } from '../../core/tests/helpers/equivalence.js';

// The ORIGINAL (pre-redirect) local copies, imported directly by relative path so
// this test proves equivalence independent of how the shims end up wired.
import * as exprFactory from '../../expression/src/utils/factory.js';
import * as fnFactory from '../src/utils/factory.js';
import * as exprString from '../../expression/src/utils/string.js';
import * as fnString from '../src/utils/string.js';

import {
  factory as coreFactory,
  isFactory as coreIsFactory,
  assertDependencies as coreAssertDependencies,
  isOptionalDependency as coreIsOptionalDependency,
  stripOptionalNotation as coreStripOptionalNotation,
  sortFactories as coreSortFactories,
  formatGeneric as coreFormat,
  stringify as coreStringify,
  compareText as coreCompareText,
  escape as coreEscape,
} from '@danielsimonjr/mathts-core/internal';

/**
 * Bucket B, slice 1 — cross-package equivalence proof for `factory`/`string`
 * before redirecting `expression`/`functions`'s duplicate copies onto the
 * `@danielsimonjr/mathts-core/internal` canonical.
 *
 * Per Rule 4 ("never assume — verify with a second method") we do NOT assume the
 * copies are identical just because they look similar; every function is
 * proven equivalent (or shown to have DIVERGED) with `fast-check` before it is
 * redirected. See `core/tests/helpers/equivalence.ts` for the harness and
 * `CHANGELOG.md` / the commit message for the consolidation decision.
 *
 * NOTE: the `bignumber/formatter` section was retired once both packages' local
 * copies became thin re-export shims of core and were deleted — pinning a shim
 * against the core it re-exports is a museum piece. Core's formatter is now unit-
 * covered directly by `core/tests/bignumber-formatter.test.ts`.
 */

// ---------------------------------------------------------------------------
// factory.ts
// ---------------------------------------------------------------------------

const depName = fc.oneof(fc.constant(''), fc.stringMatching(/^\??[a-zA-Z][a-zA-Z0-9_]{0,6}$/));

describe('factory utils — isOptionalDependency / stripOptionalNotation', () => {
  it('agree across expression / functions / core', () => {
    assertEquivalent(
      'isOptionalDependency',
      [
        { name: 'expression', fn: exprFactory.isOptionalDependency },
        { name: 'functions', fn: fnFactory.isOptionalDependency },
        { name: 'core', fn: coreIsOptionalDependency },
      ],
      fc.tuple(depName)
    );

    assertEquivalent(
      'stripOptionalNotation',
      [
        { name: 'expression', fn: exprFactory.stripOptionalNotation },
        { name: 'functions', fn: fnFactory.stripOptionalNotation },
        { name: 'core', fn: coreStripOptionalNotation },
      ],
      fc.tuple(depName)
    );
  });
});

const isFactoryInputArb = fc.oneof(
  fc.integer(),
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.integer(), { maxLength: 4 }),
  fc.object(),
  fc
    .record({ fn: fc.string(), dependencies: fc.array(fc.string(), { maxLength: 4 }) })
    .map(({ fn, dependencies }) => {
      const f = (() => undefined) as unknown as { fn: string; dependencies: string[] };
      f.fn = fn;
      f.dependencies = dependencies;
      return f as unknown;
    }),
  fc.func(fc.integer())
);

describe('factory utils — isFactory', () => {
  it('agrees across expression / functions / core on arbitrary + factory-shaped values', () => {
    assertEquivalent(
      'isFactory',
      [
        { name: 'expression', fn: exprFactory.isFactory },
        { name: 'functions', fn: fnFactory.isFactory },
        { name: 'core', fn: coreIsFactory },
      ],
      fc.tuple(isFactoryInputArb),
      { checkMutation: false } // inputs include shared function/object references across impls
    );
  });
});

/** Builds (name, dependencies, scope) where `presence[i] ?? true` controls whether
 *  the i-th (stripped) dependency name is present in `scope`, so both the "all deps
 *  satisfied" and "some deps missing" branches of assertDependencies get exercised. */
const assertDepsArb: fc.Arbitrary<[string, string[], Record<string, unknown>]> = fc
  .tuple(
    fc.string({ maxLength: 8 }),
    fc.array(depName, { maxLength: 6 }),
    fc.array(fc.boolean(), { maxLength: 6 })
  )
  .map(([name, deps, presence]) => {
    const scope: Record<string, unknown> = {};
    deps.forEach((d, i) => {
      const stripped = d.startsWith('?') ? d.slice(1) : d;
      const present = presence[i] ?? true;
      if (stripped && present) scope[stripped] = i;
    });
    return [name, deps, scope];
  });

/** Normalizes a possibly-throwing call into a comparable, non-throwing value. */
function tryCall<Args extends unknown[], R>(fn: (...args: Args) => R) {
  return (...args: Args): { threw: boolean; message?: string; value?: R } => {
    try {
      return { threw: false, value: fn(...args) };
    } catch (e) {
      return { threw: true, message: (e as Error).message };
    }
  };
}

describe('factory utils — assertDependencies', () => {
  it('throws (or not) identically, with matching messages, across expression / functions / core', () => {
    assertEquivalent(
      'assertDependencies',
      [
        { name: 'expression', fn: tryCall(exprFactory.assertDependencies) },
        { name: 'functions', fn: tryCall(fnFactory.assertDependencies) },
        { name: 'core', fn: tryCall(coreAssertDependencies) },
      ],
      assertDepsArb
    );
  });
});

describe('factory() — creation, metadata, and dispatch', () => {
  it('agrees across expression / functions / core on the happy path AND the missing-dependency path', () => {
    assertEquivalent(
      'factory()',
      [
        {
          name: 'expression',
          fn: tryCall((n: string, deps: string[], scope: Record<string, unknown>) => {
            const f = exprFactory.factory(n, deps, (d: unknown) => JSON.stringify(d));
            return { fn: f.fn, dependencies: f.dependencies, result: f(scope) };
          }),
        },
        {
          name: 'functions',
          fn: tryCall((n: string, deps: string[], scope: Record<string, unknown>) => {
            const f = fnFactory.factory(n, deps, (d: unknown) => JSON.stringify(d));
            return { fn: f.fn, dependencies: f.dependencies, result: f(scope) };
          }),
        },
        {
          name: 'core',
          fn: tryCall((n: string, deps: string[], scope: Record<string, unknown>) => {
            const f = coreFactory(n, deps, (d: unknown) => JSON.stringify(d));
            return { fn: f.fn, dependencies: f.dependencies, result: f(scope) };
          }),
        },
      ],
      assertDepsArb
    );
  });
});

// ---------------------------------------------------------------------------
// sortFactories / create — DIVERGENCE FOUND, THEN FIXED (Bucket B commit 2 adopts
// core's throw-on-any-cycle version in both packages; see below)
// ---------------------------------------------------------------------------

const NAMES = ['A', 'B', 'C', 'D', 'E'];

/** Builds an ACYCLIC set of (name, deps) pairs: deps of NAMES[i] are drawn only
 *  from NAMES[0..i-1], so a cycle is structurally impossible. */
const acyclicGraphArb = fc
  .constantFrom(...NAMES.map((_, i) => i))
  .chain(() => fc.tuple(...NAMES.map((_, i) => fc.subarray(NAMES.slice(0, i)))));

function buildAndSort(
  factoryFn: (name: string, deps: string[], create: (d: unknown) => unknown) => unknown,
  sortFn: (factories: unknown[]) => unknown[],
  depsPerName: string[][]
): string[] {
  const factories = NAMES.map((n, i) => factoryFn(n, depsPerName[i], () => undefined));
  const sorted = sortFn(factories);
  return sorted.map((f) => (f as { fn: string }).fn);
}

describe('sortFactories — acyclic DAGs: expression / functions / core agree', () => {
  it('produce the same topological order on random acyclic graphs', () => {
    fc.assert(
      fc.property(acyclicGraphArb, (depsPerName) => {
        const exprOrder = buildAndSort(exprFactory.factory, exprFactory.sortFactories, [
          ...depsPerName,
        ]);
        const fnOrder = buildAndSort(fnFactory.factory, fnFactory.sortFactories, [...depsPerName]);
        const coreOrder = buildAndSort(coreFactory, coreSortFactories, [...depsPerName]);
        expect(fnOrder).toEqual(exprOrder);
        expect(coreOrder).toEqual(exprOrder);
      }),
      { numRuns: 500 }
    );
  });
});

describe('sortFactories — CIRCULAR dependencies: FIX ADOPTED (Bucket B, commit 2)', () => {
  // Historical note: this block used to be titled "PROVEN DIVERGENCE (reported, not
  // redirected)" — expression's and functions' `sortFactories` silently preserved
  // input order on a cycle instead of throwing, unlike core's. Bucket B commit 2
  // verified neither package's REAL factory-registration graph contains an actual
  // cycle (both `sortFactories`/`create` are otherwise-unused mathjs legacy
  // machinery — every real factory is wired by hand, not through a name-sorted DAG
  // load) and adopted core's stricter, throw-on-any-cycle version in both packages.
  // All three now agree: throw on both direct and indirect cycles.
  it('core, expression, and functions all throw on a direct 2-cycle', () => {
    const build = (f: typeof coreFactory) => [
      f('A', ['B'], () => undefined),
      f('B', ['A'], () => undefined),
    ];

    expect(() => coreSortFactories(build(coreFactory) as never)).toThrow(/Circular dependency/);
    expect(() => exprFactory.sortFactories(build(exprFactory.factory as never) as never)).toThrow(
      /Circular dependency/
    );
    expect(() => fnFactory.sortFactories(build(fnFactory.factory as never) as never)).toThrow(
      /Circular dependency/
    );
  });

  it('core, expression, and functions all throw on an indirect 3-cycle (A->B->C->A)', () => {
    const build = (f: typeof coreFactory) => [
      f('A', ['B'], () => undefined),
      f('B', ['C'], () => undefined),
      f('C', ['A'], () => undefined),
    ];

    expect(() => coreSortFactories(build(coreFactory) as never)).toThrow(/Circular dependency/);
    expect(() => exprFactory.sortFactories(build(exprFactory.factory as never) as never)).toThrow(
      /Circular dependency/
    );
    expect(() => fnFactory.sortFactories(build(fnFactory.factory as never) as never)).toThrow(
      /Circular dependency/
    );
  });

  it('expression and functions agree with EACH OTHER on the cyclic case (both throw)', () => {
    const buildExpr = () => [
      exprFactory.factory('A', ['B'], () => undefined),
      exprFactory.factory('B', ['A'], () => undefined),
    ];
    const buildFn = () => [
      fnFactory.factory('A', ['B'], () => undefined),
      fnFactory.factory('B', ['A'], () => undefined),
    ];
    expect(() => exprFactory.sortFactories(buildExpr())).toThrow(/Circular dependency/);
    expect(() => fnFactory.sortFactories(buildFn())).toThrow(/Circular dependency/);
  });
});

// ---------------------------------------------------------------------------
// string.ts
// ---------------------------------------------------------------------------

describe('string utils — compareText / stringify', () => {
  it('compareText agrees across expression / functions / core', () => {
    assertEquivalent(
      'compareText',
      [
        { name: 'expression', fn: tryCall(exprString.compareText) },
        { name: 'functions', fn: tryCall(fnString.compareText) },
        { name: 'core', fn: tryCall(coreCompareText) },
      ],
      fc.tuple(fc.string(), fc.string())
    );
  });

  it('stringify agrees across expression / functions / core', () => {
    const anyValue = fc.oneof(
      fc.string(),
      fc.double({ noNaN: true }),
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined)
    );
    assertEquivalent(
      'stringify',
      [
        { name: 'expression', fn: exprString.stringify },
        { name: 'functions', fn: fnString.stringify },
        { name: 'core', fn: coreStringify },
      ],
      fc.tuple(anyValue)
    );
  });
});

const numberFormatOptionsArb = fc.oneof(
  fc.constant(undefined),
  fc.integer({ min: 0, max: 12 }),
  fc.constantFrom(
    { notation: 'fixed' as const },
    { notation: 'exponential' as const },
    { notation: 'auto' as const }
  )
);

describe('string utils — generic format()', () => {
  it('agrees across expression / functions / core for numbers/strings/arrays/objects', () => {
    const valueArb = fc.oneof(
      fc.double({ min: -1e6, max: 1e6, noNaN: true }),
      fc.string(),
      fc.array(fc.double({ min: -100, max: 100, noNaN: true }), { maxLength: 5 }),
      // plain (Object.prototype) records only — a null-prototype object legitimately
      // crashes ALL THREE copies identically (`.toString` doesn't exist), which is a
      // pre-existing shared quirk of this mathjs-derived code, not something this
      // dedup slice introduces or should paper over via a differently-shaped arbitrary.
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 5 }),
        fc.integer({ min: -100, max: 100 }),
        {
          noNullPrototype: true,
        }
      )
    );
    assertEquivalent(
      'format',
      [
        { name: 'expression', fn: tryCall(exprString.format) },
        { name: 'functions', fn: tryCall(fnString.format) },
        { name: 'core', fn: tryCall(coreFormat) },
      ],
      fc.tuple(valueArb, numberFormatOptionsArb),
      { checkMutation: false } // dictionary values are read-only-inspected but freezing + reformat recursion is unnecessary risk here
    );
  });

  it('truncate option agrees across expression / functions / core', () => {
    assertEquivalent(
      'format(truncate)',
      [
        { name: 'expression', fn: exprString.format },
        { name: 'functions', fn: fnString.format },
        { name: 'core', fn: coreFormat },
      ],
      fc.tuple(
        fc.string({ minLength: 0, maxLength: 40 }),
        fc.record({ truncate: fc.integer({ min: 0, max: 20 }) })
      )
    );
  });
});

describe('string utils — escape (expression vs core only; functions never had it)', () => {
  it('agrees across expression / core', () => {
    assertEquivalent(
      'escape',
      [
        { name: 'expression', fn: exprString.escape },
        { name: 'core', fn: coreEscape },
      ],
      fc.tuple(fc.string())
    );
  });
});
