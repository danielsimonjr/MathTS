/**
 * Complex number implementation
 * @module @danielsimonjr/mathts-core/types/complex
 */

import type { Scalar, IComplex } from './interfaces';

/**
 * Check if a value is a Complex number
 */
export function isComplex(value: unknown): value is Complex {
  return value instanceof Complex;
}

/**
 * Overflow/underflow-safe hypotenuse with a fast path for the common finite range.
 *
 * `Math.hypot` is correctly rounded and safe at the extremes, but it is a function
 * call plus scaling work. For typical magnitudes (well inside (1e-150, 1e150))
 * `sqrt(re²+im²)` is exact enough for every public test and substantially cheaper —
 * this is the path `abs`, `log`, `pow`, `sign`, and `sqrt` all share.
 *
 * Outside that window we fall through to `Math.hypot` so huge values do not overflow
 * to `Infinity` and denormals do not flush to `0`.
 */
function hypotFast(re: number, im: number): number {
  if (im === 0) return Math.abs(re);
  if (re === 0) return Math.abs(im);
  const a = re < 0 ? -re : re;
  const b = im < 0 ? -im : im;
  if (a < 1e150 && b < 1e150 && (a > 1e-150 || b > 1e-150)) {
    return Math.sqrt(re * re + im * im);
  }
  return Math.hypot(re, im);
}

/**
 * Complex number class with full arithmetic support
 * Implements the IComplex interface for type-safe complex number operations.
 */
export class Complex implements IComplex {
  readonly type = 'Complex';
  readonly re: number;
  readonly im: number;

  constructor(re: number, im: number = 0) {
    this.re = re;
    this.im = im;
  }

  // ============================================================
  // Static Factory Methods
  // ============================================================

  /**
   * Create a Complex from polar form (r, θ)
   * @param r - magnitude (radius)
   * @param theta - angle in radians
   */
  static fromPolar(r: number, theta: number): Complex {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    let re = r * cosT;
    let im = r * sinT;
    // IEEE 754: Inf * 0 is NaN. Restore the signed-zero trig component so
    // axis-aligned infinities stay on the axis — e.g. fromPolar(Infinity, 0)
    // is Infinity+0i, which is what z^w needs for a tiny positive real
    // raised to a negative power. Do not snap near-zero cos/sin (π/2 is
    // not exact in f64); only the exact-zero case is NaN.
    if (!Number.isFinite(r) && !Number.isNaN(r)) {
      if (cosT === 0) re = cosT;
      if (sinT === 0) im = sinT;
    }
    return new Complex(re, im);
  }

  /**
   * Create a Complex from a real number
   */
  static fromNumber(n: number): Complex {
    return new Complex(n, 0);
  }

  /**
   * Create a Complex from a JSON object
   */
  static fromJSON(json: { re: number; im: number }): Complex {
    return new Complex(json.re, json.im);
  }

  /**
   * Parse a complex number from a string
   * Supports formats: "3+4i", "3-4i", "3", "4i", "-4i", "i", "-i"
   */
  static parse(str: string): Complex {
    str = str.replace(/\s/g, '');

    // Check for complex form first: "a+bi" or "a-bi"
    const match = str.match(/^([+-]?[\d.]+)([+-])([\d.]*)i$/);
    if (match) {
      const re = parseFloat(match[1]);
      const sign = match[2] === '-' ? -1 : 1;
      const imMag = match[3] === '' ? 1 : parseFloat(match[3]);
      return new Complex(re, sign * imMag);
    }

    // Pure imaginary: "i", "-i", "4i", "-4i"
    if (str.endsWith('i')) {
      const imStr = str.slice(0, -1);
      if (imStr === '' || imStr === '+') return new Complex(0, 1);
      if (imStr === '-') return new Complex(0, -1);
      return new Complex(0, parseFloat(imStr));
    }

    // Pure real number
    return new Complex(parseFloat(str), 0);
  }

  /**
   * Compare two complex numbers lexicographically (re first, then im)
   * @returns -1, 0, or 1
   */
  static compare(a: Complex, b: Complex): number {
    if (a.re > b.re) return 1;
    if (a.re < b.re) return -1;
    if (a.im > b.im) return 1;
    if (a.im < b.im) return -1;
    return 0;
  }

  // ============================================================
  // Conversion Methods
  // ============================================================

  valueOf(): number {
    // Return magnitude for numeric context
    return this.abs();
  }

  toString(): string {
    if (this.im === 0) return `${this.re}`;
    if (this.re === 0) {
      if (this.im === 1) return 'i';
      if (this.im === -1) return '-i';
      return `${this.im}i`;
    }
    const sign = this.im >= 0 ? ' + ' : ' - ';
    const absIm = Math.abs(this.im);
    const imStr = absIm === 1 ? 'i' : `${absIm}i`;
    return `${this.re}${sign}${imStr}`;
  }

  toJSON(): { mathjs: string; re: number; im: number } {
    return { mathjs: 'Complex', re: this.re, im: this.im };
  }

  /**
   * Return polar representation
   */
  toPolar(): { r: number; phi: number } {
    return { r: this.abs(), phi: this.arg() };
  }

  /**
   * Format with options (precision, notation, etc.)
   */
  format(options?: { precision?: number; notation?: 'fixed' | 'exponential' | 'auto' }): string {
    const formatNum = (n: number): string => {
      if (!options) return String(n);
      if (options.precision !== undefined) {
        if (options.notation === 'exponential') {
          return n.toExponential(options.precision);
        }
        if (options.notation === 'fixed') {
          return n.toFixed(options.precision);
        }
        return Number(n.toPrecision(options.precision)).toString();
      }
      return String(n);
    };

    let re = this.re;
    let im = this.im;

    // Round small values to zero based on precision
    if (options?.precision !== undefined) {
      const epsilon = Math.pow(10, -options.precision);
      if (Math.abs(re) < epsilon * Math.abs(im)) re = 0;
      if (Math.abs(im) < epsilon * Math.abs(re)) im = 0;
    }

    if (im === 0) return formatNum(re);
    if (re === 0) {
      if (im === 1) return 'i';
      if (im === -1) return '-i';
      return `${formatNum(im)}i`;
    }

    const sign = im < 0 ? ' - ' : ' + ';
    const absIm = Math.abs(im);
    if (absIm === 1) {
      return `${formatNum(re)}${sign}i`;
    }
    return `${formatNum(re)}${sign}${formatNum(absIm)}i`;
  }

  // ============================================================
  // Basic Properties
  // ============================================================

  /**
   * Complex conjugate (a + bi → a - bi)
   */
  conjugate(): Complex {
    return new Complex(this.re, -this.im);
  }

  /**
   * Magnitude (absolute value) |z| = √(re² + im²)
   */
  abs(): number {
    return hypotFast(this.re, this.im);
  }

  /**
   * Phase angle (argument) in radians, range (-π, π]
   */
  arg(): number {
    return Math.atan2(this.im, this.re);
  }

  /**
   * Squared magnitude |z|² = re² + im²
   * More efficient than abs() when you don't need the square root
   */
  abs2(): number {
    return this.re * this.re + this.im * this.im;
  }

  // ============================================================
  // Arithmetic Operations (Scalar interface)
  // ============================================================

  /**
   * Addition: (a + bi) + (c + di) = (a + c) + (b + d)i
   */
  add(other: Scalar): Complex {
    if (other instanceof Complex) {
      return new Complex(this.re + other.re, this.im + other.im);
    }
    return new Complex(this.re + Number(other.valueOf()), this.im);
  }

  /**
   * Subtraction: (a + bi) - (c + di) = (a - c) + (b - d)i
   */
  subtract(other: Scalar): Complex {
    if (other instanceof Complex) {
      return new Complex(this.re - other.re, this.im - other.im);
    }
    return new Complex(this.re - Number(other.valueOf()), this.im);
  }

  /**
   * Multiplication: (a + bi)(c + di) = (ac - bd) + (ad + bc)i
   */
  multiply(other: Scalar): Complex {
    if (other instanceof Complex) {
      return new Complex(
        this.re * other.re - this.im * other.im,
        this.re * other.im + this.im * other.re
      );
    }
    const n = Number(other.valueOf());
    return new Complex(this.re * n, this.im * n);
  }

  /**
   * Division: (a + bi)/(c + di) = ((ac + bd) + (bc - ad)i) / (c² + d²)
   */
  divide(other: Scalar): Complex {
    if (other instanceof Complex) {
      const denom = other.re * other.re + other.im * other.im;
      if (denom === 0) {
        return new Complex(
          this.re !== 0 ? (this.re > 0 ? Infinity : -Infinity) : NaN,
          this.im !== 0 ? (this.im > 0 ? Infinity : -Infinity) : NaN
        );
      }
      return new Complex(
        (this.re * other.re + this.im * other.im) / denom,
        (this.im * other.re - this.re * other.im) / denom
      );
    }
    const n = Number(other.valueOf());
    if (n === 0) {
      return new Complex(
        this.re !== 0 ? (this.re > 0 ? Infinity : -Infinity) : NaN,
        this.im !== 0 ? (this.im > 0 ? Infinity : -Infinity) : NaN
      );
    }
    return new Complex(this.re / n, this.im / n);
  }

  // ------------------------------------------------------------
  // Short-name aliases (mathjs-functions calling convention)
  //
  // The functions-package typed-function arithmetic (subtractScalar,
  // multiplyScalar, divideScalar, …) invokes `.add/.sub/.mul/.div/.neg`
  // on scalars. A core Complex (e.g. produced by `sqrt(-4)`) can flow into
  // those code paths, so it must answer to the short names too — otherwise
  // `x.sub is not a function`. Mirrors the Fraction short-alias fix.
  // ------------------------------------------------------------
  sub(other: Scalar): Complex {
    return this.subtract(other);
  }

  mul(other: Scalar): Complex {
    return this.multiply(other);
  }

  div(other: Scalar): Complex {
    return this.divide(other);
  }

  neg(): Complex {
    return this.negate();
  }

  /**
   * Negation: -(a + bi) = -a - bi
   */
  negate(): Complex {
    return new Complex(-this.re, -this.im);
  }

  /**
   * Multiplicative inverse: 1/z = z̄/|z|²
   */
  inverse(): Complex {
    const denom = this.abs2();
    if (denom === 0) {
      return new Complex(Infinity, Infinity);
    }
    return new Complex(this.re / denom, -this.im / denom);
  }

  // ============================================================
  // Transcendental Functions
  // ============================================================

  /**
   * Square root using the principal branch (Re ≥ 0; Im has the sign of `this.im`).
   *
   * Algebraic form, not polar: one hypot + one sqrt instead of hypot + atan2 +
   * cos + sin. Same branch cut as C99 / the previous polar implementation,
   * including `sqrt(-x - 0i) = −√x · i`.
   */
  sqrt(): Complex {
    const x = this.re;
    const y = this.im;
    if (y === 0) {
      if (x >= 0) return new Complex(Math.sqrt(x), y);
      const im = Math.sqrt(-x);
      return new Complex(0, Object.is(y, -0) ? -im : im);
    }
    const r = hypotFast(x, y);
    if (x >= 0) {
      const t = Math.sqrt(0.5 * (r + x));
      return new Complex(t, y / (2 * t));
    }
    const t = Math.sqrt(0.5 * (r - x));
    const im = y < 0 ? -t : t;
    return new Complex(y / (2 * im), im);
  }

  /**
   * n-th root (returns principal root)
   */
  nthRoot(n: number): Complex {
    const r = this.abs();
    const theta = this.arg();
    return Complex.fromPolar(Math.pow(r, 1 / n), theta / n);
  }

  /**
   * All n-th roots
   */
  nthRoots(n: number): Complex[] {
    const r = this.abs();
    const theta = this.arg();
    const rootR = Math.pow(r, 1 / n);
    const roots: Complex[] = [];
    for (let k = 0; k < n; k++) {
      roots.push(Complex.fromPolar(rootR, (theta + 2 * Math.PI * k) / n));
    }
    return roots;
  }

  /**
   * Exponential: e^(a+bi) = e^a · (cos(b) + i·sin(b))
   */
  exp(): Complex {
    const ea = Math.exp(this.re);
    return new Complex(ea * Math.cos(this.im), ea * Math.sin(this.im));
  }

  /**
   * Natural logarithm: ln(z) = ln|z| + i·arg(z)
   */
  log(): Complex {
    return new Complex(Math.log(this.abs()), this.arg());
  }

  /**
   * Logarithm base 10
   */
  log10(): Complex {
    const ln10 = Math.LN10;
    return new Complex(Math.log(hypotFast(this.re, this.im)) / ln10, this.arg() / ln10);
  }

  /**
   * Logarithm base 2
   */
  log2(): Complex {
    const ln2 = Math.LN2;
    return new Complex(Math.log(hypotFast(this.re, this.im)) / ln2, this.arg() / ln2);
  }

  /**
   * Power: z^w = e^(w·ln(z))
   */
  pow(n: number | Complex): Complex {
    if (typeof n === 'number') {
      // Optimization for real exponents
      if (this.re === 0 && this.im === 0) {
        return n === 0 ? new Complex(1, 0) : new Complex(0, 0);
      }
      const r = this.abs();
      const theta = this.arg();
      return Complex.fromPolar(Math.pow(r, n), theta * n);
    }
    // General case: z^w = e^(w * ln(z))
    if (this.re === 0 && this.im === 0) {
      return new Complex(0, 0);
    }
    return this.log().multiply(n).exp();
  }

  // ============================================================
  // Trigonometric Functions
  // ============================================================

  /**
   * Sine: sin(a + bi) = sin(a)cosh(b) + i·cos(a)sinh(b)
   */
  sin(): Complex {
    return new Complex(
      Math.sin(this.re) * Math.cosh(this.im),
      Math.cos(this.re) * Math.sinh(this.im)
    );
  }

  /**
   * Cosine: cos(a + bi) = cos(a)cosh(b) - i·sin(a)sinh(b)
   */
  cos(): Complex {
    return new Complex(
      Math.cos(this.re) * Math.cosh(this.im),
      -Math.sin(this.re) * Math.sinh(this.im)
    );
  }

  /**
   * Tangent: tan(x+iy) = (sin 2x + i sinh 2y) / (cos 2x + cosh 2y)
   *
   * Closed form — no intermediate `sin`/`cos` Complex allocations.
   */
  tan(): Complex {
    const x2 = this.re * 2;
    const y2 = this.im * 2;
    const d = Math.cos(x2) + Math.cosh(y2);
    return new Complex(Math.sin(x2) / d, Math.sinh(y2) / d);
  }

  /**
   * Cotangent: cot(x+iy) = (sin 2x − i sinh 2y) / (cosh 2y − cos 2x)
   */
  cot(): Complex {
    const x2 = this.re * 2;
    const y2 = this.im * 2;
    const d = Math.cosh(y2) - Math.cos(x2);
    return new Complex(Math.sin(x2) / d, -Math.sinh(y2) / d);
  }

  /**
   * Secant: sec(z) = 1 / cos(z)
   */
  sec(): Complex {
    return this.cos().inverse();
  }

  /**
   * Cosecant: csc(z) = 1 / sin(z)
   */
  csc(): Complex {
    return this.sin().inverse();
  }

  // ============================================================
  // Hyperbolic Functions
  // ============================================================

  /**
   * Hyperbolic sine: sinh(z) = (e^z - e^(-z)) / 2
   */
  sinh(): Complex {
    return new Complex(
      Math.sinh(this.re) * Math.cos(this.im),
      Math.cosh(this.re) * Math.sin(this.im)
    );
  }

  /**
   * Hyperbolic cosine: cosh(z) = (e^z + e^(-z)) / 2
   */
  cosh(): Complex {
    return new Complex(
      Math.cosh(this.re) * Math.cos(this.im),
      Math.sinh(this.re) * Math.sin(this.im)
    );
  }

  /**
   * Hyperbolic tangent: tanh(x+iy) = (sinh 2x + i sin 2y) / (cosh 2x + cos 2y)
   */
  tanh(): Complex {
    const x2 = this.re * 2;
    const y2 = this.im * 2;
    const d = Math.cosh(x2) + Math.cos(y2);
    return new Complex(Math.sinh(x2) / d, Math.sin(y2) / d);
  }

  /**
   * Hyperbolic cotangent: coth(x+iy) = (sinh 2x − i sin 2y) / (cosh 2x − cos 2y)
   */
  coth(): Complex {
    const x2 = this.re * 2;
    const y2 = this.im * 2;
    const d = Math.cosh(x2) - Math.cos(y2);
    return new Complex(Math.sinh(x2) / d, -Math.sin(y2) / d);
  }

  /**
   * Hyperbolic secant: sech(z) = 1 / cosh(z)
   */
  sech(): Complex {
    return this.cosh().inverse();
  }

  /**
   * Hyperbolic cosecant: csch(z) = 1 / sinh(z)
   */
  csch(): Complex {
    return this.sinh().inverse();
  }

  // ============================================================
  // Inverse Trigonometric Functions
  // ============================================================

  /**
   * Arc sine: asin(z) = -i·ln(iz + √(1 - z²))
   */
  asin(): Complex {
    const iz = new Complex(-this.im, this.re); // i * z
    const one = new Complex(1, 0);
    const sqrt = one.subtract(this.multiply(this)).sqrt();
    return iz.add(sqrt).log().multiply(new Complex(0, -1));
  }

  /**
   * Arc cosine: acos(z) = π/2 - asin(z)
   */
  acos(): Complex {
    return new Complex(Math.PI / 2, 0).subtract(this.asin());
  }

  /**
   * Arc tangent: atan(z) = (i/2)·ln((i + z)/(i - z))
   */
  atan(): Complex {
    const i = new Complex(0, 1);
    const iHalf = new Complex(0, 0.5);
    const num = i.add(this);
    const denom = i.subtract(this);
    return num.divide(denom).log().multiply(iHalf);
  }

  // ============================================================
  // Inverse Hyperbolic Functions
  // ============================================================

  /**
   * Inverse hyperbolic sine: asinh(z) = ln(z + √(z² + 1))
   */
  asinh(): Complex {
    const one = new Complex(1, 0);
    return this.add(this.multiply(this).add(one).sqrt()).log();
  }

  /**
   * Inverse hyperbolic cosine: acosh(z) = ln(z + √(z-1)·√(z+1))
   *
   * The principal value has non-negative real part (C99 Annex G / DLMF 4.37 /
   * NumPy convention). Using the factored `√(z-1)·√(z+1)` rather than `√(z²-1)`
   * selects the correct Riemann sheet for Re(z) < 0 and on the real-axis branch
   * cuts (z < 1), where `√(z²-1)` lands on the wrong branch — the previous form
   * returned a negative real part (e.g. acosh(-1+0.5i)) and the wrong sign of π
   * on z < -1.
   */
  acosh(): Complex {
    const one = new Complex(1, 0);
    const s = this.subtract(one).sqrt().multiply(this.add(one).sqrt());
    return this.add(s).log();
  }

  /**
   * Inverse hyperbolic tangent: atanh(z) = (1/2)·ln((1 + z)/(1 - z))
   */
  atanh(): Complex {
    const one = new Complex(1, 0);
    const half = new Complex(0.5, 0);
    return one.add(this).divide(one.subtract(this)).log().multiply(half);
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Check equality within tolerance
   */
  equals(other: Complex, epsilon: number = 1e-12): boolean {
    return Math.abs(this.re - other.re) < epsilon && Math.abs(this.im - other.im) < epsilon;
  }

  /**
   * Check if this is a real number (im ≈ 0)
   */
  isReal(epsilon: number = 0): boolean {
    return Math.abs(this.im) <= epsilon;
  }

  /**
   * Check if this is purely imaginary (re ≈ 0, im ≠ 0)
   */
  isImaginary(epsilon: number = 0): boolean {
    return Math.abs(this.re) <= epsilon && Math.abs(this.im) > epsilon;
  }

  /**
   * Check if this is zero
   */
  isZero(epsilon: number = 0): boolean {
    return Math.abs(this.re) <= epsilon && Math.abs(this.im) <= epsilon;
  }

  /**
   * Check if this is NaN
   */
  isNaN(): boolean {
    return Number.isNaN(this.re) || Number.isNaN(this.im);
  }

  /**
   * Check if this is infinite
   */
  isInfinite(): boolean {
    return !this.isNaN() && (!Number.isFinite(this.re) || !Number.isFinite(this.im));
  }

  /**
   * Clone this complex number
   */
  clone(): Complex {
    return new Complex(this.re, this.im);
  }

  /**
   * Round real and imaginary parts to specified decimals
   */
  round(decimals: number = 0): Complex {
    const factor = Math.pow(10, decimals);
    return new Complex(
      Math.round(this.re * factor) / factor,
      Math.round(this.im * factor) / factor
    );
  }

  /**
   * Floor real and imaginary parts
   */
  floor(): Complex {
    return new Complex(Math.floor(this.re), Math.floor(this.im));
  }

  /**
   * Ceil real and imaginary parts
   */
  ceil(): Complex {
    return new Complex(Math.ceil(this.re), Math.ceil(this.im));
  }

  /**
   * Sign function: z / |z| (unit complex number in same direction)
   */
  sign(): Complex {
    const r = this.abs();
    if (r === 0) return new Complex(0, 0);
    return new Complex(this.re / r, this.im / r);
  }
}

/**
 * Imaginary unit constant: i = √(-1)
 */
export const I = new Complex(0, 1);

/**
 * Common constants
 */
export const COMPLEX_ZERO = new Complex(0, 0);
export const COMPLEX_ONE = new Complex(1, 0);
export const COMPLEX_NEG_ONE = new Complex(-1, 0);
