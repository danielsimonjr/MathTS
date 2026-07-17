/**
 * Typed String Formatting Functions
 *
 * Polymorphic string-formatting operations using typed-function for runtime dispatch.
 * Supports `number`, `BigNumber`, and `string` types as appropriate for each op.
 *
 * These are clean implementations using mathTyped dispatch — the activated
 * mathjs-derived layer under functions/src/string/ is left untouched here
 * and used only as an algorithm reference.
 *
 * Semantics follow the mathjs convention:
 *   - bin/hex/oct: sign-magnitude representation for negative numbers (NOT two's-complement),
 *     e.g. bin(-5) === '-0b101', hex(-5) === '-0x5'.
 *     (Two's-complement only applies when the optional wordSize argument is used.)
 *   - format: delegates to utils/string.ts `format()` which dispatches on number vs
 *     BigNumber, with full options-object support (notation, precision, lowerExp, upperExp, etc.)
 *   - print: replaces $key / $key.nested placeholders in a template string using
 *     values from a supplied object or array.
 *
 * @packageDocumentation
 */

import { mathTyped, BigNumber } from '@danielsimonjr/mathts-core';
import { format as formatValue } from '../utils/string.js';
import { isString } from '../utils/is.js';
import { printTemplate } from '../utils/print.js';

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Core binary formatting for a plain JS number.
 * Sign-magnitude: negative numbers get a leading '-', then the prefix, then absolute value.
 * wordSize triggers two's-complement signed integer mode (with size suffix).
 */
function numberToBase(n: number, base: 2 | 8 | 16, wordSize?: number): string {
  const prefixes: Record<number, string> = { 2: '0b', 8: '0o', 16: '0x' };
  const prefix = prefixes[base];

  if (wordSize !== undefined) {
    // Two's-complement signed integer formatting
    if (wordSize < 1 || !Number.isInteger(wordSize)) {
      throw new Error('wordSize must be a positive integer');
    }
    if (!Number.isInteger(n)) {
      throw new Error('Value must be an integer');
    }
    const max = 2 ** (wordSize - 1) - 1;
    const min = -(2 ** (wordSize - 1));
    if (n > max || n < min) {
      throw new Error(`Value must be in range [-2^${wordSize - 1}, 2^${wordSize - 1}-1]`);
    }
    const unsigned = n < 0 ? n + 2 ** wordSize : n;
    return `${prefix}${unsigned.toString(base)}i${wordSize}`;
  }

  // Sign-magnitude (default, no wordSize)
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${prefix}${abs.toString(base)}`;
}

/**
 * Core binary formatting for a BigNumber.
 * Converts to a JS number via toNumber() and delegates to numberToBase.
 * This is safe for integers that fit within Number.MAX_SAFE_INTEGER.
 * For very large integers the BigNumber is verified to be integral first.
 */
function bigNumberToBase(bn: BigNumber, base: 2 | 8 | 16, wordSize?: number): string {
  if (!(bn as unknown as { isInteger: () => boolean }).isInteger()) {
    throw new Error('Value must be an integer');
  }
  const n = bn.toNumber();
  return numberToBase(n, base, wordSize);
}

/**
 * Template interpolation for print.
 * Supports $key and $key.nested.path lookups.
 * Non-string values are formatted via formatValue.
 */
type PrintValues = Record<string, unknown> | unknown[];

function interpolate(
  template: string,
  values: PrintValues,
  options?: number | Record<string, unknown>
): string {
  return template.replace(printTemplate, function (original: string, key: string): string {
    const keys = key.split('.');
    let value: unknown = (values as Record<string, unknown>)[keys.shift()!];
    // Handle Matrix-like objects
    if (value !== undefined && (value as { isMatrix?: boolean }).isMatrix) {
      value = (value as { toArray: () => unknown[] }).toArray();
    }
    // Walk nested path
    while (keys.length && value !== undefined) {
      const k = keys.shift();
      value = k ? (value as Record<string, unknown>)[k] : (value as string) + '.';
    }

    if (value !== undefined) {
      if (!isString(value)) {
        return formatValue(value, options) as string;
      } else {
        return value as string;
      }
    }

    return original;
  });
}

// =============================================================================
// bin — format a number as binary (prefix '0b')
// =============================================================================

/**
 * Format a number as binary.
 *
 * Negative numbers use sign-magnitude notation (e.g. -5 → '-0b101').
 * When the optional `wordSize` argument is supplied the value is
 * formatted as a signed two's-complement integer of that many bits
 * and a size suffix ('i<wordSize>') is appended.
 *
 * @example
 * ```typescript
 * bin(2)     // '0b10'
 * bin(255)   // '0b11111111'
 * bin(-5)    // '-0b101'
 * bin(0)     // '0b0'
 * ```
 */
export const bin = mathTyped('bin', {
  number: (x: number): string => numberToBase(x, 2),

  'number, number': (x: number, wordSize: number): string => numberToBase(x, 2, wordSize),

  BigNumber: (x: BigNumber): string => bigNumberToBase(x, 2),

  'BigNumber, number': (x: BigNumber, wordSize: number): string => bigNumberToBase(x, 2, wordSize),
});

// =============================================================================
// hex — format a number as hexadecimal (prefix '0x')
// =============================================================================

/**
 * Format a number as hexadecimal.
 *
 * Negative numbers use sign-magnitude notation (e.g. -5 → '-0x5').
 * When the optional `wordSize` argument is supplied the value is
 * formatted as a signed two's-complement integer of that many bits.
 *
 * @example
 * ```typescript
 * hex(255)   // '0xff'
 * hex(-5)    // '-0x5'
 * hex(0)     // '0x0'
 * ```
 */
export const hex = mathTyped('hex', {
  number: (x: number): string => numberToBase(x, 16),

  'number, number': (x: number, wordSize: number): string => numberToBase(x, 16, wordSize),

  BigNumber: (x: BigNumber): string => bigNumberToBase(x, 16),

  'BigNumber, number': (x: BigNumber, wordSize: number): string => bigNumberToBase(x, 16, wordSize),
});

// =============================================================================
// oct — format a number as octal (prefix '0o')
// =============================================================================

/**
 * Format a number as octal.
 *
 * Negative numbers use sign-magnitude notation (e.g. -8 → '-0o10').
 * When the optional `wordSize` argument is supplied the value is
 * formatted as a signed two's-complement integer of that many bits.
 *
 * @example
 * ```typescript
 * oct(8)     // '0o10'
 * oct(-8)    // '-0o10'
 * oct(0)     // '0o0'
 * ```
 */
export const oct = mathTyped('oct', {
  number: (x: number): string => numberToBase(x, 8),

  'number, number': (x: number, wordSize: number): string => numberToBase(x, 8, wordSize),

  BigNumber: (x: BigNumber): string => bigNumberToBase(x, 8),

  'BigNumber, number': (x: BigNumber, wordSize: number): string => bigNumberToBase(x, 8, wordSize),
});

// =============================================================================
// format — polymorphic value-to-string formatter
// =============================================================================

/**
 * Format a value of any type into a string.
 *
 * When called with a plain number or BigNumber it delegates to the lower-level
 * `utils/string.ts` formatter which supports the full options object:
 * `{ notation, precision, lowerExp, upperExp, fraction, truncate }`.
 *
 * Passing a positional number as the second argument is shorthand for
 * `{ precision: n }`.
 *
 * @example
 * ```typescript
 * format(3.14159, 3)                          // '3.14'
 * format(0.0001, { precision: 2 })            // '1e-4'
 * format(12400, { notation: 'engineering' })  // '12.4e+3'
 * format(Infinity)                            // 'Infinity'
 * format(NaN)                                 // 'NaN'
 * ```
 */
export const format = mathTyped('format', {
  // Single-arg: format with defaults. For BigNumber, utils/string isBigNumber check
  // may fail (core BigNumber uses .isBigNumber property but not on prototype), so
  // we intercept BigNumber explicitly before delegating to formatValue.
  any: (x: unknown): string => {
    if (x instanceof BigNumber) {
      const bn = x as unknown as {
        isNaN: () => boolean;
        isFinite: () => boolean;
        isNegative: () => boolean;
        toString: () => string;
      };
      if (bn.isNaN()) return 'NaN';
      if (!bn.isFinite()) return bn.isNegative() ? '-Infinity' : 'Infinity';
      return bn.toString();
    }
    return formatValue(x, undefined);
  },

  // Two-arg: format with options/precision. For BigNumber+number we use toPrecision
  // directly; for everything else we delegate to formatValue.
  'any, any': (x: unknown, options: unknown): string => {
    if (x instanceof BigNumber) {
      const bn = x as unknown as {
        isNaN: () => boolean;
        isFinite: () => boolean;
        isNegative: () => boolean;
        toPrecision: (p: number) => string;
        toString: () => string;
      };
      if (bn.isNaN()) return 'NaN';
      if (!bn.isFinite()) return bn.isNegative() ? '-Infinity' : 'Infinity';
      if (typeof options === 'number') {
        return bn.toPrecision(options);
      }
      // For options-object, fall through to formatValue which handles the BigNumber methods
      // that DO exist (toFixed, toExponential, toPrecision, toSignificantDigits).
      return formatValue(x, options);
    }
    return formatValue(x, options);
  },
});

// =============================================================================
// print — string template interpolation
// =============================================================================

/**
 * Interpolate values into a string template.
 *
 * Placeholders have the form `$key` or `$key.nested`. Array indices are
 * accessed as `$0`, `$1`, etc. Non-string values are converted using `format`.
 *
 * @example
 * ```typescript
 * print('Hello $name!', { name: 'World' })          // 'Hello World!'
 * print('Lucy is $age years old', { age: 5 })       // 'Lucy is 5 years old'
 * print('$0 and $1', ['apples', 'bananas'])          // 'apples and bananas'
 * print('pi ≈ $pi', { pi: Math.PI }, 4)              // 'pi ≈ 3.142'
 * ```
 */
export const print = mathTyped('print', {
  'string, Object | Array': (template: string, values: PrintValues): string =>
    interpolate(template, values),

  'string, Object | Array, number | Object': (
    template: string,
    values: PrintValues,
    options: number | Record<string, unknown>
  ): string => interpolate(template, values, options),
});

// =============================================================================
// Barrel export
// =============================================================================

/**
 * All typed string-formatting functions.
 */
export const typedString = {
  bin,
  hex,
  oct,
  format,
  print,
};
