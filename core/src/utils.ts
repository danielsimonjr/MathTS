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
 * Check if a value is "complex-like": a plain object exposing numeric `re`/`im`
 * properties (structural duck-typing).
 *
 * NOTE: This is deliberately NOT named `isComplex`. The canonical, exported
 * `isComplex` (`@danielsimonjr/mathts-core`, from `types/complex.ts`) is an
 * `instanceof Complex` check and rejects plain `{ re, im }` objects. Keeping a
 * second `isComplex` with different semantics here would let a caller silently
 * pick the wrong guard, so this structural variant carries a distinct name.
 */
export function isComplexLike(value: unknown): value is ComplexNumber {
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
 * Check if a value is a 2D numeric array (a "matrix" in nested-array form).
 *
 * NOTE: This is deliberately NOT named `isMatrix`. The canonical, exported
 * `isMatrix` (`@danielsimonjr/mathts-core`) duck-types a Matrix *object*
 * (`rows`/`cols`/`get`/`type`) and returns `false` for a `number[][]`. The two
 * checks are genuinely different predicates, so this array form carries a
 * distinct name to avoid a same-name guard that disagrees at runtime.
 */
export function isMatrixArray(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    Array.isArray(value[0]) &&
    value.every((row) => Array.isArray(row) && row.every(isNumeric))
  );
}
