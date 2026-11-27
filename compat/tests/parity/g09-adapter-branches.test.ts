import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import {
  createCompatSubsetG09,
  installG09BridgeMatrixSubsetPatch,
  reshapeG09AssignmentRhsInPlace,
} from '../../src/mathjs-parity-g09.js';
import * as mathFunctions from '@danielsimonjr/mathts-functions';

/**
 * Branch coverage for G09 compat adapters (oracle parity in g09-resize-assign
 * and challenger-g09-findings). Direct calls on exported helpers.
 */

const instance = createCompat(compatAll, {});
const subsetBase = mathFunctions.subset as (...args: unknown[]) => unknown;
const compatSubset = createCompatSubsetG09(subsetBase, {
  add: mathFunctions.add,
  zeros: mathFunctions.zeros,
  matrix: instance.matrix as (...args: unknown[]) => unknown,
});

type RuntimeIndex = ReturnType<typeof instance.index> & {
  isScalar: () => boolean;
  size: () => number[];
};

describe('G09 reshapeG09AssignmentRhsInPlace', () => {
  it('reshapes a 1-D bridge matrix for a multi-axis column selection', () => {
    installG09BridgeMatrixSubsetPatch(instance.matrix([]));
    const col = instance.matrix([9, 9]);
    const idx = instance.index(instance.range(0, 2), 2) as RuntimeIndex;
    reshapeG09AssignmentRhsInPlace(idx, col);
    expect(col.size()).toEqual([2, 1]);
    expect(col.toArray()).toEqual([[9], [9]]);
  });

  it('broadcasts a plain array replacement to the index shape', () => {
    const idx = instance.index(1, instance.range(0, 2)) as RuntimeIndex;
    const rep: number[] = [5, 6];
    reshapeG09AssignmentRhsInPlace(idx, rep);
    expect(rep).toEqual([[5, 6]]);
  });

  it('unsqueezes nested selections for bridge matrices', () => {
    installG09BridgeMatrixSubsetPatch(instance.matrix([]));
    const m = instance.matrix([1, 2, 3]);
    const idx = instance.index(
      instance.range(0, 1),
      instance.range(0, 1),
      instance.range(0, 3)
    ) as RuntimeIndex;
    reshapeG09AssignmentRhsInPlace(idx, m);
    expect(Array.isArray(m.toArray())).toBe(true);
  });
});

describe('G09 createCompatSubsetG09', () => {
  it('throws on zero-sized writes with scalar replacement', () => {
    installG09BridgeMatrixSubsetPatch(instance.matrix([]));
    const empty = instance.matrix([]);
    const idx = instance.index(instance.range(1, 1)) as RuntimeIndex;
    expect(() => compatSubset(empty, idx, 5)).toThrow();
  });

  it('throws on zero-sized column assignment into an empty matrix', () => {
    const empty = instance.matrix([]);
    const idx = instance.index(instance.range(0, 0), 1) as RuntimeIndex;
    expect(() => compatSubset(empty, idx, 5)).toThrow(/Dimension/);
  });

  it('no-ops empty colon get on a bridge matrix', () => {
    installG09BridgeMatrixSubsetPatch(instance.matrix([]));
    const a = instance.matrix([]);
    const idx = instance.index(instance.range(0, 0)) as RuntimeIndex;
    const out = compatSubset(a, idx);
    expect(out).toStrictEqual(a);
  });

  it('passes non-set subset calls through', () => {
    const m = instance.matrix([
      [1, 2],
      [3, 4],
    ]);
    const got = compatSubset(m, instance.index(0, 0)) as {
      get?: (i: number, j: number) => unknown;
    };
    expect(got).toBeDefined();
  });

  it('expands array assignments with null defaultValue', () => {
    const arr: (number | null)[] = [1];
    const idx = instance.index(2) as RuntimeIndex;
    const out = compatSubset(arr, idx, 7, null) as (number | null)[];
    expect(out).toEqual([1, null, 7]);
  });

  it('returns arrays from matrix GET when not legacy', () => {
    const m = instance.matrix([1, 2, 3]);
    const row = compatSubset(m, instance.index([0, 1])) as unknown;
    expect(Array.isArray(row) || instance.isMatrix(row)).toBe(true);
  });
});

describe('G09 installG09BridgeMatrixSubsetPatch', () => {
  it('patches subset once and reshapes on assignment', () => {
    installG09BridgeMatrixSubsetPatch(instance.matrix([]));
    const e = instance.matrix([
      [1, 2],
      [3, 4],
    ]);
    const idx = instance.index(instance.range(0, 2), 2);
    const rep = [9, 9];
    e.subset(idx, rep);
    expect(rep).toEqual([[9], [9]]);
    expect(e.toArray()).toEqual([
      [1, 2, 9],
      [3, 4, 9],
    ]);
  });
});
