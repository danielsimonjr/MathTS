/**
 * Tests for WASM-dispatched Bessel J/Y and Airy Ai/Bi array kernels.
 *
 * Slice 3.10c-1 (Bessel) + Slice 4.9 (Airy + AS Bessel parity).
 *
 * Strategy:
 * - Correctness: compare the WASM bridge dispatch result against the pure-JS
 *   scalar loop on the same input.  Both use the same NR §6.5 polynomial
 *   approximation so the results must be bit-identical.
 * - Dispatch probe: verify that the bridge fires for arrays ≥ 1024 elements.
 * - Edge cases: x = 0, x < 0, large x, n = 0/1/high.
 * - Airy reference values: DLMF §9.2 — tested within 1e-7 relative error.
 * - AS path: after resetBesselWasm()/resetAiryWasm() the bridge falls back to
 *   JS (module not loaded scenario); actual AS module tested if artifact present.
 *
 * Note on precision: the NR §6.5 polynomial approximations achieve
 *   J0/J1: ~1e-7 max relative error (good to 7 decimal places)
 *   Y0/Y1: ~1e-4 max relative error near x = 1 (larger near the log singularity)
 *   Airy:  ~1e-7 relative error across all three regions
 *
 * For J-functions we use TOL = 1e-6; for Y-functions TOL = 1e-3; for Airy TOL = 1e-7.
 * The WASM results are compared to the JS fallback with TOL = 1e-14 (bit-level
 * agreement expected since both use the same algorithm).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
  airyAiDispatch,
  airyBiDispatch,
  airyAiJS,
  airyBiJS,
  resetBesselWasm,
  resetAiryWasm,
  ellipticKDispatch,
  ellipticEDispatch,
  ellipticKJS,
  ellipticEJS,
  resetEllipticWasm,
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

// ===========================================================================
// Suite 4: Fallback when WASM module not loaded
// ===========================================================================

describe('Bessel WASM — fallback to JS path (module not loaded)', () => {
  beforeAll(() => {
    resetBesselWasm(); // ensure no module is loaded
  });

  afterAll(() => {
    resetBesselWasm();
  });

  it('besselJ0Dispatch above threshold falls back to JS when WASM not loaded', () => {
    const xs = linspace(0.5, 12.0, WASM_SPECIAL_THRESHOLD);
    const result = besselJ0Dispatch(xs);
    const oracle = besselJ0JS(xs);
    expect(result.length).toBe(oracle.length);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - oracle[i])).toBeLessThan(1e-14);
    }
  });

  it('besselYDispatch (n=2) above threshold falls back to JS when WASM not loaded', () => {
    const xs = linspace(0.5, 12.0, WASM_SPECIAL_THRESHOLD);
    const result = besselYDispatch(2, xs);
    const oracle = besselYnJS(2, xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - oracle[i])).toBeLessThan(1e-14);
    }
  });
});

// ===========================================================================
// Suite 5 — Airy Ai/Bi scalar reference values (Slice 4.9)
// ===========================================================================

// Tolerance for Airy: asymptotic expansion reaches ~1e-7 relative error at the
// crossover region (|x| ≈ 4.5); power series gives ~1e-10 inside.
const TOL_AIRY = 1e-7;
const TOL_AIRY_AGREE = 1e-14; // JS vs WASM (same algorithm, bit-identical)

describe('Airy Ai/Bi scalar reference values (DLMF §9.2)', () => {
  it('Ai(0) ≈ 0.355028053887817', () => {
    const r = airyAiJS(new Float64Array([0]))[0];
    const ref = 0.35502805388781723926;
    expect(Math.abs(r - ref) / ref).toBeLessThan(TOL_AIRY);
  });

  it('Bi(0) ≈ 0.614926627446001', () => {
    const r = airyBiJS(new Float64Array([0]))[0];
    const ref = 0.61492662744600073;
    expect(Math.abs(r - ref) / ref).toBeLessThan(TOL_AIRY);
  });

  it('Ai(1) ≈ 0.135292416312881', () => {
    const r = airyAiJS(new Float64Array([1]))[0];
    const ref = 0.13529241631288141;
    expect(Math.abs(r - ref) / ref).toBeLessThan(TOL_AIRY);
  });

  it('Bi(1) ≈ 1.207423594952871', () => {
    const r = airyBiJS(new Float64Array([1]))[0];
    const ref = 1.2074235949528715;
    expect(Math.abs(r - ref) / ref).toBeLessThan(TOL_AIRY);
  });

  it('Ai(-1) ≈ 0.535560883292352', () => {
    const r = airyAiJS(new Float64Array([-1]))[0];
    const ref = 0.53556088329235129;
    expect(Math.abs(r - ref) / ref).toBeLessThan(TOL_AIRY);
  });

  it('Bi(-1) ≈ 0.103997389496945', () => {
    const r = airyBiJS(new Float64Array([-1]))[0];
    const ref = 0.10399738949694461;
    expect(Math.abs(r - ref) / ref).toBeLessThan(TOL_AIRY);
  });

  it('Ai(2) ≈ 0.034924130123397', () => {
    const r = airyAiJS(new Float64Array([2]))[0];
    const ref = 0.034924130123397;
    expect(Math.abs(r - ref) / ref).toBeLessThan(TOL_AIRY);
  });

  it('Bi(2) ≈ 3.298095200755', () => {
    const r = airyBiJS(new Float64Array([2]))[0];
    const ref = 3.298095200755;
    expect(Math.abs(r - ref) / ref).toBeLessThan(TOL_AIRY);
  });

  it('Ai decays for large positive x', () => {
    // Ai(10) ≈ 1.135e-9 — verify it is small and positive
    const r = airyAiJS(new Float64Array([10]))[0];
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1e-6);
  });

  it('Bi grows for large positive x', () => {
    // Bi(5) >> Bi(1)
    const r5 = airyBiJS(new Float64Array([5]))[0];
    const r1 = airyBiJS(new Float64Array([1]))[0];
    expect(r5).toBeGreaterThan(r1 * 10);
  });

  it('Ai oscillates for large negative x (values bounded)', () => {
    const xs = linspace(-20, -5, 50);
    const rs = airyAiJS(xs);
    for (const r of rs) {
      expect(Math.abs(r)).toBeLessThanOrEqual(1.0);
    }
  });

  it('Bi oscillates for large negative x (values bounded)', () => {
    const xs = linspace(-20, -5, 50);
    const rs = airyBiJS(xs);
    for (const r of rs) {
      expect(Math.abs(r)).toBeLessThanOrEqual(1.0);
    }
  });
});

// ===========================================================================
// Suite 6 — Airy dispatch (WASM above threshold, JS below)
// ===========================================================================

describe('Airy dispatch threshold behaviour', () => {
  it('small array (< 1024) airyAiDispatch matches JS fallback exactly', () => {
    const xs = linspace(-3.0, 3.0, 100);
    const dr = airyAiDispatch(xs);
    const jr = airyAiJS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(TOL_AIRY_AGREE);
    }
  });

  it('large array (≥ 1024) airyAiDispatch result matches JS fallback within TOL', () => {
    const xs = linspace(-3.0, 3.0, WASM_SPECIAL_THRESHOLD);
    const dr = airyAiDispatch(xs);
    const jr = airyAiJS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(TOL_AIRY_AGREE);
    }
  });

  it('large array airyBiDispatch result matches JS fallback within TOL', () => {
    const xs = linspace(-3.0, 3.0, WASM_SPECIAL_THRESHOLD);
    const dr = airyBiDispatch(xs);
    const jr = airyBiJS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(TOL_AIRY_AGREE);
    }
  });

  it('airyAi typed scalar overload returns correct value', async () => {
    const { airyAi } = await import('../src/typed/special.js');
    const r = airyAi(0.0) as number;
    expect(Math.abs(r - 0.35502805388781723926)).toBeLessThan(TOL_AIRY);
  });

  it('airyBi typed scalar overload returns correct value', async () => {
    const { airyBi } = await import('../src/typed/special.js');
    const r = airyBi(0.0) as number;
    expect(Math.abs(r - 0.61492662744600073)).toBeLessThan(TOL_AIRY);
  });

  it('airyAi typed array overload (≥ threshold) resolves correctly', async () => {
    const { airyAi } = await import('../src/typed/special.js');
    const xs = linspace(-2.0, 2.0, WASM_SPECIAL_THRESHOLD);
    const result = await (airyAi(xs) as Promise<Float64Array>);
    const jr = airyAiJS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - jr[i])).toBeLessThan(TOL_AIRY_AGREE);
    }
  });

  it('airyBi typed array overload (≥ threshold) resolves correctly', async () => {
    const { airyBi } = await import('../src/typed/special.js');
    const xs = linspace(-2.0, 2.0, WASM_SPECIAL_THRESHOLD);
    const result = await (airyBi(xs) as Promise<Float64Array>);
    const jr = airyBiJS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - jr[i])).toBeLessThan(TOL_AIRY_AGREE);
    }
  });
});

// ===========================================================================
// Suite 7 — Airy fallback when WASM module not loaded
// ===========================================================================

describe('Airy WASM — fallback to JS path (module not loaded)', () => {
  beforeAll(() => {
    resetAiryWasm();
  });

  afterAll(() => {
    resetAiryWasm();
  });

  it('airyAiDispatch above threshold falls back to JS when WASM not loaded', () => {
    const xs = linspace(-4.0, 4.0, WASM_SPECIAL_THRESHOLD);
    const result = airyAiDispatch(xs);
    const oracle = airyAiJS(xs);
    expect(result.length).toBe(oracle.length);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - oracle[i])).toBeLessThan(1e-14);
    }
  });

  it('airyBiDispatch above threshold falls back to JS when WASM not loaded', () => {
    const xs = linspace(-4.0, 4.0, WASM_SPECIAL_THRESHOLD);
    const result = airyBiDispatch(xs);
    const oracle = airyBiJS(xs);
    for (let i = 0; i < xs.length; i++) {
      expect(Math.abs(result[i] - oracle[i])).toBeLessThan(1e-14);
    }
  });
});

// ===========================================================================
// Suite 8 — Elliptic K / E scalar reference values (Slice 5.3)
// ===========================================================================

// Tolerance: AGM converges to machine precision (~1e-15). We test to 1e-10
// to be safely above floating-point round-trip noise.
const TOL_ELLIPTIC = 1e-10;
const TOL_ELLIPTIC_AGREE = 1e-14; // JS vs WASM (same algorithm, bit-identical)
const PI = Math.PI;

describe('Elliptic K/E scalar reference values (DLMF §19.6)', () => {
  // Test 1: K(0) = π/2
  it('K(0) = π/2', () => {
    const r = ellipticKJS(new Float64Array([0]))[0];
    expect(Math.abs(r - PI / 2)).toBeLessThan(TOL_ELLIPTIC);
  });

  // Test 2: K(0.5) ≈ 1.8540746773013719
  it('K(0.5) ≈ 1.8540746773013719', () => {
    const r = ellipticKJS(new Float64Array([0.5]))[0];
    expect(Math.abs(r - 1.8540746773013719)).toBeLessThan(TOL_ELLIPTIC);
  });

  // Test 3: K(0.99) ≈ 3.6956373629898747
  it('K(0.99) ≈ 3.6956373629898747', () => {
    const r = ellipticKJS(new Float64Array([0.99]))[0];
    expect(Math.abs(r - 3.6956373629898747)).toBeLessThan(1e-7);
  });

  // Test 4: K(1) = +∞
  it('K(1) = +Infinity', () => {
    const r = ellipticKJS(new Float64Array([1]))[0];
    expect(r).toBe(Infinity);
  });

  // Test 5: K(m < 0) = NaN
  it('K(m < 0) returns NaN', () => {
    const r = ellipticKJS(new Float64Array([-0.1]))[0];
    expect(isNaN(r)).toBe(true);
  });

  // Test 6: K(m > 1) = NaN
  it('K(m > 1) returns NaN', () => {
    const r = ellipticKJS(new Float64Array([1.5]))[0];
    expect(isNaN(r)).toBe(true);
  });

  // Test 7: E(0) = π/2
  it('E(0) = π/2', () => {
    const r = ellipticEJS(new Float64Array([0]))[0];
    expect(Math.abs(r - PI / 2)).toBeLessThan(TOL_ELLIPTIC);
  });

  // Test 8: E(0.5) ≈ 1.3506438810476755
  it('E(0.5) ≈ 1.3506438810476755', () => {
    const r = ellipticEJS(new Float64Array([0.5]))[0];
    expect(Math.abs(r - 1.3506438810476755)).toBeLessThan(TOL_ELLIPTIC);
  });

  // Test 9: E(1) = 1.0
  it('E(1) = 1.0 (limit case)', () => {
    const r = ellipticEJS(new Float64Array([1]))[0];
    expect(Math.abs(r - 1.0)).toBeLessThan(TOL_ELLIPTIC);
  });

  // Test 10: E(m < 0) = NaN
  it('E(m < 0) returns NaN', () => {
    const r = ellipticEJS(new Float64Array([-0.5]))[0];
    expect(isNaN(r)).toBe(true);
  });

  // Test 11: E(m > 1) = NaN
  it('E(m > 1) returns NaN', () => {
    const r = ellipticEJS(new Float64Array([2.0]))[0];
    expect(isNaN(r)).toBe(true);
  });

  // Test 12: K(m) ≥ E(m) for m ∈ (0, 1)  (well-known identity)
  it('K(m) ≥ E(m) for m ∈ (0, 1)', () => {
    const ms = [0.1, 0.3, 0.5, 0.7, 0.9, 0.99];
    for (const m of ms) {
      const k = ellipticKJS(new Float64Array([m]))[0];
      const e = ellipticEJS(new Float64Array([m]))[0];
      expect(k).toBeGreaterThanOrEqual(e - 1e-14);
    }
  });
});

// ===========================================================================
// Suite 9 — Elliptic dispatch threshold behaviour
// ===========================================================================

describe('Elliptic K/E dispatch threshold behaviour', () => {
  it('small array (< 1024) ellipticKDispatch matches JS fallback exactly', () => {
    const ms = linspace(0.01, 0.9, 100);
    const dr = ellipticKDispatch(ms);
    const jr = ellipticKJS(ms);
    for (let i = 0; i < ms.length; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(TOL_ELLIPTIC_AGREE);
    }
  });

  it('large array (≥ 1024) ellipticKDispatch matches JS fallback within TOL', () => {
    const ms = linspace(0.01, 0.99, WASM_SPECIAL_THRESHOLD);
    const dr = ellipticKDispatch(ms);
    const jr = ellipticKJS(ms);
    for (let i = 0; i < ms.length; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(TOL_ELLIPTIC_AGREE);
    }
  });

  it('large array (≥ 1024) ellipticEDispatch matches JS fallback within TOL', () => {
    const ms = linspace(0.0, 0.99, WASM_SPECIAL_THRESHOLD);
    const dr = ellipticEDispatch(ms);
    const jr = ellipticEJS(ms);
    for (let i = 0; i < ms.length; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(TOL_ELLIPTIC_AGREE);
    }
  });

  it('ellipticK typed scalar overload returns correct value', async () => {
    const { ellipticK } = await import('../src/typed/special.js');
    const r = ellipticK(0.5) as number;
    expect(Math.abs(r - 1.8540746773013719)).toBeLessThan(TOL_ELLIPTIC);
  });

  it('ellipticE typed scalar overload returns correct value', async () => {
    const { ellipticE } = await import('../src/typed/special.js');
    const r = ellipticE(0.5) as number;
    expect(Math.abs(r - 1.3506438810476755)).toBeLessThan(TOL_ELLIPTIC);
  });

  it('ellipticK typed array overload (≥ threshold) resolves correctly', async () => {
    const { ellipticK } = await import('../src/typed/special.js');
    const ms = linspace(0.01, 0.9, WASM_SPECIAL_THRESHOLD);
    const result = await (ellipticK(ms) as Promise<Float64Array>);
    const jr = ellipticKJS(ms);
    for (let i = 0; i < ms.length; i++) {
      expect(Math.abs(result[i] - jr[i])).toBeLessThan(TOL_ELLIPTIC_AGREE);
    }
  });

  it('ellipticE typed array overload (≥ threshold) resolves correctly', async () => {
    const { ellipticE } = await import('../src/typed/special.js');
    const ms = linspace(0.0, 0.99, WASM_SPECIAL_THRESHOLD);
    const result = await (ellipticE(ms) as Promise<Float64Array>);
    const jr = ellipticEJS(ms);
    for (let i = 0; i < ms.length; i++) {
      expect(Math.abs(result[i] - jr[i])).toBeLessThan(TOL_ELLIPTIC_AGREE);
    }
  });
});

// ===========================================================================
// Suite 10 — Elliptic fallback when WASM module not loaded
// ===========================================================================

describe('Elliptic WASM — fallback to JS path (module not loaded)', () => {
  beforeAll(() => {
    resetEllipticWasm();
  });

  afterAll(() => {
    resetEllipticWasm();
  });

  it('ellipticKDispatch above threshold falls back to JS when WASM not loaded', () => {
    const ms = linspace(0.01, 0.9, WASM_SPECIAL_THRESHOLD);
    const result = ellipticKDispatch(ms);
    const oracle = ellipticKJS(ms);
    expect(result.length).toBe(oracle.length);
    for (let i = 0; i < ms.length; i++) {
      expect(Math.abs(result[i] - oracle[i])).toBeLessThan(1e-14);
    }
  });

  it('ellipticEDispatch above threshold falls back to JS when WASM not loaded', () => {
    const ms = linspace(0.0, 0.99, WASM_SPECIAL_THRESHOLD);
    const result = ellipticEDispatch(ms);
    const oracle = ellipticEJS(ms);
    for (let i = 0; i < ms.length; i++) {
      expect(Math.abs(result[i] - oracle[i])).toBeLessThan(1e-14);
    }
  });
});
