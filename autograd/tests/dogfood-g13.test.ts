import { describe, it, expect } from 'vitest';
import { Tensor, randomTensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor, grad, jacobian } from '../src/index.js';

const fdScalar = (f: (x: number) => number, x: number, eps = 1e-6) =>
  (f(x + eps) - f(x - eps)) / (2 * eps);

const fdVector = (f: (x: Float64Array) => number, x: Float64Array, eps = 1e-6): Float64Array => {
  const g = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const xp = new Float64Array(x);
    const xm = new Float64Array(x);
    xp[i] += eps;
    xm[i] -= eps;
    g[i] = (f(xp) - f(xm)) / (2 * eps);
  }
  return g;
};

describe('#756 second backward accumulates 2× not 3×', () => {
  it('issue exact repro', () => {
    const tape = new Tape();
    const x = TapedTensor.fromTensorAsInput(new Tensor([2], new Float64Array([1, 2])), tape);
    const y = x.square().sum();
    tape.backward(y.id, Float64Array.of(1));
    const g1 = [...tape.getInputGrad(x.id)!];
    expect(g1).toEqual([2, 4]);
    tape.backward(y.id, Float64Array.of(1));
    const g2 = [...tape.getInputGrad(x.id)!];
    expect(g2).toEqual([4, 8]);
    expect(g2[0] / g1[0]).toBe(2);
    expect(g2[1] / g1[1]).toBe(2);
  });
});

describe('#764 graph seal after backward prevents tape growth', () => {
  it('throws when recording a new forward without reset', () => {
    const param = new Tensor([4, 4], randomTensor([4, 4], { seed: 3 }).data);
    const tape = new Tape();
    const p = TapedTensor.fromTensorAsInput(param, tape);
    const y = p.mul(p).sum();
    tape.backward(y.id, Float64Array.of(1));
    expect(() => TapedTensor.fromTensorAsInput(param, tape)).toThrow(/consumed by backward/);
    tape.reset();
    expect(() => TapedTensor.fromTensorAsInput(param, tape)).not.toThrow();
  });
});

describe('#755 detach and noGrad', () => {
  it('detach breaks gradient to the source', () => {
    const tape = new Tape();
    const x = TapedTensor.fromTensorAsInput(new Tensor([2], new Float64Array([1, 2])), tape);
    const y = x.detach().square().sum();
    tape.backward(y.id, Float64Array.of(1), { retainGraph: true });
    expect([...tape.getInputGrad(x.id)!]).toEqual([0, 0]);
  });

  it('add(1) works without tape mismatch', () => {
    const tape = new Tape();
    const x = TapedTensor.fromTensorAsInput(new Tensor([3], new Float64Array([1, 2, 3])), tape);
    const y = x.add(1);
    expect([...y.primal]).toEqual([2, 3, 4]);
  });

  it('noGrad does not grow the tape node list', () => {
    const tape = new Tape();
    const x = TapedTensor.fromTensorAsInput(new Tensor([2], new Float64Array([1, 2])), tape);
    const n0 = (tape as unknown as { nodes: unknown[] }).nodes?.length ?? 0;
    tape.noGrad(() => {
      x.square();
    });
    const nodes = (tape as unknown as { nodes: unknown[] }).nodes;
    expect(nodes.length).toBe(n0);
  });
});

describe('#754 activations', () => {
  it('exports relu, softmax, gelu, sigmoid on prototype', () => {
    expect(typeof TapedTensor.prototype.relu).toBe('function');
    expect(typeof TapedTensor.prototype.softmax).toBe('function');
    expect(typeof TapedTensor.prototype.gelu).toBe('function');
    expect(typeof TapedTensor.prototype.sigmoid).toBe('function');
    expect(typeof TapedTensor.prototype.crossEntropy).toBe('function');
    expect(typeof TapedTensor.prototype.binaryCrossEntropy).toBe('function');
  });

  it('relu gradient matches finite differences', () => {
    const x = new Float64Array([0.5, -1, 2]);
    const tape = new Tape();
    const { id } = tape.allocate(3);
    const leaf = new TapedTensor([3], x, tape, id);
    const out = leaf.relu().sum();
    tape.backward(out.id, Float64Array.of(1), { retainGraph: true });
    const ana = tape.getInputGrad(id)!;
    const num = fdVector((d) => {
      let s = 0;
      for (let i = 0; i < d.length; i++) s += d[i] > 0 ? d[i] : 0;
      return s;
    }, x);
    for (let i = 0; i < 3; i++) expect(ana[i]).toBeCloseTo(num[i], 6);
  });

  it('XOR ReLU MLP reaches 4/4 training labels', () => {
    const X = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    const Y = [0, 1, 1, 0];
    let w1 = new Float64Array([0.5, -0.3, 0.2, 0.4, -0.1, 0.6, 0.25, -0.4]);
    let b1 = new Float64Array([0.1, -0.2, 0.05, -0.1]);
    let w2 = new Float64Array([0.7, -0.5, 0.3, -0.2]);
    let b2 = new Float64Array([0.0]);
    const lr = 0.8;

    const trainStep = (xi: number[], target: number) => {
      const tape = new Tape();
      const { id: idW1 } = tape.allocate(8);
      const { id: idB1 } = tape.allocate(4);
      const { id: idW2 } = tape.allocate(4);
      const { id: idB2 } = tape.allocate(1);
      const { id: idX } = tape.allocate(2);
      const leafX = new TapedTensor([1, 2], new Float64Array(xi), tape, idX);
      const leafW1 = new TapedTensor([2, 4], new Float64Array(w1), tape, idW1);
      const leafB1 = new TapedTensor([1, 4], new Float64Array(b1), tape, idB1);
      const leafW2 = new TapedTensor([4, 1], new Float64Array(w2), tape, idW2);
      const leafB2 = new TapedTensor([1, 1], new Float64Array(b2), tape, idB2);
      const h = leafX.matmul(leafW1).add(leafB1).relu();
      const logits = h.matmul(leafW2).add(leafB2);
      const loss = logits.sigmoid().binaryCrossEntropy(Float64Array.of(target));
      tape.backward(loss.id, Float64Array.of(1));
      w1 = new Float64Array(w1.map((v, i) => v - lr * tape.getInputGrad(idW1)![i]));
      b1 = new Float64Array(b1.map((v, i) => v - lr * tape.getInputGrad(idB1)![i]));
      w2 = new Float64Array(w2.map((v, i) => v - lr * tape.getInputGrad(idW2)![i]));
      b2 = new Float64Array([b2[0] - lr * tape.getInputGrad(idB2)![0]]);
    };

    for (let step = 0; step < 1200; step++) {
      const idx = step % 4;
      trainStep(X[idx], Y[idx]);
    }

    let correct = 0;
    for (let i = 0; i < 4; i++) {
      const tape = new Tape();
      const { id: idX } = tape.allocate(2);
      const leafX = new TapedTensor([1, 2], new Float64Array(X[i]), tape, idX);
      const leafW1 = new TapedTensor([2, 4], w1, tape, tape.allocate(8).id);
      const leafB1 = new TapedTensor([1, 4], b1, tape, tape.allocate(4).id);
      const leafW2 = new TapedTensor([4, 1], w2, tape, tape.allocate(4).id);
      const leafB2 = new TapedTensor([1, 1], b2, tape, tape.allocate(1).id);
      const logit = leafX.matmul(leafW1).add(leafB1).relu().matmul(leafW2).add(leafB2).primal[0];
      const pred = logit > 0 ? 1 : 0;
      if (pred === Y[i]) correct++;
    }
    expect(correct).toBe(4);
  });
});

describe('#763 reshape and grad on ranked tensors', () => {
  it('reshape exists and backward matches FD', () => {
    expect(typeof TapedTensor.prototype.reshape).toBe('function');
    const data = new Float64Array([1, 2, 3, 4]);
    const tape = new Tape();
    const { id } = tape.allocate(4);
    const leaf = new TapedTensor([2, 2], data, tape, id);
    const out = leaf.reshape([4]).square().sum();
    tape.backward(out.id, Float64Array.of(1), { retainGraph: true });
    const ana = tape.getInputGrad(id)!;
    const num = fdVector((d) => {
      let s = 0;
      for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      return s;
    }, data);
    for (let i = 0; i < 4; i++) expect(ana[i]).toBeCloseTo(num[i], 6);
  });

  it('sum keepDims records backward', () => {
    const data = new Float64Array([1, 2, 3, 4]);
    const tape = new Tape();
    const { id } = tape.allocate(4);
    const leaf = new TapedTensor([2, 2], data, tape, id);
    const out = leaf.sum(1, { keepDims: true });
    expect([...out.shape]).toEqual([2, 1]);
    tape.backward(out.id, new Float64Array([1, 1]), { retainGraph: true });
    expect([...tape.getInputGrad(id)!]).toEqual([1, 1, 1, 1]);
  });

  it('grad accepts Tensor shape [2,2]', () => {
    const t = new Tensor([2, 2], new Float64Array([1, 2, 3, 4]));
    const g = grad((x) => x.square().sum())(t);
    expect([...g]).toEqual([2, 4, 6, 8]);
  });

  it('jacobian on [2,2] input returns 4 rows', () => {
    const J = jacobian((x) => x.reshape([4]), new Tensor([2, 2], new Float64Array([1, 0, 0, 1])));
    expect(J.length).toBe(4);
    expect(J[0].length).toBe(4);
  });
});

describe('#754 softmax / CE finite differences', () => {
  it('softmax last-axis gradient', () => {
    const x = new Float64Array([1, 2, 3]);
    const shape = [3];
    const tape = new Tape();
    const { id } = tape.allocate(3);
    const leaf = new TapedTensor(shape, x, tape, id);
    const out = leaf.softmax().sum();
    tape.backward(out.id, Float64Array.of(1), { retainGraph: true });
    const ana = tape.getInputGrad(id)!;
    const num = fdVector((d) => {
      const m = Math.max(...d);
      let s = 0;
      const ex = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) {
        ex[i] = Math.exp(d[i] - m);
        s += ex[i];
      }
      let sum = 0;
      for (let i = 0; i < d.length; i++) sum += ex[i] / s;
      return sum;
    }, x);
    for (let i = 0; i < 3; i++) expect(ana[i]).toBeCloseTo(num[i], 5);
  });
});

describe('gelu FD', () => {
  it('matches central difference', () => {
    const x0 = 1.2;
    const tape = new Tape();
    const { id } = tape.allocate(1);
    const leaf = new TapedTensor([1], Float64Array.of(x0), tape, id);
    const out = leaf.gelu();
    tape.backward(out.id, Float64Array.of(1), { retainGraph: true });
    const ana = tape.getInputGrad(id)![0];
    const gelu = (x: number) => {
      const c = Math.sqrt(2 / Math.PI);
      const u = c * (x + 0.044715 * x * x * x);
      return 0.5 * x * (1 + Math.tanh(u));
    };
    expect(ana).toBeCloseTo(fdScalar(gelu, x0), 5);
  });
});
