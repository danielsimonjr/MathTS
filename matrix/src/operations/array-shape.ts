import { validate } from '@danielsimonjr/mathts-core/internal';

/**
 * Read all dimensions of a rectangular nested array.
 *
 * @param array - The array to measure.
 * @returns One size per nesting level, including the first zero-length dimension.
 */
export function rectangularArraySize(array: unknown[]): number[] {
  const shape: number[] = [];
  const firstPath = new Set<unknown[]>();
  let current: unknown = array;
  while (Array.isArray(current)) {
    if (firstPath.has(current)) throw new TypeError('Cannot measure a cyclic nested array');
    firstPath.add(current);
    shape.push(current.length);
    current = current[0];
  }
  validate(array, shape);
  return shape;
}
