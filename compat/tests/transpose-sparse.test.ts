/**
 * The compat `transpose` takes a sparse matrix of the factory layer (#1034). The expected value
 * comes from mathjs 15.2.0. Before, `math.transpose(math.sparse(...))` threw.
 */
import { describe, expect, it } from 'vitest';
import { all, create } from '../src/index.js';
import { transpose } from '../src/shims.js';

describe('compat transpose of a sparse matrix', () => {
  it('returns the transposed sparse matrix', () => {
    const math = create(all);
    const t = math.transpose(
      math.sparse([
        [1, 0, 3],
        [0, 2, 0],
      ]) as never
    ) as unknown as {
      storage(): string;
      valueOf(): unknown;
    };
    expect(t.storage()).toBe('sparse');
    expect(t.valueOf()).toEqual([
      [1, 0],
      [0, 2],
      [3, 0],
    ]);
  });
});

describe('compat transpose of a numeric scalar', () => {
  it('preserves a number through the shim and a compat instance', () => {
    const math = create(all);
    expect(transpose(1)).toBe(1);
    expect(math.transpose(-0)).toBe(-0);
    expect(math.transpose(2n)).toBe(2n);
  });

  it('preserves the value and type of numeric objects', () => {
    const math = create(all);
    const values = [math.bignumber('2.5'), math.fraction(1, 3), math.complex(2, 3)] as const;
    for (const value of values) {
      const result = math.transpose(value as unknown as Parameters<typeof math.transpose>[0]);
      expect(result).toEqual(value);
      expect(result).not.toBe(value);
    }
  });
});
