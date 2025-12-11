/**
 * Complex number implementation
 * @module @mathts/core/types/complex
 */

import type { Scalar, IComplex } from './interfaces';

/**
 * Check if a value is a Complex number
 */
export function isComplex(value: unknown): value is Complex {
  return value instanceof Complex;
}

/**
 * Complex number class with full arithmetic support
 */
export class Complex implements IComplex {
  readonly type = 'Complex';
  readonly re: number;
  readonly im: number;

  constructor(re: number, im: number = 0) {
    this.re = re;
    this.im = im;
  }

  /**
   * Create a Complex from polar form
   */
  static fromPolar(r: number, theta: number): Complex {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  /**
   * Create a Complex from a real number
   */
  static fromNumber(n: number): Complex {
    return new Complex(n, 0);
  }

  valueOf(): number {
    // Return magnitude for numeric context
    return this.abs();
  }

  toString(): string {
    if (this.im === 0) return `${this.re}`;
    if (this.re === 0) return `${this.im}i`;
    const sign = this.im >= 0 ? '+' : '-';
    return `${this.re} ${sign} ${Math.abs(this.im)}i`;
  }

  toJSON(): { re: number; im: number } {
    return { re: this.re, im: this.im };
  }

  /**
   * Complex conjugate
   */
  conjugate(): Complex {
    return new Complex(this.re, -this.im);
  }

  /**
   * Magnitude (absolute value)
   */
  abs(): number {
    return Math.hypot(this.re, this.im);
  }

  /**
   * Phase angle (argument)
   */
  arg(): number {
    return Math.atan2(this.im, this.re);
  }

  /**
   * Addition
   */
  add(other: Scalar): Complex {
    if (other instanceof Complex) {
      return new Complex(this.re + other.re, this.im + other.im);
    }
    return new Complex(this.re + (other.valueOf() as number), this.im);
  }

  /**
   * Subtraction
   */
  subtract(other: Scalar): Complex {
    if (other instanceof Complex) {
      return new Complex(this.re - other.re, this.im - other.im);
    }
    return new Complex(this.re - (other.valueOf() as number), this.im);
  }

  /**
   * Multiplication
   */
  multiply(other: Scalar): Complex {
    if (other instanceof Complex) {
      // (a + bi)(c + di) = (ac - bd) + (ad + bc)i
      return new Complex(
        this.re * other.re - this.im * other.im,
        this.re * other.im + this.im * other.re
      );
    }
    const n = other.valueOf() as number;
    return new Complex(this.re * n, this.im * n);
  }

  /**
   * Division
   */
  divide(other: Scalar): Complex {
    if (other instanceof Complex) {
      // (a + bi)/(c + di) = ((ac + bd) + (bc - ad)i) / (c² + d²)
      const denom = other.re * other.re + other.im * other.im;
      return new Complex(
        (this.re * other.re + this.im * other.im) / denom,
        (this.im * other.re - this.re * other.im) / denom
      );
    }
    const n = other.valueOf() as number;
    return new Complex(this.re / n, this.im / n);
  }

  /**
   * Negation
   */
  negate(): Complex {
    return new Complex(-this.re, -this.im);
  }

  /**
   * Square root
   */
  sqrt(): Complex {
    const r = this.abs();
    const theta = this.arg();
    return Complex.fromPolar(Math.sqrt(r), theta / 2);
  }

  /**
   * Exponential
   */
  exp(): Complex {
    // e^(a+bi) = e^a * (cos(b) + i*sin(b))
    const ea = Math.exp(this.re);
    return new Complex(ea * Math.cos(this.im), ea * Math.sin(this.im));
  }

  /**
   * Natural logarithm
   */
  log(): Complex {
    return new Complex(Math.log(this.abs()), this.arg());
  }

  /**
   * Power
   */
  pow(n: number | Complex): Complex {
    if (typeof n === 'number') {
      const r = this.abs();
      const theta = this.arg();
      return Complex.fromPolar(Math.pow(r, n), theta * n);
    }
    // z^w = e^(w * ln(z))
    return this.log().multiply(n).exp();
  }

  /**
   * Sine
   */
  sin(): Complex {
    // sin(a + bi) = sin(a)cosh(b) + i*cos(a)sinh(b)
    return new Complex(
      Math.sin(this.re) * Math.cosh(this.im),
      Math.cos(this.re) * Math.sinh(this.im)
    );
  }

  /**
   * Cosine
   */
  cos(): Complex {
    // cos(a + bi) = cos(a)cosh(b) - i*sin(a)sinh(b)
    return new Complex(
      Math.cos(this.re) * Math.cosh(this.im),
      -Math.sin(this.re) * Math.sinh(this.im)
    );
  }

  /**
   * Check equality
   */
  equals(other: Complex, epsilon: number = 1e-12): boolean {
    return (
      Math.abs(this.re - other.re) < epsilon &&
      Math.abs(this.im - other.im) < epsilon
    );
  }

  /**
   * Check if this is a real number (im === 0)
   */
  isReal(): boolean {
    return this.im === 0;
  }

  /**
   * Check if this is purely imaginary (re === 0)
   */
  isImaginary(): boolean {
    return this.re === 0 && this.im !== 0;
  }
}

/**
 * Imaginary unit constant
 */
export const I = new Complex(0, 1);
