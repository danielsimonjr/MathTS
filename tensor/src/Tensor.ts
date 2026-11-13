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
import { resolveReshapeShape } from './reshape-shape.js';
import { slice as sliceTensor, type SliceRange } from './operations/slice.js';

/** Optional row-major view metadata (default: offset 0, C-contiguous strides). */
export interface TensorStorage {
  readonly offset?: number;
  readonly strides?: ReadonlyArray<number>;
}

/** Storage dtype tag for {@link Tensor}; always `'float64'` today (#760). */
export type TensorDtype = 'float64';

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

const TAPED_OPS: ReadonlySet<string> = new Set([
  'add',
  'sub',
  'mul',
  'matmul',
  'contract',
  'tensordot',
]);
const DUAL_OPS: ReadonlySet<string> = new Set(['add', 'sub', 'mul']);

function autogradHint(kind: 'TapedTensor' | 'DualTensor', op: string, ops: ReadonlySet<string>) {
  const name = op.replace(/_$/, '');
  const factory =
    kind === 'TapedTensor'
      ? 'TapedTensor.fromTensorAsInput(tensor, tape)'
      : 'DualTensor.fromTensor(tensor)';
  return ops.has(name)
    ? `Wrap this Tensor with ${factory} and call ${kind}.${name}.`
    : `${kind} has no ${name} op; compose it from ${[...ops].join(', ')}.`;
}

/**
 * Checks a binary-op operand. A `Tensor` passes through. An autograd value
 * (`TapedTensor`, `DualTensor`) throws a `TypeError`: a plain `Tensor` op would
 * return a tensor with no gradient or tangent and drop the derivative silently.
 */
function asTensorOperand(op: string, other: unknown): Tensor {
  if (other instanceof Tensor) return other;
  if (typeof other === 'object' && other !== null) {
    if ('tape' in other) {
      throw new TypeError(
        `Tensor.${op}: operand is a TapedTensor, so a plain Tensor op would drop its gradient. ` +
          autogradHint('TapedTensor', op, TAPED_OPS)
      );
    }
    if ('tangent' in other) {
      throw new TypeError(
        `Tensor.${op}: operand is a DualTensor, so a plain Tensor op would drop its tangent. ` +
          autogradHint('DualTensor', op, DUAL_OPS)
      );
    }
  }
  throw new TypeError(`Tensor.${op}: operand must be a Tensor`);
}

/**
 * Dense N-dimensional array of float64 values in row-major (C) order.
 * A `Float64Array` is stored by reference: the constructor does not copy it.
 * A `Float32Array` is copied into a new `Float64Array`; each value widens
 * exactly, so the tensor never aliases the source. Any other type, such as an
 * `Int32Array`, a plain array or an array-like, throws
 * `TypeError: data must be a Float64Array`. The constructor throws when
 * `data.length` is not the product of `shape`, or when `axisLabels` is given
 * and its length is not the rank.
 *
 * A view (`slice` with a step, an offset or a negative step) shares the `buffer`
 * of its parent. `data` always returns the logical values; `buffer`, `offset`
 * and `strides` describe the raw storage.
 */
export class Tensor {
  readonly shape: ReadonlyArray<number>;
  /**
   * Raw backing storage, shared with the parent tensor for a view. Index it with
   * `offset` and `strides`. Use {@link Tensor.data} for the logical values.
   */
  readonly buffer: Float64Array;
  /** Byte offset in elements from the start of `buffer` for the logical index [0,…,0]. */
  readonly offset: number;
  /** Per-axis strides in elements (defaults to row-major when omitted at construction). */
  readonly strides: number[];
  /** Optional per-axis Index labels. When set, enables `contract`, `replaceIndex`, `axisOf`. */
  readonly axisLabels?: ReadonlyArray<Index>;
  private readonly contiguousFlag: boolean;

  constructor(
    shape: ReadonlyArray<number>,
    data: Float64Array | Float32Array,
    axisLabels?: ReadonlyArray<Index>,
    storage?: TensorStorage
  ) {
    if (data instanceof Float32Array) {
      data = Float64Array.from(data);
    }
    if (!(data instanceof Float64Array)) {
      throw new TypeError('Tensor: data must be a Float64Array');
    }
    const size = Tensor.sizeOf(shape);
    const offset = storage?.offset ?? 0;
    const strides =
      storage?.strides !== undefined ? [...storage.strides] : Tensor.rowMajorStrides(shape);
    if (strides.length !== shape.length) {
      throw new Error(
        `Tensor: strides length ${strides.length} does not match rank ${shape.length}`
      );
    }
    if (storage?.strides === undefined && offset === 0) {
      if (data.length !== size) {
        throw new Error(
          `Tensor: data length ${data.length} does not match shape [${shape}] (size ${size})`
        );
      }
    } else {
      Tensor.validateStorageBounds(shape, data.length, offset, strides);
    }
    if (axisLabels !== undefined && axisLabels.length !== shape.length) {
      throw new Error(
        `Tensor: axisLabels length ${axisLabels.length} does not match rank ${shape.length}`
      );
    }
    this.shape = shape;
    this.buffer = data;
    this.offset = offset;
    this.strides = strides;
    const want = Tensor.rowMajorStrides(shape);
    this.contiguousFlag =
      offset === 0 &&
      strides.length === want.length &&
      strides.every((st, i) => st === want[i]) &&
      data.length === Tensor.sizeOf(shape);
    if (axisLabels !== undefined) {
      this.axisLabels = [...axisLabels];
    }
  }

  /** All public tensors currently use float64 storage (#760). */
  get dtype(): TensorDtype {
    return 'float64';
  }

  private static validateStorageBounds(
    shape: ReadonlyArray<number>,
    dataLength: number,
    offset: number,
    strides: ReadonlyArray<number>
  ): void {
    if (Tensor.sizeOf(shape) === 0) return;
    if (shape.length === 0) return;
    let maxIndex = offset;
    for (let k = 0; k < shape.length; k++) {
      maxIndex += (shape[k]! - 1) * strides[k]!;
    }
    if (maxIndex < 0 || maxIndex >= dataLength) {
      throw new Error(
        `Tensor: storage view extends past data buffer (max index ${maxIndex}, length ${dataLength})`
      );
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

  static zeros(...shape: number[]): Tensor {
    if (shape.length === 0) throw new TypeError('Tensor.zeros: requires at least one dimension');
    const size = Tensor.sizeOf(shape);
    return new Tensor(shape, new Float64Array(size));
  }

  static ones(...shape: number[]): Tensor {
    if (shape.length === 0) throw new TypeError('Tensor.ones: requires at least one dimension');
    const size = Tensor.sizeOf(shape);
    const out = new Float64Array(size);
    out.fill(1);
    return new Tensor(shape, out);
  }

  static full(shape: ReadonlyArray<number>, value: number): Tensor {
    const size = Tensor.sizeOf(shape);
    const out = new Float64Array(size);
    out.fill(value);
    return new Tensor([...shape], out);
  }

  /** Uninitialized buffer (zero-filled in JS; documented f64-only). */
  static empty(...shape: number[]): Tensor {
    return Tensor.zeros(...shape);
  }

  /**
   * Half-open range, length `ceil((stop - start) / step)` like NumPy, then
   * clamped at 0. A zero step throws. A step whose sign does not point from
   * start toward stop is an empty tensor, not an error.
   */
  static arange(start: number, stop?: number, step = 1): Tensor {
    let s = start;
    let e = stop;
    if (e === undefined) {
      e = start;
      s = 0;
    }
    if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(step)) {
      throw new RangeError('Tensor.arange: start, stop, and step must be finite');
    }
    if (step === 0) throw new RangeError('Tensor.arange: step must be non-zero');
    const quot = (e - s) / step;
    const len = quot > 0 ? Math.ceil(quot) : 0;
    const out = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = s + i * step;
    }
    return new Tensor([len], out);
  }

  /**
   * Logical element values in row-major order. For a C-contiguous tensor this is
   * the backing `buffer` itself (writes show through). For a view it is a new
   * dense copy: writes to it do not reach the tensor, and each read copies, so
   * read it once into a local. Use `buffer`, `offset` and `strides` for raw storage.
   */
  get data(): Float64Array {
    return this.isContiguous() ? this.buffer : this.contiguous().buffer;
  }

  /** True when storage is a dense C-contiguous slab (no parent-buffer view aliasing). */
  isContiguous(): boolean {
    return this.contiguousFlag;
  }

  /** Return a row-major C-contiguous copy when this tensor is a non-contiguous view. */
  contiguous(): Tensor {
    if (this.isContiguous()) return this;
    const size = Tensor.sizeOf(this.shape);
    const out = new Float64Array(size);
    const rank = this.shape.length;
    const coords = new Array<number>(rank).fill(0);
    for (let flat = 0; flat < size; flat++) {
      let idx = this.offset;
      for (let k = 0; k < rank; k++) idx += coords[k]! * this.strides[k]!;
      out[flat] = this.buffer[idx]!;
      for (let k = rank - 1; k >= 0; k--) {
        if (++coords[k]! < this.shape[k]!) break;
        coords[k] = 0;
      }
    }
    return new Tensor([...this.shape], out, this.axisLabels);
  }

  toNested(): NestedArray {
    const values = this.data;
    if (this.shape.length === 0) return values[0];
    const strides = Tensor.rowMajorStrides(this.shape);
    const build = (depth: number, offset: number): NestedArray => {
      if (depth === this.shape.length - 1) {
        const row: number[] = [];
        for (let i = 0; i < this.shape[depth]; i++) row.push(values[offset + i]);
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
    return new DenseMatrix(this.shape[0], this.shape[1], this.contiguous().buffer.slice());
  }

  private sameShape(other: Tensor): boolean {
    return (
      this.shape.length === other.shape.length && this.shape.every((v, i) => v === other.shape[i])
    );
  }

  add(operand: Tensor | number): Tensor {
    const a = this.data;
    if (typeof operand === 'number') {
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] + operand;
      return new Tensor(this.shape, out, this.axisLabels);
    }
    const other = asTensorOperand('add', operand);
    if (this.sameShape(other)) {
      const b = other.data;
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
      return new Tensor(this.shape, out, this.axisLabels);
    }
    return Tensor.broadcastOp(this, other, 'add', (x, y) => x + y);
  }
  sub(operand: Tensor | number): Tensor {
    const a = this.data;
    if (typeof operand === 'number') {
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] - operand;
      return new Tensor(this.shape, out, this.axisLabels);
    }
    const other = asTensorOperand('sub', operand);
    if (this.sameShape(other)) {
      const b = other.data;
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
      return new Tensor(this.shape, out, this.axisLabels);
    }
    return Tensor.broadcastOp(this, other, 'sub', (x, y) => x - y);
  }
  mul(operand: Tensor | number): Tensor {
    if (typeof operand === 'number') {
      return this.scale(operand);
    }
    const other = asTensorOperand('mul', operand);
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
  div(operand: Tensor | number): Tensor {
    const a = this.data;
    if (typeof operand === 'number') {
      const out = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = a[i] / operand;
      return new Tensor(this.shape, out, this.axisLabels);
    }
    const other = asTensorOperand('div', operand);
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
    const c = this.contiguous();
    return new Tensor([...this.shape], c.buffer.slice(), this.axisLabels);
  }

  /** Visit each logical element and write `fn(current)` back through strides. */
  private writeEach(fn: (current: number) => number): void {
    const size = Tensor.sizeOf(this.shape);
    const rank = this.shape.length;
    if (size === 0) return;
    if (this.isContiguous()) {
      const buf = this.buffer;
      for (let i = 0; i < size; i++) buf[i] = fn(buf[i]!);
      return;
    }
    const coords = new Array<number>(rank).fill(0);
    for (let flat = 0; flat < size; flat++) {
      let idx = this.offset;
      for (let k = 0; k < rank; k++) idx += coords[k]! * this.strides[k]!;
      this.buffer[idx] = fn(this.buffer[idx]!);
      for (let k = rank - 1; k >= 0; k--) {
        if (++coords[k]! < this.shape[k]!) break;
        coords[k] = 0;
      }
    }
  }

  /**
   * In-place binary op. `other` broadcasts into `this` (NumPy). A result shape
   * other than `this.shape` throws; `this` is never expanded.
   */
  private inplaceBinary(
    op: 'add_' | 'mul_',
    operand: Tensor | number,
    combine: (current: number, rhs: number) => number
  ): this {
    if (typeof operand === 'number') {
      this.writeEach((v) => combine(v, operand));
      return this;
    }
    const other = asTensorOperand(op, operand);
    let outShape: number[];
    try {
      outShape = Tensor.broadcastShape(this.shape, other.shape);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Tensor.${op}: ${detail}`);
    }
    if (outShape.length !== this.shape.length || outShape.some((dim, i) => dim !== this.shape[i])) {
      throw new Error(
        `Tensor.${op}: cannot broadcast [${other.shape}] into [${this.shape}] in place`
      );
    }
    if (this.sameShape(other) && this.isContiguous() && other.isContiguous()) {
      const b = other.buffer;
      const buf = this.buffer;
      for (let i = 0; i < buf.length; i++) buf[i] = combine(buf[i]!, b[i]!);
      return this;
    }
    const rank = this.shape.length;
    const otherRank = other.shape.length;
    const coords = new Array<number>(rank).fill(0);
    const size = Tensor.sizeOf(this.shape);
    for (let flat = 0; flat < size; flat++) {
      let selfIdx = this.offset;
      let otherIdx = other.offset;
      for (let k = 0; k < rank; k++) {
        selfIdx += coords[k]! * this.strides[k]!;
        const otherAxis = k - (rank - otherRank);
        if (otherAxis >= 0 && other.shape[otherAxis] !== 1) {
          otherIdx += coords[k]! * other.strides[otherAxis]!;
        }
      }
      this.buffer[selfIdx] = combine(this.buffer[selfIdx]!, other.buffer[otherIdx]!);
      for (let k = rank - 1; k >= 0; k--) {
        if (++coords[k]! < this.shape[k]!) break;
        coords[k] = 0;
      }
    }
    return this;
  }

  fill_(value: number): this {
    this.writeEach(() => value);
    return this;
  }

  add_(other: Tensor | number, alpha = 1): this {
    return this.inplaceBinary('add_', other, (v, rhs) => v + alpha * rhs);
  }

  mul_(other: Tensor | number): this {
    return this.inplaceBinary('mul_', other, (v, rhs) => v * rhs);
  }

  /** Inner product of two rank-1 tensors (PyTorch `dot`). */
  dot(operand: Tensor): number {
    const other = asTensorOperand('dot', operand);
    if (this.shape.length !== 1 || other.shape.length !== 1) {
      throw new Error('Tensor.dot: both operands must be rank-1');
    }
    if (this.shape[0] !== other.shape[0]) {
      throw new Error(`Tensor.dot: length mismatch ${this.shape[0]} vs ${other.shape[0]}`);
    }
    const a = this.contiguous().data;
    const b = other.data;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
    return sum;
  }

  /** 3-vector cross product (PyTorch `cross` for length-3 vectors). */
  cross(operand: Tensor): Tensor {
    const other = asTensorOperand('cross', operand);
    if (this.shape.length !== 1 || other.shape.length !== 1 || this.shape[0] !== 3) {
      throw new Error('Tensor.cross: both operands must be rank-1 vectors of length 3');
    }
    if (other.shape[0] !== 3) {
      throw new Error('Tensor.cross: both operands must be rank-1 vectors of length 3');
    }
    const a = this.contiguous().data;
    const b = other.data;
    const out = new Float64Array([
      a[1]! * b[2]! - a[2]! * b[1]!,
      a[2]! * b[0]! - a[0]! * b[2]!,
      a[0]! * b[1]! - a[1]! * b[0]!,
    ]);
    return new Tensor([3], out);
  }

  /**
   * Extract a sub-tensor by per-axis slice ranges (NumPy-style); see {@link sliceTensor}.
   */
  slice(ranges: (SliceRange | null)[]): Tensor {
    return sliceTensor(this, ranges);
  }

  scale(k: number): Tensor {
    const a = this.data;
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] * k;
    return new Tensor(this.shape, out, this.axisLabels);
  }

  normInf(): number {
    let max = 0;
    const values = this.data;
    for (let i = 0; i < values.length; i++) {
      const a = Math.abs(values[i]);
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

    const aData = a.data;
    const bData = b.data;
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
      out[n] = f(aData[aFlat], bData[bFlat]);
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
  tensordot(operand: Tensor, axes: ReadonlyArray<readonly [number, number]>): Tensor {
    const other = asTensorOperand('tensordot', operand);
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
    const currentSize = Tensor.sizeOf(this.shape);
    const resolved = resolveReshapeShape(currentSize, shape);
    if (!this.isContiguous()) {
      return this.contiguous().reshape(resolved);
    }
    return new Tensor(resolved, this.data, this.axisLabels);
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

  /** Batched matrix multiply; `matMul` is an alias (#753). */
  matmul(operand: Tensor): Tensor {
    const other = asTensorOperand('matmul', operand);
    const rankA = this.shape.length;
    const rankB = other.shape.length;
    if (rankA < 2 || rankB < 2) {
      throw new Error(
        `Tensor.matmul: both operands must have rank ≥ 2 (got ${rankA} and ${rankB})`
      );
    }
    if (rankA !== rankB) {
      throw new Error(
        `Tensor.matmul: batch rank mismatch; operands must have the same rank (${rankA} vs ${rankB})`
      );
    }
    const batchRank = rankA - 2;
    for (let b = 0; b < batchRank; b++) {
      if (this.shape[b] !== other.shape[b]) {
        throw new Error(
          `Tensor.matmul: batch dimension ${b} mismatch (${this.shape[b]} vs ${other.shape[b]})`
        );
      }
    }
    const m = this.shape[rankA - 2]!;
    const k = this.shape[rankA - 1]!;
    const k2 = other.shape[rankB - 2]!;
    const n = other.shape[rankB - 1]!;
    if (k !== k2) {
      throw new Error(`Tensor.matmul: inner dimension mismatch ${k} != ${k2}`);
    }

    const aData = this.contiguous().data;
    const bData = other.data;
    let batchSize = 1;
    for (let b = 0; b < batchRank; b++) batchSize *= this.shape[b]!;
    const yData = new Float64Array(batchSize * m * n);
    const mk = m * k;
    const kn = k * n;
    const mn = m * n;
    for (let batch = 0; batch < batchSize; batch++) {
      const aSlab =
        batchSize === 1 ? aData : new Float64Array(aData.subarray(batch * mk, batch * mk + mk));
      const bSlab =
        batchSize === 1 ? bData : new Float64Array(bData.subarray(batch * kn, batch * kn + kn));
      const c = backendManager.multiply(new DenseMatrix(m, k, aSlab), new DenseMatrix(k, n, bSlab));
      yData.set(c.toFloat64Array(), batch * mn);
    }
    const batchShape = this.shape.slice(0, batchRank);
    return new Tensor([...batchShape, m, n], yData);
  }

  matMul(other: Tensor): Tensor {
    return this.matmul(other);
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
    return new Tensor([...this.shape], this.contiguous().buffer.slice(), newLabels);
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
  contract(operand: Tensor): Tensor {
    const other = asTensorOperand('contract', operand);
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
