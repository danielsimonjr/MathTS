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
 * v0.2.0 adds: contract (named-index), matmul (batched rank-N).
 */
import { Tensor, Index, tensorSvd, tensorEig } from '@danielsimonjr/mathts-tensor';

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
  /**
   * Optional per-axis Index labels. When set, enables `contract`.
   * Must have the same length as `shape` when present.
   */
  readonly axisLabels?: ReadonlyArray<Index>;

  constructor(
    readonly shape: ReadonlyArray<number>,
    readonly primal: Float64Array,
    readonly tape: Tape,
    readonly id: number,
    axisLabels?: ReadonlyArray<Index>
  ) {
    if (axisLabels !== undefined) {
      this.axisLabels = [...axisLabels];
    }
  }

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
    return new TapedTensor(t.shape, new Float64Array(t.data), tape, id, t.axisLabels);
  }

  toPrimalTensor(): Tensor {
    return new Tensor(this.shape, new Float64Array(this.primal), this.axisLabels);
  }

  /**
   * Reconstruct the Tensor primal with the given axisLabels (used internally
   * when the primal was computed from an op that produces labelled output).
   */
  private toPrimalTensorWith(axisLabels: ReadonlyArray<Index> | undefined): Tensor {
    return new Tensor(this.shape, new Float64Array(this.primal), axisLabels);
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

  /**
   * Elementwise division: this / other.
   *
   * Adjoints (quotient rule):
   *   dA = dY / b
   *   dB = −dY · a / b²
   *
   * The alias case (a.divide(a)) is handled explicitly: the combined gradient
   * is dA + dB = dY/a − dY·a/a² = dY/a − dY/a = 0. This is correct since
   * a/a = 1 everywhere and d(1)/da = 0.
   */
  divide(other: TapedTensor): TapedTensor {
    this.checkSameShape(other, 'divide');
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = this.primal[i] / other.primal[i];
    const thisPrimal = new Float64Array(this.primal); // capture for closure
    const otherPrimal = new Float64Array(other.primal);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const otherGradSlot = this.tape.getInputGrad(other.id)!;
    const isAliased = this === other;
    const { id } = this.tape.record([this.id, other.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        if (isAliased) {
          // d(a/a)/da = 0; gradient is zero for self-division.
          // Combined: dY/a - dY*a/a² = dY/a - dY/a = 0.
          // thisGradSlot[i] += 0; (no-op, but kept for clarity)
        } else {
          const b = otherPrimal[i];
          const a = thisPrimal[i];
          // dA = dY / b
          thisGradSlot[i] += outputGrad[i] / b;
          // dB = -dY * a / b²
          otherGradSlot[i] += (-outputGrad[i] * a) / (b * b);
        }
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

  /**
   * Reverse-mode AD over `Tensor.contract`.
   *
   * Both operands must carry `axisLabels`; the resulting TapedTensor inherits
   * the contracted-output axisLabels (non-shared axis concatenation).
   *
   * Adjoint derivation (T-notation):
   *   Let Y = A.contract(B)  (contraction over shared indices S).
   *   dA = dY.contract(B')  where B' = B with its free axes re-labelled to
   *        match the shared positions in A. Equivalently: for each element of A,
   *        dA[...a_free, ...s] = Σ_{...b_free} dY[...a_free, ...b_free] · B[...s, ...b_free]
   *   dB = A'.contract(dY)  symmetrically.
   *
   * Implementation: because `Tensor.contract` matches by Index identity, we
   * build the backward contraction by re-labelling the free axes of dY with
   * the Index objects from the other operand — so `Tensor.contract` automatically
   * finds the right shared axes.
   */
  contract(other: TapedTensor): TapedTensor {
    // Both operands must carry axisLabels — delegate validation to Tensor.contract.
    const aPrimal = this.toPrimalTensorWith(this.axisLabels);
    const bPrimal = other.toPrimalTensorWith(other.axisLabels);

    // Forward pass.
    const yPrimal = aPrimal.contract(bPrimal);

    // Capture primal data and labels for the backward closure.
    const aLabels = this.axisLabels!; // validated by Tensor.contract above
    const bLabels = other.axisLabels!;
    const yLabels = yPrimal.axisLabels!;

    // Identify which axes of A and B are "free" (appear in the output).
    // Shared axes = those that are NOT in the output.
    const aFreeAxes: number[] = [];
    const aSharedAxes: number[] = [];
    for (let i = 0; i < aLabels.length; i++) {
      const inOutput = yLabels.some((yl) => yl.matches(aLabels[i]));
      if (inOutput) aFreeAxes.push(i);
      else aSharedAxes.push(i);
    }
    const bFreeAxes: number[] = [];
    const bSharedAxes: number[] = [];
    for (let i = 0; i < bLabels.length; i++) {
      const inOutput = yLabels.some((yl) => yl.matches(bLabels[i]));
      if (inOutput) bFreeAxes.push(i);
      else bSharedAxes.push(i);
    }

    const aGradSlot = this.tape.getInputGrad(this.id)!;
    const bGradSlot = this.tape.getInputGrad(other.id)!;

    // Capture primal Float64Arrays for the closure (shape is needed too).
    const aPrimalData = new Float64Array(this.primal);
    const bPrimalData = new Float64Array(other.primal);
    const aShape = [...this.shape];
    const bShape = [...other.shape];

    const { id } = this.tape.record(
      [this.id, other.id],
      yPrimal.data.length,
      (outputGrad: Float64Array) => {
        // Wrap dY as a Tensor with yLabels.
        const dY = new Tensor([...yPrimal.shape], new Float64Array(outputGrad), yLabels);

        // Compute dA = dY.contract(B_relabelled)
        // We need B with its FREE axes relabelled to match the corresponding dY labels,
        // and its SHARED axes relabelled to match A's shared axes.
        //
        // Strategy: build B_relabelled so that:
        //   - B's free axes get the same labels as they appear in yLabels (they already do —
        //     Tensor.contract places A's free axes first, then B's free axes in the output).
        //   - B's shared axes get labels matching A's corresponding shared axes.
        //
        // The shared axis in B[i] = bSharedAxes[k] corresponds to A's shared axis aSharedAxes[k].
        // We relabel B's shared axes with A's Index objects so dY.contract(B') finds them.

        let bRelabelled = new Tensor(bShape, bPrimalData, bLabels);
        for (let k = 0; k < bSharedAxes.length; k++) {
          const bAxis = bSharedAxes[k];
          const aAxis = aSharedAxes[k];
          // Replace B's shared index with A's corresponding index.
          bRelabelled = bRelabelled.replaceIndex(bLabels[bAxis], aLabels[aAxis]);
        }

        // dA = dY.contract(bRelabelled): contracts over B's free axes (now labelled
        // with dY's B-side labels), leaves A's free axes + A's shared axes.
        const dAFull = dY.contract(bRelabelled);

        // dAFull's axisLabels are in the order: [dY's A-free labels, A's shared labels].
        // We need to scatter them back into A's original axis order.
        const dAData = _scatterToOriginalAxes(dAFull, aLabels);

        for (let i = 0; i < aGradSlot.length; i++) {
          aGradSlot[i] += dAData[i];
        }

        // Compute dB = A_relabelled.contract(dY)
        // A's free axes appear in dY with A's free index labels.
        // A's shared axes need relabelling to match B's shared index labels.

        let aRelabelled = new Tensor(aShape, aPrimalData, aLabels);
        for (let k = 0; k < aSharedAxes.length; k++) {
          const aAxis = aSharedAxes[k];
          const bAxis = bSharedAxes[k];
          // Replace A's shared index with B's corresponding index.
          aRelabelled = aRelabelled.replaceIndex(aLabels[aAxis], bLabels[bAxis]);
        }

        // dB = aRelabelled.contract(dY): contracts over A's free axes (labelled
        // with dY's A-side labels), leaves B's shared axes + B's free axes.
        const dBFull = aRelabelled.contract(dY);

        const dBData = _scatterToOriginalAxes(dBFull, bLabels);

        for (let i = 0; i < bGradSlot.length; i++) {
          bGradSlot[i] += dBData[i];
        }
      }
    );

    return new TapedTensor(
      [...yPrimal.shape],
      new Float64Array(yPrimal.data),
      this.tape,
      id,
      yLabels
    );
  }

  /**
   * Reverse-mode AD over batched matmul.
   *
   * Accepts operands of rank ≥ 2. Convention: trailing 2 axes are the matrix
   * dims (rows × cols); all leading axes are batch dims (must be broadcast-
   * compatible). For rank-2 inputs this is classical matrix multiplication.
   *
   * Adjoint derivation (classical matrix calc, extended to batched):
   *   Y = A @ B  (A: ...×m×k, B: ...×k×n  →  Y: ...×m×n)
   *   dA = dY @ Bᵀ       (dA: ...×m×k)
   *   dB = Aᵀ @ dY       (dB: ...×k×n)
   *
   * Implemented via `Tensor.einsum` with a dynamically-built spec:
   *   forward:  '...ik,...kj->...ij'
   *   dA:       '...ij,...kj->...ik'   (contract dY with B on j)
   *   dB:       '...ki,...kj->...ij'   (contract A on k with dY on k)
   */
  matmul(other: TapedTensor): TapedTensor {
    const rankA = this.shape.length;
    const rankB = other.shape.length;

    if (rankA < 2) {
      throw new Error(`TapedTensor.matmul: 'this' operand must have rank ≥ 2, got rank ${rankA}`);
    }
    if (rankB < 2) {
      throw new Error(`TapedTensor.matmul: 'other' operand must have rank ≥ 2, got rank ${rankB}`);
    }

    // The batch rank is (rank - 2); both operands must agree on batch dims.
    const batchRankA = rankA - 2;
    const batchRankB = rankB - 2;
    if (batchRankA !== batchRankB) {
      throw new Error(
        `TapedTensor.matmul: batch rank mismatch (${batchRankA} vs ${batchRankB}); ` +
          `both operands must have the same rank`
      );
    }
    for (let b = 0; b < batchRankA; b++) {
      if (this.shape[b] !== other.shape[b]) {
        throw new Error(
          `TapedTensor.matmul: batch dimension ${b} mismatch ` +
            `(${this.shape[b]} vs ${other.shape[b]})`
        );
      }
    }

    const m = this.shape[rankA - 2];
    const k = this.shape[rankA - 1];
    const k2 = other.shape[rankB - 2];
    const n = other.shape[rankB - 1];
    if (k !== k2) {
      throw new Error(`TapedTensor.matmul: inner dimension mismatch (${k} vs ${k2})`);
    }

    // Forward pass: Y[...ij] = Σ_k A[...ik] * B[...kj].
    const aShape = [...this.shape];
    const bShape = [...other.shape];
    const batchShape = aShape.slice(0, batchRankA);
    const yShape = [...batchShape, m, n];

    const aPrimalData = new Float64Array(this.primal);
    const bPrimalData = new Float64Array(other.primal);
    const yData = _batchedMatmul(aPrimalData, bPrimalData, aShape, bShape);

    const aGradSlot = this.tape.getInputGrad(this.id)!;
    const bGradSlot = this.tape.getInputGrad(other.id)!;

    const { id } = this.tape.record(
      [this.id, other.id],
      yData.length,
      (outputGrad: Float64Array) => {
        // dA = dY @ Bᵀ  =>  dA[...ik] = Σ_j dY[...ij] * B[...kj]
        const dA = _batchedMatmulGradA(outputGrad, bPrimalData, yShape, bShape);
        for (let i = 0; i < aGradSlot.length; i++) {
          aGradSlot[i] += dA[i];
        }

        // dB = Aᵀ @ dY  =>  dB[...kj] = Σ_i A[...ki] * dY[...ij]
        const dB = _batchedMatmulGradB(aPrimalData, outputGrad, aShape, yShape);
        for (let i = 0; i < bGradSlot.length; i++) {
          bGradSlot[i] += dB[i];
        }
      }
    );

    return new TapedTensor(yShape, new Float64Array(yData), this.tape, id);
  }

  private checkSameShape(other: TapedTensor, op: string): void {
    if (
      this.shape.length !== other.shape.length ||
      !this.shape.every((v, i) => v === other.shape[i])
    ) {
      throw new Error(`TapedTensor.${op}: shape mismatch [${this.shape}] vs [${other.shape}]`);
    }
  }

  // ---------------------------------------------------------------------------
  // Reductions
  // ---------------------------------------------------------------------------

  /**
   * Sum elements along the given axis/axes (or all axes if omitted).
   *
   * Adjoint: dX[...] = dY[reduced(idx)] broadcast back to input shape.
   * Each input element receives the output-gradient entry from its reduced
   * counterpart (the non-reduced coordinates select the dY element; the
   * reduced coordinates are collapsed to 0 in the keepDims=false case).
   */
  sum(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor {
    const primalT = this.toPrimalTensor();
    const outT = primalT.sum(axis, opts);

    const inputShape = [...this.shape];
    const inputSize = this.primal.length;
    const keepDims = opts?.keepDims ?? false;
    const axes = _resolveAxes(axis, this.shape.length);
    const axisSet = new Set(axes);

    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], outT.data.length, (outputGrad) => {
      // Build strides for the output shape (which may be keepDims or reduced).
      const outShape = [...outT.shape];
      const outStrides = Tensor.rowMajorStrides(outShape);
      const inStrides = Tensor.rowMajorStrides(inputShape);

      // For each input element, compute the corresponding output flat index.
      const inCoords = new Array<number>(inputShape.length).fill(0);
      for (let n = 0; n < inputSize; n++) {
        // Compute output coords from input coords.
        let outFlat = 0;
        let outDim = 0;
        for (let k = 0; k < inputShape.length; k++) {
          if (axisSet.has(k)) {
            if (keepDims) {
              // The output dim is 1 (size-1 kept), coordinate is always 0.
              outDim++;
            }
            // else: skip this axis in the output
          } else {
            outFlat += inCoords[k] * outStrides[outDim];
            outDim++;
          }
        }
        thisGradSlot[n] += outputGrad[outFlat];

        // Advance inCoords.
        for (let k = inputShape.length - 1; k >= 0; k--) {
          if (++inCoords[k] < inputShape[k]) break;
          inCoords[k] = 0;
        }
      }
      void inStrides; // used implicitly via n loop
    });

    return new TapedTensor([...outT.shape], new Float64Array(outT.data), this.tape, id);
  }

  /**
   * Arithmetic mean along the given axis/axes (or all axes if omitted).
   *
   * Adjoint: dX[...] = dY[reduced(idx)] / N, broadcast back to input shape.
   * N = product of reduced-axis dimensions.
   */
  mean(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor {
    const primalT = this.toPrimalTensor();
    const outT = primalT.mean(axis, opts);

    const inputShape = [...this.shape];
    const inputSize = this.primal.length;
    const keepDims = opts?.keepDims ?? false;
    const axes = _resolveAxes(axis, this.shape.length);
    const axisSet = new Set(axes);

    // N = product of reduced-axis dimensions.
    const N = axes.reduce((prod: number, ax: number) => prod * this.shape[ax], 1);

    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], outT.data.length, (outputGrad) => {
      const outShape = [...outT.shape];
      const outStrides = Tensor.rowMajorStrides(outShape);

      const inCoords = new Array<number>(inputShape.length).fill(0);
      for (let n = 0; n < inputSize; n++) {
        let outFlat = 0;
        let outDim = 0;
        for (let k = 0; k < inputShape.length; k++) {
          if (axisSet.has(k)) {
            if (keepDims) outDim++;
          } else {
            outFlat += inCoords[k] * outStrides[outDim];
            outDim++;
          }
        }
        thisGradSlot[n] += outputGrad[outFlat] / N;

        for (let k = inputShape.length - 1; k >= 0; k--) {
          if (++inCoords[k] < inputShape[k]) break;
          inCoords[k] = 0;
        }
      }
    });

    return new TapedTensor([...outT.shape], new Float64Array(outT.data), this.tape, id);
  }

  /**
   * Product of elements along the given axis/axes (or all axes if omitted).
   *
   * Adjoint: dX_i = dY * (prod_over_axes(x) / x_i) per element.
   *
   * Zero-element corners:
   * - Exactly one x_i = 0 in the reduced group: d/dx_i = product of all others
   *   (which is the full product / x_i evaluated via alternate product),
   *   and d/dx_j = 0 for all j ≠ i where x_j ≠ 0.
   * - Two or more zeros in the reduced group: gradient is 0 everywhere for that
   *   group (because changing any single zero cannot change a product that is
   *   zero due to another zero).
   *
   * Implementation: uses prefix/suffix products to handle zeros robustly.
   */
  prod(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor {
    const primalT = this.toPrimalTensor();
    const outT = primalT.prod(axis, opts);

    const inputShape = [...this.shape];
    const keepDims = opts?.keepDims ?? false;
    const axes = _resolveAxes(axis, this.shape.length);
    const axisSet = new Set(axes);

    // Capture primal data for the closure.
    const primalData = new Float64Array(this.primal);

    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], outT.data.length, (outputGrad) => {
      const outShape = [...outT.shape];
      const outStrides = Tensor.rowMajorStrides(outShape);
      const inStrides = Tensor.rowMajorStrides(inputShape);

      // For each output element, we need the prefix/suffix products of the
      // elements that were reduced into it (to handle zeros robustly).
      // We iterate over all input elements, group them by their output index,
      // and compute the gradient using prefix products within each group.

      // Step 1: Group input indices by their output flat index.
      const groups = new Map<number, number[]>(); // outFlat → list of input flat indices
      const inCoords = new Array<number>(inputShape.length).fill(0);
      for (let n = 0; n < primalData.length; n++) {
        let outFlat = 0;
        let outDim = 0;
        for (let k = 0; k < inputShape.length; k++) {
          if (axisSet.has(k)) {
            if (keepDims) outDim++;
          } else {
            outFlat += inCoords[k] * outStrides[outDim];
            outDim++;
          }
        }
        const group = groups.get(outFlat);
        if (group === undefined) {
          groups.set(outFlat, [n]);
        } else {
          group.push(n);
        }
        for (let k = inputShape.length - 1; k >= 0; k--) {
          if (++inCoords[k] < inputShape[k]) break;
          inCoords[k] = 0;
        }
      }
      void inStrides;

      // Step 2: For each group, compute prefix/suffix products and accumulate gradients.
      for (const [outFlat, group] of groups) {
        const dY = outputGrad[outFlat];
        const m = group.length;

        // Build prefix products: prefix[i] = product of group[0..i-1].
        const prefix = new Float64Array(m);
        prefix[0] = 1;
        for (let i = 1; i < m; i++) {
          prefix[i] = prefix[i - 1] * primalData[group[i - 1]];
        }

        // Build suffix products: suffix[i] = product of group[i+1..m-1].
        const suffix = new Float64Array(m);
        suffix[m - 1] = 1;
        for (let i = m - 2; i >= 0; i--) {
          suffix[i] = suffix[i + 1] * primalData[group[i + 1]];
        }

        // Gradient for group[i] = dY * prefix[i] * suffix[i].
        for (let i = 0; i < m; i++) {
          thisGradSlot[group[i]] += dY * prefix[i] * suffix[i];
        }
      }
    });

    return new TapedTensor([...outT.shape], new Float64Array(outT.data), this.tape, id);
  }

  /**
   * Maximum value along the given axis/axes (or all axes if omitted).
   *
   * Adjoint: dY is scattered to the argmax position(s).
   * Tie-breaking: "first-wins" — the gradient flows to the first (smallest
   * flat-index) element among those that attain the maximum.
   */
  max(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor {
    const primalT = this.toPrimalTensor();
    const outT = primalT.max(axis, opts);

    const inputShape = [...this.shape];
    const keepDims = opts?.keepDims ?? false;
    const axes = _resolveAxes(axis, this.shape.length);
    const axisSet = new Set(axes);

    const primalData = new Float64Array(this.primal);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;

    const { id } = this.tape.record([this.id], outT.data.length, (outputGrad) => {
      const outShape = [...outT.shape];
      const outStrides = Tensor.rowMajorStrides(outShape);

      // First-wins: track which input flat index achieves the max for each output.
      const argmaxSlot = new Int32Array(outT.data.length).fill(-1);

      const inCoords = new Array<number>(inputShape.length).fill(0);
      for (let n = 0; n < primalData.length; n++) {
        let outFlat = 0;
        let outDim = 0;
        for (let k = 0; k < inputShape.length; k++) {
          if (axisSet.has(k)) {
            if (keepDims) outDim++;
          } else {
            outFlat += inCoords[k] * outStrides[outDim];
            outDim++;
          }
        }
        // First-wins: only update argmax if this element strictly exceeds the current max.
        // The forward primalT.max() stores the max value in outT.data[outFlat].
        if (argmaxSlot[outFlat] === -1 || primalData[n] > primalData[argmaxSlot[outFlat]]) {
          argmaxSlot[outFlat] = n;
        }
        for (let k = inputShape.length - 1; k >= 0; k--) {
          if (++inCoords[k] < inputShape[k]) break;
          inCoords[k] = 0;
        }
      }

      // Scatter dY to the argmax positions.
      for (let outFlat = 0; outFlat < outT.data.length; outFlat++) {
        const winner = argmaxSlot[outFlat];
        if (winner !== -1) {
          thisGradSlot[winner] += outputGrad[outFlat];
        }
      }
    });

    return new TapedTensor([...outT.shape], new Float64Array(outT.data), this.tape, id);
  }

  /**
   * Minimum value along the given axis/axes (or all axes if omitted).
   *
   * Adjoint: dY is scattered to the argmin position(s).
   * Tie-breaking: "first-wins" — gradient flows to the first (smallest
   * flat-index) element that attains the minimum.
   */
  min(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor {
    const primalT = this.toPrimalTensor();
    const outT = primalT.min(axis, opts);

    const inputShape = [...this.shape];
    const keepDims = opts?.keepDims ?? false;
    const axes = _resolveAxes(axis, this.shape.length);
    const axisSet = new Set(axes);

    const primalData = new Float64Array(this.primal);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;

    const { id } = this.tape.record([this.id], outT.data.length, (outputGrad) => {
      const outShape = [...outT.shape];
      const outStrides = Tensor.rowMajorStrides(outShape);

      // First-wins: track which input flat index achieves the min for each output.
      const argminSlot = new Int32Array(outT.data.length).fill(-1);

      const inCoords = new Array<number>(inputShape.length).fill(0);
      for (let n = 0; n < primalData.length; n++) {
        let outFlat = 0;
        let outDim = 0;
        for (let k = 0; k < inputShape.length; k++) {
          if (axisSet.has(k)) {
            if (keepDims) outDim++;
          } else {
            outFlat += inCoords[k] * outStrides[outDim];
            outDim++;
          }
        }
        if (argminSlot[outFlat] === -1 || primalData[n] < primalData[argminSlot[outFlat]]) {
          argminSlot[outFlat] = n;
        }
        for (let k = inputShape.length - 1; k >= 0; k--) {
          if (++inCoords[k] < inputShape[k]) break;
          inCoords[k] = 0;
        }
      }

      for (let outFlat = 0; outFlat < outT.data.length; outFlat++) {
        const winner = argminSlot[outFlat];
        if (winner !== -1) {
          thisGradSlot[winner] += outputGrad[outFlat];
        }
      }
    });

    return new TapedTensor([...outT.shape], new Float64Array(outT.data), this.tape, id);
  }

  /**
   * p-norm of the tensor.
   *
   * Supported p values: 1, 2, 'fro', 'inf'. Default p = 2.
   * When `opts.axis` is given, reduces along that axis; otherwise reduces all axes.
   *
   * Adjoints:
   * - p=2 / p='fro': dX = dY · x / ‖x‖₂  (Frobenius is the 2-norm of the flattened tensor)
   * - p=1:           dX = dY · sign(x)  (subgradient = 0 at exact zero)
   * - p='inf':       dX scattered to the element(s) of max absolute value;
   *                  tie-breaking: first-wins. Sign of the scattered gradient
   *                  matches sign(x_max).
   */
  norm(opts?: { p?: 1 | 2 | 'fro' | 'inf'; axis?: number; keepDims?: boolean }): TapedTensor {
    const p = opts?.p ?? 2;
    const keepDims = opts?.keepDims ?? false;
    const primalT = this.toPrimalTensor();
    const outT = primalT.norm({ p, axis: opts?.axis, keepDims });

    const inputShape = [...this.shape];
    const primalData = new Float64Array(this.primal);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;

    // Determine which axes are being reduced.
    const axes =
      opts?.axis !== undefined ? [opts.axis] : _resolveAxes(undefined, this.shape.length);
    const axisSet = new Set(axes);

    if (p === 2 || p === 'fro') {
      // Capture the norm values (primal output) for the adjoint.
      const normData = new Float64Array(outT.data);
      const { id } = this.tape.record([this.id], outT.data.length, (outputGrad) => {
        // dX_i = dY * x_i / ‖x‖
        const outShape = [...outT.shape];
        const outStrides = Tensor.rowMajorStrides(outShape);

        const inCoords = new Array<number>(inputShape.length).fill(0);
        for (let n = 0; n < primalData.length; n++) {
          let outFlat = 0;
          let outDim = 0;
          for (let k = 0; k < inputShape.length; k++) {
            if (axisSet.has(k)) {
              if (keepDims) outDim++;
            } else {
              outFlat += inCoords[k] * outStrides[outDim];
              outDim++;
            }
          }
          const normVal = normData[outFlat];
          // Avoid division by zero when norm = 0 (subgradient = 0).
          if (normVal !== 0) {
            thisGradSlot[n] += (outputGrad[outFlat] * primalData[n]) / normVal;
          }
          for (let k = inputShape.length - 1; k >= 0; k--) {
            if (++inCoords[k] < inputShape[k]) break;
            inCoords[k] = 0;
          }
        }
      });
      return new TapedTensor([...outT.shape], new Float64Array(outT.data), this.tape, id);
    }

    if (p === 1) {
      const { id } = this.tape.record([this.id], outT.data.length, (outputGrad) => {
        // dX_i = dY * sign(x_i)  (subgradient = 0 at exact zero)
        const outShape = [...outT.shape];
        const outStrides = Tensor.rowMajorStrides(outShape);

        const inCoords = new Array<number>(inputShape.length).fill(0);
        for (let n = 0; n < primalData.length; n++) {
          let outFlat = 0;
          let outDim = 0;
          for (let k = 0; k < inputShape.length; k++) {
            if (axisSet.has(k)) {
              if (keepDims) outDim++;
            } else {
              outFlat += inCoords[k] * outStrides[outDim];
              outDim++;
            }
          }
          const xi = primalData[n];
          const sign = xi > 0 ? 1 : xi < 0 ? -1 : 0;
          thisGradSlot[n] += outputGrad[outFlat] * sign;
          for (let k = inputShape.length - 1; k >= 0; k--) {
            if (++inCoords[k] < inputShape[k]) break;
            inCoords[k] = 0;
          }
        }
      });
      return new TapedTensor([...outT.shape], new Float64Array(outT.data), this.tape, id);
    }

    // p === 'inf': dX scattered to max-abs position(s), first-wins.
    {
      const { id } = this.tape.record([this.id], outT.data.length, (outputGrad) => {
        const outShape = [...outT.shape];
        const outStrides = Tensor.rowMajorStrides(outShape);

        // Track which input index attains the max absolute value for each output slot.
        const argmaxAbsSlot = new Int32Array(outT.data.length).fill(-1);

        const inCoords = new Array<number>(inputShape.length).fill(0);
        for (let n = 0; n < primalData.length; n++) {
          let outFlat = 0;
          let outDim = 0;
          for (let k = 0; k < inputShape.length; k++) {
            if (axisSet.has(k)) {
              if (keepDims) outDim++;
            } else {
              outFlat += inCoords[k] * outStrides[outDim];
              outDim++;
            }
          }
          const prevWinner = argmaxAbsSlot[outFlat];
          if (prevWinner === -1 || Math.abs(primalData[n]) > Math.abs(primalData[prevWinner])) {
            argmaxAbsSlot[outFlat] = n;
          }
          for (let k = inputShape.length - 1; k >= 0; k--) {
            if (++inCoords[k] < inputShape[k]) break;
            inCoords[k] = 0;
          }
        }

        // Scatter: dX_winner = dY * sign(x_winner)
        for (let outFlat = 0; outFlat < outT.data.length; outFlat++) {
          const winner = argmaxAbsSlot[outFlat];
          if (winner !== -1) {
            const xi = primalData[winner];
            const sign = xi > 0 ? 1 : xi < 0 ? -1 : 0;
            thisGradSlot[winner] += outputGrad[outFlat] * sign;
          }
        }
      });
      return new TapedTensor([...outT.shape], new Float64Array(outT.data), this.tape, id);
    }
  }

  // ---------------------------------------------------------------------------
  // Elementwise transcendentals
  // ---------------------------------------------------------------------------

  /**
   * Elementwise natural logarithm.
   *
   * Adjoint: dX = dY / x
   */
  log(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = Math.log(this.primal[i]);

    const primalData = new Float64Array(this.primal); // capture for closure
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i] / primalData[i];
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise exponential.
   *
   * Adjoint: dX = dY · y  where y = exp(x). Primal output is cached.
   */
  exp(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = Math.exp(this.primal[i]);

    const expData = new Float64Array(out); // cache primal output
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i] * expData[i];
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise sine.
   *
   * Adjoint: dX = dY · cos(x)
   */
  sin(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    const cosData = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.sin(this.primal[i]);
      cosData[i] = Math.cos(this.primal[i]);
    }

    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i] * cosData[i];
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise cosine.
   *
   * Adjoint: dX = −dY · sin(x)
   */
  cos(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    const sinData = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.cos(this.primal[i]);
      sinData[i] = Math.sin(this.primal[i]);
    }

    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += -outputGrad[i] * sinData[i];
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise tangent.
   *
   * Adjoint: dX = dY / cos²(x)  (= dY · sec²(x))
   */
  tan(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    const cosData = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.tan(this.primal[i]);
      cosData[i] = Math.cos(this.primal[i]);
    }

    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        const c = cosData[i];
        thisGradSlot[i] += outputGrad[i] / (c * c);
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise square root.
   *
   * Adjoint: dX = dY / (2·y)  where y = sqrt(x). Primal output is cached.
   */
  sqrt(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(this.primal[i]);

    const sqrtData = new Float64Array(out); // cache primal output
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i] / (2 * sqrtData[i]);
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise square (x²).
   *
   * Adjoint: dX = dY · 2x
   */
  square(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = this.primal[i] * this.primal[i];

    const primalData = new Float64Array(this.primal);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i] * 2 * primalData[i];
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise power: x^k.
   *
   * `k` may be a fixed `number` (constant exponent) or a `TapedTensor`
   * (variable exponent, both inputs on the tape).
   *
   * Adjoints, for y = a^b:
   *   - fixed exponent k:   dA = dY · k · a^(k−1)
   *   - variable exponent:  dA = dY · b · a^(b−1),   dB = dY · a^b · ln(a)
   *   - aliased a^a:         dA = dY · a^a · (ln a + 1)
   *
   * The dB term needs ln(a); for a ≤ 0 it is mathematically undefined and
   * yields NaN/−Inf, honestly signalling non-differentiability w.r.t. the
   * exponent rather than masking it.
   */
  pow(k: number | TapedTensor): TapedTensor {
    if (typeof k === 'number') {
      const out = new Float64Array(this.primal.length);
      for (let i = 0; i < out.length; i++) out[i] = Math.pow(this.primal[i], k);

      const primalData = new Float64Array(this.primal);
      const thisGradSlot = this.tape.getInputGrad(this.id)!;
      const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
        for (let i = 0; i < outputGrad.length; i++) {
          thisGradSlot[i] += outputGrad[i] * k * Math.pow(primalData[i], k - 1);
        }
      });
      return new TapedTensor(this.shape, out, this.tape, id);
    }

    // Variable exponent: y = a^b, both on the tape.
    const other = k;
    this.checkSameShape(other, 'pow');
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = Math.pow(this.primal[i], other.primal[i]);

    const aPrimal = new Float64Array(this.primal);
    const bPrimal = new Float64Array(other.primal);
    const yPrimal = new Float64Array(out);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const otherGradSlot = this.tape.getInputGrad(other.id)!;
    const isAliased = this === other;
    const { id } = this.tape.record([this.id, other.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        const a = aPrimal[i];
        const b = bPrimal[i];
        const y = yPrimal[i];
        const g = outputGrad[i];
        if (isAliased) {
          // d(a^a)/da = a^a · (ln a + 1)
          thisGradSlot[i] += g * y * (Math.log(a) + 1);
        } else {
          thisGradSlot[i] += g * b * Math.pow(a, b - 1); // dA
          otherGradSlot[i] += g * y * Math.log(a); // dB
        }
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise reciprocal: 1 / x.
   *
   * Adjoint: dX = −dY / x²
   */
  reciprocal(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = 1 / this.primal[i];

    const primalData = new Float64Array(this.primal);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        const xi = primalData[i];
        thisGradSlot[i] += -outputGrad[i] / (xi * xi);
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /**
   * Elementwise absolute value: |x|.
   *
   * Adjoint: dX = dY · sign(x)
   * Subgradient at exact zero is defined as 0 (rather than undefined).
   */
  abs(): TapedTensor {
    const out = new Float64Array(this.primal.length);
    for (let i = 0; i < out.length; i++) out[i] = Math.abs(this.primal[i]);

    const primalData = new Float64Array(this.primal);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        const xi = primalData[i];
        const sign = xi > 0 ? 1 : xi < 0 ? -1 : 0; // subgradient = 0 at exact zero
        thisGradSlot[i] += outputGrad[i] * sign;
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  // ---------------------------------------------------------------------------
  // Extended elementwise transcendentals (hyperbolic, inverse-trig, log/exp
  // variants, sign, cbrt, atan2). Each builds a reverse-mode node via the
  // `_unaryElementwise` helper; `localGrad(x, y)` is dy/dx given input x and
  // output y. The helper caches both x and y so adjoints that need either
  // (e.g. tanh needs y, log needs x) are uniform.
  // ---------------------------------------------------------------------------

  /**
   * Build a reverse-mode node for an elementwise unary op.
   * @param primalFn forward value y = f(x)
   * @param localGrad local derivative dy/dx, given x and the computed y
   */
  private _unaryElementwise(
    primalFn: (x: number) => number,
    localGrad: (x: number, y: number) => number
  ): TapedTensor {
    const xData = new Float64Array(this.primal);
    const out = new Float64Array(xData.length);
    for (let i = 0; i < out.length; i++) out[i] = primalFn(xData[i]);
    const yData = new Float64Array(out);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const { id } = this.tape.record([this.id], out.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        thisGradSlot[i] += outputGrad[i] * localGrad(xData[i], yData[i]);
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  /** Hyperbolic sine. Adjoint: dX = dY · cosh(x). */
  sinh(): TapedTensor {
    return this._unaryElementwise(Math.sinh, (x) => Math.cosh(x));
  }

  /** Hyperbolic cosine. Adjoint: dX = dY · sinh(x). */
  cosh(): TapedTensor {
    return this._unaryElementwise(Math.cosh, (x) => Math.sinh(x));
  }

  /** Hyperbolic tangent. Adjoint: dX = dY · (1 − tanh²(x)) = dY · (1 − y²). */
  tanh(): TapedTensor {
    return this._unaryElementwise(Math.tanh, (_x, y) => 1 - y * y);
  }

  /** Arcsine. Adjoint: dX = dY / √(1 − x²). */
  asin(): TapedTensor {
    return this._unaryElementwise(Math.asin, (x) => 1 / Math.sqrt(1 - x * x));
  }

  /** Arccosine. Adjoint: dX = −dY / √(1 − x²). */
  acos(): TapedTensor {
    return this._unaryElementwise(Math.acos, (x) => -1 / Math.sqrt(1 - x * x));
  }

  /** Arctangent. Adjoint: dX = dY / (1 + x²). */
  atan(): TapedTensor {
    return this._unaryElementwise(Math.atan, (x) => 1 / (1 + x * x));
  }

  /** Inverse hyperbolic sine. Adjoint: dX = dY / √(x² + 1). */
  asinh(): TapedTensor {
    return this._unaryElementwise(Math.asinh, (x) => 1 / Math.sqrt(x * x + 1));
  }

  /** Inverse hyperbolic cosine (x ≥ 1). Adjoint: dX = dY / √(x² − 1). */
  acosh(): TapedTensor {
    return this._unaryElementwise(Math.acosh, (x) => 1 / Math.sqrt(x * x - 1));
  }

  /** Inverse hyperbolic tangent (|x| < 1). Adjoint: dX = dY / (1 − x²). */
  atanh(): TapedTensor {
    return this._unaryElementwise(Math.atanh, (x) => 1 / (1 - x * x));
  }

  /** Base-2 logarithm. Adjoint: dX = dY / (x · ln2). */
  log2(): TapedTensor {
    return this._unaryElementwise(Math.log2, (x) => 1 / (x * Math.LN2));
  }

  /** Base-10 logarithm. Adjoint: dX = dY / (x · ln10). */
  log10(): TapedTensor {
    return this._unaryElementwise(Math.log10, (x) => 1 / (x * Math.LN10));
  }

  /** log(1 + x) (accurate near 0). Adjoint: dX = dY / (1 + x). */
  log1p(): TapedTensor {
    return this._unaryElementwise(Math.log1p, (x) => 1 / (1 + x));
  }

  /** exp(x) − 1 (accurate near 0). Adjoint: dX = dY · eˣ = dY · (y + 1). */
  expm1(): TapedTensor {
    return this._unaryElementwise(Math.expm1, (_x, y) => y + 1);
  }

  /** Cube root. Adjoint: dX = dY / (3 · y²) where y = x^(1/3) (→∞ at x = 0). */
  cbrt(): TapedTensor {
    return this._unaryElementwise(Math.cbrt, (_x, y) => 1 / (3 * y * y));
  }

  /** Sign of x (−1/0/+1). Adjoint: 0 almost everywhere. */
  sign(): TapedTensor {
    return this._unaryElementwise(Math.sign, () => 0);
  }

  /**
   * Two-argument arctangent: atan2(this, other), with this = y, other = x.
   *
   * Adjoints (a = this, b = other, d = a² + b²):
   *   dA = dY · b / d
   *   dB = −dY · a / d
   *
   * The aliased case atan2(a, a) is locally constant (±π/4 or ±3π/4), so its
   * gradient is 0 — produced naturally by contributing nothing when aliased
   * (dA + dB = dY · (b − a)/d = 0 at a = b).
   */
  atan2(other: TapedTensor): TapedTensor {
    this.checkSameShape(other, 'atan2');
    const a = new Float64Array(this.primal);
    const b = new Float64Array(other.primal);
    const out = new Float64Array(a.length);
    for (let i = 0; i < out.length; i++) out[i] = Math.atan2(a[i], b[i]);
    const thisGradSlot = this.tape.getInputGrad(this.id)!;
    const otherGradSlot = this.tape.getInputGrad(other.id)!;
    const isAliased = this === other;
    const { id } = this.tape.record([this.id, other.id], out.length, (outputGrad) => {
      if (isAliased) return; // gradient is 0 for atan2(a, a)
      for (let i = 0; i < outputGrad.length; i++) {
        const d = a[i] * a[i] + b[i] * b[i];
        thisGradSlot[i] += (outputGrad[i] * b[i]) / d;
        otherGradSlot[i] += (-outputGrad[i] * a[i]) / d;
      }
    });
    return new TapedTensor(this.shape, out, this.tape, id);
  }

  // ---------------------------------------------------------------------------
  // tensordot — generalised dot product over explicit axis pairs.
  // ---------------------------------------------------------------------------

  /**
   * Reverse-mode AD over `Tensor.tensordot`.
   *
   * `axes[i] = [a, b]` contracts axis `a` of `this` with axis `b` of `other`.
   * The result shape is `this`'s non-contracted axes (in original order)
   * followed by `other`'s non-contracted axes (in original order).
   *
   * Adjoint derivation (NumPy/PyTorch tensordot backward, see Townsend 2016 §6,
   * and the canonical PyTorch implementation `TensorDotBackward0` in
   * `torch/csrc/autograd/generated/Functions.cpp`):
   *
   *   Z = tensordot(A, B, axes)
   *   dA = tensordot(dZ, B, [axes_of_dZ_corresponding_to_B's_free, B's_free])
   *        then permute back into A's original axis order.
   *   dB = tensordot(A, dZ, [A's_free, axes_of_dZ_corresponding_to_A's_free])
   *        then permute back into B's original axis order.
   *
   * The axis-permutation bookkeeping is the trickiest part: Tensor.tensordot
   * produces output axes in the order [A's free axes (original A order),
   * B's free axes (original B order)] — and after the backward contractions
   * the survivors come out in B's original (resp. A's original) axis order
   * for the contracted side, which then needs to be permuted into pair order
   * (so axis k of the contracted block matches the kth pair) and finally
   * scattered back into A's (resp. B's) full original axis order.
   *
   * For the rank-2 × rank-2 single-axis case (i.e. ordinary matmul A·B with
   * axes = [[1, 0]]), this reduces to dA = dZ · Bᵀ, dB = Aᵀ · dZ — the same
   * adjoint as `TapedTensor.matmul`.
   */
  tensordot(other: TapedTensor, axes: ReadonlyArray<readonly [number, number]>): TapedTensor {
    const aShape = [...this.shape];
    const bShape = [...other.shape];
    const aRank = aShape.length;
    const bRank = bShape.length;

    // Validate axes lengths & dims (Tensor.tensordot will also validate).
    const aContractedInPairOrder: number[] = [];
    const bContractedInPairOrder: number[] = [];
    for (const [a, b] of axes) {
      aContractedInPairOrder.push(a);
      bContractedInPairOrder.push(b);
    }
    const aContractedSet = new Set(aContractedInPairOrder);
    const bContractedSet = new Set(bContractedInPairOrder);

    // Free axes (in original-axis order).
    const aFree: number[] = [];
    for (let i = 0; i < aRank; i++) if (!aContractedSet.has(i)) aFree.push(i);
    const bFree: number[] = [];
    for (let i = 0; i < bRank; i++) if (!bContractedSet.has(i)) bFree.push(i);

    // Forward pass.
    const aPrimalT = new Tensor(aShape, new Float64Array(this.primal));
    const bPrimalT = new Tensor(bShape, new Float64Array(other.primal));
    const zPrimal = aPrimalT.tensordot(bPrimalT, axes);
    const zShape = [...zPrimal.shape];
    // zShape = [aFree dims (in aFree order), bFree dims (in bFree order)]
    const naFree = aFree.length;
    const nbFree = bFree.length;

    // Capture primals for the backward closure.
    const aPrimalData = new Float64Array(this.primal);
    const bPrimalData = new Float64Array(other.primal);

    const aGradSlot = this.tape.getInputGrad(this.id)!;
    const bGradSlot = this.tape.getInputGrad(other.id)!;

    const { id } = this.tape.record(
      [this.id, other.id],
      zPrimal.data.length,
      (outputGrad: Float64Array) => {
        const dZ = new Tensor(zShape, new Float64Array(outputGrad));
        const aPrimalTbk = new Tensor(aShape, aPrimalData);
        const bPrimalTbk = new Tensor(bShape, bPrimalData);

        // -- dA = tensordot(dZ, B, ...) then permute --
        // We contract dZ's B-free portion (axes naFree..naFree+nbFree-1) with B's bFree axes.
        // Result has axes:
        //   first:  dZ's surviving axes = dZ's aFree portion = aFree dims (in aFree order)
        //   then:   B's surviving axes  = B's bContracted axes (in B's original axis order)
        const dAaxes: Array<readonly [number, number]> = [];
        for (let i = 0; i < nbFree; i++) {
          dAaxes.push([naFree + i, bFree[i]] as const);
        }
        const dAPartial = dZ.tensordot(bPrimalTbk, dAaxes);
        // dAPartial shape: [...aFree dims (in aFree order), ...B's bContracted dims (in B's original order)]
        // We need to convert B's bContracted axes from "B's original order" to "pair order"
        // (so kth axis of the contracted block is axes[k][1]) so that we can scatter
        // them into A's positions axes[k][0].

        // bContractedSortedByOriginal = bContractedInPairOrder sorted ascending
        // (the order they appear in dAPartial's tail). For each axis in dAPartial's tail,
        // we know which pair index k it corresponds to via the original-B axis number.
        const bContractedSortedByOriginal = [...bContractedInPairOrder].sort((x, y) => x - y);
        // For each position p in the tail (0 ≤ p < nPairs), the original B axis is
        // bContractedSortedByOriginal[p]. The pair index k for which axes[k][1] === that
        // B axis tells us this position should land at A axis axes[k][0].
        const nPairs = aContractedInPairOrder.length;

        // Build perm to put dAPartial's axes in the order
        //   [aFree[0], aFree[1], ..., aFree[naFree-1],
        //    axes[0][0], axes[1][0], ..., axes[nPairs-1][0]]
        // — i.e. A's free axes in aFree-order (already there), then A's contracted axes
        // in pair order. So we just need to permute the *tail* of dAPartial into pair order.
        //
        // After tail permutation, dAPartial_permuted has axes corresponding to
        // [aFree[0], ..., aFree[naFree-1], aContracted_in_pair_order[0], ...].
        // We then scatter into A's original axis order: place each at A axis number.

        // First, reorder the tail. tail position p in dAPartial corresponds to original
        // B axis bContractedSortedByOriginal[p]. We want pair-order: position k holds
        // original B axis bContractedInPairOrder[k]. So tailPerm[k] = index of
        // bContractedInPairOrder[k] inside bContractedSortedByOriginal.
        const tailPerm: number[] = [];
        for (let k = 0; k < nPairs; k++) {
          const bOrigAxis = bContractedInPairOrder[k];
          const idx = bContractedSortedByOriginal.indexOf(bOrigAxis);
          tailPerm.push(idx);
        }
        // Full permutation for dAPartial → dAReordered:
        //   [0, 1, ..., naFree-1, naFree + tailPerm[0], naFree + tailPerm[1], ...]
        const dAFirstPerm: number[] = [];
        for (let i = 0; i < naFree; i++) dAFirstPerm.push(i);
        for (let k = 0; k < nPairs; k++) dAFirstPerm.push(naFree + tailPerm[k]);

        // Check if first perm is identity to skip the work.
        const isFirstPermIdentity = dAFirstPerm.every((v, idx) => v === idx);
        const dAReordered = isFirstPermIdentity ? dAPartial : dAPartial.transpose(dAFirstPerm);

        // Now dAReordered axis k (k < naFree) corresponds to A's axis aFree[k];
        // dAReordered axis (naFree + k) corresponds to A's axis aContractedInPairOrder[k].
        // Build the scatter permutation so the output is in A's original axis order:
        //   targetAxisA = output axis index
        //   For each A axis a (0..aRank-1):
        //     if a ∈ aFree: source position = aFree.indexOf(a)
        //     if a ∈ aContracted: source position = naFree + aContractedInPairOrder.indexOf(a)
        const scatterA: number[] = new Array(aRank);
        for (let a = 0; a < aRank; a++) {
          const freeIdx = aFree.indexOf(a);
          if (freeIdx !== -1) {
            scatterA[a] = freeIdx;
          } else {
            const contIdx = aContractedInPairOrder.indexOf(a);
            scatterA[a] = naFree + contIdx;
          }
        }
        const isScatterAIdentity = scatterA.every((v, idx) => v === idx);
        const dAFinal = isScatterAIdentity ? dAReordered : dAReordered.transpose(scatterA);

        for (let i = 0; i < aGradSlot.length; i++) {
          aGradSlot[i] += dAFinal.data[i];
        }

        // -- dB = tensordot(A, dZ, ...) then permute --
        // We contract A's aFree axes with dZ's A-free portion (axes 0..naFree-1).
        // Result has axes:
        //   first:  A's surviving axes = A's aContracted axes (in A's original order)
        //   then:   dZ's surviving axes = dZ's bFree portion = bFree dims (in bFree order)
        const dBaxes: Array<readonly [number, number]> = [];
        for (let i = 0; i < naFree; i++) {
          dBaxes.push([aFree[i], i] as const);
        }
        const dBPartial = aPrimalTbk.tensordot(dZ, dBaxes);
        // dBPartial shape: [...A's aContracted dims (in A's original order), ...bFree dims (in bFree order)]
        // Reorder the head (A's aContracted axes) from "A's original order" into "pair order".
        const aContractedSortedByOriginal = [...aContractedInPairOrder].sort((x, y) => x - y);
        const dBHeadPerm: number[] = [];
        for (let k = 0; k < nPairs; k++) {
          const aOrigAxis = aContractedInPairOrder[k];
          const idx = aContractedSortedByOriginal.indexOf(aOrigAxis);
          dBHeadPerm.push(idx);
        }
        const dBFirstPerm: number[] = [];
        for (let k = 0; k < nPairs; k++) dBFirstPerm.push(dBHeadPerm[k]);
        for (let i = 0; i < nbFree; i++) dBFirstPerm.push(nPairs + i);
        const isDBFirstPermIdentity = dBFirstPerm.every((v, idx) => v === idx);
        const dBReordered = isDBFirstPermIdentity ? dBPartial : dBPartial.transpose(dBFirstPerm);

        // Now dBReordered axis k (k < nPairs) corresponds to B's axis bContractedInPairOrder[k];
        // dBReordered axis (nPairs + k) corresponds to B's axis bFree[k].
        // Build scatter permutation to put axes in B's original order.
        const scatterB: number[] = new Array(bRank);
        for (let b = 0; b < bRank; b++) {
          const freeIdx = bFree.indexOf(b);
          if (freeIdx !== -1) {
            scatterB[b] = nPairs + freeIdx;
          } else {
            const contIdx = bContractedInPairOrder.indexOf(b);
            scatterB[b] = contIdx;
          }
        }
        const isScatterBIdentity = scatterB.every((v, idx) => v === idx);
        const dBFinal = isScatterBIdentity ? dBReordered : dBReordered.transpose(scatterB);

        for (let i = 0; i < bGradSlot.length; i++) {
          bGradSlot[i] += dBFinal.data[i];
        }
      }
    );

    return new TapedTensor(zShape, new Float64Array(zPrimal.data), this.tape, id);
  }

  // ---------------------------------------------------------------------------
  // SVD — full singular value decomposition on rank-2 input.
  // ---------------------------------------------------------------------------

  /**
   * Reverse-mode AD over the full SVD of a rank-2 matrix.
   *
   * Forward: `A = U · diag(S) · Vt`, where for input shape [m, n], k = min(m, n):
   *   - U  has shape [m, k]
   *   - S  has shape [k]
   *   - Vt has shape [k, n]    (Vt is V^T in the standard A = U Σ V^T convention,
   *                              i.e. its rows are right-singular-vector components)
   *
   * Returned TapedTensors share a single backward closure. When backward()
   * runs, it pulls dU, dS, dV from each output's gradient slot, assembles
   * dA, and writes to the input's gradient slot.
   *
   * Adjoint (real, distinct nonzero singular values, m = n square case;
   * extended to rectangular below). Derived directly from the forward
   * Jacobian; equivalent to PyTorch's `svd_backward`
   * (`aten/src/ATen/native/BatchLinearAlgebra.cpp`) and Townsend (2016)
   * "Differentiating the Singular Value Decomposition" §3:
   *
   *   Let α = skew(U^T · dU),  β = skew(V^T · dV)        (k×k, antisymmetric)
   *   Build C (k×k):
   *     C[i,i] = dS[i]
   *     C[i,j] = (α[i,j] + β[i,j]) / (s_j − s_i)
   *            + (α[i,j] − β[i,j]) / (s_j + s_i)         for i ≠ j
   *   dA_in = U · C · V^T                                 (m×n in-subspace part)
   *
   * Rectangular correction (when m > k, i.e. m > n):
   *   dA += (I − U U^T) · dU · diag(1/s) · V^T
   * Rectangular correction (when n > k, i.e. n > m):
   *   dA += U · diag(1/s) · dV^T · (I − V V^T)
   *
   * Regularisation at repeated/near-zero singular values (PyTorch-equivalent
   * subgradient choice): the (i,j) entry of C is masked to 0 whenever
   * `|s_j − s_i| < REL_TOL · max(|s|)` (the "difference" denominator) or
   * `|s_j + s_i| < REL_TOL · max(|s|)` (the "sum" denominator, only relevant
   * when both are ~0). REL_TOL = 1e-10. This makes the gradient a subgradient
   * at exact degeneracy — finite, but not the unique true derivative (which
   * does not exist at degeneracies). The rectangular correction also masks
   * 1/s_i when |s_i| < REL_TOL · max(|s|).
   *
   * Throws if input is not rank-2. For rank > 2 inputs the user should
   * reshape first.
   */
  svd(): { U: TapedTensor; S: TapedTensor; V: TapedTensor } {
    if (this.shape.length !== 2) {
      throw new Error(
        `TapedTensor.svd: expected rank-2 input, got rank ${this.shape.length}. ` +
          `Reshape the tensor to 2-D first.`
      );
    }
    const m = this.shape[0];
    const n = this.shape[1];
    const k = Math.min(m, n);

    // Forward pass via tensorSvd with rowAxes = [0] (treat axis 0 as rows).
    const inputT = new Tensor([m, n], new Float64Array(this.primal));
    const svdResult = tensorSvd(inputT, [0]);
    // tensorSvd may truncate. We need the full (untruncated) k = min(m,n).
    // Verify no truncation happened (no opts → cutoff = 0, maxdim undefined).
    if (svdResult.truncatedDim !== k) {
      throw new Error(
        `TapedTensor.svd: internal — tensorSvd returned truncatedDim=${svdResult.truncatedDim}, ` +
          `expected ${k}. (A zero singular value was dropped by the default cutoff?)`
      );
    }

    const uPrimal = new Float64Array(svdResult.U.data); // [m, k]
    const sPrimal = new Float64Array(svdResult.S.data); // [k]
    const vtPrimal = new Float64Array(svdResult.V.data); // [k, n]  (V^T in standard notation)

    // Create the three output TapedTensors, each with its own tape node.
    // We use a single shared backward closure: each output records a node
    // whose backward reads from a *shared* state and only runs the shared
    // computation once (on the last call). To keep the tape semantics
    // straightforward, we instead have each of U, S, V record a no-op
    // forward node and gather their gradient slots into a final shared node
    // that's emitted right after them and depends on this.id only.
    //
    // Simpler approach: record three "leaf" outputs U, S, V whose backwards
    // are no-ops (they merely accumulate the upstream gradient into a
    // captured slot). Then record one "joiner" node whose inputs are U, S, V
    // (so its outputGradSlot is unused) and whose backward reads from the
    // three captured slots and writes to A. The joiner has output size 0
    // so its slot allocation is fine.
    //
    // Wait — the tape backward iterates from last node to first. The joiner
    // would need to come after all consumers of U, S, V have written to
    // those slots. We can't enforce that with the current Tape design
    // (it iterates nodes in record-order). So we adopt a cleaner pattern:
    // we record one node per output, and the FIRST output to run backward
    // (i.e. the one with the highest record-order, which is V here) is
    // responsible for the shared work. Each backward consults the shared
    // state to know whether the others have flushed.
    //
    // Actually the simplest correct approach: each output's backward
    // captures the **upstream** gradient into a private slot, but defers
    // the actual computation. We need a barrier: the LAST backward to
    // run (which is the FIRST recorded, since iteration is reverse) does
    // the work.
    //
    // Order of recording below: U, S, V (S is in the middle). Tape iterates
    // backward from V → S → U. We want the work done on U's backward (the
    // last one called), so by then dU, dS, dV are all known.

    // Captured gradient buffers shared across the three nodes.
    const dUBuf = new Float64Array(m * k);
    const dSBuf = new Float64Array(k);
    const dVtBuf = new Float64Array(k * n);

    const thisGradSlot = this.tape.getInputGrad(this.id)!;

    // The shared backward routine — invoked on the FIRST recorded node (U),
    // which runs LAST during reverse traversal.
    const sharedBackward = (): void => {
      // Assemble dA from dU, dS, dVt, given U (m×k), s (k), Vt (k×n).
      const dA = _svdBackward(uPrimal, sPrimal, vtPrimal, dUBuf, dSBuf, dVtBuf, m, n, k);
      for (let i = 0; i < thisGradSlot.length; i++) {
        thisGradSlot[i] += dA[i];
      }
    };

    // Node for U: backward captures incoming dU AND triggers shared work.
    // Since U is recorded first, it's the LAST to run in reverse traversal.
    const { id: uId } = this.tape.record([this.id], m * k, (outputGrad) => {
      // Capture dU first, then run shared work.
      for (let i = 0; i < dUBuf.length; i++) dUBuf[i] += outputGrad[i];
      sharedBackward();
    });
    // Node for S: backward captures incoming dS.
    const { id: sId } = this.tape.record([this.id], k, (outputGrad) => {
      for (let i = 0; i < dSBuf.length; i++) dSBuf[i] += outputGrad[i];
    });
    // Node for V (returned as the m×n V^T factor): backward captures dV.
    const { id: vId } = this.tape.record([this.id], k * n, (outputGrad) => {
      for (let i = 0; i < dVtBuf.length; i++) dVtBuf[i] += outputGrad[i];
    });

    const uTape = new TapedTensor([m, k], uPrimal, this.tape, uId);
    const sTape = new TapedTensor([k], sPrimal, this.tape, sId);
    const vTape = new TapedTensor([k, n], vtPrimal, this.tape, vId);
    return { U: uTape, S: sTape, V: vTape };
  }

  // ---------------------------------------------------------------------------
  // Symmetric eigendecomposition.
  // ---------------------------------------------------------------------------

  /**
   * Reverse-mode AD over the eigendecomposition of a rank-2 matrix.
   *
   * Symmetric path (`symmetric: true`):
   *   Forward: `A = U · diag(Λ) · U^T` for symmetric A (n×n).
   *   Adjoint (Magnus & Neudecker 1999 §10.6.6; PyTorch `linalg_eigh_backward`):
   *     F[i,j] = 1 / (λ_j − λ_i)   for i ≠ j, 0 otherwise (with degeneracy mask)
   *     dA_raw = U · (diag(dΛ) + F ∘ (U^T · dU)) · U^T
   *     dA     = (dA_raw + dA_raw^T) / 2          (symmetrise)
   *
   * Non-symmetric path (`symmetric: false`):
   *   Forward: `A = V · diag(λ) · V^{-1}` (V columns are right eigenvectors).
   *   Adjoint (Magnus & Neudecker 1999 §10.6 / Giles 2008 §3.2 / Townsend 2016 §4;
   *   cross-check: PyTorch `linalg_eig_backward`):
   *     E[i,j] = 1 / (λ_j − λ_i)  for i ≠ j, 0 otherwise (with degeneracy mask)
   *     dA = V^{-T} · ( E ∘ (V^T · dV) + diag(dλ) ) · V^T
   *
   *   Restrictions (all enforced — throw a clear error otherwise):
   *   1. Eigenvalues must be real. The underlying matrix-eig primitive returns
   *      placeholder eigenvectors (not actual complex vectors) when complex
   *      eigenvalues arise, so the adjoint formula cannot be evaluated. Real-
   *      Schur differentiation would require complex arithmetic infrastructure
   *      throughout the Tape/TapedTensor stack, which is out of scope.
   *   2. A must be diagonalisable (non-defective). The adjoint assumes V is
   *      invertible; defective inputs have algebraic > geometric multiplicity
   *      so V is rank-deficient. Detected by cond_∞(V) > 1e14.
   *
   * Regularisation at repeated eigenvalues (subgradient choice): mask
   * F/E[i,j] = 0 when `|λ_i − λ_j| < REL_TOL · max(|λ|)`. REL_TOL = 1e-10.
   *
   * Throws if input is not rank-2 or square, if `symmetric` is missing, or
   * (non-symmetric path) on complex eigenvalues / defective input.
   */
  eig(opts: { symmetric: boolean }): { eigvals: TapedTensor; eigvecs: TapedTensor } {
    if (!opts || typeof opts.symmetric !== 'boolean') {
      throw new Error(
        'TapedTensor.eig: opts.symmetric must be set to true or false. ' +
          'Pass { symmetric: true } for symmetric A, { symmetric: false } for general A.'
      );
    }
    if (this.shape.length !== 2 || this.shape[0] !== this.shape[1]) {
      throw new Error(`TapedTensor.eig: expected rank-2 square input, got shape [${this.shape}].`);
    }
    const n = this.shape[0];

    if (opts.symmetric === true) {
      return this._eigSymmetric(n);
    }
    return this._eigGeneral(n);
  }

  private _eigSymmetric(n: number): { eigvals: TapedTensor; eigvecs: TapedTensor } {
    const inputT = new Tensor([n, n], new Float64Array(this.primal));
    const eigResult = tensorEig(inputT, [0], { symmetric: true, computeVectors: true });
    const lambdaPrimal = new Float64Array(eigResult.eigenvalues.data);
    if (!eigResult.eigenvectors) {
      throw new Error('TapedTensor.eig: tensorEig did not return eigenvectors');
    }
    const uPrimal = new Float64Array(eigResult.eigenvectors.data);

    const dLambdaBuf = new Float64Array(n);
    const dUBuf = new Float64Array(n * n);

    const thisGradSlot = this.tape.getInputGrad(this.id)!;

    const sharedBackward = (): void => {
      const dA = _eigSymBackward(uPrimal, lambdaPrimal, dUBuf, dLambdaBuf, n);
      for (let i = 0; i < thisGradSlot.length; i++) {
        thisGradSlot[i] += dA[i];
      }
    };

    const { id: lId } = this.tape.record([this.id], n, (outputGrad) => {
      for (let i = 0; i < dLambdaBuf.length; i++) dLambdaBuf[i] += outputGrad[i];
      sharedBackward();
    });
    const { id: uId } = this.tape.record([this.id], n * n, (outputGrad) => {
      for (let i = 0; i < dUBuf.length; i++) dUBuf[i] += outputGrad[i];
    });

    const lTape = new TapedTensor([n], lambdaPrimal, this.tape, lId);
    const uTape = new TapedTensor([n, n], uPrimal, this.tape, uId);
    return { eigvals: lTape, eigvecs: uTape };
  }

  private _eigGeneral(n: number): { eigvals: TapedTensor; eigvecs: TapedTensor } {
    const inputT = new Tensor([n, n], new Float64Array(this.primal));
    const eigResult = tensorEig(inputT, [0], { symmetric: false, computeVectors: true });

    if (eigResult.eigenvaluesImaginary) {
      const imData = eigResult.eigenvaluesImaginary.data;
      for (let i = 0; i < n; i++) {
        if (imData[i] !== 0) {
          throw new Error(
            'TapedTensor.eig({ symmetric: false }): input has complex eigenvalues. ' +
              'Reverse-mode AD over the general non-symmetric eig is restricted to ' +
              'real eigenvalues (the underlying matrix primitive does not return ' +
              'complex eigenvectors). Either symmetrise the input, or restrict to ' +
              'inputs with a real spectrum.'
          );
        }
      }
    }

    if (!eigResult.eigenvectors) {
      throw new Error('TapedTensor.eig: tensorEig did not return eigenvectors');
    }
    const lambdaPrimal = new Float64Array(eigResult.eigenvalues.data);
    const vPrimal = new Float64Array(eigResult.eigenvectors.data);

    // Defective check: compute V^{-1} via LU; if cond_∞(V) > 1e14, throw.
    // The inverse is needed for the adjoint anyway, so we compute it once
    // and reuse it.
    const vInvOrNull = _invertWithCondCheck(vPrimal, n, 1e14);
    if (vInvOrNull === null) {
      throw new Error(
        'TapedTensor.eig({ symmetric: false }): input appears defective ' +
          '(eigenvector matrix V has cond_∞(V) > 1e14). The general-case adjoint ' +
          'requires diagonalisability. Consider perturbing the input or using ' +
          'the symmetric path if A is symmetric.'
      );
    }
    const vInv = vInvOrNull;

    const dLambdaBuf = new Float64Array(n);
    const dVBuf = new Float64Array(n * n);

    const thisGradSlot = this.tape.getInputGrad(this.id)!;

    const sharedBackward = (): void => {
      const dA = _eigGeneralBackward(vPrimal, vInv, lambdaPrimal, dVBuf, dLambdaBuf, n);
      for (let i = 0; i < thisGradSlot.length; i++) {
        thisGradSlot[i] += dA[i];
      }
    };

    const { id: lId } = this.tape.record([this.id], n, (outputGrad) => {
      for (let i = 0; i < dLambdaBuf.length; i++) dLambdaBuf[i] += outputGrad[i];
      sharedBackward();
    });
    const { id: vId } = this.tape.record([this.id], n * n, (outputGrad) => {
      for (let i = 0; i < dVBuf.length; i++) dVBuf[i] += outputGrad[i];
    });

    const lTape = new TapedTensor([n], lambdaPrimal, this.tape, lId);
    const vTape = new TapedTensor([n, n], vPrimal, this.tape, vId);
    return { eigvals: lTape, eigvecs: vTape };
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers (not exported; private to this module)
// ---------------------------------------------------------------------------

/**
 * SVD reverse-mode adjoint.
 *
 * Inputs (row-major Float64Arrays):
 *   U  : m × k
 *   s  : k         (singular values, descending)
 *   Vt : k × n     (Vt = V^T in the standard A = U Σ V^T convention)
 *   dU : m × k
 *   dS : k
 *   dVt: k × n
 *
 * Returns dA (m × n).
 *
 * Tolerance: REL_TOL = 1e-10. F[i,j] is zeroed when |s_j − s_i| / max(|s|)
 * < REL_TOL (degenerate / near-degenerate singular pair). Likewise the
 * "sum" denominator s_j + s_i is masked when both are ~0. The rectangular
 * 1/s correction terms are masked when s_i / max(|s|) < REL_TOL.
 */
function _svdBackward(
  U: Float64Array,
  s: Float64Array,
  Vt: Float64Array,
  dU: Float64Array,
  dS: Float64Array,
  dVt: Float64Array,
  m: number,
  n: number,
  k: number
): Float64Array {
  const REL_TOL = 1e-10;
  let sMax = 0;
  for (let i = 0; i < k; i++) {
    const a = Math.abs(s[i]);
    if (a > sMax) sMax = a;
  }
  const tolAbs = REL_TOL * (sMax > 0 ? sMax : 1);

  // Compute V from Vt: V[i, j] = Vt[j, i], shape n × k.
  const V = new Float64Array(n * k);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      V[i * k + j] = Vt[j * n + i];
    }
  }
  // Compute dV (n × k) from dVt (k × n) by transposing.
  const dV = new Float64Array(n * k);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      dV[i * k + j] = dVt[j * n + i];
    }
  }

  // UtU_grad = U^T · dU  (k × k)
  const UtdU = _matmulMNK(U, dU, m, k, k, /*aT=*/ true, /*bT=*/ false);
  // VtdV = V^T · dV  (k × k)
  const VtdV = _matmulMNK(V, dV, n, k, k, /*aT=*/ true, /*bT=*/ false);

  // skew parts: α = (UtdU − UtdU^T) / 2, β = (VtdV − VtdV^T) / 2
  // Build C (k × k):
  //   C[i,i] = dS[i]
  //   C[i,j] = (α[i,j] + β[i,j]) / (s_j − s_i)
  //          + (α[i,j] − β[i,j]) / (s_j + s_i)        for i ≠ j
  // with degeneracy masking on each denominator.
  const C = new Float64Array(k * k);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (i === j) {
        C[i * k + j] = dS[i];
      } else {
        const alpha = (UtdU[i * k + j] - UtdU[j * k + i]) * 0.5;
        const beta = (VtdV[i * k + j] - VtdV[j * k + i]) * 0.5;
        const denomDiff = s[j] - s[i];
        const denomSum = s[j] + s[i];
        let term = 0;
        if (Math.abs(denomDiff) > tolAbs) {
          term += (alpha + beta) / denomDiff;
        }
        if (Math.abs(denomSum) > tolAbs) {
          term += (alpha - beta) / denomSum;
        }
        C[i * k + j] = term;
      }
    }
  }

  // dA_in = U · C · V^T  (m × n)
  // UC = U · C  (m × k)
  const UC = _matmulMNK(U, C, m, k, k, false, false);
  // dA_in = UC · Vt  (where Vt is already V^T, shape k × n)
  const dA = _matmulMNK(UC, Vt, m, k, n, false, false);

  // Rectangular correction: when m > k (i.e. m > n), there's an out-of-subspace
  // contribution: dA += (I − U U^T) · dU · diag(1/s) · V^T
  // Equivalently: dU_perp = dU − U · (U^T · dU); then dA += dU_perp · diag(1/s) · V^T.
  if (m > k) {
    // dU_perp = dU − U · UtdU   (m × k)
    const UUtdU = _matmulMNK(U, UtdU, m, k, k, false, false); // (m × k)
    const dUperp = new Float64Array(m * k);
    for (let i = 0; i < m * k; i++) dUperp[i] = dU[i] - UUtdU[i];
    // Scale columns by 1/s_j (masked).
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < k; j++) {
        const sj = s[j];
        if (Math.abs(sj) > tolAbs) {
          dUperp[i * k + j] /= sj;
        } else {
          dUperp[i * k + j] = 0;
        }
      }
    }
    // dA += dUperp · Vt   (m × n)
    const corr = _matmulMNK(dUperp, Vt, m, k, n, false, false);
    for (let i = 0; i < dA.length; i++) dA[i] += corr[i];
  }

  // Rectangular correction: when n > k (i.e. n > m), symmetric for V.
  // dA += U · diag(1/s) · (dVt − Vt · (V · Vt^T))  -- but easier:
  // dV_perp = dV − V · (V^T · dV) = dV − V · VtdV    (n × k)
  // dA += U · diag(1/s) · dV_perp^T
  if (n > k) {
    const VVtdV = _matmulMNK(V, VtdV, n, k, k, false, false); // (n × k)
    const dVperp = new Float64Array(n * k);
    for (let i = 0; i < n * k; i++) dVperp[i] = dV[i] - VVtdV[i];
    // Scale columns by 1/s_j (masked).
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < k; j++) {
        const sj = s[j];
        if (Math.abs(sj) > tolAbs) {
          dVperp[i * k + j] /= sj;
        } else {
          dVperp[i * k + j] = 0;
        }
      }
    }
    // dA += U · dVperp^T   (m × n)
    // U is m × k; dVperp is n × k; dVperp^T is k × n.
    const corr = _matmulMNK(U, dVperp, m, k, n, false, true);
    for (let i = 0; i < dA.length; i++) dA[i] += corr[i];
  }

  return dA;
}

/**
 * Symmetric-eigendecomposition reverse-mode adjoint.
 *
 * Inputs (row-major Float64Arrays):
 *   U     : n × n  (columns are eigenvectors; U is orthogonal)
 *   lam   : n      (eigenvalues, real)
 *   dU    : n × n  (upstream adjoint of U)
 *   dLam  : n      (upstream adjoint of λ)
 *
 * Returns dA (n × n), symmetrised so the gradient lives on the symmetric
 * manifold (matching the symmetric primal).
 *
 * Tolerance: REL_TOL = 1e-10. F[i,j] is zeroed when |λ_j − λ_i| / max(|λ|)
 * < REL_TOL.
 */
function _eigSymBackward(
  U: Float64Array,
  lam: Float64Array,
  dU: Float64Array,
  dLam: Float64Array,
  n: number
): Float64Array {
  const REL_TOL = 1e-10;
  let lamMax = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(lam[i]);
    if (a > lamMax) lamMax = a;
  }
  const tolAbs = REL_TOL * (lamMax > 0 ? lamMax : 1);

  // UtdU = U^T · dU   (n × n)
  const UtdU = _matmulMNK(U, dU, n, n, n, true, false);

  // M = diag(dLam) + F ∘ (U^T · dU)
  // F[i,j] = 1/(λ_j − λ_i) for i ≠ j, masked at near-degeneracies.
  const M = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        M[i * n + j] = dLam[i];
      } else {
        const denom = lam[j] - lam[i];
        if (Math.abs(denom) > tolAbs) {
          M[i * n + j] = UtdU[i * n + j] / denom;
        } else {
          M[i * n + j] = 0;
        }
      }
    }
  }

  // dA_raw = U · M · U^T   (n × n)
  const UM = _matmulMNK(U, M, n, n, n, false, false);
  const dAraw = _matmulMNK(UM, U, n, n, n, false, true);

  // Symmetrise: dA = (dA_raw + dA_raw^T) / 2
  const dA = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      dA[i * n + j] = (dAraw[i * n + j] + dAraw[j * n + i]) * 0.5;
    }
  }
  return dA;
}

/**
 * General (non-symmetric) eigendecomposition reverse-mode adjoint.
 *
 * For A = V · diag(λ) · V^{-1} (V columns are right eigenvectors, all real,
 * each column unit-normalised by the underlying primitive), the adjoint is
 * (Boeddeker et al. 2017 / arXiv:1701.00392 Eq. 4.77; PyTorch
 * `linalg_eig_backward` is the canonical implementation):
 *
 *   Let VtdV = V^T · dV.
 *   Correct for unit-norm gauge: VtdV ← VtdV − V^T · V · diag(diag(VtdV))
 *     (this projects onto the tangent space at V^T·V of column-unit-norm
 *     matrices; otherwise the formula assumes V's normalisation is a free
 *     parameter and gives the wrong result for losses sensitive to scaling.)
 *   E[i,j] = 1 / (λ_j − λ_i)  for i ≠ j, 0 otherwise (with degeneracy mask)
 *   M = E ∘ VtdV (off-diagonal); M's diagonal is replaced with dλ.
 *   dA = V^{-T} · M · V^T
 *
 * Inputs (row-major Float64Arrays):
 *   V     : n × n  (columns are right eigenvectors, each unit-norm)
 *   vInv  : n × n  (V^{-1}, precomputed by caller)
 *   lam   : n      (real eigenvalues)
 *   dV    : n × n  (upstream adjoint of V)
 *   dLam  : n      (upstream adjoint of λ)
 *
 * Returns dA (n × n).
 *
 * Tolerance: REL_TOL = 1e-10. E[i,j] is zeroed when |λ_j − λ_i| / max(|λ|)
 * < REL_TOL.
 */
function _eigGeneralBackward(
  V: Float64Array,
  vInv: Float64Array,
  lam: Float64Array,
  dV: Float64Array,
  dLam: Float64Array,
  n: number
): Float64Array {
  const REL_TOL = 1e-10;
  let lamMax = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(lam[i]);
    if (a > lamMax) lamMax = a;
  }
  const tolAbs = REL_TOL * (lamMax > 0 ? lamMax : 1);

  // VtdV = V^T · dV   (n × n)
  const VtdV = _matmulMNK(V, dV, n, n, n, true, false);

  // Gauge correction for unit-norm V: subtract V^T · V · diag(diag(VtdV)).
  // Equivalently: subtract from VtdV[i,j] the value (V^T·V)[i,j] · diag(VtdV)[j].
  // Compute VtV[i,j] = sum_k V[k,i] * V[k,j] = (V^T · V)[i,j].
  const VtV = _matmulMNK(V, V, n, n, n, true, false);
  // Snapshot the diagonal of VtdV BEFORE in-place modification (otherwise the
  // j-th column lookup reads an already-modified value).
  const diagVtdV = new Float64Array(n);
  for (let i = 0; i < n; i++) diagVtdV[i] = VtdV[i * n + i];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      VtdV[i * n + j] -= VtV[i * n + j] * diagVtdV[j];
    }
  }

  // M = diag(dLam) on the diagonal + E ∘ VtdV off-diagonal.
  const M = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        M[i * n + j] = dLam[i];
      } else {
        const denom = lam[j] - lam[i];
        if (Math.abs(denom) > tolAbs) {
          M[i * n + j] = VtdV[i * n + j] / denom;
        } else {
          M[i * n + j] = 0;
        }
      }
    }
  }

  // dA = V^{-T} · M · V^T
  // V^{-T} is (vInv)^T physically; use the transpose flag in _matmulMNK.
  const VinvT_M = _matmulMNK(vInv, M, n, n, n, true, false);
  const dA = _matmulMNK(VinvT_M, V, n, n, n, false, true);
  return dA;
}

/**
 * Compute V^{-1} via partial-pivoting LU and reject defective inputs via a
 * cond_∞(V) bound.
 *
 * Returns the inverse as a row-major Float64Array, OR null if
 * cond_∞(V) = ||V||_∞ · ||V^{-1}||_∞ exceeds `maxCond`. Also returns null if
 * a pivot is exactly zero (singular V).
 */
function _invertWithCondCheck(V: Float64Array, n: number, maxCond: number): Float64Array | null {
  const LU = new Float64Array(V);
  const perm = new Int32Array(n);
  for (let i = 0; i < n; i++) perm[i] = i;

  let pivotEpsScale = 0;
  for (let i = 0; i < n * n; i++) {
    const a = Math.abs(V[i]);
    if (a > pivotEpsScale) pivotEpsScale = a;
  }
  const singularEps = pivotEpsScale === 0 ? 0 : pivotEpsScale * 1e-300;

  for (let k = 0; k < n; k++) {
    let maxVal = Math.abs(LU[k * n + k]);
    let maxIdx = k;
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(LU[i * n + k]);
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    }
    if (maxIdx !== k) {
      for (let j = 0; j < n; j++) {
        const tmp = LU[k * n + j];
        LU[k * n + j] = LU[maxIdx * n + j];
        LU[maxIdx * n + j] = tmp;
      }
      const t = perm[k];
      perm[k] = perm[maxIdx];
      perm[maxIdx] = t;
    }
    const pivot = LU[k * n + k];
    if (!Number.isFinite(pivot) || Math.abs(pivot) <= singularEps) {
      return null;
    }
    for (let i = k + 1; i < n; i++) {
      LU[i * n + k] /= pivot;
      const lik = LU[i * n + k];
      for (let j = k + 1; j < n; j++) {
        LU[i * n + j] -= lik * LU[k * n + j];
      }
    }
  }

  // Solve V · X = I (column-by-column) using the LU decomposition.
  const inv = new Float64Array(n * n);
  const y = new Float64Array(n);
  for (let col = 0; col < n; col++) {
    for (let i = 0; i < n; i++) {
      // Right-hand side: e_col permuted: b[i] = (i row of perm) == col ? 1 : 0
      // i.e. b[i] = 1 iff perm[i] === col.
      y[i] = perm[i] === col ? 1 : 0;
    }
    // Forward solve L · y' = b (L is unit lower).
    for (let i = 0; i < n; i++) {
      let s = y[i];
      for (let j = 0; j < i; j++) s -= LU[i * n + j] * y[j];
      y[i] = s;
    }
    // Back solve U · x = y'.
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= LU[i * n + j] * inv[j * n + col];
      inv[i * n + col] = s / LU[i * n + i];
    }
  }

  // cond_∞(V) ≈ ||V||_∞ · ||V^{-1}||_∞ (max absolute row sum on each).
  let normV = 0;
  let normInv = 0;
  for (let i = 0; i < n; i++) {
    let rowV = 0;
    let rowI = 0;
    for (let j = 0; j < n; j++) {
      rowV += Math.abs(V[i * n + j]);
      const inv_ij = inv[i * n + j];
      if (!Number.isFinite(inv_ij)) return null;
      rowI += Math.abs(inv_ij);
    }
    if (rowV > normV) normV = rowV;
    if (rowI > normInv) normInv = rowI;
  }
  const cond = normV * normInv;
  if (!Number.isFinite(cond) || cond > maxCond) return null;
  return inv;
}

/**
 * Plain row-major matrix multiply with optional per-operand transposition.
 *
 *   C = (A^aT) · (B^bT)
 *
 * Logical dims: A is (M × K) after optional transpose; B is (K × N) after
 * optional transpose; C is (M × N).
 *
 * `aT=true` means the physical A is stored as (K × M) row-major (we treat
 * it as A^T which is M × K). Likewise for `bT`.
 */
function _matmulMNK(
  A: Float64Array,
  B: Float64Array,
  M: number,
  K: number,
  N: number,
  aT: boolean,
  bT: boolean
): Float64Array {
  const C = new Float64Array(M * N);
  // Logical access helpers:
  //   aGet(i, q) = A^aT[i, q]
  //   bGet(q, j) = B^bT[q, j]
  // If aT=false: A is M × K row-major, A^aT[i, q] = A[i*K + q]
  // If aT=true:  physical A is K × M row-major, A^T[i, q] = A[q*M + i]
  // Similarly for B.
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let q = 0; q < K; q++) {
        const aVal = aT ? A[q * M + i] : A[i * K + q];
        const bVal = bT ? B[j * K + q] : B[q * N + j];
        sum += aVal * bVal;
      }
      C[i * N + j] = sum;
    }
  }
  return C;
}

/**
 * Normalise an axis argument to a sorted array of non-negative axis indices.
 * If `axis` is undefined, returns all axes [0, 1, ..., rank-1].
 * Negative indices are not supported (use non-negative indices only).
 */
function _resolveAxes(axis: number | ReadonlyArray<number> | undefined, rank: number): number[] {
  if (axis === undefined) {
    return Array.from({ length: rank }, (_, i) => i);
  }
  if (typeof axis === 'number') {
    return [axis];
  }
  return [...axis].sort((a, b) => a - b);
}

/**
 * Given a Tensor whose axisLabels are some permutation of `targetLabels`,
 * return a Float64Array whose data is permuted so the axes are in the order
 * dictated by `targetLabels`.
 *
 * Both `tensor.axisLabels` and `targetLabels` must cover the same set of
 * Index objects (matched by `Index.matches`).
 */
function _scatterToOriginalAxes(tensor: Tensor, targetLabels: ReadonlyArray<Index>): Float64Array {
  const currentLabels = tensor.axisLabels!;
  const rank = targetLabels.length;

  // Build permutation: perm[i] = j means "output axis i comes from input axis j".
  // I.e. targetLabels[i] == currentLabels[perm[i]].
  const perm: number[] = new Array(rank);
  for (let i = 0; i < rank; i++) {
    const j = currentLabels.findIndex((lbl) => lbl.matches(targetLabels[i]));
    if (j === -1) {
      throw new Error(
        `_scatterToOriginalAxes: target label ${targetLabels[i].toString()} ` +
          `not found in tensor axisLabels`
      );
    }
    perm[i] = j;
  }

  // Check if the permutation is identity (axes already in order).
  const isIdentity = perm.every((j, i) => j === i);
  if (isIdentity) {
    return new Float64Array(tensor.data);
  }

  // Use Tensor.transpose to permute axes.
  // transpose(perm) maps: output axis i ← input axis perm[i].
  const permuted = tensor.transpose(perm);
  return new Float64Array(permuted.data);
}

/**
 * Batched matrix multiply: Y[...ij] = Σ_k A[...ik] * B[...kj].
 *
 * `aShape` is [...batch, m, k], `bShape` is [...batch, k, n].
 * Returns Y with shape [...batch, m, n].
 */
function _batchedMatmul(
  aData: Float64Array,
  bData: Float64Array,
  aShape: ReadonlyArray<number>,
  bShape: ReadonlyArray<number>
): Float64Array {
  const rank = aShape.length;
  const batchRank = rank - 2;
  const m = aShape[rank - 2];
  const k = aShape[rank - 1];
  const n = bShape[rank - 1];

  // Total number of batch elements.
  let batchSize = 1;
  for (let b = 0; b < batchRank; b++) batchSize *= aShape[b];

  const yData = new Float64Array(batchSize * m * n);

  for (let batch = 0; batch < batchSize; batch++) {
    const aOff = batch * m * k;
    const bOff = batch * k * n;
    const yOff = batch * m * n;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let q = 0; q < k; q++) {
          sum += aData[aOff + i * k + q] * bData[bOff + q * n + j];
        }
        yData[yOff + i * n + j] = sum;
      }
    }
  }

  return yData;
}

/**
 * Gradient of batched matmul w.r.t. A:
 *   dA[...ik] = Σ_j dY[...ij] * B[...kj]   (= dY @ Bᵀ per batch slice)
 *
 * `yShape` is [...batch, m, n], `bShape` is [...batch, k, n].
 * Returns dA with shape [...batch, m, k].
 */
function _batchedMatmulGradA(
  dYData: Float64Array,
  bData: Float64Array,
  yShape: ReadonlyArray<number>,
  bShape: ReadonlyArray<number>
): Float64Array {
  const rank = yShape.length;
  const batchRank = rank - 2;
  const m = yShape[rank - 2];
  const n = yShape[rank - 1];
  const k = bShape[rank - 2];

  let batchSize = 1;
  for (let b = 0; b < batchRank; b++) batchSize *= yShape[b];

  const dAData = new Float64Array(batchSize * m * k);

  for (let batch = 0; batch < batchSize; batch++) {
    const dYOff = batch * m * n;
    const bOff = batch * k * n;
    const dAOff = batch * m * k;
    for (let i = 0; i < m; i++) {
      for (let q = 0; q < k; q++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          // dY[i,j] * B[q,j]  (B transposed: B^T[j,q] = B[q,j])
          sum += dYData[dYOff + i * n + j] * bData[bOff + q * n + j];
        }
        dAData[dAOff + i * k + q] = sum;
      }
    }
  }

  return dAData;
}

/**
 * Gradient of batched matmul w.r.t. B:
 *   dB[...kj] = Σ_i A[...ki] * dY[...ij]   (= Aᵀ @ dY per batch slice)
 *
 * `aShape` is [...batch, m, k], `yShape` is [...batch, m, n].
 * Returns dB with shape [...batch, k, n].
 */
function _batchedMatmulGradB(
  aData: Float64Array,
  dYData: Float64Array,
  aShape: ReadonlyArray<number>,
  yShape: ReadonlyArray<number>
): Float64Array {
  const rank = aShape.length;
  const batchRank = rank - 2;
  const m = aShape[rank - 2];
  const k = aShape[rank - 1];
  const n = yShape[rank - 1];

  let batchSize = 1;
  for (let b = 0; b < batchRank; b++) batchSize *= aShape[b];

  const dBData = new Float64Array(batchSize * k * n);

  for (let batch = 0; batch < batchSize; batch++) {
    const aOff = batch * m * k;
    const dYOff = batch * m * n;
    const dBOff = batch * k * n;
    for (let q = 0; q < k; q++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let i = 0; i < m; i++) {
          // A[i,q] * dY[i,j]  (A transposed: A^T[q,i] = A[i,q])
          sum += aData[aOff + i * k + q] * dYData[dYOff + i * n + j];
        }
        dBData[dBOff + q * n + j] = sum;
      }
    }
  }

  return dBData;
}
