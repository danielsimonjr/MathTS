/**
 * AssemblyScript-compatible Complex Number Implementation
 *
 * This is a simplified Complex number class designed for AssemblyScript
 * compilation. It avoids:
 * - Optional parameters (use overloaded functions instead)
 * - Regex parsing (use factory functions)
 * - Closures
 * - Dynamic types
 */

/**
 * Complex number represented as (re + im*i)
 */
@final
export class Complex {
  /** Real part */
  re: f64;
  /** Imaginary part */
  im: f64;

  constructor(re: f64, im: f64) {
    this.re = re;
    this.im = im;
  }

  /**
   * Create a copy of this complex number
   */
  clone(): Complex {
    return new Complex(this.re, this.im);
  }

  /**
   * Check equality with another complex number
   */
  equals(other: Complex): bool {
    return this.re == other.re && this.im == other.im;
  }

  /**
   * Check approximate equality (within epsilon)
   */
  approxEquals(other: Complex, epsilon: f64 = 1e-12): bool {
    const diffRe = this.re - other.re;
    const diffIm = this.im - other.im;
    return abs(diffRe) < epsilon && abs(diffIm) < epsilon;
  }

  // =========================================================================
  // Arithmetic Operations
  // =========================================================================

  /**
   * Add another complex number
   */
  add(other: Complex): Complex {
    return new Complex(this.re + other.re, this.im + other.im);
  }

  /**
   * Add a real number
   */
  addReal(value: f64): Complex {
    return new Complex(this.re + value, this.im);
  }

  /**
   * Subtract another complex number
   */
  sub(other: Complex): Complex {
    return new Complex(this.re - other.re, this.im - other.im);
  }

  /**
   * Subtract a real number
   */
  subReal(value: f64): Complex {
    return new Complex(this.re - value, this.im);
  }

  /**
   * Multiply by another complex number
   * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
   */
  mul(other: Complex): Complex {
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re
    );
  }

  /**
   * Multiply by a real number
   */
  mulReal(value: f64): Complex {
    return new Complex(this.re * value, this.im * value);
  }

  /**
   * Divide by another complex number
   * (a + bi) / (c + di) = ((ac + bd) + (bc - ad)i) / (c² + d²)
   */
  div(other: Complex): Complex {
    const denom = other.re * other.re + other.im * other.im;
    if (denom == 0.0) {
      return new Complex(f64.NaN, f64.NaN);
    }
    return new Complex(
      (this.re * other.re + this.im * other.im) / denom,
      (this.im * other.re - this.re * other.im) / denom
    );
  }

  /**
   * Divide by a real number
   */
  divReal(value: f64): Complex {
    if (value == 0.0) {
      return new Complex(f64.NaN, f64.NaN);
    }
    return new Complex(this.re / value, this.im / value);
  }

  /**
   * Negate the complex number
   */
  neg(): Complex {
    return new Complex(-this.re, -this.im);
  }

  /**
   * Complex conjugate
   */
  conj(): Complex {
    return new Complex(this.re, -this.im);
  }

  /**
   * Reciprocal (1/z)
   */
  reciprocal(): Complex {
    const denom = this.re * this.re + this.im * this.im;
    if (denom == 0.0) {
      return new Complex(f64.NaN, f64.NaN);
    }
    return new Complex(this.re / denom, -this.im / denom);
  }

  // =========================================================================
  // Magnitude and Phase
  // =========================================================================

  /**
   * Absolute value (magnitude)
   * |z| = sqrt(re² + im²)
   */
  abs(): f64 {
    return sqrt(this.re * this.re + this.im * this.im);
  }

  /**
   * Squared magnitude (avoids sqrt for comparisons)
   */
  abs2(): f64 {
    return this.re * this.re + this.im * this.im;
  }

  /**
   * Argument (phase angle in radians)
   * arg(z) = atan2(im, re)
   */
  arg(): f64 {
    return atan2(this.im, this.re);
  }

  // =========================================================================
  // Exponential and Logarithmic
  // =========================================================================

  /**
   * Complex exponential
   * exp(a + bi) = exp(a) * (cos(b) + i*sin(b))
   */
  exp(): Complex {
    const expRe = exp(this.re);
    return new Complex(expRe * cos(this.im), expRe * sin(this.im));
  }

  /**
   * Complex natural logarithm (principal value)
   * log(z) = log|z| + i*arg(z)
   */
  log(): Complex {
    return new Complex(log(this.abs()), this.arg());
  }

  /**
   * Complex square root (principal value)
   */
  sqrt(): Complex {
    const r = this.abs();
    const halfArg = this.arg() / 2.0;
    const sqrtR = sqrt(r);
    return new Complex(sqrtR * cos(halfArg), sqrtR * sin(halfArg));
  }

  /**
   * Complex power (z^n where n is real)
   */
  powReal(n: f64): Complex {
    if (n == 0.0) {
      return new Complex(1.0, 0.0);
    }
    const r = this.abs();
    const theta = this.arg();
    const rn = pow(r, n);
    const nTheta = n * theta;
    return new Complex(rn * cos(nTheta), rn * sin(nTheta));
  }

  /**
   * Complex power (z^w where w is complex)
   * z^w = exp(w * log(z))
   */
  pow(w: Complex): Complex {
    if (this.re == 0.0 && this.im == 0.0) {
      if (w.re > 0.0) {
        return new Complex(0.0, 0.0);
      }
      return new Complex(f64.NaN, f64.NaN);
    }
    return w.mul(this.log()).exp();
  }

  // =========================================================================
  // Trigonometric Functions
  // =========================================================================

  /**
   * Complex sine
   * sin(z) = (exp(iz) - exp(-iz)) / 2i
   */
  sin(): Complex {
    return new Complex(
      sin(this.re) * cosh(this.im),
      cos(this.re) * sinh(this.im)
    );
  }

  /**
   * Complex cosine
   * cos(z) = (exp(iz) + exp(-iz)) / 2
   */
  cos(): Complex {
    return new Complex(
      cos(this.re) * cosh(this.im),
      -sin(this.re) * sinh(this.im)
    );
  }

  /**
   * Complex tangent
   * tan(z) = sin(z) / cos(z)
   */
  tan(): Complex {
    return this.sin().div(this.cos());
  }

  // =========================================================================
  // Hyperbolic Functions
  // =========================================================================

  /**
   * Complex hyperbolic sine
   */
  sinh(): Complex {
    return new Complex(
      sinh(this.re) * cos(this.im),
      cosh(this.re) * sin(this.im)
    );
  }

  /**
   * Complex hyperbolic cosine
   */
  cosh(): Complex {
    return new Complex(
      cosh(this.re) * cos(this.im),
      sinh(this.re) * sin(this.im)
    );
  }

  /**
   * Complex hyperbolic tangent
   */
  tanh(): Complex {
    return this.sinh().div(this.cosh());
  }

  // =========================================================================
  // Query Methods
  // =========================================================================

  /**
   * Check if this is a real number (imaginary part is zero)
   */
  isReal(): bool {
    return this.im == 0.0;
  }

  /**
   * Check if this is purely imaginary (real part is zero)
   */
  isImaginary(): bool {
    return this.re == 0.0;
  }

  /**
   * Check if this is zero
   */
  isZero(): bool {
    return this.re == 0.0 && this.im == 0.0;
  }

  /**
   * Check if this is NaN
   */
  isNaN(): bool {
    return isNaN(this.re) || isNaN(this.im);
  }

  /**
   * Check if this is finite
   */
  isFinite(): bool {
    return isFinite(this.re) && isFinite(this.im);
  }
}

// =============================================================================
// Factory Functions (avoid constructor overloading)
// =============================================================================

/**
 * Create a complex number from real and imaginary parts
 */
export function complex(re: f64, im: f64): Complex {
  return new Complex(re, im);
}

/**
 * Create a complex number from polar coordinates (r, theta)
 */
export function complexFromPolar(r: f64, theta: f64): Complex {
  return new Complex(r * cos(theta), r * sin(theta));
}

/**
 * Create a complex number from a real value (im = 0)
 */
export function complexFromReal(value: f64): Complex {
  return new Complex(value, 0.0);
}

/**
 * Create a complex number from an imaginary value (re = 0)
 */
export function complexFromImaginary(value: f64): Complex {
  return new Complex(0.0, value);
}

// =============================================================================
// Constants
// =============================================================================

/** Complex zero */
export const COMPLEX_ZERO: Complex = new Complex(0.0, 0.0);

/** Complex one */
export const COMPLEX_ONE: Complex = new Complex(1.0, 0.0);

/** Complex imaginary unit i */
export const COMPLEX_I: Complex = new Complex(0.0, 1.0);

/** Complex negative one */
export const COMPLEX_NEG_ONE: Complex = new Complex(-1.0, 0.0);

// =============================================================================
// Math helpers (AS doesn't have Math.sinh, Math.cosh by default in older versions)
// =============================================================================

function sinh(x: f64): f64 {
  const ex = exp(x);
  return (ex - 1.0 / ex) / 2.0;
}

function cosh(x: f64): f64 {
  const ex = exp(x);
  return (ex + 1.0 / ex) / 2.0;
}
