/**
 * #904 — every binary Tensor op accepts a TapedTensor as the right-hand operand.
 *
 * Each case compares the result with the same op on the plain primal Tensor.
 * The primal values are non-zero, so a wrong read cannot pass by accident.
 */
import { describe, it, expect } from 'vitest';
import { Tensor, idx } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '@danielsimonjr/mathts-autograd';

const primal = new Tensor([2, 4], new Float64Array([1, 0, 2, 0, 0, 1, 0, 2]));
const vec = new Tensor([4], new Float64Array([3, -1, 2, 5]));

function taped(t: Tensor): TapedTensor {
  return TapedTensor.fromTensorAsInput(t, new Tape());
}

function expectSame(actual: Tensor, expected: Tensor): void {
  expect([...actual.shape]).toEqual([...expected.shape]);
  expect([...actual.contiguous().data]).toEqual([...expected.contiguous().data]);
}

describe('#904 TapedTensor as the right-hand operand', () => {
  it('matmul accepts a TapedTensor (issue repro with non-zero weights)', () => {
    const X = Tensor.fromNested([
      [0, 0],
      [1, 1],
    ]);
    const X2 = Tensor.fromNested([
      [1, 2],
      [3, 4],
    ]);
    expectSame(X2.matmul(taped(primal)), X2.matmul(primal));
    expect(() => X.matmul(taped(primal))).not.toThrow();
  });

  it('matMul accepts a TapedTensor', () => {
    const X = Tensor.fromNested([
      [1, 2],
      [3, 4],
    ]);
    expectSame(X.matMul(taped(primal)), X.matMul(primal));
  });

  it('add, sub, mul and div accept a TapedTensor, same shape and broadcast', () => {
    const a = new Tensor([2, 4], new Float64Array([2, 2, 2, 2, 4, 4, 4, 4]));
    expectSame(a.add(taped(primal)), a.add(primal));
    expectSame(a.sub(taped(primal)), a.sub(primal));
    expectSame(a.mul(taped(primal)), a.mul(primal));
    expectSame(a.div(taped(primal)), a.div(primal));
    expectSame(a.add(taped(vec)), a.add(vec));
    expectSame(a.mul(taped(vec)), a.mul(vec));
  });

  it('add_ and mul_ accept a TapedTensor and write the result in place', () => {
    const base = new Tensor([2, 4], new Float64Array([2, 2, 2, 2, 4, 4, 4, 4]));
    expectSame(base.clone().add_(taped(primal)), base.clone().add_(primal));
    expectSame(base.clone().mul_(taped(primal)), base.clone().mul_(primal));
    expectSame(base.clone().add_(taped(vec)), base.clone().add_(vec));
  });

  it('dot and cross accept a rank-1 TapedTensor', () => {
    const u = new Tensor([4], new Float64Array([1, 2, 3, 4]));
    expect(u.dot(taped(vec))).toBe(u.dot(vec));
    const c = new Tensor([3], new Float64Array([1, 0, 0]));
    const c2 = new Tensor([3], new Float64Array([2, 3, 4]));
    expectSame(c.cross(taped(c2)), c.cross(c2));
  });

  it('tensordot and contract accept a TapedTensor', () => {
    const i = idx(2, 'i');
    const j = idx(2, 'j');
    const k = idx(4, 'k');
    const A = new Tensor([2, 2], new Float64Array([1, 2, 3, 4]), [i, j]);
    const W = new Tensor([2, 4], primal.data, [j, k]);
    expectSame(A.tensordot(taped(primal), [[1, 0]]), A.tensordot(primal, [[1, 0]]));
    expectSame(A.contract(taped(W)), A.contract(W));
  });
});
