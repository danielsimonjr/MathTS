/**
 * The compat `transpose` takes a sparse matrix of the factory layer (#1034). The expected value
 * comes from mathjs 15.2.0. Before, `math.transpose(math.sparse(...))` threw.
 */
import { describe, expect, it } from 'vitest';
import { all, create } from '../src/index.js';

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
