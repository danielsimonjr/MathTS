/**
 * Sprint 2R clone-merge batch 3 (G19–G23, G26): independent oracles pinned
 * against the merged helpers (`snapNumber`/`snapBig`, factory `_matrixNormSum`,
 * core `flatten`, `reduceNumbers`, `hermiteCubic`), not a round-trip through a
 * sibling public path.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { setEqual, setDisjoint, solveDDE, solveODE } from '../src/index.js';
import { factory_ceil, factory_floor, factory_norm, matrix } from '../src/factories/index.js';
import { flatten } from '../src/utils/array.js';
import { fuseUnaryChainReduceAsync } from '../src/typed/fused.js';
import { reduceNumbers } from '../src/gpu/elementwise-gpu.js';
import { snapBig, snapNumber } from '../src/arithmetic/snap-to-round.js';
import { hermiteCubic } from '../src/numeric/hermite.js';
import { nearlyEqual as bigNearlyEqual } from '../src/utils/bignumber/nearlyEqual.js';
import { disableGpu, enableGpu } from '@danielsimonjr/mathts-gpu';
import { DEFAULT_CONFIG } from '../src/core/config.js';

const nm = factory_norm as (x: unknown, p?: unknown) => number;
const ceilNum = factory_ceil as (x: number) => number;
const floorNum = factory_floor as (x: number) => number;

const REL = DEFAULT_CONFIG.relTol;
const ABS = DEFAULT_CONFIG.absTol;

/** Independent nearlyEqual (IEEE abs(a-b) <= max(rel·max(|a|,|b|), abs)). */
function nearlyEqualOracle(a: number, b: number, rel = REL, abs = ABS): boolean {
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  if (a === b) return true;
  return Math.abs(a - b) <= Math.max(rel * Math.max(Math.abs(a), Math.abs(b)), abs);
}

/** Left-to-right depth-first flatten (oracle for G22). */
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
    const x = 2 - REL;
    expect(Math.floor(x)).toBe(1);
    expect(nearlyEqualOracle(x, 2)).toBe(true);
    expect(nearlyEqualOracle(x, 1)).toBe(false);
    expect(floorNum(x)).toBe(2);
    expect(snapNumber(x, Math.floor, Math.round, REL, ABS)).toBe(2);
  });

  it('ceil prefers round when x is indistinguishable from the integer but not from ceil', () => {
    const x = 2 + REL;
    expect(Math.ceil(x)).toBe(3);
    expect(nearlyEqualOracle(x, 2)).toBe(true);
    expect(nearlyEqualOracle(x, 3)).toBe(false);
    expect(ceilNum(x)).toBe(2);
    expect(snapNumber(x, Math.ceil, Math.round, REL, ABS)).toBe(2);
  });

  it('half-integers keep directed rounding (ceil vs floor)', () => {
    expect(floorNum(2.5)).toBe(2);
    expect(ceilNum(2.5)).toBe(3);
    expect(floorNum(-2.5)).toBe(-3);
    expect(ceilNum(-2.5)).toBe(-2);
  });
});

describe('clone batch3 pin — BigNumber snapBig (G20)', () => {
  const bne = (a: BigNumber, b: BigNumber): boolean => bigNearlyEqual(a, b, REL, ABS);
  const towardCeil = (v: BigNumber): BigNumber => v.ceil();
  const towardFloor = (v: BigNumber): BigNumber => v.floor();
  const roundBN = (v: BigNumber): BigNumber => v.round(0);

  it('±2.5 keep directed rounding toward ±infinity', () => {
    const p = BigNumber.parse('2.5');
    const n = BigNumber.parse('-2.5');
    expect(snapBig(p, towardFloor, roundBN, bne).toNumber()).toBe(2);
    expect(snapBig(p, towardCeil, roundBN, bne).toNumber()).toBe(3);
    expect(snapBig(n, towardFloor, roundBN, bne).toNumber()).toBe(-3);
    expect(snapBig(n, towardCeil, roundBN, bne).toNumber()).toBe(-2);
  });

  it('a value within relTol of an integer snaps to that integer', () => {
    // 3 − 1e-12: floor would be 2, round is 3; nearlyEqual(x, 3) and not nearlyEqual(x, 2).
    const below = BigNumber.parse('2.999999999999');
    expect(below.floor().toNumber()).toBe(2);
    expect(below.round(0).toNumber()).toBe(3);
    expect(bne(below, BigNumber.fromNumber(3))).toBe(true);
    expect(bne(below, BigNumber.fromNumber(2))).toBe(false);
    expect(snapBig(below, towardFloor, roundBN, bne).toNumber()).toBe(3);

    const above = BigNumber.parse('3.000000000001');
    expect(above.ceil().toNumber()).toBe(4);
    expect(above.round(0).toNumber()).toBe(3);
    expect(bne(above, BigNumber.fromNumber(3))).toBe(true);
    expect(bne(above, BigNumber.fromNumber(4))).toBe(false);
    expect(snapBig(above, towardCeil, roundBN, bne).toNumber()).toBe(3);
  });
});

describe('clone batch3 pin — matrix 1 and ∞ norms via factory createNorm (G21)', () => {
  // Non-symmetric 2×2. Column sums |1|+|5|=6, |3|+|2|=5 → L1=6.
  // Row sums |1|+|3|=4, |5|+|2|=7 → L∞=7. Swapping axes would swap 6 and 7.
  const rows = [
    [1, 3],
    [5, 2],
  ];
  const A = matrix(rows);

  it('1-norm = max column sum (hand)', () => {
    const col0 = Math.abs(rows[0][0]) + Math.abs(rows[1][0]);
    const col1 = Math.abs(rows[0][1]) + Math.abs(rows[1][1]);
    expect(nm(A, 1)).toBeCloseTo(Math.max(col0, col1), 12);
  });

  it('∞-norm = max row sum (hand)', () => {
    const row0 = Math.abs(rows[0][0]) + Math.abs(rows[0][1]);
    const row1 = Math.abs(rows[1][0]) + Math.abs(rows[1][1]);
    expect(nm(A, Infinity)).toBeCloseTo(Math.max(row0, row1), 12);
  });

  it('non-square 2×3 distinguishes the same axis mapping', () => {
    const Brows = [
      [1, 10, 0],
      [2, 0, 3],
    ];
    const B = matrix(Brows);
    const l1 = Math.max(
      Math.abs(Brows[0][0]) + Math.abs(Brows[1][0]),
      Math.abs(Brows[0][1]) + Math.abs(Brows[1][1]),
      Math.abs(Brows[0][2]) + Math.abs(Brows[1][2])
    );
    const linf = Math.max(
      Math.abs(Brows[0][0]) + Math.abs(Brows[0][1]) + Math.abs(Brows[0][2]),
      Math.abs(Brows[1][0]) + Math.abs(Brows[1][1]) + Math.abs(Brows[1][2])
    );
    expect(l1).toBe(10);
    expect(linf).toBe(11);
    expect(nm(B, 1)).toBeCloseTo(l1, 12);
    expect(nm(B, Infinity)).toBeCloseTo(linf, 12);
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

  it('a nested JS Set is a leaf (shallow; not walked)', () => {
    const leaf = new Set([9, 8]);
    const input = [1, leaf, [2]];
    expect(flatten(input)).toEqual([1, leaf, 2]);
    expect(flatten(input)).toEqual(handFlatten(input));
  });

  it('set helpers see the same flatten semantics (nested multiset)', () => {
    expect(setEqual([[[1, 2]], 3], [1, 2, 3])).toBe(true);
    expect(setDisjoint([[[4]]], [[[5]]])).toBe(true);
  });
});

describe('clone batch3 pin — reduceNumbers CPU path (G23)', () => {
  const values = [1, -2, 4];
  const f64 = new Float64Array(values);
  const f32 = new Float32Array(values);
  const empty64 = new Float64Array(0);
  const empty32 = new Float32Array(0);

  beforeAll(() => disableGpu());
  afterAll(() => enableGpu());

  it('sum/min/max on [1, -2, 4] for Float64 and Float32 views', () => {
    const sum = values.reduce((a, b) => a + b, 0);
    const max = Math.max(...values);
    const min = Math.min(...values);
    expect(reduceNumbers(f64, 'sum')).toBe(sum);
    expect(reduceNumbers(f64, 'max')).toBe(max);
    expect(reduceNumbers(f64, 'min')).toBe(min);
    expect(reduceNumbers(f32, 'sum')).toBe(sum);
    expect(reduceNumbers(f32, 'max')).toBe(max);
    expect(reduceNumbers(f32, 'min')).toBe(min);
  });

  it('empty: sum 0, max -Infinity, min +Infinity (both views)', () => {
    expect(reduceNumbers(empty64, 'sum')).toBe(0);
    expect(reduceNumbers(empty64, 'max')).toBe(-Infinity);
    expect(reduceNumbers(empty64, 'min')).toBe(Number.POSITIVE_INFINITY);
    expect(reduceNumbers(empty32, 'sum')).toBe(0);
    expect(reduceNumbers(empty32, 'max')).toBe(-Infinity);
    expect(reduceNumbers(empty32, 'min')).toBe(Number.POSITIVE_INFINITY);
  });

  it('fuseUnaryChainReduceAsync CPU path agrees on [1, -2, 4]', async () => {
    expect(await fuseUnaryChainReduceAsync([], f64, 'sum')).toBe(3);
    expect(await fuseUnaryChainReduceAsync([], f64, 'max')).toBe(4);
    expect(await fuseUnaryChainReduceAsync([], f64, 'min')).toBe(-2);
  });
});

describe('clone batch3 pin — cubic Hermite dense output (G26)', () => {
  it('endpoints θ=0,1 reproduce ya/yb; midpoint of y=t³ is exact', () => {
    // Unique cubic with y(0)=0, y(1)=1, y'(0)=0, y'(1)=3 is y=t³.
    const ya = [0];
    const yb = [1];
    const fa = [0];
    const fb = [3];
    expect(hermiteCubic(0, 1, ya, yb, fa, fb, 0)).toEqual(ya);
    expect(hermiteCubic(0, 1, ya, yb, fa, fb, 1)).toEqual(yb);
    expect(hermiteCubic(0, 1, ya, yb, fa, fb, 0.5)[0]).toBeCloseTo(0.125, 12);
  });

  it('solveDDE dense output of y=t³ matches the cubic at 0, 1/2, 1', () => {
    const f = (t: number, _y: number[]) => [3 * t * t];
    const sol = solveDDE(f, [0, 1], (t: number) => [t * t * t], [100], { tol: 1e-12 });
    const yq = sol.yInterp as (t: number) => number;
    expect(yq(0)).toBeCloseTo(0, 10);
    expect(yq(1)).toBeCloseTo(1, 10);
    expect(yq(0.5)).toBeCloseTo(0.125, 10);
  });

  it('solveODE of y′=3t², y(0)=0 ends at y(1)=1 (cubic closed form)', () => {
    const sol = solveODE(
      (_t: unknown, _y: unknown) => 3 * (_t as number) * (_t as number),
      [0, 1],
      0,
      {
        tol: 1e-10,
      }
    ) as { y: number[] };
    expect(sol.y[0]).toBeCloseTo(0, 10);
    expect(sol.y[sol.y.length - 1]).toBeCloseTo(1, 8);
  });
});
