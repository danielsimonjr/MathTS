import { describe, it, expect } from 'vitest';
import {
  factory,
  isFactory,
  isOptionalDependency,
  stripOptionalNotation,
  assertDependencies,
  sortFactories,
  create,
} from '../src/utils/factory.js';

/**
 * Unit coverage for this package's `utils/factory.ts`, mirroring
 * `expression/tests/utils-factory.test.ts`. `functions` never had a dedicated test
 * file for this module before Bucket B commit 2 — added alongside the
 * `sortFactories`/`create` adoption from `@danielsimonjr/mathts-core/internal` (see
 * `functions/src/utils/factory.ts`'s header comment and CHANGELOG.md).
 */

// ---------------------------------------------------------------------------
// isFactory
// ---------------------------------------------------------------------------
describe('isFactory', () => {
  it('returns true for a proper factory function', () => {
    const f = factory('add', [], () => () => {});
    expect(isFactory(f)).toBe(true);
  });

  it('returns false for plain functions without fn/dependencies', () => {
    expect(isFactory(() => {})).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isFactory(null)).toBe(false);
    expect(isFactory(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isOptionalDependency / stripOptionalNotation
// ---------------------------------------------------------------------------
describe('isOptionalDependency', () => {
  it('returns true for dependencies prefixed with "?"', () => {
    expect(isOptionalDependency('?config')).toBe(true);
  });

  it('returns false for required dependencies', () => {
    expect(isOptionalDependency('typed')).toBe(false);
  });
});

describe('stripOptionalNotation', () => {
  it('removes leading "?" from optional dependencies', () => {
    expect(stripOptionalNotation('?config')).toBe('config');
  });

  it('returns the dependency unchanged when not optional', () => {
    expect(stripOptionalNotation('typed')).toBe('typed');
  });
});

// ---------------------------------------------------------------------------
// assertDependencies
// ---------------------------------------------------------------------------
describe('assertDependencies', () => {
  it('does not throw when all required deps are present', () => {
    expect(() => assertDependencies('myFn', ['a', 'b'], { a: 1, b: 2 })).not.toThrow();
  });

  it('throws when a required dep is missing', () => {
    expect(() => assertDependencies('myFn', ['a', 'b'], { a: 1 })).toThrow(
      'Cannot create function "myFn"'
    );
  });

  it('does not throw when optional deps are missing', () => {
    expect(() => assertDependencies('myFn', ['?optionalDep'], {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------
describe('factory', () => {
  it('creates a callable factory with the correct metadata', () => {
    const createAdd = factory('add', ['a', 'b'], ({ a, b }: { a: number; b: number }) => a + b);
    expect(isFactory(createAdd)).toBe(true);
    expect(createAdd.fn).toBe('add');
    expect(createAdd.dependencies).toContain('a');
    expect(createAdd.dependencies).toContain('b');
  });

  it('sorts dependencies alphabetically', () => {
    const f = factory('f', ['z', 'a', 'm'], () => {});
    expect(f.dependencies).toEqual(['a', 'm', 'z']);
  });
});

// ---------------------------------------------------------------------------
// sortFactories — adopted from core (Bucket B, commit 2)
// ---------------------------------------------------------------------------
describe('sortFactories', () => {
  it('places a factory before another that depends on it', () => {
    const fA = factory('a', [], () => 'a');
    const fB = factory('b', ['a'], ({ a }: { a: string }) => a + 'b');
    const sorted = sortFactories([fB, fA]);
    const names = (sorted as (typeof fA)[]).map((f) => f.fn);
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'));
  });

  it('handles factories with no dependencies', () => {
    const fA = factory('a', [], () => {});
    const fB = factory('b', [], () => {});
    const sorted = sortFactories([fA, fB]);
    expect(sorted.length).toBe(2);
  });

  it('throws on a direct 2-cycle (adopted core behavior, Bucket B commit 2)', () => {
    const fA = factory('a', ['b'], ({ b }: { b: unknown }) => b);
    const fB = factory('b', ['a'], ({ a }: { a: unknown }) => a);
    // core's sortFactories throws on ANY circular dependency, direct or indirect;
    // this package's sortFactories now delegates to core's (formerly silently
    // preserved input order without throwing — see CHANGELOG.md Bucket B commit 2).
    expect(() => sortFactories([fA, fB])).toThrow(/Circular dependency/);
  });

  it('throws on an indirect 3-cycle (A->B->C->A)', () => {
    const fA = factory('a', ['b'], ({ b }: { b: unknown }) => b);
    const fB = factory('b', ['c'], ({ c }: { c: unknown }) => c);
    const fC = factory('c', ['a'], ({ a }: { a: unknown }) => a);
    expect(() => sortFactories([fA, fB, fC])).toThrow(/Circular dependency/);
  });

  it('still produces a correct topological order on non-cyclic graphs', () => {
    const fA = factory('a', [], () => 'a');
    const fB = factory('b', ['a'], ({ a }: { a: string }) => a + 'b');
    const fC = factory('c', ['a', 'b'], ({ a, b }: { a: string; b: string }) => a + b + 'c');
    const sorted = sortFactories([fC, fB, fA]);
    const names = (sorted as (typeof fA)[]).map((f) => f.fn);
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'));
    expect(names.indexOf('b')).toBeLessThan(names.indexOf('c'));
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
describe('create', () => {
  it('runs sorted factories against scope and returns scope', () => {
    const scope: Record<string, unknown> = {};
    const fA = factory('a', [], () => {
      scope['a'] = 42;
      return 42;
    });
    create([fA], scope);
    expect(scope['a']).toBe(42);
  });

  it('returns the scope object', () => {
    const scope = { existing: true };
    const result = create([], scope);
    expect(result).toBe(scope);
  });
});
