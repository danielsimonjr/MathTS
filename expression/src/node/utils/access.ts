import { errorTransform } from '../../transform/utils/errorTransform.js';
import { getSafeProperty } from '../../utils/customs.js';
import { getStringSubset } from './stringSubset.js';

export function accessFactory({ subset }: { subset: (...args: unknown[]) => unknown }) {
  /**
   * Retrieve part of an object:
   *
   * - Retrieve a property from an object
   * - Retrieve a part of a string
   * - Retrieve a matrix subset
   *
   * @param {Object | Array | Matrix | string} object
   * @param {Index} index
   * @return {Object | Array | Matrix | string} Returns the subset
   */
  return function access(
    object: unknown,
    index: { isObjectProperty: () => boolean; getObjectProperty: () => string }
  ) {
    try {
      if (Array.isArray(object)) {
        return subset(object, index);
      } else if (object && typeof (object as { subset?: unknown }).subset === 'function') {
        // Matrix
        return (object as { subset: (...a: unknown[]) => unknown }).subset(index);
      } else if (typeof object === 'string') {
        // @ts-expect-error type assertion of index object
        return getStringSubset(object, index);
      } else if (typeof object === 'object') {
        if (!index.isObjectProperty()) {
          throw new TypeError('Cannot apply a numeric index as object property');
        }

        return getSafeProperty(object, index.getObjectProperty());
      } else {
        throw new TypeError('Cannot apply index: unsupported type of object');
      }
    } catch (err) {
      throw errorTransform(err);
    }
  };
}
