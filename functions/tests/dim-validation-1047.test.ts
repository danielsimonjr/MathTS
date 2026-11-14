import { describe, it, expect } from 'vitest';
import { sum, cumsum } from '../src/index.js';

const call = (f: unknown, ...a: unknown[]) => (f as (...x: unknown[]) => unknown)(...a);

describe('dim validation in the factory functions (#1047)', () => {
  it('sum and cumsum throw an IndexError with a true relation', () => {
    expect(() => call(sum, [[1, 2]], 5)).toThrow('Index out of range (5 > 1)');
    expect(() =>
      call(
        cumsum,
        [
          [1, 2],
          [3, 4],
        ],
        8
      )
    ).toThrow('Index out of range (8 > 1)');
    expect(() =>
      call(
        cumsum,
        [
          [1, 2],
          [3, 4],
        ],
        -1
      )
    ).toThrow('Index out of range (-1 < 0)');
  });

  it('sum and cumsum reject a dim that is not an integer', () => {
    expect(() => call(sum, [[1, 2]], 1.5)).toThrow('Integer number expected for dimension');
    expect(() => call(sum, [[1, 2]], NaN)).toThrow('Integer number expected for dimension');
    expect(() => call(cumsum, [[1, 2]], 0.5)).toThrow('Integer number expected for dimension');
  });
});

describe('concat dim validation (#1047)', () => {
  it('throws an IndexError for an out-of-range dim, as mathjs does', async () => {
    const { concat } = await import('../src/index.js');
    expect(() => call(concat, [1], [2], 1)).toThrow('Index out of range (1 > 0)');
    expect(() => call(concat, [1], [2], -1)).toThrow('Index out of range (-1 < 0)');
    expect(call(concat, [1], [2], 0)).toEqual([1, 2]);
  });
});
