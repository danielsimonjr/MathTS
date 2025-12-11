/**
 * MathTS typed-function Integration
 *
 * Creates a configured typed-function instance with MathTS types
 * for runtime type dispatch across numeric types, matrices, and more.
 *
 * @packageDocumentation
 */

import typed, { create, type TypedInstance, type TypeDef, type ConversionDef } from 'typed-function';

/**
 * MathTS Type Test Functions
 * These functions test whether a value belongs to a specific MathTS type
 */
export const isNumber = (x: unknown): x is number =>
  typeof x === 'number';

export const isBoolean = (x: unknown): x is boolean =>
  typeof x === 'boolean';

export const isString = (x: unknown): x is string =>
  typeof x === 'string';

export const isBigInt = (x: unknown): x is bigint =>
  typeof x === 'bigint';

export const isArray = (x: unknown): x is unknown[] =>
  Array.isArray(x);

export const isFunction = (x: unknown): x is (...args: unknown[]) => unknown =>
  typeof x === 'function';

export const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export const isNull = (x: unknown): x is null =>
  x === null;

export const isUndefined = (x: unknown): x is undefined =>
  x === undefined;

/**
 * Check if value is a Complex number (duck typing for now)
 * Will be updated when Complex class is implemented
 */
export const isComplex = (x: unknown): boolean =>
  isObject(x) && 're' in x && 'im' in x && typeof (x as { re: unknown }).re === 'number';

/**
 * Check if value is a Matrix (duck typing for now)
 * Will be updated when Matrix class is implemented
 */
export const isMatrix = (x: unknown): boolean =>
  isObject(x) && 'rows' in x && 'cols' in x && 'get' in x;

/**
 * Check if value is a DenseMatrix
 */
export const isDenseMatrix = (x: unknown): boolean =>
  isMatrix(x) && (x as { type?: string }).type === 'DenseMatrix';

/**
 * Check if value is a SparseMatrix
 */
export const isSparseMatrix = (x: unknown): boolean =>
  isMatrix(x) && (x as { type?: string }).type === 'SparseMatrix';

/**
 * Check if value is a Fraction (duck typing)
 */
export const isFraction = (x: unknown): boolean =>
  isObject(x) && 'n' in x && 'd' in x && typeof (x as { n: unknown }).n === 'bigint';

/**
 * Check if value is a BigNumber (duck typing for decimal.js)
 */
export const isBigNumber = (x: unknown): boolean =>
  isObject(x) && 'd' in x && 'e' in x && 's' in x;

/**
 * Check if value is a Unit
 */
export const isUnit = (x: unknown): boolean =>
  isObject(x) && 'value' in x && 'unit' in x;

/**
 * MathTS Core Type Definitions
 */
export const MATHTS_TYPES: TypeDef[] = [
  { name: 'number', test: isNumber },
  { name: 'boolean', test: isBoolean },
  { name: 'string', test: isString },
  { name: 'bigint', test: isBigInt },
  { name: 'Complex', test: isComplex },
  { name: 'Fraction', test: isFraction },
  { name: 'BigNumber', test: isBigNumber },
  { name: 'Matrix', test: isMatrix },
  { name: 'DenseMatrix', test: isDenseMatrix },
  { name: 'SparseMatrix', test: isSparseMatrix },
  { name: 'Unit', test: isUnit },
  { name: 'Array', test: isArray },
  { name: 'Function', test: isFunction },
  { name: 'Object', test: isObject },
  { name: 'null', test: isNull },
  { name: 'undefined', test: isUndefined },
];

/**
 * MathTS Type Conversions
 * These define automatic type coercions for arithmetic operations
 */
export const MATHTS_CONVERSIONS: ConversionDef[] = [
  // Number to Complex
  {
    from: 'number',
    to: 'Complex',
    convert: (n: unknown) => ({ re: n as number, im: 0 }),
  },
  // Boolean to number
  {
    from: 'boolean',
    to: 'number',
    convert: (b: unknown) => (b ? 1 : 0),
  },
  // String to number (if parseable)
  {
    from: 'string',
    to: 'number',
    convert: (s: unknown) => {
      const n = parseFloat(s as string);
      if (isNaN(n)) throw new Error(`Cannot convert "${s}" to number`);
      return n;
    },
  },
  // Number to BigNumber (placeholder)
  {
    from: 'number',
    to: 'BigNumber',
    convert: (n: unknown) => {
      // Will use Decimal.js when integrated
      return { d: [Math.abs(n as number)], e: 0, s: (n as number) >= 0 ? 1 : -1 };
    },
  },
  // Array to Matrix (placeholder)
  {
    from: 'Array',
    to: 'Matrix',
    convert: (a: unknown) => {
      const arr = a as number[][];
      // Will use Matrix.from() when Matrix is implemented
      return {
        rows: arr.length,
        cols: arr[0]?.length ?? 0,
        data: arr.flat(),
        type: 'DenseMatrix',
        get: (r: number, c: number) => arr[r]?.[c],
      };
    },
  },
  // Matrix to Array
  {
    from: 'Matrix',
    to: 'Array',
    convert: (m: unknown) => {
      const matrix = m as { rows: number; cols: number; get: (r: number, c: number) => number };
      const result: number[][] = [];
      for (let i = 0; i < matrix.rows; i++) {
        result[i] = [];
        for (let j = 0; j < matrix.cols; j++) {
          result[i][j] = matrix.get(i, j);
        }
      }
      return result;
    },
  },
  // DenseMatrix to SparseMatrix
  {
    from: 'DenseMatrix',
    to: 'SparseMatrix',
    convert: (m: unknown) => {
      // Placeholder - will implement proper conversion
      return { ...(m as object), type: 'SparseMatrix' };
    },
  },
];

/**
 * Create a new MathTS typed instance
 *
 * This creates an isolated typed universe with MathTS types and conversions.
 * Use this for custom configurations or testing.
 *
 * @returns A new typed-function instance configured for MathTS
 *
 * @example
 * ```typescript
 * const myTyped = createMathTSTyped();
 *
 * const add = myTyped('add', {
 *   'number, number': (a, b) => a + b,
 *   'Complex, Complex': (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
 * });
 * ```
 */
export function createMathTSTyped(): TypedInstance {
  const instance = create();

  // Add MathTS types
  instance.addTypes(MATHTS_TYPES, 'any');

  // Add MathTS conversions
  instance.addConversions(MATHTS_CONVERSIONS);

  return instance;
}

/**
 * Default MathTS typed instance
 *
 * This is the primary typed-function instance used throughout MathTS.
 * It comes pre-configured with all MathTS types and conversions.
 *
 * @example
 * ```typescript
 * import { mathTyped } from '@mathts/core';
 *
 * const multiply = mathTyped('multiply', {
 *   'number, number': (a, b) => a * b,
 *   'Matrix, Matrix': (a, b) => matmul(a, b),
 *   'Matrix, number': (m, s) => scale(m, s),
 * });
 * ```
 */
export const mathTyped = createMathTSTyped();

// Re-export typed-function utilities for convenience
export { typed, create };
export type { TypedInstance, TypeDef, ConversionDef };
