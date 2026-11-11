/**
 * #747 — TapedTensor.add/mul must broadcast like Tensor (MLP bias, linear w[n]*x[1]).
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '../src/tape.js';
import { DualTensor } from '../src/dual-tensor.js';

function assertClose(a: Float64Array, b: Float64Array, tol = 1e-7): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i] - b[i])).toBeLessThan(tol);
  }
}

describe('TapedTensor broadcasting (#747)', () => {
  it('exact issue repro: x@W + b with b shape [1, H]', () => {
    const x = new Tensor(
      [4, 2],
      Float64Array.from({ length: 8 }, (_, i) => i)
    );
    const W = new Tensor(
      [2, 4],
      Float64Array.from({ length: 8 }, (_, i) => 0.1 * (i + 1))
    );
    const b = new Tensor([1, 4], new Float64Array(4));

    const yPlain = x.matMul(W).add(b);
    expect([...yPlain.shape]).toEqual([4, 4]);

    const tape = new Tape();
    const xT = TapedTensor.fromTensorAsInput(x, tape);
    const wT = TapedTensor.fromTensorAsInput(W, tape);
    const bT = TapedTensor.fromTensorAsInput(b, tape);
    const yT = xT.matmul(wT).add(bT);
    expect([...yT.shape]).toEqual([4, 4]);
    expect([...yT.toPrimalTensor().data]).toEqual([...yPlain.data]);
  });

  it('add(number) does not throw different Tapes', () => {
    const tape = new Tape();
    const t = TapedTensor.fromTensorAsInput(Tensor.fromNested([1, 2, 3], [3]), tape);
    const out = t.add(1);
    expect([...out.primal]).toEqual([2, 3, 4]);
    tape.backward(out.id, new Float64Array(3).fill(1));
    const g = tape.getInputGrad(t.id)!;
    expect([...g]).toEqual([1, 1, 1]);
  });

  it('mul [32] with [1] linear regression weight', () => {
    const tape = new Tape();
    const x = TapedTensor.fromTensorAsInput(
      new Tensor(
        [32],
        Float64Array.from({ length: 32 }, (_, i) => i)
      ),
      tape
    );
    const w = TapedTensor.fromTensorAsInput(new Tensor([1], new Float64Array([2.5])), tape);
    const out = x.mul(w);
    expect(out.shape).toEqual([32]);
    expect(out.primal[0]).toBe(0);
    expect(out.primal[1]).toBe(2.5);
  });

  it('reverse-mode add broadcast: grad vs central finite differences', () => {
    const B = 2;
    const H = 3;
    const xData = Float64Array.from([1, 2, 3, 4, 5, 6]);
    const bData = new Float64Array([10, 20, 30]);

    const tape = new Tape();
    const { id: xId } = tape.allocate(xData.length);
    const { id: bId } = tape.allocate(bData.length);
    const xT = new TapedTensor([B, H], xData, tape, xId);
    const bT = new TapedTensor([H], bData, tape, bId);
    const yT = xT.add(bT);
    tape.backward(yT.id, new Float64Array(yT.primal.length).fill(1));

    const gradX = new Float64Array(tape.getInputGrad(xId)!);
    const gradB = new Float64Array(tape.getInputGrad(bId)!);

    const eps = 1e-6;
    const numGradB = new Float64Array(bData.length);
    for (let i = 0; i < bData.length; i++) {
      const plus = new Float64Array(bData);
      const minus = new Float64Array(bData);
      plus[i] += eps;
      minus[i] -= eps;
      const sum = (bd: Float64Array) => {
        let s = 0;
        for (let r = 0; r < B; r++) {
          for (let c = 0; c < H; c++) {
            s += xData[r * H + c] + bd[c];
          }
        }
        return s;
      };
      numGradB[i] = (sum(plus) - sum(minus)) / (2 * eps);
    }
    assertClose(gradB, numGradB, 1e-5);
    expect(gradB[0]).toBe(B);
    for (let i = 0; i < gradX.length; i++) expect(gradX[i]).toBe(1);
  });

  it('reverse-mode mul broadcast [n] * [1]: weight grad is sum of x * upstream', () => {
    const n = 8;
    const xData = Float64Array.from({ length: n }, (_, i) => i + 1);
    const wData = new Float64Array([3]);
    const tape = new Tape();
    const { id: xId } = tape.allocate(n);
    const { id: wId } = tape.allocate(1);
    const xT = new TapedTensor([n], xData, tape, xId);
    const wT = new TapedTensor([1], wData, tape, wId);
    const yT = xT.mul(wT);
    tape.backward(yT.id, new Float64Array(n).fill(1));

    const gradW = tape.getInputGrad(wId)![0];
    const expectedW = xData.reduce((s, v) => s + v, 0);
    expect(gradW).toBeCloseTo(expectedW, 10);
  });

  it('forward matches NumPy-style Tensor.add for [2,3]+[1,3]', () => {
    const a = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    const b = new Tensor([1, 3], new Float64Array([10, 20, 30]));
    const ref = a.add(b);
    const tape = new Tape();
    const yT = TapedTensor.fromTensorAsInput(a, tape).add(TapedTensor.fromTensorAsInput(b, tape));
    expect([...yT.shape]).toEqual([...ref.shape]);
    expect([...yT.primal]).toEqual([...ref.data]);
  });
});

describe('DualTensor broadcasting (#747)', () => {
  it('add [2,3] + [1,3] forward', () => {
    const a = new DualTensor(
      [2, 3],
      new Float64Array([1, 2, 3, 4, 5, 6]),
      new Float64Array(6).fill(1)
    );
    const b = new DualTensor(
      [1, 3],
      new Float64Array([10, 20, 30]),
      new Float64Array([0.1, 0.2, 0.3])
    );
    const out = a.add(b);
    expect(out.shape).toEqual([2, 3]);
    expect(out.primal[0]).toBe(11);
    expect(out.tangent[0]).toBeCloseTo(1.1, 12);
  });

  it('mul [32] * [1]', () => {
    const x = new DualTensor(
      [32],
      Float64Array.from({ length: 32 }, (_, i) => i),
      new Float64Array(32).fill(1)
    );
    const w = new DualTensor([1], new Float64Array([2]), new Float64Array([0.5]));
    const out = x.mul(w);
    expect(out.shape).toEqual([32]);
    expect(out.primal[1]).toBe(2);
    // (x·w)' = x'·w + x·w' at i=1: 1·2 + 1·0.5
    expect(out.tangent[1]).toBeCloseTo(2.5, 12);
  });
});
