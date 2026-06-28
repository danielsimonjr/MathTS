/**
 * Tests for WASM-accelerated distribution PDF functions (Slice 5.8).
 *
 * Covers: betaPDF, gammaPDF, studentTPDF, noncentralChi2PDF.
 *
 * Strategy:
 *   - Correctness: compare typed-function results against reference values
 *     computed with the same lgamma scalar.
 *   - Threshold: verify that below-threshold arrays and scalars use the JS path.
 *   - JS/WASM agreement: large arrays (≥ 1024) must agree with scalar loop
 *     within 1e-12.
 *   - lgammaDispatch wiring: noncentralChi2PDF pre-builds its lgamma table via
 *     lgammaDispatch — tested implicitly by the correctness checks.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WASM_SPECIAL_THRESHOLD } from '../src/wasm/special/wasm-bridge.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inclusive linspace — n points from a to b. */
function linspace(a: number, b: number, n: number): Float64Array {
  const out = new Float64Array(n);
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + i * step;
  return out;
}

/** Inline lgamma (Lanczos g=7) for reference computation. */
function refLgamma(x: number): number {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    const sinPiX = Math.abs(Math.sin(Math.PI * x));
    if (sinPiX === 0) return Infinity;
    return Math.log(Math.PI / sinPiX) - refLgamma(1 - x);
  }
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  const xm1 = x - 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) a += c[i] / (xm1 + i);
  const t = xm1 + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (xm1 + 0.5) * Math.log(t) - t + Math.log(a);
}

const TOL = 1e-10;
const TOL_AGREE = 1e-12;

// ---------------------------------------------------------------------------
// De-flake: warm the typed-module dynamic import once, up front.
//
// Every suite reaches the typed PDFs via `await import('../src/typed/
// distributions.js')`. The *first* such import transforms + evaluates a large
// dependency graph (typed-function + core); measured at several seconds of
// esbuild work even on an idle machine. Under heavy concurrent CPU load that
// first import alone can exceed Vitest's 5000ms per-test timeout,
// intermittently failing whichever scalar test triggers it first (e.g.
// "betaPDF(0.5, 2, 2) = 1.5 (scalar)"). Warming it here, with a generous hook
// timeout, moves the one-time compile cost out of any per-test deadline so
// every `await import()` below resolves from cache and its assertion runs
// against a ready module deterministically. No assertion is changed; this only
// removes the load-induced timeout race.
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await import('../src/typed/distributions.js');
}, 120_000);

// ===========================================================================
// Suite 1 — betaPDF
// ===========================================================================

describe('betaPDF (Slice 5.8)', () => {
  // Test 1: scalar reference — betaPDF(0.5, 2, 2) = 1.5
  it('betaPDF(0.5, 2, 2) = 1.5 (scalar)', async () => {
    const { betaPDF } = await import('../src/typed/distributions.js');
    const r = betaPDF(0.5, 2, 2) as number;
    expect(Math.abs(r - 1.5)).toBeLessThan(TOL);
  });

  // Test 2: betaPDF(0.5, 1, 1) = 1 (Uniform distribution)
  it('betaPDF(0.5, 1, 1) = 1 (Uniform)', async () => {
    const { betaPDF } = await import('../src/typed/distributions.js');
    const r = betaPDF(0.5, 1, 1) as number;
    expect(Math.abs(r - 1.0)).toBeLessThan(TOL);
  });

  // Test 3: boundary — x = 0 returns 0
  it('betaPDF(0, 2, 2) = 0 (boundary)', async () => {
    const { betaPDF } = await import('../src/typed/distributions.js');
    const r = betaPDF(0, 2, 2) as number;
    expect(r).toBe(0);
  });

  // Test 4: small array below threshold
  it('betaPDF Float64Array below threshold returns correct values', async () => {
    const { betaPDF } = await import('../src/typed/distributions.js');
    const xs = new Float64Array([0.1, 0.3, 0.5, 0.7, 0.9]);
    const alpha = 2,
      beta_ = 3;
    const logB = refLgamma(alpha) + refLgamma(beta_) - refLgamma(alpha + beta_);
    const result = await (betaPDF(xs, alpha, beta_) as Promise<Float64Array>);
    for (let i = 0; i < xs.length; i++) {
      const xi = xs[i];
      const ref = Math.exp((alpha - 1) * Math.log(xi) + (beta_ - 1) * Math.log(1 - xi) - logB);
      expect(Math.abs(result[i] - ref)).toBeLessThan(TOL_AGREE);
    }
  });

  // Test 5: large array (≥ threshold) agrees with scalar loop
  it('betaPDF Float64Array ≥ threshold agrees with scalar loop within 1e-12', async () => {
    const { betaPDF } = await import('../src/typed/distributions.js');
    const xs = linspace(0.01, 0.99, WASM_SPECIAL_THRESHOLD);
    const alpha = 3,
      beta_ = 5;
    const result = await (betaPDF(xs, alpha, beta_) as Promise<Float64Array>);
    const logB = refLgamma(alpha) + refLgamma(beta_) - refLgamma(alpha + beta_);
    for (let i = 0; i < xs.length; i++) {
      const ref = Math.exp(
        (alpha - 1) * Math.log(xs[i]) + (beta_ - 1) * Math.log(1 - xs[i]) - logB
      );
      expect(Math.abs(result[i] - ref)).toBeLessThan(TOL_AGREE);
    }
  });

  // Test 6: symmetry — betaPDF(x, α, β) = betaPDF(1-x, β, α)
  it('betaPDF symmetry: betaPDF(x, 2, 3) = betaPDF(1-x, 3, 2)', async () => {
    const { betaPDF } = await import('../src/typed/distributions.js');
    const x = 0.3;
    const r1 = betaPDF(x, 2, 3) as number;
    const r2 = betaPDF(1 - x, 3, 2) as number;
    expect(Math.abs(r1 - r2)).toBeLessThan(TOL);
  });
});

// ===========================================================================
// Suite 2 — gammaPDF
// ===========================================================================

describe('gammaPDF (Slice 5.8)', () => {
  // Test 1: gammaPDF(1, 1, 1) = exp(-1) ≈ 0.3679 (Exponential(1))
  it('gammaPDF(1, 1, 1) ≈ exp(-1) — scalar', async () => {
    const { gammaPDF } = await import('../src/typed/distributions.js');
    const r = gammaPDF(1, 1, 1) as number;
    expect(Math.abs(r - Math.exp(-1))).toBeLessThan(TOL);
  });

  // Test 2: boundary — x = 0 returns 0
  it('gammaPDF(0, 2, 1) = 0 (boundary)', async () => {
    const { gammaPDF } = await import('../src/typed/distributions.js');
    const r = gammaPDF(0, 2, 1) as number;
    expect(r).toBe(0);
  });

  // Test 3: negative x returns 0
  it('gammaPDF(-1, 2, 1) = 0 (negative x)', async () => {
    const { gammaPDF } = await import('../src/typed/distributions.js');
    const r = gammaPDF(-1, 2, 1) as number;
    expect(r).toBe(0);
  });

  // Test 4: small array below threshold
  it('gammaPDF Float64Array below threshold returns correct values', async () => {
    const { gammaPDF } = await import('../src/typed/distributions.js');
    const xs = new Float64Array([0.5, 1.0, 2.0, 3.0, 5.0]);
    const k = 2,
      theta = 2;
    const lgK = refLgamma(k);
    const result = await (gammaPDF(xs, k, theta) as Promise<Float64Array>);
    for (let i = 0; i < xs.length; i++) {
      const ref = Math.exp((k - 1) * Math.log(xs[i]) - xs[i] / theta - lgK - k * Math.log(theta));
      expect(Math.abs(result[i] - ref)).toBeLessThan(TOL_AGREE);
    }
  });

  // Test 5: large array (≥ threshold) agrees with scalar loop
  it('gammaPDF Float64Array ≥ threshold agrees with scalar loop within 1e-12', async () => {
    const { gammaPDF } = await import('../src/typed/distributions.js');
    const xs = linspace(0.01, 10.0, WASM_SPECIAL_THRESHOLD);
    const k = 3,
      theta = 1.5;
    const lgK = refLgamma(k);
    const result = await (gammaPDF(xs, k, theta) as Promise<Float64Array>);
    for (let i = 0; i < xs.length; i++) {
      const ref = Math.exp((k - 1) * Math.log(xs[i]) - xs[i] / theta - lgK - k * Math.log(theta));
      expect(Math.abs(result[i] - ref)).toBeLessThan(TOL_AGREE);
    }
  });

  // Test 6: Erlang(2,1) mean = 2, f(2; 2, 1) = 2·exp(-2) ≈ 0.2707
  it('gammaPDF(2, 2, 1) = 2·exp(-2)', async () => {
    const { gammaPDF } = await import('../src/typed/distributions.js');
    // Gamma(k=2, theta=1): f(x) = x·exp(-x)  → f(2) = 2·e^{-2}
    const r = gammaPDF(2, 2, 1) as number;
    const ref = 2 * Math.exp(-2);
    expect(Math.abs(r - ref)).toBeLessThan(TOL);
  });
});

// ===========================================================================
// Suite 3 — studentTPDF
// ===========================================================================

describe('studentTPDF (Slice 5.8)', () => {
  // Test 1: scalar — studentTPDF(0, 5) — peak of t(5)
  it('studentTPDF(0, 5) matches reference', async () => {
    const { studentTPDF } = await import('../src/typed/distributions.js');
    const r = studentTPDF(0, 5) as number;
    // Ref: Γ(3)/( √(5π) · Γ(5/2) ) = 2 / (√(5π) · (3π/4)) — easier to compute directly
    const lgHalfNu1 = refLgamma(3); // lgamma((5+1)/2) = lgamma(3) = ln(2!)
    const lgHalfNu = refLgamma(2.5); // lgamma(5/2)
    const ref = Math.exp(lgHalfNu1 - lgHalfNu - 0.5 * Math.log(5 * Math.PI));
    expect(Math.abs(r - ref)).toBeLessThan(TOL);
  });

  // Test 2: symmetry — studentTPDF(x, ν) = studentTPDF(-x, ν)
  it('studentTPDF is symmetric: t(2, 5) = t(-2, 5)', async () => {
    const { studentTPDF } = await import('../src/typed/distributions.js');
    const r1 = studentTPDF(2, 5) as number;
    const r2 = studentTPDF(-2, 5) as number;
    expect(Math.abs(r1 - r2)).toBeLessThan(TOL);
  });

  // Test 3: df = 1 is Cauchy — studentTPDF(0, 1) = 1/π
  it('studentTPDF(0, 1) = 1/π (Cauchy)', async () => {
    const { studentTPDF } = await import('../src/typed/distributions.js');
    const r = studentTPDF(0, 1) as number;
    expect(Math.abs(r - 1 / Math.PI)).toBeLessThan(TOL);
  });

  // Test 4: array of known values [−2, 0, 2] with df=5
  it('studentTPDF Float64Array [-2, 0, 2] with df=5 matches reference', async () => {
    const { studentTPDF } = await import('../src/typed/distributions.js');
    const xs = new Float64Array([-2, 0, 2]);
    const df = 5;
    const result = await (studentTPDF(xs, df) as Promise<Float64Array>);
    const logNorm = refLgamma((df + 1) / 2) - refLgamma(df / 2) - 0.5 * Math.log(df * Math.PI);
    for (let i = 0; i < xs.length; i++) {
      const ref = Math.exp(logNorm - ((df + 1) / 2) * Math.log(1 + (xs[i] * xs[i]) / df));
      expect(Math.abs(result[i] - ref)).toBeLessThan(TOL_AGREE);
    }
  });

  // Test 5: large array (≥ threshold) agrees with scalar loop
  it('studentTPDF Float64Array ≥ threshold agrees with scalar loop within 1e-12', async () => {
    const { studentTPDF } = await import('../src/typed/distributions.js');
    const xs = linspace(-5.0, 5.0, WASM_SPECIAL_THRESHOLD);
    const df = 10;
    const result = await (studentTPDF(xs, df) as Promise<Float64Array>);
    const logNorm = refLgamma((df + 1) / 2) - refLgamma(df / 2) - 0.5 * Math.log(df * Math.PI);
    for (let i = 0; i < xs.length; i++) {
      const ref = Math.exp(logNorm - ((df + 1) / 2) * Math.log(1 + (xs[i] * xs[i]) / df));
      expect(Math.abs(result[i] - ref)).toBeLessThan(TOL_AGREE);
    }
  });

  // Test 6: invalid df returns NaN
  it('studentTPDF(0, -1) returns NaN', async () => {
    const { studentTPDF } = await import('../src/typed/distributions.js');
    const r = studentTPDF(0, -1) as number;
    expect(isNaN(r)).toBe(true);
  });
});

// ===========================================================================
// Suite 4 — noncentralChi2PDF
// ===========================================================================

describe('noncentralChi2PDF (Slice 5.8)', () => {
  // Test 1: ncp = 0 reduces to central chi-squared
  it('noncentralChi2PDF(x, df, 0) matches central chi2 formula', async () => {
    const { noncentralChi2PDF } = await import('../src/typed/distributions.js');
    const x = 2,
      df = 4;
    const r = noncentralChi2PDF(x, df, 0) as number;
    // Central chi2: f(x; k) = x^(k/2-1) exp(-x/2) / (2^(k/2) Γ(k/2))
    const halfDf = df / 2;
    const ref = Math.exp(
      (halfDf - 1) * Math.log(x) - x / 2 - halfDf * Math.log(2) - refLgamma(halfDf)
    );
    expect(Math.abs(r - ref)).toBeLessThan(1e-8);
  });

  // Test 2: x = 0 returns 0
  it('noncentralChi2PDF(0, 2, 1) = 0', async () => {
    const { noncentralChi2PDF } = await import('../src/typed/distributions.js');
    const r = noncentralChi2PDF(0, 2, 1) as number;
    expect(r).toBe(0);
  });

  // Test 3: scalar correctness for known value
  it('noncentralChi2PDF(1, 2, 1) ≈ 0.2220 (reference check)', async () => {
    const { noncentralChi2PDF } = await import('../src/typed/distributions.js');
    const r = noncentralChi2PDF(1, 2, 1) as number;
    // Approximate reference from numerical tables: ~0.2220
    expect(r).toBeGreaterThan(0.21);
    expect(r).toBeLessThan(0.24);
  });

  // Test 4: array below threshold returns correct values
  it('noncentralChi2PDF Float64Array below threshold returns correct values', async () => {
    const { noncentralChi2PDF } = await import('../src/typed/distributions.js');
    const xs = new Float64Array([1, 2, 3, 4, 5]);
    const df = 4,
      ncp = 2;
    const scalar = await (noncentralChi2PDF(xs, df, ncp) as Promise<Float64Array>);
    // Verify each element matches the scalar call
    for (let i = 0; i < xs.length; i++) {
      const ref = noncentralChi2PDF(xs[i], df, ncp) as number;
      expect(Math.abs(scalar[i] - ref)).toBeLessThan(TOL_AGREE);
    }
  });

  // Test 5: large array (≥ threshold) agrees with scalar loop within 1e-12
  it('noncentralChi2PDF Float64Array ≥ threshold agrees with scalar loop within 1e-12', async () => {
    const { noncentralChi2PDF } = await import('../src/typed/distributions.js');
    const xs = linspace(0.1, 20.0, WASM_SPECIAL_THRESHOLD);
    const df = 3,
      ncp = 4;
    const result = await (noncentralChi2PDF(xs, df, ncp) as Promise<Float64Array>);
    for (let i = 0; i < xs.length; i++) {
      const ref = noncentralChi2PDF(xs[i], df, ncp) as number;
      expect(Math.abs(result[i] - ref)).toBeLessThan(TOL_AGREE);
    }
  });

  // Test 6: invalid parameters return NaN
  it('noncentralChi2PDF with df ≤ 0 returns NaN', async () => {
    const { noncentralChi2PDF } = await import('../src/typed/distributions.js');
    const r = noncentralChi2PDF(1, -2, 1) as number;
    expect(isNaN(r)).toBe(true);
  });
});
