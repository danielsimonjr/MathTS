/**
 * Line coverage for exported #1785 surface helpers (not exhaustive oracle parity).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import {
  compareMixedTypes,
  createCompatMixedTypeReducer,
  forwardSubsetArgs,
} from '../src/mathjs-parity-1785-surfaces.js';
import {
  isCompatWrappedMatrix,
  promoteToCompatMatrix,
  readMatrixDatatype,
  stampMatrixDatatype,
} from '../src/compat-matrix-model.js';

const math = create(all);

describe('mathjs-parity-1785-surfaces unit coverage', () => {
  it('compareMixedTypes and mixed reducers handle numbers and strings', () => {
    expect(compareMixedTypes(1, 3)).toBe(-1);
    expect(compareMixedTypes('5', 3)).toBe(1);
    const max = createCompatMixedTypeReducer((a, b) => compareMixedTypes(a, b) > 0, true);
    expect(max(1, '9', 3)).toBe('9');
    const min = createCompatMixedTypeReducer((a, b) => compareMixedTypes(a, b) < 0, false);
    expect(min('2', 5)).toBe('2');
  });

  it('forwardSubsetArgs forwards one through four arguments', () => {
    const calls: unknown[][] = [];
    const subset = (...args: unknown[]) => {
      calls.push(args);
      return args.length;
    };
    expect(forwardSubsetArgs(subset, 1)).toBe(1);
    expect(forwardSubsetArgs(subset, 1, 2)).toBe(2);
    expect(forwardSubsetArgs(subset, 1, 2, 3)).toBe(3);
    expect(forwardSubsetArgs(subset, 1, 2, 3, 4)).toBe(4);
    expect(calls).toEqual([[1], [1, 2], [1, 2, 3], [1, 2, 3, 4]]);
  });

  it('promoteToCompatMatrix and datatype helpers stamp compat wrappers', () => {
    const raw = math.matrix([1, 2, 3]);
    const wrapped = promoteToCompatMatrix(raw);
    expect(isCompatWrappedMatrix(wrapped)).toBe(true);
    stampMatrixDatatype(wrapped, 'number');
    expect(readMatrixDatatype(wrapped)).toBe('number');
  });

  it('legacy subset off keeps a scalar matrix GET as a matrix', () => {
    const m = math.matrix([1, 2, 3]);
    const col = (m as { subset: (i: unknown) => unknown }).subset(math.index(1));
    expect(math.isMatrix(col)).toBe(true);
  });
});
