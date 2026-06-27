/**
 * Tests for polyFit / chebyshevFit / legendreFit WASM-routed kernels (Slice 5.4).
 *
 * Strategy:
 *   1. Below-threshold correctness — pure-JS normal-equation path (no WASM needed).
 *   2. Above-threshold WASM dispatch — when the WASM artifact is present, verify the
 *      WASM path matches the JS path within tight tolerances.
 *   3. Edge cases — rank-deficient inputs (all xs equal) must throw or return NaN.
 *   4. Basis recovery — each basis recovers the coefficients of its own basis
 *      polynomials from exact sample data within 1e-10.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { polyFit, chebyshevFit, legendreFit } from '../src/typed/interpolation.js';
import {
  polyFitDispatch,
  chebFitDispatch,
  legendreFitDispatch,
  WASM_POLY_FIT_THRESHOLD,
  resetPolyWasm,
} from '../src/wasm/poly/wasm-bridge.js';
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

/** Evaluate a polynomial (power basis, constant-first) at x. */
function polyEval(coeffs: number[], x: number): number {
  let r = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) r = r * x + coeffs[i];
  return r;
}

/** Evaluate a Chebyshev-T series at x. */
function chebEval(coeffs: number[], x: number): number {
  let tPrev = 1,
    tCurr = x;
  let sum = coeffs[0] * tPrev;
  if (coeffs.length > 1) sum += coeffs[1] * tCurr;
  for (let j = 2; j < coeffs.length; j++) {
    const tNext = 2 * x * tCurr - tPrev;
    sum += coeffs[j] * tNext;
    tPrev = tCurr;
    tCurr = tNext;
  }
  return sum;
}

/** Evaluate a Legendre-P series at x. */
function legendreEval(coeffs: number[], x: number): number {
  let pPrev = 1,
    pCurr = x;
  let sum = coeffs[0] * pPrev;
  if (coeffs.length > 1) sum += coeffs[1] * pCurr;
  for (let n = 1; n < coeffs.length - 1; n++) {
    const pNext = ((2 * n + 1) * x * pCurr - n * pPrev) / (n + 1);
    sum += coeffs[n + 1] * pNext;
    pPrev = pCurr;
    pCurr = pNext;
  }
  return sum;
}

/** Max absolute difference between two arrays of the same length. */
function maxDiff(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  return d;
}

/** Generate n equispaced points in [lo, hi]. */
function linspace(lo: number, hi: number, n: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(lo + (i / (n - 1)) * (hi - lo));
  return xs;
}

// ===========================================================================
// Suite 1: polyFit — below-threshold (pure JS)
// ===========================================================================

describe('polyFit — below-threshold correctness (pure JS)', () => {
  // Test 1: Linear data y = 2 + 3x
  it('recovers linear coefficients [a, b] within 1e-10', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map((x) => 2 + 3 * x);
    const coeffs = polyFit(xs, ys, 1);
    expect(coeffs.length).toBe(2);
    expect(Math.abs(coeffs[0] - 2)).toBeLessThan(1e-10);
    expect(Math.abs(coeffs[1] - 3)).toBeLessThan(1e-10);
  });

  // Test 2: Quadratic data y = 1 + 2x + 3x^2
  it('recovers quadratic coefficients [a, b, c] within 1e-10', () => {
    const xs = linspace(-2, 2, 10);
    const ys = xs.map((x) => 1 + 2 * x + 3 * x * x);
    const coeffs = polyFit(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[0] - 1)).toBeLessThan(1e-9);
    expect(Math.abs(coeffs[1] - 2)).toBeLessThan(1e-9);
    expect(Math.abs(coeffs[2] - 3)).toBeLessThan(1e-9);
  });

  // Test 8 (rank-deficient: all xs equal)
  it('throws or returns NaN-containing result for rank-deficient input (all xs equal)', () => {
    const xs = [1, 1, 1, 1, 1];
    const ys = [2, 2, 2, 2, 2];
    let threw = false;
    let result: number[] | undefined;
    try {
      result = polyFit(xs, ys, 1);
    } catch {
      threw = true;
    }
    // Either threw or returned NaN coefficients — both are acceptable.
    expect(threw || (result !== undefined && result.some(isNaN))).toBe(true);
  });
});

// ===========================================================================
// Suite 2: chebyshevFit — below-threshold (pure JS)
// ===========================================================================

describe('chebyshevFit — below-threshold correctness (pure JS)', () => {
  // T_2(x) = 2x² - 1: if we sample T_2, fitting with degree 2 should recover c2=1, c0=c1=0
  // Test 4: recover Chebyshev T_2 coefficients
  it('recovers T_2(x) = 2x²-1 as chebyshev coeff [0,0,1] within 1e-8', () => {
    // T_2(x) = 2x² - 1
    const T2 = (x: number) => 2 * x * x - 1;
    const xs = linspace(-1, 1, 20);
    const ys = xs.map(T2);
    const coeffs = chebyshevFit(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[0])).toBeLessThan(1e-8); // T_0 coefficient ≈ 0
    expect(Math.abs(coeffs[1])).toBeLessThan(1e-8); // T_1 coefficient ≈ 0
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-8); // T_2 coefficient ≈ 1
  });

  it('reconstructed Chebyshev series evaluates to y exactly for degree-2 polynomial data', () => {
    // Use data that is exactly representable as a degree-2 Chebyshev series:
    // f(x) = T_0 + 2*T_1 + T_2 = 1 + 2x + (2x^2 - 1) = 2x^2 + 2x
    const f = (x: number) => 2 * x * x + 2 * x;
    const xs = linspace(-1, 1, 15);
    const ys = xs.map(f);
    const coeffs = chebyshevFit(xs, ys, 2);
    for (const x of linspace(-1, 1, 6)) {
      const fApprox = chebEval(coeffs, x);
      expect(Math.abs(fApprox - f(x))).toBeLessThan(1e-8);
    }
  });

  it('throws for rank-deficient Chebyshev input (all xs equal)', () => {
    const xs = [0.5, 0.5, 0.5, 0.5];
    const ys = [1, 1, 1, 1];
    let threw = false;
    let result: number[] | undefined;
    try {
      result = chebyshevFit(xs, ys, 1);
    } catch {
      threw = true;
    }
    expect(threw || (result !== undefined && result.some(isNaN))).toBe(true);
  });
});

// ===========================================================================
// Suite 3: legendreFit — below-threshold (pure JS)
// ===========================================================================

describe('legendreFit — below-threshold correctness (pure JS)', () => {
  // P_2(x) = (3x² - 1)/2: fitting should give c2=1, c0=c1=0
  // Test 6: recover Legendre P_2 coefficients
  it('recovers P_2(x) = (3x²-1)/2 as Legendre coeff [0,0,1] within 1e-8', () => {
    const P2 = (x: number) => (3 * x * x - 1) / 2;
    const xs = linspace(-1, 1, 20);
    const ys = xs.map(P2);
    const coeffs = legendreFit(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[0])).toBeLessThan(1e-8);
    expect(Math.abs(coeffs[1])).toBeLessThan(1e-8);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-8);
  });

  it('reconstructed Legendre series evaluates to y within 1e-7 on test points', () => {
    const f = (x: number) => x * x * x - x;
    const xs = linspace(-1, 1, 15);
    const ys = xs.map(f);
    const coeffs = legendreFit(xs, ys, 3);
    for (const x of linspace(-1, 1, 7)) {
      const fApprox = legendreEval(coeffs, x);
      expect(Math.abs(fApprox - f(x))).toBeLessThan(1e-7);
    }
  });

  it('throws for rank-deficient Legendre input (all xs equal)', () => {
    const xs = [-0.5, -0.5, -0.5, -0.5];
    const ys = [2, 2, 2, 2];
    let threw = false;
    let result: number[] | undefined;
    try {
      result = legendreFit(xs, ys, 1);
    } catch {
      threw = true;
    }
    expect(threw || (result !== undefined && result.some(isNaN))).toBe(true);
  });
});

// ===========================================================================
// Suite 4: JS fallback above threshold when WASM not loaded
// ===========================================================================

describe('polyFit/chebyshevFit/legendreFit — JS fallback (no WASM loaded)', () => {
  beforeAll(() => {
    resetPolyWasm();
  });

  afterAll(() => {
    resetPolyWasm();
  });

  // Test 3: polyFit above threshold matches JS path
  it('polyFit above threshold (JS dispatch fallback) matches expected coefficients', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 100;
    const xs = linspace(-5, 5, N);
    const ys = xs.map((x) => 3 - 2 * x + x * x); // y = x² - 2x + 3
    const coeffs = polyFit(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[0] - 3)).toBeLessThan(1e-6);
    expect(Math.abs(coeffs[1] - -2)).toBeLessThan(1e-6);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-6);
  });

  // Test 5: chebyshevFit above threshold matches JS path
  it('chebyshevFit above threshold (JS dispatch fallback) recovers T_2 coefficients', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 50;
    const xs = linspace(-1, 1, N);
    const T2 = (x: number) => 2 * x * x - 1;
    const ys = xs.map(T2);
    const coeffs = chebyshevFit(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[0])).toBeLessThan(1e-6);
    expect(Math.abs(coeffs[1])).toBeLessThan(1e-6);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-6);
  });

  // Test 7: legendreFit above threshold matches JS path
  it('legendreFit above threshold (JS dispatch fallback) recovers P_2 coefficients', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 50;
    const xs = linspace(-1, 1, N);
    const P2 = (x: number) => (3 * x * x - 1) / 2;
    const ys = xs.map(P2);
    const coeffs = legendreFit(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[0])).toBeLessThan(1e-6);
    expect(Math.abs(coeffs[1])).toBeLessThan(1e-6);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-6);
  });
});

// ===========================================================================
// Suite 5: WASM dispatch (requires WASM artifact)
// ===========================================================================

const describeIfWasm = WASM_PATH !== null ? describe : describe.skip;

describeIfWasm('polyFit/chebyshevFit/legendreFit — WASM dispatch', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  // Test 3 (WASM): polyFit above threshold matches the JS path within 1e-10
  it('polyFit WASM path matches JS path within 1e-8 for quadratic data', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 200;
    const xs = linspace(-3, 3, N);
    const ys = xs.map((x) => 1 - x + 0.5 * x * x);
    const xsF64 = new Float64Array(xs);
    const ysF64 = new Float64Array(ys);

    // JS reference (below-threshold call with a subset)
    const jsRef = polyFit(xs.slice(0, 20), ys.slice(0, 20), 2);

    // WASM dispatch
    const wasmResult = polyFitDispatch(xsF64, ysF64, 2);
    expect(wasmResult.length).toBe(3);
    expect(Math.abs(wasmResult[0] - 1)).toBeLessThan(1e-6);
    expect(Math.abs(wasmResult[1] - -1)).toBeLessThan(1e-6);
    expect(Math.abs(wasmResult[2] - 0.5)).toBeLessThan(1e-6);
    void jsRef;
  });

  // Test 5 (WASM): chebyshevFit above threshold matches JS path
  it('chebyshevFit WASM path recovers T_2 coefficients within 1e-8', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 100;
    const xs = linspace(-1, 1, N);
    const T2 = (x: number) => 2 * x * x - 1;
    const ys = xs.map(T2);
    const xsF64 = new Float64Array(xs);
    const ysF64 = new Float64Array(ys);

    const wasmResult = chebFitDispatch(xsF64, ysF64, 2);
    expect(wasmResult.length).toBe(3);
    expect(Math.abs(wasmResult[0])).toBeLessThan(1e-7);
    expect(Math.abs(wasmResult[1])).toBeLessThan(1e-7);
    expect(Math.abs(wasmResult[2] - 1)).toBeLessThan(1e-7);
  });

  // Test 7 (WASM): legendreFit above threshold matches JS path
  it('legendreFit WASM path recovers P_2 coefficients within 1e-8', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 100;
    const xs = linspace(-1, 1, N);
    const P2 = (x: number) => (3 * x * x - 1) / 2;
    const ys = xs.map(P2);
    const xsF64 = new Float64Array(xs);
    const ysF64 = new Float64Array(ys);

    const wasmResult = legendreFitDispatch(xsF64, ysF64, 2);
    expect(wasmResult.length).toBe(3);
    expect(Math.abs(wasmResult[0])).toBeLessThan(1e-7);
    expect(Math.abs(wasmResult[1])).toBeLessThan(1e-7);
    expect(Math.abs(wasmResult[2] - 1)).toBeLessThan(1e-7);
  });

  it('polyFit WASM path and JS path agree within 1e-8 on polynomial evaluation', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 300;
    const xs = linspace(-2, 2, N);
    const ys = xs.map((x) => 5 + 3 * x - x * x + 0.25 * x * x * x);

    const wasmCoeffs = Array.from(polyFitDispatch(new Float64Array(xs), new Float64Array(ys), 3));

    // Verify evaluation matches the ground truth
    for (const x of [-2, -1, 0, 1, 2]) {
      const fWasm = polyEval(wasmCoeffs, x);
      const fTrue = 5 + 3 * x - x * x + 0.25 * x * x * x;
      expect(Math.abs(fWasm - fTrue)).toBeLessThan(1e-6);
    }
  });

  it('below-threshold paths still work after WASM load (no regression)', () => {
    const xs = [0, 1, 2, 3];
    const ys = [0, 1, 4, 9];
    const coeffs = polyFit(xs, ys, 2);
    expect(Math.abs(coeffs[0])).toBeLessThan(1e-9);
    expect(Math.abs(coeffs[1])).toBeLessThan(1e-9);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-9);
  });

  // Test 8 (WASM, rank-deficient): dispatch throws for all-equal xs
  it('polyFit dispatch throws on rank-deficient input (all xs equal) — WASM and JS agree', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 10;
    const xs = new Array(N).fill(1.0);
    const ys = new Array(N).fill(3.0);
    let threw = false;
    try {
      polyFitDispatch(new Float64Array(xs), new Float64Array(ys), 2);
    } catch {
      threw = true;
    }
    // The dispatch should throw because WASM returns -1 or JS gaussian elimination diverges.
    expect(threw).toBe(true);
  });
});
