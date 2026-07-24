/**
 * NOT the security-invariant sandbox file. `expression/src/utils/customs.ts` and
 * `functions/src/utils/customs.ts` remain the packages' own canonical copies and
 * ARE the ones the security invariant in the repo's CLAUDE.md governs ("Any
 * property/method access in expression/src/ must route through getSafeProperty/
 * setSafeProperty/getSafeMethod from expression/src/utils/customs.ts") — this
 * copy is a byte-behavior-identical mirror (verified equivalent via the
 * fast-check harness, see `functions/tests/dedup-bucketB-equivalence.test.ts`),
 * scoped ONLY to satisfy `core/src/map.ts`'s `ObjectWrappingMap`, which needs
 * these three functions to relocate to core along with the class. Not
 * re-exported from `internal.ts`; not part of this slice's public dedup surface.
 */
import { hasOwnProperty } from './shared.js';

/**
 * Get a property of a plain object
 * Throws an error in case the object is not a plain object or the
 * property is not defined on the object itself
 * @param {Object} object
 * @param {string} prop
 * @return {*} Returns the property value when safe
 */
export function getSafeProperty(object: unknown, prop: string): unknown {
  const obj = object as Record<string, unknown>;
  // only allow getting safe properties of a plain object
  if (isSafeProperty(object, prop)) {
    return obj[prop];
  }

  if (typeof obj[prop] === 'function' && isSafeMethod(object, prop)) {
    throw new Error('Cannot access method "' + prop + '" as a property');
  }

  throw new Error('No access to property "' + prop + '"');
}

/**
 * Set a property on a plain object.
 * Throws an error in case the object is not a plain object or the
 * property would override an inherited property like .constructor or .toString
 * @param {Object} object
 * @param {string} prop
 * @param {*} value
 * @return {*} Returns the value
 */
export function setSafeProperty(object: unknown, prop: string, value: unknown): unknown {
  // only allow setting safe properties of a plain object
  if (isSafeProperty(object, prop)) {
    (object as Record<string, unknown>)[prop] = value;
    return value;
  }

  throw new Error('No access to property "' + prop + '"');
}

/**
 * Test whether a property is safe to use on an object or Array.
 * For example .toString and .constructor are not safe
 * @param {Object | Array} object
 * @param {string} prop
 * @return {boolean} Returns true when safe
 */
export function isSafeProperty(object: unknown, prop: string): boolean {
  if (!isPlainObject(object) && !Array.isArray(object)) {
    return false;
  }
  // SAFE: whitelisted
  // e.g length
  if (hasOwnProperty(safeNativeProperties, prop)) {
    return true;
  }
  // UNSAFE: inherited from Object prototype
  // e.g constructor
  if (prop in Object.prototype) {
    // 'in' is used instead of hasOwnProperty for nodejs v0.10
    // which is inconsistent on root prototypes. It is safe
    // here because Object.prototype is a root object
    return false;
  }
  // UNSAFE: inherited from Function prototype
  // e.g call, apply
  if (prop in Function.prototype) {
    // 'in' is used instead of hasOwnProperty for nodejs v0.10
    // which is inconsistent on root prototypes. It is safe
    // here because Function.prototype is a root object
    return false;
  }
  return true;
}

/**
 * Validate whether a method is safe.
 * Throws an error when that's not the case.
 * @param {Object} object
 * @param {string} method
 * @return {function} Returns the method when valid
 */
export function getSafeMethod(object: unknown, method: string): unknown {
  if (!isSafeMethod(object, method)) {
    throw new Error('No access to method "' + method + '"');
  }

  return (object as Record<string, unknown>)[method];
}

/**
 * Check whether a method is safe.
 * Throws an error when that's not the case (for example for `constructor`).
 * @param {Object} object
 * @param {string} method
 * @return {boolean} Returns true when safe, false otherwise
 */
export function isSafeMethod(object: unknown, method: string): boolean {
  if (
    object === null ||
    object === undefined ||
    typeof (object as Record<string, unknown>)[method] !== 'function'
  ) {
    return false;
  }
  // UNSAFE: ghosted
  // e.g overridden toString
  // Note that IE10 doesn't support __proto__ and we can't do this check there.
  if (
    hasOwnProperty(object, method) &&
    Object.getPrototypeOf &&
    method in Object.getPrototypeOf(object)
  ) {
    return false;
  }
  // SAFE: whitelisted
  // e.g toString
  if (hasOwnProperty(safeNativeMethods, method)) {
    return true;
  }
  // UNSAFE: inherited from Object prototype
  // e.g constructor
  if (method in Object.prototype) {
    // 'in' is used instead of hasOwnProperty for nodejs v0.10
    // which is inconsistent on root prototypes. It is safe
    // here because Object.prototype is a root object
    return false;
  }
  // UNSAFE: inherited from Function prototype
  // e.g call, apply
  if (method in Function.prototype) {
    // 'in' is used instead of hasOwnProperty for nodejs v0.10
    // which is inconsistent on root prototypes. It is safe
    // here because Function.prototype is a root object
    return false;
  }
  return true;
}

function isPlainObject(object: unknown): boolean {
  return (
    typeof object === 'object' &&
    !!object &&
    (object as { constructor?: unknown }).constructor === Object
  );
}

const safeNativeProperties = {
  length: true,
  name: true,
};

const safeNativeMethods = {
  toString: true,
  valueOf: true,
  toLocaleString: true,
};
