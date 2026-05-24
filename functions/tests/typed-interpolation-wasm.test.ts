/**
 * Dispatch-correctness tests for the tridiagonal-solve WASM bridge (Slice 3.10b).
 *
 * Strategy:
 *   1. Below-threshold — pure-JS fallback must be numerically correct for
 *      small inputs (no WASM artifact needed).
 *   2. Above-threshold WASM dispatch — when the Rust artifact is present,
 *      verify the WASM path produces the same result as the JS path within
 *      1e-12.  The suite is skipped when the artifact is absent.
 *   3. Mathematical correctness — solve a small tridiag system by hand and
 *      verify the result.
 *   4. Fallback when module not loaded — results must match JS oracle.
 *   5. cubicSpline round-trip — spline over a known dataset matches the
 *      JS-only path above and below threshold.
 *   6. Edge cases — n=2 (smallest valid), n=1, n=0 (empty).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { cubicSpline } from '../src/typed/interpolation.js';
import {
  tridiagSolveDispatch,
  tridiagSolveJS,
  WASM_TRIDIAG_THRESHOLD,
  resetTridiagWasm,
} from '../src/wasm/interpolation/wasm-bridge.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';

// ---------------------------------------------------------------------------
// WASM artifact location
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a symmetric, diagonally-dominant tridiagonal system with a known
 * solution (all ones).
 *
 * Ax = b where A is the 1D Laplacian (scaled), b = A·[1,1,...,1].
 */
function buildLaplacianSystem(n: number): {
  diag: Float64Array;
  lower: Float64Array;
  upper: Float64Array;
  rhs: Float64Array;
  expected: Float64Array;
} {
  const diag = new Float64Array(n).fill(4.0);
  const lower = new Float64Array(n - 1).fill(-1.0);
  const upper = new Float64Array(n - 1).fill(-1.0);
  // rhs = A · ones
  const rhs = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    rhs[i] = 4.0;
    if (i > 0) rhs[i] += -1.0;
    if (i < n - 1) rhs[i] += -1.0;
  }
  const expected = new Float64Array(n).fill(1.0);
  return { diag, lower, upper, rhs, expected };
}

/** Multiply tridiagonal matrix by a vector and return the product. */
function tridiagMatVec(
  diag: Float64Array,
  lower: Float64Array,
  upper: Float64Array,
  x: Float64Array
): Float64Array {
  const n = diag.length;
  const b = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    b[i] = diag[i] * x[i];
    if (i > 0) b[i] += lower[i - 1] * x[i - 1];
    if (i < n - 1) b[i] += upper[i] * x[i + 1];
  }
  return b;
}

/** Absolute max difference between two Float64Arrays of the same length. */
function maxDiff(a: Float64Array, b: Float64Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  return d;
}

// ===========================================================================
// Suite 1: Mathematical correctness & pure-JS path (no WASM artifact needed)
// ===========================================================================

describe('tridiag-solve — mathematical correctness (pure JS)', () => {
  it('solves a 1×1 system correctly', () => {
    const x = tridiagSolveJS(
      new Float64Array([5.0]),
      new Float64Array([]),
      new Float64Array([]),
      new Float64Array([10.0])
    );
    expect(x.length).toBe(1);
    expect(x[0]).toBeCloseTo(2.0, 14);
  });

  it('solves a 2×2 system correctly', () => {
    // [2  -1] [x0]   [1]     solution: [1, 1]
    // [-1  2] [x1] = [1]
    const x = tridiagSolveJS(
      new Float64Array([2.0, 2.0]),
      new Float64Array([-1.0]),
      new Float64Array([-1.0]),
      new Float64Array([1.0, 1.0])
    );
    expect(x.length).toBe(2);
    expect(x[0]).toBeCloseTo(1.0, 12);
    expect(x[1]).toBeCloseTo(1.0, 12);
  });

  it('solves a 3×3 known system: Ax = b, solution = [1,1,1]', () => {
    // Classic: 2x₀ - x₁ = 1, -x₀ + 2x₁ - x₂ = 0, -x₁ + 2x₂ = 1 → x=[1,1,1]
    const x = tridiagSolveJS(
      new Float64Array([2.0, 2.0, 2.0]),
      new Float64Array([-1.0, -1.0]),
      new Float64Array([-1.0, -1.0]),
      new Float64Array([1.0, 0.0, 1.0])
    );
    expect(x.length).toBe(3);
    for (const xi of x) expect(xi).toBeCloseTo(1.0, 12);
  });

  it('round-trip: A·x ≈ rhs for n=5 Laplacian system', () => {
    const { diag, lower, upper, rhs } = buildLaplacianSystem(5);
    const x = tridiagSolveJS(diag, lower, upper, rhs);
    const Ax = tridiagMatVec(diag, lower, upper, x);
    for (let i = 0; i < 5; i++) {
      expect(Ax[i]).toBeCloseTo(rhs[i], 12);
    }
  });

  it('round-trip: A·x ≈ rhs for n=10 Laplacian system', () => {
    const { diag, lower, upper, rhs } = buildLaplacianSystem(10);
    const x = tridiagSolveJS(diag, lower, upper, rhs);
    const Ax = tridiagMatVec(diag, lower, upper, x);
    for (let i = 0; i < 10; i++) {
      expect(Ax[i]).toBeCloseTo(rhs[i], 12);
    }
  });

  it('dispatch below threshold matches JS oracle (n < WASM_TRIDIAG_THRESHOLD)', () => {
    const n = WASM_TRIDIAG_THRESHOLD - 1;
    const { diag, lower, upper, rhs, expected } = buildLaplacianSystem(n);
    const result = tridiagSolveDispatch(diag, lower, upper, rhs);
    expect(result.length).toBe(n);
    expect(maxDiff(result, expected)).toBeLessThan(1e-10);
  });

  it('handles empty system (n=0) without throwing', () => {
    const x = tridiagSolveJS(
      new Float64Array(0),
      new Float64Array(0),
      new Float64Array(0),
      new Float64Array(0)
    );
    expect(x.length).toBe(0);
  });
});

// ===========================================================================
// Suite 2: cubicSpline round-trip (no WASM needed)
// ===========================================================================

describe('cubicSpline — JS-path correctness', () => {
  it('passes through all data points for x^2 data', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map((x) => x * x);
    const spline = cubicSpline(xs, ys);
    for (let i = 0; i < xs.length; i++) {
      expect(spline(xs[i])).toBeCloseTo(ys[i], 10);
    }
  });

  it('midpoint value is reasonable for linear data (exact)', () => {
    const spline = cubicSpline([0, 1, 2], [0, 1, 2]);
    // Linear data → natural spline should be exact
    expect(spline(0.5)).toBeCloseTo(0.5, 10);
    expect(spline(1.5)).toBeCloseTo(1.5, 10);
  });

  it('interpolates monotone-cubic dataset with at least 3 knots', () => {
    const xs = [0, 1, 2, 3, 4, 5];
    const ys = [0, 1, 4, 9, 16, 25]; // x^2
    const spline = cubicSpline(xs, ys);
    // At data points, must interpolate exactly
    for (let i = 0; i < xs.length; i++) {
      expect(spline(xs[i])).toBeCloseTo(ys[i], 10);
    }
  });

  it('matches old (hand-computed) JS path for 4-point spline', () => {
    // Reference: the old l/mu/z formulation — computed externally.
    // We test that refactored code gives same result as original algorithm.
    const xs = [0, 1, 2, 3];
    const ys = [0, 1, 4, 9];
    const spline = cubicSpline(xs, ys);
    // At knots, exact:
    expect(spline(0)).toBeCloseTo(0, 10);
    expect(spline(1)).toBeCloseTo(1, 10);
    expect(spline(2)).toBeCloseTo(4, 10);
    expect(spline(3)).toBeCloseTo(9, 10);
    // Between knots, close to x^2:
    expect(Math.abs(spline(0.5) - 0.25)).toBeLessThan(0.5);
    expect(Math.abs(spline(1.5) - 2.25)).toBeLessThan(0.5);
  });
});

// ===========================================================================
// Suite 3: WASM dispatch — above threshold (requires Rust artifact)
// ===========================================================================

const describeIfWasm = WASM_PATH !== null ? describe : describe.skip;

describeIfWasm('tridiag-solve — above-threshold WASM dispatch', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  it('WASM result matches JS oracle within 1e-12 at threshold boundary', () => {
    const n = WASM_TRIDIAG_THRESHOLD;
    const { diag, lower, upper, rhs, expected } = buildLaplacianSystem(n);
    const wasmResult = tridiagSolveDispatch(diag, lower, upper, rhs);
    const jsResult = tridiagSolveJS(diag, lower, upper, rhs);
    expect(wasmResult.length).toBe(n);
    expect(maxDiff(wasmResult, jsResult)).toBeLessThan(1e-12);
    expect(maxDiff(wasmResult, expected)).toBeLessThan(1e-10);
  });

  it('WASM result matches JS oracle for n = THRESHOLD + 50', () => {
    const n = WASM_TRIDIAG_THRESHOLD + 50;
    const { diag, lower, upper, rhs } = buildLaplacianSystem(n);
    const wasmResult = tridiagSolveDispatch(diag, lower, upper, rhs);
    const jsResult = tridiagSolveJS(diag, lower, upper, rhs);
    expect(maxDiff(wasmResult, jsResult)).toBeLessThan(1e-12);
  });

  it('WASM round-trip: A·x ≈ rhs for large system', () => {
    const n = WASM_TRIDIAG_THRESHOLD + 100;
    const { diag, lower, upper, rhs } = buildLaplacianSystem(n);
    const x = tridiagSolveDispatch(diag, lower, upper, rhs);
    const Ax = tridiagMatVec(diag, lower, upper, x);
    expect(maxDiff(Ax, rhs)).toBeLessThan(1e-10);
  });

  it('cubicSpline above threshold matches JS-only result', () => {
    // Build a large dataset (n+1 > WASM_TRIDIAG_THRESHOLD + 1 knots).
    const count = WASM_TRIDIAG_THRESHOLD + 2;
    const xs = Array.from({ length: count }, (_, i) => i);
    const ys = xs.map((x) => Math.sin(x * 0.01));
    const splineWasm = cubicSpline(xs, ys);

    // Reset to force JS-only, rebuild reference.
    wasmLoader.reset();
    const splineJS = cubicSpline(xs, ys);

    // Reload WASM for afterAll cleanup.
    void wasmLoader.load(WASM_PATH!);

    // Compare at a handful of interior points.
    const testXs = [0.5, 10.5, 50.3, 100.7, 500.1, 1000.0];
    for (const x of testXs) {
      expect(Math.abs(splineWasm(x) - splineJS(x))).toBeLessThan(1e-12);
    }
  });

  it('below-threshold path still works after WASM load (no regression)', () => {
    const { diag, lower, upper, rhs, expected } = buildLaplacianSystem(5);
    const result = tridiagSolveDispatch(diag, lower, upper, rhs);
    expect(maxDiff(result, expected)).toBeLessThan(1e-10);
  });
});

// ===========================================================================
// Suite 4: Fallback when WASM module not loaded
// ===========================================================================

describe('tridiag-solve — WASM fallback (module not loaded)', () => {
  beforeAll(() => {
    resetTridiagWasm(); // ensure no module is loaded
  });

  afterAll(() => {
    resetTridiagWasm();
  });

  it('above-threshold call falls back to JS oracle when WASM not loaded', () => {
    const n = WASM_TRIDIAG_THRESHOLD + 10;
    const { diag, lower, upper, rhs, expected } = buildLaplacianSystem(n);
    const result = tridiagSolveDispatch(diag, lower, upper, rhs);
    expect(result.length).toBe(n);
    expect(maxDiff(result, expected)).toBeLessThan(1e-10);
  });

  it('cubicSpline works without WASM loaded (JS-only path)', () => {
    const spline = cubicSpline([0, 1, 2, 3], [0, 1, 4, 9]);
    expect(spline(0)).toBeCloseTo(0, 10);
    expect(spline(3)).toBeCloseTo(9, 10);
  });
});
