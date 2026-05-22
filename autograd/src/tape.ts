/**
 * Tape — records the sequence of ops during a forward pass so we can
 * replay them in reverse to compute the vector-Jacobian product.
 *
 * Each TapedTensor wraps a primal Tensor + a tape-node id. Ops on
 * TapedTensors record their backward closures into a shared Tape.
 * After the forward pass, calling Tape.backward(outputGrad) walks the
 * tape in reverse, accumulating gradients into each input slot.
 *
 * v0.1.0 supports the same ops as DualTensor: add, sub, mul, scale.
 */
import { Tensor } from '@danielsimonjr/mathts-tensor';

type BackwardFn = (outputGrad: Float64Array) => void;

interface TapeNode {
  readonly inputIds: ReadonlyArray<number>;
  readonly backward: BackwardFn;
  readonly outputGradSlot: Float64Array;
}

export class Tape {
  private nodes: TapeNode[] = [];
  private inputGradSlots = new Map<number, Float64Array>();

  // S3 fix: disjoint ID namespaces. Inputs use negative IDs, ops use
  // non-negative IDs. Eliminates the v0.4.0-review collision where
  // id = nodes.length + 1000 would collide with op ids past 1000 entries.
  private nextOpId = 0;
  private nextInputId = -1; // negatives = inputs; non-negatives = ops

  /** Allocate a fresh id for an input or intermediate. */
  allocate(size: number): { id: number; gradSlot: Float64Array } {
    const id = this.nextInputId--;
    const gradSlot = new Float64Array(size);
    this.inputGradSlots.set(id, gradSlot);
    return { id, gradSlot };
  }

  record(
    inputIds: ReadonlyArray<number>,
    outputSize: number,
    backward: BackwardFn
  ): { id: number; gradSlot: Float64Array } {
    const outputGradSlot = new Float64Array(outputSize);
    const id = this.nextOpId++;
    this.nodes.push({ inputIds, backward, outputGradSlot });
    this.inputGradSlots.set(id, outputGradSlot);
    return { id, gradSlot: outputGradSlot };
  }

  /** Seed the final output's gradient slot, then replay in reverse. */
  backward(outputId: number, outputGrad: Float64Array): void {
    const slot = this.inputGradSlots.get(outputId);
    if (!slot) throw new Error(`Tape.backward: unknown outputId ${outputId}`);
    // E19 fix: overwrite the seed (slot starts at 0). The previous += was
    // wasteful and could double-count if backward() were re-invoked.
    slot.set(outputGrad);
    for (let n = this.nodes.length - 1; n >= 0; n--) {
      this.nodes[n].backward(this.nodes[n].outputGradSlot);
    }
  }

  getInputGrad(id: number): Float64Array | undefined {
    return this.inputGradSlots.get(id);
  }
}

export class TapedTensor {
  constructor(
    readonly shape: ReadonlyArray<number>,
    readonly primal: Float64Array,
    readonly tape: Tape,
    readonly id: number
  ) {}

  /**
   * S5 fix: existing engine ops (e.g. lower, pderiv, contract) reach into
   * `.data`. The getter returns the primal so those ops still work when a
   * TapedTensor flows through them as a structurally-compatible Tensor.
   * (AD-aware ops branch on `'tape' in arg` before reaching here.)
   */
  get data(): Float64Array {
    return this.primal;
  }

  static fromTensorAsInput(t: Tensor, tape: Tape): TapedTensor {
    const { id } = tape.allocate(t.data.length);
    return new TapedTensor(t.shape, new Float64Array(t.data), tape, id);
  }

  toPrimalTensor(): Tensor {
    return new Tensor(this.shape, new Float64Array(this.primal));
  }

  add(other: TapedTensor): TapedTensor {
    this.checkSameShape(other, 'add');
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = this.primal[i] + other.primal[i];
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const otherGradSlot = this.tape.getInputGrad(other.id)!;
    const { id } = this.tape.record([this.id, other.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i];
        otherGradSlot[i] += outputGrad[i];
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  sub(other: TapedTensor): TapedTensor {
    this.checkSameShape(other, 'sub');
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = this.primal[i] - other.primal[i];
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const otherGradSlot = this.tape.getInputGrad(other.id)!;
    const { id } = this.tape.record([this.id, other.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i];
        otherGradSlot[i] -= outputGrad[i];
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  mul(other: TapedTensor): TapedTensor {
    this.checkSameShape(other, 'mul');
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = this.primal[i] * other.primal[i];
    const thisPrimal = this.primal; // capture for closure
    const otherPrimal = other.primal;
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const otherGradSlot = this.tape.getInputGrad(other.id)!;
    // I3 fix: explicit alias check. Without it, t.mul(t) yields the correct
    // gradient only by aliasing accident (both slots are the same Float64Array,
    // so two += b accumulate to +2b). A future refactor that splits the slots
    // would silently halve the gradient. Be explicit.
    const isAliased = this === other;
    const { id } = this.tape.record([this.id, other.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        if (isAliased) {
          // (a · a)' grad: d(a²)/da = 2a; via VJP: thisGrad += 2·outputGrad·a.
          thisGradSlot[i] += 2 * outputGrad[i] * thisPrimal[i];
        } else {
          // d(a·b)/da = b; d(a·b)/db = a.
          thisGradSlot[i] += outputGrad[i] * otherPrimal[i];
          otherGradSlot[i] += outputGrad[i] * thisPrimal[i];
        }
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  scale(k: number): TapedTensor {
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = this.primal[i] * k;
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i] * k;
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  private checkSameShape(other: TapedTensor, op: string): void {
    if (
      this.shape.length !== other.shape.length ||
      !this.shape.every((v, i) => v === other.shape[i])
    ) {
      throw new Error(`TapedTensor.${op}: shape mismatch [${this.shape}] vs [${other.shape}]`);
    }
  }
}
