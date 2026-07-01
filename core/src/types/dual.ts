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
 * the `functions` package are one-liners (e.g. `Dual: (a) => a.sin()`). The
 * elementary-function rules themselves come from the shared
 * {@link DUAL_UNARY_RULES} table so the scalar `Dual` and autograd's tensor
 * `DualTensor` apply exactly the same chain rules (no reinvention).
 */
import { DUAL_UNARY_RULES, type DualUnaryRule } from './dual-rules.js';

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
  // Each applies the shared chain rule (value, deriv) ↦ (f(v), deriv·f′(v))
  // using the canonical rule from `DUAL_UNARY_RULES`, so the scalar and tensor
  // AD paths can never drift apart.
  private unary(rule: DualUnaryRule): Dual {
    const y = rule.primal(this.value);
    return new Dual(y, this.deriv * rule.deriv(this.value, y));
  }
  sin(): Dual {
    return this.unary(DUAL_UNARY_RULES.sin);
  }
  cos(): Dual {
    return this.unary(DUAL_UNARY_RULES.cos);
  }
  tan(): Dual {
    return this.unary(DUAL_UNARY_RULES.tan);
  }
  exp(): Dual {
    return this.unary(DUAL_UNARY_RULES.exp);
  }
  log(): Dual {
    return this.unary(DUAL_UNARY_RULES.log);
  }
  sqrt(): Dual {
    return this.unary(DUAL_UNARY_RULES.sqrt);
  }
  square(): Dual {
    return this.unary(DUAL_UNARY_RULES.square);
  }
  abs(): Dual {
    return this.unary(DUAL_UNARY_RULES.abs);
  }
  sinh(): Dual {
    return this.unary(DUAL_UNARY_RULES.sinh);
  }
  cosh(): Dual {
    return this.unary(DUAL_UNARY_RULES.cosh);
  }
  tanh(): Dual {
    return this.unary(DUAL_UNARY_RULES.tanh);
  }

  toString(): string {
    return `Dual(${this.value}, ${this.deriv})`;
  }
}

/** Type guard for {@link Dual}. */
export function isDual(x: unknown): x is Dual {
  return x instanceof Dual;
}
