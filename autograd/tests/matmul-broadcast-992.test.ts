/**
 * #992: `TapedTensor.matmul` follows the NumPy `matmul` rules, forward and reverse.
 *
 * A rank-1 operand and a batch axis of size 1 (or a missing batch axis) used to throw. The
 * forward value is the value of `Tensor.matmul`. The adjoint of an operand that was broadcast is
 * the sum of the full-batch adjoint over the broadcast axes, so each gradient is compared with a
 * central finite difference of a weighted sum `sum(w * (A @ B))` (matmul is bilinear, so the
 * difference is exact up to rounding). The weights are distinct, so a gradient that goes to the
 * wrong batch slab or the wrong element cannot pass.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '../src/tape.js';

/** A tensor with smooth, distinct, non-zero entries. */
function fill(shape: number[], seed: number): Tensor {
  const size = shape.reduce((p, d) => p * d, 1);
  return new Tensor(
    shape,
    Float64Array.from({ length: size }, (_, i) => Math.sin(i * 0.7 + seed) + 1.5)
  );
}

function weightedSum(y: Tensor, w: Float64Array): number {
  const d = y.data;
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i]! * w[i]!;
  return s;
}

/** Central finite difference of `weightedSum(f(x), w)` in each entry of `x`. */
function numericGrad(
  x: Tensor,
  f: (t: Tensor) => Tensor,
  w: Float64Array,
  eps = 1e-4
): Float64Array {
  const base = x.data;
  const grad = new Float64Array(base.length);
  for (let i = 0; i < base.length; i++) {
    const plus = new Float64Array(base);
    plus[i]! += eps;
    const minus = new Float64Array(base);
    minus[i]! -= eps;
    grad[i] =
      (weightedSum(f(new Tensor(x.shape, plus)), w) -
        weightedSum(f(new Tensor(x.shape, minus)), w)) /
      (2 * eps);
  }
  return grad;
}

/** `|actual - expected| <= tol * (1 + |actual|)` for every entry, and equal lengths. */
function expectClose(
  actual: Float64Array,
  expected: Float64Array,
  tol: number,
  label: string
): void {
  expect(actual.length, `${label}: length`).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const bound = tol * (1 + Math.abs(actual[i]!));
    expect(Math.abs(actual[i]! - expected[i]!), `${label}[${i}]`).toBeLessThanOrEqual(bound);
  }
}

const PAIRS: Array<[number[], number[]]> = [
  [
    [2, 3, 4],
    [4, 5],
  ],
  [
    [4, 3, 5],
    [5, 2],
  ],
  [
    [1, 2, 2],
    [3, 2, 2],
  ],
  [
    [3, 2, 2],
    [1, 2, 2],
  ],
  [
    [2, 1, 2, 3],
    [3, 3, 2],
  ],
  [
    [2, 3],
    [4, 3, 2],
  ],
  [[4, 3, 5], [5]],
  [[3], [2, 3, 4]],
  [[2, 3], [3]],
  [[3], [3, 4]],
  [[3], [3]],
];

describe('#992 TapedTensor.matmul broadcast and rank-1 operands', () => {
  for (const [sa, sb] of PAIRS) {
    it(`[${sa}] @ [${sb}]: value equals Tensor.matmul and gradients match finite differences`, () => {
      const aT = fill(sa, 1);
      const bT = fill(sb, 2);
      const want = aT.matmul(bT);

      const tape = new Tape();
      const A = TapedTensor.fromTensorAsInput(aT, tape);
      const B = TapedTensor.fromTensorAsInput(bT, tape);
      const Y = A.matmul(B);

      expect([...Y.shape]).toEqual([...want.shape]);
      expectClose(new Float64Array(Y.primal), new Float64Array(want.data), 1e-12, 'value');

      const w = Float64Array.from({ length: want.data.length }, (_, i) => 1 + 0.37 * i);
      tape.backward(Y.id, new Float64Array(w));
      const gradA = new Float64Array(tape.getInputGrad(A.id)!);
      const gradB = new Float64Array(tape.getInputGrad(B.id)!);

      expectClose(
        gradA,
        numericGrad(aT, (t) => t.matmul(bT), w),
        1e-7,
        'gradA'
      );
      expectClose(
        gradB,
        numericGrad(bT, (t) => aT.matmul(t), w),
        1e-7,
        'gradB'
      );
    });
  }

  it('a broadcast operand receives the sum over the broadcast batch axis', () => {
    // A: [1,2,2] against B: [3,2,2]; dY = ones, so dA = sum over b of (1 @ B[b]^T).
    const aT = new Tensor([1, 2, 2], Float64Array.from([1, 2, 3, 4]));
    const bT = new Tensor(
      [3, 2, 2],
      Float64Array.from({ length: 12 }, (_, i) => i + 1)
    );
    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aT, tape);
    const B = TapedTensor.fromTensorAsInput(bT, tape);
    const Y = A.matmul(B);
    tape.backward(Y.id, new Float64Array(12).fill(1));
    // dA[i,q] = sum_b sum_j B[b,q,j]: row sums of each B slab, added over the three slabs.
    // B[0] = [[1,2],[3,4]]: row sums 3, 7. B[1] = [[5,6],[7,8]]: 11, 15. B[2] = [[9,10],[11,12]]: 19, 23.
    expect([...tape.getInputGrad(A.id)!]).toEqual([33, 45, 33, 45]);
  });
});

describe('#992 TapedTensor.matmul errors', () => {
  it('an inner dimension mismatch throws', () => {
    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(fill([2, 3], 1), tape);
    const B = TapedTensor.fromTensorAsInput(fill([4, 2], 2), tape);
    expect(() => A.matmul(B)).toThrow(/inner dimension mismatch/);
  });
  it('batch shapes that cannot broadcast throw the broadcastShape error', () => {
    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(fill([2, 3, 2, 2], 1), tape);
    const B = TapedTensor.fromTensorAsInput(fill([4, 3, 2, 2], 2), tape);
    expect(() => A.matmul(B)).toThrow(/cannot be broadcast/);
  });
  it('a rank-0 operand throws a rank error', () => {
    const tape = new Tape();
    const scalar = TapedTensor.fromTensorAsInput(new Tensor([], new Float64Array([2])), tape);
    const B = TapedTensor.fromTensorAsInput(fill([2, 2], 2), tape);
    expect(() => scalar.matmul(B)).toThrow(/rank ≥ 1/);
    expect(() => B.matmul(scalar)).toThrow(/rank ≥ 1/);
  });
});
