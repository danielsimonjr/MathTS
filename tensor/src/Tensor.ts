/**
 * Tensor — rank-N, Float64Array-backed, row-major dense tensor. The
 * compute primitive behind @danielsimonjr/mathts-tensor. Construction,
 * elementwise, einsum, matMul, transpose, reshape live here.
 *
 * Element-wise and data-movement ops are straightforward O(n) loops (a
 * correctness baseline). Heavy ops delegate to the standard packages rather
 * than reinventing them: `matMul` uses matrix's backend-selected multiply
 * (SIMD-WASM for large inputs), and the decompositions (in `operations/`)
 * route through matrix's `svd`/`eig`/`lu`/`qr`/`cholesky`. Storage mirrors
 * DenseMatrix (Float64Array, row-major), generalised to arbitrary rank.
 */

import { rowMajorStrides } from '@danielsimonjr/mathts-core';
import { DenseMatrix, backendManager } from '@danielsimonjr/mathts-matrix';
import {
  arraySize,
  validate,
  type NestedArray as CoreNestedArray,
} from '@danielsimonjr/mathts-core/internal';
import { Index } from './named-index.js';

/**
 * Consolidated onto `@danielsimonjr/mathts-core`'s generic `NestedArray<T>`,
 * specialised to `number` (Tensor is Float64Array-backed) — see
 * docs/Architecture/duplicate-symbols.json.
 */
export type NestedArray = CoreNestedArray<number>;

/**
 * Describes an einsum contraction for `Tensor.einsum`: contracted axis pairs and output (free) axes.
 * Each contraction pair names two operand axes that must have the same size, or `einsum` throws.
 * Every axis of an operand with rank >= 1 must occur in the spec, or `einsum` throws.
 */
export interface EinsumSpec {
  readonly contractions: ReadonlyArray<{
    readonly pair: readonly [readonly [number, number], readonly [number, number]];
  }>;
  readonly free: ReadonlyArray<{ readonly operand: number; readonly axis: number }>;
}

/**
 * Dense N-dimensional array of float64 values in row-major (C) order.
 * The constructor keeps a reference to `data` and does not copy it.
 * The constructor throws when `data.length` is not the product of `shape`,
 * or when `axisLabels` is given and its length is not the rank.
 */
export class Tensor {
  readonly shape: ReadonlyArray<number>;
  readonly data: Float64Array;
  /** Optional per-axis Index labels. When set, enables `contract`, `replaceIndex`, `axisOf`. */
  readonly axisLabels?: ReadonlyArray<Index>;

  constructor(shape: ReadonlyArray<number>, data: Float64Array, axisLabels?: ReadonlyArray<Index>) {
    if (!(data instanceof Float64Array)) {
      throw new TypeError('Tensor: data must be a Float64Array');
    }
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

  /** Row-major stride vector; forwards to `rowMajorStrides` in `@danielsimonjr/mathts-core`. */
  static rowMajorStrides(shape: ReadonlyArray<number>): number[] {
    return rowMajorStrides(shape);
  }

  static fromNested(data: NestedArray): Tensor;
  static fromNested(data: NestedArray, shape: ReadonlyArray<number>): Tensor;
  static fromNested(data: NestedArray, shape?: ReadonlyArray<number>): Tensor {
    const resolvedShape: number[] =
      shape !== undefined
        ? [...shape]
        : typeof data === 'number'
          ? []
          : (() => {
              const inferred = arraySize(data);
              try {
                validate(data, inferred);
              } catch (err) {
                const detail = err instanceof Error ? err.message : 'jagged nested array';
                throw new TypeError(`Tensor.fromNested: ${detail}`);
              }
              return inferred;
            })();

    const size = Tensor.sizeOf(resolvedShape);
    const out = new Float64Array(size);
    let cursor = 0;
    const walk = (node: NestedArray, depth: number): void => {
      if (depth === resolvedShape.length) {
        if (typeof node !== 'number') {
          throw new Error(`Tensor.fromNested: expected a number at depth ${depth}`);
        }
        out[cursor++] = node;
        return;
      }
      if (!Array.isArray(node) || node.length !== resolvedShape[depth]) {
        throw new Error(`Tensor.fromNested: shape mismatch at depth ${depth}`);
      }
      for (const child of node) walk(child, depth + 1);
    };
    walk(data, 0);
    if (cursor !== size) throw new Error(`Tensor.fromNested: filled ${cursor} of ${size}`);
    return new Tensor(resolvedShape, out);
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
    return new Tensor([m.rows, m.cols], m.toFloat64Array());
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
    return new DenseMatrix(this.shape[0], this.shape[1], this.data.slice());
  }

  private sameShape(other: Tensor): boolean {
    return (
      this.shape.length === other.shape.length && this.shape.every((v, i) => v === other.shape[i])
    );
  }

  add(other: Tensor | number): Tensor {
    const a = this.data;
    if (typeof other === 'number') {
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] + other;
      return new Tensor(this.shape, out, this.axisLabels);
    }
    if (this.sameShape(other)) {
      const b = other.data;
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
      return new Tensor(this.shape, out, this.axisLabels);
    }
    return Tensor.broadcastOp(this, other, 'add', (x, y) => x + y);
  }
  sub(other: Tensor | number): Tensor {
    const a = this.data;
    if (typeof other === 'number') {
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] - other;
      return new Tensor(this.shape, out, this.axisLabels);
    }
    if (this.sameShape(other)) {
      const b = other.data;
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
      return new Tensor(this.shape, out, this.axisLabels);
    }
    return Tensor.broadcastOp(this, other, 'sub', (x, y) => x - y);
  }
  mul(other: Tensor | number): Tensor {
    if (typeof other === 'number') {
      return this.scale(other);
    }
    const a = this.data;
    if (this.sameShape(other)) {
      const b = other.data;
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] * b[i];
      return new Tensor(this.shape, out, this.axisLabels);
    }
    return Tensor.broadcastOp(this, other, 'mul', (x, y) => x * y);
  }
  /** Element-wise division; broadcasts like `mul`. Division by zero follows IEEE-754. */
  div(other: Tensor | number): Tensor {
    const a = this.data;
    if (typeof other === 'number') {
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] / other;
      return new Tensor(this.shape, out, this.axisLabels);
    }
    if (this.sameShape(other)) {
      const b = other.data;
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] / b[i];
      return new Tensor(this.shape, out, this.axisLabels);
    }
    return Tensor.broadcastOp(this, other, 'div', (x, y) => x / y);
  }

  /** Element-wise negation. */
  neg(): Tensor {
    const a = this.data;
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = -a[i];
    return new Tensor(this.shape, out, this.axisLabels);
  }

  /** Apply `f` to every element, returning a new tensor of the same shape (labels preserved). */
  map(f: (x: number, index: number) => number): Tensor {
    const a = this.data;
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = f(a[i], i);
    return new Tensor(this.shape, out, this.axisLabels);
  }

  /** Deep copy: independent data buffer; shape and axisLabels are carried over. */
  clone(): Tensor {
    return new Tensor([...this.shape], this.data.slice(), this.axisLabels);
  }

  scale(k: number): Tensor {
    const a = this.data;
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] * k;
    return new Tensor(this.shape, out, this.axisLabels);
  }

  normInf(): number {
    let max = 0;
    for (let i = 0; i < this.data.length; i++) {
      const a = Math.abs(this.data[i]);
      if (a > max) max = a;
    }
    return max;
  }

  // -------------------------------------------------------------------------
  // Broadcasting support
  // -------------------------------------------------------------------------

  /**
   * Compute the broadcast output shape of two shapes following NumPy rules:
   * right-align the two shapes; a dimension of 1 broadcasts against any size;
   * missing leading axes are treated as length-1.
   * Throws with message including both shape arrays on incompatibility.
   */
  static broadcastShape(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number[] {
    const rank = Math.max(a.length, b.length);
    const out = new Array<number>(rank);
    for (let i = 0; i < rank; i++) {
      // right-align: index from right
      const ai = a.length - rank + i;
      const bi = b.length - rank + i;
      const da = ai >= 0 ? a[ai] : 1;
      const db = bi >= 0 ? b[bi] : 1;
      if (da === db) {
        out[i] = da;
      } else if (da === 1) {
        out[i] = db;
      } else if (db === 1) {
        out[i] = da;
      } else {
        throw new Error(
          `shapes [${a}] and [${b}] cannot be broadcast: ` +
            `dimension mismatch ${da} vs ${db} at axis ${i} of the aligned shape`
        );
      }
    }
    return out;
  }

  /**
   * Apply a binary elementwise op with NumPy-style broadcasting.
   * Both tensors are read via virtual broadcast indices — no data is copied
   * until the output is written.
   */
  private static broadcastOp(
    a: Tensor,
    b: Tensor,
    _opName: string,
    f: (x: number, y: number) => number
  ): Tensor {
    const outShape = Tensor.broadcastShape(a.shape, b.shape);
    const rank = outShape.length;
    const outSize = Tensor.sizeOf(outShape);
    const aStrides = Tensor.rowMajorStrides(a.shape);
    const bStrides = Tensor.rowMajorStrides(b.shape);

    // Effective strides for broadcasting: if the dimension in the original
    // shape is 1 (or the rank is shorter), the stride becomes 0 so repeated
    // index accesses return the same element.
    const aRankOffset = rank - a.shape.length;
    const bRankOffset = rank - b.shape.length;
    const aEffStrides = new Array<number>(rank).fill(0);
    const bEffStrides = new Array<number>(rank).fill(0);
    for (let i = 0; i < rank; i++) {
      const ai = i - aRankOffset;
      if (ai >= 0 && a.shape[ai] !== 1) {
        aEffStrides[i] = aStrides[ai];
      }
      const bi = i - bRankOffset;
      if (bi >= 0 && b.shape[bi] !== 1) {
        bEffStrides[i] = bStrides[bi];
      }
    }

    const out = new Float64Array(outSize);
    const coords = new Array<number>(rank).fill(0);
    for (let n = 0; n < outSize; n++) {
      // compute flat indices for a and b from broadcast coords
      let aFlat = 0;
      let bFlat = 0;
      for (let k = 0; k < rank; k++) {
        aFlat += coords[k] * aEffStrides[k];
        bFlat += coords[k] * bEffStrides[k];
      }
      out[n] = f(a.data[aFlat], b.data[bFlat]);
      // increment coords (row-major)
      for (let k = rank - 1; k >= 0; k--) {
        if (++coords[k] < outShape[k]) break;
        coords[k] = 0;
      }
    }
    return new Tensor(outShape, out);
  }

  // -------------------------------------------------------------------------
  // Reduction helpers
  // -------------------------------------------------------------------------

  /**
   * Generic strided reduction over a set of axes.
   *
   * `init` is the neutral element; `combine` folds one new value into the
   * accumulator; `finalise` (optional) post-processes the accumulator once
   * all elements have been visited.
   */
  private reduceAxes(
    axes: number[],
    keepDims: boolean,
    init: number,
    combine: (acc: number, val: number) => number,
    finalise?: (acc: number, count: number) => number
  ): Tensor {
    const rank = this.shape.length;
    const axisSet = new Set(axes);

    // Validate axes
    for (const ax of axes) {
      if (!Number.isInteger(ax) || ax < 0 || ax >= rank) {
        throw new Error(`Tensor.reduce: axis ${ax} out of range for rank-${rank} tensor`);
      }
    }
    if (axisSet.size !== axes.length) {
      throw new Error(`Tensor.reduce: duplicate axes in [${axes}]`);
    }

    // Build output shape
    const outShape: number[] = [];
    for (let k = 0; k < rank; k++) {
      if (axisSet.has(k)) {
        if (keepDims) outShape.push(1);
        // else omit this axis
      } else {
        outShape.push(this.shape[k]);
      }
    }

    // How many elements are in the reduced axes?
    const reduceCount = axes.reduce((prod, ax) => prod * this.shape[ax], 1);

    const outSize = Tensor.sizeOf(outShape);
    const out = new Float64Array(outSize).fill(init);
    const outStrides = Tensor.rowMajorStrides(outShape.length > 0 ? outShape : [1]);

    // Per-input-axis contribution to the output offset (0 for reduced axes),
    // computed once; the odometer below then tracks outFlat incrementally.
    const contrib = new Array<number>(rank).fill(0);
    {
      let outDim = 0;
      for (let k = 0; k < rank; k++) {
        if (axisSet.has(k)) {
          if (keepDims) outDim++;
        } else {
          contrib[k] = outStrides[outDim];
          outDim++;
        }
      }
    }

    // Iterate over all input elements (row-major odometer)
    const inCoords = new Array<number>(rank).fill(0);
    const inSize = this.data.length;
    const data = this.data;
    let outFlat = 0;
    for (let n = 0; n < inSize; n++) {
      out[outFlat] = combine(out[outFlat], data[n]);
      for (let k = rank - 1; k >= 0; k--) {
        if (++inCoords[k] < this.shape[k]) {
          outFlat += contrib[k];
          break;
        }
        outFlat -= contrib[k] * (this.shape[k] - 1);
        inCoords[k] = 0;
      }
    }

    if (finalise !== undefined) {
      for (let i = 0; i < out.length; i++) {
        out[i] = finalise(out[i], reduceCount);
      }
    }

    // Propagate axisLabels: keep labels for surviving axes only.
    // With keepDims=true the reduced axes become length-1 slots in outShape,
    // but we have no label for those slots — so we drop axisLabels entirely
    // when keepDims is true (the count would not match the output rank).
    // Without keepDims: carry the surviving labels iff there are any.
    let resultLabels: ReadonlyArray<Index> | undefined;
    if (!keepDims && this.axisLabels !== undefined) {
      const surviving: Index[] = [];
      for (let k = 0; k < rank; k++) {
        if (!axisSet.has(k)) {
          surviving.push(this.axisLabels[k]);
        }
      }
      // Only attach labels when they cover all surviving axes (all non-reduced axes
      // had labels) — i.e. surviving.length === outShape.length.
      if (surviving.length === outShape.length) {
        resultLabels = surviving;
      }
    }

    return new Tensor(outShape, out, resultLabels);
  }

  // -------------------------------------------------------------------------
  // Public reductions
  // -------------------------------------------------------------------------

  /**
   * Sum elements along the given axis/axes (or all axes if omitted).
   * `keepDims: true` preserves reduced axes as length-1.
   */
  sum(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor {
    const axes = this.resolveAxes(axis);
    const keepDims = opts?.keepDims ?? false;
    return this.reduceAxes(axes, keepDims, 0, (acc, v) => acc + v);
  }

  /**
   * Arithmetic mean along the given axis/axes (or all axes if omitted).
   */
  mean(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor {
    const axes = this.resolveAxes(axis);
    const keepDims = opts?.keepDims ?? false;
    return this.reduceAxes(
      axes,
      keepDims,
      0,
      (acc, v) => acc + v,
      (acc, count) => acc / count
    );
  }

  /**
   * Element-wise maximum along the given axis/axes (or all axes if omitted).
   * NaN propagates (matches NumPy default behaviour).
   */
  max(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor {
    return this.extremum(axis, opts, -Infinity, Math.max);
  }

  /**
   * Element-wise minimum along the given axis/axes (or all axes if omitted).
   * NaN propagates (matches NumPy default behaviour).
   */
  min(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor {
    return this.extremum(axis, opts, Infinity, Math.min);
  }

  /**
   * Shared max/min reduction: NaN in the window wins; NaN accumulator is kept.
   * `pick` is monomorphic within one call (`Math.max` or `Math.min`).
   */
  private extremum(
    axis: number | ReadonlyArray<number> | undefined,
    opts: { keepDims?: boolean } | undefined,
    init: number,
    pick: (a: number, b: number) => number
  ): Tensor {
    const axes = this.resolveAxes(axis);
    const keepDims = opts?.keepDims ?? false;
    return this.reduceAxes(axes, keepDims, init, (acc, v) =>
      isNaN(v) ? v : isNaN(acc) ? acc : pick(acc, v)
    );
  }

  /**
   * Product of elements along the given axis/axes (or all axes if omitted).
   */
  prod(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor {
    const axes = this.resolveAxes(axis);
    const keepDims = opts?.keepDims ?? false;
    return this.reduceAxes(axes, keepDims, 1, (acc, v) => acc * v);
  }

  /**
   * p-norm of the tensor.
   *
   * - `p = 2` (default): Euclidean / Frobenius norm — `sqrt(sum x_i^2)`.
   * - `p = 'fro'`: alias for p=2 (Frobenius).
   * - `p = 'inf'`: max of absolute values.
   * - `p = '-inf'`: min of absolute values.
   * - numeric p: `(sum |x_i|^p)^(1/p)`.
   *
   * When `axis` is given, the norm is computed along that single axis and the
   * result has rank reduced by 1 (or stays the same with `keepDims`).
   * When `axis` is omitted, the norm is computed over all elements.
   */
  norm(opts?: { p?: number | 'inf' | '-inf' | 'fro'; axis?: number; keepDims?: boolean }): Tensor {
    const p = opts?.p ?? 2;
    const keepDims = opts?.keepDims ?? false;
    const axes = opts?.axis !== undefined ? [opts.axis] : this.resolveAxes(undefined);

    if (p === 'fro' || p === 2) {
      const sqSum = this.reduceAxes(axes, keepDims, 0, (acc, v) => acc + v * v);
      const sqrtData = new Float64Array(sqSum.data.length);
      for (let i = 0; i < sqSum.data.length; i++) sqrtData[i] = Math.sqrt(sqSum.data[i]);
      return new Tensor(sqSum.shape, sqrtData, sqSum.axisLabels);
    }
    if (p === 'inf') {
      return this.reduceAxes(axes, keepDims, 0, (acc, v) => Math.max(acc, Math.abs(v)));
    }
    if (p === '-inf') {
      return this.reduceAxes(axes, keepDims, Infinity, (acc, v) => Math.min(acc, Math.abs(v)));
    }
    // General numeric p: (sum |x|^p)^(1/p)
    const pNum = p as number;
    const powSum = this.reduceAxes(
      axes,
      keepDims,
      0,
      (acc, v) => acc + Math.pow(Math.abs(v), pNum)
    );
    const invP = 1 / pNum;
    const result = new Float64Array(powSum.data.length);
    for (let i = 0; i < powSum.data.length; i++) result[i] = Math.pow(powSum.data[i], invP);
    return new Tensor(powSum.shape, result, powSum.axisLabels);
  }

  /**
   * Generalised dot product (NumPy `tensordot`) over explicitly specified axis pairs.
   *
   * `axes[i] = [a, b]` contracts axis `a` of `this` with axis `b` of `other`.
   * The result shape is `this`'s non-contracted axes followed by `other`'s
   * non-contracted axes (NumPy convention).
   *
   * Delegates to `Tensor.einsum` under the hood.
   */
  tensordot(other: Tensor, axes: ReadonlyArray<readonly [number, number]>): Tensor {
    const selfRank = this.shape.length;
    const otherRank = other.shape.length;

    // Validate axes
    const selfContracted = new Set<number>();
    const otherContracted = new Set<number>();
    for (const [a, b] of axes) {
      if (!Number.isInteger(a) || a < 0 || a >= selfRank) {
        throw new Error(`Tensor.tensordot: axis ${a} of 'this' (rank ${selfRank}) is out of range`);
      }
      if (!Number.isInteger(b) || b < 0 || b >= otherRank) {
        throw new Error(
          `Tensor.tensordot: axis ${b} of 'other' (rank ${otherRank}) is out of range`
        );
      }
      if (selfContracted.has(a)) {
        throw new Error(`Tensor.tensordot: duplicate axis ${a} in self contraction list`);
      }
      if (otherContracted.has(b)) {
        throw new Error(`Tensor.tensordot: duplicate axis ${b} in other contraction list`);
      }
      if (this.shape[a] !== other.shape[b]) {
        throw new Error(
          `Tensor.tensordot: dimension mismatch on contracted axes: ` +
            `this.shape[${a}]=${this.shape[a]} vs other.shape[${b}]=${other.shape[b]}`
        );
      }
      selfContracted.add(a);
      otherContracted.add(b);
    }

    // Build EinsumSpec
    // contracted axes: pair [0, selfAxis] with [1, otherAxis]
    const contractions: EinsumSpec['contractions'][number][] = axes.map(([a, b]) => ({
      pair: [
        [0, a],
        [1, b],
      ] as const,
    }));

    // free axes: non-contracted self axes first, then non-contracted other axes
    const free: EinsumSpec['free'][number][] = [];
    for (let si = 0; si < selfRank; si++) {
      if (!selfContracted.has(si)) {
        free.push({ operand: 0, axis: si });
      }
    }
    for (let oi = 0; oi < otherRank; oi++) {
      if (!otherContracted.has(oi)) {
        free.push({ operand: 1, axis: oi });
      }
    }

    const spec: EinsumSpec = { contractions, free };
    const result = Tensor.einsum(spec, this, other);

    // Propagate axisLabels: surviving self axes then surviving other axes
    let resultLabels: Index[] | undefined;
    if (this.axisLabels !== undefined || other.axisLabels !== undefined) {
      if (this.axisLabels !== undefined && other.axisLabels !== undefined) {
        resultLabels = [];
        for (let si = 0; si < selfRank; si++) {
          if (!selfContracted.has(si)) {
            resultLabels.push(this.axisLabels[si]);
          }
        }
        for (let oi = 0; oi < otherRank; oi++) {
          if (!otherContracted.has(oi)) {
            resultLabels.push(other.axisLabels[oi]);
          }
        }
      }
    }

    return new Tensor([...result.shape], result.data, resultLabels);
  }

  /**
   * Normalise an `axis` argument into a sorted list of axis indices.
   * `undefined` ⇒ all axes (reduce everything to a rank-0 scalar).
   */
  private resolveAxes(axis: number | ReadonlyArray<number> | undefined): number[] {
    if (axis === undefined) {
      return Array.from({ length: this.shape.length }, (_, i) => i);
    }
    if (typeof axis === 'number') {
      return [axis];
    }
    return [...axis];
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
    const seen = new Array<boolean>(rank).fill(false);
    for (const axis of p) {
      if (!Number.isInteger(axis) || axis < 0 || axis >= rank) {
        throw new Error(`Tensor.transpose: perm axis ${axis} out of range for rank-${rank} tensor`);
      }
      if (seen[axis]) {
        throw new Error(
          `Tensor.transpose: perm [${p}] is not a permutation (repeated axis ${axis})`
        );
      }
      seen[axis] = true;
    }
    const outShape = p.map((axis) => this.shape[axis]);
    const inStrides = Tensor.rowMajorStrides(this.shape);
    // Input stride seen when stepping along each output axis.
    const permStrides = p.map((axis) => inStrides[axis]);
    const src = this.data;
    const total = src.length;
    const out = new Float64Array(total);
    const coords = new Array<number>(rank).fill(0);
    let inOff = 0;
    for (let n = 0; n < total; n++) {
      out[n] = src[inOff];
      for (let k = rank - 1; k >= 0; k--) {
        if (++coords[k] < outShape[k]) {
          inOff += permStrides[k];
          break;
        }
        inOff -= permStrides[k] * (outShape[k] - 1);
        coords[k] = 0;
      }
    }
    return new Tensor(outShape, out);
  }

  matMul(other: Tensor): Tensor {
    if (this.shape.length !== 2 || other.shape.length !== 2) {
      throw new Error(`Tensor.matMul: both operands must be rank-2`);
    }
    const [m, k] = this.shape;
    const [k2, n] = other.shape;
    if (k !== k2) throw new Error(`Tensor.matMul: inner dimension mismatch ${k} != ${k2}`);
    // Dogfood matrix's backend-selected matmul instead of a local triple loop: WASM
    // (SIMD f64x2, ~4.7x at 512²) once `wasmBackend.initialize()` has run, else matrix's
    // cache-friendly JS ikj — both faster than the old naive ijk. DenseMatrix wraps our
    // Float64Array without copying (matmul reads only). See tools/benchmarks/matmul-wasm.mjs.
    const c = backendManager.multiply(
      new DenseMatrix(m, k, this.data),
      new DenseMatrix(k, n, other.data)
    );
    return new Tensor([m, n], c.toFloat64Array());
  }

  static einsum(spec: EinsumSpec, ...operands: Tensor[]): Tensor {
    const nOps = operands.length;
    const seenRefs = new Set<string>();
    const checkRef = (what: string, operand: number, axis: number): void => {
      if (!Number.isInteger(operand) || operand < 0 || operand >= nOps) {
        throw new Error(
          `Tensor.einsum: ${what} references operand ${operand}, but only ${nOps} operand(s) were given`
        );
      }
      const rank = operands[operand].shape.length;
      if (!Number.isInteger(axis) || axis < 0 || axis >= rank) {
        throw new Error(
          `Tensor.einsum: ${what} references axis ${axis} of operand ${operand}, which has rank ${rank}`
        );
      }
      const ref = operand + ':' + axis;
      if (seenRefs.has(ref)) {
        throw new Error(
          `Tensor.einsum: ${what} references axis ${axis} of operand ${operand} a second time; each operand axis may appear once`
        );
      }
      seenRefs.add(ref);
    };
    spec.free.forEach((fa, v) => checkRef(`free[${v}]`, fa.operand, fa.axis));
    spec.contractions.forEach((c, v) => {
      checkRef(`contractions[${v}] (first)`, c.pair[0][0], c.pair[0][1]);
      checkRef(`contractions[${v}] (second)`, c.pair[1][0], c.pair[1][1]);
    });

    const inStrides = operands.map((o) => Tensor.rowMajorStrides(o.shape));
    const freeSizes = spec.free.map((fa) => operands[fa.operand].shape[fa.axis]);
    const contractSizes = spec.contractions.map((c) => {
      const [[oa, axa], [ob, axb]] = c.pair;
      const sa = operands[oa].shape[axa];
      const sb = operands[ob].shape[axb];
      if (sa !== sb) {
        throw new Error(`Tensor.einsum: contraction pair size mismatch`);
      }
      return sa;
    });
    const out = new Float64Array(Tensor.sizeOf(freeSizes));
    // Guard (mirrors Float64ReferenceEngine): every rank-≥1 operand axis must
    // be referenced by the spec. Rank-0 operands are allowed and contribute a
    // scalar factor.
    for (let o = 0; o < nOps; o++) {
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

    // Per-operand offset contribution of one step along each free / contracted
    // variable, computed once so the loops below advance offsets incrementally.
    const nFree = freeSizes.length;
    const nCon = contractSizes.length;
    const freeContrib: number[][] = operands.map(() => new Array<number>(nFree).fill(0));
    const conContrib: number[][] = operands.map(() => new Array<number>(nCon).fill(0));
    spec.free.forEach((fa, v) => {
      freeContrib[fa.operand][v] += inStrides[fa.operand][fa.axis];
    });
    spec.contractions.forEach((c, v) => {
      const [[oa, axa], [ob, axb]] = c.pair;
      conContrib[oa][v] += inStrides[oa][axa];
      conContrib[ob][v] += inStrides[ob][axb];
    });

    const outSize = out.length;
    const conSize = Tensor.sizeOf(contractSizes);
    const datas = operands.map((o) => o.data);
    const base = new Array<number>(nOps).fill(0);
    const cur = new Array<number>(nOps).fill(0);
    const freeCoords = new Array<number>(nFree).fill(0);
    const conCoords = new Array<number>(nCon).fill(0);

    for (let outN = 0; outN < outSize; outN++) {
      for (let o = 0; o < nOps; o++) cur[o] = base[o];
      conCoords.fill(0);
      let acc = 0;
      for (let cn = 0; cn < conSize; cn++) {
        let product = 1;
        for (let o = 0; o < nOps; o++) product *= datas[o][cur[o]];
        acc += product;
        for (let k = nCon - 1; k >= 0; k--) {
          if (++conCoords[k] < contractSizes[k]) {
            for (let o = 0; o < nOps; o++) cur[o] += conContrib[o][k];
            break;
          }
          for (let o = 0; o < nOps; o++) cur[o] -= conContrib[o][k] * (contractSizes[k] - 1);
          conCoords[k] = 0;
        }
      }
      out[outN] = acc;
      for (let k = nFree - 1; k >= 0; k--) {
        if (++freeCoords[k] < freeSizes[k]) {
          for (let o = 0; o < nOps; o++) base[o] += freeContrib[o][k];
          break;
        }
        for (let o = 0; o < nOps; o++) base[o] -= freeContrib[o][k] * (freeSizes[k] - 1);
        freeCoords[k] = 0;
      }
    }
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
    return this.axisPosition(index, 'axisOf');
  }

  /**
   * Return a new Tensor with the same data and shape but with `oldIndex`
   * swapped for `newIndex` in `axisLabels`.
   * Throws if `oldIndex` is not found.
   */
  replaceIndex(oldIndex: Index, newIndex: Index): Tensor {
    const pos = this.axisPosition(oldIndex, 'replaceIndex');
    const newLabels = [...this.axisLabels!];
    newLabels[pos] = newIndex;
    return new Tensor([...this.shape], this.data.slice(), newLabels);
  }

  /**
   * Resolve a labelled index to its axis position; error prefix matches the caller.
   */
  private axisPosition(index: Index, op: 'axisOf' | 'replaceIndex'): number {
    if (this.axisLabels === undefined) {
      throw new Error(`Tensor.${op}: this tensor has no axisLabels`);
    }
    const pos = this.axisLabels.findIndex((lbl) => lbl.matches(index));
    if (pos === -1) {
      throw new Error(`Tensor.${op}: index ${index.toString()} not found in axisLabels`);
    }
    return pos;
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
