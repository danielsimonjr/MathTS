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
   * arg(z) = Math.atan2(im, re)
   */
  arg(): f64 {
    return Math.atan2(this.im, this.re);
  }

  // =========================================================================
  // Exponential and Logarithmic
  // =========================================================================

  /**
   * Complex exponential
   * Math.exp(a + bi) = Math.exp(a) * (Math.cos(b) + i*Math.sin(b))
   */
  exp(): Complex {
    const expRe = Math.exp(this.re);
    return new Complex(expRe * Math.cos(this.im), expRe * Math.sin(this.im));
  }

  /**
   * Complex natural logarithm (principal value)
   * Math.log(z) = log|z| + i*arg(z)
   */
  log(): Complex {
    return new Complex(Math.log(this.abs()), this.arg());
  }

  /**
   * Complex square root (principal value)
   */
  sqrt(): Complex {
    const r = this.abs();
    const halfArg = this.arg() / 2.0;
    const sqrtR = sqrt(r);
    return new Complex(sqrtR * Math.cos(halfArg), sqrtR * Math.sin(halfArg));
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
    const rn = Math.pow(r, n);
    const nTheta = n * theta;
    return new Complex(rn * Math.cos(nTheta), rn * Math.sin(nTheta));
  }

  /**
   * Complex power (z^w where w is complex)
   * z^w = Math.exp(w * Math.log(z))
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
   * Math.sin(z) = (Math.exp(iz) - Math.exp(-iz)) / 2i
   */
  sin(): Complex {
    return new Complex(Math.sin(this.re) * cosh(this.im), Math.cos(this.re) * sinh(this.im));
  }

  /**
   * Complex cosine
   * Math.cos(z) = (Math.exp(iz) + Math.exp(-iz)) / 2
   */
  cos(): Complex {
    return new Complex(Math.cos(this.re) * cosh(this.im), -Math.sin(this.re) * sinh(this.im));
  }

  /**
   * Complex tangent
   * Math.tan(z) = Math.sin(z) / Math.cos(z)
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
    return new Complex(sinh(this.re) * Math.cos(this.im), cosh(this.re) * Math.sin(this.im));
  }

  /**
   * Complex hyperbolic cosine
   */
  cosh(): Complex {
    return new Complex(cosh(this.re) * Math.cos(this.im), sinh(this.re) * Math.sin(this.im));
  }

  /**
   * Complex hyperbolic tangent
   */
  tanh(): Complex {
    return this.sinh().div(this.cosh());
  }

  /**
   * Complex inverse sine: asin(z) = -i * ln(iz + sqrt(1 - z²))
   */
  asin(): Complex {
    const iz = new Complex(-this.im, this.re);
    const z2 = this.mul(this);
    const inner = new Complex(1.0 - z2.re, -z2.im).sqrt();
    const logArg = iz.add(inner);
    const ln = logArg.log();
    return new Complex(ln.im, -ln.re);
  }

  /**
   * Complex inverse cosine: acos(z) = -i * ln(z + sqrt(z² - 1))
   */
  acos(): Complex {
    const z2 = this.mul(this);
    const inner = new Complex(z2.re - 1.0, z2.im).sqrt();
    const logArg = this.add(inner);
    const ln = logArg.log();
    return new Complex(ln.im, -ln.re);
  }

  /**
   * Complex inverse tangent: atan(z) = (i/2) * ln((i+z)/(i-z))
   */
  atan(): Complex {
    const iPlusZ = new Complex(this.re, this.im + 1.0);
    const iMinusZ = new Complex(-this.re, 1.0 - this.im);
    const ratio = iPlusZ.div(iMinusZ);
    const ln = ratio.log();
    return new Complex(-ln.im * 0.5, ln.re * 0.5);
  }

  /**
   * Complex inverse hyperbolic sine: asinh(z) = ln(z + sqrt(z² + 1))
   */
  asinh(): Complex {
    const z2 = this.mul(this);
    const inner = new Complex(z2.re + 1.0, z2.im).sqrt();
    return this.add(inner).log();
  }

  /**
   * Complex inverse hyperbolic cosine: acosh(z) = ln(z + sqrt(z² - 1))
   */
  acosh(): Complex {
    const z2 = this.mul(this);
    const inner = new Complex(z2.re - 1.0, z2.im).sqrt();
    return this.add(inner).log();
  }

  /**
   * Complex inverse hyperbolic tangent: atanh(z) = 0.5 * ln((1+z)/(1-z))
   */
  atanh(): Complex {
    const onePlusZ = new Complex(1.0 + this.re, this.im);
    const oneMinusZ = new Complex(1.0 - this.re, -this.im);
    const ln = onePlusZ.div(oneMinusZ).log();
    return new Complex(ln.re * 0.5, ln.im * 0.5);
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
  return new Complex(r * Math.cos(theta), r * Math.sin(theta));
}

// =============================================================================
// Constants
// =============================================================================

// =============================================================================
// Math helpers (AS doesn't have Math.sinh, Math.cosh by default in older versions)
// =============================================================================

function sinh(x: f64): f64 {
  const ex = Math.exp(x);
  return (ex - 1.0 / ex) / 2.0;
}

function cosh(x: f64): f64 {
  const ex = Math.exp(x);
  return (ex + 1.0 / ex) / 2.0;
}
