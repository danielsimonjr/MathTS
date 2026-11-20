/**
 * #992: `[...batch, m, k] @ [k, n]` (a weight shared by every batch entry) is one matrix product
 * of the folded rows. No operand is expanded to the batch, so the largest buffer that the forward
 * pass and the backward pass allocate is the size of an operand or of the result.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '../src/tape.js';

const fill = (shape: number[], seed: number): Tensor =>
  new Tensor(
    shape,
    Float64Array.from(
      { length: shape.reduce((p, d) => p * d, 1) },
      (_, i) => Math.sin(i * 0.7 + seed) + 1.5
    )
  );

/** The largest `Float64Array` or `Int32Array` length that `body` allocates. */
function largestAllocation(body: () => void): number {
  let largest = 0;
  const g = globalThis as unknown as Record<string, unknown>;
  const originals = { Float64Array: g.Float64Array, Int32Array: g.Int32Array };
  for (const name of ['Float64Array', 'Int32Array'] as const) {
    const Original = originals[name] as new (...a: unknown[]) => object;
    g[name] = class extends Original {
      constructor(...args: unknown[]) {
        super(...args);
        if (typeof args[0] === 'number' && args[0] > largest) largest = args[0];
      }
    };
  }
  try {
    body();
  } finally {
    g.Float64Array = originals.Float64Array;
    g.Int32Array = originals.Int32Array;
  }
  return largest;
}

describe('#992 TapedTensor.matmul with a shared right operand', () => {
  const batch = 8;
  const [m, k, n] = [4, 64, 64];

  it('allocates nothing of the size batch x k x n', () => {
    const aT = fill([batch, m, k], 1);
    const bT = fill([k, n], 2);
    const largest = largestAllocation(() => {
      const tape = new Tape();
      const A = TapedTensor.fromTensorAsInput(aT, tape);
      const B = TapedTensor.fromTensorAsInput(bT, tape);
      const Y = A.matmul(B);
      tape.backward(Y.id, new Float64Array(Y.primal.length).fill(1));
    });
    expect(largest).toBeLessThan(batch * k * n);
  });

  it('keeps the value of Tensor.matmul and the adjoint sum over the batch', () => {
    const aT = fill([batch, m, k], 1);
    const bT = fill([k, n], 2);
    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aT, tape);
    const B = TapedTensor.fromTensorAsInput(bT, tape);
    const Y = A.matmul(B);
    const want = aT.matmul(bT);
    expect([...Y.shape]).toEqual([...want.shape]);
    expect(Math.max(...Y.primal.map((v, i) => Math.abs(v - want.data[i]!)))).toBeLessThan(1e-12);
    tape.backward(Y.id, new Float64Array(Y.primal.length).fill(1));
    // dB[q][j] = sum over batch b and row i of A[b][i][q]  (the weights of dY are 1)
    const gradB = tape.getInputGrad(B.id)!;
    for (let q = 0; q < k; q++) {
      let colSum = 0;
      for (let r = 0; r < batch * m; r++) colSum += aT.data[r * k + q]!;
      for (let j = 0; j < n; j++) expect(Math.abs(gradB[q * n + j]! - colSum)).toBeLessThan(1e-9);
    }
  });
});
