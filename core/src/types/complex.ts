/**
 * Complex number implementation
 * @module @danielsimonjr/mathts-core/types/complex
 */

import type { Scalar, IComplex } from './interfaces.js';
import { COMPLEX_BRAND, defineTypeMarkers } from './type-marker.js';

/** Beyond this, `cosh`/`sinh` of the argument is within a factor e^-700 of overflowing to Infinity. */
const HYPERBOLIC_OVERFLOW_ARG = 700;

/**
 * The one closed form behind `tan`, `cot`, `tanh` and `coth`.
 *
 * `sign` (+1 tangent, -1 cotangent) and `hyperbolic` are bound once, when the method is created in
 * `Complex`'s static block, so `z.tan()` is a direct method call and the body takes no flag per call.
 * A helper that takes both flags on every call is not inlined by JavaScriptCore (`tan`, `cot` and
 * `tanh` ran 5% to 11% slower on Bun, V8 was unaffected), and four pasted bodies would repeat the
 * formula four times.
 *
 * Bit-identical to the four bodies it replaced: `cosh h + sign * cos t` is `cos t + cosh h` for the
 * tangents and `cosh h - cos t` for the cotangents, and `x * sign` is `x` or `-x`.
 */
function createTanFamilyMethod(
  name: string,
  sign: 1 | -1,
  hyperbolic: boolean
): (this: Complex) => Complex {
  const method = function (this: Complex): Complex {
    const t = (hyperbolic ? this.im : this.re) * 2;
    const h = (hyperbolic ? this.re : this.im) * 2;
    let s: number;
    let q: number;
    if (Math.abs(h) > HYPERBOLIC_OVERFLOW_ARG) {
      s = 2 * Math.sin(t) * Math.exp(-Math.abs(h));
      q = Math.sign(h);
    } else {
      const d = Math.cosh(h) + sign * Math.cos(t);
      s = Math.sin(t) / d;
      q = Math.sinh(h) / d;
    }
    return hyperbolic ? new Complex(q, s * sign) : new Complex(s, q * sign);
  };
  return Object.defineProperty(method, 'name', { value: name });
}

/**
 * Check if a value is a Complex number.
 *
 * True for a `Complex` of this copy of the package and for one of a second copy, which carries the
 * same prototype brand (see `type-marker.ts`). The `instanceof` test comes first: it is the fast
 * path for a value of this copy, and the brand test decides for every other value.
 */
export function isComplex(value: unknown): value is Complex {
  return (
    value instanceof Complex ||
    (typeof value === 'object' &&
      value !== null &&
      (value as { [COMPLEX_BRAND]?: unknown })[COMPLEX_BRAND] === true)
  );
}

/**
 * Overflow/underflow-safe hypotenuse with a fast path for the common finite range.
 *
 * `Math.hypot` is correctly rounded and safe at the extremes, but it is a function
 * call plus scaling work. For typical magnitudes (well inside (1e-150, 1e150))
 * `sqrt(re²+im²)` is exact enough for every public test and substantially cheaper —
 * this is the path `abs`, `sign`, and `sqrt` share.
 *
 * Outside that window we fall through to `Math.hypot` so huge values do not overflow
 * to `Infinity` and denormals do not flush to `0`. A non-finite part also takes `Math.hypot`:
 * an infinite part gives Infinity, also with a NaN part, and else a NaN part gives NaN (#1259).
 */
function hypotFast(re: number, im: number): number {
  if (im === 0) return Math.abs(re);
  if (re === 0) return Math.abs(im);
  const a = re < 0 ? -re : re;
  const b = im < 0 ? -im : im;
  if (a < 1e150 && b < 1e150 && (a > 1e-150 || b > 1e-150)) {
    return Math.sqrt(re * re + im * im);
  }
  // `Math.hypot` follows IEEE 754: an infinite part gives Infinity, also when the other part is
  // NaN; else a NaN part gives NaN. This is the rule of `hypot` and `norm` (#1259).
  return Math.hypot(re, im);
}

/**
 * Logarithm of the complex modulus. Match complex.js rounding where the sum
 * of squares stays in range and scale before squaring at extreme magnitudes.
 */
function logHypot(a: number, b: number): number {
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  if (a === 0) return Math.log(absB);
  if (b === 0) return Math.log(absA);
  if (absA < 3000 && absB < 3000) {
    const sum = a * a + b * b;
    if (sum >= 2 ** -1022) return Math.log(sum) * 0.5;
  } else {
    const halfA = a * 0.5;
    const halfB = b * 0.5;
    const sum = halfA * halfA + halfB * halfB;
    if (Number.isFinite(sum)) return 0.5 * Math.log(sum) + Math.LN2;
  }
  if (absA === Infinity || absB === Infinity) return Infinity;
  const scale = Math.max(absA, absB);
  const ratio = Math.min(absA, absB) / scale;
  return Math.log(scale) + 0.5 * Math.log1p(ratio * ratio);
}

/**
 * `r · e^(i·theta)` computed as mathjs computes a cube root: `(r + 0i) · exp(0 + theta·i)`.
 */
function cubeRootAt(r: number, theta: number): Complex {
  return new Complex(r, 0).mul(new Complex(0, theta).exp());
}

/**
 * Complex number class with full arithmetic support
 * Implements the IComplex interface for type-safe complex number operations.
 */
// eslint-disable-next-line typescript/no-unsafe-declaration-merging -- tan/cot/tanh/coth are declared by the `Complex` interface below the class and installed by the static block
export class Complex implements IComplex {
  readonly type = 'Complex';
  readonly re: number;
  readonly im: number;

  constructor(re: number, im: number = 0) {
    this.re = re;
    this.im = im;
  }

  // `tan`, `cot`, `tanh` and `coth` are created from `createTanFamilyMethod`, with the same property
  // attributes a class method has. Their signatures and docs sit on the `Complex` interface below.
  static {
    // Prototype markers: the brand that `isComplex` reads, and the mathjs marker.
    defineTypeMarkers(Complex.prototype, COMPLEX_BRAND, 'isComplex');
    const tanFamily = [
      ['tan', 1, false],
      ['cot', -1, false],
      ['tanh', 1, true],
      ['coth', -1, true],
    ] as const;
    for (const [name, sign, hyperbolic] of tanFamily) {
      Object.defineProperty(Complex.prototype, name, {
        value: createTanFamilyMethod(name, sign, hyperbolic),
        writable: true,
        configurable: true,
        enumerable: false,
      });
    }
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
   * Parse a complex number from a string, with the grammar of the mathjs string parser.
   *
   * The text is a sum of signed terms. A term is a number (`3`, `.5`, `5.`, `1e3`, `1.5e-2`), a
   * number followed by `i` (`4i`, `1e3i`), `i`, or `i` followed by a number (`i2`). Several signs
   * in a row combine (`--1` is 1, `1+-2i` is 1 - 2i), a `_` is ignored, and `I` is the same as `i`.
   * Three rules keep text that older versions read correctly:
   * 1. White space is ignored, except between two number characters (`'3 + 4 i'` is 3 + 4i, but
   *    `'1 2'` is not a number).
   * 2. The exponent marker is `e` or `E`.
   * 3. `Infinity` is a number (`'-Infinity'`, `'2+Infinityi'`). `NaN` is not a number.
   *
   * A string that is not a complex number throws `SyntaxError('Invalid Param')`, as in mathjs.
   * @param str - the text to read
   * @returns the complex number that the text names
   */
  static parse(str: string): Complex {
    const invalid = (): SyntaxError => new SyntaxError('Invalid Param');
    // Each run of white space is tested once, on the two characters that touch it. A pattern with
    // a look-behind and a look-ahead tests the run again from every start position inside it: its
    // time grows with the square of the run length (23 s for 1e5 spaces). The number pattern is
    // `\d+(?:\.\d*)?`, not `\d+\.?\d*`: both name the same strings, but two adjacent `\d`
    // quantifiers split a long digit run in every possible way when the exponent is missing.
    const tokens = str
      .replace(/_/g, '')
      .replace(/\s+/g, (run: string, at: number, whole: string) =>
        /[\d.eE]/.test(whole[at - 1] ?? '') && /[\d.eE]/.test(whole[at + run.length] ?? '')
          ? run
          : ''
      )
      .match(/\d+(?:\.\d*)?[eE][+-]?\d+|\d+(?:\.\d*)?|\.\d+|Infinity|[^]/g);
    if (tokens === null) throw invalid();
    let re = 0;
    let im = 0;
    let plus = 1;
    let minus = 0;
    for (let i = 0; i < tokens.length; i++) {
      const c = tokens[i];
      if (c === '+') {
        plus++;
        continue;
      }
      if (c === '-') {
        minus++;
        continue;
      }
      if (plus + minus === 0) throw invalid(); // two terms with no sign between them
      const sign = minus % 2 ? '-' : '';
      const next = tokens[i + 1];
      if (c === 'i' || c === 'I') {
        if (next !== undefined && !Number.isNaN(Number(next))) {
          im += Number(sign + next);
          i++;
        } else {
          im += Number(sign + '1');
        }
      } else {
        if (Number.isNaN(Number(c))) throw invalid();
        if (next === 'i' || next === 'I') {
          im += Number(sign + c);
          i++;
        } else {
          re += Number(sign + c);
        }
      }
      plus = minus = 0;
    }
    if (plus + minus > 0) throw invalid(); // a sign with no term after it
    return new Complex(re, im);
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
    // complex.js (mathjs) prints a non-finite value as one bare word.
    if (Number.isNaN(this.re) || Number.isNaN(this.im)) return 'NaN';
    if (!Number.isFinite(this.re) || !Number.isFinite(this.im)) return 'Infinity';
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
    if (isComplex(other)) {
      return new Complex(this.re + other.re, this.im + other.im);
    }
    return new Complex(this.re + Number(other.valueOf()), this.im);
  }

  /**
   * Subtraction: (a + bi) - (c + di) = (a - c) + (b - d)i
   */
  subtract(other: Scalar): Complex {
    if (isComplex(other)) {
      return new Complex(this.re - other.re, this.im - other.im);
    }
    return new Complex(this.re - Number(other.valueOf()), this.im);
  }

  /**
   * Multiplication: (a + bi)(c + di) = (ac - bd) + (ad + bc)i
   */
  multiply(other: Scalar): Complex {
    if (isComplex(other)) {
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
    if (isComplex(other)) {
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
    return new Complex(logHypot(this.re, this.im), this.arg());
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
   * Power `z^w`, the algorithm of complex.js 2.4.3 (the library of mathjs), so the result equals
   * mathjs bit for bit. `w` is a number or a Complex; both take the same body.
   *
   * - `z^0` is 1.
   * - A zero base with a real exponent follows the IEEE 754 pow rules: `0^y` is 0 for `y > 0`
   *   and +Infinity for `y < 0`. (complex.js reads a zero base as a pure imaginary number there
   *   and gives -0 + 0i for `0^2` and 0 - Infinity i for `0^(-1)`.)
   * - A positive real base with a real exponent gives `Math.pow`.
   * - A pure imaginary base with an integer exponent takes the exact power of `i`.
   * - Else `exp(c·L − d·θ) · (cos(d·L + c·θ) + i·sin(d·L + c·θ))`, with `L = log|z|` (see
   *   `logHypot`), `θ = arg z` and `w = c + d·i`. A zero base with `c > 0` gives 0.
   * - Where complex.js computes Infinity · 0 = NaN, the result keeps the IEEE value. Three
   *   cases: the squares of `logHypot` overflow for a finite base above about 2.7e154 (mathjs
   *   gives NaN + NaN i for `(1e300 + 1e300i)^0.5`); `d · L` is 0 · Infinity for a real exponent
   *   of an infinite base; and an infinite scale times an exact-zero trig part. A result that is
   *   finite in complex.js does not change.
   */
  pow(n: number | Complex): Complex {
    const c = typeof n === 'number' ? n : n.re;
    const d = typeof n === 'number' ? 0 : n.im;
    const a = this.re;
    const b = this.im;
    if (c === 0 && d === 0) return new Complex(1, 0);
    if (d === 0) {
      if (a === 0 && b === 0) {
        if (c > 0) return new Complex(0, 0);
        if (c < 0) return new Complex(Infinity, 0);
      } else if (b === 0 && a > 0) {
        return new Complex(Math.pow(a, c), 0);
      } else if (a === 0) {
        // No `default`: a non-integer exponent gives NaN here and takes the general formula.
        switch (((c % 4) + 4) % 4) {
          case 0:
            return new Complex(Math.pow(b, c), 0);
          case 1:
            return new Complex(0, Math.pow(b, c));
          case 2:
            return new Complex(-Math.pow(b, c), 0);
          case 3:
            return new Complex(0, -Math.pow(b, c));
        }
      }
    }
    if (a === 0 && b === 0 && c > 0) return new Complex(0, 0);
    const theta = Math.atan2(b, a);
    const loh = logHypot(a, b);
    const scale = Math.exp(c * loh - d * theta);
    // complex.js computes `d * loh` also for a real exponent. When the modulus overflows
    // (`loh` is infinite), that is 0 * Infinity = NaN, and `(1e300 + 1e300i)^2` is NaN + NaN i.
    // The term is 0 for a real exponent, so a modulus that overflows gives an infinite result.
    // For every other input the term is the complex.js term, so the bits do not change.
    const dLoh = d === 0 && (loh === Infinity || loh === -Infinity) ? 0 : d * loh;
    const angle = dLoh + c * theta;
    // `fromPolar` is `scale · cos` and `scale · sin` (the complex.js product) for a finite scale.
    // For an infinite scale it keeps an exact-zero trig part, where complex.js gives
    // Infinity · 0 = NaN.
    return Complex.fromPolar(scale, angle);
  }

  /**
   * The principal cube root, `cbrt(|z|) · e^(i·arg(z)/3)`, as mathjs `cbrt` of a Complex.
   */
  cbrt(): Complex {
    return cubeRootAt(Math.cbrt(this.abs()), this.arg() / 3);
  }

  /**
   * The three cube roots, principal first, then the principal root turned by +2π/3 and by
   * −2π/3, as mathjs `cbrt(z, true)`.
   */
  cbrtRoots(): [Complex, Complex, Complex] {
    const r = Math.cbrt(this.abs());
    const arg3 = this.arg() / 3;
    return [
      cubeRootAt(r, arg3),
      cubeRootAt(r, arg3 + (Math.PI * 2) / 3),
      cubeRootAt(r, arg3 - (Math.PI * 2) / 3),
    ];
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
 * The four tangent methods of {@link Complex}, merged with the class. The merge keeps their method
 * signatures in the emitted `.d.ts`; a `declare tan: () => Complex` field publishes a property.
 * The static block of the class installs the bodies, and `complex-tan-family-pin.test.ts` calls
 * each one.
 */
export interface Complex {
  /**
   * Tangent: tan(x+iy) = (sin 2x + i sinh 2y) / (cos 2x + cosh 2y)
   *
   * Closed form — no intermediate `sin`/`cos` Complex allocations.
   */
  tan(): Complex;

  /**
   * Cotangent: cot(x+iy) = (sin 2x − i sinh 2y) / (cosh 2y − cos 2x)
   */
  cot(): Complex;

  /**
   * Hyperbolic tangent: tanh(x+iy) = (sinh 2x + i sin 2y) / (cosh 2x + cos 2y)
   */
  tanh(): Complex;

  /**
   * Hyperbolic cotangent: coth(x+iy) = (sinh 2x − i sin 2y) / (cosh 2x − cos 2y)
   */
  coth(): Complex;
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
