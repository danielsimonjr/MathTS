/**
 * P7-10 pins: unified strided contraction matches the old triple loops bit-exactly.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '../src/tape.js';

function fill(shape: number[], seed: number): Tensor {
  let s = seed >>> 0;
  const n = shape.reduce((a, b) => a * b, 1);
  const data = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    data[i] = s / 0x100000000 - 0.5;
  }
  return new Tensor(shape, data);
}

function refMatmul(
  a: Float64Array,
  b: Float64Array,
  batch: number,
  m: number,
  k: number,
  n: number
) {
  const y = new Float64Array(batch * m * n);
  for (let bi = 0; bi < batch; bi++) {
    const aOff = bi * m * k;
    const bOff = bi * k * n;
    const yOff = bi * m * n;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let q = 0; q < k; q++) sum += a[aOff + i * k + q] * b[bOff + q * n + j];
        y[yOff + i * n + j] = sum;
      }
    }
  }
  return y;
}

function refGradA(
  dY: Float64Array,
  b: Float64Array,
  batch: number,
  m: number,
  k: number,
  n: number
) {
  const dA = new Float64Array(batch * m * k);
  for (let bi = 0; bi < batch; bi++) {
    const dYOff = bi * m * n;
    const bOff = bi * k * n;
    const dAOff = bi * m * k;
    for (let i = 0; i < m; i++) {
      for (let q = 0; q < k; q++) {
        let sum = 0;
        for (let j = 0; j < n; j++) sum += dY[dYOff + i * n + j] * b[bOff + q * n + j];
        dA[dAOff + i * k + q] = sum;
      }
    }
  }
  return dA;
}

function refGradB(
  a: Float64Array,
  dY: Float64Array,
  batch: number,
  m: number,
  k: number,
  n: number
) {
  const dB = new Float64Array(batch * k * n);
  for (let bi = 0; bi < batch; bi++) {
    const aOff = bi * m * k;
    const dYOff = bi * m * n;
    const dBOff = bi * k * n;
    for (let q = 0; q < k; q++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let i = 0; i < m; i++) sum += a[aOff + i * k + q] * dY[dYOff + i * n + j];
        dB[dBOff + q * n + j] = sum;
      }
    }
  }
  return dB;
}

function checkShape(batch: number, m: number, k: number, n: number, seed: number) {
  const aT = fill(batch === 0 ? [m, k] : [batch, m, k], seed);
  const bT = fill(batch === 0 ? [k, n] : [batch, k, n], seed + 1);
  const B = batch === 0 ? 1 : batch;
  const tape = new Tape();
  const A = TapedTensor.fromTensorAsInput(aT, tape);
  const Bt = TapedTensor.fromTensorAsInput(bT, tape);
  const Y = A.matmul(Bt);
  const y = Y.toPrimalTensor().data;
  expect(Array.from(y)).toEqual(
    Array.from(refMatmul(new Float64Array(aT.data), new Float64Array(bT.data), B, m, k, n))
  );
  const ones = new Float64Array(y.length).fill(1);
  tape.backward(Y.id, ones);
  expect(Array.from(tape.getInputGrad(A.id)!)).toEqual(
    Array.from(refGradA(ones, new Float64Array(bT.data), B, m, k, n))
  );
  expect(Array.from(tape.getInputGrad(Bt.id)!)).toEqual(
    Array.from(refGradB(new Float64Array(aT.data), ones, B, m, k, n))
  );
}

describe('P7-10 batched matmul contract', () => {
  it('8×2×3×4 Y/dA/dB match the old loops', () => checkShape(8, 2, 3, 4, 0xad0802));
  it('8×8×8×8 Y/dA/dB match the old loops', () => checkShape(8, 8, 8, 8, 0xad0808));
  it('4×32×16×24 Y/dA/dB match the old loops', () => checkShape(4, 32, 16, 24, 0xad0432));
  it('1×128×96×112 Y/dA/dB match the old loops', () => checkShape(1, 128, 96, 112, 0xad0001));
  it('rank-2 5×6 @ 6×7 matches the old loops', () => checkShape(0, 5, 6, 7, 0xad0005));
});
