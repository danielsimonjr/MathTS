import { describe, it, expect } from 'vitest';
import { Tape, TapedTensor } from '../src/index.js';

// #1017: binaryCrossEntropy takes logits, not probabilities, and does not reduce.
describe('TapedTensor.binaryCrossEntropy contract', () => {
  it('treats the input as logits and returns one loss per element', () => {
    const tape = new Tape();
    const { id } = tape.record([], 2, () => {});
    const x = new TapedTensor([2], Float64Array.of(0.8, 0.3), tape, id);
    const loss = x.binaryCrossEntropy([1, 0]);
    expect(loss.shape).toEqual([2]);
    expect(loss.primal[0]).toBeCloseTo(0.3711, 4); // -log(sigmoid(0.8))
    expect(loss.primal[1]).toBeCloseTo(0.8544, 4); // -log(1 - sigmoid(0.3))
    // Probabilities p would give -log(p) = 0.2231 and -log(1 - p) = 0.3567: not this result.
    expect(loss.primal[0]).not.toBeCloseTo(0.2231, 3);
  });

  it('accepts logit(p) to score probabilities', () => {
    const tape = new Tape();
    const { id } = tape.record([], 2, () => {});
    const logit = (p: number) => Math.log(p / (1 - p));
    const x = new TapedTensor([2], Float64Array.of(logit(0.8), logit(0.3)), tape, id);
    const loss = x.binaryCrossEntropy([1, 0]);
    expect(loss.primal[0]).toBeCloseTo(0.2231, 4);
    expect(loss.primal[1]).toBeCloseTo(0.3567, 4);
  });
});
