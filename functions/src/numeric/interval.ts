/**
 * Interval arithmetic with outward rounding.
 *
 * `Interval` (constructed via the `interval(lo, hi)` factory) implements
 * rigorous interval arithmetic: every operation guarantees the true
 * mathematical result over any pair of real inputs drawn from the operand
 * intervals is contained in the returned interval. JavaScript has no access
 * to IEEE-754 directed rounding modes (round-toward-negative-infinity /
 * round-toward-positive-infinity), so as a practical surrogate every result
 * is nudged outward by a tiny relative epsilon (`Number.EPSILON`) plus one
 * ULP (`Number.MIN_VALUE`) after each operation: `lo` is decreased and `hi`
 * is increased. This is the same idea underlying mpmath's `iv` module and
 * MATLAB's INTLAB — a verified-bounds numeric type, the first in this
 * library.
 *
 * @packageDocumentation
 */

/** Relative widening applied to outward-rounded endpoints (one ULP-ish margin). */
const EPS = Number.EPSILON;

/** Widen `[lo, hi]` outward by a relative epsilon plus one ULP, then build an `Interval`. */
function outward(lo: number, hi: number): Interval {
  const loOut = lo - Math.abs(lo) * EPS - Number.MIN_VALUE;
  const hiOut = hi + Math.abs(hi) * EPS + Number.MIN_VALUE;
  return new Interval(loOut, hiOut);
}

/**
 * A closed real interval `[lo, hi]` with outward-rounded arithmetic.
 *
 * Construct via the {@link interval} factory rather than `new Interval(...)`
 * directly (both work; the factory reads more naturally at call sites).
 */
export class Interval {
  readonly lo: number;
  readonly hi: number;

  constructor(lo: number, hi: number) {
    if (lo > hi) {
      throw new Error(`Interval: lo (${lo}) must be <= hi (${hi})`);
    }
    this.lo = lo;
    this.hi = hi;
  }

  /** `[this.lo + b.lo, this.hi + b.hi]`, outward-rounded. */
  add(b: Interval): Interval {
    return outward(this.lo + b.lo, this.hi + b.hi);
  }

  /** `[this.lo - b.hi, this.hi - b.lo]`, outward-rounded. */
  sub(b: Interval): Interval {
    return outward(this.lo - b.hi, this.hi - b.lo);
  }

  /**
   * Interval product: the min/max of all four endpoint products
   * (`lo*lo, lo*hi, hi*lo, hi*hi`), outward-rounded. Correct for any
   * combination of signs.
   */
  mul(b: Interval): Interval {
    const p1 = this.lo * b.lo;
    const p2 = this.lo * b.hi;
    const p3 = this.hi * b.lo;
    const p4 = this.hi * b.hi;
    return outward(Math.min(p1, p2, p3, p4), Math.max(p1, p2, p3, p4));
  }

  /**
   * Interval quotient. Throws if `b` contains 0 (division would be
   * unbounded). Otherwise the min/max of the four endpoint quotients,
   * outward-rounded.
   */
  div(b: Interval): Interval {
    if (b.contains(0)) {
      throw new Error('Interval.div: divisor interval contains zero');
    }
    const q1 = this.lo / b.lo;
    const q2 = this.lo / b.hi;
    const q3 = this.hi / b.lo;
    const q4 = this.hi / b.hi;
    return outward(Math.min(q1, q2, q3, q4), Math.max(q1, q2, q3, q4));
  }

  /** `[-this.hi, -this.lo]`, outward-rounded. */
  neg(): Interval {
    return outward(-this.hi, -this.lo);
  }

  /** `hi - lo`. */
  width(): number {
    return this.hi - this.lo;
  }

  /** `(lo + hi) / 2`. */
  mid(): number {
    return (this.lo + this.hi) / 2;
  }

  /** Whether the closed interval `[lo, hi]` contains the real number `x`. */
  contains(x: number): boolean {
    return x >= this.lo && x <= this.hi;
  }

  /**
   * Square root, monotonic-increasing over `[0, +Infinity)`. Throws if the
   * interval contains negative values (real square root is undefined there).
   */
  sqrt(): Interval {
    if (this.lo < 0) {
      throw new Error('Interval.sqrt: interval contains negative values');
    }
    return outward(Math.sqrt(this.lo), Math.sqrt(this.hi));
  }

  /** Exponential, monotonic-increasing over all reals. */
  exp(): Interval {
    return outward(Math.exp(this.lo), Math.exp(this.hi));
  }

  /**
   * Natural log, monotonic-increasing over `(0, +Infinity)`. Throws if the
   * interval is not strictly positive.
   */
  log(): Interval {
    if (this.lo <= 0) {
      throw new Error('Interval.log: interval must be strictly positive');
    }
    return outward(Math.log(this.lo), Math.log(this.hi));
  }

  /**
   * Integer power `x^n`, monotonic-aware:
   * - `n` odd: `x^n` is monotonic-increasing over all reals, so the result is
   *   `[lo^n, hi^n]`.
   * - `n` even, interval entirely non-negative: monotonic-increasing, so
   *   `[lo^n, hi^n]`.
   * - `n` even, interval entirely non-positive: monotonic-decreasing (in
   *   magnitude, toward zero), so `[hi^n, lo^n]`.
   * - `n` even, interval spans zero: the minimum is `0` (attained at `x=0`)
   *   and the maximum is `max(|lo|, |hi|)^n`.
   * - `n` negative: computed as the reciprocal of `pow(-n)`; throws if that
   *   positive-power interval contains zero (division by zero).
   * - `n = 0`: `[1, 1]` for every interval.
   *
   * Throws if `n` is not an integer.
   */
  pow(n: number): Interval {
    if (!Number.isInteger(n)) {
      throw new Error('Interval.pow: exponent must be an integer');
    }
    if (n === 0) {
      return outward(1, 1);
    }
    if (n < 0) {
      const positivePow = this.pow(-n);
      if (positivePow.contains(0)) {
        throw new Error('Interval.pow: cannot invert an interval containing zero');
      }
      return outward(1 / positivePow.hi, 1 / positivePow.lo);
    }
    const isOdd = n % 2 !== 0;
    if (isOdd) {
      return outward(this.lo ** n, this.hi ** n);
    }
    if (this.lo >= 0) {
      return outward(this.lo ** n, this.hi ** n);
    }
    if (this.hi <= 0) {
      return outward(this.hi ** n, this.lo ** n);
    }
    const maxAbs = Math.max(Math.abs(this.lo), Math.abs(this.hi));
    return outward(0, maxAbs ** n);
  }
}

/** Construct an `Interval([lo, hi])`. Throws if `lo > hi`. */
export function interval(lo: number, hi: number): Interval {
  return new Interval(lo, hi);
}
