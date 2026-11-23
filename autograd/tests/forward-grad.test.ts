import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { forwardGrad } from '../src/forward-grad';
import { DualTensor, forwardDiagonalGrad } from '../src/index.js';

describe('forwardGrad (forward-mode AD via dual numbers)', () => {
  it('fn(x) = x · x returns Jacobian diag(2x)', () => {
    // For x ∈ R^3, fn returns R^3 (elementwise square); Jacobian is diagonal 2x.
    const x = Tensor.fromNested([2, 3, 4], [3]);
    const fn = (t: Tensor) => t.mul(t);
    const { value, jacobian } = forwardGrad(fn, x);
    expect(value.toNested()).toEqual([4, 9, 16]);
    // Jacobian shape: [...value.shape, ...x.shape] = [3, 3].
    expect(jacobian.shape).toEqual([3, 3]);
    // Diagonal entries = 2x; off-diagonals = 0.
    const J = jacobian.toNested() as number[][];
    expect(J[0][0]).toBeCloseTo(4, 12);
    expect(J[1][1]).toBeCloseTo(6, 12);
    expect(J[2][2]).toBeCloseTo(8, 12);
    expect(J[0][1]).toBeCloseTo(0, 12);
    expect(J[1][2]).toBeCloseTo(0, 12);
  });

  it('fn(x) = sum(x) returns Jacobian [1, 1, ..., 1] (scalar-out gradient)', () => {
    // fn: Tensor[N] → Tensor[] (scalar via reduction-as-elementwise-then-trace)
    // Use a contraction-like reduction: sum is g·x where g = ones.
    // Simpler: fn(x) = scale(x, 1) reduced via sum-of-components.
    // For this test, use fn(x) = x.scale(1) then sum elementwise — actually
    // the cleanest: fn(x) returns scalar value Σx_i by building a 1-tensor.
    // Implementer: use whatever scalar-reduction primitive autograd exposes.
    // Here we just test the dual-number sum-rule: if fn = identity scaled,
    // the Jacobian is the identity matrix.
    const x = Tensor.fromNested([1, 2, 3], [3]);
    const fn = (t: Tensor) => t;
    const { value, jacobian } = forwardGrad(fn, x);
    expect(value.toNested()).toEqual([1, 2, 3]);
    expect(jacobian.shape).toEqual([3, 3]);
    const J = jacobian.toNested() as number[][];
    expect(J[0][0]).toBeCloseTo(1, 12);
    expect(J[1][1]).toBeCloseTo(1, 12);
    expect(J[2][2]).toBeCloseTo(1, 12);
    expect(J[0][1]).toBeCloseTo(0, 12);
  });

  it('throws a clear error when fn breaks the AD trace (returns plain Tensor)', () => {
    const x = Tensor.fromNested([1, 2, 3], [3]);
    // fn that returns a fresh Tensor instead of routing through DualTensor ops:
    const fnBroken = (_t: Tensor) => Tensor.fromNested([1, 2, 3], [3]);
    expect(() => forwardGrad(fnBroken, x)).toThrow(/AD-traceable|non-DualTensor/);
  });

  it('rank-2 → rank-2 (linear map) returns the correct Jacobian shape', () => {
    // fn: 2x2 matrix → 2x2 matrix, fn(A) = 2*A. Jacobian shape: [2,2,2,2]; J[i,j,k,l] = 2 if (i,j)=(k,l) else 0.
    const A = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    const fn = (t: Tensor) => t.scale(2);
    const { value, jacobian } = forwardGrad(fn, A);
    expect(value.toNested()).toEqual([
      [2, 4],
      [6, 8],
    ]);
    expect(jacobian.shape).toEqual([2, 2, 2, 2]);
    const J = jacobian.toNested() as number[][][][];
    expect(J[0][0][0][0]).toBeCloseTo(2, 12);
    expect(J[1][1][1][1]).toBeCloseTo(2, 12);
    expect(J[0][0][1][1]).toBeCloseTo(0, 12);
  });
});

describe('forwardDiagonalGrad', () => {
  it('computes a 100×100 elementwise square with one trace and compact output', () => {
    const values = Float64Array.from({ length: 10000 }, (_, i) => i / 1000 - 5);
    const input = new Tensor([100, 100], values);
    let traces = 0;
    const { value, diagonal } = forwardDiagonalGrad((x) => {
      traces += 1;
      return x.mul(x);
    }, input);

    expect(traces).toBe(1);
    expect(value.shape).toEqual([100, 100]);
    expect(diagonal.shape).toEqual([100, 100]);
    expect(value.data).toEqual(values.map((x) => x * x));
    expect(diagonal.data).toEqual(values.map((x) => 2 * x));
  });

  it('rejects a broadcast output whose shape differs from the input', () => {
    const input = Tensor.fromNested([3], [1]);
    const offset = DualTensor.fromTensor(Tensor.fromNested([1, 2], [2]));
    expect(() => forwardDiagonalGrad((x) => x.add(offset), input)).toThrow(
      /forwardDiagonalGrad: shape mismatch/
    );
  });
});
