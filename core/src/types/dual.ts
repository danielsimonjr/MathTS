/**
 * Dual number for forward-mode automatic differentiation.
 *
 * A dual number `a + b·ε` (with ε² = 0) carries a value and its first
 * derivative. Evaluating a function built from the overloaded elementary
 * operations on `Dual.variable(x)` propagates the derivative automatically:
 *
 *   derivative(x => multiply(sin(x), x), 2)
 *     // sin(2)·1 + 2·cos(2)  — exact, no finite differences
 *
 * The derivative rules live here as methods so the typed-function signatures in
 * the `functions` package are one-liners (e.g. `Dual: (a) => a.sin()`).
 */
export class Dual {
  /** Function value (the real part). */
  readonly value: number;
  /** First derivative (the ε coefficient). */
  readonly deriv: number;

  constructor(value: number, deriv = 0) {
    this.value = value;
    this.deriv = deriv;
  }

  /** A constant (derivative 0). */
  static constant(v: number): Dual {
    return new Dual(v, 0);
  }

  /** A seed variable (derivative 1) — the point of differentiation. */
  static variable(v: number): Dual {
    return new Dual(v, 1);
  }

  // --- arithmetic ----------------------------------------------------------
  add(o: Dual): Dual {
    return new Dual(this.value + o.value, this.deriv + o.deriv);
  }
  sub(o: Dual): Dual {
    return new Dual(this.value - o.value, this.deriv - o.deriv);
  }
  mul(o: Dual): Dual {
    return new Dual(this.value * o.value, this.deriv * o.value + this.value * o.deriv);
  }
  div(o: Dual): Dual {
    const d = (this.deriv * o.value - this.value * o.deriv) / (o.value * o.value);
    return new Dual(this.value / o.value, d);
  }
  neg(): Dual {
    return new Dual(-this.value, -this.deriv);
  }
  /** Power with a constant real exponent: d(xᵏ) = k·xᵏ⁻¹·dx. */
  powConst(k: number): Dual {
    return new Dual(Math.pow(this.value, k), this.deriv * k * Math.pow(this.value, k - 1));
  }
  /** General power a^b: d = a^b·(b'·ln a + b·a'/a). */
  pow(o: Dual): Dual {
    const v = Math.pow(this.value, o.value);
    const d = v * (o.deriv * Math.log(this.value) + (o.value * this.deriv) / this.value);
    return new Dual(v, d);
  }

  // --- elementary functions ------------------------------------------------
  sin(): Dual {
    return new Dual(Math.sin(this.value), this.deriv * Math.cos(this.value));
  }
  cos(): Dual {
    return new Dual(Math.cos(this.value), -this.deriv * Math.sin(this.value));
  }
  tan(): Dual {
    const c = Math.cos(this.value);
    return new Dual(Math.tan(this.value), this.deriv / (c * c));
  }
  exp(): Dual {
    const e = Math.exp(this.value);
    return new Dual(e, this.deriv * e);
  }
  log(): Dual {
    return new Dual(Math.log(this.value), this.deriv / this.value);
  }
  sqrt(): Dual {
    const s = Math.sqrt(this.value);
    return new Dual(s, this.deriv / (2 * s));
  }
  square(): Dual {
    return new Dual(this.value * this.value, 2 * this.value * this.deriv);
  }
  abs(): Dual {
    return new Dual(Math.abs(this.value), this.deriv * Math.sign(this.value));
  }
  sinh(): Dual {
    return new Dual(Math.sinh(this.value), this.deriv * Math.cosh(this.value));
  }
  cosh(): Dual {
    return new Dual(Math.cosh(this.value), this.deriv * Math.sinh(this.value));
  }
  tanh(): Dual {
    const t = Math.tanh(this.value);
    return new Dual(t, this.deriv * (1 - t * t));
  }

  toString(): string {
    return `Dual(${this.value}, ${this.deriv})`;
  }
}

/** Type guard for {@link Dual}. */
export function isDual(x: unknown): x is Dual {
  return x instanceof Dual;
}
