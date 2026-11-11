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

  it('self-mul keeps the 2·a·a′ tangent', () => {
    const a = new DualTensor([2], new Float64Array([3, -4]), new Float64Array([0.5, 1]));
    const out = a.mul(a);
    expect([...out.primal]).toEqual([9, 16]);
    expect(out.tangent[0]).toBeCloseTo(2 * 3 * 0.5, 12);
    expect(out.tangent[1]).toBeCloseTo(2 * -4 * 1, 12);
  });

  it('tangent broadcasts on both sides and repeats the size-1 axis', () => {
    const a = new DualTensor([2, 1], new Float64Array([1, 2]), new Float64Array([0.5, -1]));
    const b = new DualTensor([1, 3], new Float64Array([10, 20, 30]), new Float64Array([1, 0, -2]));
    const out = a.mul(b);
    expect(out.shape).toEqual([2, 3]);
    // (a·b)' = a'·b + a·b' at [1,2]: (-1)·30 + 2·(-2)
    expect(out.tangent[5]).toBeCloseTo(-30 + -4, 12);
    expect(out.primal[5]).toBe(60);
  });
});

describe('TapedTensor broadcast probes (#747)', () => {
  function taped(tape: Tape, shape: number[], data: number[]): TapedTensor {
    return new TapedTensor(shape, Float64Array.from(data), tape, tape.allocate(data.length).id);
  }

  function lossGrads(
    op: 'add' | 'mul',
    aShape: number[],
    aData: number[],
    bShape: number[],
    bData: number[],
    upstream: number[]
  ): { a: Float64Array; b: Float64Array; primal: Float64Array; shape: number[] } {
    const tape = new Tape();
    const a = taped(tape, aShape, aData);
    const b = taped(tape, bShape, bData);
    const y = op === 'add' ? a.add(b) : a.mul(b);
    tape.backward(y.id, Float64Array.from(upstream));
    return {
      a: new Float64Array(tape.getInputGrad(a.id)!),
      b: new Float64Array(tape.getInputGrad(b.id)!),
      primal: y.primal,
      shape: [...y.shape],
    };
  }

  function finiteDifference(
    op: 'add' | 'mul',
    aShape: number[],
    aData: number[],
    bShape: number[],
    bData: number[],
    upstream: number[]
  ): { a: Float64Array; b: Float64Array } {
    const scalar = (ad: Float64Array, bd: Float64Array): number => {
      const y = new Tensor(aShape, ad)[op](new Tensor(bShape, bd));
      let s = 0;
      for (let i = 0; i < y.data.length; i++) s += y.data[i] * upstream[i];
      return s;
    };
    const eps = 1e-6;
    const grad = (data: number[], which: 'a' | 'b'): Float64Array => {
      const g = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) {
        const plus = Float64Array.from(data);
        const minus = Float64Array.from(data);
        plus[i] += eps;
        minus[i] -= eps;
        const aPlus = which === 'a' ? plus : Float64Array.from(aData);
        const bPlus = which === 'b' ? plus : Float64Array.from(bData);
        const aMinus = which === 'a' ? minus : Float64Array.from(aData);
        const bMinus = which === 'b' ? minus : Float64Array.from(bData);
        g[i] = (scalar(aPlus, bPlus) - scalar(aMinus, bMinus)) / (2 * eps);
      }
      return g;
    };
    return { a: grad(aData, 'a'), b: grad(bData, 'b') };
  }

  const cases: Array<{
    name: string;
    op: 'add' | 'mul';
    aShape: number[];
    a: number[];
    bShape: number[];
    b: number[];
    up: number[];
    out: number[];
  }> = [
    {
      name: 'rank promotion [3] + [2,3] and the swapped order',
      op: 'add',
      aShape: [3],
      a: [1, 2, 3],
      bShape: [2, 3],
      b: [10, 20, 30, 40, 50, 60],
      up: [1, 0, -1, 2, 3, 0.5],
      out: [2, 3],
    },
    {
      name: 'both axes size-1: [2,1] * [1,3]',
      op: 'mul',
      aShape: [2, 1],
      a: [1, 2],
      bShape: [1, 3],
      b: [10, 20, 30],
      up: [1, 0, -1, 2, 3, 0.5],
      out: [2, 3],
    },
    {
      name: 'middle size-1 and a shorter rank: [2,1,4] + [3,1]',
      op: 'add',
      aShape: [2, 1, 4],
      a: [1, 2, 3, 4, 5, 6, 7, 8],
      bShape: [3, 1],
      b: [10, 20, 30],
      up: Array.from({ length: 24 }, (_, i) => (i % 5) - 2),
      out: [2, 3, 4],
    },
    {
      name: 'scalar tensor [] * [2,2]',
      op: 'mul',
      aShape: [],
      a: [4],
      bShape: [2, 2],
      b: [1, 2, 3, 4],
      up: [1, -1, 0.5, 2],
      out: [2, 2],
    },
    {
      name: 'column vector against a row: [4,1] + [1,4]',
      op: 'add',
      aShape: [4, 1],
      a: [1, 2, 3, 4],
      bShape: [1, 4],
      b: [10, 20, 30, 40],
      up: Array.from({ length: 16 }, (_, i) => i - 7),
      out: [4, 4],
    },
  ];

  for (const c of cases) {
    it(`${c.op} ${c.name} matches finite differences on both sides`, () => {
      const rev = lossGrads(c.op, c.aShape, c.a, c.bShape, c.b, c.up);
      expect(rev.shape).toEqual(c.out);
      const plain = new Tensor(c.aShape, Float64Array.from(c.a))[c.op](
        new Tensor(c.bShape, Float64Array.from(c.b))
      );
      expect([...rev.primal]).toEqual([...plain.data]);
      const fd = finiteDifference(c.op, c.aShape, c.a, c.bShape, c.b, c.up);
      assertClose(rev.a, fd.a, 1e-6);
      assertClose(rev.b, fd.b, 1e-6);

      const swapped = lossGrads(c.op, c.bShape, c.b, c.aShape, c.a, c.up);
      expect(swapped.shape).toEqual(c.out);
      assertClose(swapped.a, fd.b, 1e-6);
      assertClose(swapped.b, fd.a, 1e-6);
    });
  }

  it('issue repro: bias grad sums over the batch, matrix grad matches finite differences', () => {
    const xData = Float64Array.from({ length: 8 }, (_, i) => i * 0.25);
    const wData = Float64Array.from({ length: 8 }, (_, i) => 0.1 * (i + 1));
    const bData = Float64Array.from([0.2, -0.3, 0.4, 0.1]);
    const upstream = Float64Array.from({ length: 16 }, (_, i) => (i % 3) - 1);

    const tape = new Tape();
    const x = TapedTensor.fromTensorAsInput(new Tensor([4, 2], xData), tape);
    const w = TapedTensor.fromTensorAsInput(new Tensor([2, 4], wData), tape);
    const b = TapedTensor.fromTensorAsInput(new Tensor([1, 4], bData), tape);
    const y = x.matmul(w).add(b);
    tape.backward(y.id, upstream);

    const bias = tape.getInputGrad(b.id)!;
    const biasExpected = new Float64Array(4);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) biasExpected[j] += upstream[i * 4 + j];
    }
    assertClose(bias, biasExpected, 1e-12);

    const eps = 1e-6;
    const loss = (wd: Float64Array): number => {
      const yv = new Tensor([4, 2], xData)
        .matMul(new Tensor([2, 4], wd))
        .add(new Tensor([1, 4], bData));
      let s = 0;
      for (let i = 0; i < yv.data.length; i++) s += yv.data[i] * upstream[i];
      return s;
    };
    const numW = new Float64Array(wData.length);
    for (let i = 0; i < wData.length; i++) {
      const plus = new Float64Array(wData);
      const minus = new Float64Array(wData);
      plus[i] += eps;
      minus[i] -= eps;
      numW[i] = (loss(plus) - loss(minus)) / (2 * eps);
    }
    assertClose(tape.getInputGrad(w.id)!, numW, 1e-6);
  });

  it('scalar add(1) and mul(2) accept the number on the right and a scalar tensor on the left', () => {
    const tape = new Tape();
    const row = taped(tape, [1, 3], [1, 2, 3]);
    const shifted = row.add(1);
    expect([...shifted.primal]).toEqual([2, 3, 4]);
    const scaled = row.mul(2);
    expect([...scaled.primal]).toEqual([2, 4, 6]);

    const scalar = taped(tape, [], [5]);
    const fromLeft = scalar.add(row);
    expect(fromLeft.shape).toEqual([1, 3]);
    expect([...fromLeft.primal]).toEqual([6, 7, 8]);
    tape.backward(fromLeft.id, Float64Array.from([1, 0, -2]));
    expect(tape.getInputGrad(scalar.id)![0]).toBe(1 + 0 + -2);
    expect([...tape.getInputGrad(row.id)!]).toEqual([1, 0, -2]);
  });

  it('incompatible shapes name both sides', () => {
    const tape = new Tape();
    const a = taped(tape, [2, 3], [1, 2, 3, 4, 5, 6]);
    const b = taped(tape, [4], [1, 2, 3, 4]);
    expect(() => a.add(b)).toThrow(/shapes \[2,3\] and \[4\] cannot be broadcast/);
    expect(() => b.mul(a)).toThrow(/shapes \[4\] and \[2,3\] cannot be broadcast/);
  });

  it('operands from different tapes are still rejected', () => {
    const a = taped(new Tape(), [2, 3], [1, 2, 3, 4, 5, 6]);
    const b = taped(new Tape(), [1, 3], [1, 2, 3]);
    expect(() => a.add(b)).toThrow(/different Tapes/);
    expect(() => a.mul(b)).toThrow(/different Tapes/);
    const same = new Tape();
    expect(() => taped(same, [2], [1, 2]).add(1)).not.toThrow();
  });

  it('same-shape add and self-mul gradients stay elementwise', () => {
    const tape = new Tape();
    const a = taped(tape, [2, 2], [1, 2, 3, 4]);
    const b = taped(tape, [2, 2], [10, 20, 30, 40]);
    const sum = a.add(b);
    tape.backward(sum.id, Float64Array.from([1, 2, 3, 4]));
    expect([...tape.getInputGrad(a.id)!]).toEqual([1, 2, 3, 4]);
    expect([...tape.getInputGrad(b.id)!]).toEqual([1, 2, 3, 4]);

    const tape2 = new Tape();
    const s = taped(tape2, [2], [3, -4]);
    const sq = s.mul(s);
    tape2.backward(sq.id, Float64Array.from([1, 1]));
    expect(tape2.getInputGrad(s.id)![0]).toBeCloseTo(6, 12);
    expect(tape2.getInputGrad(s.id)![1]).toBeCloseTo(-8, 12);
  });
});
