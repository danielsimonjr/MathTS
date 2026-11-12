/**
 * Dogfood relay G26 — sort, median, lusolve packed, wasm sin policy (#712 #694 #711).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { execIsolatedPerfGate } from '../../tools/test/perf-gate-spawn.mjs';
import { nodeBinary } from './helpers/node-binary.js';
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

  it('n=1e5 sort is within 1.5× native Float64Array.sort (issue #712)', () => {
    const gate = fileURLToPath(new URL('./helpers/sort-number-perf-gate.mjs', import.meta.url));
    const raw = execIsolatedPerfGate(nodeBinary(), gate);
    const { ratio, checksum } = JSON.parse(raw) as { ratio: number; checksum: number };
    expect(Number.isFinite(checksum)).toBe(true);
    expect(ratio).toBeLessThan(1.5);
  });
});

describe('G26 #712 median quickselect path', () => {
  it('matches partition oracle on small vectors', () => {
    const v = [3, -1, 5, 7, 2, 9, 1];
    expect(median(v)).toBe(3);
  });

  it('n=1e6 median is ≪ full sort (quickselect gate)', () => {
    const n = 1_000_000;
    const data = Array.from({ length: n }, (_, i) => Math.sin(i));
    for (let w = 0; w < 2; w++) {
      median(data.slice());
      const s = data.slice();
      s.sort((a, b) => a - b);
    }
    const medTimes: number[] = [];
    const sortTimes: number[] = [];
    for (let r = 0; r < 5; r++) {
      const t0 = performance.now();
      median(data);
      medTimes.push(performance.now() - t0);
      const s = data.slice();
      const t1 = performance.now();
      s.sort((a, b) => a - b);
      sortTimes.push(performance.now() - t1);
    }
    medTimes.sort((a, b) => a - b);
    sortTimes.sort((a, b) => a - b);
    const med = medTimes[Math.floor(medTimes.length / 2)];
    const sort = sortTimes[Math.floor(sortTimes.length / 2)];
    expect(med).toBeLessThan(sort * 0.25);
  }, 120_000);
});

describe('G26 #694 lusolve uses packed matrix lu', () => {
  it('n=1000 ABBA median ≤ 1.2× matrix lu+luSolve (isolated Node gate)', () => {
    const gate = fileURLToPath(new URL('./helpers/lusolve-perf-gate.mjs', import.meta.url));
    const raw = execIsolatedPerfGate(nodeBinary(), gate);
    const { ratio, checksum } = JSON.parse(raw) as { ratio: number; checksum: number };
    expect(Number.isFinite(checksum)).toBe(true);
    expect(ratio).toBeLessThan(1.2);
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
