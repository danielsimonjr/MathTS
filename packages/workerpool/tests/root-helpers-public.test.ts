/**
 * The typed-array chunking helpers and `forEachMultiIndex` are public: the README lists them
 * on the root export surface under semver. Each one must import from the package root and run.
 */

import { describe, it, expect } from 'vitest';
import { chunkTyped, chunkPairTyped, forEachMultiIndex } from '../src/index.js';

describe('root public helpers (#957)', () => {
  it('chunkTyped splits a typed array into owned slices', () => {
    const chunks = chunkTyped(Float64Array.from([1, 2, 3, 4, 5]), 2);
    expect(chunks.map((c) => Array.from(c))).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks[0].buffer.byteLength).toBe(2 * Float64Array.BYTES_PER_ELEMENT);
  });

  it('chunkPairTyped slices two operands with the same ranges', () => {
    const pairs = chunkPairTyped(Float64Array.from([1, 2, 3]), Float64Array.from([4, 5, 6]), 2);
    expect(pairs.map(([a, b]) => [Array.from(a), Array.from(b)])).toEqual([
      [
        [1, 2],
        [4, 5],
      ],
      [[3], [6]],
    ]);
  });

  it('forEachMultiIndex visits a row-major odometer', () => {
    const seen: number[][] = [];
    forEachMultiIndex([2, 2], (idx) => seen.push([...idx]));
    expect(seen).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });
});
