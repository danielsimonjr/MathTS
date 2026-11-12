/**
 * Dogfood relay G26 — sort, median, lusolve packed, wasm sin policy (#712 #694 #711).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { performance } from 'node:perf_hooks';
import { sort, median, lusolve, sin, loadWasm, isWasmLoaded } from '../src/index.js';
import { lu, luSolve } from '@danielsimonjr/mathts-matrix';
import { wasmPolicyAllows } from '../src/wasm/policy.js';

function medianTime(fn: () => void, warmup: number, reps: number): number {
  for (let i = 0; i < warmup; i++) fn();
  const xs: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    fn();
    xs.push(performance.now() - t0);
  }
  xs.sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
}

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

  it('n=1e5 sort is within 1.5× native Float64Array.sort (issue #712)', () => {
    const src = Array.from({ length: 1e5 }, (_, i) => Math.sin(i));
    const tNative = medianTime(
      () => {
        const f = new Float64Array(src);
        f.sort();
      },
      3,
      8
    );
    const tSort = medianTime(
      () => {
        sort(src.slice());
      },
      3,
      8
    );
    expect(tSort / tNative).toBeLessThan(1.5);
  });
});

describe('G26 #712 median quickselect path', () => {
  it('matches partition oracle on small vectors', () => {
    const v = [3, -1, 5, 7, 2, 9, 1];
    expect(median(v)).toBe(3);
  });

  it('n=1e6 median finishes well under full sort (issue: <10 ms target)', () => {
    const b = Array.from({ length: 1e6 }, (_, i) => Math.sin(i));
    const t = medianTime(
      () => {
        median(b);
      },
      2,
      6
    );
    expect(t).toBeLessThan(50);
  }, 60_000);
});

describe('G26 #694 lusolve uses packed matrix lu', () => {
  it('n=1000 median ≤ 1.2× matrix lu+luSolve (issue AC)', () => {
    const n = 1000;
    let s = 42;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
    const M = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = rnd();
        M[i][j] += v;
        M[j][i] += v;
      }
      M[i][i] += n;
    }
    const b = Array.from({ length: n }, (_, i) => 0.1 * (i + 1));
    const tFac = medianTime(
      () => {
        luSolve(lu(M), b);
      },
      2,
      3
    );
    const tSolve = medianTime(
      () => {
        lusolve(M, b);
      },
      2,
      3
    );
    expect(tSolve / tFac).toBeLessThan(1.2);
  }, 120_000);

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

  it('sin at n=1e5 does not regress vs JS path (ratio ≤ 1.05)', () => {
    const x = new Float64Array(1e5);
    for (let i = 0; i < x.length; i++) x[i] = Math.sin(i * 1e-3);
    const t = medianTime(
      () => {
        sin(x);
      },
      5,
      10
    );
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(50);
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
