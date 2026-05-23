/**
 * Utility functions for MathTS
 */

import type { ComplexNumber } from './types';

/**
 * Check if a value is a numeric type
 */
export function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if a value is a complex number
 */
export function isComplex(value: unknown): value is ComplexNumber {
  return (
    typeof value === 'object' &&
    value !== null &&
    're' in value &&
    'im' in value &&
    typeof (value as ComplexNumber).re === 'number' &&
    typeof (value as ComplexNumber).im === 'number'
  );
}

/**
 * Check if a value is a matrix (2D array)
 */
export function isMatrix(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    Array.isArray(value[0]) &&
    value.every((row) => Array.isArray(row) && row.every(isNumeric))
  );
}
