/**
 * mathjs 15.3.0 matrix model parity (#1785): compat constructor guards, jagged
 * arithmetic, sparse iterator.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);

const NEW_MSG = 'Constructor must be called with the new operator';

describe('matrix model #1785', () => {
  it('DenseMatrix without new throws SyntaxError', () => {
    const Dense = math.DenseMatrix as unknown as (...args: unknown[]) => unknown;
    expect(() => Dense()).toThrow(NEW_MSG);
  });

  it('ImmutableDenseMatrix without new throws SyntaxError', () => {
    const Imm = math.ImmutableDenseMatrix as unknown as (...args: unknown[]) => unknown;
    expect(() => Imm()).toThrow(NEW_MSG);
  });

  it('SparseMatrix without new throws SyntaxError', () => {
    const Sparse = math.SparseMatrix as unknown as (...args: unknown[]) => unknown;
    expect(() => Sparse()).toThrow(NEW_MSG);
  });

  it('add routes jagged nested arrays through the factory path', () => {
    expect(math.add(1, [[1, 2], [3] as unknown as number[]])).toEqual([[2, 3], [4]]);
  });

  it('sparse Symbol.iterator yields stored entries in column order', () => {
    const m = new math.SparseMatrix([
      [1, 0],
      [0, 2],
    ]);
    const entries = [...(m as Iterable<{ value: unknown; index: number[] }>)];
    expect(entries).toEqual([
      { value: 1, index: [0, 0] },
      { value: 2, index: [1, 1] },
    ]);
  });
});
