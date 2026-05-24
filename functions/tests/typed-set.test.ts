/**
 * Tests for typed/set.ts — setUnion, setIntersect, setDifference,
 * setSymDifference, setIsSubset, setMultiplicity, setPowerset,
 * setDistinct, setSize, setCartesian, typedSet
 *
 * Covers each set op with known inputs and expected outputs, empty inputs,
 * edge cases, and the typedSet barrel.
 */
import { describe, it, expect } from 'vitest';
import {
  setUnion,
  setIntersect,
  setDifference,
  setSymDifference,
  setIsSubset,
  setMultiplicity,
  setPowerset,
  setDistinct,
  setSize,
  setCartesian,
  typedSet,
} from '../src/typed/set.js';

// =============================================================================
// setUnion
// =============================================================================

describe('setUnion', () => {
  it('union of two disjoint sets', () => {
    const result = setUnion([1, 2], [3, 4]);
    expect(result).toHaveLength(4);
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(3);
    expect(result).toContain(4);
  });

  it('union of overlapping sets', () => {
    const result = setUnion([1, 2, 3], [2, 3, 4]);
    expect(result).toHaveLength(4);
    expect(result).toContain(1);
    expect(result).toContain(4);
  });

  it('union with empty first set returns second', () => {
    const result = setUnion([], [1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  it('union with empty second set returns first', () => {
    const result = setUnion([1, 2, 3], []);
    expect(result).toEqual([1, 2, 3]);
  });

  it('union of two empty sets is empty', () => {
    expect(setUnion([], [])).toEqual([]);
  });

  it('union respects multiplicity: [1,2,2] ∪ [2,3] = [1,2,2,3]', () => {
    const result = setUnion([1, 2, 2], [2, 3]);
    expect(result).toHaveLength(4);
    expect(result.filter((x) => x === 2)).toHaveLength(2);
  });
});

// =============================================================================
// setIntersect
// =============================================================================

describe('setIntersect', () => {
  it('intersection of overlapping sets', () => {
    const result = setIntersect([1, 2, 3, 4], [3, 4, 5, 6]);
    expect(result).toHaveLength(2);
    expect(result).toContain(3);
    expect(result).toContain(4);
  });

  it('intersection of disjoint sets is empty', () => {
    expect(setIntersect([1, 2], [3, 4])).toEqual([]);
  });

  it('intersection with empty set is empty', () => {
    expect(setIntersect([], [1, 2, 3])).toEqual([]);
    expect(setIntersect([1, 2, 3], [])).toEqual([]);
  });

  it('intersection respects multiplicity: [2,2,3] ∩ [2,3] = [2,3]', () => {
    const result = setIntersect([2, 2, 3], [2, 3]);
    expect(result).toHaveLength(2);
  });

  it('intersection of identical sets returns the set', () => {
    const result = setIntersect([1, 2, 3], [1, 2, 3]);
    expect(result).toHaveLength(3);
  });
});

// =============================================================================
// setDifference
// =============================================================================

describe('setDifference', () => {
  it('difference of overlapping sets', () => {
    const result = setDifference([1, 2, 3, 4], [3, 4, 5, 6]);
    expect(result).toHaveLength(2);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('difference with empty subtrahend returns the set', () => {
    const result = setDifference([1, 2, 3], []);
    expect(result).toEqual([1, 2, 3]);
  });

  it('difference with empty minuend is empty', () => {
    expect(setDifference([], [1, 2, 3])).toEqual([]);
  });

  it('difference of identical sets is empty', () => {
    expect(setDifference([1, 2], [1, 2])).toEqual([]);
  });

  it('difference respects multiplicity: [2,2,3] − [2] = [2,3]', () => {
    const result = setDifference([2, 2, 3], [2]);
    expect(result).toHaveLength(2);
    expect(result.filter((x) => x === 2)).toHaveLength(1);
    expect(result).toContain(3);
  });
});

// =============================================================================
// setSymDifference
// =============================================================================

describe('setSymDifference', () => {
  it('symmetric difference of overlapping sets', () => {
    const result = setSymDifference([1, 2, 3, 4], [3, 4, 5, 6]);
    expect(result).toHaveLength(4);
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(5);
    expect(result).toContain(6);
  });

  it('symmetric difference with empty is the other set', () => {
    expect(setSymDifference([], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(setSymDifference([1, 2, 3], [])).toEqual([1, 2, 3]);
  });

  it('symmetric difference of identical sets is empty', () => {
    expect(setSymDifference([1, 2], [1, 2])).toEqual([]);
  });
});

// =============================================================================
// setIsSubset
// =============================================================================

describe('setIsSubset', () => {
  it('proper subset returns true', () => {
    expect(setIsSubset([1, 2], [1, 2, 3, 4])).toBe(true);
  });

  it('equal sets: a is subset of itself', () => {
    expect(setIsSubset([1, 2], [1, 2])).toBe(true);
  });

  it('non-subset returns false', () => {
    expect(setIsSubset([1, 4], [1, 2, 3])).toBe(false);
  });

  it('empty set is subset of anything', () => {
    expect(setIsSubset([], [1, 2, 3])).toBe(true);
    expect(setIsSubset([], [])).toBe(true);
  });

  it('non-empty set is not subset of empty', () => {
    expect(setIsSubset([1], [])).toBe(false);
  });

  it('multiplicity matters: [2,2] not subset of [2,3]', () => {
    expect(setIsSubset([2, 2], [2, 3])).toBe(false);
  });

  it('multiplicity matters: [2,2] is subset of [2,2,3]', () => {
    expect(setIsSubset([2, 2], [2, 2, 3])).toBe(true);
  });
});

// =============================================================================
// setMultiplicity
// =============================================================================

describe('setMultiplicity', () => {
  it('element present once', () => {
    expect(setMultiplicity(1, [1, 2, 2, 4])).toBe(1);
  });

  it('element present twice', () => {
    expect(setMultiplicity(2, [1, 2, 2, 4])).toBe(2);
  });

  it('element absent returns 0', () => {
    expect(setMultiplicity(5, [1, 2, 2, 4])).toBe(0);
  });

  it('empty set returns 0', () => {
    expect(setMultiplicity(1, [])).toBe(0);
  });
});

// =============================================================================
// setPowerset
// =============================================================================

describe('setPowerset', () => {
  it('powerset of 3-element set has 8 subsets', () => {
    const result = setPowerset([1, 2, 3]);
    expect(result).toHaveLength(8);
  });

  it('powerset of [1,2,3] contains the empty set', () => {
    const result = setPowerset([1, 2, 3]);
    const hasEmpty = result.some((s) => s.length === 0);
    expect(hasEmpty).toBe(true);
  });

  it('powerset of [1,2,3] contains the full set', () => {
    const result = setPowerset([1, 2, 3]);
    const hasFull = result.some(
      (s) => s.length === 3 && s.includes(1) && s.includes(2) && s.includes(3)
    );
    expect(hasFull).toBe(true);
  });

  it('powerset of empty set is empty', () => {
    expect(setPowerset([])).toEqual([]);
  });

  it('powerset of singleton has 2 subsets (empty + full)', () => {
    const result = setPowerset([42]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([]);
    expect(result[1]).toEqual([42]);
  });

  it('powerset is ordered by subset size', () => {
    const result = setPowerset([1, 2, 3]);
    // Subsets should be sorted: 1 empty, 3 singletons, 3 pairs, 1 triple
    expect(result[0]).toHaveLength(0);
    expect(result[1]).toHaveLength(1);
    expect(result[2]).toHaveLength(1);
    expect(result[3]).toHaveLength(1);
    expect(result[4]).toHaveLength(2);
    expect(result[7]).toHaveLength(3);
  });
});

// =============================================================================
// setDistinct
// =============================================================================

describe('setDistinct', () => {
  it('removes duplicates', () => {
    const result = setDistinct([1, 1, 1, 2, 2, 3]);
    expect(result).toHaveLength(3);
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(3);
  });

  it('distinct of already-distinct set is unchanged (in length)', () => {
    const result = setDistinct([1, 2, 3]);
    expect(result).toHaveLength(3);
  });

  it('distinct of empty set is empty', () => {
    expect(setDistinct([])).toEqual([]);
  });

  it('distinct of single element', () => {
    const result = setDistinct([7]);
    expect(result).toEqual([7]);
  });
});

// =============================================================================
// setSize
// =============================================================================

describe('setSize', () => {
  it('size without unique flag counts all elements', () => {
    expect(setSize([1, 2, 2, 4])).toBe(4);
  });

  it('size with unique=true counts distinct elements', () => {
    expect(setSize([1, 2, 2, 4], true)).toBe(3);
  });

  it('size with unique=false counts all elements', () => {
    expect(setSize([1, 2, 2, 4], false)).toBe(4);
  });

  it('size of empty set is 0', () => {
    expect(setSize([])).toBe(0);
    expect(setSize([], true)).toBe(0);
  });

  it('size of nested array is based on flat length', () => {
    expect(
      setSize([
        [1, 2],
        [3, 4],
      ])
    ).toBe(4);
  });
});

// =============================================================================
// setCartesian
// =============================================================================

describe('setCartesian', () => {
  it('Cartesian product [1,2] x [3,4]', () => {
    const result = setCartesian([1, 2], [3, 4]);
    expect(result).toHaveLength(4);
    expect(result).toContainEqual([1, 3]);
    expect(result).toContainEqual([1, 4]);
    expect(result).toContainEqual([2, 3]);
    expect(result).toContainEqual([2, 4]);
  });

  it('Cartesian product with empty first set is empty', () => {
    expect(setCartesian([], [1, 2, 3])).toEqual([]);
  });

  it('Cartesian product with empty second set is empty', () => {
    expect(setCartesian([1, 2], [])).toEqual([]);
  });

  it('Cartesian product of singletons is a single pair', () => {
    const result = setCartesian([5], [10]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([5, 10]);
  });

  it('Cartesian product size is |a1| * |a2|', () => {
    const result = setCartesian([1, 2, 3], [4, 5]);
    expect(result).toHaveLength(6);
  });
});

// =============================================================================
// typedSet barrel
// =============================================================================

describe('typedSet barrel', () => {
  it('exports all 10 set functions', () => {
    expect(typeof typedSet.setUnion).toBe('function');
    expect(typeof typedSet.setIntersect).toBe('function');
    expect(typeof typedSet.setDifference).toBe('function');
    expect(typeof typedSet.setSymDifference).toBe('function');
    expect(typeof typedSet.setIsSubset).toBe('function');
    expect(typeof typedSet.setMultiplicity).toBe('function');
    expect(typeof typedSet.setPowerset).toBe('function');
    expect(typeof typedSet.setDistinct).toBe('function');
    expect(typeof typedSet.setSize).toBe('function');
    expect(typeof typedSet.setCartesian).toBe('function');
  });

  it('typedSet.setUnion is the same as named export', () => {
    expect(typedSet.setUnion).toBe(setUnion);
  });
});
