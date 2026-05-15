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

export class DualTensor {
  readonly shape: ReadonlyArray<number>;
  readonly primal: Float64Array;
  readonly tangent: Float64Array;

  constructor(shape: ReadonlyArray<number>, primal: Float64Array, tangent: Float64Array) {
    if (primal.length !== tangent.length) {
      throw new Error(`DualTensor: primal length ${primal.length} != tangent length ${tangent.length}`);
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
  get data(): Float64Array { return this.primal; }

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

  private checkSameShape(other: DualTensor, op: string): void {
    if (this.shape.length !== other.shape.length ||
        !this.shape.every((v, i) => v === other.shape[i])) {
      throw new Error(`DualTensor.${op}: shape mismatch [${this.shape}] vs [${other.shape}]`);
    }
  }
}
