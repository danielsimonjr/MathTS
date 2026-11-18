/**
 * BigNumber (arbitrary precision decimal) implementation
 * @module @danielsimonjr/mathts-core/types/bignumber
 */

import type { Scalar, MathTSValue } from './interfaces.js';
import { BIGNUMBER_BRAND, defineTypeMarkers } from './type-marker.js';
import { gcdBigInt } from './bigint-gcd.js';
import { isFraction } from './fraction.js';

/**
 * Check if a value is a BigNumber.
 *
 * True for a `BigNumber` of this copy of the package and for one of a second copy, which carries
 * the same prototype brand (see `type-marker.ts`). The `instanceof` test comes first: it is the
 * fast path for a value of this copy, and the brand test decides for every other value.
 */
export function isBigNumber(value: unknown): value is BigNumber {
  return (
    value instanceof BigNumber ||
    (typeof value === 'object' &&
      value !== null &&
      (value as { [BIGNUMBER_BRAND]?: unknown })[BIGNUMBER_BRAND] === true)
  );
}

/**
 * Configuration for BigNumber operations
 */
export interface BigNumberConfig {
  /** Number of significant digits (default: 64) */
  precision: number;
  /** Rounding mode (default: 'halfUp') */
  rounding: RoundingMode;
  /** Minimum exponent (default: -1e9) */
  minExponent: number;
  /** Maximum exponent (default: 1e9) */
  maxExponent: number;
}

/**
 * Rounding mode of a BigNumber operation. The default configuration uses `'halfUp'`.
 */
export type RoundingMode =
  | 'up' // Round away from zero
  | 'down' // Round toward zero (truncate)
  | 'ceil' // Round toward +Infinity
  | 'floor' // Round toward -Infinity
  | 'halfUp' // Round half away from zero (default)
  | 'halfDown' // Round half toward zero
  | 'halfEven' // Round half to even (banker's rounding)
  | 'halfCeil' // Round half toward +Infinity
  | 'halfFloor'; // Round half toward -Infinity

/** The decimal.js rounding codes 0 to 8, in order, as `RoundingMode` names. */
const DECIMAL_JS_ROUNDING: readonly RoundingMode[] = [
  'up',
  'down',
  'ceil',
  'floor',
  'halfUp',
  'halfDown',
  'halfEven',
  'halfCeil',
  'halfFloor',
];

/** Extra significant digits that a transcendental method uses before its final rounding. */
const GUARD_DIGITS = 10;
/** exp(x) gives Infinity (or 0) when |x| / ln(10) exceeds this decimal exponent. */
const EXP_DECIMAL_LIMIT = 9e15;

/**
 * The safety limit on the terms of a series. Each series rounds its terms and partial sums to the
 * working precision, and stops when a term no longer changes the sum. The slowest one (atan at
 * |x| = 0.5) gains about 0.6 digits per term, so the limit allows 4 terms per digit (#1043).
 */
function seriesIterationLimit(precision: number): number {
  return 4 * precision + 100;
}

/** The powers of ten below this exponent stay in a cache. */
const POW10_CACHE_SIZE = 2048;
const pow10Cache: bigint[] = [];
/** The last power of ten at or above the cache size: a large precision asks for one such power. */
let largePow10: { exponent: number; value: bigint } | undefined;

/**
 * `10^n` as a bigint. Each add, multiply and rounding step needs a power of ten, so the small
 * ones come from a cache (#1118).
 */
function pow10(n: number): bigint {
  if (n < POW10_CACHE_SIZE) return (pow10Cache[n] ??= 10n ** BigInt(n));
  if (largePow10?.exponent !== n) largePow10 = { exponent: n, value: 10n ** BigInt(n) };
  return largePow10.value;
}

const pow10HalfCache: bigint[] = [];

/** `10^n / 2` for `n >= 1`: the half of a rounding divisor. */
function pow10Half(n: number): bigint {
  if (n < POW10_CACHE_SIZE) return (pow10HalfCache[n] ??= pow10(n) / 2n);
  return pow10(n) / 2n;
}

const LOG10_2 = Math.log10(2);
/** Below this value a coefficient converts to a finite double. */
const NUMBER_DIGIT_LIMIT = 10n ** 300n;

/**
 * The number of decimal digits of a positive bigint. The bit length comes from the hexadecimal
 * string, which is much cheaper to build than the decimal string, and gives the count to within
 * one digit. A comparison with a power of ten then makes the count exact (#1118).
 */
function digitCount(coefficient: bigint, min = 1): number {
  // A sum has a few digits more than the precision: compare with the next powers of ten first.
  for (let d = min; d < min + 3; d++) if (coefficient < pow10(d)) return d;
  if (coefficient < NUMBER_DIGIT_LIMIT) {
    // A double holds the value to about 16 digits, so log10 gives the count to within one digit.
    let digits = Math.floor(Math.log10(Number(coefficient))) + 1;
    while (coefficient >= pow10(digits)) digits++;
    while (digits > 1 && coefficient < pow10(digits - 1)) digits--;
    return digits;
  }
  const hex = coefficient.toString(16);
  const bits = (hex.length - 1) * 4 + (32 - Math.clz32(parseInt(hex[0], 16)));
  let digits = Math.floor((bits - 1) * LOG10_2) + 1;
  while (coefficient >= pow10(digits)) digits++;
  while (digits > 1 && coefficient < pow10(digits - 1)) digits--;
  return digits;
}

/** At or above this coefficient, `normalize` tests the low bit before it divides by ten. */
const BIT_TEST_LIMIT = 10n ** 40n;

/** True when `10^precision` comes from the cache, so a comparison with it is cheap. */
function cachedPrecision(precision: number): boolean {
  return Number.isInteger(precision) && precision > 0 && precision < POW10_CACHE_SIZE - 3;
}

/**
 * True when a positive coefficient has no more than `precision` digits. One comparison with a
 * power of ten decides for a usual precision, with no digit count (#1118).
 */
function fitsPrecision(coefficient: bigint, precision: number): boolean {
  if (cachedPrecision(precision)) return coefficient < pow10(precision);
  // A very large precision (1e9 in the bitwise helpers) must not build its power of ten.
  return digitCount(coefficient) <= precision;
}

/** `10^n mod m` by binary exponentiation, so a large `n` builds no large power. */
function pow10Mod(n: number, m: bigint): bigint {
  let result = 1n % m;
  let base = 10n % m;
  for (let e = n; e > 0; e = Math.floor(e / 2)) {
    if (e % 2 === 1) result = (result * base) % m;
    base = (base * base) % m;
  }
  return result;
}

/** The depth of nested guarded calls. Only the outermost call raises the precision. */
let guardDepth = 0;

/** Extra digits that a computed constant (π, ln 2, ln 10) uses before the final rounding. */
const CONSTANT_GUARD_DIGITS = 10;

/** `atan(1/n) · scale` as a bigint, by the alternating series. */
function atanInv(n: bigint, scale: bigint): bigint {
  const n2 = n * n;
  let power = scale / n; // scale / n^(2k+1)
  let sum = power;
  for (let k = 1n; power !== 0n; k++) {
    power /= n2;
    const term = power / (2n * k + 1n);
    sum = k % 2n === 1n ? sum - term : sum + term;
  }
  return sum;
}

/** `atanh(1/n) · scale` as a bigint, by the series Σ 1 / ((2k+1) n^(2k+1)). */
function atanhInv(n: bigint, scale: bigint): bigint {
  const n2 = n * n;
  let power = scale / n;
  let sum = power;
  for (let k = 1n; power !== 0n; k++) {
    power /= n2;
    sum += power / (2n * k + 1n);
  }
  return sum;
}

// Default configuration
const defaultConfig: BigNumberConfig = {
  precision: 64,
  rounding: 'halfUp',
  minExponent: -1e9,
  maxExponent: 1e9,
};

// Global configuration (can be modified)
let globalConfig: BigNumberConfig = { ...defaultConfig };

/**
 * Distinguishes internal `(sign, coefficient, exponent)` construction from a
 * user call. A second numeric argument (`new BigNumber(1, 2)`) must not be
 * treated as a coefficient — decimal.js uses that slot as a radix, and this
 * class does not.
 */
const INTERNAL: unique symbol = Symbol('BigNumber.internal');

/**
 * BigNumber class for arbitrary precision decimal arithmetic
 *
 * Internally stores: sign * coefficient * 10^exponent
 * where coefficient is a bigint with the significant digits.
 */
export class BigNumber implements MathTSValue {
  readonly type = 'BigNumber';

  /**
   * Duck-typing marker for Decimal.js / mathjs formatter compatibility.
   * Allows external code that checks `obj.isBigNumber === true` to identify
   * this class without an `instanceof` check.
   */
  readonly isBigNumber = true;

  // Internal representation: sign * coefficient * 10^exponent
  private readonly _sign: 1 | -1 | 0;
  private readonly _coefficient: bigint; // Absolute value, normalized
  private readonly _exponent: number; // Power of 10

  // Special values
  private readonly _isNaN: boolean = false;
  private readonly _isInfinite: boolean = false;

  /**
   * Create a BigNumber from one number, string, bigint, or existing instance.
   *
   * `new BigNumber(1)` and `BigNumber.from(1)` produce the same value.
   * `new BigNumber(existing)` copies; `BigNumber.from(existing)` returns the same instance.
   * Extra arguments throw — there is no public `(sign, coefficient)` form.
   */
  constructor(value?: number | string | bigint | BigNumber) {
    if ((arguments[0] as unknown) === INTERNAL) {
      this._sign = arguments[1] as 1 | -1 | 0;
      this._coefficient = arguments[2] as bigint;
      this._exponent = (arguments[3] as number | undefined) ?? 0;
      this._isNaN = (arguments[4] as boolean | undefined) ?? false;
      this._isInfinite = (arguments[5] as boolean | undefined) ?? false;
      return;
    }

    if (arguments.length > 1) {
      throw new TypeError(
        `BigNumber accepts one argument (received ${arguments.length}). ` +
          'Use new BigNumber(value), BigNumber.from(value), or bignumber(value).'
      );
    }

    const input = value === undefined ? 0 : value;
    if (input === null || (typeof input === 'object' && !isBigNumber(input))) {
      throw new TypeError(
        'BigNumber requires a number, string, bigint, or another BigNumber ' +
          `(received ${input === null ? 'null' : typeof input})`
      );
    }
    const created = BigNumber.from(input as number | string | bigint | BigNumber);
    this._sign = created._sign;
    this._coefficient = created._coefficient;
    this._exponent = created._exponent;
    this._isNaN = created._isNaN;
    this._isInfinite = created._isInfinite;
  }

  /** One allocation for arithmetic. Not reachable as `new BigNumber(sign, coefficient)`. */
  static #allocate(
    sign: 1 | -1 | 0,
    coefficient: bigint,
    exponent: number = 0,
    isNaN: boolean = false,
    isInfinite: boolean = false
  ): BigNumber {
    const Ctor = BigNumber as unknown as new (
      token: typeof INTERNAL,
      sign: 1 | -1 | 0,
      coefficient: bigint,
      exponent?: number,
      isNaN?: boolean,
      isInfinite?: boolean
    ) => BigNumber;
    return new Ctor(INTERNAL, sign, coefficient, exponent, isNaN, isInfinite);
  }

  // ============================================================
  // Static Factory Methods
  // ============================================================

  /**
   * Create a BigNumber from a number, string, bigint, or existing instance (mathjs / Decimal.js style).
   */
  static from(value: number | string | bigint | BigNumber): BigNumber {
    if (isBigNumber(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return BigNumber.parse(value);
    }
    if (typeof value === 'bigint') {
      return BigNumber.fromBigInt(value);
    }
    if (typeof value === 'number') {
      return BigNumber.fromNumber(value);
    }
    throw new TypeError(
      'BigNumber.from requires a number, string, bigint, or BigNumber ' +
        `(received ${typeof value})`
    );
  }

  /**
   * Create a BigNumber from a number
   */
  static fromNumber(n: number): BigNumber {
    if (Number.isNaN(n)) {
      return BigNumber.#allocate(0, 0n, 0, true, false);
    }
    if (!Number.isFinite(n)) {
      return BigNumber.#allocate(n > 0 ? 1 : -1, 0n, 0, false, true);
    }
    if (n === 0) {
      return BigNumber.#allocate(0, 0n, 0);
    }

    // Safe integers are exact — skip the toString → parse round-trip.
    if (Number.isSafeInteger(n)) {
      return BigNumber.fromBigInt(BigInt(n));
    }

    // Convert to string to preserve the decimal representation of a float
    // (so 0.1 stays "0.1", not the binary expansion).
    return BigNumber.parse(n.toString());
  }

  /**
   * Create a BigNumber from a string
   */
  static parse(str: string): BigNumber {
    if (typeof str !== 'string') {
      throw new TypeError(
        `BigNumber.parse requires a string (received ${str === null ? 'null' : typeof str})`
      );
    }
    const original = str;
    str = str.trim().toLowerCase();
    if (str.length === 0) {
      throw new SyntaxError('BigNumber cannot parse an empty string');
    }

    // Handle special values
    if (str === 'nan') {
      return BigNumber.#allocate(0, 0n, 0, true, false);
    }
    if (str === 'infinity' || str === '+infinity') {
      return BigNumber.#allocate(1, 0n, 0, false, true);
    }
    if (str === '-infinity') {
      return BigNumber.#allocate(-1, 0n, 0, false, true);
    }

    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/.test(str)) {
      throw new SyntaxError(`BigNumber cannot parse '${original}'`);
    }

    // Parse sign
    let sign: 1 | -1 = 1;
    if (str.startsWith('-')) {
      sign = -1;
      str = str.slice(1);
    } else if (str.startsWith('+')) {
      str = str.slice(1);
    }

    // Handle scientific notation
    let exponentPart = 0;
    const eIndex = str.indexOf('e');
    if (eIndex !== -1) {
      exponentPart = parseInt(str.slice(eIndex + 1), 10);
      if (!Number.isSafeInteger(exponentPart)) {
        throw new RangeError(`BigNumber exponent is out of range in '${original}'`);
      }
      str = str.slice(0, eIndex);
    }

    // Parse mantissa
    const dotIndex = str.indexOf('.');
    let coefficient: string;
    let decimalPlaces = 0;

    if (dotIndex !== -1) {
      coefficient = str.slice(0, dotIndex) + str.slice(dotIndex + 1);
      decimalPlaces = str.length - dotIndex - 1;
    } else {
      coefficient = str;
    }

    // Remove leading zeros
    coefficient = coefficient.replace(/^0+/, '') || '0';

    if (coefficient === '0') {
      return BigNumber.#allocate(0, 0n, 0);
    }

    // Remove trailing zeros and adjust exponent
    let trailingZeros = 0;
    for (let i = coefficient.length - 1; i >= 0; i--) {
      if (coefficient[i] === '0') {
        trailingZeros++;
      } else {
        break;
      }
    }

    if (trailingZeros > 0) {
      coefficient = coefficient.slice(0, -trailingZeros);
    }

    const finalExponent = exponentPart - decimalPlaces + trailingZeros;

    return BigNumber.#allocate(sign, BigInt(coefficient), finalExponent);
  }

  /**
   * Create from a fraction as numerator / denominator, rounded to the configured precision
   * (#1117). The numerator carries the sign; the denominator is positive.
   */
  static fromFraction(f: { numerator: bigint; denominator: bigint }): BigNumber {
    return BigNumber.fromBigInt(f.numerator).divide(BigNumber.fromBigInt(f.denominator));
  }

  /**
   * Create from bigint
   */
  static fromBigInt(n: bigint): BigNumber {
    if (n === 0n) {
      return BigNumber.#allocate(0, 0n, 0);
    }
    const sign: 1 | -1 = n < 0n ? -1 : 1;
    let coef = n < 0n ? -n : n;
    let exp = 0;
    // Strip factors of 10 in place — no toString / BigInt(string) round-trip.
    while (coef % 10n === 0n) {
      coef /= 10n;
      exp++;
    }
    return BigNumber.#allocate(sign, coef, exp);
  }

  /**
   * Create a BigNumber from a JSON object
   */
  static fromJSON(json: { value: string }): BigNumber {
    return BigNumber.parse(json.value);
  }

  /**
   * Get/set global configuration
   */
  static config(newConfig?: Partial<BigNumberConfig>): BigNumberConfig {
    if (newConfig) {
      globalConfig = { ...globalConfig, ...newConfig };
    }
    return { ...globalConfig };
  }

  /**
   * Reset configuration to defaults
   */
  static resetConfig(): void {
    globalConfig = { ...defaultConfig };
  }

  /**
   * Compare two BigNumbers
   * @returns -1, 0, or 1
   */
  static compare(a: BigNumber, b: BigNumber): number {
    // Handle special values
    if (a._isNaN || b._isNaN) return NaN as unknown as number;
    if (a._isInfinite && b._isInfinite) {
      if (a._sign === b._sign) return 0;
      return a._sign > b._sign ? 1 : -1;
    }
    if (a._isInfinite) return a._sign;
    if (b._isInfinite) return -b._sign as -1 | 1;

    // Handle zeros
    if (a._sign === 0 && b._sign === 0) return 0;
    if (a._sign === 0) return -b._sign as -1 | 1;
    if (b._sign === 0) return a._sign;

    // Different signs
    if (a._sign !== b._sign) return a._sign > b._sign ? 1 : -1;

    // Same sign - compare magnitudes
    const result = BigNumber.compareMagnitude(a, b);
    return a._sign === 1 ? result : (-result as -1 | 0 | 1);
  }

  private static compareMagnitude(a: BigNumber, b: BigNumber): -1 | 0 | 1 {
    const aOrder = digitCount(a._coefficient) + a._exponent;
    const bOrder = digitCount(b._coefficient) + b._exponent;

    if (aOrder !== bOrder) {
      return aOrder > bOrder ? 1 : -1;
    }

    // Same order of magnitude: the exponents differ by the difference of the digit counts, so
    // the coefficients compare as integers at the smaller exponent. No string of the exponent
    // length is built (#1118: mod compares two values with an exponent up to 1e9).
    const shift = a._exponent - b._exponent;
    const aCoef = shift > 0 ? a._coefficient * pow10(shift) : a._coefficient;
    const bCoef = shift < 0 ? b._coefficient * pow10(-shift) : b._coefficient;

    if (aCoef === bCoef) return 0;
    return aCoef > bCoef ? 1 : -1;
  }

  // ============================================================
  // Conversion Methods
  // ============================================================

  valueOf(): number {
    if (this._isNaN) return NaN;
    if (this._isInfinite) return this._sign === 1 ? Infinity : -Infinity;
    if (this._sign === 0) return 0;

    const str = this.toString();
    return parseFloat(str);
  }

  /**
   * Convert to a JS number.
   * Alias for `valueOf()` — provided for Decimal.js / mathjs formatter
   * duck-typing compatibility.
   */
  toNumber(): number {
    return this.valueOf();
  }

  toString(): string {
    if (this._isNaN) return 'NaN';
    if (this._isInfinite) return this._sign === 1 ? 'Infinity' : '-Infinity';
    if (this._sign === 0) return '0';

    const sign = this._sign === -1 ? '-' : '';
    const digits = this._coefficient.toString();

    if (this._exponent >= 0) {
      // Integer or large number
      return sign + digits + '0'.repeat(this._exponent);
    } else if (-this._exponent < digits.length) {
      // Decimal in the middle
      const insertPos = digits.length + this._exponent;
      return sign + digits.slice(0, insertPos) + '.' + digits.slice(insertPos);
    } else {
      // Small decimal (leading zeros)
      return sign + '0.' + '0'.repeat(-this._exponent - digits.length) + digits;
    }
  }

  toJSON(): { mathjs: string; value: string } {
    return {
      mathjs: 'BigNumber',
      value: this.toString(),
    };
  }

  /**
   * Convert to fixed-point notation.
   *
   * When called with no argument (or `undefined`) returns the full fixed-point
   * string representation without rounding — matching Decimal.js semantics where
   * `toFixed()` is equivalent to a lossless fixed-point stringify.
   * When called with a non-negative integer `decimalPlaces`, rounds and formats
   * to exactly that many digits after the decimal point.
   */
  toFixed(decimalPlaces?: number): string {
    if (decimalPlaces === undefined) {
      // No rounding: return full fixed-point string (same as toString() but
      // always uses decimal notation rather than scientific notation).
      return this.toFixedInternal(undefined);
    }
    return this.round(decimalPlaces).toFixedInternal(decimalPlaces);
  }

  private toFixedInternal(decimalPlaces: number | undefined): string {
    if (this._isNaN) return 'NaN';
    if (this._isInfinite) return this._sign === 1 ? 'Infinity' : '-Infinity';

    // When decimalPlaces is undefined we return the full value.
    const dp = decimalPlaces ?? -1; // -1 signals "all digits"
    const allDigits = dp < 0;

    if (this._sign === 0) return allDigits ? '0' : dp > 0 ? '0.' + '0'.repeat(dp) : '0';

    const sign = this._sign === -1 ? '-' : '';
    const digits = this._coefficient.toString();

    if (this._exponent >= 0) {
      // Integer or large number — no fractional part in the internal rep
      const intPart = digits + '0'.repeat(this._exponent);
      if (allDigits) return sign + intPart;
      return sign + intPart + (dp > 0 ? '.' + '0'.repeat(dp) : '');
    } else if (-this._exponent <= digits.length) {
      const insertPos = digits.length + this._exponent;
      const intPart = digits.slice(0, insertPos) || '0';
      const decPart = digits.slice(insertPos);
      if (allDigits) {
        return sign + intPart + (decPart.length > 0 ? '.' + decPart : '');
      }
      let paddedDec = decPart;
      if (paddedDec.length < dp) {
        paddedDec += '0'.repeat(dp - paddedDec.length);
      }
      return sign + intPart + (dp > 0 ? '.' + paddedDec.slice(0, dp) : '');
    } else {
      const leadingZeros = -this._exponent - digits.length;
      const decPart = '0'.repeat(leadingZeros) + digits;
      if (allDigits) {
        return sign + '0.' + decPart;
      }
      let paddedDec = decPart;
      if (paddedDec.length < dp) {
        paddedDec += '0'.repeat(dp - paddedDec.length);
      }
      return sign + '0' + (dp > 0 ? '.' + paddedDec.slice(0, dp) : '');
    }
  }

  /**
   * Convert to exponential notation
   */
  toExponential(decimalPlaces?: number): string {
    if (this._isNaN) return 'NaN';
    if (this._isInfinite) return this._sign === 1 ? 'Infinity' : '-Infinity';
    if (this._sign === 0) {
      const dp = decimalPlaces ?? 0;
      return dp > 0 ? '0.' + '0'.repeat(dp) + 'e+0' : '0e+0';
    }

    const sign = this._sign === -1 ? '-' : '';
    const digits = this._coefficient.toString();
    const exp = digits.length - 1 + this._exponent;
    const expSign = exp >= 0 ? '+' : '';

    if (decimalPlaces === undefined) {
      if (digits.length === 1) {
        return `${sign}${digits}e${expSign}${exp}`;
      }
      return `${sign}${digits[0]}.${digits.slice(1)}e${expSign}${exp}`;
    }

    if (decimalPlaces === 0) {
      return `${sign}${digits[0]}e${expSign}${exp}`;
    }

    let decPart = digits.slice(1);
    if (decPart.length < decimalPlaces) {
      decPart += '0'.repeat(decimalPlaces - decPart.length);
    } else {
      decPart = decPart.slice(0, decimalPlaces);
    }

    return `${sign}${digits[0]}.${decPart}e${expSign}${exp}`;
  }

  /**
   * Convert to precision
   */
  toPrecision(significantDigits?: number): string {
    if (significantDigits === undefined) {
      return this.toString();
    }

    if (this._isNaN) return 'NaN';
    if (this._isInfinite) return this._sign === 1 ? 'Infinity' : '-Infinity';
    if (this._sign === 0) {
      return significantDigits > 1 ? '0.' + '0'.repeat(significantDigits - 1) : '0';
    }

    const digits = this._coefficient.toString();
    const order = digits.length + this._exponent;

    // Use exponential if exponent is very large or very small
    if (order > significantDigits || order < -6) {
      return this.toExponential(significantDigits - 1);
    }

    return this.toFixed(significantDigits - order);
  }

  /**
   * Convert to bigint (truncated)
   */
  toBigInt(): bigint {
    if (this._isNaN || this._isInfinite) {
      throw new Error('Cannot convert NaN or Infinity to bigint');
    }
    if (this._sign === 0) return 0n;

    const digits = this._coefficient.toString();
    if (this._exponent >= 0) {
      return BigInt(this._sign) * BigInt(digits + '0'.repeat(this._exponent));
    } else if (-this._exponent < digits.length) {
      return BigInt(this._sign) * BigInt(digits.slice(0, digits.length + this._exponent));
    }
    return 0n;
  }

  /**
   * Binary string representation, e.g. `255 -> '0b11111111'`, `0.5 -> '0b0.1'`.
   * Mirrors Decimal.js `toBinary()`. Negatives carry a leading `-`.
   */
  toBinary(): string {
    return this.toRadixString(2, '0b');
  }

  /**
   * Octal string representation, e.g. `8 -> '0o10'`.
   * Mirrors Decimal.js `toOctal()`.
   */
  toOctal(): string {
    return this.toRadixString(8, '0o');
  }

  /**
   * Hexadecimal string representation, e.g. `255 -> '0xff'`, `10.5 -> '0xa.8'`.
   * Mirrors Decimal.js `toHexadecimal()`.
   */
  toHexadecimal(): string {
    return this.toRadixString(16, '0x');
  }

  /**
   * Shared radix formatter for {@link toBinary}/{@link toOctal}/{@link toHexadecimal}.
   * The integer part is always exact. A fraction that terminates in the radix is exact.
   * Any other fraction rounds half-up to the configured precision, counted in significant
   * radix digits from the first nonzero digit. The rounding is one exact bigint step, so a
   * carry crosses the point (0.999... -> 1).
   */
  private toRadixString(radix: number, prefix: string): string {
    if (this._isNaN) return 'NaN';
    if (this._isInfinite) return (this._sign < 0 ? '-' : '') + 'Infinity';
    if (this._sign === 0) return prefix + '0';

    const r = BigInt(radix);
    // |value| = num / den, in lowest terms.
    let num = this._coefficient;
    let den = 1n;
    if (this._exponent >= 0) num *= 10n ** BigInt(this._exponent);
    else den = 10n ** BigInt(-this._exponent);
    const g = gcdBigInt(num, den);
    num /= g;
    den /= g;

    const intPart = num / den;
    let rem = num % den;
    let digits: number; // radix digits kept after the point
    if (rem === 0n) {
      digits = 0;
    } else if ((den & (den - 1n)) === 0n) {
      // den is a power of two: the fraction terminates in radix 2, 8 and 16. Count the digits of the fraction.
      digits = 0;
      for (let f = rem; f !== 0n; f = (f * r) % den) digits++;
    } else {
      const intDigits = intPart === 0n ? 0 : intPart.toString(radix).length;
      let leadingZeros = 0;
      if (intPart === 0n) {
        for (rem *= r; rem < den; rem *= r) leadingZeros++;
      }
      digits = Math.max(1, leadingZeros + globalConfig.precision - intDigits);
    }

    const scale = r ** BigInt(digits);
    const scaled = (2n * num * scale + den) / (2n * den); // round half-up
    let text = scaled.toString(radix).padStart(digits + 1, '0');
    if (digits > 0) {
      const head = text.slice(0, text.length - digits);
      const tail = text.slice(text.length - digits).replace(/0+$/, '');
      text = tail ? `${head}.${tail}` : head;
    }
    return (this._sign < 0 ? '-' : '') + prefix + text;
  }

  // ============================================================
  // Arithmetic Operations
  // ============================================================

  /**
   * Addition
   */
  add(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);

    if (this._isNaN || b._isNaN) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._isInfinite && b._isInfinite) {
      if (this._sign === b._sign) return this;
      return BigNumber.#allocate(0, 0n, 0, true); // Infinity - Infinity = NaN
    }
    if (this._isInfinite) return this;
    if (b._isInfinite) return b;
    // Like decimal.js, every result rounds to the configured precision (#1118).
    const precision = globalConfig.precision;
    if (this._sign === 0) return b.roundToPrecision(precision);
    if (b._sign === 0) return this.roundToPrecision(precision);

    // Align exponents
    const [aCoef, bCoef, exp] = this.alignExponents(this, b);

    if (this._sign === b._sign) {
      // Same sign: add coefficients
      return this.rounded(this._sign, aCoef + bCoef, exp);
    }
    // Different signs: subtract coefficients
    if (aCoef >= bCoef) return this.rounded(this._sign, aCoef - bCoef, exp);
    return this.rounded(b._sign, bCoef - aCoef, exp);
  }

  /**
   * Subtraction
   */
  subtract(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);
    return this.add(b.negate());
  }

  /**
   * Alias for subtract — mathjs / Decimal.js compatibility.
   */
  sub(other: Scalar | BigNumber | number | string): BigNumber {
    return this.subtract(other);
  }

  /**
   * Multiplication
   */
  multiply(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);

    if (this._isNaN || b._isNaN) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._isInfinite || b._isInfinite) {
      if (this._sign === 0 || b._sign === 0) return BigNumber.#allocate(0, 0n, 0, true); // 0 * Infinity = NaN
      const sign: 1 | -1 = (this._sign * b._sign) as 1 | -1;
      return BigNumber.#allocate(sign, 0n, 0, false, true);
    }
    if (this._sign === 0 || b._sign === 0) return BigNumber.#allocate(0, 0n, 0);

    const sign: 1 | -1 = (this._sign * b._sign) as 1 | -1;
    const coefficient = this._coefficient * b._coefficient;
    const exponent = this._exponent + b._exponent;

    return this.rounded(sign, coefficient, exponent);
  }

  /**
   * Alias for multiply — mathjs / Decimal.js compatibility.
   */
  mul(other: Scalar | BigNumber | number | string): BigNumber {
    return this.multiply(other);
  }

  /**
   * Alias for multiply — Decimal.js calling convention (used by the Unit).
   */
  times(other: Scalar | BigNumber | number | string): BigNumber {
    return this.multiply(other);
  }

  /**
   * Division
   */
  divide(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);

    if (this._isNaN || b._isNaN) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._isInfinite && b._isInfinite) return BigNumber.#allocate(0, 0n, 0, true);
    if (b._sign === 0) {
      if (this._sign === 0) return BigNumber.#allocate(0, 0n, 0, true);
      return BigNumber.#allocate(this._sign, 0n, 0, false, true);
    }
    if (this._isInfinite) {
      const sign: 1 | -1 = (this._sign * b._sign) as 1 | -1;
      return BigNumber.#allocate(sign, 0n, 0, false, true);
    }
    if (b._isInfinite) return BigNumber.#allocate(0, 0n, 0);
    if (this._sign === 0) return BigNumber.#allocate(0, 0n, 0);

    const sign: 1 | -1 = (this._sign * b._sign) as 1 | -1;
    const precision = globalConfig.precision;

    // Scale the dividend so the integer division yields at least `precision + 10`
    // significant digits. The naive `10^(precision+10)` scaling is only sufficient
    // when the divisor coefficient has no more digits than the dividend: the number
    // of quotient digits is roughly `aDigits + scaleDigits - bDigits`, so a divisor
    // with many more digits than the dividend (e.g. `2 / (g*g)` where `g*g` is an
    // un-rounded ~2·precision-digit product) collapses the quotient toward — or all
    // the way to — zero. Widen the scale by the digit deficit `bDigits - aDigits` so
    // the guarantee holds regardless of divisor magnitude. When `bDigits <= aDigits`
    // this reduces to the original `precision + 10` scaling (bit-identical), so no
    // previously-correct division changes; it only repairs the large-divisor case.
    // Root cause of catastrophic `cbrt(bignumber(2)) -> ~0` and the ~11-digit
    // `sqrt`/`asinh` precision loss (both iterate `x / bigCoefficient`).
    const aDigits = digitCount(this._coefficient);
    const bDigits = digitCount(b._coefficient);
    const scaleDigits = precision + 10 + Math.max(0, bDigits - aDigits);
    const scaledDividend = this._coefficient * pow10(scaleDigits);
    const quotient = scaledDividend / b._coefficient;
    const exponent = this._exponent - b._exponent - scaleDigits;

    return this.normalize(sign, quotient, exponent).roundToPrecision(precision);
  }

  /**
   * Alias for divide — Decimal.js calling convention (used by the Unit).
   */
  div(other: Scalar | BigNumber | number | string): BigNumber {
    return this.divide(other);
  }

  /**
   * Negation
   */
  negate(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    const newSign: 1 | -1 = this._sign === 1 ? -1 : 1;
    return BigNumber.#allocate(newSign, this._coefficient, this._exponent, false, this._isInfinite);
  }

  /**
   * Absolute value
   */
  abs(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    return BigNumber.#allocate(1, this._coefficient, this._exponent, false, this._isInfinite);
  }

  /**
   * Power. An integer exponent uses binary exponentiation with guard digits and rounds the
   * result once to the configured precision (#1118). A fractional exponent, or a
   * fractional BigNumber exponent, uses `exp(n * ln(this))` with guard digits, rounded to the
   * configured precision (#1043). A negative base with a fractional exponent gives NaN.
   */
  pow(n: number | bigint | BigNumber): BigNumber {
    if (n instanceof BigNumber) {
      if (n._isNaN) return n;
      if (!n._isInfinite && n.isInteger() && Number.isSafeInteger(n.toNumber())) {
        return this.pow(n.toNumber());
      }
      return this.#fractionalPow(n);
    }
    if (typeof n === 'number' && !Number.isInteger(n)) {
      return Number.isNaN(n)
        ? BigNumber.fromNumber(NaN)
        : this.#fractionalPow(BigNumber.fromNumber(n));
    }
    const exp = typeof n === 'bigint' ? Number(n) : n;

    if (this._isNaN) return this;
    if (exp === 0) return BigNumber.fromNumber(1);
    if (this._sign === 0) {
      if (exp < 0) return BigNumber.#allocate(1, 0n, 0, false, true); // 0^(-n) = Infinity
      return this;
    }
    // Each product rounds, so the loop runs with guard digits (more for a larger exponent: the
    // error grows with the number of products) and the final result rounds once (#1118).
    const precision = globalConfig.precision;
    const saved = globalConfig;
    const extra = GUARD_DIGITS + String(Math.abs(exp)).length;
    globalConfig = { ...saved, precision: precision + extra };
    try {
      let result = BigNumber.fromNumber(1);
      let base: BigNumber = this.clone();
      let e = Math.abs(exp);
      while (e > 0) {
        if (e % 2 === 1) {
          result = result.multiply(base);
        }
        e = Math.floor(e / 2);
        if (e > 0) base = base.multiply(base);
      }
      if (exp < 0) result = BigNumber.fromNumber(1).divide(result);
      return result.roundToPrecision(precision, saved.rounding);
    } finally {
      globalConfig = saved;
    }
  }

  /** `this ** y` for a non-integer or infinite `y`: `exp(y * ln(this))` with guard digits. */
  #fractionalPow(y: BigNumber): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === -1) {
      // A negative base has a real power only for an integer or an infinite exponent.
      if (y._isInfinite) return this.abs().#fractionalPow(y);
      if (!y.isInteger()) return BigNumber.#allocate(0, 0n, 0, true);
      const magnitude = this.abs().#fractionalPow(y);
      const odd = !y.abs().mod(BigNumber.fromNumber(2)).isZero();
      return odd ? magnitude.negate() : magnitude;
    }
    if (this._sign === 0) {
      return y._sign === -1 ? BigNumber.#allocate(1, 0n, 0, false, true) : this;
    }
    return this.#guarded(() => y.multiply(this.ln()).exp());
  }

  /**
   * Runs `compute` with GUARD_DIGITS more significant digits, then rounds its result to the
   * configured precision, so the rounding error of each inner step stays below the last digit
   * (#1043). A nested call (atan2 calls atan) runs at the precision already raised.
   */
  #guarded(compute: () => BigNumber): BigNumber {
    if (guardDepth > 0) return compute();
    const precision = globalConfig.precision;
    const saved = globalConfig;
    globalConfig = { ...saved, precision: precision + GUARD_DIGITS };
    guardDepth++;
    try {
      return compute().roundToPrecision(precision);
    } finally {
      guardDepth--;
      globalConfig = saved;
    }
  }

  /**
   * Square root
   */
  sqrt(): BigNumber {
    return this.#guarded(() => this.#sqrtImpl());
  }

  #sqrtImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === -1) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._sign === 0) return this;
    if (this._isInfinite) return this;

    // Newton-Raphson iteration
    const precision = globalConfig.precision;
    let guess = BigNumber.fromNumber(Math.sqrt(this.valueOf()));

    for (let i = 0; i < 100; i++) {
      const newGuess = guess.add(this.divide(guess)).divide(BigNumber.fromNumber(2));
      if (
        guess
          .subtract(newGuess)
          .abs()
          .compareTo(guess.multiply(BigNumber.parse('1e-' + (precision + 5)))) <= 0
      ) {
        return newGuess.roundToPrecision(precision);
      }
      guess = newGuess;
    }

    return guess.roundToPrecision(precision);
  }

  // ============================================================
  // Comparison Methods
  // ============================================================

  // All comparisons coerce their argument (number/string → BigNumber) exactly like the arithmetic
  // methods, so `bignumber(8).lessThanOrEqual(3)` behaves like `.add(3)` does. Without the
  // coercion the raw number reached the static comparator, which read `undefined._sign` and
  // returned garbage — silently breaking every factory-layer consumer that compares against a
  // number literal (isPrime, quantiles, …).
  equals(other: BigNumber | number | string): boolean {
    return BigNumber.compare(this, this.ensureBigNumber(other)) === 0;
  }

  lessThan(other: BigNumber | number | string): boolean {
    return BigNumber.compare(this, this.ensureBigNumber(other)) < 0;
  }

  lessThanOrEqual(other: BigNumber | number | string): boolean {
    return BigNumber.compare(this, this.ensureBigNumber(other)) <= 0;
  }

  greaterThan(other: BigNumber | number | string): boolean {
    return BigNumber.compare(this, this.ensureBigNumber(other)) > 0;
  }

  greaterThanOrEqual(other: BigNumber | number | string): boolean {
    return BigNumber.compare(this, this.ensureBigNumber(other)) >= 0;
  }

  compareTo(other: BigNumber | number | string): number {
    return BigNumber.compare(this, this.ensureBigNumber(other));
  }

  compare(other: BigNumber | number | string): number {
    return this.compareTo(other);
  }

  /**
   * Returns true iff this > other.
   * Accepts the same argument types as `add`/`multiply` (BigNumber, number, or string).
   * Named `gt` for Decimal.js / mathjs formatter compatibility.
   */
  gt(other: BigNumber | number | string): boolean {
    return this.greaterThan(other);
  }

  // ============================================================
  // decimal.js names (#1043)
  // ============================================================
  // The factory layer of `functions` was ported from mathjs, which uses decimal.js. These names
  // keep that code on core's BigNumber. Each one calls the method with the long name.

  /** decimal.js `gte`: true when this >= other. */
  gte(other: BigNumber | number | string): boolean {
    return this.greaterThanOrEqual(other);
  }

  /** decimal.js `lt`: true when this < other. */
  lt(other: BigNumber | number | string): boolean {
    return this.lessThan(other);
  }

  /** decimal.js `lte`: true when this <= other. */
  lte(other: BigNumber | number | string): boolean {
    return this.lessThanOrEqual(other);
  }

  /** decimal.js `eq`: true when this equals other. */
  eq(other: BigNumber | number | string): boolean {
    return this.equals(other);
  }

  /** decimal.js `cmp`: -1, 0 or 1, and NaN when an operand is NaN. */
  cmp(other: BigNumber | number | string): number {
    const o = this.ensureBigNumber(other);
    if (this._isNaN || o._isNaN) return NaN;
    return this.compareTo(o);
  }

  /** decimal.js `isInt`: true when this is an integer. */
  isInt(): boolean {
    return this.isInteger();
  }

  /** decimal.js `isNeg`: true when this is less than zero. */
  isNeg(): boolean {
    return this.isNegative();
  }

  /** decimal.js `isPos`: true when this is greater than zero. */
  isPos(): boolean {
    return this.isPositive();
  }

  /** decimal.js `minus`: this − other. */
  minus(other: Scalar | BigNumber | number | string): BigNumber {
    return this.sub(other);
  }

  /** decimal.js `plus`: this + other. */
  plus(other: Scalar | BigNumber | number | string): BigNumber {
    return this.add(other);
  }

  /** decimal.js `neg`: −this. */
  neg(): BigNumber {
    return this.negate();
  }

  /** decimal.js `dividedBy`: this / other. */
  dividedBy(other: Scalar | BigNumber | number | string): BigNumber {
    return this.div(other);
  }

  /**
   * decimal.js `toDecimalPlaces`: round to `decimalPlaces` digits after the point.
   * `mode` is a decimal.js rounding code (0 up, 1 down, 2 ceil, 3 floor, 4 half up, 5 half down,
   * 6 half even, 7 half ceil, 8 half floor) or a `RoundingMode` name. The default is the
   * configured rounding mode.
   */
  toDecimalPlaces(decimalPlaces?: number, mode?: number | RoundingMode): BigNumber {
    // decimal.js: with no decimal places, the value is returned unchanged.
    if (decimalPlaces === undefined) return this.clone();
    if (typeof mode === 'number') {
      const name = DECIMAL_JS_ROUNDING[mode];
      if (name === undefined) {
        throw new RangeError(`toDecimalPlaces: rounding mode ${mode} is not 0 to 8`);
      }
      return this.round(decimalPlaces, name);
    }
    return this.round(decimalPlaces, mode ?? globalConfig.rounding);
  }

  /** decimal.js `log`: the logarithm to `base`, default 10. */
  log(base?: BigNumber | number): BigNumber {
    if (base === undefined) return this.log10();
    const b = base instanceof BigNumber ? base : BigNumber.fromNumber(base);
    if (b.equals(BigNumber.fromNumber(10))) return this.log10();
    if (b.equals(BigNumber.fromNumber(2))) return this.log2();
    return this.#guarded(() => this.ln().divide(b.ln()));
  }

  /** decimal.js static `atan2`: the angle of the point (x, y). */
  static atan2(y: BigNumber, x: BigNumber): BigNumber {
    return y.atan2(x);
  }

  /** decimal.js static `precision`: the configured number of significant digits. */
  static get precision(): number {
    return globalConfig.precision;
  }

  // ============================================================
  // Constants at the configured precision (#1043)
  // ============================================================
  // Each constant comes from a bigint series to the precision asked for, plus guard digits, and
  // stays in a cache per precision. The exported BIGNUMBER_* constants use these series too.

  static #constantCache = new Map<string, BigNumber>();

  /** A constant from a fixed-point series: `series(scale)` gives the value times `scale`. */
  static #constant(name: string, precision: number, series: (scale: bigint) => bigint): BigNumber {
    const key = `${name}:${precision}`;
    const hit = BigNumber.#constantCache.get(key);
    if (hit) return hit;
    const digits = precision + CONSTANT_GUARD_DIGITS;
    const value = BigNumber.#allocate(1, series(10n ** BigInt(digits)), -digits).roundToPrecision(
      precision
    );
    BigNumber.#constantCache.set(key, value);
    return value;
  }

  /** π to `precision` digits (Machin: 16·atan(1/5) − 4·atan(1/239)). */
  static piAt(precision: number = globalConfig.precision): BigNumber {
    return BigNumber.#constant(
      'pi',
      precision,
      (s) => 16n * atanInv(5n, s) - 4n * atanInv(239n, s)
    );
  }

  /** e to `precision` digits (the sum of 1/k!). */
  static eAt(precision: number = globalConfig.precision): BigNumber {
    return BigNumber.#constant('e', precision, (s) => {
      let sum = 0n;
      for (let term = s, k = 1n; term > 0n; k++) {
        sum += term;
        term /= k;
      }
      return sum;
    });
  }

  /** ln 2 to `precision` digits (2·atanh(1/3)). */
  static ln2At(precision: number = globalConfig.precision): BigNumber {
    return BigNumber.#constant('ln2', precision, (s) => 2n * atanhInv(3n, s));
  }

  /** ln 10 to `precision` digits (3·ln 2 + 2·atanh(1/9), since 10 = 2³ · 1.25). */
  static ln10At(precision: number = globalConfig.precision): BigNumber {
    return BigNumber.#constant(
      'ln10',
      precision,
      (s) => 6n * atanhInv(3n, s) + 2n * atanhInv(9n, s)
    );
  }

  // ============================================================
  // Rounding Methods
  // ============================================================

  /**
   * Round to specified decimal places
   */
  round(decimalPlaces: number = 0, mode: RoundingMode = globalConfig.rounding): BigNumber {
    if (this._isNaN || this._isInfinite || this._sign === 0) return this;

    const targetExp = -decimalPlaces;
    if (this._exponent >= targetExp) return this;

    const shift = targetExp - this._exponent;
    const divisor = BigInt(10) ** BigInt(shift);
    const quotient = this._coefficient / divisor;
    const remainder = this._coefficient % divisor;

    let rounded = quotient;
    const halfDivisor = divisor / 2n;
    const shouldRoundUp = this.shouldRound(remainder, halfDivisor, divisor, quotient, mode);

    if (shouldRoundUp) {
      rounded += 1n;
    }

    return this.normalize(rounded === 0n ? 0 : this._sign, rounded, targetExp);
  }

  private shouldRound(
    remainder: bigint,
    halfDivisor: bigint,
    divisor: bigint,
    quotient: bigint,
    mode: RoundingMode
  ): boolean {
    const isPositive = this._sign === 1;
    const isExactlyHalf = remainder === halfDivisor && divisor % 2n === 0n;
    const isMoreThanHalf = remainder > halfDivisor;

    switch (mode) {
      case 'up':
        return remainder > 0n;
      case 'down':
        return false;
      case 'ceil':
        return isPositive && remainder > 0n;
      case 'floor':
        return !isPositive && remainder > 0n;
      case 'halfUp':
        return isMoreThanHalf || isExactlyHalf;
      case 'halfDown':
        return isMoreThanHalf;
      case 'halfEven':
        return isMoreThanHalf || (isExactlyHalf && quotient % 2n !== 0n);
      case 'halfCeil':
        return isMoreThanHalf || (isExactlyHalf && isPositive);
      case 'halfFloor':
        return isMoreThanHalf || (isExactlyHalf && !isPositive);
      default:
        return isMoreThanHalf || isExactlyHalf;
    }
  }

  /**
   * Round to specified precision (significant digits)
   */
  roundToPrecision(precision: number, mode: RoundingMode = globalConfig.rounding): BigNumber {
    if (this._isNaN || this._isInfinite || this._sign === 0) return this;

    if (fitsPrecision(this._coefficient, precision)) return this;
    return this.roundExcessDigits(precision, mode);
  }

  /** Rounds a finite, nonzero value whose coefficient has more than `precision` digits. */
  private roundExcessDigits(precision: number, mode: RoundingMode): BigNumber {
    // The coefficient does not fit, so it has at least precision + 1 digits.
    const lowest = cachedPrecision(precision) ? precision + 1 : 1;
    const digitsToRemove = digitCount(this._coefficient, lowest) - precision;
    const divisor = pow10(digitsToRemove);
    const halfDivisor = pow10Half(digitsToRemove);
    let rounded: bigint;
    if (mode === 'halfUp') {
      // A tie rounds away from zero, so one division of the coefficient plus a half decides.
      rounded = (this._coefficient + halfDivisor) / divisor;
    } else if (mode === 'down') {
      rounded = this._coefficient / divisor;
    } else {
      const quotient = this._coefficient / divisor;
      const remainder = this._coefficient - quotient * divisor;
      rounded = quotient;
      if (this.shouldRound(remainder, halfDivisor, divisor, quotient, mode)) rounded += 1n;
    }

    // Adjust exponent to account for removed digits
    const newExponent = this._exponent + digitsToRemove;
    return this.normalize(rounded === 0n ? 0 : this._sign, rounded, newExponent);
  }

  floor(): BigNumber {
    return this.round(0, 'floor');
  }

  ceil(): BigNumber {
    return this.round(0, 'ceil');
  }

  trunc(): BigNumber {
    return this.round(0, 'down');
  }

  /**
   * Round to `n` significant decimal digits and return a new BigNumber.
   * Delegates to `roundToPrecision`, using the global rounding mode unless
   * an explicit `roundingMode` is supplied.
   *
   * Named `toSignificantDigits` for Decimal.js / mathjs formatter compatibility.
   * When `n` is undefined the value is returned unchanged (no rounding).
   */
  toSignificantDigits(n?: number, roundingMode?: RoundingMode): BigNumber {
    if (n === undefined) return this.clone();
    return this.roundToPrecision(n, roundingMode ?? globalConfig.rounding);
  }

  /**
   * The decimal exponent of this number: `floor(log10(|x|))`.
   *
   * Matches Decimal.js semantics:
   *   - `12345` → `4`   (5 digits → the most-significant place is 10^4)
   *   - `0.0123` → `-2`  (first significant digit is at 10^-2)
   *   - `100` → `2`
   *   - `0.01` → `-2`
   *   - `0` → `0`        (by convention; `isZero()` can be used to distinguish)
   *
   * For special values (NaN, ±Infinity) returns 0 — callers check
   * `isFinite()` / `isNaN()` before using `.e`.
   */
  get e(): number {
    if (this._isNaN || this._isInfinite || this._sign === 0) return 0;
    // coefficient has `d` digits; the top digit lives at position d-1+exponent
    // e.g. coefficient=12345 (5 digits), exponent=0 → e = 4
    //      coefficient=123,   exponent=2 → value=12300 → e = 4
    //      coefficient=123,   exponent=-5 → value=0.00123 → e = -3
    const d = this._coefficient.toString().length;
    return d - 1 + this._exponent;
  }

  // ============================================================
  // Modular Arithmetic
  // ============================================================

  /**
   * Modulo (remainder after division)
   * Result has the same sign as the dividend (this).
   *
   * The remainder is exact: it comes from the two coefficients as integers, not from a rounded
   * quotient or a rounded product. The result does not round to the configured precision, so the
   * Euclidean algorithm stays correct for integers longer than the precision. The remainder has
   * no more digits than the divisor, or it is the dividend itself (#1118).
   */
  mod(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);
    if (this._isNaN || b._isNaN || b._sign === 0) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._isInfinite) return BigNumber.#allocate(0, 0n, 0, true);
    if (b._isInfinite) return this;
    if (this._sign === 0) return this;

    // |a| < |b|: the remainder is a.
    if (BigNumber.compareMagnitude(this, b) < 0) return this;

    const shift = this._exponent - b._exponent;
    if (shift >= 0) {
      // a = aCoef * 10^shift at the exponent of b. Reduce 10^shift modulo bCoef first.
      const remainder = (this._coefficient * pow10Mod(shift, b._coefficient)) % b._coefficient;
      return this.normalize(this._sign, remainder, b._exponent);
    }
    // b = bCoef * 10^-shift at the exponent of a. |a| >= |b| bounds this power by the size of a.
    const remainder = this._coefficient % (b._coefficient * pow10(-shift));
    return this.normalize(this._sign, remainder, this._exponent);
  }

  // ============================================================
  // Trigonometric Functions
  // ============================================================

  /**
   * Sine of this BigNumber (in radians)
   * Uses Taylor series: sin(x) = x - x^3/3! + x^5/5! - ...
   */
  sin(): BigNumber {
    return this.#guarded(() => this.#sinImpl());
  }

  #sinImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._sign === 0) return this;

    // Range reduction: bring x into [-PI, PI]
    const x = this._reduceAngle();
    return x._sinTaylor();
  }

  /**
   * Cosine of this BigNumber (in radians)
   * Uses Taylor series: cos(x) = 1 - x^2/2! + x^4/4! - ...
   */
  cos(): BigNumber {
    return this.#guarded(() => this.#cosImpl());
  }

  #cosImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._sign === 0) return BigNumber.fromNumber(1);

    const x = this._reduceAngle();
    return x._cosTaylor();
  }

  /**
   * Tangent of this BigNumber (in radians)
   * tan(x) = sin(x) / cos(x)
   */
  tan(): BigNumber {
    return this.#guarded(() => this.#tanImpl());
  }

  #tanImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._sign === 0) return this;

    const x = this._reduceAngle();
    return x._sinTaylor().divide(x._cosTaylor());
  }

  /**
   * Arcsine of this BigNumber
   * Returns value in [-PI/2, PI/2]
   */
  asin(): BigNumber {
    return this.#guarded(() => this.#asinImpl());
  }

  #asinImpl(): BigNumber {
    if (this._isNaN) return this;
    // Domain: [-1, 1]
    const one = BigNumber.fromNumber(1);
    if (this.abs().compareTo(one) > 0) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._sign === 0) return this;

    // For |x| close to 1: asin(x) = PI/2 - 2*asin(sqrt((1-x)/2)) * sign(x)
    // For small x use Taylor series via atan: asin(x) = atan(x / sqrt(1 - x^2))
    // 1 - x^2 as (1 - x) * (1 + x): the square of x rounds, and it loses 1 - x when |x| is near 1.
    const denominator = one.subtract(this).multiply(one.add(this)).sqrt();
    if (denominator.isZero()) {
      // |x| = 1 exactly
      return this._sign === 1 ? BigNumber.piAt().divide(2) : BigNumber.piAt().divide(-2);
    }
    return this.divide(denominator).atan();
  }

  /**
   * Arccosine of this BigNumber
   * Returns value in [0, PI]
   */
  acos(): BigNumber {
    return this.#guarded(() => this.#acosImpl());
  }

  #acosImpl(): BigNumber {
    if (this._isNaN) return this;
    const one = BigNumber.fromNumber(1);
    if (this.abs().compareTo(one) > 0) return BigNumber.#allocate(0, 0n, 0, true);

    // For |x| > 0.5: acos(|x|) = 2 * asin(sqrt((1 - |x|) / 2)). The difference PI/2 - asin(x)
    // loses the digits of a result near 0, because each subtraction rounds (#1118).
    const magnitude = this.abs();
    if (magnitude.compareTo(BigNumber.fromNumber(0.5)) > 0) {
      const angle = one.subtract(magnitude).divide(2).sqrt().asin().multiply(2);
      return this._sign === 1 ? angle : BigNumber.piAt().subtract(angle);
    }
    // acos(x) = PI/2 - asin(x)
    return BigNumber.piAt().divide(2).subtract(this.asin());
  }

  /**
   * Arctangent of this BigNumber
   * Returns value in (-PI/2, PI/2)
   * Uses Taylor series with argument reduction for convergence.
   */
  atan(): BigNumber {
    return this.#guarded(() => this.#atanImpl());
  }

  #atanImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    if (this._isInfinite) {
      return this._sign === 1 ? BigNumber.piAt().divide(2) : BigNumber.piAt().divide(-2);
    }

    // For |x| > 1: atan(x) = sign(x)*PI/2 - atan(1/x)
    const one = BigNumber.fromNumber(1);
    if (this.abs().compareTo(one) > 0) {
      const reciprocal = one.divide(this);
      const piHalf = BigNumber.piAt().divide(2);
      return this._sign === 1
        ? piHalf.subtract(reciprocal.atan())
        : piHalf.negate().subtract(reciprocal.atan());
    }

    // For |x| > 0.5: atan(x) = 2*atan(x / (1 + sqrt(1 + x^2)))
    const half = BigNumber.fromNumber(0.5);
    if (this.abs().compareTo(half) > 0) {
      const xSq = this.multiply(this);
      const reduced = this.divide(one.add(one.add(xSq).sqrt()));
      return reduced.atan().multiply(BigNumber.fromNumber(2));
    }

    // Taylor series: atan(x) = x - x^3/3 + x^5/5 - x^7/7 + ...
    // Converges for |x| <= 0.5
    return this._atanTaylor();
  }

  /**
   * Two-argument arctangent: atan2(y, x)
   * this = y, argument = x
   * Returns angle in (-PI, PI]
   */
  atan2(x: BigNumber): BigNumber {
    return this.#guarded(() => this.#atan2Impl(x));
  }

  #atan2Impl(x: BigNumber): BigNumber {
    if (this._isNaN || x._isNaN) return BigNumber.#allocate(0, 0n, 0, true);

    // atan2(0, 0) = 0
    if (this._sign === 0 && x._sign === 0) return BigNumber.fromNumber(0);

    // atan2(y, 0)
    if (x._sign === 0) {
      return this._sign === 1 ? BigNumber.piAt().divide(2) : BigNumber.piAt().divide(-2);
    }

    const angle = this.divide(x).atan();

    if (x.isPositive()) {
      return angle;
    } else if (this.isNegative()) {
      return angle.subtract(BigNumber.piAt());
    } else {
      return angle.add(BigNumber.piAt());
    }
  }

  // ============================================================
  // Hyperbolic Functions
  // ============================================================

  /**
   * Hyperbolic sine: sinh(x) = (e^x - e^(-x)) / 2
   */
  sinh(): BigNumber {
    return this.#guarded(() => this.#sinhImpl());
  }

  #sinhImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return this;
    if (this._sign === 0) return this;

    const ex = this.exp();
    const enx = this.negate().exp();
    return ex.subtract(enx).divide(BigNumber.fromNumber(2));
  }

  /**
   * Hyperbolic cosine: cosh(x) = (e^x + e^(-x)) / 2
   */
  cosh(): BigNumber {
    return this.#guarded(() => this.#coshImpl());
  }

  #coshImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return BigNumber.#allocate(1, 0n, 0, false, true); // +Infinity
    if (this._sign === 0) return BigNumber.fromNumber(1);

    const ex = this.exp();
    const enx = this.negate().exp();
    return ex.add(enx).divide(BigNumber.fromNumber(2));
  }

  /**
   * Hyperbolic tangent: tanh(x) = sinh(x) / cosh(x)
   */
  tanh(): BigNumber {
    return this.#guarded(() => this.#tanhImpl());
  }

  #tanhImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    if (this._isInfinite) return BigNumber.fromNumber(this._sign);

    // tanh(|x|) = -expm1(-2|x|) / (2 + expm1(-2|x|)). The exponent is never positive,
    // so a large |x| gives 1 and not Infinity / Infinity.
    const t = this.abs().multiply(BigNumber.fromNumber(-2)).expm1();
    const magnitude = t.negate().divide(t.add(BigNumber.fromNumber(2)));
    return this._sign === 1 ? magnitude : magnitude.negate();
  }

  /**
   * Inverse hyperbolic sine: asinh(x) = ln(x + sqrt(x^2 + 1))
   */
  asinh(): BigNumber {
    return this.#guarded(() => this.#asinhImpl());
  }

  #asinhImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return this;
    if (this._sign === 0) return this;

    // asinh(|x|) = log1p(|x| + x^2 / (1 + sqrt(x^2 + 1))). The sum x + sqrt(x^2 + 1) rounds, and
    // it loses a small x (#1118).
    const one = BigNumber.fromNumber(1);
    const magnitude = this.abs();
    const square = magnitude.multiply(magnitude);
    const result = magnitude.add(square.divide(one.add(square.add(one).sqrt()))).log1p();
    return this._sign === 1 ? result : result.negate();
  }

  /**
   * Inverse hyperbolic cosine: acosh(x) = ln(x + sqrt(x^2 - 1))
   * Domain: x >= 1
   */
  acosh(): BigNumber {
    return this.#guarded(() => this.#acoshImpl());
  }

  #acoshImpl(): BigNumber {
    if (this._isNaN) return this;
    const one = BigNumber.fromNumber(1);
    if (this.compareTo(one) < 0) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._isInfinite) return this;

    // acosh(x) = log1p(d + sqrt(d * (x + 1))) with d = x - 1. The sum x + sqrt(x^2 - 1) rounds,
    // and it loses the digits of a result near 0 (#1118).
    const d = this.subtract(one);
    return d.add(d.multiply(this.add(one)).sqrt()).log1p();
  }

  /**
   * Inverse hyperbolic tangent: atanh(x) = 0.5 * ln((1+x)/(1-x))
   * Domain: -1 < x < 1
   */
  atanh(): BigNumber {
    return this.#guarded(() => this.#atanhImpl());
  }

  #atanhImpl(): BigNumber {
    if (this._isNaN) return this;
    const one = BigNumber.fromNumber(1);
    const absVal = this.abs();

    if (absVal.compareTo(one) > 0) return BigNumber.#allocate(0, 0n, 0, true);
    if (absVal.equals(one)) {
      return this._sign === 1
        ? BigNumber.#allocate(1, 0n, 0, false, true)
        : BigNumber.#allocate(-1, 0n, 0, false, true);
    }
    if (this._sign === 0) return this;

    // atanh(|x|) = log1p(2 |x| / (1 - |x|)) / 2. The quotient (1 + x) / (1 - x) loses a small x.
    const half = BigNumber.fromNumber(0.5);
    const result = absVal.multiply(2).divide(one.subtract(absVal)).log1p().multiply(half);
    return this._sign === 1 ? result : result.negate();
  }

  // ============================================================
  // Transcendental Functions
  // ============================================================

  /**
   * Exponential function: e^x
   * Uses Taylor series: e^x = 1 + x + x^2/2! + x^3/3! + ...
   * With argument reduction: e^x = (e^(x/2^k))^(2^k) for faster convergence.
   */
  exp(): BigNumber {
    return this.#guarded(() => this.#expImpl());
  }

  #expImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return BigNumber.fromNumber(1);
    if (this._isInfinite) {
      return this._sign === 1 ? this : BigNumber.fromNumber(0);
    }

    // Decimal reduction: e^x = 10^m * e^r, with r = x - m*ln(10) and |r| <= ln(10)/2.
    // Then e^r = (e^(r/2^k))^(2^k) with a small k, so the squarings add little error.
    const precision = globalConfig.precision;
    const magnitude = Math.abs(this.valueOf());
    if (magnitude > EXP_DECIMAL_LIMIT * Math.LN10) {
      return this._sign === 1
        ? BigNumber.#allocate(1, 0n, 0, false, true)
        : BigNumber.fromNumber(0);
    }
    if (magnitude > Math.LN10) {
      const order = this._coefficient.toString().length + this._exponent;
      const saved = globalConfig;
      globalConfig = { ...saved, precision: precision + Math.max(0, order) + GUARD_DIGITS };
      let m: number;
      let r: BigNumber;
      try {
        const ln10 = BigNumber.ln10At();
        m = this.divide(ln10).round(0, 'halfEven').toNumber();
        r = this.subtract(ln10.multiply(BigNumber.fromNumber(m))).roundToPrecision(precision);
      } finally {
        globalConfig = saved;
      }
      const er = r.#expImpl();
      return BigNumber.#allocate(er._sign, er._coefficient, er._exponent + m);
    }
    const val = magnitude;

    // Choose k so that |x/2^k| < 0.5
    let k = 0;
    if (val > 0.5) {
      k = Math.ceil(Math.log2(val * 2));
    }

    const divisor = BigNumber.fromNumber(2).pow(k);
    const reduced = this.divide(divisor);

    // Taylor series for small argument
    let sum = BigNumber.fromNumber(1);
    let term = BigNumber.fromNumber(1);
    const maxIter = seriesIterationLimit(precision);

    for (let n = 1; n <= maxIter; n++) {
      term = term.multiply(reduced).divide(BigNumber.fromNumber(n));
      const newSum = sum.add(term).roundToPrecision(precision);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    // Square back up k times
    for (let i = 0; i < k; i++) {
      sum = sum.multiply(sum);
    }

    return sum.roundToPrecision(precision);
  }

  /**
   * Natural logarithm: ln(x)
   * Uses the AGM (arithmetic-geometric mean) method for fast convergence.
   * Fallback: series ln((1+y)/(1-y)) = 2*(y + y^3/3 + y^5/5 + ...) where y = (x-1)/(x+1)
   */
  ln(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === -1) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._sign === 0) return BigNumber.#allocate(-1, 0n, 0, false, true);
    if (this._isInfinite) return this;

    const one = BigNumber.fromNumber(1);
    if (this.equals(one)) return BigNumber.fromNumber(0);

    return this.#guarded(() => this.#lnSeries(one));
  }

  /** The series part of `ln`, at the current (raised) precision. */
  #lnSeries(one: BigNumber): BigNumber {
    // Argument reduction: ln(x) = ln(x / 2^k) + k * ln(2)
    // Bring x into range [0.5, 2] for better convergence
    let x = this.clone();
    let k = 0;
    const two = BigNumber.fromNumber(2);
    const half = BigNumber.fromNumber(0.5);

    while (x.compareTo(two) > 0) {
      x = x.divide(two);
      k++;
    }
    while (x.compareTo(half) < 0) {
      x = x.multiply(two);
      k--;
    }

    // Series: ln(x) = 2 * sum_{n=0}^{inf} (1/(2n+1)) * ((x-1)/(x+1))^(2n+1)
    let sum = x.subtract(one).divide(x.add(one)).#twiceAtanhSeries();

    // Add back reduction: k * ln(2)
    if (k !== 0) {
      sum = sum.add(BigNumber.ln2At().multiply(BigNumber.fromNumber(k)));
    }

    return sum;
  }

  /** `2 * atanh(this)` by the series 2 * (y + y^3/3 + y^5/5 + ...), at the current precision. */
  #twiceAtanhSeries(): BigNumber {
    const precision = globalConfig.precision;
    const ySq = this.multiply(this);
    let term = this.clone();
    let sum = this.clone();
    const maxIter = seriesIterationLimit(precision);

    for (let n = 1; n <= maxIter; n++) {
      term = term.multiply(ySq).roundToPrecision(precision);
      const contribution = term.divide(BigNumber.fromNumber(2 * n + 1));
      const newSum = sum.add(contribution).roundToPrecision(precision);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    return sum.multiply(BigNumber.fromNumber(2));
  }

  /**
   * Base-10 logarithm: log10(x) = ln(x) / ln(10)
   */
  log10(): BigNumber {
    return this.#guarded(() => this.#log10Impl());
  }

  #log10Impl(): BigNumber {
    return this.ln().divide(BigNumber.ln10At());
  }

  /**
   * Base-2 logarithm: log2(x) = ln(x) / ln(2)
   */
  log2(): BigNumber {
    return this.#guarded(() => this.#log2Impl());
  }

  #log2Impl(): BigNumber {
    return this.ln().divide(BigNumber.ln2At());
  }

  /**
   * Cube root
   * Uses Newton-Raphson iteration.
   */
  cbrt(): BigNumber {
    return this.#guarded(() => this.#cbrtImpl());
  }

  #cbrtImpl(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    if (this._isInfinite) return this;

    // Handle negative numbers: cbrt(-x) = -cbrt(x)
    if (this._sign === -1) {
      return this.negate().cbrt().negate();
    }

    const precision = globalConfig.precision;
    const three = BigNumber.fromNumber(3);
    let guess = BigNumber.fromNumber(Math.cbrt(this.valueOf()));

    // Newton's method: x_{n+1} = (2*x_n + a / x_n^2) / 3
    for (let i = 0; i < 100; i++) {
      const guessSquared = guess.multiply(guess);
      const newGuess = guess
        .multiply(BigNumber.fromNumber(2))
        .add(this.divide(guessSquared))
        .divide(three);
      if (
        guess
          .subtract(newGuess)
          .abs()
          .compareTo(guess.abs().multiply(BigNumber.parse('1e-' + (precision + 5)))) <= 0
      ) {
        return newGuess.roundToPrecision(precision);
      }
      guess = newGuess;
    }

    return guess.roundToPrecision(precision);
  }

  /**
   * e^x - 1 (more precise than exp(x) - 1 for small x)
   * Uses Taylor series directly: expm1(x) = x + x^2/2! + x^3/3! + ...
   */
  expm1(): BigNumber {
    return this.#guarded(() => this.#expm1Impl());
  }

  #expm1Impl(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    if (this._isInfinite) {
      return this._sign === 1 ? this : BigNumber.fromNumber(-1);
    }

    // For large |x|, just use exp(x) - 1
    if (Math.abs(this.valueOf()) > 0.5) {
      return this.exp().subtract(BigNumber.fromNumber(1));
    }

    // Taylor series: x + x^2/2! + x^3/3! + ...
    const precision = globalConfig.precision;
    let term = this.clone();
    let sum = this.clone();
    const maxIter = seriesIterationLimit(precision);

    for (let n = 2; n <= maxIter; n++) {
      term = term.multiply(this).divide(BigNumber.fromNumber(n));
      const newSum = sum.add(term).roundToPrecision(precision);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    return sum.roundToPrecision(precision);
  }

  /**
   * ln(1 + x), with the full precision for a small x
   */
  log1p(): BigNumber {
    return this.#guarded(() => this.#log1pImpl());
  }

  #log1pImpl(): BigNumber {
    if (this._isNaN) return this;
    const one = BigNumber.fromNumber(1);
    const negOne = BigNumber.fromNumber(-1);

    if (this.compareTo(negOne) < 0) return BigNumber.#allocate(0, 0n, 0, true);
    if (this.equals(negOne)) return BigNumber.#allocate(-1, 0n, 0, false, true);
    if (this._sign === 0) return this;

    // 1 + x rounds to the precision and loses a small x (#1118). For |x| < 0.5 the series runs
    // on x / (x + 2): ln(1 + x) = 2 * atanh(x / (x + 2)).
    if (this.abs().compareTo(BigNumber.fromNumber(0.5)) < 0) {
      return this.divide(this.add(BigNumber.fromNumber(2))).#twiceAtanhSeries();
    }
    return one.add(this).ln();
  }

  /**
   * Hypotenuse: sqrt(this^2 + other^2)
   */
  hypot(other: BigNumber): BigNumber {
    if (this._isNaN || other._isNaN) return BigNumber.#allocate(0, 0n, 0, true);
    if (this._isInfinite || other._isInfinite) return BigNumber.#allocate(1, 0n, 0, false, true);

    return this.multiply(this).add(other.multiply(other)).sqrt();
  }

  // ============================================================
  // Private Taylor Series Helpers
  // ============================================================

  /**
   * Reduce the angle to the range [-PI, PI].
   * The reduction keeps every digit of the integer part of x / (2 PI), so the
   * working precision grows with the magnitude of x.
   */
  private _reduceAngle(): BigNumber {
    if (this.abs().compareTo(BigNumber.piAt()) <= 0) {
      return this;
    }
    const precision = globalConfig.precision;
    const order = this._coefficient.toString().length + this._exponent;
    const saved = globalConfig;
    globalConfig = { ...saved, precision: precision + Math.max(0, order) + GUARD_DIGITS };
    try {
      const pi = BigNumber.piAt();
      const twoPi = pi.multiply(BigNumber.fromNumber(2));
      const quotient = this.divide(twoPi).round(0, 'halfUp');
      let reduced = this.subtract(twoPi.multiply(quotient));
      if (reduced.compareTo(pi) > 0) {
        reduced = reduced.subtract(twoPi);
      } else if (reduced.compareTo(pi.negate()) < 0) {
        reduced = reduced.add(twoPi);
      }
      return reduced.roundToPrecision(precision);
    } finally {
      globalConfig = saved;
    }
  }

  /**
   * Alternating even-power Taylor loop: term ← −term·x²/denom(n), stop when sum is stable.
   * @param initialTerm - seed for the running term (also the first series contribution path for sin)
   * @param initialSum - partial sum before the n = 1 step
   * @param denom - factorial-style divisor; n only runs to precision + 20 so products stay in safe integer range
   */
  private _alternatingEvenTaylor(
    initialTerm: BigNumber,
    initialSum: BigNumber,
    denom: (n: number) => number
  ): BigNumber {
    const precision = globalConfig.precision;
    let term = initialTerm;
    let sum = initialSum;
    const xSquared = this.multiply(this);
    const maxIter = seriesIterationLimit(precision);

    for (let n = 1; n <= maxIter; n++) {
      term = term
        .multiply(xSquared)
        .divide(BigNumber.fromNumber(denom(n)))
        .negate();
      const newSum = sum.add(term).roundToPrecision(precision);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    return sum.roundToPrecision(precision);
  }

  /** Taylor series for sin(x), assumes x is in [-PI, PI] */
  private _sinTaylor(): BigNumber {
    return this._alternatingEvenTaylor(this.clone(), this.clone(), (n) => 2 * n * (2 * n + 1));
  }

  /** Taylor series for cos(x), assumes x is in [-PI, PI] */
  private _cosTaylor(): BigNumber {
    return this._alternatingEvenTaylor(
      BigNumber.fromNumber(1),
      BigNumber.fromNumber(1),
      (n) => (2 * n - 1) * (2 * n)
    );
  }

  /** Taylor series for atan(x), assumes |x| <= 0.5 */
  private _atanTaylor(): BigNumber {
    const precision = globalConfig.precision;
    const xSquared = this.multiply(this);
    let term = this.clone();
    let sum = this.clone();
    const maxIter = seriesIterationLimit(precision);

    for (let n = 1; n <= maxIter; n++) {
      term = term.multiply(xSquared).negate().roundToPrecision(precision);
      const contribution = term.divide(BigNumber.fromNumber(2 * n + 1));
      const newSum = sum.add(contribution).roundToPrecision(precision);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    return sum.roundToPrecision(precision);
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  isNaN(): boolean {
    return this._isNaN;
  }

  isFinite(): boolean {
    return !this._isNaN && !this._isInfinite;
  }

  isInfinite(): boolean {
    return this._isInfinite;
  }

  isZero(): boolean {
    return this._sign === 0 && !this._isNaN;
  }

  isPositive(): boolean {
    return this._sign === 1;
  }

  isNegative(): boolean {
    return this._sign === -1;
  }

  isInteger(): boolean {
    // NaN has sign 0 too, so test it first. NaN and Infinity are not integers, as in decimal.js.
    if (this._isNaN || this._isInfinite) return false;
    if (this._sign === 0) return true;
    return this._exponent >= 0;
  }

  sign(): number {
    return this._sign;
  }

  clone(): BigNumber {
    return BigNumber.#allocate(
      this._sign,
      this._coefficient,
      this._exponent,
      this._isNaN,
      this._isInfinite
    );
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  private ensureBigNumber(value: Scalar | BigNumber | number | string): BigNumber {
    if (isBigNumber(value)) return value;
    if (typeof value === 'number') return BigNumber.fromNumber(value);
    if (typeof value === 'string') return BigNumber.parse(value);
    if (isFraction(value)) {
      // numerator / denominator at the configured precision, not through a 16-digit number (#1117)
      return BigNumber.fromFraction(value);
    }
    return BigNumber.fromNumber(Number(value.valueOf()));
  }

  private alignExponents(a: BigNumber, b: BigNumber): [bigint, bigint, number] {
    const minExp = Math.min(a._exponent, b._exponent);
    const aShift = a._exponent - minExp;
    const bShift = b._exponent - minExp;

    const aCoef = aShift > 0 ? a._coefficient * pow10(aShift) : a._coefficient;
    const bCoef = bShift > 0 ? b._coefficient * pow10(bShift) : b._coefficient;

    return [aCoef, bCoef, minExp];
  }

  /**
   * The result of an add or a multiply from its exact coefficient: rounded to the configured
   * precision, with no trailing zeros. A zero coefficient gives zero.
   */
  private rounded(sign: 1 | -1 | 0, coefficient: bigint, exponent: number): BigNumber {
    const precision = globalConfig.precision;
    if (coefficient === 0n || fitsPrecision(coefficient, precision)) {
      return this.normalize(sign, coefficient, exponent);
    }
    // The rounding step strips the trailing zeros, so the exact value needs no normalize first.
    return BigNumber.#allocate(sign, coefficient, exponent).roundExcessDigits(
      precision,
      globalConfig.rounding
    );
  }

  private normalize(sign: 1 | -1 | 0, coefficient: bigint, exponent: number): BigNumber {
    if (coefficient === 0n) {
      return BigNumber.#allocate(0, 0n, 0);
    }

    // Remove trailing zeros
    let coef = coefficient;
    let exp = exponent;
    // An odd coefficient has no trailing zero. For a long coefficient the bit test is much
    // cheaper than a division. For a short one the division is cheaper than the bit test.
    while ((coef < BIT_TEST_LIMIT || (coef & 1n) === 0n) && coef % 10n === 0n) {
      coef = coef / 10n;
      exp++;
    }

    return BigNumber.#allocate(sign, coef, exp);
  }
}

// Prototype markers: the brand that `isBigNumber` reads, and the mathjs marker. The instance field
// `isBigNumber` stays as it is.
defineTypeMarkers(BigNumber.prototype, BIGNUMBER_BRAND, 'isBigNumber');

/**
 * Common BigNumber constants
 */
/**
 * mathjs-compatible factory — same dispatch as {@link BigNumber.from}.
 */
export function bignumber(value?: number | string | bigint | BigNumber): BigNumber {
  if (value === undefined) {
    return BigNumber.fromNumber(0);
  }
  return BigNumber.from(value);
}

export const BIGNUMBER_ZERO = BigNumber.fromNumber(0);
export const BIGNUMBER_ONE = BigNumber.fromNumber(1);
export const BIGNUMBER_NEG_ONE = BigNumber.fromNumber(-1);
export const BIGNUMBER_TEN = BigNumber.fromNumber(10);

/**
 * The number of significant digits of the exported constants below. A constant does not follow
 * the `precision` option. For a value at the configured precision, use `BigNumber.piAt()`,
 * `eAt()`, `ln2At()` or `ln10At()`.
 */
const BIGNUMBER_CONSTANT_DIGITS = 100;

export const BIGNUMBER_PI = BigNumber.piAt(BIGNUMBER_CONSTANT_DIGITS);
export const BIGNUMBER_E = BigNumber.eAt(BIGNUMBER_CONSTANT_DIGITS);
export const BIGNUMBER_LN2 = BigNumber.ln2At(BIGNUMBER_CONSTANT_DIGITS);
export const BIGNUMBER_LN10 = BigNumber.ln10At(BIGNUMBER_CONSTANT_DIGITS);
