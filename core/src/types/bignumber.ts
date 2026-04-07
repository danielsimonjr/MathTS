/**
 * BigNumber (arbitrary precision decimal) implementation
 * @module @danielsimonjr/mathts-core/types/bignumber
 */

import type { Scalar, MathTSValue } from './interfaces';

/**
 * Check if a value is a BigNumber
 */
export function isBigNumber(value: unknown): value is BigNumber {
  return value instanceof BigNumber;
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

export type RoundingMode =
  | 'up'        // Round away from zero
  | 'down'      // Round toward zero (truncate)
  | 'ceil'      // Round toward +Infinity
  | 'floor'     // Round toward -Infinity
  | 'halfUp'    // Round half away from zero (default)
  | 'halfDown'  // Round half toward zero
  | 'halfEven'  // Round half to even (banker's rounding)
  | 'halfCeil'  // Round half toward +Infinity
  | 'halfFloor';// Round half toward -Infinity

// Default configuration
const defaultConfig: BigNumberConfig = {
  precision: 64,
  rounding: 'halfUp',
  minExponent: -1e9,
  maxExponent: 1e9
};

// Global configuration (can be modified)
let globalConfig: BigNumberConfig = { ...defaultConfig };

/**
 * BigNumber class for arbitrary precision decimal arithmetic
 *
 * Internally stores: sign * coefficient * 10^exponent
 * where coefficient is a bigint with the significant digits.
 */
export class BigNumber implements MathTSValue {
  readonly type = 'BigNumber';

  // Internal representation: sign * coefficient * 10^exponent
  private readonly _sign: 1 | -1 | 0;
  private readonly _coefficient: bigint;  // Absolute value, normalized
  private readonly _exponent: number;     // Power of 10

  // Special values
  private readonly _isNaN: boolean = false;
  private readonly _isInfinite: boolean = false;

  private constructor(
    sign: 1 | -1 | 0,
    coefficient: bigint,
    exponent: number,
    isNaN: boolean = false,
    isInfinite: boolean = false
  ) {
    this._sign = sign;
    this._coefficient = coefficient;
    this._exponent = exponent;
    this._isNaN = isNaN;
    this._isInfinite = isInfinite;
  }

  // ============================================================
  // Static Factory Methods
  // ============================================================

  /**
   * Create a BigNumber from a number
   */
  static fromNumber(n: number): BigNumber {
    if (Number.isNaN(n)) {
      return new BigNumber(0, 0n, 0, true, false);
    }
    if (!Number.isFinite(n)) {
      return new BigNumber(n > 0 ? 1 : -1, 0n, 0, false, true);
    }
    if (n === 0) {
      return new BigNumber(0, 0n, 0);
    }

    // Convert to string to preserve precision
    return BigNumber.parse(n.toString());
  }

  /**
   * Create a BigNumber from a string
   */
  static parse(str: string): BigNumber {
    str = str.trim().toLowerCase();

    // Handle special values
    if (str === 'nan') {
      return new BigNumber(0, 0n, 0, true, false);
    }
    if (str === 'infinity' || str === '+infinity') {
      return new BigNumber(1, 0n, 0, false, true);
    }
    if (str === '-infinity') {
      return new BigNumber(-1, 0n, 0, false, true);
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
      return new BigNumber(0, 0n, 0);
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

    return new BigNumber(sign, BigInt(coefficient), finalExponent);
  }

  /**
   * Create from bigint
   */
  static fromBigInt(n: bigint): BigNumber {
    if (n === 0n) {
      return new BigNumber(0, 0n, 0);
    }
    const sign: 1 | -1 = n < 0n ? -1 : 1;
    let str = (n < 0n ? -n : n).toString();

    // Remove trailing zeros
    let trailingZeros = 0;
    for (let i = str.length - 1; i >= 0; i--) {
      if (str[i] === '0') {
        trailingZeros++;
      } else {
        break;
      }
    }

    if (trailingZeros > 0) {
      str = str.slice(0, -trailingZeros);
    }

    return new BigNumber(sign, BigInt(str), trailingZeros);
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
    return a._sign === 1 ? result : -result as -1 | 0 | 1;
  }

  private static compareMagnitude(a: BigNumber, b: BigNumber): -1 | 0 | 1 {
    // Normalize to same exponent for comparison
    const aDigits = a._coefficient.toString();
    const bDigits = b._coefficient.toString();
    const aOrder = aDigits.length + a._exponent;
    const bOrder = bDigits.length + b._exponent;

    if (aOrder !== bOrder) {
      return aOrder > bOrder ? 1 : -1;
    }

    // Same order of magnitude - compare digit by digit
    const aFull = aDigits + '0'.repeat(Math.max(0, a._exponent));
    const bFull = bDigits + '0'.repeat(Math.max(0, b._exponent));

    if (aFull === bFull) return 0;
    return aFull > bFull ? 1 : -1;
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
      value: this.toString()
    };
  }

  /**
   * Convert to fixed-point notation
   */
  toFixed(decimalPlaces: number = 0): string {
    return this.round(decimalPlaces).toFixedInternal(decimalPlaces);
  }

  private toFixedInternal(decimalPlaces: number): string {
    if (this._isNaN) return 'NaN';
    if (this._isInfinite) return this._sign === 1 ? 'Infinity' : '-Infinity';
    if (this._sign === 0) return decimalPlaces > 0 ? '0.' + '0'.repeat(decimalPlaces) : '0';

    const sign = this._sign === -1 ? '-' : '';
    const digits = this._coefficient.toString();

    if (this._exponent >= 0) {
      // No decimal places needed in internal representation
      const intPart = digits + '0'.repeat(this._exponent);
      return sign + intPart + (decimalPlaces > 0 ? '.' + '0'.repeat(decimalPlaces) : '');
    } else if (-this._exponent <= digits.length) {
      const insertPos = digits.length + this._exponent;
      const intPart = digits.slice(0, insertPos) || '0';
      let decPart = digits.slice(insertPos);
      if (decPart.length < decimalPlaces) {
        decPart += '0'.repeat(decimalPlaces - decPart.length);
      }
      return sign + intPart + (decimalPlaces > 0 ? '.' + decPart.slice(0, decimalPlaces) : '');
    } else {
      const leadingZeros = -this._exponent - digits.length;
      let decPart = '0'.repeat(leadingZeros) + digits;
      if (decPart.length < decimalPlaces) {
        decPart += '0'.repeat(decimalPlaces - decPart.length);
      }
      return sign + '0' + (decimalPlaces > 0 ? '.' + decPart.slice(0, decimalPlaces) : '');
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

  // ============================================================
  // Arithmetic Operations
  // ============================================================

  /**
   * Addition
   */
  add(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);

    if (this._isNaN || b._isNaN) return new BigNumber(0, 0n, 0, true);
    if (this._isInfinite && b._isInfinite) {
      if (this._sign === b._sign) return this;
      return new BigNumber(0, 0n, 0, true); // Infinity - Infinity = NaN
    }
    if (this._isInfinite) return this;
    if (b._isInfinite) return b;
    if (this._sign === 0) return b;
    if (b._sign === 0) return this;

    // Align exponents
    const [aCoef, bCoef, exp] = this.alignExponents(this, b);

    if (this._sign === b._sign) {
      // Same sign: add coefficients
      return this.normalize(this._sign, aCoef + bCoef, exp);
    } else {
      // Different signs: subtract coefficients
      if (aCoef >= bCoef) {
        const diff = aCoef - bCoef;
        return this.normalize(diff === 0n ? 0 : this._sign, diff, exp);
      } else {
        return this.normalize(b._sign, bCoef - aCoef, exp);
      }
    }
  }

  /**
   * Subtraction
   */
  subtract(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);
    return this.add(b.negate());
  }

  /**
   * Multiplication
   */
  multiply(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);

    if (this._isNaN || b._isNaN) return new BigNumber(0, 0n, 0, true);
    if (this._isInfinite || b._isInfinite) {
      if (this._sign === 0 || b._sign === 0) return new BigNumber(0, 0n, 0, true); // 0 * Infinity = NaN
      const sign: 1 | -1 = (this._sign * b._sign) as 1 | -1;
      return new BigNumber(sign, 0n, 0, false, true);
    }
    if (this._sign === 0 || b._sign === 0) return new BigNumber(0, 0n, 0);

    const sign: 1 | -1 = (this._sign * b._sign) as 1 | -1;
    const coefficient = this._coefficient * b._coefficient;
    const exponent = this._exponent + b._exponent;

    return this.normalize(sign, coefficient, exponent);
  }

  /**
   * Division
   */
  divide(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);

    if (this._isNaN || b._isNaN) return new BigNumber(0, 0n, 0, true);
    if (this._isInfinite && b._isInfinite) return new BigNumber(0, 0n, 0, true);
    if (b._sign === 0) {
      if (this._sign === 0) return new BigNumber(0, 0n, 0, true);
      return new BigNumber(this._sign, 0n, 0, false, true);
    }
    if (this._isInfinite) {
      const sign: 1 | -1 = (this._sign * b._sign) as 1 | -1;
      return new BigNumber(sign, 0n, 0, false, true);
    }
    if (b._isInfinite) return new BigNumber(0, 0n, 0);
    if (this._sign === 0) return new BigNumber(0, 0n, 0);

    const sign: 1 | -1 = (this._sign * b._sign) as 1 | -1;
    const precision = globalConfig.precision;

    // Scale dividend for precision
    const scale = BigInt(10) ** BigInt(precision + 10);
    const scaledDividend = this._coefficient * scale;
    const quotient = scaledDividend / b._coefficient;
    const exponent = this._exponent - b._exponent - precision - 10;

    return this.normalize(sign, quotient, exponent).roundToPrecision(precision);
  }

  /**
   * Negation
   */
  negate(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    const newSign: 1 | -1 = this._sign === 1 ? -1 : 1;
    return new BigNumber(newSign, this._coefficient, this._exponent, false, this._isInfinite);
  }

  /**
   * Absolute value
   */
  abs(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    return new BigNumber(1, this._coefficient, this._exponent, false, this._isInfinite);
  }

  /**
   * Power (integer exponent)
   */
  pow(n: number | bigint): BigNumber {
    const exp = typeof n === 'bigint' ? Number(n) : n;

    if (this._isNaN) return this;
    if (exp === 0) return BigNumber.fromNumber(1);
    if (this._sign === 0) {
      if (exp < 0) return new BigNumber(1, 0n, 0, false, true); // 0^(-n) = Infinity
      return this;
    }
    if (exp < 0) {
      return BigNumber.fromNumber(1).divide(this.pow(-exp));
    }

    // Binary exponentiation
    let result = BigNumber.fromNumber(1);
    let base: BigNumber = this;
    let e = exp;

    while (e > 0) {
      if (e % 2 === 1) {
        result = result.multiply(base);
      }
      base = base.multiply(base);
      e = Math.floor(e / 2);
    }

    return result.roundToPrecision(globalConfig.precision);
  }

  /**
   * Square root
   */
  sqrt(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === -1) return new BigNumber(0, 0n, 0, true);
    if (this._sign === 0) return this;
    if (this._isInfinite) return this;

    // Newton-Raphson iteration
    const precision = globalConfig.precision;
    let guess = BigNumber.fromNumber(Math.sqrt(this.valueOf()));

    for (let i = 0; i < 100; i++) {
      const newGuess = guess.add(this.divide(guess)).divide(BigNumber.fromNumber(2));
      if (guess.subtract(newGuess).abs().compareTo(guess.multiply(BigNumber.parse('1e-' + (precision + 5)))) <= 0) {
        return newGuess.roundToPrecision(precision);
      }
      guess = newGuess;
    }

    return guess.roundToPrecision(precision);
  }

  // ============================================================
  // Comparison Methods
  // ============================================================

  equals(other: BigNumber): boolean {
    return BigNumber.compare(this, other) === 0;
  }

  lessThan(other: BigNumber): boolean {
    return BigNumber.compare(this, other) < 0;
  }

  lessThanOrEqual(other: BigNumber): boolean {
    return BigNumber.compare(this, other) <= 0;
  }

  greaterThan(other: BigNumber): boolean {
    return BigNumber.compare(this, other) > 0;
  }

  greaterThanOrEqual(other: BigNumber): boolean {
    return BigNumber.compare(this, other) >= 0;
  }

  compareTo(other: BigNumber): number {
    return BigNumber.compare(this, other);
  }

  compare(other: BigNumber): number {
    return this.compareTo(other);
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
      case 'up': return remainder > 0n;
      case 'down': return false;
      case 'ceil': return isPositive && remainder > 0n;
      case 'floor': return !isPositive && remainder > 0n;
      case 'halfUp': return isMoreThanHalf || isExactlyHalf;
      case 'halfDown': return isMoreThanHalf;
      case 'halfEven': return isMoreThanHalf || (isExactlyHalf && quotient % 2n !== 0n);
      case 'halfCeil': return isMoreThanHalf || (isExactlyHalf && isPositive);
      case 'halfFloor': return isMoreThanHalf || (isExactlyHalf && !isPositive);
      default: return isMoreThanHalf || isExactlyHalf;
    }
  }

  /**
   * Round to specified precision (significant digits)
   */
  roundToPrecision(precision: number, mode: RoundingMode = globalConfig.rounding): BigNumber {
    if (this._isNaN || this._isInfinite || this._sign === 0) return this;

    const digits = this._coefficient.toString();
    if (digits.length <= precision) return this;

    // Calculate how many digits to remove from the coefficient
    const digitsToRemove = digits.length - precision;
    const divisor = BigInt(10) ** BigInt(digitsToRemove);
    const quotient = this._coefficient / divisor;
    const remainder = this._coefficient % divisor;
    const halfDivisor = divisor / 2n;

    let rounded = quotient;
    const shouldRoundUp = this.shouldRound(remainder, halfDivisor, divisor, quotient, mode);
    if (shouldRoundUp) {
      rounded += 1n;
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

  // ============================================================
  // Modular Arithmetic
  // ============================================================

  /**
   * Modulo (remainder after division)
   * Result has the same sign as the dividend (this).
   */
  mod(other: Scalar | BigNumber | number | string): BigNumber {
    const b = this.ensureBigNumber(other);
    if (this._isNaN || b._isNaN || b._sign === 0) return new BigNumber(0, 0n, 0, true);
    if (this._isInfinite) return new BigNumber(0, 0n, 0, true);
    if (b._isInfinite) return this;
    if (this._sign === 0) return this;

    // a mod b = a - b * trunc(a / b)
    const quotient = this.divide(b).trunc();
    return this.subtract(b.multiply(quotient));
  }

  // ============================================================
  // Trigonometric Functions
  // ============================================================

  /**
   * Sine of this BigNumber (in radians)
   * Uses Taylor series: sin(x) = x - x^3/3! + x^5/5! - ...
   */
  sin(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return new BigNumber(0, 0n, 0, true);
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
    if (this._isNaN) return this;
    if (this._isInfinite) return new BigNumber(0, 0n, 0, true);
    if (this._sign === 0) return BigNumber.fromNumber(1);

    const x = this._reduceAngle();
    return x._cosTaylor();
  }

  /**
   * Tangent of this BigNumber (in radians)
   * tan(x) = sin(x) / cos(x)
   */
  tan(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return new BigNumber(0, 0n, 0, true);
    if (this._sign === 0) return this;

    const x = this._reduceAngle();
    return x._sinTaylor().divide(x._cosTaylor());
  }

  /**
   * Arcsine of this BigNumber
   * Returns value in [-PI/2, PI/2]
   */
  asin(): BigNumber {
    if (this._isNaN) return this;
    // Domain: [-1, 1]
    const one = BigNumber.fromNumber(1);
    if (this.abs().compareTo(one) > 0) return new BigNumber(0, 0n, 0, true);
    if (this._sign === 0) return this;

    // For |x| close to 1: asin(x) = PI/2 - 2*asin(sqrt((1-x)/2)) * sign(x)
    // For small x use Taylor series via atan: asin(x) = atan(x / sqrt(1 - x^2))
    const xSquared = this.multiply(this);
    const denominator = one.subtract(xSquared).sqrt();
    if (denominator.isZero()) {
      // |x| = 1 exactly
      return this._sign === 1
        ? BIGNUMBER_PI.divide(2)
        : BIGNUMBER_PI.divide(-2);
    }
    return this.divide(denominator).atan();
  }

  /**
   * Arccosine of this BigNumber
   * Returns value in [0, PI]
   */
  acos(): BigNumber {
    if (this._isNaN) return this;
    const one = BigNumber.fromNumber(1);
    if (this.abs().compareTo(one) > 0) return new BigNumber(0, 0n, 0, true);

    // acos(x) = PI/2 - asin(x)
    return BIGNUMBER_PI.divide(2).subtract(this.asin());
  }

  /**
   * Arctangent of this BigNumber
   * Returns value in (-PI/2, PI/2)
   * Uses Taylor series with argument reduction for convergence.
   */
  atan(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    if (this._isInfinite) {
      return this._sign === 1
        ? BIGNUMBER_PI.divide(2)
        : BIGNUMBER_PI.divide(-2);
    }

    // For |x| > 1: atan(x) = sign(x)*PI/2 - atan(1/x)
    const one = BigNumber.fromNumber(1);
    if (this.abs().compareTo(one) > 0) {
      const reciprocal = one.divide(this);
      const piHalf = BIGNUMBER_PI.divide(2);
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
    if (this._isNaN || x._isNaN) return new BigNumber(0, 0n, 0, true);

    // atan2(0, 0) = 0
    if (this._sign === 0 && x._sign === 0) return BigNumber.fromNumber(0);

    // atan2(y, 0)
    if (x._sign === 0) {
      return this._sign === 1 ? BIGNUMBER_PI.divide(2) : BIGNUMBER_PI.divide(-2);
    }

    const angle = this.divide(x).atan();

    if (x.isPositive()) {
      return angle;
    } else if (this.isNegative()) {
      return angle.subtract(BIGNUMBER_PI);
    } else {
      return angle.add(BIGNUMBER_PI);
    }
  }

  // ============================================================
  // Hyperbolic Functions
  // ============================================================

  /**
   * Hyperbolic sine: sinh(x) = (e^x - e^(-x)) / 2
   */
  sinh(): BigNumber {
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
    if (this._isNaN) return this;
    if (this._isInfinite) return new BigNumber(1, 0n, 0, false, true); // +Infinity
    if (this._sign === 0) return BigNumber.fromNumber(1);

    const ex = this.exp();
    const enx = this.negate().exp();
    return ex.add(enx).divide(BigNumber.fromNumber(2));
  }

  /**
   * Hyperbolic tangent: tanh(x) = sinh(x) / cosh(x)
   */
  tanh(): BigNumber {
    if (this._isNaN) return this;
    if (this._sign === 0) return this;
    if (this._isInfinite) return BigNumber.fromNumber(this._sign);

    const ex = this.exp();
    const enx = this.negate().exp();
    return ex.subtract(enx).divide(ex.add(enx));
  }

  /**
   * Inverse hyperbolic sine: asinh(x) = ln(x + sqrt(x^2 + 1))
   */
  asinh(): BigNumber {
    if (this._isNaN) return this;
    if (this._isInfinite) return this;
    if (this._sign === 0) return this;

    const one = BigNumber.fromNumber(1);
    return this.add(this.multiply(this).add(one).sqrt()).ln();
  }

  /**
   * Inverse hyperbolic cosine: acosh(x) = ln(x + sqrt(x^2 - 1))
   * Domain: x >= 1
   */
  acosh(): BigNumber {
    if (this._isNaN) return this;
    const one = BigNumber.fromNumber(1);
    if (this.compareTo(one) < 0) return new BigNumber(0, 0n, 0, true);
    if (this._isInfinite) return this;

    return this.add(this.multiply(this).subtract(one).sqrt()).ln();
  }

  /**
   * Inverse hyperbolic tangent: atanh(x) = 0.5 * ln((1+x)/(1-x))
   * Domain: -1 < x < 1
   */
  atanh(): BigNumber {
    if (this._isNaN) return this;
    const one = BigNumber.fromNumber(1);
    const absVal = this.abs();

    if (absVal.compareTo(one) > 0) return new BigNumber(0, 0n, 0, true);
    if (absVal.equals(one)) {
      return this._sign === 1
        ? new BigNumber(1, 0n, 0, false, true)
        : new BigNumber(-1, 0n, 0, false, true);
    }
    if (this._sign === 0) return this;

    const half = BigNumber.fromNumber(0.5);
    return one.add(this).divide(one.subtract(this)).ln().multiply(half);
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
    if (this._isNaN) return this;
    if (this._sign === 0) return BigNumber.fromNumber(1);
    if (this._isInfinite) {
      return this._sign === 1 ? this : BigNumber.fromNumber(0);
    }

    // Argument reduction: reduce x to small range
    // e^x = (e^(x/2^k))^(2^k)
    const precision = globalConfig.precision;
    const val = Math.abs(this.valueOf());

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
    const maxIter = precision + 20;

    for (let n = 1; n <= maxIter; n++) {
      term = term.multiply(reduced).divide(BigNumber.fromNumber(n));
      const newSum = sum.add(term);
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
    if (this._sign === -1) return new BigNumber(0, 0n, 0, true);
    if (this._sign === 0) return new BigNumber(-1, 0n, 0, false, true);
    if (this._isInfinite) return this;

    const one = BigNumber.fromNumber(1);
    if (this.equals(one)) return BigNumber.fromNumber(0);

    const precision = globalConfig.precision;

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
    const y = x.subtract(one).divide(x.add(one));
    const ySq = y.multiply(y);
    let term = y;
    let sum = y;
    const maxIter = precision + 20;

    for (let n = 1; n <= maxIter; n++) {
      term = term.multiply(ySq);
      const contribution = term.divide(BigNumber.fromNumber(2 * n + 1));
      const newSum = sum.add(contribution);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    sum = sum.multiply(two);

    // Add back reduction: k * ln(2)
    if (k !== 0) {
      sum = sum.add(BIGNUMBER_LN2.multiply(BigNumber.fromNumber(k)));
    }

    return sum.roundToPrecision(precision);
  }

  /**
   * Base-10 logarithm: log10(x) = ln(x) / ln(10)
   */
  log10(): BigNumber {
    return this.ln().divide(BIGNUMBER_LN10);
  }

  /**
   * Base-2 logarithm: log2(x) = ln(x) / ln(2)
   */
  log2(): BigNumber {
    return this.ln().divide(BIGNUMBER_LN2);
  }

  /**
   * Cube root
   * Uses Newton-Raphson iteration.
   */
  cbrt(): BigNumber {
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
      const newGuess = guess.multiply(BigNumber.fromNumber(2)).add(this.divide(guessSquared)).divide(three);
      if (guess.subtract(newGuess).abs().compareTo(
        guess.abs().multiply(BigNumber.parse('1e-' + (precision + 5)))
      ) <= 0) {
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
    const maxIter = precision + 20;

    for (let n = 2; n <= maxIter; n++) {
      term = term.multiply(this).divide(BigNumber.fromNumber(n));
      const newSum = sum.add(term);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    return sum.roundToPrecision(precision);
  }

  /**
   * ln(1 + x) (more precise than ln(1 + x) for small x)
   */
  log1p(): BigNumber {
    if (this._isNaN) return this;
    const one = BigNumber.fromNumber(1);
    const negOne = BigNumber.fromNumber(-1);

    if (this.compareTo(negOne) < 0) return new BigNumber(0, 0n, 0, true);
    if (this.equals(negOne)) return new BigNumber(-1, 0n, 0, false, true);
    if (this._sign === 0) return this;

    return one.add(this).ln();
  }

  /**
   * Hypotenuse: sqrt(this^2 + other^2)
   */
  hypot(other: BigNumber): BigNumber {
    if (this._isNaN || other._isNaN) return new BigNumber(0, 0n, 0, true);
    if (this._isInfinite || other._isInfinite) return new BigNumber(1, 0n, 0, false, true);

    return this.multiply(this).add(other.multiply(other)).sqrt();
  }

  // ============================================================
  // Private Taylor Series Helpers
  // ============================================================

  /** Reduce angle to [-PI, PI] range */
  private _reduceAngle(): BigNumber {
    const twoPi = BIGNUMBER_PI.multiply(BigNumber.fromNumber(2));

    // Quick check if already in range
    if (this.abs().compareTo(BIGNUMBER_PI) <= 0) {
      return this;
    }

    // x mod 2PI, then shift to [-PI, PI]
    const quotient = this.divide(twoPi).round(0, 'halfUp');
    let reduced = this.subtract(twoPi.multiply(quotient));

    // Ensure in [-PI, PI]
    if (reduced.compareTo(BIGNUMBER_PI) > 0) {
      reduced = reduced.subtract(twoPi);
    } else if (reduced.compareTo(BIGNUMBER_PI.negate()) < 0) {
      reduced = reduced.add(twoPi);
    }

    return reduced;
  }

  /** Taylor series for sin(x), assumes x is in [-PI, PI] */
  private _sinTaylor(): BigNumber {
    const precision = globalConfig.precision;
    let term = this.clone();
    let sum = this.clone();
    const xSquared = this.multiply(this);
    const maxIter = precision + 20;

    for (let n = 1; n <= maxIter; n++) {
      term = term.multiply(xSquared).divide(
        BigNumber.fromNumber((2 * n) * (2 * n + 1))
      ).negate();
      const newSum = sum.add(term);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    return sum.roundToPrecision(precision);
  }

  /** Taylor series for cos(x), assumes x is in [-PI, PI] */
  private _cosTaylor(): BigNumber {
    const precision = globalConfig.precision;
    let term = BigNumber.fromNumber(1);
    let sum = BigNumber.fromNumber(1);
    const xSquared = this.multiply(this);
    const maxIter = precision + 20;

    for (let n = 1; n <= maxIter; n++) {
      term = term.multiply(xSquared).divide(
        BigNumber.fromNumber((2 * n - 1) * (2 * n))
      ).negate();
      const newSum = sum.add(term);
      if (sum.equals(newSum)) break;
      sum = newSum;
    }

    return sum.roundToPrecision(precision);
  }

  /** Taylor series for atan(x), assumes |x| <= 0.5 */
  private _atanTaylor(): BigNumber {
    const precision = globalConfig.precision;
    const xSquared = this.multiply(this);
    let term = this.clone();
    let sum = this.clone();
    const maxIter = precision + 20;

    for (let n = 1; n <= maxIter; n++) {
      term = term.multiply(xSquared).negate();
      const contribution = term.divide(BigNumber.fromNumber(2 * n + 1));
      const newSum = sum.add(contribution);
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
    if (this._isNaN || this._isInfinite || this._sign === 0) return this._sign === 0;
    return this._exponent >= 0;
  }

  sign(): number {
    return this._sign;
  }

  clone(): BigNumber {
    return new BigNumber(this._sign, this._coefficient, this._exponent, this._isNaN, this._isInfinite);
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  private ensureBigNumber(value: Scalar | BigNumber | number | string): BigNumber {
    if (value instanceof BigNumber) return value;
    if (typeof value === 'number') return BigNumber.fromNumber(value);
    if (typeof value === 'string') return BigNumber.parse(value);
    return BigNumber.fromNumber(Number(value.valueOf()));
  }

  private alignExponents(a: BigNumber, b: BigNumber): [bigint, bigint, number] {
    const minExp = Math.min(a._exponent, b._exponent);
    const aShift = a._exponent - minExp;
    const bShift = b._exponent - minExp;

    const aCoef = aShift > 0
      ? a._coefficient * BigInt(10) ** BigInt(aShift)
      : a._coefficient;
    const bCoef = bShift > 0
      ? b._coefficient * BigInt(10) ** BigInt(bShift)
      : b._coefficient;

    return [aCoef, bCoef, minExp];
  }

  private normalize(sign: 1 | -1 | 0, coefficient: bigint, exponent: number): BigNumber {
    if (coefficient === 0n) {
      return new BigNumber(0, 0n, 0);
    }

    // Remove trailing zeros
    let coef = coefficient;
    let exp = exponent;
    while (coef % 10n === 0n && coef !== 0n) {
      coef = coef / 10n;
      exp++;
    }

    return new BigNumber(sign, coef, exp);
  }
}

/**
 * Common BigNumber constants
 */
export const BIGNUMBER_ZERO = BigNumber.fromNumber(0);
export const BIGNUMBER_ONE = BigNumber.fromNumber(1);
export const BIGNUMBER_NEG_ONE = BigNumber.fromNumber(-1);
export const BIGNUMBER_TEN = BigNumber.fromNumber(10);

// Math constants with high precision
export const BIGNUMBER_PI = BigNumber.parse('3.14159265358979323846264338327950288419716939937510');
export const BIGNUMBER_E = BigNumber.parse('2.71828182845904523536028747135266249775724709369995');
export const BIGNUMBER_LN2 = BigNumber.parse('0.69314718055994530941723212145817656807550013436026');
export const BIGNUMBER_LN10 = BigNumber.parse('2.30258509299404568401799145468436420760110148862877');
