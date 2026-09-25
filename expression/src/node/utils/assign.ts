import { errorTransform } from '../../transform/utils/errorTransform.js';
import { setSafeProperty } from '../../utils/customs.js';
import { setStringSubset } from './stringSubset.js';
import type { IndexLike } from './stringSubset.js';

/**
 * Make the `assign` function that the expression nodes use to write a part of a value.
 * For an Array, `assign` copies the result of `subset` into the original array and returns that array.
 * For a Matrix, it returns the result of the `subset` method of the matrix.
 * For a string, it returns a new string. For an object, it sets the property and returns the object.
 * It throws a TypeError for a numeric index on an object and for other value types.
 * Before it throws an IndexError again, it changes the indices to one-based.
 */
export function assignFactory({ subset }: { subset: (...args: unknown[]) => unknown }) {
  /**
   * Replace part of an object:
   *
   * - Assign a property to an object
   * - Replace a part of a string
   * - Replace a matrix subset
   *
   * @param {Object | Array | Matrix | string} object
   * @param {Index} index
   * @param {*} value
   * @return {Object | Array | Matrix | string} Returns the original object
   *                                            except in case of a string
   */
  // TODO: change assign to return the value instead of the object
  return function assign(
    object: unknown,
    index: {
      isObjectProperty: () => boolean;
      getObjectProperty: () => string | null;
      isIndex?: boolean;
    } & IndexLike,
    value: unknown
  ) {
    try {
      if (Array.isArray(object)) {
        const result = subset(object, index, value) as unknown[];

        // shallow copy all (updated) items into the original array
        result.forEach((item: unknown, i: number) => {
          object[i] = item;
        });

        return object;
      } else if (object && typeof (object as { subset?: unknown }).subset === 'function') {
        // Matrix
        return (object as { subset: (...a: unknown[]) => unknown }).subset(index, value);
      } else if (typeof object === 'string') {
        return setStringSubset(object, index, String(value));
      } else if (typeof object === 'object') {
        if (!index.isObjectProperty()) {
          throw TypeError('Cannot apply a numeric index as object property');
        }
        setSafeProperty(object, index.getObjectProperty(), value);
        return object;
      } else {
        throw new TypeError('Cannot apply index: unsupported type of object');
      }
    } catch (err) {
      throw errorTransform(err);
    }
  };
}
