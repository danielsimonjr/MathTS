import { describe, it, expect } from 'vitest';
import {
  create,
  all,
  matrix,
  sparse,
  zeros,
  ones,
  identity,
  diag,
  reshape,
  resize,
  subset,
  transpose,
  size,
  count,
  trace,
} from '../src/index.js';

describe('shims matrix smoke', () => {
  const math = create(all);

  it('exercises matrix shims and helpers', () => {
    const z = zeros(2, 2);
    const o = ones(2, 2);
    const id = identity(2);
    expect(size(z)).toEqual([2, 2]);
    expect(size(o)).toEqual([2, 2]);
    expect(trace(id)).toBe(2);
    expect(trace(diag([1, 2, 3]))).toBe(6);
    expect(count([1, 2, 3])).toBe(3);
    const m = matrix([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    const sub = subset(m, math.index(0, [0, 1]));
    expect(sub).toBeDefined();
    expect(reshape(m, [3, 2])).toBeDefined();
    expect(transpose(m)).toBeDefined();
    const resized = resize(m, [2, 2]);
    expect(size(resized)).toEqual([2, 2]);
    const s = sparse([
      [1, 0],
      [0, 2],
    ]);
    expect(size(s)).toEqual([2, 2]);
    expect(math.isSparseMatrix(s)).toBe(true);
    expect(math.dot([1, 2], [3, 4])).toBe(11);
    expect(math.usolve(identity(2), [[1], [2]])).toBeDefined();
    expect(math.lusolve(identity(2), [[1], [2]])).toBeDefined();
  });
});
