/**
 * Typed Functions Index
 *
 * Re-exports all typed functions that use polymorphic dispatch
 * via @mathts/core's mathTyped system.
 *
 * @packageDocumentation
 */

// Arithmetic functions
export * from './arithmetic.js';
export { typedArithmetic } from './arithmetic.js';

// Trigonometric functions
export * from './trigonometry.js';
export { typedTrigonometry } from './trigonometry.js';

// Combined export
import { typedArithmetic } from './arithmetic.js';
import { typedTrigonometry } from './trigonometry.js';

/**
 * All typed functions combined
 */
export const typedFunctions = {
  ...typedArithmetic,
  ...typedTrigonometry,
};
