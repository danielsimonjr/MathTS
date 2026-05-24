/**
 * Tests for the WASM sort kernels and dispatch bridge — Slice 5.7a.
 *
 * Strategy:
 * - JS fallback correctness: sortF64JS / argsortF64JS / rankF64JS match
 *   manual reference values for small arrays.
 * - NaN-last ordering: NaNs always sort after all finite values.
 * - argsort invariant: data[argsort[i]] is non-decreasing.
 * - rank ↔ argsort inverse permutation: rank[argsort[k]] == k.
 * - Large-array dispatch: arrays ≥ WASM_SORT_THRESHOLD follow the WASM path
 *   when the module is loaded; result must match JS reference.
 * - Threshold fallthrough: arrays below WASM_SORT_THRESHOLD always use JS.
 * - Empty and single-element arrays are handled without errors.
 */

import { describe, it, expect } from 'vitest';
import {
  WASM_SORT_THRESHOLD,
  sortF64Dispatch,
  argsortF64Dispatch,
  rankF64Dispatch,
  sortF64JS,
  argsortF64JS,
  rankF64JS,
} from '../src/wasm/sort/wasm-bridge.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRandomF64(n: number, seed = 0): Float64Array {
  // Simple mulberry32 PRNG for reproducibility.
  let s = seed >>> 0;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    out[i] = ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  }
  return out;
}

/** Returns true if array is sorted ascending (NaN-last). */
function isSortedNanLast(arr: Float64Array): boolean {
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i];
    const b = arr[i + 1];
    if (Number.isNaN(a) && !Number.isNaN(b)) return false; // NaN before finite
    if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 1. sortF64JS — basic correctness
// ---------------------------------------------------------------------------

describe('sortF64JS (pure-JS fallback)', () => {
  it('sorts a small array correctly', () => {
    const data = new Float64Array([3, 1, 4, 1, 5, 9, 2, 6]);
    sortF64JS(data);
    expect(Array.from(data)).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
  });

  it('sorts NaNs to the end', () => {
    const data = new Float64Array([NaN, 1, NaN, 2, 0.5]);
    sortF64JS(data);
    expect(data[0]).toBe(0.5);
    expect(data[1]).toBe(1);
    expect(data[2]).toBe(2);
    expect(Number.isNaN(data[3])).toBe(true);
    expect(Number.isNaN(data[4])).toBe(true);
  });

  it('handles empty array without error', () => {
    const data = new Float64Array(0);
    expect(() => sortF64JS(data)).not.toThrow();
    expect(data.length).toBe(0);
  });

  it('handles single-element array', () => {
    const data = new Float64Array([42]);
    sortF64JS(data);
    expect(data[0]).toBe(42);
  });

  it('returns the same array reference', () => {
    const data = new Float64Array([3, 1, 2]);
    const ret = sortF64JS(data);
    expect(ret).toBe(data);
  });
});

// ---------------------------------------------------------------------------
// 2. argsortF64JS — correctness
// ---------------------------------------------------------------------------

describe('argsortF64JS (pure-JS fallback)', () => {
  it('argsort produces sorted order', () => {
    const data = new Float64Array([3, 1, 4, 1, 5]);
    const idx = argsortF64JS(data);
    // data[idx[i]] should be non-decreasing
    for (let i = 0; i < idx.length - 1; i++) {
      expect(data[idx[i]]).toBeLessThanOrEqual(data[idx[i + 1]]);
    }
  });

  it('argsort puts NaN indices last', () => {
    const data = new Float64Array([NaN, 1.0, 0.5]);
    const idx = argsortF64JS(data);
    expect(Number.isNaN(data[idx[idx.length - 1]])).toBe(true);
    expect(Number.isNaN(data[idx[0]])).toBe(false);
  });

  it('argsort empty returns empty Int32Array', () => {
    const idx = argsortF64JS(new Float64Array(0));
    expect(idx.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. rankF64JS — correctness and inverse-permutation property
// ---------------------------------------------------------------------------

describe('rankF64JS (pure-JS fallback)', () => {
  it('rank[argsort[k]] == k for all k', () => {
    const data = new Float64Array([2, 5, 1, 4, 3]);
    const argsort = argsortF64JS(data);
    const rank = rankF64JS(data);
    for (let k = 0; k < data.length; k++) {
      expect(rank[argsort[k]]).toBe(k);
    }
  });

  it('rank values are in [0, n)', () => {
    const data = new Float64Array([10, 30, 20, 40]);
    const rank = rankF64JS(data);
    const n = data.length;
    for (let i = 0; i < n; i++) {
      expect(rank[i]).toBeGreaterThanOrEqual(0);
      expect(rank[i]).toBeLessThan(n);
    }
  });

  it('reconstructed sorted order via rank matches sortF64JS', () => {
    const data = new Float64Array([7, 2, 9, 1, 5]);
    const rank = rankF64JS(data);
    const sorted = new Float64Array(data.length);
    for (let i = 0; i < data.length; i++) sorted[rank[i]] = data[i];
    expect(isSortedNanLast(sorted)).toBe(true);
  });

  it('rank empty returns empty Int32Array', () => {
    const rank = rankF64JS(new Float64Array(0));
    expect(rank.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Dispatch — below threshold always uses JS path
// ---------------------------------------------------------------------------

describe('dispatch below threshold', () => {
  it('sortF64Dispatch on small array matches JS result', () => {
    const a = new Float64Array([5, 2, 8, 1]);
    const b = new Float64Array([5, 2, 8, 1]);
    sortF64JS(b);
    sortF64Dispatch(a);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('argsortF64Dispatch on small array matches JS result', () => {
    const data = new Float64Array([5, 2, 8, 1]);
    const jsResult = argsortF64JS(data);
    const dispResult = argsortF64Dispatch(data);
    expect(Array.from(dispResult)).toEqual(Array.from(jsResult));
  });

  it('rankF64Dispatch on small array matches JS result', () => {
    const data = new Float64Array([5, 2, 8, 1]);
    const jsResult = rankF64JS(data);
    const dispResult = rankF64Dispatch(data);
    expect(Array.from(dispResult)).toEqual(Array.from(jsResult));
  });
});

// ---------------------------------------------------------------------------
// 5. Dispatch — large array (≥ WASM_SORT_THRESHOLD) path check
// ---------------------------------------------------------------------------

describe('dispatch above threshold', () => {
  it('WASM_SORT_THRESHOLD is 16384', () => {
    expect(WASM_SORT_THRESHOLD).toBe(16384);
  });

  it('sortF64Dispatch on large array produces sorted output', () => {
    const n = WASM_SORT_THRESHOLD + 100;
    const data = makeRandomF64(n, 42);
    const sorted = new Float64Array(data);
    sortF64Dispatch(sorted);
    expect(isSortedNanLast(sorted)).toBe(true);
  });

  it('sortF64Dispatch on large random array matches JS reference', () => {
    const n = WASM_SORT_THRESHOLD + 512;
    const original = makeRandomF64(n, 99);
    const wasmCopy = new Float64Array(original);
    const jsCopy = new Float64Array(original);
    sortF64Dispatch(wasmCopy);
    sortF64JS(jsCopy);
    // Both should be identical sorted arrays.
    for (let i = 0; i < n; i++) {
      expect(wasmCopy[i]).toBe(jsCopy[i]);
    }
  });

  it('argsortF64Dispatch on large array produces correct permutation', () => {
    const n = WASM_SORT_THRESHOLD + 256;
    const data = makeRandomF64(n, 7);
    const idx = argsortF64Dispatch(data);
    // data[idx[i]] should be non-decreasing
    for (let i = 0; i < idx.length - 1; i++) {
      expect(data[idx[i]]).toBeLessThanOrEqual(data[idx[i + 1]]);
    }
  });

  it('rankF64Dispatch inverse-permutation property holds on large array', () => {
    const n = WASM_SORT_THRESHOLD + 128;
    const data = makeRandomF64(n, 13);
    const argsort = argsortF64Dispatch(data);
    const rank = rankF64Dispatch(data);
    // Spot-check 200 positions for performance.
    const step = Math.floor(n / 200);
    for (let k = 0; k < n; k += step) {
      expect(rank[argsort[k]]).toBe(k);
    }
  });

  it('sortF64Dispatch with NaNs in large array puts NaNs last', () => {
    const n = WASM_SORT_THRESHOLD + 100;
    const data = makeRandomF64(n, 55);
    // Inject 10 NaNs.
    for (let i = 0; i < 10; i++) data[i * 100] = NaN;
    sortF64Dispatch(data);
    expect(isSortedNanLast(data)).toBe(true);
    // Last 10 elements should be NaN.
    for (let i = n - 10; i < n; i++) {
      expect(Number.isNaN(data[i])).toBe(true);
    }
  });
});
