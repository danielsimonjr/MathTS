import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { all, create, subsetDependencies } from '../src/index.js';
import type { BridgeMatrix } from '@danielsimonjr/mathts-functions';

describe('sparse matrix subset compatibility', () => {
  const data = [
    [1, 0, 3],
    [0, 5, 6],
    [7, 8, 0],
  ];

  it('reads scalars and sparse selections through direct, instance, and selected calls', () => {
    const math = create(all);
    const selected = create({ subsetDependencies });
    const matrix = math.sparse(data);
    const expected = oracle.sparse(data);
    expect(matrix.subset(math.index(1, 1))).toBe(expected.subset(oracle.index(1, 1)));
    expect(math.subset(matrix, math.index(2, 2))).toBe(0);
    const evaluated = math.evaluate('s[2, [1, 3]]', { s: matrix }) as BridgeMatrix;
    expect(evaluated.toArray()).toEqual([[0, 6]]);

    for (const [rows, cols] of [
      [1, [0, 2]],
      [[0, 2], 1],
      [
        [2, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [0, 2],
      ],
    ] as const) {
      const rowIndex = typeof rows === 'number' ? rows : [...rows];
      const colIndex = typeof cols === 'number' ? cols : [...cols];
      const index = math.index(rowIndex, colIndex);
      const reference = expected.subset(oracle.index(rowIndex, colIndex)) as oracle.Matrix;
      for (const result of [
        matrix.subset(index),
        math.subset(matrix, index),
        selected.subset(matrix, index),
      ]) {
        const actual = result as BridgeMatrix;
        expect(actual.storage()).toBe('sparse');
        expect(actual.size()).toEqual(reference.size());
        expect(actual.toArray()).toEqual(reference.toArray());
      }
    }
  });

  it('writes sparse selections, keeps the standalone function immutable, and fills growth', () => {
    const math = create(all);
    const matrix = math.sparse(data);
    const expected = oracle.sparse(data);
    const replacement = [11, 12];
    const rowIndex = math.index(1, [0, 2]);
    const expectedIndex = oracle.index(1, [0, 2]);
    const result = math.subset(matrix, rowIndex, replacement) as BridgeMatrix;
    expect(result.storage()).toBe('sparse');
    expect(result.toArray()).toEqual(
      (oracle.subset(expected, expectedIndex, [...replacement]) as oracle.Matrix).toArray()
    );
    expect(matrix.toArray()).toEqual(data);
    expect(replacement).toEqual([11, 12]);

    expect(matrix.subset(math.index(4, 3), 20, 7)).toBe(matrix);
    expected.subset(oracle.index(4, 3), 20, 7);
    expect(matrix.toArray()).toEqual(expected.toArray());
    expect(matrix.subset(math.index([1, 3]), [30, 31])).toBe(matrix);
    expected.subset(oracle.index([1, 3]), [30, 31]);
    expect(matrix.toArray()).toEqual(expected.toArray());
    expect(() => matrix.subset(math.index(1, 1), [9])).toThrow('Scalar expected');
    expect(() => matrix.subset(math.index(-1, 0))).toThrow('Index out of range');
  });
});
