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
import { Tensor, Index } from '@danielsimonjr/mathts-tensor';

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
      const outStrides = _rowMajorStrides(outShape);
      const inStrides = _rowMajorStrides(inputShape);

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
      const outStrides = _rowMajorStrides(outShape);

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
      const outStrides = _rowMajorStrides(outShape);
      const inStrides = _rowMajorStrides(inputShape);

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
      const outStrides = _rowMajorStrides(outShape);

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
      const outStrides = _rowMajorStrides(outShape);

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
        const outStrides = _rowMajorStrides(outShape);

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
        const outStrides = _rowMajorStrides(outShape);

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
        const outStrides = _rowMajorStrides(outShape);

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
   * Elementwise fixed-exponent power: x^k.
   *
   * Only fixed (non-TapedTensor) exponents are supported. Variable-exponent
   * pow(taped, taped) is a follow-up slice.
   *
   * Adjoint: dX = dY · k · x^(k−1)
   */
  pow(k: number): TapedTensor {
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
}

// ---------------------------------------------------------------------------
// Module-level helpers (not exported; private to this module)
// ---------------------------------------------------------------------------

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
 * Row-major strides for a given shape.
 * strides[k] = product of shape[k+1..n-1].
 */
function _rowMajorStrides(shape: ReadonlyArray<number>): number[] {
  const strides = new Array<number>(shape.length);
  let acc = 1;
  for (let k = shape.length - 1; k >= 0; k--) {
    strides[k] = acc;
    acc *= shape[k];
  }
  return strides;
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
