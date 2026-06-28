import { hasOwnProperty } from './object.js';

/**
 * Get a property of a plain object
 * Throws an error in case the object is not a plain object or the
 * property is not defined on the object itself
 * @param {Object} object
 * @param {string} prop
 * @return {*} Returns the property value when safe
 */
function getSafeProperty(object: unknown, prop: unknown): unknown {
  // only allow getting safe properties of a plain object
  if (isSafeProperty(object, prop)) {
    return (object as Record<string, unknown>)[prop as string];
  }

  if (
    typeof (object as Record<string, unknown>)[prop as string] === 'function' &&
    isSafeMethod(object, prop)
  ) {
    throw new Error('Cannot access method "' + String(prop) + '" as a property');
  }

  throw new Error('No access to property "' + String(prop) + '"');
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
// TODO: merge this function into access.js?
function setSafeProperty(object: unknown, prop: unknown, value: unknown): unknown {
  // only allow setting safe properties of a plain object
  if (isSafeProperty(object, prop)) {
    (object as Record<string, unknown>)[prop as string] = value;
    return value;
  }

  throw new Error('No access to property "' + String(prop) + '"');
}

/**
 * Test whether a property is safe to use on an object or Array.
 * For example .toString and .constructor are not safe
 * @param {Object | Array} object
 * @param {string} prop
 * @return {boolean} Returns true when safe
 */
function isSafeProperty(object: unknown, prop: unknown): boolean {
  if (!isPlainObject(object) && !Array.isArray(object)) {
    return false;
  }
  // SAFE: whitelisted
  // e.g length
  if (hasOwnProperty(safeNativeProperties, prop as string)) {
    return true;
  }
  // UNSAFE: inherited from Object prototype
  // e.g constructor
  if ((prop as string) in Object.prototype) {
    // 'in' is used instead of hasOwnProperty for nodejs v0.10
    // which is inconsistent on root prototypes. It is safe
    // here because Object.prototype is a root object
    return false;
  }
  // UNSAFE: inherited from Function prototype
  // e.g call, apply
  if ((prop as string) in Function.prototype) {
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
function getSafeMethod(object: unknown, method: unknown): unknown {
  if (!isSafeMethod(object, method)) {
    throw new Error('No access to method "' + String(method) + '"');
  }

  return (object as Record<string, unknown>)[method as string];
}

/**
 * Check whether a method is safe.
 * Throws an error when that's not the case (for example for `constructor`).
 * @param {Object} object
 * @param {string} method
 * @return {boolean} Returns true when safe, false otherwise
 */
function isSafeMethod(object: unknown, method: unknown): boolean {
  if (
    object === null ||
    object === undefined ||
    typeof (object as Record<string, unknown>)[method as string] !== 'function'
  ) {
    return false;
  }
  // UNSAFE: ghosted
  // e.g overridden toString
  // Note that IE10 doesn't support __proto__ and we can't do this check there.
  if (
    hasOwnProperty(object, method as string) &&
    Object.getPrototypeOf &&
    (method as string) in Object.getPrototypeOf(object)
  ) {
    return false;
  }
  // SAFE: whitelisted
  // e.g toString
  if (hasOwnProperty(safeNativeMethods, method as string)) {
    return true;
  }
  // UNSAFE: inherited from Object prototype
  // e.g constructor
  if ((method as string) in Object.prototype) {
    // 'in' is used instead of hasOwnProperty for nodejs v0.10
    // which is inconsistent on root prototypes. It is safe
    // here because Object.prototype is a root object
    return false;
  }
  // UNSAFE: inherited from Function prototype
  // e.g call, apply
  if ((method as string) in Function.prototype) {
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

export { getSafeProperty };
export { setSafeProperty };
export { isSafeProperty };
export { getSafeMethod };
export { isSafeMethod };
export { isPlainObject };
