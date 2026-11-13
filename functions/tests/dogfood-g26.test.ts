/**
 * Dogfood relay G26 — sort, median, lusolve packed, wasm sin policy (#712 #694 #711).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sort, median, lusolve, sin, loadWasm, isWasmLoaded } from '../src/index.js';
import { wasmPolicyAllows } from '../src/wasm/policy.js';

describe('G26 #712 sort on number[]', () => {
  it('sort([3,1,2]) matches ascending order', () => {
    expect(sort([3, 1, 2])).toEqual([1, 2, 3]);
  });

  it('NaN follows factory compare order (P7-9 parity)', () => {
    const a = [3, Number.NaN, 1];
    sort(a);
    expect(a[0]).toBe(1);
    expect(Number.isNaN(a[1])).toBe(true);
    expect(a[2]).toBe(3);
  });

  // The speed bound (within 1.5x of Float64Array.sort, issue #712) is the "sort-number" gate of
  // tools/test/wall-clock-gates.json. It runs in its own CI step, not in this suite.
  it('n=1e5 sort equals the native Float64Array.sort order', () => {
    const n = 100_000;
    const src: number[] = [];
    for (let i = 0; i < n; i++) src.push(Math.sin(i));
    const want = Array.from(new Float64Array(src).sort());
    const got = src.slice();
    sort(got);
    expect(got).toEqual(want);
  });
});

describe('G26 #712 median quickselect path', () => {
  it('matches partition oracle on small vectors', () => {
    const v = [3, -1, 5, 7, 2, 9, 1];
    expect(median(v)).toBe(3);
  });

  // The speed bound (under 0.25x of a full sort) is the "median-vs-sort" gate of
  // tools/test/wall-clock-gates.json. It runs in its own CI step, not in this suite.
  it('n=1e5 median equals the middle of the sorted data', () => {
    const odd = Array.from({ length: 100_001 }, (_, i) => Math.sin(i));
    const sortedOdd = odd.slice().sort((a, b) => a - b);
    expect(median(odd)).toBe(sortedOdd[50_000]);
    const even = odd.slice(0, 100_000);
    const sortedEven = even.slice().sort((a, b) => a - b);
    expect(median(even)).toBeCloseTo((sortedEven[49_999] + sortedEven[50_000]) / 2, 15);
  });

  it('median does not reorder its input', () => {
    const data = [5, 3, 9, 1, 7];
    median(data);
    expect(data).toEqual([5, 3, 9, 1, 7]);
  });
});

describe('G26 #694 lusolve uses packed matrix lu', () => {
  // The speed bound (within 1.2x of matrix lu + luSolve) is the "lusolve" gate of
  // tools/test/wall-clock-gates.json. It runs in its own CI step, not in this suite. The cause
  // of a slowdown that the gate would catch, an extra nested copy of U, is pinned here by
  // dogfood-g05-lusolve-packed.test.ts (a spy test that no toArray or get call happens).
  it('2×2 closed form', () => {
    const x = lusolve(
      [
        [4, 3],
        [6, 3],
      ],
      [10, 12]
    ) as number[][];
    expect(x[0][0]).toBeCloseTo(1, 10);
    expect(x[1][0]).toBeCloseTo(2, 10);
  });
});

describe('G26 #711 wasm sin policy at n=1e5', () => {
  beforeAll(async () => {
    await loadWasm();
  });

  it('n=1e5 is outside the measured sin WASM band', () => {
    expect(wasmPolicyAllows('array_sin_ptr', 1e5)).toBe(false);
    expect(isWasmLoaded()).toBe(true);
  });

  it('n=32768 stays inside the band when wasm is loaded', () => {
    expect(wasmPolicyAllows('array_sin_ptr', 32768)).toBe(true);
  });

  it('public sin(Float64Array) matches Math.sin after loadWasm', () => {
    const x = new Float64Array([0, Math.PI / 2, -1, 0.3]);
    const y = sin(x) as Float64Array;
    for (let i = 0; i < x.length; i++) {
      expect(y[i]).toBeCloseTo(Math.sin(x[i]), 12);
    }
  });
});

describe('G26 #688 singular fixtures still throw via packed lu', () => {
  const A = [
    [1, 2],
    [2, 4],
  ];
  const b = [1, 2];

  it('consistent singular throws', () => {
    expect(() => lusolve(A, b)).toThrow(/singular/i);
  });
});
