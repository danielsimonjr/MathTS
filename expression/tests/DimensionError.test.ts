import { describe, it, expect } from 'vitest'
import { DimensionError } from '../src/error/DimensionError.js'

describe('DimensionError - construction: standard two-number usage', () => {
  it('creates error with actual and expected numbers', () => {
    const err = new DimensionError(3, 4)
    expect(err).toBeInstanceOf(DimensionError)
    expect(err).toBeInstanceOf(RangeError)
    expect(err).toBeInstanceOf(Error)
  })

  it('produces correct default message (!=)', () => {
    const err = new DimensionError(3, 4)
    expect(err.message).toBe('Dimension mismatch (3 != 4)')
  })

  it('stores actual and expected', () => {
    const err = new DimensionError(3, 4)
    expect(err.actual).toBe(3)
    expect(err.expected).toBe(4)
  })

  it('relation defaults to undefined (shows !=)', () => {
    const err = new DimensionError(3, 4)
    expect(err.relation).toBeUndefined()
  })

  it('sets name to "DimensionError"', () => {
    const err = new DimensionError(3, 4)
    expect(err.name).toBe('DimensionError')
  })

  it('sets isDimensionError to true', () => {
    const err = new DimensionError(3, 4)
    expect(err.isDimensionError).toBe(true)
  })
})

describe('DimensionError - construction: with explicit relation', () => {
  it('uses provided relation in message', () => {
    const err = new DimensionError(5, 3, '<')
    expect(err.message).toBe('Dimension mismatch (5 < 3)')
  })

  it('stores the relation', () => {
    const err = new DimensionError(5, 3, '<')
    expect(err.relation).toBe('<')
  })

  it('works with ">" relation', () => {
    const err = new DimensionError(2, 5, '>')
    expect(err.message).toBe('Dimension mismatch (2 > 5)')
    expect(err.relation).toBe('>')
  })

  it('works with "!=" explicit relation', () => {
    const err = new DimensionError(2, 3, '!=')
    expect(err.message).toBe('Dimension mismatch (2 != 3)')
  })
})

describe('DimensionError - construction: with array dimensions', () => {
  it('formats array actual correctly', () => {
    const err = new DimensionError([2, 3], [2, 4])
    expect(err.message).toBe('Dimension mismatch ([2, 3] != [2, 4])')
  })

  it('stores array actual and expected', () => {
    const err = new DimensionError([2, 3], [2, 4])
    expect(err.actual).toEqual([2, 3])
    expect(err.expected).toEqual([2, 4])
  })

  it('formats single array actual with scalar expected', () => {
    const err = new DimensionError([1, 2], 3)
    expect(err.message).toBe('Dimension mismatch ([1, 2] != 3)')
  })

  it('supports array with explicit relation', () => {
    const err = new DimensionError([3], [4], '<')
    expect(err.message).toBe('Dimension mismatch ([3] < [4])')
  })
})

describe('DimensionError - construction: custom string message', () => {
  it('uses the string directly as the message', () => {
    const err = new DimensionError('custom dimension error message')
    expect(err.message).toBe('custom dimension error message')
  })

  it('does not set actual/expected when custom string', () => {
    const err = new DimensionError('custom')
    expect(err.actual).toBeUndefined()
    expect(err.expected).toBeUndefined()
    expect(err.relation).toBeUndefined()
  })

  it('still sets name and isDimensionError', () => {
    const err = new DimensionError('custom')
    expect(err.name).toBe('DimensionError')
    expect(err.isDimensionError).toBe(true)
  })
})

describe('DimensionError - prototype chain', () => {
  it('instanceof RangeError', () => {
    expect(new DimensionError(1, 2)).toBeInstanceOf(RangeError)
  })

  it('instanceof Error', () => {
    expect(new DimensionError(1, 2)).toBeInstanceOf(Error)
  })

  it('instanceof DimensionError', () => {
    expect(new DimensionError(1, 2)).toBeInstanceOf(DimensionError)
  })

  it('has a stack trace', () => {
    const err = new DimensionError(1, 2)
    expect(typeof err.stack).toBe('string')
  })
})

describe('DimensionError - usage in throw/catch', () => {
  it('can be thrown and caught', () => {
    expect(() => {
      throw new DimensionError(2, 3)
    }).toThrow(DimensionError)
  })

  it('message is preserved when caught', () => {
    try {
      throw new DimensionError(5, 6, '!=')
    } catch (e: any) {
      expect(e.message).toBe('Dimension mismatch (5 != 6)')
      expect(e.isDimensionError).toBe(true)
    }
  })

  it('can be caught as RangeError', () => {
    expect(() => {
      throw new DimensionError(1, 2)
    }).toThrow(RangeError)
  })
})
