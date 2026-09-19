// Type definitions re-exported for internal use
// This file provides types needed by various source files

// Re-export from local TypeScript definitions
export type { TypedFunction } from './core/function/typed.js';
export type { MathJsConfig, ConfigOptions } from './core/config.js';
export type { MathJsInstance } from './core/create.js';

// Re-export from the types declaration file for external types
export type {
  Matrix,
  MathCollection,
  MathNumericType,
  MathScalarType,
  MathArray,
} from '../types/index.js';

// Type aliases for common types used internally
/** The BigNumber type: the local Decimal class. */
export type BigNumber = import('./type/local/Decimal.js').Decimal;
/** The Complex type from `complex.js`. */
export type Complex = import('complex.js').default;
/** The Fraction type from `fraction.js`. */
export type Fraction = import('fraction.js').default;

// Matrix-related types
/** Minimum structural type of a SparseMatrix value. */
export interface SparseMatrix {
  type: 'SparseMatrix';
  [key: string]: unknown;
}

/** Minimum structural type of a Unit value. */
export interface Unit {
  type: 'Unit';
  /** Numeric magnitude of the unit, stripped of its unit annotation. */
  toNumeric(): unknown;
  /** Render only the unit annotation (e.g. "m / s") without the value. */
  formatUnits(): string;
  [key: string]: unknown;
}

// Constructor types
/** Minimum structural type of a matrix constructor. */
export interface MatrixConstructor {
  new (...args: unknown[]): unknown;
  [key: string]: unknown;
}
