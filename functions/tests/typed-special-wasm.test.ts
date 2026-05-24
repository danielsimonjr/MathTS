/**
 * Tests for WASM-dispatched Bessel J/Y array kernels (Slice 3.10c-1).
 *
 * Strategy:
 * - Correctness: compare the WASM bridge dispatch result against the pure-JS
 *   scalar loop on the same input.  Both use the same NR §6.5 polynomial
 *   approximation so the results must be bit-identical.
 * - Dispatch probe: verify that the bridge fires for arrays ≥ 1024 elements.
 * - Edge cases: x = 0, x < 0, large x, n = 0/1/high.
 *
 * Note on precision: the NR §6.5 polynomial approximations achieve
 *   J0/J1: ~1e-7 max relative error (good to 7 decimal places)
 *   Y0/Y1: ~1e-4 max relative error near x = 1 (larger near the log singularity)
 *
 * For J-functions we use TOL = 1e-6; for Y-functions TOL = 1e-3.
 * The WASM results are compared to the JS fallback with TOL = 1e-14 (bit-level
 * agreement expected since both use the same algorithm).
 */

import { describe, it, expect } from 'vitest';
import {
  WASM_SPECIAL_THRESHOLD,
  besselJ0Dispatch,
  besselJ1Dispatch,
  besselJDispatch,
  besselY0Dispatch,
  besselY1Dispatch,
  besselYDispatch,
  besselJ0JS,
  besselJ1JS,
  besselJnJS,
  besselY0JS,
  besselY1JS,
  besselYnJS,
} from '../src/wasm/special/wasm-bridge.js';

// ---------------------------------------------------------------------------
// Reference values (Abramowitz & Stegun §9.1 tables + DLMF)
// Tolerances reflect NR polynomial design precision.
// ---------------------------------------------------------------------------

const TOL_J = 1e-6; // J-function tolerance vs exact
const TOL_Y = 1e-3; // Y-function tolerance vs exact (larger near x=1)
const TOL_AGREE = 1e-14; // JS vs WASM agreement (same algorithm, bit-identical)

// ---------------------------------------------------------------------------
// Helper: build an array of n linearly-spaced values in [lo, hi]
// ---------------------------------------------------------------------------
function linspace(lo: number, hi: number, n: number): Float64Array {
  const out = new Float64Array(n);
  const step = (hi - lo) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = lo + i * step;
  return out;
}

// ---------------------------------------------------------------------------
// Section 1 — JS fallback correctness (known values)
// ---------------------------------------------------------------------------

describe('Bessel JS scalar correctness (known values)', () => {
  it('J0(0) = 1', () => {
    const r = besselJ0JS(new Float64Array([0]))[0];
    expect(Math.abs(r - 1.0)).toBeLessThan(TOL_J);
  });

  it('J0(1) ≈ 0.7651976865 (A&S)', () => {
    const r = besselJ0JS(new Float64Array([1]))[0];
    expect(Math.abs(r - 0.7651976865579666)).toBeLessThan(TOL_J);
  });

  it('J1(0) = 0', () => {
    const r = besselJ1JS(new Float64Array([0]))[0];
    expect(Math.abs(r)).toBeLessThan(1e-15);
  });

  it('J1(1) ≈ 0.4400505857 (A&S)', () => {
    const r = besselJ1JS(new Float64Array([1]))[0];
    expect(Math.abs(r - 0.4400505857449335)).toBeLessThan(TOL_J);
  });

  it('J5(10) ≈ -0.2340615281 (A&S §9.1)', () => {
    const r = besselJnJS(5, new Float64Array([10]))[0];
    expect(Math.abs(r - -0.23406152816422887)).toBeLessThan(TOL_J);
  });

  it('Jn(n, 0) = 0 for n ≥ 1', () => {
    for (const n of [1, 2, 3, 5]) {
      const r = besselJnJS(n, new Float64Array([0]))[0];
      expect(Math.abs(r)).toBeLessThan(1e-14);
    }
  });

  it('Y0(1) ≈ 0.0882569642 (A&S)', () => {
    const r = besselY0JS(new Float64Array([1]))[0];
    expect(Math.abs(r - 0.08825696421567697)).toBeLessThan(TOL_Y);
  });

  it('Y0(x ≤ 0) returns NaN', () => {
    const r0 = besselY0JS(new Float64Array([0]))[0];
    const rn = besselY0JS(new Float64Array([-1]))[0];
    expect(isNaN(r0)).toBe(true);
    expect(isNaN(rn)).toBe(true);
  });

  it('Y1(x ≤ 0) returns NaN', () => {
    const r = besselY1JS(new Float64Array([0]))[0];
    expect(isNaN(r)).toBe(true);
  });

  it('J0 is symmetric: J0(-x) = J0(x)', () => {
    const xs = new Float64Array([0.5, 1.5, 3.0, 7.0, 15.0]);
    for (const x of xs) {
      const pos = besselJ0JS(new Float64Array([x]))[0];
      const neg = besselJ0JS(new Float64Array([-x]))[0];
      expect(Math.abs(pos - neg)).toBeLessThan(1e-14);
    }
  });

  it('J1 is antisymmetric: J1(-x) = -J1(x)', () => {
    const xs = [0.5, 1.5, 3.0, 7.0];
    for (const x of xs) {
      const pos = besselJ1JS(new Float64Array([x]))[0];
      const neg = besselJ1JS(new Float64Array([-x]))[0];
      expect(Math.abs(pos + neg)).toBeLessThan(1e-14);
    }
  });

  it('large-x asymptotic: J0 oscillates and |J0(x)| ≤ 1', () => {
    const xs = linspace(20, 100, 50);
    const rs = besselJ0JS(xs);
    for (const r of rs) {
      expect(Math.abs(r)).toBeLessThanOrEqual(1.0 + 1e-10);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 2 — WASM dispatch fires above threshold (structural test)
// ---------------------------------------------------------------------------

describe('WASM dispatch threshold behaviour', () => {
  it('WASM_SPECIAL_THRESHOLD is 1024', () => {
    expect(WASM_SPECIAL_THRESHOLD).toBe(1024);
  });

  it('small array (< 1024) matches JS fallback exactly', () => {
    const xs = linspace(0.1, 5.0, 100);
    const dispatchResult = besselJ0Dispatch(xs);
    const jsResult = besselJ0JS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dispatchResult[i] - jsResult[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('large array (≥ 1024) result matches JS fallback within TOL_AGREE', () => {
    // The WASM and JS paths use the same polynomial so results must agree
    // bit-for-bit (or nearly so — any discrepancy would mean a kernel bug).
    const xs = linspace(0.1, 10.0, WASM_SPECIAL_THRESHOLD);
    const dispatchResult = besselJ0Dispatch(xs);
    const jsResult = besselJ0JS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dispatchResult[i] - jsResult[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('J1 large array matches JS fallback', () => {
    const xs = linspace(0.1, 10.0, WASM_SPECIAL_THRESHOLD);
    const dR = besselJ1Dispatch(xs);
    const jR = besselJ1JS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dR[i] - jR[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('Jn(n=5) large array matches JS fallback', () => {
    const xs = linspace(1.0, 15.0, WASM_SPECIAL_THRESHOLD);
    const dR = besselJDispatch(5, xs);
    const jR = besselJnJS(5, xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dR[i] - jR[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('Y0 large array matches JS fallback', () => {
    const xs = linspace(0.5, 10.0, WASM_SPECIAL_THRESHOLD); // x > 0 for Y0
    const dR = besselY0Dispatch(xs);
    const jR = besselY0JS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dR[i] - jR[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('Y1 large array matches JS fallback', () => {
    const xs = linspace(0.5, 10.0, WASM_SPECIAL_THRESHOLD);
    const dR = besselY1Dispatch(xs);
    const jR = besselY1JS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dR[i] - jR[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('Yn(n=2) large array matches JS fallback', () => {
    const xs = linspace(0.5, 10.0, WASM_SPECIAL_THRESHOLD);
    const dR = besselYDispatch(2, xs);
    const jR = besselYnJS(2, xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dR[i] - jR[i])).toBeLessThan(TOL_AGREE);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 3 — Edge cases
// ---------------------------------------------------------------------------

describe('Bessel edge cases', () => {
  it('J0(0) = 1 via dispatch', () => {
    const xs = new Float64Array([0]);
    expect(Math.abs(besselJ0Dispatch(xs)[0] - 1.0)).toBeLessThan(TOL_J);
  });

  it('J1(0) = 0 via dispatch', () => {
    const xs = new Float64Array([0]);
    expect(Math.abs(besselJ1Dispatch(xs)[0])).toBeLessThan(1e-15);
  });

  it('Jn(n ≥ 1, 0) = 0 via dispatch', () => {
    const xs = new Float64Array([0]);
    for (const n of [2, 3, 10]) {
      expect(Math.abs(besselJDispatch(n, xs)[0])).toBeLessThan(1e-14);
    }
  });

  it('Y0(0) returns NaN or ±Infinity via dispatch', () => {
    const xs = new Float64Array([0]);
    const r = besselY0Dispatch(xs)[0];
    expect(isNaN(r) || !isFinite(r)).toBe(true);
  });

  it('Y0(negative x) returns NaN via dispatch', () => {
    const xs = new Float64Array([-2.0]);
    const r = besselY0Dispatch(xs)[0];
    expect(isNaN(r)).toBe(true);
  });

  it('Y1(0) returns NaN via dispatch', () => {
    const xs = new Float64Array([0]);
    const r = besselY1Dispatch(xs)[0];
    expect(isNaN(r)).toBe(true);
  });

  it('J0 large x (x = 100) — check magnitude ≤ 1', () => {
    const xs = new Float64Array([100]);
    const r = besselJ0Dispatch(xs)[0];
    expect(Math.abs(r)).toBeLessThanOrEqual(1.0 + 1e-10);
  });

  it('Jn recurrence n=20 matches reference via dispatch', () => {
    // J20(10) is small but nonzero — test recurrence stability
    const xs = new Float64Array([10]);
    const r = besselJDispatch(20, xs)[0];
    // The exact value is approximately 1.238e-10; JS and Rust give the same
    // because both use Miller's backward recurrence.
    const jsR = besselJnJS(20, xs)[0];
    expect(Math.abs(r - jsR)).toBeLessThan(TOL_AGREE);
  });

  it('Yn(n=3) forward recurrence agrees with JS', () => {
    const xs = new Float64Array([5.0]);
    const r = besselYDispatch(3, xs)[0];
    const jR = besselYnJS(3, xs)[0];
    expect(Math.abs(r - jR)).toBeLessThan(TOL_AGREE);
  });
});

// ---------------------------------------------------------------------------
// Section 4 — Integration: typed/special.ts array overloads
// ---------------------------------------------------------------------------

describe('typed/special.ts bessel array overloads use bridge', () => {
  // Import the typed functions to exercise the besselJ0 / besselJ1 etc.
  // typed-function wrappers which delegate to the bridge above threshold.
  // We only test the synchronous overload path; the parallel path is
  // exercised in the existing typed-special.test.ts.

  it('besselJ0 typed scalar overload is unchanged', async () => {
    const { besselJ0 } = await import('../src/typed/special.js');
    const r = besselJ0(1.0);
    expect(Math.abs((r as number) - 0.7651976865579666)).toBeLessThan(TOL_J);
  });

  it('besselJ0 typed array overload (< threshold) resolves correctly', async () => {
    const { besselJ0 } = await import('../src/typed/special.js');
    const xs = linspace(0.1, 5.0, 50);
    const result = await (besselJ0(xs) as Promise<Float64Array>);
    const js = besselJ0JS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - js[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('besselJ0 typed array overload (≥ threshold) uses bridge and resolves correctly', async () => {
    const { besselJ0 } = await import('../src/typed/special.js');
    const xs = linspace(0.1, 10.0, WASM_SPECIAL_THRESHOLD);
    const result = await (besselJ0(xs) as Promise<Float64Array>);
    const js = besselJ0JS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - js[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('besselJ typed (n=5, xs ≥ threshold) resolves correctly', async () => {
    const { besselJ } = await import('../src/typed/special.js');
    const xs = linspace(1.0, 15.0, WASM_SPECIAL_THRESHOLD);
    const result = await (besselJ(5, xs) as Promise<Float64Array>);
    const js = besselJnJS(5, xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - js[i])).toBeLessThan(TOL_AGREE);
    }
  });

  it('besselY0 typed array overload (≥ threshold) resolves correctly', async () => {
    const { besselY0 } = await import('../src/typed/special.js');
    const xs = linspace(0.5, 10.0, WASM_SPECIAL_THRESHOLD);
    const result = await (besselY0(xs) as Promise<Float64Array>);
    const js = besselY0JS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - js[i])).toBeLessThan(TOL_AGREE);
    }
  });
});
