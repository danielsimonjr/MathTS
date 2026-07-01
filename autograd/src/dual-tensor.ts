/**
 * DualTensor — a Tensor + per-element tangent component for forward-mode AD.
 * Storage: two Float64Arrays of equal length (primal + tangent), shape from
 * the wrapped Tensor. Arithmetic follows the dual-number rules:
 *   (a, a') + (b, b') = (a+b, a'+b')
 *   (a, a') * (b, b') = (a·b, a·b' + a'·b)
 *   (a, a') / (b, b') = (a/b, (a'·b − a·b')/b²)
 *   scale((a, a'), k)  = (k·a, k·a')
 * Elementwise unless noted. Reductions and contractions add their own rules.
 *
 * The dual-number framework: tracking ε such that ε²=0; (a + a'·ε)(b + b'·ε)
 * = ab + (ab'+a'b)ε, so the tangent is the linearized first-order response.
 *
 * @packageDocumentation
 */
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { DUAL_UNARY_RULES, type DualUnaryRule } from '@danielsimonjr/mathts-core';

export class DualTensor {
  readonly shape: ReadonlyArray<number>;
  readonly primal: Float64Array;
  readonly tangent: Float64Array;

  constructor(shape: ReadonlyArray<number>, primal: Float64Array, tangent: Float64Array) {
    if (primal.length !== tangent.length) {
      throw new Error(
        `DualTensor: primal length ${primal.length} != tangent length ${tangent.length}`
      );
    }
    this.shape = shape;
    this.primal = primal;
    this.tangent = tangent;
  }

  /**
   * S5 fix: existing engine ops (e.g. lower, pderiv, contract) reach into
   * `.data`. The getter returns the primal so those ops still work when a
   * DualTensor flows through them as a structurally-compatible Tensor.
   * (AD-aware ops branch on `'tangent' in arg` before reaching here.)
   */
  get data(): Float64Array {
    return this.primal;
  }

  /** Lift a Tensor to a DualTensor with zero tangent. */
  static fromTensor(t: Tensor): DualTensor {
    return new DualTensor(t.shape, new Float64Array(t.data), new Float64Array(t.data.length));
  }

  /** Lift a Tensor to a DualTensor with a unit tangent at flat-index `i`. */
  static unitAt(t: Tensor, i: number): DualTensor {
    const tan = new Float64Array(t.data.length);
    tan[i] = 1;
    return new DualTensor(t.shape, new Float64Array(t.data), tan);
  }

  /** Extract the primal as a plain Tensor. */
  toPrimalTensor(): Tensor {
    return new Tensor(this.shape, new Float64Array(this.primal));
  }

  /** Extract the tangent as a plain Tensor. */
  toTangentTensor(): Tensor {
    return new Tensor(this.shape, new Float64Array(this.tangent));
  }

  /** Elementwise addition following dual-number rule: (a+b, a'+b'). */
  add(other: DualTensor): DualTensor {
    this.checkSameShape(other, 'add');
    const p = new Float64Array(this.primal.length);
    const t = new Float64Array(this.tangent.length);
    for (let i = 0; i < p.length; i++) {
      p[i] = this.primal[i] + other.primal[i];
      t[i] = this.tangent[i] + other.tangent[i];
    }
    return new DualTensor(this.shape, p, t);
  }

  /** Elementwise subtraction following dual-number rule: (a-b, a'-b'). */
  sub(other: DualTensor): DualTensor {
    this.checkSameShape(other, 'sub');
    const p = new Float64Array(this.primal.length);
    const t = new Float64Array(this.tangent.length);
    for (let i = 0; i < p.length; i++) {
      p[i] = this.primal[i] - other.primal[i];
      t[i] = this.tangent[i] - other.tangent[i];
    }
    return new DualTensor(this.shape, p, t);
  }

  /**
   * Elementwise multiplication following dual-number rule: (a·b, a·b' + a'·b).
   *
   * I3 fix: explicit alias check. When `this === other` (self-multiplication),
   * use the specialised rule (a·a)' = 2·a·a' directly. The general rule also
   * degenerates correctly, but the explicit branch is more readable and aligns
   * the forward-mode implementation with the reverse-mode alias fix.
   */
  mul(other: DualTensor): DualTensor {
    this.checkSameShape(other, 'mul');
    const p = new Float64Array(this.primal.length);
    const t = new Float64Array(this.tangent.length);
    if (this === other) {
      // (a · a)' = 2·a·a'
      for (let i = 0; i < p.length; i++) {
        p[i] = this.primal[i] * this.primal[i];
        t[i] = 2 * this.primal[i] * this.tangent[i];
      }
    } else {
      for (let i = 0; i < p.length; i++) {
        p[i] = this.primal[i] * other.primal[i];
        // (a·b)' = a'·b + a·b'
        t[i] = this.tangent[i] * other.primal[i] + this.primal[i] * other.tangent[i];
      }
    }
    return new DualTensor(this.shape, p, t);
  }

  /** Scalar multiplication following dual-number rule: (k·a, k·a'). */
  scale(k: number): DualTensor {
    const p = new Float64Array(this.primal.length);
    const t = new Float64Array(this.tangent.length);
    for (let i = 0; i < p.length; i++) {
      p[i] = this.primal[i] * k;
      t[i] = this.tangent[i] * k;
    }
    return new DualTensor(this.shape, p, t);
  }

  /**
   * Elementwise division following the dual-number quotient rule:
   *   (a, a') / (b, b') = (a/b, (a'·b − a·b') / b²).
   * The aliased case a.divide(a) is (1, 0).
   */
  divide(other: DualTensor): DualTensor {
    this.checkSameShape(other, 'divide');
    const p = new Float64Array(this.primal.length);
    const t = new Float64Array(this.tangent.length);
    if (this === other) {
      for (let i = 0; i < p.length; i++) {
        p[i] = 1;
        t[i] = 0;
      }
    } else {
      for (let i = 0; i < p.length; i++) {
        const a = this.primal[i];
        const b = other.primal[i];
        p[i] = a / b;
        t[i] = (this.tangent[i] * b - a * other.tangent[i]) / (b * b);
      }
    }
    return new DualTensor(this.shape, p, t);
  }

  // ---------------------------------------------------------------------------
  // Elementwise unary ops (parity with reverse-mode TapedTensor). Each follows
  // the dual-number rule (a, a') ↦ (f(a), f'(a)·a'), built via the
  // `_unaryElementwise` helper. `deriv(x, y)` is f'(x) given input x and the
  // computed output y (so adjoints needing y — exp, tanh, sqrt — stay uniform).
  // ---------------------------------------------------------------------------

  private _unaryElementwise(
    primalFn: (x: number) => number,
    deriv: (x: number, y: number) => number
  ): DualTensor {
    const p = new Float64Array(this.primal.length);
    const t = new Float64Array(this.tangent.length);
    for (let i = 0; i < p.length; i++) {
      const y = primalFn(this.primal[i]);
      p[i] = y;
      t[i] = deriv(this.primal[i], y) * this.tangent[i];
    }
    return new DualTensor(this.shape, p, t);
  }

  /**
   * Apply a shared elementary rule from core's `DUAL_UNARY_RULES` element-wise.
   * Sourcing `primal`/`deriv` from the canonical table (rather than inline
   * `Math.*`) keeps this AD path and the scalar `Dual` in lock-step and lets a
   * future accelerated `primal` in the standard layer propagate here for free —
   * the loop still calls plain scalar functions, so it stays allocation-free.
   */
  private _rule(rule: DualUnaryRule): DualTensor {
    return this._unaryElementwise(rule.primal, rule.deriv);
  }

  /** Exponential. f'(x) = eˣ = y. */
  exp(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.exp);
  }

  /** Natural logarithm. f'(x) = 1/x. */
  log(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.log);
  }

  /** Sine. f'(x) = cos(x). */
  sin(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.sin);
  }

  /** Cosine. f'(x) = −sin(x). */
  cos(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.cos);
  }

  /** Tangent. f'(x) = 1/cos²(x). */
  tan(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.tan);
  }

  /** Square root. f'(x) = 1/(2·y) where y = √x. */
  sqrt(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.sqrt);
  }

  /** Square (x²). f'(x) = 2x. */
  square(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.square);
  }

  /** Reciprocal (1/x). f'(x) = −1/x². */
  reciprocal(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.reciprocal);
  }

  /** Absolute value. f'(x) = sign(x) (subgradient 0 at exact zero). */
  abs(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.abs);
  }

  /** Fixed-exponent power x^k. f'(x) = k·x^(k−1). */
  pow(k: number): DualTensor {
    return this._unaryElementwise(
      (x) => Math.pow(x, k),
      (x) => k * Math.pow(x, k - 1)
    );
  }

  /** Hyperbolic sine. f'(x) = cosh(x). */
  sinh(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.sinh);
  }

  /** Hyperbolic cosine. f'(x) = sinh(x). */
  cosh(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.cosh);
  }

  /** Hyperbolic tangent. f'(x) = 1 − tanh²(x) = 1 − y². */
  tanh(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.tanh);
  }

  /** Arcsine. f'(x) = 1/√(1 − x²). */
  asin(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.asin);
  }

  /** Arccosine. f'(x) = −1/√(1 − x²). */
  acos(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.acos);
  }

  /** Arctangent. f'(x) = 1/(1 + x²). */
  atan(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.atan);
  }

  /** Inverse hyperbolic sine. f'(x) = 1/√(x² + 1). */
  asinh(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.asinh);
  }

  /** Inverse hyperbolic cosine (x ≥ 1). f'(x) = 1/√(x² − 1). */
  acosh(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.acosh);
  }

  /** Inverse hyperbolic tangent (|x| < 1). f'(x) = 1/(1 − x²). */
  atanh(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.atanh);
  }

  /** Base-2 logarithm. f'(x) = 1/(x·ln2). */
  log2(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.log2);
  }

  /** Base-10 logarithm. f'(x) = 1/(x·ln10). */
  log10(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.log10);
  }

  /** log(1 + x). f'(x) = 1/(1 + x). */
  log1p(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.log1p);
  }

  /** exp(x) − 1. f'(x) = eˣ = y + 1. */
  expm1(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.expm1);
  }

  /** Cube root. f'(x) = 1/(3·y²) where y = x^(1/3) (→∞ at x = 0). */
  cbrt(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.cbrt);
  }

  /** Sign (−1/0/+1). f'(x) = 0 almost everywhere. */
  sign(): DualTensor {
    return this._rule(DUAL_UNARY_RULES.sign);
  }

  /**
   * Two-argument arctangent: atan2(this, other), this = y, other = x.
   * Tangent: (b·a' − a·b') / (a² + b²), with a = this, b = other.
   */
  atan2(other: DualTensor): DualTensor {
    this.checkSameShape(other, 'atan2');
    const p = new Float64Array(this.primal.length);
    const t = new Float64Array(this.tangent.length);
    for (let i = 0; i < p.length; i++) {
      const a = this.primal[i];
      const b = other.primal[i];
      p[i] = Math.atan2(a, b);
      const d = a * a + b * b;
      t[i] = (b * this.tangent[i] - a * other.tangent[i]) / d;
    }
    return new DualTensor(this.shape, p, t);
  }

  private checkSameShape(other: DualTensor, op: string): void {
    if (
      this.shape.length !== other.shape.length ||
      !this.shape.every((v, i) => v === other.shape[i])
    ) {
      throw new Error(`DualTensor.${op}: shape mismatch [${this.shape}] vs [${other.shape}]`);
    }
  }
}
