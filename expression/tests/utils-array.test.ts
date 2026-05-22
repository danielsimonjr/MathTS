import { describe, it, expect } from 'vitest'
import {
  arraySize,
  validate,
  validateIndex,
  resize,
  reshape,
  processSizesWildcard,
  squeeze,
  unsqueeze,
  flatten,
  map,
  forEach,
  filter,
  filterRegExp,
  join,
  identify,
  generalize,
  getArrayDataType,
  last,
  initial,
  concat,
  broadcastSizes,
  checkBroadcastingRules,
  broadcastTo,
  broadcastArrays,
  stretch,
  get,
  deepMap,
  deepForEach,
  clone,
} from '../src/utils/array.js'

// ---------------------------------------------------------------------------
// arraySize
// ---------------------------------------------------------------------------
describe('arraySize', () => {
  it('returns [] for a scalar-like non-array', () => {
    // scalar (not an array) – size is []
    expect(arraySize(42 as any)).toEqual([])
  })

  it('returns [n] for a 1-D array', () => {
    expect(arraySize([1, 2, 3])).toEqual([3])
  })

  it('returns [rows, cols] for a 2-D array', () => {
    expect(arraySize([[1, 2], [3, 4]])).toEqual([2, 2])
  })

  it('returns [2,3,4] for a 3-D array', () => {
    const arr = [
      [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]],
      [[13, 14, 15, 16], [17, 18, 19, 20], [21, 22, 23, 24]],
    ]
    expect(arraySize(arr)).toEqual([2, 3, 4])
  })

  it('returns [0] for an empty array', () => {
    expect(arraySize([])).toEqual([0])
  })
})

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------
describe('validate', () => {
  it('accepts a 1-D array with the correct length', () => {
    expect(() => validate([1, 2, 3], [3])).not.toThrow()
  })

  it('accepts a 2-D array with correct dimensions', () => {
    expect(() => validate([[1, 2], [3, 4]], [2, 2])).not.toThrow()
  })

  it('throws DimensionError when length does not match', () => {
    expect(() => validate([1, 2, 3], [2])).toThrow()
  })

  it('throws DimensionError for non-array when scalar expected', () => {
    // size=[] means scalar, so an array input should throw
    expect(() => validate([1], [])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// validateIndex
// ---------------------------------------------------------------------------
describe('validateIndex', () => {
  it('does not throw for a valid index', () => {
    expect(() => validateIndex(0, 5)).not.toThrow()
    expect(() => validateIndex(4, 5)).not.toThrow()
  })

  it('does not throw for undefined index', () => {
    expect(() => validateIndex(undefined, 5)).not.toThrow()
  })

  it('throws for a non-integer index', () => {
    expect(() => validateIndex(1.5, 5)).toThrow('Index must be an integer')
  })

  it('throws for a negative index', () => {
    expect(() => validateIndex(-1, 5)).toThrow()
  })

  it('throws for an index >= length', () => {
    expect(() => validateIndex(5, 5)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// resize
// ---------------------------------------------------------------------------
describe('resize', () => {
  it('grows a 1-D array with default zero fill', () => {
    const result = resize([1, 2], [5])
    expect(result).toEqual([1, 2, 0, 0, 0])
  })

  it('shrinks a 1-D array', () => {
    const result = resize([1, 2, 3, 4], [2])
    expect(result).toEqual([1, 2])
  })

  it('fills new entries with the provided default value', () => {
    const result = resize([1], [3], 9)
    expect(result).toEqual([1, 9, 9])
  })

  it('throws when size is not an array', () => {
    expect(() => resize([1, 2], 3 as any)).toThrow('Array expected')
  })

  it('throws when size is empty', () => {
    expect(() => resize([1, 2], [])).toThrow('Resizing to scalar is not supported')
  })

  it('throws when size contains a non-integer', () => {
    expect(() => resize([1], [1.5])).toThrow()
  })

  it('resizes a 2-D array', () => {
    const result = resize([[1, 2], [3, 4]], [3, 3])
    expect(result).toEqual([[1, 2, 0], [3, 4, 0], [0, 0, 0]])
  })
})

// ---------------------------------------------------------------------------
// reshape
// ---------------------------------------------------------------------------
describe('reshape', () => {
  it('reshapes [1..6] into [[1,2,3],[4,5,6]]', () => {
    expect(reshape([1, 2, 3, 4, 5, 6], [2, 3])).toEqual([[1, 2, 3], [4, 5, 6]])
  })

  it('reshapes a 2-D array to 1-D', () => {
    expect(reshape([[1, 2], [3, 4]], [4])).toEqual([1, 2, 3, 4])
  })

  it('throws DimensionError when element counts differ', () => {
    expect(() => reshape([1, 2, 3], [2, 2])).toThrow()
  })

  it('throws when sizes is empty', () => {
    expect(() => reshape([1, 2], [])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// processSizesWildcard
// ---------------------------------------------------------------------------
describe('processSizesWildcard', () => {
  it('replaces -1 wildcard with computed dimension', () => {
    expect(processSizesWildcard([2, -1], 6)).toEqual([2, 3])
  })

  it('returns sizes unchanged when there is no wildcard', () => {
    expect(processSizesWildcard([2, 3], 6)).toEqual([2, 3])
  })

  it('throws when more than one wildcard', () => {
    expect(() => processSizesWildcard([-1, -1], 4)).toThrow('More than one wildcard')
  })

  it('throws when wildcard cannot be replaced', () => {
    expect(() => processSizesWildcard([2, -1], 7)).toThrow('Could not replace wildcard')
  })
})

// ---------------------------------------------------------------------------
// squeeze
// ---------------------------------------------------------------------------
describe('squeeze', () => {
  it('squeezes outer size-1 dimensions', () => {
    // [[1,2,3]] → [1,2,3]
    expect(squeeze([[1, 2, 3]])).toEqual([1, 2, 3])
  })

  it('returns scalar for [[42]]', () => {
    expect(squeeze([[42]])).toBe(42)
  })

  it('does not squeeze if no dimensions have size 1', () => {
    const arr = [[1, 2], [3, 4]]
    expect(squeeze(arr)).toEqual([[1, 2], [3, 4]])
  })
})

// ---------------------------------------------------------------------------
// unsqueeze
// ---------------------------------------------------------------------------
describe('unsqueeze', () => {
  it('adds outer dimensions', () => {
    const result = unsqueeze([1, 2, 3], 2, 1)
    expect(result).toEqual([[1, 2, 3]])
  })

  it('adds inner dimensions to scalars', () => {
    // unsqueeze scalar to 1-D with desired dims=1
    const result = unsqueeze(5 as any, 1)
    expect(result).toEqual([5])
  })
})

// ---------------------------------------------------------------------------
// flatten
// ---------------------------------------------------------------------------
describe('flatten', () => {
  it('flattens a 2-D array', () => {
    expect(flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4])
  })

  it('flattens a 3-D array', () => {
    expect(flatten([[[1, 2], [3, 4]], [[5, 6], [7, 8]]])).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('returns a 1-D array unchanged', () => {
    expect(flatten([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('returns the value wrapped in array when not an array', () => {
    // non-array is returned as-is in T[] form
    expect(flatten(42 as any)).toBe(42 as any)
  })

  it('throws when second arg is not boolean', () => {
    expect(() => flatten([[1]], 'yes' as any)).toThrow('Boolean expected')
  })

  it('uses rectangular fast path when isRectangular=true', () => {
    expect(flatten([[1, 2], [3, 4]], true)).toEqual([1, 2, 3, 4])
  })
})

// ---------------------------------------------------------------------------
// map / forEach / filter / filterRegExp / join
// ---------------------------------------------------------------------------
describe('map', () => {
  it('applies callback to each element', () => {
    expect(map([1, 2, 3], (x) => x * 2)).toEqual([2, 4, 6])
  })
})

describe('forEach', () => {
  it('calls callback for each element', () => {
    const collected: number[] = []
    forEach([10, 20, 30], (v) => collected.push(v))
    expect(collected).toEqual([10, 20, 30])
  })
})

describe('filter', () => {
  it('filters elements matching predicate', () => {
    expect(filter([1, 2, 3, 4], (x) => x % 2 === 0)).toEqual([2, 4])
  })

  it('throws for multi-dimensional arrays', () => {
    expect(() => filter([[1, 2], [3, 4]], () => true)).toThrow('Only one dimensional')
  })
})

describe('filterRegExp', () => {
  it('returns strings matching the regex', () => {
    expect(filterRegExp(['foo', 'bar', 'baz'], /^ba/)).toEqual(['bar', 'baz'])
  })

  it('throws for multi-dimensional arrays', () => {
    expect(() => filterRegExp([['foo']], /x/)).toThrow('Only one dimensional')
  })
})

describe('join', () => {
  it('joins array elements with separator', () => {
    expect(join([1, 2, 3], ', ')).toBe('1, 2, 3')
  })
})

// ---------------------------------------------------------------------------
// identify / generalize
// ---------------------------------------------------------------------------
describe('identify', () => {
  it('assigns identifier 0 for the first unique value', () => {
    expect(identify([1, 2, 3])).toEqual([
      { value: 1, identifier: 0 },
      { value: 2, identifier: 0 },
      { value: 3, identifier: 0 },
    ])
  })

  it('increments identifier for consecutive duplicates', () => {
    expect(identify([1, 1, 1])).toEqual([
      { value: 1, identifier: 0 },
      { value: 1, identifier: 1 },
      { value: 1, identifier: 2 },
    ])
  })

  it('returns [] for empty input', () => {
    expect(identify([])).toEqual([])
  })

  it('throws for non-array', () => {
    expect(() => identify(42 as any)).toThrow('Array input expected')
  })
})

describe('generalize', () => {
  it('strips identifiers, returning values only', () => {
    const identified = identify([10, 20, 30])
    expect(generalize(identified)).toEqual([10, 20, 30])
  })

  it('returns [] for empty input', () => {
    expect(generalize([])).toEqual([])
  })

  it('throws for non-array', () => {
    expect(() => generalize(42 as any)).toThrow('Array input expected')
  })
})

// ---------------------------------------------------------------------------
// getArrayDataType
// ---------------------------------------------------------------------------
describe('getArrayDataType', () => {
  it('returns the type of homogeneous elements', () => {
    const typeOf = (v: any) => typeof v
    expect(getArrayDataType([1, 2, 3], typeOf)).toBe('number')
  })

  it('returns "mixed" for heterogeneous elements', () => {
    const typeOf = (v: any) => typeof v
    expect(getArrayDataType([1, 'hello'], typeOf)).toBe('mixed')
  })

  it('returns undefined for an inconsistent jagged array', () => {
    const typeOf = (v: any) => typeof v
    // row lengths differ
    const result = getArrayDataType([[1, 2], [3]], typeOf)
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// last / initial
// ---------------------------------------------------------------------------
describe('last', () => {
  it('returns the last element', () => {
    expect(last([1, 2, 3])).toBe(3)
  })
})

describe('initial', () => {
  it('returns all but the last element', () => {
    expect(initial([1, 2, 3])).toEqual([1, 2])
  })

  it('returns [] for a single-element array', () => {
    expect(initial([42])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// concat
// ---------------------------------------------------------------------------
describe('concat', () => {
  it('concatenates two 1-D arrays on dim 0', () => {
    expect(concat([1, 2], [3, 4], 0)).toEqual([1, 2, 3, 4])
  })

  it('returns the single array when only one is provided', () => {
    expect(concat([1, 2, 3], 0)).toEqual([1, 2, 3])
  })

  it('concatenates 2-D arrays on the first dimension (rows)', () => {
    const A = [[1, 2], [3, 4]]
    const B = [[5, 6]]
    expect(concat(A, B, 0)).toEqual([[1, 2], [3, 4], [5, 6]])
  })

  it('concatenates 2-D arrays on the second dimension (cols)', () => {
    const A = [[1, 2], [3, 4]]
    const B = [[5], [6]]
    expect(concat(A, B, 1)).toEqual([[1, 2, 5], [3, 4, 6]])
  })
})

// ---------------------------------------------------------------------------
// broadcastSizes / checkBroadcastingRules / broadcastTo / broadcastArrays
// ---------------------------------------------------------------------------
describe('broadcastSizes', () => {
  it('broadcasts [3] and [1] to [3]', () => {
    expect(broadcastSizes([3], [1])).toEqual([3])
  })

  it('broadcasts [2,1] and [1,3] to [2,3]', () => {
    expect(broadcastSizes([2, 1], [1, 3])).toEqual([2, 3])
  })

  it('broadcasts [3] and [2,3] to [2,3]', () => {
    expect(broadcastSizes([3], [2, 3])).toEqual([2, 3])
  })
})

describe('checkBroadcastingRules', () => {
  it('does not throw for compatible shapes', () => {
    expect(() => checkBroadcastingRules([1, 3], [2, 3])).not.toThrow()
  })

  it('throws for incompatible shapes', () => {
    expect(() => checkBroadcastingRules([2, 3], [2, 4])).toThrow('shape mismatch')
  })
})

describe('broadcastTo', () => {
  it('returns the same array when sizes match', () => {
    const arr = [1, 2, 3]
    expect(broadcastTo(arr, [3])).toEqual([1, 2, 3])
  })

  it('stretches [1,2,3] to [[1,2,3],[1,2,3]]', () => {
    const result = broadcastTo([1, 2, 3], [2, 3])
    expect(result).toEqual([[1, 2, 3], [1, 2, 3]])
  })
})

describe('broadcastArrays', () => {
  it('broadcasts two arrays to the same shape', () => {
    const [a, b] = broadcastArrays([1, 2, 3], [1]) as number[][]
    expect(a).toEqual([1, 2, 3])
    expect(b).toEqual([1, 1, 1])
  })

  it('throws for empty input', () => {
    expect(() => broadcastArrays()).toThrow('Insufficient number of arguments')
  })
})

// ---------------------------------------------------------------------------
// stretch
// ---------------------------------------------------------------------------
describe('stretch', () => {
  it('duplicates the array along dim 0', () => {
    expect(stretch([1, 2, 3], 2, 0)).toEqual([1, 2, 3, 1, 2, 3])
  })
})

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------
describe('get', () => {
  it('retrieves the correct element from a 2-D array', () => {
    const arr = [[1, 2], [3, 4]]
    expect(get(arr, [0, 1])).toBe(2)
    expect(get(arr, [1, 0])).toBe(3)
  })

  it('throws for an index out of range', () => {
    expect(() => get([[1, 2]], [0, 5])).toThrow()
  })

  it('throws when index length mismatches array dimensions', () => {
    expect(() => get([[1, 2]], [0])).toThrow()
  })

  it('throws when not passed an array', () => {
    expect(() => get(42 as any, [0])).toThrow('Array expected')
  })
})

// ---------------------------------------------------------------------------
// deepMap
// ---------------------------------------------------------------------------
describe('deepMap', () => {
  it('maps over a 1-D array', () => {
    expect(deepMap([1, 2, 3], (x: number) => x * 10)).toEqual([10, 20, 30])
  })

  it('maps over a 2-D array', () => {
    expect(deepMap([[1, 2], [3, 4]], (x: number) => x + 1)).toEqual([[2, 3], [4, 5]])
  })

  it('returns [] for an empty array', () => {
    expect(deepMap([], (x) => x)).toEqual([])
  })

  it('passes index when skipIndex=false', () => {
    const indices: number[][] = []
    deepMap([[1, 2], [3, 4]], (_v: number, idx: number[]) => {
      indices.push(idx)
      return 0
    }, false)
    expect(indices).toContainEqual([0, 0])
    expect(indices).toContainEqual([1, 1])
  })

  it('skips index when skipIndex=true', () => {
    const result = deepMap([1, 2, 3], (x: number) => x * 2, true)
    expect(result).toEqual([2, 4, 6])
  })
})

// ---------------------------------------------------------------------------
// deepForEach
// ---------------------------------------------------------------------------
describe('deepForEach', () => {
  it('iterates over all scalar values in a 2-D array', () => {
    const values: number[] = []
    deepForEach([[1, 2], [3, 4]], (v: number) => values.push(v), true)
    expect(values).toEqual([1, 2, 3, 4])
  })

  it('does nothing for an empty array', () => {
    const values: number[] = []
    deepForEach([], (v: number) => values.push(v))
    expect(values).toEqual([])
  })

  it('provides index when skipIndex=false', () => {
    const indices: number[][] = []
    deepForEach([[10, 20]], (_v: number, idx: number[]) => indices.push(idx), false)
    expect(indices).toContainEqual([0, 0])
    expect(indices).toContainEqual([0, 1])
  })
})

// ---------------------------------------------------------------------------
// clone
// ---------------------------------------------------------------------------
describe('clone (array)', () => {
  it('returns a shallow clone of the array', () => {
    const a = [1, 2, 3]
    const b = clone(a)
    expect(b).toEqual(a)
    expect(b).not.toBe(a)
  })

  it('does not deep clone nested arrays', () => {
    const inner = [1, 2]
    const a = [inner, [3, 4]]
    const b = clone(a)
    expect(b[0]).toBe(inner) // shallow clone only
  })
})
