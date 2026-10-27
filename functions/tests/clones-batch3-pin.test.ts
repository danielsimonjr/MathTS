/**
 * Sprint 2R clone-merge batch 3 (G19–G23, G26): independent oracles pinned before
 * deduplicating `_ceilNumber`/`_floorNumber`, BigNumber snap, matrix 1/∞ norms,
 * flatten helpers, CPU/GPU partial reducers, and cubic Hermite.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { norm, setEqual, setDisjoint, solveDDE } from '../src/index.js';
import { factory_ceil, factory_floor } from '../src/factories/index.js';
import { flatten } from '../src/utils/array.js';
import { fuseUnaryChainReduceAsync } from '../src/typed/fused.js';
import { disableGpu, enableGpu } from '@danielsimonjr/mathts-gpu';
import { matrix } from '../src/factories/index.js';

const nm = norm as (x: unknown, p?: unknown) => number;
const ceilNum = factory_ceil as (x: number) => number;
const floorNum = factory_floor as (x: number) => number;

/** Left-to-right depth-first flatten (oracle for G22; matches core `flatten`). */
function handFlatten(arr: unknown[]): unknown[] {
  const result: unknown[] = [];
  const walk = (node: unknown[]): void => {
    for (const item of node) {
      if (Array.isArray(item)) walk(item);
      else result.push(item);
    }
  };
  walk(arr);
  return result;
}

describe('clone batch3 pin — ceil/floor nearlyEqual snap (G19)', () => {
  it('floor prefers round when x is indistinguishable from the integer but not from floor', () => {
    const x = 1.9999999999990905;
    expect(floorNum(x)).toBe(2);
    expect(Math.floor(x)).toBe(1);
  });

  it('ceil prefers round when x is indistinguishable from the integer but not from ceil', () => {
    const x = 2.0000000000009095;
    expect(ceilNum(x)).toBe(2);
    expect(Math.ceil(x)).toBe(3);
  });
});

describe('clone batch3 pin — matrix 1 and ∞ norms (G21)', () => {
  const A = matrix([
    [1, 3],
    [5, 2],
  ]);

  it('1-norm = max column sum (hand: 6)', () => {
    expect(nm(A, 1)).toBeCloseTo(6, 12);
  });

  it('∞-norm = max row sum (hand: 7)', () => {
    expect(nm(A, Infinity)).toBeCloseTo(7, 12);
  });
});

describe('clone batch3 pin — flatten order (G22)', () => {
  it('core flatten matches hand oracle: nested, jagged, empty', () => {
    const nested = [1, [2, [3, 4]], 5];
    const jagged = [[1], [2, 3], []];
    expect(flatten(nested)).toEqual(handFlatten(nested));
    expect(flatten(jagged)).toEqual(handFlatten(jagged));
    expect(flatten([])).toEqual([]);
  });

  it('depth 32 is flattened without truncation', () => {
    let deep: unknown[] = [0];
    for (let d = 0; d < 32; d++) deep = [deep];
    expect(flatten(deep)).toEqual(handFlatten(deep));
  });

  it('set helpers see the same flatten semantics (nested multiset)', () => {
    expect(setEqual([[[1, 2]], 3], [1, 2, 3])).toBe(true);
    expect(setDisjoint([[[4]]], [[[5]]])).toBe(true);
  });
});

describe('clone batch3 pin — reduceNumbers CPU path (G23)', () => {
  const xs = new Float64Array([1, -2, 4]);
  const empty = new Float64Array(0);

  beforeAll(() => disableGpu());
  afterAll(() => enableGpu());

  it('sum/min/max on [1, -2, 4]', async () => {
    expect(await fuseUnaryChainReduceAsync([], xs, 'sum')).toBe(3);
    expect(await fuseUnaryChainReduceAsync([], xs, 'max')).toBe(4);
    expect(await fuseUnaryChainReduceAsync([], xs, 'min')).toBe(-2);
  });

  it('empty: sum 0, max -Infinity, min +Infinity', async () => {
    expect(await fuseUnaryChainReduceAsync([], empty, 'sum')).toBe(0);
    expect(await fuseUnaryChainReduceAsync([], empty, 'max')).toBe(-Infinity);
    expect(await fuseUnaryChainReduceAsync([], empty, 'min')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('clone batch3 pin — cubic Hermite dense output (G26)', () => {
  it('y(t)=t³ on [0,1]: endpoints and midpoint match the exact cubic', () => {
    const f = (t: number, _y: number[]) => [3 * t * t];
    const sol = solveDDE(f, [0, 1], (t: number) => [t * t * t], [100], { tol: 1e-12 });
    const yq = sol.yInterp as (t: number) => number;
    expect(yq(0)).toBeCloseTo(0, 10);
    expect(yq(1)).toBeCloseTo(1, 10);
    expect(yq(0.5)).toBeCloseTo(0.125, 10);
  });
});
