import { assertAllocSize } from '../../utils/limits.js';

// Recursive type for nested arrays
type NestedNumberArray = number | NestedNumberArray[];

/**
 * This is a util function for generating a random matrix recursively.
 * @param {number[]} size
 * @param {function} random
 * @returns {Array}
 */
export function randomMatrix(size: number[], random: () => number): NestedNumberArray[] {
  const dimensions = size.map((dimension) => (dimension > 0 ? Math.ceil(dimension) : 0));
  assertAllocSize('random', dimensions);
  const fill = (axis: number): NestedNumberArray[] =>
    Array.from({ length: dimensions[axis] }, () =>
      axis + 1 < dimensions.length ? fill(axis + 1) : random()
    );
  return fill(0);
}
