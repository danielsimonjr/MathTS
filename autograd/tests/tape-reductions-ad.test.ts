/**
 * Tests for reverse-mode AD over TapedTensor reductions.
 *
 * Reductions covered: sum, mean, prod, max, min, norm.
 *
 * For each method:
 *   - Forward-correctness test: output primal equals the corresponding Tensor method.
 *   - Gradient-check test: analytical reverse-mode gradient vs central finite differences
 *     (ε = 1e-6, tolerance = 1e-7).
 *
 * Edge-case tests:
 *   - sum over axis=[] (reduce nothing — identity).
 *   - prod with one zero element.
 *   - prod with two zero elements.
 *   - max with ties (first-wins placement).
 *
 * Composition test: (taped.contract(other)).sum() — gradients correct across both leaves.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { idx } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '../src/tape.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run single-leaf reverse-mode AD: seed output gradient with all-ones
 * (= gradient of sum-of-outputs). Returns the accumulated input gradient.
 */
function reverseGradOne(
  fn: (t: TapedTensor) => TapedTensor,
  xData: Float64Array,
  xShape: ReadonlyArray<number>
): Float64Array {
  const tape = new Tape();
  const xT = new TapedTensor(xShape, new Float64Array(xData), tape, tape.allocate(xData.length).id);
  // Re-allocate properly
  const tape2 = new Tape();
  const { id } = tape2.allocate(xData.length);
  const leaf = new TapedTensor(xShape, new Float64Array(xData), tape2, id);
  const out = fn(leaf);
  const onesGrad = new Float64Array(out.primal.length).fill(1.0);
  tape2.backward(out.id, onesGrad);
  return new Float64Array(tape2.getInputGrad(id)!);
}

/**
 * Numerical gradient (central finite differences) of sum(f(x)) w.r.t. x.
 * ε = 1e-6.
 */
function numericalGrad(
  fn: (data: Float64Array) => Float64Array,
  xData: Float64Array,
  eps = 1e-6
): Float64Array {
  const grad = new Float64Array(xData.length);
  for (let i = 0; i < xData.length; i++) {
    const xPlus = new Float64Array(xData);
    xPlus[i] += eps;
    const xMinus = new Float64Array(xData);
    xMinus[i] -= eps;
    const fPlus = fn(xPlus).reduce((s, v) => s + v, 0);
    const fMinus = fn(xMinus).reduce((s, v) => s + v, 0);
    grad[i] = (fPlus - fMinus) / (2 * eps);
  }
  return grad;
}

/**
 * Allocate a leaf TapedTensor from raw data + shape.
 */
function makeTaped(
  tape: Tape,
  data: Float64Array,
  shape: ReadonlyArray<number>
): TapedTensor {
  const { id } = tape.allocate(data.length);
  return new TapedTensor(shape, new Float64Array(data), tape, id);
}

function assertClose(a: Float64Array, b: Float64Array, tol = 1e-7, label = ''): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    if (diff >= tol) {
      throw new Error(`${label}: element [${i}] differs: ${a[i]} vs ${b[i]}, diff=${diff}`);
    }
    expect(diff).toBeLessThan(tol);
  }
}

// ---------------------------------------------------------------------------
// sum
// ---------------------------------------------------------------------------

describe('TapedTensor.sum — forward correctness', () => {
  it('sum() over all axes matches Tensor.sum()', () => {
    const data = new Float64Array([1, 2, 3, 4, 5, 6]);
    const shape = [2, 3];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.sum();
    const expected = new Tensor(shape, data).sum();
    expect(out.shape).toEqual([]);
    expect(out.primal[0]).toBeCloseTo(expected.data[0], 12);
  });

  it('sum(axis=1) matches Tensor.sum(1)', () => {
    const data = new Float64Array([1, 2, 3, 4, 5, 6]);
    const shape = [2, 3];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.sum(1);
    const expected = new Tensor(shape, data).sum(1);
    expect(out.shape).toEqual(expected.shape);
    for (let i = 0; i < out.primal.length; i++) {
      expect(out.primal[i]).toBeCloseTo(expected.data[i], 12);
    }
  });
});

describe('TapedTensor.sum — gradient check', () => {
  it('sum() gradient = all ones (broadcast from scalar dY=1)', () => {
    const data = new Float64Array([1, 2, 3, 4]);
    const shape = [2, 2];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.sum();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    // sum(all) → every input gets gradient 1
    for (let i = 0; i < grad.length; i++) {
      expect(grad[i]).toBeCloseTo(1, 12);
    }
  });

  it('sum(axis=0) gradient matches finite differences (3×4 tensor)', () => {
    const shape: ReadonlyArray<number> = [3, 4];
    const xData = new Float64Array([1, -2, 3, 0.5, 2, 1, -1, 4, 0, 3, -2, 1]);
    const fwd = (d: Float64Array) =>
      new Tensor(shape, new Float64Array(d)).sum(0).data;
    const numGrad = numericalGrad(fwd, xData);

    const tape = new Tape();
    const { id } = tape.allocate(xData.length);
    const leaf = new TapedTensor(shape, new Float64Array(xData), tape, id);
    const out = leaf.sum(0);
    tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
    const grad = tape.getInputGrad(id)!;
    assertClose(grad, numGrad, 1e-7, 'sum(axis=0)');
  });

  it('sum(axis=[]) returns identity (no reduction) with correct gradient', () => {
    const data = new Float64Array([2, 3, 5]);
    const shape = [3];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    // sum over empty axis list = no reduction; output shape = input shape
    const out = leaf.sum([]);
    expect(out.shape).toEqual([3]);
    for (let i = 0; i < data.length; i++) {
      expect(out.primal[i]).toBeCloseTo(data[i], 12);
    }
    tape.backward(out.id, new Float64Array([1, 1, 1]));
    const grad = tape.getInputGrad(id)!;
    for (let i = 0; i < grad.length; i++) {
      expect(grad[i]).toBeCloseTo(1, 12);
    }
  });
});

// ---------------------------------------------------------------------------
// mean
// ---------------------------------------------------------------------------

describe('TapedTensor.mean — forward correctness', () => {
  it('mean() over all axes matches Tensor.mean()', () => {
    const data = new Float64Array([2, 4, 6, 8]);
    const shape = [2, 2];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.mean();
    const expected = new Tensor(shape, data).mean();
    expect(out.primal[0]).toBeCloseTo(expected.data[0], 12); // = 5
  });

  it('mean(axis=1) shape correct', () => {
    const data = new Float64Array([1, 3, 5, 7]);
    const shape = [2, 2];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.mean(1);
    expect(out.shape).toEqual([2]);
    expect(out.primal[0]).toBeCloseTo(2, 12); // mean([1,3])
    expect(out.primal[1]).toBeCloseTo(6, 12); // mean([5,7])
  });
});

describe('TapedTensor.mean — gradient check', () => {
  it('mean() gradient = 1/N broadcast (N=4)', () => {
    const data = new Float64Array([1, 2, 3, 4]);
    const shape = [2, 2];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.mean();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    for (let i = 0; i < grad.length; i++) {
      expect(grad[i]).toBeCloseTo(1 / 4, 12);
    }
  });

  it('mean(axis=0) gradient matches finite differences (3×2 tensor)', () => {
    const shape: ReadonlyArray<number> = [3, 2];
    const xData = new Float64Array([1, 2, 3, 4, 5, 6]);
    const fwd = (d: Float64Array) =>
      new Tensor(shape, new Float64Array(d)).mean(0).data;
    const numGrad = numericalGrad(fwd, xData);

    const tape = new Tape();
    const { id } = tape.allocate(xData.length);
    const leaf = new TapedTensor(shape, new Float64Array(xData), tape, id);
    const out = leaf.mean(0);
    tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
    const grad = tape.getInputGrad(id)!;
    assertClose(grad, numGrad, 1e-7, 'mean(axis=0)');
  });
});

// ---------------------------------------------------------------------------
// prod
// ---------------------------------------------------------------------------

describe('TapedTensor.prod — forward correctness', () => {
  it('prod() over all axes matches Tensor.prod()', () => {
    const data = new Float64Array([1, 2, 3, 4]);
    const shape = [4];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.prod();
    const expected = new Tensor(shape, data).prod();
    expect(out.primal[0]).toBeCloseTo(expected.data[0], 12); // = 24
  });
});

describe('TapedTensor.prod — gradient check', () => {
  it('prod() gradient matches finite differences (no zeros)', () => {
    const shape: ReadonlyArray<number> = [4];
    const xData = new Float64Array([2, 3, 4, 5]);
    const fwd = (d: Float64Array) =>
      new Tensor(shape, new Float64Array(d)).prod().data;
    const numGrad = numericalGrad(fwd, xData);

    const tape = new Tape();
    const { id } = tape.allocate(xData.length);
    const leaf = new TapedTensor(shape, new Float64Array(xData), tape, id);
    const out = leaf.prod();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    assertClose(grad, numGrad, 1e-7, 'prod()');
  });

  it('prod() gradient: exactly one zero — d/dx_zero = product of others, d/dx_others = 0', () => {
    // x = [2, 0, 3]: prod = 0
    // d/dx[0] = 0*3 = 0  (product of others = 0*3=0) — wait, only one zero so
    // d/dx[1] = 2*3 = 6 (the product of all others), d/dx[0] = 0*3=0, d/dx[2] = 2*0=0
    const data = new Float64Array([2, 0, 3]);
    const shape = [3];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.prod();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    // prefix[0]=1, suffix[0]=0*3=0 → grad[0] = 1 * 1 * 0 = 0
    // prefix[1]=2, suffix[1]=3    → grad[1] = 1 * 2 * 3 = 6
    // prefix[2]=0, suffix[2]=1    → grad[2] = 1 * 0 * 1 = 0
    expect(grad[0]).toBeCloseTo(0, 12);
    expect(grad[1]).toBeCloseTo(6, 12);
    expect(grad[2]).toBeCloseTo(0, 12);
  });

  it('prod() gradient: two zeros — gradient is 0 everywhere', () => {
    // x = [0, 0, 3]: product = 0; two zeros → all gradients = 0
    const data = new Float64Array([0, 0, 3]);
    const shape = [3];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.prod();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    for (let i = 0; i < grad.length; i++) {
      expect(grad[i]).toBeCloseTo(0, 12);
    }
  });
});

// ---------------------------------------------------------------------------
// max
// ---------------------------------------------------------------------------

describe('TapedTensor.max — forward correctness', () => {
  it('max() matches Tensor.max()', () => {
    const data = new Float64Array([1, 5, 3, 2]);
    const shape = [4];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.max();
    expect(out.primal[0]).toBeCloseTo(5, 12);
  });

  it('max(axis=1) matches Tensor.max(1)', () => {
    const data = new Float64Array([3, 1, 2, 4]);
    const shape = [2, 2];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.max(1);
    const expected = new Tensor(shape, data).max(1);
    expect(out.shape).toEqual(expected.shape);
    for (let i = 0; i < out.primal.length; i++) {
      expect(out.primal[i]).toBeCloseTo(expected.data[i], 12);
    }
  });
});

describe('TapedTensor.max — gradient check', () => {
  it('max() gradient: dY flows to argmax position only', () => {
    // [1, 5, 3, 2] → max=5 at index 1
    const data = new Float64Array([1, 5, 3, 2]);
    const shape = [4];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.max();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad[0]).toBeCloseTo(0, 12);
    expect(grad[1]).toBeCloseTo(1, 12); // argmax
    expect(grad[2]).toBeCloseTo(0, 12);
    expect(grad[3]).toBeCloseTo(0, 12);
  });

  it('max() with ties: first-wins gradient placement', () => {
    // [3, 3, 1] → max=3, tie at indices 0 and 1; first-wins → gradient at 0
    const data = new Float64Array([3, 3, 1]);
    const shape = [3];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.max();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad[0]).toBeCloseTo(1, 12); // first winner
    expect(grad[1]).toBeCloseTo(0, 12); // tied but not first
    expect(grad[2]).toBeCloseTo(0, 12);
  });

  it('max(axis=0) gradient matches finite differences (3×3 tensor)', () => {
    const shape: ReadonlyArray<number> = [3, 3];
    const xData = new Float64Array([1, 5, 2, 3, 1, 6, 4, 2, 3]);
    const fwd = (d: Float64Array) =>
      new Tensor(shape, new Float64Array(d)).max(0).data;
    const numGrad = numericalGrad(fwd, xData);

    const tape = new Tape();
    const { id } = tape.allocate(xData.length);
    const leaf = new TapedTensor(shape, new Float64Array(xData), tape, id);
    const out = leaf.max(0);
    tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
    const grad = tape.getInputGrad(id)!;
    assertClose(grad, numGrad, 1e-7, 'max(axis=0)');
  });
});

// ---------------------------------------------------------------------------
// min
// ---------------------------------------------------------------------------

describe('TapedTensor.min — forward correctness', () => {
  it('min() matches Tensor.min()', () => {
    const data = new Float64Array([4, 2, 7, 1]);
    const shape = [4];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.min();
    expect(out.primal[0]).toBeCloseTo(1, 12);
  });
});

describe('TapedTensor.min — gradient check', () => {
  it('min() gradient: dY flows to argmin position only', () => {
    const data = new Float64Array([4, 2, 7, 1]);
    const shape = [4];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.min();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad[0]).toBeCloseTo(0, 12);
    expect(grad[1]).toBeCloseTo(0, 12);
    expect(grad[2]).toBeCloseTo(0, 12);
    expect(grad[3]).toBeCloseTo(1, 12); // argmin
  });

  it('min(axis=1) gradient matches finite differences (3×2 tensor)', () => {
    const shape: ReadonlyArray<number> = [3, 2];
    const xData = new Float64Array([2, 1, 5, 3, 4, 6]);
    const fwd = (d: Float64Array) =>
      new Tensor(shape, new Float64Array(d)).min(1).data;
    const numGrad = numericalGrad(fwd, xData);

    const tape = new Tape();
    const { id } = tape.allocate(xData.length);
    const leaf = new TapedTensor(shape, new Float64Array(xData), tape, id);
    const out = leaf.min(1);
    tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
    const grad = tape.getInputGrad(id)!;
    assertClose(grad, numGrad, 1e-7, 'min(axis=1)');
  });
});

// ---------------------------------------------------------------------------
// norm
// ---------------------------------------------------------------------------

describe('TapedTensor.norm — forward correctness', () => {
  it('norm() p=2 matches Tensor.norm()', () => {
    const data = new Float64Array([3, 4]);
    const shape = [2];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.norm();
    expect(out.primal[0]).toBeCloseTo(5, 12); // sqrt(9+16) = 5
  });

  it('norm(p=1) matches sum of absolute values', () => {
    const data = new Float64Array([-3, 4, -1, 2]);
    const shape = [4];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.norm({ p: 1 });
    expect(out.primal[0]).toBeCloseTo(10, 12); // 3+4+1+2
  });

  it('norm(p="inf") returns max absolute value', () => {
    const data = new Float64Array([1, -7, 3]);
    const shape = [3];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const out = leaf.norm({ p: 'inf' });
    expect(out.primal[0]).toBeCloseTo(7, 12);
  });

  it('norm(p="fro") equals p=2 (Frobenius is 2-norm of flattened)', () => {
    const data = new Float64Array([1, 2, 3, 4]);
    const shape = [2, 2];
    const tape = new Tape();
    const leaf = makeTaped(tape, data, shape);
    const outFro = leaf.norm({ p: 'fro' });
    const tape2 = new Tape();
    const leaf2 = makeTaped(tape2, data, shape);
    const out2 = leaf2.norm({ p: 2 });
    expect(outFro.primal[0]).toBeCloseTo(out2.primal[0], 12);
  });
});

describe('TapedTensor.norm — gradient check', () => {
  it('norm(p=2) gradient = x / ||x|| (analytical)', () => {
    const data = new Float64Array([3, 4]);
    const shape = [2];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.norm({ p: 2 });
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    // norm = 5; grad[0] = 3/5 = 0.6, grad[1] = 4/5 = 0.8
    expect(grad[0]).toBeCloseTo(0.6, 10);
    expect(grad[1]).toBeCloseTo(0.8, 10);
  });

  it('norm(p=2) gradient matches finite differences (random 4-vector)', () => {
    const shape: ReadonlyArray<number> = [4];
    const xData = new Float64Array([1, 2, -3, 4]);
    const fwd = (d: Float64Array) =>
      new Tensor(shape, new Float64Array(d)).norm({ p: 2 }).data;
    const numGrad = numericalGrad(fwd, xData);

    const tape = new Tape();
    const { id } = tape.allocate(xData.length);
    const leaf = new TapedTensor(shape, new Float64Array(xData), tape, id);
    const out = leaf.norm({ p: 2 });
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    assertClose(grad, numGrad, 1e-7, 'norm(p=2)');
  });

  it('norm(p=1) gradient = sign(x), subgradient 0 at exact zero', () => {
    const data = new Float64Array([3, -2, 0, 1]);
    const shape = [4];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.norm({ p: 1 });
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad[0]).toBeCloseTo(1, 12);  // sign(3) = 1
    expect(grad[1]).toBeCloseTo(-1, 12); // sign(-2) = -1
    expect(grad[2]).toBeCloseTo(0, 12);  // subgradient at 0 = 0
    expect(grad[3]).toBeCloseTo(1, 12);  // sign(1) = 1
  });

  it('norm(p="inf") gradient scattered to max-abs position, first-wins', () => {
    // [1, -5, 3, 5] → max abs = 5 at index 1 (first occurrence)
    const data = new Float64Array([1, -5, 3, 5]);
    const shape = [4];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.norm({ p: 'inf' });
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad[0]).toBeCloseTo(0, 12);
    expect(grad[1]).toBeCloseTo(-1, 12); // sign(-5) = -1, first winner
    expect(grad[2]).toBeCloseTo(0, 12);
    expect(grad[3]).toBeCloseTo(0, 12);  // also |5| but not first-wins
  });
});

// ---------------------------------------------------------------------------
// Composition test: contract + sum
// ---------------------------------------------------------------------------

describe('TapedTensor composition — contract().sum()', () => {
  it('A.contract(B).sum() returns correct gradients across both leaves', () => {
    // A: [2,3], B: [3,2] contracted over the shared axis (size 3).
    // Output Y: [2,2]. sum(Y) is a scalar.
    // dA[i,k] = Σ_j dY[i,j] * B[k,j] = Σ_j 1 * B[k,j] = sum of B row k
    // dB[k,j] = Σ_i A[i,k] * dY[i,j] = Σ_i A[i,k] * 1 = sum of A col k
    const iA = idx(2, 'i');
    const kAB = idx(3, 'k'); // shared — size 3
    const jB = idx(2, 'j');

    const aData = new Float64Array([1, 2, 3, 4, 5, 6]);       // [2,3]
    const bData = new Float64Array([7, 8, 9, 10, 11, 12]);     // [3,2]
    const aShape: ReadonlyArray<number> = [2, 3];
    const bShape: ReadonlyArray<number> = [3, 2];

    const tape = new Tape();
    const { id: idA } = tape.allocate(aData.length);
    const { id: idB } = tape.allocate(bData.length);
    const A = new TapedTensor(aShape, new Float64Array(aData), tape, idA, [iA, kAB]);
    const B = new TapedTensor(bShape, new Float64Array(bData), tape, idB, [kAB, jB]);

    const Y = A.contract(B); // shape [2,2]
    const S = Y.sum();       // scalar

    tape.backward(S.id, new Float64Array([1]));

    const gradA = tape.getInputGrad(idA)!;
    const gradB = tape.getInputGrad(idB)!;

    // dA[i,k] = Σ_j B[k,j] * 1  (sum of row k of B)
    // B rows: [7,8], [9,10], [11,12] → row sums: 15, 19, 23
    // dA[0,0]=15, dA[0,1]=19, dA[0,2]=23, dA[1,0]=15, dA[1,1]=19, dA[1,2]=23
    const expectedGradA = new Float64Array([15, 19, 23, 15, 19, 23]);
    assertClose(gradA, expectedGradA, 1e-7, 'dA');

    // dB[k,j] = Σ_i A[i,k] * 1  (sum of col k of A)
    // A cols: [1,4], [2,5], [3,6] → col sums: 5, 7, 9
    // dB[0,0]=5, dB[0,1]=5, dB[1,0]=7, dB[1,1]=7, dB[2,0]=9, dB[2,1]=9
    const expectedGradB = new Float64Array([5, 5, 7, 7, 9, 9]);
    assertClose(gradB, expectedGradB, 1e-7, 'dB');
  });
});
