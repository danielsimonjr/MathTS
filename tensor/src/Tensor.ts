/**
 * Tensor — rank-N, Float64Array-backed, row-major dense tensor. The
 * compute primitive behind @danielsimonjr/mathts-tensor. Construction +
 * elementwise here; einsum / matMul / transpose / reshape in the same
 * file, added by the next task.
 *
 * Naive O(n) algorithms — a correctness baseline. Mirrors the storage
 * pattern of DenseMatrix (Float64Array, row-major) but generalised to
 * arbitrary rank, filling the `Matrix<T>` base class's documented
 * "generic template for future rank-N support".
 */

import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { Index } from './named-index.js';

export type NestedArray = number | NestedArray[];

export interface EinsumSpec {
  readonly contractions: ReadonlyArray<{
    readonly pair: readonly [readonly [number, number], readonly [number, number]];
  }>;
  readonly free: ReadonlyArray<{ readonly operand: number; readonly axis: number }>;
}

export class Tensor {
  readonly shape: ReadonlyArray<number>;
  readonly data: Float64Array;
  /** Optional per-axis Index labels. When set, enables `contract`, `replaceIndex`, `axisOf`. */
  readonly axisLabels?: ReadonlyArray<Index>;

  constructor(
    shape: ReadonlyArray<number>,
    data: Float64Array,
    axisLabels?: ReadonlyArray<Index>
  ) {
    if (data.length !== Tensor.sizeOf(shape)) {
      throw new Error(
        `Tensor: data length ${data.length} does not match shape [${shape}] (size ${Tensor.sizeOf(shape)})`
      );
    }
    if (axisLabels !== undefined && axisLabels.length !== shape.length) {
      throw new Error(
        `Tensor: axisLabels length ${axisLabels.length} does not match rank ${shape.length}`
      );
    }
    this.shape = shape;
    this.data = data;
    if (axisLabels !== undefined) {
      this.axisLabels = [...axisLabels];
    }
  }

  static sizeOf(shape: ReadonlyArray<number>): number {
    return shape.reduce((a, b) => a * b, 1);
  }

  static rowMajorStrides(shape: ReadonlyArray<number>): number[] {
    const strides = new Array<number>(shape.length);
    let acc = 1;
    for (let k = shape.length - 1; k >= 0; k--) {
      strides[k] = acc;
      acc *= shape[k];
    }
    return strides;
  }

  static fromNested(data: NestedArray, shape: ReadonlyArray<number>): Tensor {
    const size = Tensor.sizeOf(shape);
    const out = new Float64Array(size);
    let cursor = 0;
    const walk = (node: NestedArray, depth: number): void => {
      if (depth === shape.length) {
        if (typeof node !== 'number') {
          throw new Error(`Tensor.fromNested: expected a number at depth ${depth}`);
        }
        out[cursor++] = node;
        return;
      }
      if (!Array.isArray(node) || node.length !== shape[depth]) {
        throw new Error(`Tensor.fromNested: shape mismatch at depth ${depth}`);
      }
      for (const child of node) walk(child, depth + 1);
    };
    walk(data, 0);
    if (cursor !== size) throw new Error(`Tensor.fromNested: filled ${cursor} of ${size}`);
    return new Tensor([...shape], out);
  }

  static identity(n: number): Tensor {
    const out = new Float64Array(n * n);
    for (let i = 0; i < n; i++) out[i * n + i] = 1;
    return new Tensor([n, n], out);
  }

  toNested(): NestedArray {
    if (this.shape.length === 0) return this.data[0];
    const strides = Tensor.rowMajorStrides(this.shape);
    const build = (depth: number, offset: number): NestedArray => {
      if (depth === this.shape.length - 1) {
        const row: number[] = [];
        for (let i = 0; i < this.shape[depth]; i++) row.push(this.data[offset + i]);
        return row;
      }
      const out: NestedArray[] = [];
      for (let i = 0; i < this.shape[depth]; i++) {
        out.push(build(depth + 1, offset + i * strides[depth]));
      }
      return out;
    };
    return build(0, 0);
  }

  /**
   * Build a rank-2 Tensor from a native DenseMatrix. Bridges the tensor and
   * matrix packages so matrix data can flow into rank-N / autodiff code.
   */
  static fromDenseMatrix(m: DenseMatrix): Tensor {
    const nested = m.toArray() as number[][];
    const rows = nested.length;
    const cols = rows > 0 ? nested[0].length : 0;
    return Tensor.fromNested(nested, [rows, cols]);
  }

  /**
   * Convert a rank-2 Tensor to a native DenseMatrix. Throws for any other rank.
   */
  toDenseMatrix(): DenseMatrix {
    if (this.shape.length !== 2) {
      throw new Error(
        `Tensor.toDenseMatrix: expected a rank-2 tensor, got rank ${this.shape.length}`
      );
    }
    return DenseMatrix.fromArray(this.toNested() as number[][]);
  }

  private sameShape(other: Tensor): boolean {
    return (
      this.shape.length === other.shape.length && this.shape.every((v, i) => v === other.shape[i])
    );
  }

  private elementwise(other: Tensor, op: string, f: (x: number, y: number) => number): Tensor {
    if (!this.sameShape(other)) {
      throw new Error(`Tensor.${op}: shape mismatch [${this.shape}] vs [${other.shape}]`);
    }
    const out = new Float64Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = f(this.data[i], other.data[i]);
    return new Tensor(this.shape, out);
  }

  add(other: Tensor): Tensor {
    return this.elementwise(other, 'add', (x, y) => x + y);
  }
  sub(other: Tensor): Tensor {
    return this.elementwise(other, 'sub', (x, y) => x - y);
  }
  mul(other: Tensor): Tensor {
    return this.elementwise(other, 'mul', (x, y) => x * y);
  }

  scale(k: number): Tensor {
    const out = new Float64Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = this.data[i] * k;
    return new Tensor(this.shape, out);
  }

  normInf(): number {
    let max = 0;
    for (let i = 0; i < this.data.length; i++) {
      const a = Math.abs(this.data[i]);
      if (a > max) max = a;
    }
    return max;
  }

  private static forEachIndex(shape: ReadonlyArray<number>, visit: (idx: number[]) => void): void {
    if (shape.length === 0) {
      visit([]);
      return;
    }
    const idx = new Array<number>(shape.length).fill(0);
    const total = Tensor.sizeOf(shape);
    for (let n = 0; n < total; n++) {
      visit(idx);
      for (let k = shape.length - 1; k >= 0; k--) {
        if (++idx[k] < shape[k]) break;
        idx[k] = 0;
      }
    }
  }

  private static flatIndex(idx: ReadonlyArray<number>, strides: ReadonlyArray<number>): number {
    let f = 0;
    for (let k = 0; k < idx.length; k++) f += idx[k] * strides[k];
    return f;
  }

  reshape(shape: ReadonlyArray<number>): Tensor {
    if (Tensor.sizeOf(shape) !== this.data.length) {
      throw new Error(`Tensor.reshape: size mismatch [${this.shape}] -> [${shape}]`);
    }
    return new Tensor([...shape], this.data.slice());
  }

  transpose(perm?: ReadonlyArray<number>): Tensor {
    const rank = this.shape.length;
    const p = perm ?? Array.from({ length: rank }, (_, i) => rank - 1 - i);
    if (p.length !== rank)
      throw new Error(`Tensor.transpose: perm length ${p.length} != rank ${rank}`);
    const outShape = p.map((axis) => this.shape[axis]);
    const inStrides = Tensor.rowMajorStrides(this.shape);
    const outStrides = Tensor.rowMajorStrides(outShape);
    const out = new Float64Array(this.data.length);
    Tensor.forEachIndex(outShape, (outIdx) => {
      const inIdx = new Array<number>(rank);
      for (let k = 0; k < rank; k++) inIdx[p[k]] = outIdx[k];
      out[Tensor.flatIndex(outIdx, outStrides)] = this.data[Tensor.flatIndex(inIdx, inStrides)];
    });
    return new Tensor(outShape, out);
  }

  matMul(other: Tensor): Tensor {
    if (this.shape.length !== 2 || other.shape.length !== 2) {
      throw new Error(`Tensor.matMul: both operands must be rank-2`);
    }
    const [m, k] = this.shape;
    const [k2, n] = other.shape;
    if (k !== k2) throw new Error(`Tensor.matMul: inner dimension mismatch ${k} != ${k2}`);
    const out = new Float64Array(m * n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let q = 0; q < k; q++) sum += this.data[i * k + q] * other.data[q * n + j];
        out[i * n + j] = sum;
      }
    }
    return new Tensor([m, n], out);
  }

  static einsum(spec: EinsumSpec, ...operands: Tensor[]): Tensor {
    const inStrides = operands.map((o) => Tensor.rowMajorStrides(o.shape));
    const freeSizes = spec.free.map((fa) => operands[fa.operand].shape[fa.axis]);
    const contractSizes = spec.contractions.map((c) => {
      const [[oa, axa], [ob, axb]] = c.pair;
      const sa = operands[oa]?.shape[axa];
      const sb = operands[ob]?.shape[axb];
      if (sa === undefined || sb === undefined || sa !== sb) {
        throw new Error(`Tensor.einsum: contraction pair size mismatch`);
      }
      return sa;
    });
    const outStrides = Tensor.rowMajorStrides(freeSizes);
    const out = new Float64Array(Tensor.sizeOf(freeSizes));
    // Guard (mirrors Float64ReferenceEngine): every rank-≥1 operand axis must
    // be referenced by the spec. Rank-0 operands are allowed and contribute a
    // scalar factor.
    for (let o = 0; o < operands.length; o++) {
      if (operands[o].shape.length === 0) continue;
      const covered = new Set<number>();
      spec.free.forEach((fa) => {
        if (fa.operand === o) covered.add(fa.axis);
      });
      spec.contractions.forEach((c) => {
        const [[oa, axa], [ob, axb]] = c.pair;
        if (oa === o) covered.add(axa);
        if (ob === o) covered.add(axb);
      });
      if (covered.size !== operands[o].shape.length) {
        throw new Error(`Tensor.einsum: operand ${o} has axes not referenced by the spec`);
      }
    }
    const operandFlatIndex = (
      opIndex: number,
      freeVals: ReadonlyArray<number>,
      contractVals: ReadonlyArray<number>
    ): number => {
      const idx = new Array<number>(operands[opIndex].shape.length).fill(0);
      spec.free.forEach((fa, v) => {
        if (fa.operand === opIndex) idx[fa.axis] = freeVals[v];
      });
      spec.contractions.forEach((c, v) => {
        const [[oa, axa], [ob, axb]] = c.pair;
        if (oa === opIndex) idx[axa] = contractVals[v];
        if (ob === opIndex) idx[axb] = contractVals[v];
      });
      return Tensor.flatIndex(idx, inStrides[opIndex]);
    };
    Tensor.forEachIndex(freeSizes, (freeVals) => {
      let acc = 0;
      Tensor.forEachIndex(contractSizes, (contractVals) => {
        let product = 1;
        for (let o = 0; o < operands.length; o++) {
          product *= operands[o].data[operandFlatIndex(o, freeVals, contractVals)];
        }
        acc += product;
      });
      out[Tensor.flatIndex(freeVals, outStrides)] = acc;
    });
    return new Tensor(freeSizes, out);
  }

  // -------------------------------------------------------------------------
  // Named-index API (opt-in via axisLabels)
  // -------------------------------------------------------------------------

  /**
   * Return the axis position (0-based) of a labelled index.
   * Throws if the index is not found in `axisLabels`.
   */
  axisOf(index: Index): number {
    if (this.axisLabels === undefined) {
      throw new Error('Tensor.axisOf: this tensor has no axisLabels');
    }
    const pos = this.axisLabels.findIndex((lbl) => lbl.matches(index));
    if (pos === -1) {
      throw new Error(`Tensor.axisOf: index ${index.toString()} not found in axisLabels`);
    }
    return pos;
  }

  /**
   * Return a new Tensor with the same data and shape but with `oldIndex`
   * swapped for `newIndex` in `axisLabels`.
   * Throws if `oldIndex` is not found.
   */
  replaceIndex(oldIndex: Index, newIndex: Index): Tensor {
    if (this.axisLabels === undefined) {
      throw new Error('Tensor.replaceIndex: this tensor has no axisLabels');
    }
    const pos = this.axisLabels.findIndex((lbl) => lbl.matches(oldIndex));
    if (pos === -1) {
      throw new Error(
        `Tensor.replaceIndex: index ${oldIndex.toString()} not found in axisLabels`
      );
    }
    const newLabels = [...this.axisLabels];
    newLabels[pos] = newIndex;
    return new Tensor([...this.shape], this.data.slice(), newLabels);
  }

  /**
   * Contract this tensor with `other` over every shared index (matched by
   * `Index.matches`). Both operands must carry `axisLabels`.
   *
   * The result tensor carries the non-shared axes from `this` followed by
   * the non-shared axes from `other` as its `axisLabels`.
   *
   * Throws:
   * - If either operand lacks `axisLabels`.
   * - If there are no shared indices (use `einsum` or an explicit outer product).
   * - If a shared index has mismatched dimensions on the two operands.
   */
  contract(other: Tensor): Tensor {
    if (this.axisLabels === undefined || other.axisLabels === undefined) {
      throw new Error('Tensor.contract requires axisLabels on both operands');
    }

    // Identify shared indices (matched by id + primeLevel).
    const sharedPairs: Array<{ selfAxis: number; otherAxis: number }> = [];
    for (let si = 0; si < this.axisLabels.length; si++) {
      for (let oi = 0; oi < other.axisLabels.length; oi++) {
        if (this.axisLabels[si].matches(other.axisLabels[oi])) {
          sharedPairs.push({ selfAxis: si, otherAxis: oi });
          break; // each self-axis can match at most one other-axis
        }
      }
    }

    if (sharedPairs.length === 0) {
      throw new Error(
        'Tensor.contract: no shared indices to contract; use einsum or an explicit outer product'
      );
    }

    // Validate dimension agreement on shared axes.
    for (const { selfAxis, otherAxis } of sharedPairs) {
      const dSelf = this.shape[selfAxis];
      const dOther = other.shape[otherAxis];
      if (dSelf !== dOther) {
        throw new Error(
          `Tensor.contract: shared index ${this.axisLabels[selfAxis].toString()} ` +
            `has dimension ${dSelf} on 'this' but ${dOther} on 'other'`
        );
      }
    }

    // Build an EinsumSpec by assigning a letter to every distinct axis across
    // both operands.  We use a simple running counter mapped to lower-case
    // letters (a-z then aa-az etc. — in practice tensors rarely exceed 26 axes).
    const sharedSelfAxes = new Set(sharedPairs.map((p) => p.selfAxis));
    const sharedOtherAxes = new Set(sharedPairs.map((p) => p.otherAxis));

    // Map (operand index, axis) → integer letter index.
    let letterCount = 0;
    const selfLetters = new Array<number>(this.shape.length).fill(-1);
    const otherLetters = new Array<number>(other.shape.length).fill(-1);

    // Assign letters to shared axes first so both sides share the same letter.
    for (const { selfAxis, otherAxis } of sharedPairs) {
      const letter = letterCount++;
      selfLetters[selfAxis] = letter;
      otherLetters[otherAxis] = letter;
    }

    // Assign letters to free axes.
    for (let si = 0; si < this.shape.length; si++) {
      if (!sharedSelfAxes.has(si)) {
        selfLetters[si] = letterCount++;
      }
    }
    for (let oi = 0; oi < other.shape.length; oi++) {
      if (!sharedOtherAxes.has(oi)) {
        otherLetters[oi] = letterCount++;
      }
    }

    // Build the EinsumSpec.
    const contractions: EinsumSpec['contractions'][number][] = sharedPairs.map(
      ({ selfAxis, otherAxis }) => ({
        pair: [
          [0, selfAxis],
          [1, otherAxis],
        ] as const,
      })
    );

    const free: EinsumSpec['free'][number][] = [];
    for (let si = 0; si < this.shape.length; si++) {
      if (!sharedSelfAxes.has(si)) {
        free.push({ operand: 0, axis: si });
      }
    }
    for (let oi = 0; oi < other.shape.length; oi++) {
      if (!sharedOtherAxes.has(oi)) {
        free.push({ operand: 1, axis: oi });
      }
    }

    const spec: EinsumSpec = { contractions, free };
    const result = Tensor.einsum(spec, this, other);

    // Build axisLabels for the result: non-shared from this, then from other.
    const resultLabels: Index[] = [];
    for (let si = 0; si < this.axisLabels.length; si++) {
      if (!sharedSelfAxes.has(si)) {
        resultLabels.push(this.axisLabels[si]);
      }
    }
    for (let oi = 0; oi < other.axisLabels.length; oi++) {
      if (!sharedOtherAxes.has(oi)) {
        resultLabels.push(other.axisLabels[oi]);
      }
    }

    return new Tensor([...result.shape], result.data, resultLabels);
  }
}
