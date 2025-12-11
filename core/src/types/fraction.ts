/**
 * Fraction (rational number) implementation
 * @module @mathts/core/types/fraction
 */

import type { Scalar, IFraction } from './interfaces';

/**
 * Check if a value is a Fraction
 */
export function isFraction(value: unknown): value is Fraction {
  return value instanceof Fraction;
}

/**
 * Calculate the Greatest Common Divisor using Euclidean algorithm
 */
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Fraction class for exact rational arithmetic
 * Uses bigint for arbitrary precision numerator and denominator.
 * All fractions are automatically reduced to lowest terms.
 */
export class Fraction implements IFraction {
  readonly type = 'Fraction';
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint | number | string, denominator: bigint | number | string = 1n) {
    let num = typeof numerator === 'bigint' ? numerator : BigInt(numerator);
    let den = typeof denominator === 'bigint' ? denominator : BigInt(denominator);

    if (den === 0n) {
      throw new Error('Fraction denominator cannot be zero');
    }

    // Normalize sign: denominator is always positive
    if (den < 0n) {
      num = -num;
      den = -den;
    }

    // Reduce to lowest terms
    const g = gcd(num, den);
    this.numerator = num / g;
    this.denominator = den / g;
  }

  // ============================================================
  // Static Factory Methods
  // ============================================================

  /**
   * Create a Fraction from a number (with optional precision)
   */
  static fromNumber(n: number, maxDenominator: bigint = 1000000n): Fraction {
    if (!Number.isFinite(n)) {
      throw new Error('Cannot create fraction from non-finite number');
    }

    if (Number.isInteger(n)) {
      return new Fraction(BigInt(n), 1n);
    }

    // Use continued fraction algorithm for conversion
    const sign = n < 0 ? -1n : 1n;
    n = Math.abs(n);

    let h1 = 1n, h2 = 0n;
    let k1 = 0n, k2 = 1n;
    let b = n;

    do {
      const a = BigInt(Math.floor(b));
      let aux = h1;
      h1 = a * h1 + h2;
      h2 = aux;
      aux = k1;
      k1 = a * k1 + k2;
      k2 = aux;
      b = 1 / (b - Number(a));
    } while (Math.abs(n - Number(h1) / Number(k1)) > Number.EPSILON && k1 < maxDenominator);

    return new Fraction(sign * h1, k1);
  }

  /**
   * Create a Fraction from a decimal string
   */
  static fromDecimalString(str: string): Fraction {
    str = str.trim();

    // Check for repeating decimal notation: "0.(3)" = 1/3
    const repeatingMatch = str.match(/^(-?\d*)\.(\d*)\((\d+)\)$/);
    if (repeatingMatch) {
      const sign = str.startsWith('-') ? -1n : 1n;
      const intPart = repeatingMatch[1] === '-' ? '0' : repeatingMatch[1] || '0';
      const nonRepeating = repeatingMatch[2] || '';
      const repeating = repeatingMatch[3];

      // Formula: (full number - non-repeating part) / (99...900...0)
      const fullDigits = intPart + nonRepeating + repeating;
      const nonRepDigits = intPart + nonRepeating;

      const fullNum = BigInt(fullDigits.replace('-', ''));
      const nonRepNum = BigInt(nonRepDigits.replace('-', '') || '0');

      const nines = BigInt('9'.repeat(repeating.length));
      const zeros = BigInt('1' + '0'.repeat(nonRepeating.length));

      const num = fullNum - nonRepNum;
      const den = nines * zeros;

      return new Fraction(sign * num, den);
    }

    // Regular decimal
    const [intPart, decPart = ''] = str.split('.');
    const sign = str.startsWith('-') ? -1n : 1n;
    const absInt = intPart.replace('-', '') || '0';
    const combined = absInt + decPart;
    const num = BigInt(combined);
    const den = BigInt('1' + '0'.repeat(decPart.length));

    return new Fraction(sign * num, den);
  }

  /**
   * Parse a fraction from a string
   * Supports formats: "3/4", "-3/4", "3", "3.14", "0.(3)"
   */
  static parse(str: string): Fraction {
    str = str.trim();

    // Fraction format: "n/d"
    if (str.includes('/')) {
      const [numStr, denStr] = str.split('/');
      return new Fraction(BigInt(numStr.trim()), BigInt(denStr.trim()));
    }

    // Decimal format
    if (str.includes('.') || str.includes('(')) {
      return Fraction.fromDecimalString(str);
    }

    // Integer format
    return new Fraction(BigInt(str), 1n);
  }

  /**
   * Create a Fraction from a JSON object
   */
  static fromJSON(json: { n: string; d: string } | { numerator: string; denominator: string }): Fraction {
    if ('n' in json) {
      return new Fraction(BigInt(json.n), BigInt(json.d));
    }
    return new Fraction(BigInt(json.numerator), BigInt(json.denominator));
  }

  /**
   * Compare two fractions
   * @returns -1, 0, or 1
   */
  static compare(a: Fraction, b: Fraction): number {
    const diff = a.numerator * b.denominator - b.numerator * a.denominator;
    if (diff < 0n) return -1;
    if (diff > 0n) return 1;
    return 0;
  }

  // ============================================================
  // Conversion Methods
  // ============================================================

  valueOf(): number {
    return Number(this.numerator) / Number(this.denominator);
  }

  toString(): string {
    if (this.denominator === 1n) {
      return this.numerator.toString();
    }
    return `${this.numerator}/${this.denominator}`;
  }

  toJSON(): { mathjs: string; n: string; d: string } {
    return {
      mathjs: 'Fraction',
      n: this.numerator.toString(),
      d: this.denominator.toString()
    };
  }

  /**
   * Convert to number
   */
  toNumber(): number {
    return this.valueOf();
  }

  /**
   * Convert to decimal string with specified precision
   */
  toDecimal(precision: number = 10): string {
    const sign = this.numerator < 0n ? '-' : '';
    let num = this.numerator < 0n ? -this.numerator : this.numerator;
    const den = this.denominator;

    const intPart = num / den;
    num = num % den;

    if (num === 0n || precision === 0) {
      return sign + intPart.toString();
    }

    let decPart = '';
    for (let i = 0; i < precision && num !== 0n; i++) {
      num *= 10n;
      decPart += (num / den).toString();
      num = num % den;
    }

    return sign + intPart.toString() + '.' + decPart;
  }

  /**
   * Convert to LaTeX string
   */
  toLatex(): string {
    if (this.denominator === 1n) {
      return this.numerator.toString();
    }
    const sign = this.numerator < 0n ? '-' : '';
    const absNum = this.numerator < 0n ? -this.numerator : this.numerator;
    return `${sign}\\frac{${absNum}}{${this.denominator}}`;
  }

  /**
   * Convert to mixed number representation
   */
  toMixed(): { whole: bigint; numerator: bigint; denominator: bigint } {
    const sign = this.numerator < 0n ? -1n : 1n;
    const absNum = this.numerator < 0n ? -this.numerator : this.numerator;
    const whole = sign * (absNum / this.denominator);
    const remainder = absNum % this.denominator;
    return {
      whole,
      numerator: remainder,
      denominator: this.denominator
    };
  }

  // ============================================================
  // Arithmetic Operations (Scalar interface)
  // ============================================================

  /**
   * Addition: a/b + c/d = (ad + bc) / bd
   */
  add(other: Scalar): Fraction {
    if (other instanceof Fraction) {
      const num = this.numerator * other.denominator + other.numerator * this.denominator;
      const den = this.denominator * other.denominator;
      return new Fraction(num, den);
    }
    return this.add(Fraction.fromNumber(Number(other.valueOf())));
  }

  /**
   * Subtraction: a/b - c/d = (ad - bc) / bd
   */
  subtract(other: Scalar): Fraction {
    if (other instanceof Fraction) {
      const num = this.numerator * other.denominator - other.numerator * this.denominator;
      const den = this.denominator * other.denominator;
      return new Fraction(num, den);
    }
    return this.subtract(Fraction.fromNumber(Number(other.valueOf())));
  }

  /**
   * Multiplication: a/b * c/d = ac / bd
   */
  multiply(other: Scalar): Fraction {
    if (other instanceof Fraction) {
      return new Fraction(
        this.numerator * other.numerator,
        this.denominator * other.denominator
      );
    }
    return this.multiply(Fraction.fromNumber(Number(other.valueOf())));
  }

  /**
   * Division: a/b ÷ c/d = ad / bc
   */
  divide(other: Scalar): Fraction {
    if (other instanceof Fraction) {
      if (other.numerator === 0n) {
        throw new Error('Division by zero');
      }
      return new Fraction(
        this.numerator * other.denominator,
        this.denominator * other.numerator
      );
    }
    return this.divide(Fraction.fromNumber(Number(other.valueOf())));
  }

  /**
   * Negation: -(a/b) = -a/b
   */
  negate(): Fraction {
    return new Fraction(-this.numerator, this.denominator);
  }

  /**
   * Absolute value: |a/b|
   */
  abs(): Fraction {
    return new Fraction(
      this.numerator < 0n ? -this.numerator : this.numerator,
      this.denominator
    );
  }

  /**
   * Reciprocal: b/a
   */
  inverse(): Fraction {
    if (this.numerator === 0n) {
      throw new Error('Cannot invert zero');
    }
    return new Fraction(this.denominator, this.numerator);
  }

  /**
   * Power (integer exponent)
   */
  pow(n: number | bigint): Fraction {
    const exp = typeof n === 'bigint' ? n : BigInt(n);
    if (exp === 0n) {
      return new Fraction(1n, 1n);
    }
    if (exp < 0n) {
      return this.inverse().pow(-exp);
    }
    // Use binary exponentiation
    let result = new Fraction(1n, 1n);
    let base: Fraction = this;
    let e = exp;
    while (e > 0n) {
      if (e % 2n === 1n) {
        result = result.multiply(base);
      }
      base = base.multiply(base) as Fraction;
      e = e / 2n;
    }
    return result;
  }

  /**
   * Modulo operation
   */
  mod(other: Fraction): Fraction {
    // a mod b = a - b * floor(a/b)
    const quotient = this.divide(other);
    const floorQuot = quotient.floor();
    return this.subtract(other.multiply(floorQuot)) as Fraction;
  }

  // ============================================================
  // Comparison Methods
  // ============================================================

  /**
   * Check equality
   */
  equals(other: Fraction): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator;
  }

  /**
   * Check if less than
   */
  lessThan(other: Fraction): boolean {
    return Fraction.compare(this, other) < 0;
  }

  /**
   * Check if less than or equal
   */
  lessThanOrEqual(other: Fraction): boolean {
    return Fraction.compare(this, other) <= 0;
  }

  /**
   * Check if greater than
   */
  greaterThan(other: Fraction): boolean {
    return Fraction.compare(this, other) > 0;
  }

  /**
   * Check if greater than or equal
   */
  greaterThanOrEqual(other: Fraction): boolean {
    return Fraction.compare(this, other) >= 0;
  }

  /**
   * Compare with another fraction
   * @returns -1, 0, or 1
   */
  compareTo(other: Fraction): number {
    return Fraction.compare(this, other);
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Return fraction already in lowest terms (no-op since constructor reduces)
   */
  simplify(): Fraction {
    return this; // Already simplified in constructor
  }

  /**
   * Check if this is zero
   */
  isZero(): boolean {
    return this.numerator === 0n;
  }

  /**
   * Check if this is positive
   */
  isPositive(): boolean {
    return this.numerator > 0n;
  }

  /**
   * Check if this is negative
   */
  isNegative(): boolean {
    return this.numerator < 0n;
  }

  /**
   * Check if this is an integer
   */
  isInteger(): boolean {
    return this.denominator === 1n;
  }

  /**
   * Check if this is a unit fraction (1/n)
   */
  isUnit(): boolean {
    return this.numerator === 1n || this.numerator === -1n;
  }

  /**
   * Floor: largest integer ≤ this
   */
  floor(): Fraction {
    if (this.denominator === 1n) {
      return this;
    }
    const quot = this.numerator / this.denominator;
    if (this.numerator >= 0n || this.numerator % this.denominator === 0n) {
      return new Fraction(quot, 1n);
    }
    return new Fraction(quot - 1n, 1n);
  }

  /**
   * Ceiling: smallest integer ≥ this
   */
  ceil(): Fraction {
    if (this.denominator === 1n) {
      return this;
    }
    const quot = this.numerator / this.denominator;
    if (this.numerator <= 0n || this.numerator % this.denominator === 0n) {
      return new Fraction(quot, 1n);
    }
    return new Fraction(quot + 1n, 1n);
  }

  /**
   * Round to nearest integer
   */
  round(): Fraction {
    const floor = this.floor();
    const diff = this.subtract(floor);
    const half = new Fraction(1n, 2n);
    if (diff.greaterThanOrEqual(half)) {
      return floor.add(new Fraction(1n, 1n)) as Fraction;
    }
    return floor;
  }

  /**
   * Truncate (round toward zero)
   */
  trunc(): Fraction {
    return new Fraction(this.numerator / this.denominator, 1n);
  }

  /**
   * Get the sign: -1, 0, or 1
   */
  sign(): number {
    if (this.numerator < 0n) return -1;
    if (this.numerator > 0n) return 1;
    return 0;
  }

  /**
   * Clone this fraction
   */
  clone(): Fraction {
    return new Fraction(this.numerator, this.denominator);
  }

  /**
   * Get the GCD of numerator and denominator (always 1 since we reduce)
   */
  gcd(): bigint {
    return 1n; // Always reduced
  }

  /**
   * Get continued fraction representation
   */
  toContinuedFraction(): bigint[] {
    const result: bigint[] = [];
    let num = this.numerator < 0n ? -this.numerator : this.numerator;
    let den = this.denominator;

    while (den !== 0n) {
      result.push(num / den);
      const temp = num % den;
      num = den;
      den = temp;
    }

    if (this.numerator < 0n && result.length > 0) {
      result[0] = -result[0];
    }

    return result;
  }

  /**
   * Create fraction from continued fraction
   */
  static fromContinuedFraction(cf: bigint[]): Fraction {
    if (cf.length === 0) {
      return new Fraction(0n, 1n);
    }

    let num = cf[cf.length - 1];
    let den = 1n;

    for (let i = cf.length - 2; i >= 0; i--) {
      const temp = num;
      num = cf[i] * num + den;
      den = temp;
    }

    return new Fraction(num, den);
  }

  /**
   * Mediant of two fractions: (a+c)/(b+d)
   * Used in Stern-Brocot tree and Farey sequences
   */
  mediant(other: Fraction): Fraction {
    return new Fraction(
      this.numerator + other.numerator,
      this.denominator + other.denominator
    );
  }
}

/**
 * Common fraction constants
 */
export const FRACTION_ZERO = new Fraction(0n, 1n);
export const FRACTION_ONE = new Fraction(1n, 1n);
export const FRACTION_NEG_ONE = new Fraction(-1n, 1n);
export const FRACTION_HALF = new Fraction(1n, 2n);
export const FRACTION_THIRD = new Fraction(1n, 3n);
export const FRACTION_QUARTER = new Fraction(1n, 4n);
