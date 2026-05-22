import { describe, it, expect } from 'vitest'
import { errorTransform } from '../src/transform/utils/errorTransform.js'
import { IndexError } from '../src/error/IndexError.js'

describe('errorTransform - non-IndexError passthrough', () => {
  it('returns a generic Error unchanged', () => {
    const err = new Error('generic error')
    const result = errorTransform(err)
    expect(result).toBe(err)
  })

  it('returns a TypeError unchanged', () => {
    const err = new TypeError('type error')
    const result = errorTransform(err)
    expect(result).toBe(err)
  })

  it('returns a RangeError that is not an IndexError unchanged', () => {
    const err = new RangeError('range error')
    const result = errorTransform(err)
    expect(result).toBe(err)
  })

  it('returns null unchanged', () => {
    const result = errorTransform(null)
    expect(result).toBeNull()
  })

  it('returns undefined unchanged', () => {
    const result = errorTransform(undefined)
    expect(result).toBeUndefined()
  })

  it('returns a plain object unchanged if not an IndexError', () => {
    const obj = { message: 'something', isIndexError: false }
    const result = errorTransform(obj)
    expect(result).toBe(obj)
  })

  it('returns a string unchanged', () => {
    const result = errorTransform('error string')
    expect(result).toBe('error string')
  })
})

describe('errorTransform - IndexError zero-based to one-based conversion', () => {
  it('converts a two-arg IndexError (index=2, max=5) to one-based (index=3, min=1, max=6)', () => {
    // two-arg IndexError: actualMin=0, actualMax=5
    const original = new IndexError(2, 5)
    expect(original.index).toBe(2)
    expect(original.min).toBe(0)
    expect(original.max).toBe(5)

    const transformed = errorTransform(original) as IndexError
    expect(transformed).toBeInstanceOf(IndexError)
    // index + 1 = 3, min + 1 = 1, max + 1 = 6
    expect(transformed.index).toBe(3)
    expect(transformed.min).toBe(1)
    expect(transformed.max).toBe(6)
  })

  it('produces the correct message for the transformed error', () => {
    // original: index=4 >= max=3 => "Index out of range (4 > 2)"
    const original = new IndexError(4, 3)
    const transformed = errorTransform(original) as IndexError
    // transformed: index=5, min=1, max=4 => 5 >= 4 => "Index out of range (5 > 3)"
    expect(transformed.message).toBe('Index out of range (5 > 3)')
  })

  it('converts a three-arg IndexError (index=0, min=1, max=5)', () => {
    // index=0 < min=1
    const original = new IndexError(0, 1, 5)
    const transformed = errorTransform(original) as IndexError
    // index+1=1, min+1=2, max+1=6
    expect(transformed.index).toBe(1)
    expect(transformed.min).toBe(2)
    expect(transformed.max).toBe(6)
  })

  it('returns a NEW IndexError, not the original', () => {
    const original = new IndexError(2, 5)
    const transformed = errorTransform(original)
    expect(transformed).not.toBe(original)
  })

  it('the transformed error is still an IndexError', () => {
    const original = new IndexError(2, 5)
    const transformed = errorTransform(original)
    expect(transformed).toBeInstanceOf(IndexError)
  })

  it('handles index=0, max=3 (zero-based lower bound)', () => {
    // index=0 >= max? No (0 < 3). So generic message.
    // Actual: index=0 < min=0 is false; 0 >= max=3 is false => generic
    const original = new IndexError(0, 3)
    // Actually 0 >= 0 (min) and 0 < 3 (max) so generic "Index out of range (0)"
    const transformed = errorTransform(original) as IndexError
    // After transform: index=1, min=1, max=4 => 1 < 1? No. 1 >= 4? No. Generic.
    expect(transformed.index).toBe(1)
    expect(transformed.min).toBe(1)
    expect(transformed.max).toBe(4)
  })

  it('handles max=undefined (one-arg IndexError)', () => {
    // IndexError(7) => min=0, max=undefined
    const original = new IndexError(7)
    expect(original.max).toBeUndefined()

    const transformed = errorTransform(original) as IndexError
    // errorTransform calls new IndexError(7+1=8, 0+1=1, undefined)
    // IndexError(8, 1, undefined): max===undefined => actualMin=0, actualMax=1
    // So: index=8, min=0, max=1
    expect(transformed.index).toBe(8)
    expect(transformed.min).toBe(0)
    expect(transformed.max).toBe(1)
  })
})

describe('errorTransform - isIndexError flag detection', () => {
  it('transforms an object with isIndexError=true (duck typing)', () => {
    // The function checks `err.isIndexError`, not instanceof IndexError
    const fakeIndexError = {
      isIndexError: true,
      index: 3,
      min: 0,
      max: 10
    }
    const result = errorTransform(fakeIndexError) as IndexError
    expect(result).toBeInstanceOf(IndexError)
    expect(result.index).toBe(4) // 3 + 1
    expect(result.min).toBe(1)  // 0 + 1
    expect(result.max).toBe(11) // 10 + 1
  })
})
