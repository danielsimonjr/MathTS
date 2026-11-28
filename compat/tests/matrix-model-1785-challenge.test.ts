/**
 * Challenge tests for PR #1816 / #1785: mathjs 15.3.0 unit-suite cases that
 * still fail against `create(all)` (mocha loader harness, 8 failures).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);
const DenseMatrix = math.DenseMatrix as unknown as new (data?: unknown) => {
  get: (index: unknown, col?: unknown) => unknown;
  subset: (...args: unknown[]) => unknown;
  toArray: () => unknown;
};
const ImmutableDenseMatrix = math.ImmutableDenseMatrix as unknown as new (data?: unknown) => {
  get: (index: unknown, col?: unknown) => unknown;
};
const Range = math.Range;
const index = math.index;
const subset = math.subset;
const sparse = math.sparse as unknown as (
  data?: unknown,
  datatype?: string
) => {
  _values: unknown;
  datatype?: () => string | undefined;
};
const subtract = math.subtract;
const bignumber = math.bignumber;
const matrix = math.matrix;

describe('mathjs 15.3.0 matrix oracle remaining gaps (#1785 challenge)', () => {
  it('DenseMatrix#get throws on two numeric arguments (mathjs: Array expected for index)', () => {
    const m = new DenseMatrix([
      [0, 1],
      [2, 3],
    ]);
    expect(() => m.get(1, 1)).toThrow(/Array expected/);
  });

  it('ImmutableDenseMatrix#get throws on two numeric arguments', () => {
    const m = new ImmutableDenseMatrix([
      [0, 1],
      [2, 3],
    ]);
    expect(() => m.get(1, 1)).toThrow(/Array expected/);
  });

  it('DenseMatrix#subset with 0 or 4 arguments throws Wrong number of arguments', () => {
    const m = new DenseMatrix();
    expect(() => m.subset()).toThrow(/Wrong number of arguments/);
    expect(() => m.subset(1, 2, 3, 4)).toThrow(/Wrong number of arguments/);
  });

  it('DenseMatrix#subset unsqueezes a 1-D replacement into a 1x3x1 matrix', () => {
    const m = new DenseMatrix([[[0], [0], [0]]]);
    m.subset(index(0, new Range(0, 3), 0), [1, 2, 3]);
    expect(m.toArray()).toEqual([[[1], [2], [3]]]);
  });

  it('sparse(matrix) clones _values (identity constructor)', () => {
    const b = sparse([
      [1, 2],
      [3, 4],
    ]);
    const c = sparse(b);
    expect(c._values).not.toBe(b._values);
  });

  it('sparse(matrix, number) clones _values and keeps datatype', () => {
    const b = sparse(
      [
        [1, 2],
        [3, 4],
      ],
      'number'
    );
    const c = sparse(b);
    expect(c._values).not.toBe(b._values);
    expect(c.datatype?.()).toBe('number');
  });

  it('subset leaves a matrix unchanged when the index is empty', () => {
    const g = matrix([
      [1, 2],
      [3, 4],
    ]);
    expect(subset(g, index([], 1), 1)).toBe(g);
    expect(subset(g, index(1, new Range(0, 0)), 1)).toBe(g);
  });

  it('subtract mixed booleans and bignumbers stays on BigNumber', () => {
    const result = subtract(bignumber(1.1), true) as { toString(): string };
    expect(math.isBigNumber(result)).toBe(true);
    expect(result.toString()).toBe('0.1');
  });
});
