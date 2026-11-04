import { describe, it, expect } from 'vitest';
import { conv2 } from '../src/signal/conv.js';
import { sinc } from '../src/signal-filter-extra.js';

describe('batch E1 re-exports (conv2, sinc)', () => {
  it('conv2 identity kernel returns the input', () => {
    expect(
      conv2(
        [
          [1, 2],
          [3, 4],
        ],
        [[1]]
      )
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('conv2 full mode with a ones kernel', () => {
    expect(
      conv2(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [1, 1],
          [1, 1],
        ],
        'full'
      )
    ).toEqual([
      [1, 3, 2],
      [4, 10, 6],
      [3, 7, 4],
    ]);
  });

  it('sinc is normalised and vanishes at nonzero integers', () => {
    expect(sinc(0)).toBe(1);
    expect(sinc(1)).toBeCloseTo(0, 12);
    expect(sinc(0.5)).toBeCloseTo(2 / Math.PI, 12);
  });
});
