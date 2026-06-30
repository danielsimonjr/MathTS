import { describe, it, expect } from 'vitest';
import { Tape, TapedTensor } from '../src/tape.js';

/**
 * GC9 — variable-exponent power AD: y = a^b with both a and b on the tape.
 * Adjoints: dA = b·a^(b-1), dB = a^b·ln(a); aliased a^a: a^a·(ln a + 1).
 * Verified against central finite differences and closed forms.
 */

function reverseGradTwo(
  fn: (a: TapedTensor, b: TapedTensor) => TapedTensor,
  aData: Float64Array,
  bData: Float64Array,
  shape: ReadonlyArray<number>
): { gradA: Float64Array; gradB: Float64Array; value: Float64Array } {
  const tape = new Tape();
  const { id: idA } = tape.allocate(aData.length);
  const { id: idB } = tape.allocate(bData.length);
  const a = new TapedTensor(shape, new Float64Array(aData), tape, idA);
  const b = new TapedTensor(shape, new Float64Array(bData), tape, idB);
  const out = fn(a, b);
  tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
  return {
    gradA: new Float64Array(tape.getInputGrad(idA)!),
    gradB: new Float64Array(tape.getInputGrad(idB)!),
    value: new Float64Array(out.primal),
  };
}

function fdGrad(f: (x: number) => number, x: number, eps = 1e-6): number {
  return (f(x + eps) - f(x - eps)) / (2 * eps);
}

describe('GC9: TapedTensor.pow(taped, taped)', () => {
  const aData = new Float64Array([2, 3, 1.5, 4]);
  const bData = new Float64Array([3, 2, 2.5, 0.5]);
  const shape = [4];

  it('forward value equals a^b elementwise', () => {
    const { value } = reverseGradTwo((a, b) => a.pow(b), aData, bData, shape);
    for (let i = 0; i < value.length; i++) {
      expect(value[i]).toBeCloseTo(Math.pow(aData[i], bData[i]), 10);
    }
  });

  it('dA = b·a^(b-1) (closed form + finite diff)', () => {
    const { gradA } = reverseGradTwo((a, b) => a.pow(b), aData, bData, shape);
    for (let i = 0; i < gradA.length; i++) {
      const closed = bData[i] * Math.pow(aData[i], bData[i] - 1);
      const fd = fdGrad((x) => Math.pow(x, bData[i]), aData[i]);
      expect(gradA[i]).toBeCloseTo(closed, 8);
      expect(gradA[i]).toBeCloseTo(fd, 5);
    }
  });

  it('dB = a^b·ln(a) (closed form + finite diff)', () => {
    const { gradB } = reverseGradTwo((a, b) => a.pow(b), aData, bData, shape);
    for (let i = 0; i < gradB.length; i++) {
      const closed = Math.pow(aData[i], bData[i]) * Math.log(aData[i]);
      const fd = fdGrad((x) => Math.pow(aData[i], x), bData[i]);
      expect(gradB[i]).toBeCloseTo(closed, 8);
      expect(gradB[i]).toBeCloseTo(fd, 5);
    }
  });

  it('aliased a^a: gradient is a^a·(ln a + 1)', () => {
    const tape = new Tape();
    const { id } = tape.allocate(aData.length);
    const a = new TapedTensor(shape, new Float64Array(aData), tape, id);
    const out = a.pow(a);
    tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
    const grad = tape.getInputGrad(id)!;
    for (let i = 0; i < grad.length; i++) {
      const expected = Math.pow(aData[i], aData[i]) * (Math.log(aData[i]) + 1);
      const fd = fdGrad((x) => Math.pow(x, x), aData[i]);
      expect(grad[i]).toBeCloseTo(expected, 7);
      expect(grad[i]).toBeCloseTo(fd, 4);
    }
  });

  it('fixed-exponent pow(number) still works', () => {
    const tape = new Tape();
    const { id } = tape.allocate(aData.length);
    const a = new TapedTensor(shape, new Float64Array(aData), tape, id);
    const out = a.pow(2);
    tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
    const grad = tape.getInputGrad(id)!;
    for (let i = 0; i < grad.length; i++) {
      expect(out.primal[i]).toBeCloseTo(aData[i] * aData[i], 10);
      expect(grad[i]).toBeCloseTo(2 * aData[i], 10);
    }
  });
});
