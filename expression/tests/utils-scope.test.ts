import { describe, it, expect } from 'vitest'
import { createSubScope } from '../src/utils/scope.js'
import { PartitionedMap } from '../src/utils/map.js'

// ---------------------------------------------------------------------------
// createSubScope
// ---------------------------------------------------------------------------
describe('createSubScope', () => {
  it('returns a PartitionedMap', () => {
    const parent = new Map<string, number>([['x', 1]])
    const sub = createSubScope(parent, { y: 2 })
    expect(sub).toBeInstanceOf(PartitionedMap)
  })

  it('can read keys from the parent scope', () => {
    const parent = new Map<string, number>([['x', 10]])
    const sub = createSubScope(parent, {})
    expect(sub.get('x')).toBe(10)
  })

  it('can read keys from the args (b partition)', () => {
    const parent = new Map<string, number>()
    const sub = createSubScope(parent, { y: 99 } as any)
    expect(sub.get('y')).toBe(99)
  })

  it('args keys shadow parent keys', () => {
    const parent = new Map<string, number>([['x', 1]])
    const sub = createSubScope(parent, { x: 42 } as any)
    // x is in bKeys, so reads from b (the ObjectWrappingMap wrapping args)
    expect(sub.get('x')).toBe(42)
  })

  it('writes to b partition for arg keys', () => {
    const parent = new Map<string, number>([['x', 1]])
    const sub = createSubScope(parent, { y: 5 } as any)
    sub.set('y', 99)
    // parent should not be affected
    expect(parent.has('y')).toBe(false)
    expect(sub.get('y')).toBe(99)
  })

  it('writes to a partition (parent) for non-arg keys', () => {
    const parent = new Map<string, number>()
    const sub = createSubScope(parent, { y: 5 } as any)
    sub.set('z', 77 as any)
    // z is not in bKeys, goes to a (parent)
    expect(parent.get('z')).toBe(77)
  })

  it('handles multiple arg keys', () => {
    const parent = new Map<string, number>()
    const sub = createSubScope(parent, { a: 1, b: 2, c: 3 } as any)
    expect(sub.get('a')).toBe(1)
    expect(sub.get('b')).toBe(2)
    expect(sub.get('c')).toBe(3)
  })

  it('handles empty args', () => {
    const parent = new Map<string, number>([['k', 7]])
    const sub = createSubScope(parent, {})
    expect(sub.get('k')).toBe(7)
  })
})
