/**
 * Typed Set Functions
 *
 * Polymorphic set (multiset) operations using typed-function for runtime dispatch.
 * Supports `Array` inputs; Matrix inputs are treated as flat arrays.
 *
 * All operations follow the mathjs convention:
 *   - Multi-dimension arrays are flattened before the operation.
 *   - Set operations respect multiplicity (multiset semantics), matching
 *     the mathjs `setUnion`, `setIntersect`, etc. behaviour.
 *   - The "natural" comparison used for identity is strict equality (`===`)
 *     for primitives and structural for objects (via JSON-stable stringify),
 *     matching the relevant subset of mathjs's `compareNatural`.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';

// =============================================================================
// Internal helpers
// =============================================================================

/** Flatten a nested array into a one-dimensional array. */
function flattenArray(arr: unknown[]): unknown[] {
  const result: unknown[] = [];
  const stack = [...arr];
  while (stack.length > 0) {
    const item = stack.shift()!;
    if (Array.isArray(item)) {
      stack.unshift(...item);
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Convert a value that may be either a plain `Array` or a mathjs-style `Matrix`
 * (duck-typed: has a `.toArray()` method) into a flat JS array.
 */
function toFlatArray(a: unknown): unknown[] {
  if (Array.isArray(a)) return flattenArray(a);
  // Duck-typed Matrix: has a toArray() method
  if (
    typeof a === 'object' &&
    a !== null &&
    typeof (a as { toArray?: unknown }).toArray === 'function'
  ) {
    return flattenArray((a as { toArray: () => unknown[] }).toArray());
  }
  return [a];
}

/**
 * Natural comparison for set element identity.
 * Returns negative, zero, or positive like `Array.prototype.sort` comparators.
 * Handles numbers, strings, bigints, and objects (via JSON stringify).
 */
function naturalCompare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }
  // Complex / BigNumber / other objects: compare by stringified representation
  const sa = JSON.stringify(a) ?? String(a);
  const sb = JSON.stringify(b) ?? String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Identifier-aware element record (mirrors mathjs `identify` semantics).
 * Each element in a multiset gets a monotonic identifier so that
 * duplicates can be counted independently.
 */
interface Identified {
  value: unknown;
  identifier: number;
}

/**
 * Assign sequential identifiers to duplicate values so that multiplicity
 * can be tracked during intersection / difference.
 *
 * Input must already be sorted by `naturalCompare`.
 */
function identify(sorted: unknown[]): Identified[] {
  const result: Identified[] = [];
  let counter = 0;
  let prev: unknown = Symbol('sentinel'); // guaranteed !== any real value
  for (const v of sorted) {
    if (naturalCompare(v, prev) === 0) {
      counter++;
    } else {
      counter = 0;
      prev = v;
    }
    result.push({ value: v, identifier: counter });
  }
  return result;
}

// =============================================================================
// setUnion — union of two multisets
// =============================================================================

/**
 * Create the union of two (multi)sets.
 * Multi-dimension arrays will be flattened before the operation.
 *
 * Union = symDifference ∪ intersection (elements from both sets, respecting multiplicity).
 *
 * @example
 * ```typescript
 * setUnion([1, 2, 3, 4], [3, 4, 5, 6])  // [1, 2, 3, 4, 5, 6]
 * setUnion([1, 2, 2], [2, 3])            // [1, 2, 2, 3]
 * ```
 */
export const setUnion = mathTyped('setUnion', {
  'Array, Array': (a1: unknown[], a2: unknown[]): unknown[] => {
    const b1 = toFlatArray(a1);
    const b2 = toFlatArray(a2);
    if (b1.length === 0) return b2;
    if (b2.length === 0) return b1;
    // Union = setSymDifference(b1,b2) concat setIntersect(b1,b2)
    const diff1 = _difference(b1, b2);
    const diff2 = _difference(b2, b1);
    const inter = _intersect(b1, b2);
    return [...diff1, ...inter, ...diff2];
  },
});

// =============================================================================
// setIntersect — intersection of two multisets
// =============================================================================

/**
 * Create the intersection of two (multi)sets.
 * Multi-dimension arrays will be flattened before the operation.
 *
 * @example
 * ```typescript
 * setIntersect([1, 2, 3, 4], [3, 4, 5, 6])  // [3, 4]
 * setIntersect([1, 2, 2], [2, 2, 3])         // [2, 2]
 * ```
 */
export const setIntersect = mathTyped('setIntersect', {
  'Array, Array': (a1: unknown[], a2: unknown[]): unknown[] => {
    const b1 = toFlatArray(a1);
    const b2 = toFlatArray(a2);
    if (b1.length === 0 || b2.length === 0) return [];
    return _intersect(b1, b2);
  },
});

// =============================================================================
// setDifference — set difference (a1 minus a2)
// =============================================================================

/**
 * Create the difference of two (multi)sets: elements of a1 not in a2.
 * Multi-dimension arrays will be flattened before the operation.
 *
 * @example
 * ```typescript
 * setDifference([1, 2, 3, 4], [3, 4, 5, 6])  // [1, 2]
 * setDifference([1, 2, 2], [2])               // [1, 2]
 * ```
 */
export const setDifference = mathTyped('setDifference', {
  'Array, Array': (a1: unknown[], a2: unknown[]): unknown[] => {
    const b1 = toFlatArray(a1);
    const b2 = toFlatArray(a2);
    if (b1.length === 0) return [];
    if (b2.length === 0) return b1;
    return _difference(b1, b2);
  },
});

// =============================================================================
// setSymDifference — symmetric difference
// =============================================================================

/**
 * Create the symmetric difference of two (multi)sets.
 * Multi-dimension arrays will be flattened before the operation.
 *
 * @example
 * ```typescript
 * setSymDifference([1, 2, 3, 4], [3, 4, 5, 6])  // [1, 2, 5, 6]
 * ```
 */
export const setSymDifference = mathTyped('setSymDifference', {
  'Array, Array': (a1: unknown[], a2: unknown[]): unknown[] => {
    const b1 = toFlatArray(a1);
    const b2 = toFlatArray(a2);
    if (b1.length === 0) return b2;
    if (b2.length === 0) return b1;
    return [..._difference(b1, b2), ..._difference(b2, b1)];
  },
});

// =============================================================================
// setIsSubset — subset test
// =============================================================================

/**
 * Check whether a (multi)set is a subset of another (multi)set.
 * Every element of a1 (with multiplicity) must appear in a2.
 *
 * @example
 * ```typescript
 * setIsSubset([1, 2], [1, 2, 3])  // true
 * setIsSubset([1, 4], [1, 2, 3])  // false
 * setIsSubset([], [1, 2])         // true
 * ```
 */
export const setIsSubset = mathTyped('setIsSubset', {
  'Array, Array': (a1: unknown[], a2: unknown[]): boolean => {
    const b1 = toFlatArray(a1);
    const b2 = toFlatArray(a2);
    if (b1.length === 0) return true;
    if (b2.length === 0) return false;
    const id1 = identify(b1.slice().sort(naturalCompare));
    const id2 = identify(b2.slice().sort(naturalCompare));
    for (const elem of id1) {
      const found = id2.some(
        (e) => naturalCompare(e.value, elem.value) === 0 && e.identifier === elem.identifier
      );
      if (!found) return false;
    }
    return true;
  },
});

// =============================================================================
// setMultiplicity — count occurrences of element in multiset
// =============================================================================

/**
 * Count how many times a value appears in a multiset.
 *
 * @example
 * ```typescript
 * setMultiplicity(2, [1, 2, 2, 4])  // 2
 * setMultiplicity(1, [1, 2, 2, 4])  // 1
 * setMultiplicity(5, [1, 2, 2, 4])  // 0
 * ```
 */
export const setMultiplicity = mathTyped('setMultiplicity', {
  'any, Array': (e: unknown, a: unknown[]): number => {
    const b = toFlatArray(a);
    if (b.length === 0) return 0;
    let count = 0;
    for (const item of b) {
      if (naturalCompare(item, e) === 0) count++;
    }
    return count;
  },
});

// =============================================================================
// setPowerset — all subsets of a set
// =============================================================================

/**
 * Create the powerset of a (multi)set.
 * Returns all possible subsets ordered by size, then lexicographically.
 * A multi-dimension array will be flattened before the operation.
 *
 * @example
 * ```typescript
 * setPowerset([1, 2, 3])
 * // [[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]
 * ```
 */
export const setPowerset = mathTyped('setPowerset', {
  Array: (a: unknown[]): unknown[][] => {
    const b = toFlatArray(a).sort(naturalCompare);
    if (b.length === 0) return [];
    const result: unknown[][] = [];
    const total = 1 << b.length; // 2^n subsets
    for (let mask = 0; mask < total; mask++) {
      const subset: unknown[] = [];
      for (let i = 0; i < b.length; i++) {
        if (mask & (1 << i)) {
          subset.push(b[i]);
        }
      }
      result.push(subset);
    }
    // Sort by subset size (stable — insertion order within same size is preserved)
    result.sort((x, y) => x.length - y.length);
    return result;
  },
});

// =============================================================================
// setDistinct — deduplicate a multiset
// =============================================================================

/**
 * Collect the distinct elements of a multiset.
 * A multi-dimension array will be flattened before the operation.
 *
 * @example
 * ```typescript
 * setDistinct([1, 1, 1, 2, 2, 3])  // [1, 2, 3]
 * ```
 */
export const setDistinct = mathTyped('setDistinct', {
  Array: (a: unknown[]): unknown[] => {
    const b = toFlatArray(a).sort(naturalCompare);
    if (b.length === 0) return [];
    const result: unknown[] = [b[0]];
    for (let i = 1; i < b.length; i++) {
      if (naturalCompare(b[i], b[i - 1]) !== 0) {
        result.push(b[i]);
      }
    }
    return result;
  },
});

// =============================================================================
// setSize — count elements in a multiset
// =============================================================================

/**
 * Count the number of elements of a (multi)set.
 * When the second argument is `true`, count only unique values.
 * A multi-dimension array will be flattened before the operation.
 *
 * @example
 * ```typescript
 * setSize([1, 2, 2, 4])         // 4
 * setSize([1, 2, 2, 4], true)   // 3
 * ```
 */
export const setSize = mathTyped('setSize', {
  Array: (a: unknown[]): number => toFlatArray(a).length,

  'Array, boolean': (a: unknown[], unique: boolean): number => {
    const b = toFlatArray(a);
    if (!unique || b.length === 0) return b.length;
    const sorted = b.slice().sort(naturalCompare);
    let count = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (naturalCompare(sorted[i], sorted[i - 1]) !== 0) count++;
    }
    return count;
  },
});

// =============================================================================
// setCartesian — Cartesian product of two sets
// =============================================================================

/**
 * Create the Cartesian product of two (multi)sets.
 * Multi-dimension arrays will be flattened and values will be sorted before the operation.
 *
 * @example
 * ```typescript
 * setCartesian([1, 2], [3, 4])
 * // [[1, 3], [1, 4], [2, 3], [2, 4]]
 * ```
 */
export const setCartesian = mathTyped('setCartesian', {
  'Array, Array': (a1: unknown[], a2: unknown[]): unknown[][] => {
    const b1 = toFlatArray(a1).sort(naturalCompare);
    const b2 = toFlatArray(a2).sort(naturalCompare);
    if (b1.length === 0 || b2.length === 0) return [];
    const result: unknown[][] = [];
    for (const x of b1) {
      for (const y of b2) {
        result.push([x, y]);
      }
    }
    return result;
  },
});

// =============================================================================
// Private implementation helpers (not exported)
// =============================================================================

/**
 * Compute the intersection of two flat arrays using identifier-based multiplicity tracking.
 */
function _intersect(b1: unknown[], b2: unknown[]): unknown[] {
  const id1 = identify(b1.slice().sort(naturalCompare));
  const id2 = identify(b2.slice().sort(naturalCompare));
  const result: unknown[] = [];
  for (const elem of id1) {
    const found = id2.some(
      (e) => naturalCompare(e.value, elem.value) === 0 && e.identifier === elem.identifier
    );
    if (found) result.push(elem.value);
  }
  return result;
}

/**
 * Compute the difference of two flat arrays (b1 minus b2) using identifier-based multiplicity.
 */
function _difference(b1: unknown[], b2: unknown[]): unknown[] {
  const id1 = identify(b1.slice().sort(naturalCompare));
  const id2 = identify(b2.slice().sort(naturalCompare));
  const result: unknown[] = [];
  for (const elem of id1) {
    const found = id2.some(
      (e) => naturalCompare(e.value, elem.value) === 0 && e.identifier === elem.identifier
    );
    if (!found) result.push(elem.value);
  }
  return result;
}

// =============================================================================
// Barrel export
// =============================================================================

/**
 * All typed set functions.
 */
export const typedSet = {
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
};
