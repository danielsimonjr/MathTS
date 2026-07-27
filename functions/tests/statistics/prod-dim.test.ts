import { describe, it, expect } from 'vitest';
import { prod } from '../../src/factories/index.js';

describe('prod dim', () => {
  it('computes prod along dimension 0', () => {
    expect(
      prod(
        [
          [1, 2],
          [3, 4],
        ],
        0
      )
    ).toEqual([3, 8]);
  });

  it('computes prod along dimension 1', () => {
    expect(
      prod(
        [
          [1, 2],
          [3, 4],
        ],
        1
      )
    ).toEqual([2, 12]);
  });
});
