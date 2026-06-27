/**
 * Shared utility functions used across core utility modules.
 * This file must have ZERO imports from other core utility files
 * to serve as the base of the dependency graph and break circular imports.
 */

/**
 * A safe hasOwnProperty
 * @param {Object} object
 * @param {string} property
 */
export function hasOwnProperty(object: unknown, property: string): boolean {
  return !!object && Object.hasOwnProperty.call(object, property);
}
