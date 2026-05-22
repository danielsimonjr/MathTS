/**
 * Local implementations of external numeric libraries.
 *
 * These replace the external dependencies:
 * - decimal.js -> Decimal
 * - complex.js -> Complex
 * - fraction.js -> Fraction
 */

export { Decimal, type DecimalConfig } from './Decimal.js';
export { Complex, type ComplexJSON, type PolarForm, type ComplexLike } from './Complex.js';
export { Fraction, type FractionJSON, type FractionLike } from './Fraction.js';

// Re-export as default classes for drop-in replacement
export { Decimal as default } from './Decimal.js';
