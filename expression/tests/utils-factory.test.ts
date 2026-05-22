import { describe, it, expect } from 'vitest'
import {
  factory,
  isFactory,
  isOptionalDependency,
  stripOptionalNotation,
  assertDependencies,
  sortFactories,
  create,
} from '../src/utils/factory.js'

// ---------------------------------------------------------------------------
// isFactory
// ---------------------------------------------------------------------------
describe('isFactory', () => {
  it('returns true for a proper factory function', () => {
    const f = factory('add', [], () => () => {})
    expect(isFactory(f)).toBe(true)
  })

  it('returns false for plain functions without fn/dependencies', () => {
    expect(isFactory(() => {})).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isFactory(null)).toBe(false)
    expect(isFactory(undefined)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isOptionalDependency
// ---------------------------------------------------------------------------
describe('isOptionalDependency', () => {
  it('returns true for dependencies prefixed with "?"', () => {
    expect(isOptionalDependency('?config')).toBe(true)
  })

  it('returns false for required dependencies', () => {
    expect(isOptionalDependency('typed')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// stripOptionalNotation
// ---------------------------------------------------------------------------
describe('stripOptionalNotation', () => {
  it('removes leading "?" from optional dependencies', () => {
    expect(stripOptionalNotation('?config')).toBe('config')
  })

  it('returns the dependency unchanged when not optional', () => {
    expect(stripOptionalNotation('typed')).toBe('typed')
  })
})

// ---------------------------------------------------------------------------
// assertDependencies
// ---------------------------------------------------------------------------
describe('assertDependencies', () => {
  it('does not throw when all required deps are present', () => {
    expect(() =>
      assertDependencies('myFn', ['a', 'b'], { a: 1, b: 2 })
    ).not.toThrow()
  })

  it('throws when a required dep is missing', () => {
    expect(() =>
      assertDependencies('myFn', ['a', 'b'], { a: 1 })
    ).toThrow('Cannot create function "myFn"')
  })

  it('does not throw when optional deps are missing', () => {
    expect(() =>
      assertDependencies('myFn', ['?optionalDep'], {})
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------
describe('factory', () => {
  it('creates a callable factory with the correct metadata', () => {
    const createAdd = factory('add', ['a', 'b'], ({ a, b }: { a: number; b: number }) => a + b)
    expect(isFactory(createAdd)).toBe(true)
    expect(createAdd.fn).toBe('add')
    expect(createAdd.dependencies).toContain('a')
    expect(createAdd.dependencies).toContain('b')
  })

  it('calls the create function with the requested deps', () => {
    const createDouble = factory('double', ['x'], ({ x }: { x: number }) => (n: number) => n * x)
    const double = createDouble({ x: 2, ignored: 'should not appear' })
    expect(double(5)).toBe(10)
  })

  it('throws when a required dep is missing', () => {
    const f = factory('f', ['required'], ({ required }: any) => required)
    expect(() => f({ notRequired: true })).toThrow('Cannot create function "f"')
  })

  it('attaches meta when provided', () => {
    const meta = { recreateOnConfigChange: true }
    const f = factory('f', [], () => {}, meta)
    expect(f.meta).toEqual(meta)
  })

  it('sorts dependencies alphabetically', () => {
    const f = factory('f', ['z', 'a', 'm'], () => {})
    expect(f.dependencies).toEqual(['a', 'm', 'z'])
  })

  it('handles optional deps: does not pass missing optional ones to create', () => {
    const f = factory('f', ['?opt'], (deps: any) => Object.keys(deps))
    const result = f({ unrelated: 1 })
    // 'opt' is optional and missing, so deps should not include it
    expect(result).not.toContain('opt')
  })
})

// ---------------------------------------------------------------------------
// sortFactories
// ---------------------------------------------------------------------------
describe('sortFactories', () => {
  it('places a factory before another that depends on it', () => {
    const fA = factory('a', [], () => 'a')
    const fB = factory('b', ['a'], ({ a }: any) => a + 'b')
    const sorted = sortFactories([fB, fA])
    const names = (sorted as typeof fA[]).map((f) => f.fn)
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'))
  })

  it('handles factories with no dependencies', () => {
    const fA = factory('a', [], () => {})
    const fB = factory('b', [], () => {})
    // Should not throw and should contain both
    const sorted = sortFactories([fA, fB])
    expect(sorted.length).toBe(2)
  })

  it('handles circular dependency without infinite loop', () => {
    const fA = factory('a', ['b'], ({ b }: any) => b)
    const fB = factory('b', ['a'], ({ a }: any) => a)
    // Should not throw or loop infinitely
    expect(() => sortFactories([fA, fB])).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
describe('create', () => {
  it('runs sorted factories against scope and returns scope', () => {
    const scope: Record<string, any> = {}
    const fA = factory('a', [], () => {
      scope['a'] = 42
      return 42
    })
    create([fA], scope)
    expect(scope['a']).toBe(42)
  })

  it('returns the scope object', () => {
    const scope = { existing: true }
    const result = create([], scope)
    expect(result).toBe(scope)
  })
})
