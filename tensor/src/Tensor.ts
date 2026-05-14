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

export type NestedArray = number | NestedArray[];

export class Tensor {
  readonly shape: ReadonlyArray<number>;
  readonly data: Float64Array;

  constructor(shape: ReadonlyArray<number>, data: Float64Array) {
    this.shape = shape;
    this.data = data;
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

  private sameShape(other: Tensor): boolean {
    return this.shape.length === other.shape.length
      && this.shape.every((v, i) => v === other.shape[i]);
  }

  private elementwise(other: Tensor, op: string, f: (x: number, y: number) => number): Tensor {
    if (!this.sameShape(other)) {
      throw new Error(`Tensor.${op}: shape mismatch [${this.shape}] vs [${other.shape}]`);
    }
    const out = new Float64Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = f(this.data[i], other.data[i]);
    return new Tensor(this.shape, out);
  }

  add(other: Tensor): Tensor { return this.elementwise(other, 'add', (x, y) => x + y); }
  sub(other: Tensor): Tensor { return this.elementwise(other, 'sub', (x, y) => x - y); }
  mul(other: Tensor): Tensor { return this.elementwise(other, 'mul', (x, y) => x * y); }

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
}
